import fs from 'node:fs';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import 'dotenv/config';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { WebSocketServer,WebSocket } from 'ws';
import { ids } from '../../../config/ids.js';
import { assetDirectory } from '../../../config/assets.js';
import { db,events,audit,changed } from '../../../packages/shared/src/database.js';
import { DatabaseStore } from '../../../packages/shared/src/store.js';
import { demand,allowed } from '../../../packages/shared/src/permissions.js';
import { configureAuth,sessionUser } from './auth.js';
import {configurePublicErlc} from './public-erlc.js';
import {configureWebsiteWorkspace} from './website-workspace.js';
import { configureCad } from './cad.js';
import { ErlcAdapter } from './erlc.js';
import { createBot,allCommands } from '../../bot/src/main.js';
import { dashboard } from '../../bot/src/dashboard.js';
import { startJobs } from './jobs.js';
import { z } from 'zod';
import { closeRuntime } from '../../../packages/shared/src/runtime.js';

if(!process.env.APP_SESSION_SECRET||process.env.APP_SESSION_SECRET.length<32||process.env.APP_SESSION_SECRET.startsWith('REPLACE'))throw Error('Configure a random APP_SESSION_SECRET of at least 32 characters.');
if(process.env.NODE_ENV==='production'&&process.env.DEMO_MODE==='true')throw Error('DEMO_MODE is prohibited in production');
await db.$connect();
const store=new DatabaseStore();await store.load();store.guild(ids.guildId||'DEMO_GUILD');
const erlc=new ErlcAdapter(process.env.ERLC_SERVER_API_KEY??'');
const {client,service,applications,bootstrap}=createBot(store,erlc);
const app=express(),server=http.createServer(app);app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'",'data:'],connectSrc:["'self'"],objectSrc:["'none'"],upgradeInsecureRequests:null}},crossOriginEmbedderPolicy:false}));
app.use(express.json({limit:'96kb'}));
const rate=new Map<string,{at:number;count:number}>();
app.use((req,res,next)=>{const key=req.ip??'unknown',bucket=rate.get(key)??{at:Date.now(),count:0};if(Date.now()-bucket.at>60000){bucket.at=Date.now();bucket.count=0;}bucket.count++;rate.set(key,bucket);if(bucket.count>180)return res.status(429).json({error:'Too many requests. Try again shortly.'});res.set('Cache-Control','no-store');next();});
app.get('/health',async(req,res)=>{try{await db.$queryRaw`SELECT 1`;res.json({service:'LASRP Operations',database:'connected',discord:client.isReady()?'connected':'offline'});}catch{res.status(503).json({service:'LASRP Operations',database:'unavailable'});}});
app.use('/assets/branding',express.static(assetDirectory));
// Local owner-only editor retains its own token and Discord management check.
app.use('/admin',dashboard(service,{...process.env,DISCORD_GUILD_ID:ids.guildId,DISCORD_ADMIN_ID:ids.owners[0]}));
// Explicitly sanitized public read route must precede the existing /api authentication gate.
configurePublicErlc(app,erlc,{sessions:async()=>{const rows=await db.scheduledSession.findMany({where:{guildId:ids.guildId,status:'scheduled',startsAt:{gte:new Date()}},orderBy:{startsAt:'asc'},take:5,select:{startsAt:true}});return rows.map(row=>({startsAt:row.startsAt.toISOString(),status:'scheduled' as const,announcementUrl:`https://discord.com/channels/${ids.guildId}/${ids.channels.sessions}`}));}});
configureAuth(app,client);
configureWebsiteWorkspace(app);
configureCad(app,service);
app.get('/api/applications',async(req,res)=>{
 const isReviewer=allowed(req.principal,'reviewer');const rows=await db.application.findMany({where:{guildId:ids.guildId,...(!isReviewer?{applicantId:req.principal.id}:{OR:[{applicantId:req.principal.id},{status:{in:['submitted','interview','more_info','accepted','denied']}}]})},orderBy:{createdAt:'desc'},take:25});res.json(rows.map(r=>isReviewer?r:{...r,privateNotes:undefined,history:undefined}));
});
app.post('/api/applications/begin',(req,res)=>res.status(403).json({error:`Start staff applications in Discord channel ${ids.channels.applicationsPanel}.`}));
app.get('/api/application-settings',(req,res)=>{demand(req.principal,'management');res.json(applications.settings());});
app.put('/api/application-settings',async(req,res)=>{demand(req.principal,'management');const settings=z.object({open:z.boolean(),requirements:z.string().min(5).max(600),cooldownHours:z.number().int().min(0).max(8760),questions:z.array(z.string().min(5).max(400)).min(1).max(25)}).strict().parse(req.body);const g=store.guild(ids.guildId||'DEMO_GUILD');g.config.applicationSettings=settings;store.change(ids.guildId||'DEMO_GUILD',req.principal.id,'application.settings',settings);await store.flush();res.json(settings);});
app.post('/api/applications/:id/answer',(req,res)=>res.status(403).json({error:'Answer staff application questions in your Discord DMs.'}));
app.post('/api/applications/:id/submit',async(req,res)=>{
 const application=await db.application.findUniqueOrThrow({where:{id:String(req.params.id)}});applications.own(application,req.principal.id);if(!['draft','paused'].includes(application.status)||(application.answers as string[]).length!==(application.questions as string[]).length)throw Error('Complete all answers before submitting');
 const pending=await applications.update(application,{status:'submitting'},req.principal.id,'application.web-submit');try{await applications.publishReview(pending);const next=await applications.update(pending,{status:'submitted'},req.principal.id,'application.submitted');res.json({...next,privateNotes:undefined,history:undefined});}catch(error){await applications.update(pending,{status:'draft'},req.principal.id,'application.submit-failed');throw error;}
});
app.post('/api/applications/:id/review',async(req,res)=>{demand(req.principal,'reviewer');const body=z.object({version:z.number().int().positive(),action:z.enum(['accept','deny','interview','more_info','note']),reason:z.string().min(3).max(1500)}).strict().parse(req.body);const application=await db.application.findUniqueOrThrow({where:{id:String(req.params.id)}});if(application.version!==body.version)throw Error('Application changed; refresh before reviewing');res.json(await applications.review(application,req.principal.id,body.action,body.reason));});
app.get('/api/transcripts/:id',async(req,res)=>{
 const record=await db.ticketTranscript.findUniqueOrThrow({where:{id:String(req.params.id)}});if(record.expiresAt.getTime()<Date.now())throw Error('Transcript retention period ended');const ticket=store.guild(record.guildId).tickets[record.id];if(ticket?.accusedId===req.principal.id)throw Object.assign(Error('Transcript conflict restriction'),{status:403});if(record.openerId!==req.principal.id&&!allowed(req.principal,'management')&&!((record.staffIds as string[]).includes(req.principal.id)&&allowed(req.principal,'support')))throw Object.assign(Error('Transcript access denied'),{status:403});await audit(req.principal.id,'transcript.read',record.id,null,{});res.set({'Content-Type':'text/plain; charset=utf-8','Content-Disposition':`attachment; filename="LASRP-ticket-${record.id.replace(/[^a-zA-Z0-9_-]/g,'')}.txt"`}).send(record.text);
});
app.get('/api/telemetry',async(req,res)=>{demand(req.principal,'dispatcher','police','sheriff','fire','ems','dot');const g=store.guild(ids.guildId||'DEMO_GUILD');res.json(g.live??{healthy:false,synced:null,players:[],source:'No telemetry received'});});
app.get('/api/config',async(req,res)=>{demand(req.principal,'management');res.json({config:store.guild(ids.guildId||'DEMO_GUILD').config,features:ids.featureFlags});});
app.post('/api/staff/requests/:id/review',async(req,res)=>{demand(req.principal,'management');const body=z.object({status:z.enum(['accepted','denied']),reason:z.string().min(3).max(1000)}).strict().parse(req.body),g=store.guild(ids.guildId||'DEMO_GUILD'),record=g.records[String(req.params.id)];if(!record||!['leave','suggestion','resignation','training'].includes(record.kind))throw Error('Request not found');if(record.user===req.principal.id)throw Error('Another manager must review your request');if(record.status!=='pending')throw Error('This request has already been reviewed');record.status=body.status;record.reason=body.reason;record.reviewer=req.principal.id;store.change(ids.guildId||'DEMO_GUILD',req.principal.id,'staff.request-reviewed',record);await store.flush();if(client.isReady()){try{const user=await client.users.fetch(record.user);const {notice}=await import('../../bot/src/panels.js');await user.send(notice('LASRP Request Review',`**Reference:** ${record.id}\n**Status:** ${body.status}\n**Review response:** ${body.reason}`,'blue',false));}catch{await audit(req.principal.id,'request.notification-failed',record.id,null,{});}}res.json(record);});
app.get('/api/roblox-link',async(req,res)=>res.json(await db.linkedRobloxAccount.findUnique({where:{userId:req.principal.id}})));
// Manual verification requires management evidence; no account passwords are collected.
app.post('/api/roblox-link',async(req,res)=>{demand(req.principal,'management');const body=z.object({userId:z.string().regex(/^\d{17,20}$/),robloxId:z.string().regex(/^\d+$/),username:z.string().min(3).max(30),evidence:z.string().min(10).max(500)}).strict().parse(req.body);if(body.userId===req.principal.id)throw Error('Another manager must verify your account');const row=await db.linkedRobloxAccount.upsert({where:{userId:body.userId},create:{userId:body.userId,robloxId:body.robloxId,username:body.username,verifiedAt:new Date()},update:{robloxId:body.robloxId,username:body.username,verifiedAt:new Date()}});await audit(req.principal.id,'roblox.link-manual',row.id,null,body);res.json(row);});
app.use(express.static(fileURLToPath(new URL('../../web/public/',import.meta.url)),{index:'index.html'}));
app.use((error:unknown,req:express.Request,res:express.Response,next:express.NextFunction)=>{
 const known=error instanceof z.ZodError?error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '):error instanceof Error?error.message:'Request failed';
 // Never return Prisma connection diagnostics or raw HTTP/OAuth credentials.
 const message=/prisma|database|connection|DATABASE_URL|postgresql:/i.test(known)?'Database operation could not be completed. Check server logs and refresh.':known;
 console.error('API request failed:',req.method,req.path,error instanceof Error?error.name:'Error');if(!res.headersSent)res.status((error as {status?:number}).status??400).json({error:message});
});
const sockets=new WebSocketServer({noServer:true});
server.on('upgrade',async(req,socket,head)=>{try{if(req.url!=='/live'||req.headers.origin!==(process.env.WEB_BASE_URL??'http://localhost:3000')){socket.destroy();return;}if(!await sessionUser(req.headers.cookie,client)){socket.destroy();return;}sockets.handleUpgrade(req,socket,head,ws=>{ws.on('error',()=>{});ws.send(JSON.stringify({type:'connected'}));setTimeout(()=>ws.close(1000,'Refresh authorization'),300000).unref();});}catch{socket.destroy();}});
events.on('changed',()=>{for(const ws of sockets.clients)if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'refresh'}));});
const port=Number(process.env.PORT??3000);server.listen(port,process.env.HOST??'127.0.0.1',()=>console.log(`LASRP CAD: http://localhost:${port}`));
const stopJobs=startJobs(service,applications,erlc,store);
const controlToken=randomBytes(32).toString('hex');
fs.mkdirSync('data',{recursive:true});fs.writeFileSync('data/runtime-control.json',JSON.stringify({port,token:controlToken,pid:process.pid}),{mode:0o600});
app.post('/internal/shutdown',(req,res)=>{const supplied=String(req.headers['x-lasrp-control']??'');if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??'')||supplied.length!==controlToken.length||!timingSafeEqual(Buffer.from(supplied),Buffer.from(controlToken)))return res.sendStatus(404);res.json({ok:true});setImmediate(()=>void shutdown());});
let shuttingDown=false;
async function shutdown(){if(shuttingDown)return;shuttingDown=true;try{client.destroy();let shutdownTimer:ReturnType<typeof setTimeout>|undefined;await Promise.race([stopJobs(),new Promise<void>(resolve=>{shutdownTimer=setTimeout(()=>{console.error('Background refresh exceeded the shutdown grace period; closing the service.');resolve();},15000);})]);if(shutdownTimer)clearTimeout(shutdownTimer);await store.flush();for(const socket of sockets.clients)socket.terminate();client.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.$disconnect();await closeRuntime();fs.rmSync('data/runtime-control.json',{force:true});}finally{process.exit(0);}}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);

async function connectDiscord(){
 try{
  if(!client.isReady())await client.login(process.env.DISCORD_BOT_TOKEN);
  if(shuttingDown)return;
  if(ids.guildId&&process.env.DISCORD_SYNC_ON_START!=='false'){await(await client.guilds.fetch(ids.guildId)).commands.set(allCommands.map(c=>c.toJSON()));await bootstrap();}
 }catch{
  console.error('Discord connection or registration failed. CAD remains online; retrying in 30 seconds.');
  if(!shuttingDown)setTimeout(()=>{if(!shuttingDown)void connectDiscord();},30000).unref();
 }
}
if(process.env.BOT_ENABLED!=='false'&&process.env.DISCORD_BOT_TOKEN)void connectDiscord();else console.log('Discord offline: configure DISCORD_BOT_TOKEN and config/ids.ts to enable the bot.');
