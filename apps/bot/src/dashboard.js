import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { seeds } from './seeds.js';
import { render, colors, actions, validateTemplate } from './panels.js';
import { requireAccess } from './access.js';
import { id } from './service.js';

export function dashboard(service, env=process.env) {
  const app=express();
  app.disable('x-powered-by');
  app.use((req,res,next)=>{res.set({'Content-Security-Policy':"default-src 'self'; img-src 'self' https://cdn.discordapp.com https://media.discordapp.net https://images.unsplash.com; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});next();});
  app.use(express.json({limit:'128kb'}));
  app.use(express.static(fileURLToPath(new URL('../../web/public/admin/',import.meta.url))));
  const attempts=new Map();
  app.use('/api',async(req,res,next)=>{
    try {
      if(!env.DASHBOARD_TOKEN||env.DASHBOARD_TOKEN.length<32||!env.DISCORD_GUILD_ID||!env.DISCORD_ADMIN_ID)throw Error('Dashboard requires a 32-character token, guild ID, and admin ID.');
      const bucket=attempts.get(req.ip)??{at:Date.now(),count:0};if(Date.now()-bucket.at>60000){bucket.at=Date.now();bucket.count=0;}bucket.count++;attempts.set(req.ip,bucket);if(bucket.count>120)return res.status(429).json({error:'Rate limit exceeded'});
      const token=Buffer.from(req.headers.authorization?.replace(/^Bearer /,'')??''),expected=Buffer.from(env.DASHBOARD_TOKEN);
      if(token.length!==expected.length||!timingSafeEqual(token,expected))return res.status(401).json({error:'Unauthorized'});
      if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw Error('Cross-origin requests are not allowed');
      const guild=await service.client.guilds.fetch(env.DISCORD_GUILD_ID),member=await guild.members.fetch(env.DISCORD_ADMIN_ID);
      req.g=service.store.guild(guild.id);req.guild=guild;req.actor=member.id;requireAccess(member,req.g.config,'management');next();
    }catch(error){res.status(403).json({error:error.message});}
  });
  app.get('/api/state',(req,res)=>res.json({guild:req.guild.id,config:req.g.config,templates:{...seeds,...req.g.templates},history:req.g.history.slice(-100),published:req.g.published,schedules:req.g.schedules,records:req.g.records,applications:req.g.applications,cases:req.g.cases,tickets:req.g.tickets,colors,actions:[...actions]}));
  app.post('/api/preview',(req,res)=>{validateTemplate(req.body.template);res.json(render(req.body.template,{...service.variables(req.g),...req.body.vars},{page:req.body.page??0}));});
  app.put('/api/templates/:key',(req,res)=>res.json(service.saveTemplate(req.guild.id,req.params.key,req.body,req.actor)));
  app.post('/api/templates/:key/restore',(req,res)=>{if(!seeds[req.params.key])throw Error('No default template');res.json(service.saveTemplate(req.guild.id,req.params.key,seeds[req.params.key],req.actor));});
  app.post('/api/publish',async(req,res)=>res.json(await service.publish(req.guild.id,req.body.channel,req.body.key,req.actor,req.body.vars??{},req.body.publication)));
  app.post('/api/schedules',(req,res)=>{
    const {channel,key,at,vars={}}=req.body;const when=Date.parse(at);
    if(!Number.isFinite(when)||when<Date.now()+60000)throw Error('Schedule at least one minute in the future');
    if(!/^[0-9]{17,20}$/.test(channel))throw Error('Invalid channel');
    const template=service.template(req.g,key);if(template.audience&&template.audience!=='public')throw Error('Cannot schedule private templates');
    if(['ssu','ssd','session_vote'].includes(key))throw Error('Stateful sessions must be started by staff with /session');
    render(template,{...service.variables(req.g),...vars});
    const schedule={id:id(),channel,key,at:when,vars,actor:req.actor};req.g.schedules[schedule.id]=schedule;service.store.change(req.guild.id,req.actor,'scheduled',schedule);res.json(schedule);
  });
  app.delete('/api/schedules/:id',(req,res)=>{delete req.g.schedules[req.params.id];service.store.change(req.guild.id,req.actor,'schedule-canceled',{id:req.params.id});res.json({ok:true});});
  app.put('/api/config',async(req,res)=>{
    const allowed=['community','serverName','joinCode','staffRoles','managementRoles','departmentRoles','selfRoles','verifiedRole','ticketCategory','sessionChannel','moderationLogChannel','applicationReviewChannel','dispatchChannel','welcomeChannel','securityChannel','weeklyMinutes','requirements','priority','maxPlayers','applications'];
    for(const [key,value] of Object.entries(req.body)) {
      if(!allowed.includes(key))throw Error(`Unknown configuration key: ${key}`);
      if(key.endsWith('Roles')&&key!=='selfRoles') {if(!Array.isArray(value)||value.length>25)throw Error('Role IDs must be an array');for(const roleId of value)if(typeof roleId!=='string'||!await req.guild.roles.fetch(roleId))throw Error('Role not found');}
      else if(key==='selfRoles'){if(!Array.isArray(value)||value.length>25)throw Error('At most 25 self-service roles');for(const entry of value){const role=await req.guild.roles.fetch(entry.id);if(!role||role.managed||role.permissions.bitfield!==0n||typeof entry.name!=='string'||entry.name.length>100)throw Error('Self-service roles must exist and have no permissions');}}
      else if(key==='applications'){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Applications must be an object');for(const [index,entry] of Object.entries(value)){if(!/^[0-6]$/.test(index)||typeof entry.open!=='boolean'||typeof entry.requirements!=='string'||entry.requirements.length>300||(entry.reviewPeriod&&entry.reviewPeriod.length>100))throw Error('Invalid application settings');}}
      else if(['weeklyMinutes','maxPlayers'].includes(key)){if(!Number.isInteger(value)||value<1||value>10080)throw Error('Invalid numeric setting');}
      else if(typeof value!=='string'||value.length>1500)throw Error('Setting must be a string of at most 1500 characters');
    }
    Object.assign(req.g.config,req.body);service.store.change(req.guild.id,req.actor,'config',req.body);res.json({ok:true});
  });
  app.post('/api/records/:id',(req,res)=>{
    const record=req.g.records[req.params.id];if(!record||!['suggestion','leave'].includes(record.kind))throw Error('Request not found');
    if(record.user===req.actor)throw Error('You cannot review your own request');
    if(!['accepted','denied'].includes(req.body.status)||typeof req.body.reason!=='string'||req.body.reason.length>1000)throw Error('Decision and reason required');
    record.status=req.body.status;record.reason=req.body.reason;record.reviewer=req.actor;service.store.change(req.guild.id,req.actor,'request-reviewed',record);res.json(record);
  });
  app.use((error,req,res,next)=>{console.error('Dashboard:',error.message);if(!res.headersSent)res.status(400).json({error:error.message});});
  return app;
}
