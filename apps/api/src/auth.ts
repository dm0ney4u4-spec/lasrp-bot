import { randomBytes,createHash,createHmac,timingSafeEqual } from 'node:crypto';
import { parse,serialize } from 'cookie';
import type { Express,Request,Response,NextFunction } from 'express';
import type { Client } from 'discord.js';
import { db } from '../../../packages/shared/src/database.js';
import { groupsFor,type Principal } from '../../../packages/shared/src/permissions.js';
import { ids } from '../../../config/ids.js';

declare global {namespace Express {interface Request {principal:Principal;csrf:string;sessionHash:string}}}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const secret=()=>process.env.APP_SESSION_SECRET??'';
const base=()=>process.env.WEB_BASE_URL??'http://localhost:3000';
const secure=()=>base().startsWith('https:');
const demo=()=>process.env.DEMO_MODE==='true'&&process.env.NODE_ENV!=='production';
const cookie=(res:Response,name:string,value:string,maxAge:number)=>res.append('Set-Cookie',serialize(name,value,{httpOnly:true,secure:secure(),sameSite:'lax',path:'/',maxAge}));
async function newSession(res:Response,userId:string){
 const token=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url');
 await db.webSession.create({data:{tokenHash:hash(token),userId,csrf,expiresAt:new Date(Date.now()+12*3600000)}});
 cookie(res,'lasrp_session',token,12*3600);
}
export async function sessionUser(rawCookie:string|undefined,client:Client):Promise<{principal:Principal;csrf:string;sessionHash:string}|null>{
 const token=parse(rawCookie??'').lasrp_session;if(!token)return null;
 const record=await db.webSession.findUnique({where:{tokenHash:hash(token)},include:{user:true}});if(!record||record.expiresAt.getTime()<Date.now())return null;
 if(record.userId==='DEMO_OWNER'){if(!demo())return null;return {principal:{id:'DEMO_OWNER',name:'DEMO • Local Owner',groups:['owner','civilian'],roles:[]},csrf:record.csrf,sessionHash:record.tokenHash};}
 if(!client.isReady()||!ids.guildId)return null;
 const member=await(await client.guilds.fetch(ids.guildId)).members.fetch({user:record.userId,force:true}).catch(()=>null);if(!member)return null;
 const roles=[...member.roles.cache.keys()];const state=await db.guildState.findUnique({where:{id:ids.guildId}});const bindings=(state?.data as {config?:{rbacRoles?:Partial<typeof ids.roles>}}|null)?.config?.rbacRoles??{};return {principal:{id:member.id,name:member.displayName,roles,groups:groupsFor(member.id,roles,bindings)},csrf:record.csrf,sessionHash:record.tokenHash};
}
export function configureAuth(app:Express,client:Client){
 app.get('/auth/options',(req,res)=>res.json({demo:demo(),discord:Boolean(ids.clientId&&process.env.DISCORD_OAUTH_CLIENT_SECRET)}));
 app.get('/auth/discord',(req,res)=>{
  if(new URL(base()).host!==req.headers.host)return res.redirect(base()+'/auth/discord');
  if(!client.isReady())return res.redirect('/?login_error=bot_offline');
  if(!ids.clientId||!process.env.DISCORD_OAUTH_CLIENT_SECRET)return res.status(503).send('Configure Discord OAuth client ID and secret.');
  const state=randomBytes(24).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  const value=Buffer.from(JSON.stringify({state,verifier,expires:Date.now()+600000})).toString('base64url');
  cookie(res,'lasrp_oauth',value+'.'+createHmac('sha256',secret()).update(value).digest('base64url'),600);
  const query=new URLSearchParams({client_id:ids.clientId,response_type:'code',redirect_uri:base()+'/auth/callback',scope:'identify',state,code_challenge:hashBase64(verifier),code_challenge_method:'S256'});
  res.redirect('https://discord.com/oauth2/authorize?'+query);
 });
 app.get('/auth/callback',async(req,res,next)=>{
  try{
   if(req.query.error)return res.redirect('/?login_error=cancelled');
   const [value,signature]=String(parse(req.headers.cookie??'').lasrp_oauth??'').split('.');
   const expected=createHmac('sha256',secret()).update(value??'').digest('base64url');
   if(!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw Error('Invalid OAuth state');
   const pending=JSON.parse(Buffer.from(value,'base64url').toString());
   if(pending.state!==req.query.state||pending.expires<Date.now()||typeof req.query.code!=='string')throw Error('Expired OAuth state');
   cookie(res,'lasrp_oauth','',0);
   const response=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:ids.clientId,client_secret:process.env.DISCORD_OAUTH_CLIENT_SECRET!,grant_type:'authorization_code',code:req.query.code,redirect_uri:base()+'/auth/callback',code_verifier:pending.verifier}),signal:AbortSignal.timeout(10000)});
   if(!response.ok){const detail=await response.json().catch(()=>({})) as {error?:string};return res.redirect('/?login_error='+(['invalid_client','invalid_grant'].includes(detail.error??'')?detail.error:'discord_exchange'));}
   const token=await response.json() as {access_token:string};
   const userResponse=await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(10000)});
   if(!userResponse.ok)throw Error('Discord identity lookup failed');
   const user=await userResponse.json() as {id:string;username:string};
   const guild=await client.guilds.fetch(ids.guildId);const member=await guild.members.fetch({user:user.id,force:true}).catch(()=>null);if(!member)return res.redirect('/?login_error=membership');
   await db.user.upsert({where:{id:user.id},create:{id:user.id,displayName:user.username},update:{displayName:user.username}});
   await newSession(res,user.id);res.redirect('/');
  }catch(error){console.error('Discord sign-in failed:',error instanceof Error?error.name:'Unknown error');res.redirect('/?login_error=state');}
 });
 app.post('/auth/demo',async(req,res,next)=>{try{if(!demo()||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.ip??''))return res.sendStatus(404);if(req.headers.origin!==base())return res.sendStatus(403);await db.user.upsert({where:{id:'DEMO_OWNER'},create:{id:'DEMO_OWNER',displayName:'DEMO Owner'},update:{}});await newSession(res,'DEMO_OWNER');res.json({ok:true});}catch(error){next(error);}});
 const auth=async(req:Request,res:Response,next:NextFunction)=>{try{const session=await sessionUser(req.headers.cookie,client);if(!session)return res.status(401).json({error:'Sign in with Discord to continue.'});Object.assign(req,session);if(!['GET','HEAD'].includes(req.method)&&(req.headers.origin!==base()||req.headers['x-csrf-token']!==req.csrf))return res.status(403).json({error:'Invalid request origin or CSRF token'});next();}catch(error){next(error);}};
 app.use('/api',auth);
 app.get('/api/me',(req,res)=>res.json({user:req.principal,csrf:req.csrf,demo:demo(),features:ids.featureFlags}));
 app.post('/api/logout',async(req,res)=>{await db.webSession.delete({where:{tokenHash:req.sessionHash}});cookie(res,'lasrp_session','',0);res.json({ok:true});});
}
const hashBase64=(s:string)=>createHash('sha256').update(s).digest('base64url');
