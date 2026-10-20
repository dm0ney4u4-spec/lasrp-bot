import { randomBytes,createHash } from 'node:crypto';
import type { Express } from 'express';
import { z } from 'zod';
import { db,audit } from '../../../packages/shared/src/database.js';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const base=()=>process.env.WEB_BASE_URL??'http://localhost:3000';
const configured=()=>Boolean(process.env.ROBLOX_OAUTH_CLIENT_ID&&process.env.ROBLOX_OAUTH_CLIENT_SECRET);
export function configureRoblox(app:Express,request:typeof fetch=fetch){
 app.get('/api/roblox/status',async(req,res)=>res.json({configured:configured(),account:await db.linkedRobloxAccount.findUnique({where:{userId:req.principal.id}})}));
 app.post('/api/roblox/start',async(req,res)=>{
  if(!configured())return res.status(503).json({error:'Configure Roblox OAuth client ID, secret and redirect URL first.'});
  if(req.principal.id==='DEMO_OWNER')throw Error('Use your Discord account to link a real Roblox identity.');
  const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
  await db.oAuthChallenge.deleteMany({where:{OR:[{expiresAt:{lt:new Date()}},{userId:req.principal.id}]}});
  await db.oAuthChallenge.create({data:{stateHash:hash(state),userId:req.principal.id,sessionHash:req.sessionHash,verifier,expiresAt:new Date(Date.now()+600000)}});
  const query=new URLSearchParams({client_id:process.env.ROBLOX_OAUTH_CLIENT_ID!,response_type:'code',redirect_uri:base()+'/api/roblox/callback',scope:'openid profile',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
  res.json({url:'https://apis.roblox.com/oauth/v1/authorize?'+query});
 });
 app.get('/api/roblox/callback',async(req,res)=>{
  if(!configured())throw Error('Roblox linking is not configured.');
  const state=z.string().min(32).max(100).parse(req.query.state),code=z.string().min(1).max(2048).parse(req.query.code);
  const pending=await db.oAuthChallenge.findUnique({where:{stateHash:hash(state)}});
  if(!pending||pending.userId!==req.principal.id||pending.sessionHash!==req.sessionHash||pending.expiresAt.getTime()<Date.now())throw Object.assign(Error('Expired or invalid Roblox authorization. Start linking again.'),{status:403});
  const consumed=await db.oAuthChallenge.deleteMany({where:{stateHash:pending.stateHash,userId:req.principal.id,sessionHash:req.sessionHash}});if(!consumed.count)throw Error('Roblox authorization was already used.');
  const response=await request('https://apis.roblox.com/oauth/v1/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,code_verifier:pending.verifier,redirect_uri:base()+'/api/roblox/callback',client_id:process.env.ROBLOX_OAUTH_CLIENT_ID!,client_secret:process.env.ROBLOX_OAUTH_CLIENT_SECRET!}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Roblox authorization exchange failed. Start linking again.');
  const token=z.object({access_token:z.string().min(1),token_type:z.string().refine(v=>v.toLowerCase()==='bearer')}).parse(await response.json());
  const identityResponse=await request('https://apis.roblox.com/oauth/v1/userinfo',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(10000)});
  if(!identityResponse.ok)throw Error('Roblox identity could not be verified.');
  const identity=z.object({sub:z.string().regex(/^\d+$/),preferred_username:z.string().min(1).max(100)}).parse(await identityResponse.json());
  await db.$transaction(async tx=>{
   const existing=await tx.linkedRobloxAccount.findUnique({where:{robloxId:identity.sub}});if(existing&&existing.userId!==req.principal.id)throw Error('This Roblox account is already linked to another Discord account.');
   const previous=await tx.linkedRobloxAccount.findUnique({where:{userId:req.principal.id}});
   // Account replacements require explicit unlinking, preserving an audit trail.
   if(previous&&previous.robloxId!==identity.sub)throw Error('Unlink the previous Roblox account before replacing it.');
   const next=await tx.linkedRobloxAccount.upsert({where:{userId:req.principal.id},create:{userId:req.principal.id,robloxId:identity.sub,username:identity.preferred_username,verifiedAt:new Date()},update:{username:identity.preferred_username,verifiedAt:new Date()}});
   await audit(req.principal.id,'roblox.link-oauth',next.id,previous,{robloxId:next.robloxId,username:next.username},tx);
  });res.redirect('/#Civilian%20Portal');
 });
 app.delete('/api/roblox/link',async(req,res)=>{await db.$transaction(async tx=>{const previous=await tx.linkedRobloxAccount.findUnique({where:{userId:req.principal.id}});await tx.linkedRobloxAccount.deleteMany({where:{userId:req.principal.id}});await tx.oAuthChallenge.deleteMany({where:{userId:req.principal.id}});await audit(req.principal.id,'roblox.unlink',req.principal.id,previous,{},tx);});res.json({ok:true});});
}
