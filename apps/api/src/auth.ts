import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {parse,serialize} from 'cookie';
import type {Express,Request,Response,NextFunction} from 'express';
import type {Client} from 'discord.js';
import {db} from '../../../packages/shared/src/database.js';
import {groupsFor,type Principal} from '../../../packages/shared/src/permissions.js';
import {ids} from '../../../config/ids.js';
export interface DiscordProfile {username:string;avatarUrl:string|null;roles:{id:string;name:string}[]}
declare global {namespace Express {interface Request {principal:Principal;csrf:string;sessionHash:string;discordProfile?:DiscordProfile}}}
type AuthDatabase=Pick<typeof db,'webSession'|'user'|'guildState'>;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const secret=()=>process.env.APP_SESSION_SECRET??'';
export function authOrigins(){
 const read=(value:string)=>{const u=new URL(value);if(u.username||u.password||u.pathname!=='/'||u.search||u.hash||!['http:','https:'].includes(u.protocol))throw Error('Authentication URLs must be origins without paths or credentials');if(u.protocol!=='https:'&&(process.env.NODE_ENV==='production'||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw Error('Authentication requires HTTPS outside local development');return u;};
 const backend=read(process.env.WEB_BASE_URL??'http://localhost:3000'),website=read(process.env.WEBSITE_BASE_URL??backend.origin);
 if(backend.hostname!==website.hostname)throw Error('Website and backend must share a canonical hostname for secure host-only sessions');
 if(process.env.NODE_ENV==='production'&&backend.origin!==website.origin)throw Error('Production member login requires a same-origin /api and /auth gateway');
 return {backend:backend.origin,website:website.origin};
}
const demo=()=>process.env.DEMO_MODE==='true'&&process.env.NODE_ENV!=='production';
const cookie=(res:Response,name:string,value:string,maxAge:number)=>res.append('Set-Cookie',serialize(name,value,{httpOnly:true,secure:authOrigins().backend.startsWith('https:'),sameSite:'lax',path:'/',maxAge}));
async function newSession(res:Response,userId:string,database:AuthDatabase){const token=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url');await database.webSession.create({data:{tokenHash:hash(token),userId,csrf,expiresAt:new Date(Date.now()+12*3600000)}});cookie(res,'lasrp_session',token,12*3600);}
export async function sessionUser(rawCookie:string|undefined,client:Client,database:AuthDatabase=db):Promise<{principal:Principal;csrf:string;sessionHash:string;discordProfile?:DiscordProfile}|null>{
 const token=parse(rawCookie??'').lasrp_session;if(!token)return null;
 const record=await database.webSession.findUnique({where:{tokenHash:hash(token)},include:{user:true}});if(!record||record.expiresAt.getTime()<Date.now())return null;
 if(record.userId==='DEMO_OWNER'){if(!demo())return null;return {principal:{id:'DEMO_OWNER',name:'DEMO • Local Owner',groups:['owner','civilian'],roles:[]},csrf:record.csrf,sessionHash:record.tokenHash};}
 if(!client.isReady()||!ids.guildId)return null;
 const member=await(await client.guilds.fetch(ids.guildId)).members.fetch({user:record.userId,force:true}).catch(()=>null);if(!member)return null;
 const roles=[...member.roles.cache.keys()],state=await database.guildState.findUnique({where:{id:ids.guildId}}),bindings=(state?.data as {config?:{rbacRoles?:Partial<typeof ids.roles>}}|null)?.config?.rbacRoles??{};
 return {principal:{id:member.id,name:member.displayName,roles,groups:groupsFor(member.id,roles,bindings)},csrf:record.csrf,sessionHash:record.tokenHash,discordProfile:{username:member.user.username,avatarUrl:member.displayAvatarURL({extension:'png',size:128}),roles:[...member.roles.cache.values()].filter(role=>role.id!==ids.guildId).sort((a,b)=>b.position-a.position).map(role=>({id:role.id,name:role.name}))}};
}
export function configureAuth(app:Express,client:Client,dependencies:{database?:AuthDatabase;request?:typeof fetch}={}){
 const database=dependencies.database??db,request=dependencies.request??fetch,origins=authOrigins();
 const fail=(res:Response,error:string,website:boolean)=>res.redirect(website?origins.website+'/login?login_error='+error:'/?login_error='+error);
 app.use('/auth',(_req,res,next)=>{res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});next();});
 app.get('/auth/options',(_req,res)=>res.json({demo:demo(),discord:Boolean(client.isReady()&&ids.clientId&&process.env.DISCORD_OAUTH_CLIENT_SECRET),loginUrl:origins.backend+'/auth/discord?website=1',websiteOrigin:origins.website}));
 app.get('/auth/discord',(req,res)=>{
  const website=req.query.website==='1';
  if(new URL(origins.backend).host!==req.headers.host)return res.redirect(origins.backend+'/auth/discord'+(website?'?website=1':''));
  if(!client.isReady())return fail(res,'bot_offline',website);
  if(!ids.clientId||!process.env.DISCORD_OAUTH_CLIENT_SECRET)return fail(res,'not_configured',website);
  const state=randomBytes(24).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  const value=Buffer.from(JSON.stringify({state,verifier,expires:Date.now()+600000,website})).toString('base64url');
  cookie(res,'lasrp_oauth',value+'.'+createHmac('sha256',secret()).update(value).digest('base64url'),600);
  res.redirect('https://discord.com/oauth2/authorize?'+new URLSearchParams({client_id:ids.clientId,response_type:'code',redirect_uri:origins.backend+'/auth/callback',scope:'identify',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}));
 });
 app.get('/auth/callback',async(req,res)=>{
  let website=false;
  try{
   if(new URL(origins.backend).host!==req.headers.host)return res.redirect(origins.backend+req.originalUrl);
   const [value,signature]=String(parse(req.headers.cookie??'').lasrp_oauth??'').split('.');
   const expected=createHmac('sha256',secret()).update(value??'').digest('base64url');
   if(!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw Error('Invalid OAuth state');
   const pending=JSON.parse(Buffer.from(value,'base64url').toString());
   if(pending.state!==req.query.state||typeof pending.verifier!=='string'||typeof pending.expires!=='number'||pending.expires<Date.now())throw Error('Expired OAuth state');
   website=pending.website===true;cookie(res,'lasrp_oauth','',0);
   if(req.query.error)return fail(res,'cancelled',website);
   if(typeof req.query.code!=='string')throw Error('Missing OAuth code');
   const response=await request('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:ids.clientId,client_secret:process.env.DISCORD_OAUTH_CLIENT_SECRET!,grant_type:'authorization_code',code:req.query.code,redirect_uri:origins.backend+'/auth/callback',code_verifier:pending.verifier}),signal:AbortSignal.timeout(10000)});
   if(!response.ok){const detail=await response.json().catch(()=>({})) as {error?:string};return fail(res,['invalid_client','invalid_grant'].includes(detail.error??'')?detail.error!:'discord_exchange',website);}
   const token=await response.json() as {access_token:string};if(typeof token.access_token!=='string')throw Error('Invalid token response');
   const userResponse=await request('https://discord.com/api/v10/users/@me',{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(10000)});
   if(!userResponse.ok)throw Error('Discord identity lookup failed');
   const user=await userResponse.json() as {id:string;username:string};if(!/^\d{17,20}$/.test(user.id)||typeof user.username!=='string')throw Error('Invalid Discord identity');
   const member=await(await client.guilds.fetch(ids.guildId)).members.fetch({user:user.id,force:true}).catch(()=>null);if(!member)return fail(res,'membership',website);
   await database.user.upsert({where:{id:user.id},create:{id:user.id,displayName:user.username},update:{displayName:user.username}});
   await newSession(res,user.id,database);res.redirect(website?origins.website+'/member':'/');
  }catch(error){cookie(res,'lasrp_oauth','',0);console.error('Discord sign-in failed:',error instanceof Error?error.name:'Unknown error');fail(res,'state',website);}
 });
 app.post('/auth/demo',async(req,res,next)=>{try{if(!demo()||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.ip??''))return res.sendStatus(404);if(req.headers.origin!==origins.backend)return res.sendStatus(403);await database.user.upsert({where:{id:'DEMO_OWNER'},create:{id:'DEMO_OWNER',displayName:'DEMO Owner'},update:{}});await newSession(res,'DEMO_OWNER',database);res.json({ok:true});}catch(error){next(error);}});
 const auth=async(req:Request,res:Response,next:NextFunction)=>{try{res.set('Cache-Control','no-store');const session=await sessionUser(req.headers.cookie,client,database);if(!session)return res.status(401).json({error:'Sign in with Discord to continue.'});Object.assign(req,session);if(!['GET','HEAD'].includes(req.method)&&(![origins.backend,origins.website].includes(String(req.headers.origin))||req.headers['x-csrf-token']!==req.csrf))return res.status(403).json({error:'Invalid request origin or CSRF token'});next();}catch(error){next(error);}};
 app.use('/api',auth);
 app.get('/api/me',(req,res)=>res.json({user:req.principal,profile:req.discordProfile??null,csrf:req.csrf,demo:demo(),features:ids.featureFlags}));
 app.post('/api/logout',async(req,res)=>{await database.webSession.delete({where:{tokenHash:req.sessionHash}});cookie(res,'lasrp_session','',0);res.json({ok:true});});
}
