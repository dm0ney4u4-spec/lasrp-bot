import type {Express} from 'express';
import type {ErlcAdapter,Snapshot} from './erlc.js';
import type {PublicErlcStatus} from '../../../packages/shared/src/public-status.js';
export function publicJoinUrl(env:NodeJS.ProcessEnv=process.env){
 const code=env.PUBLIC_ERLC_JOIN_CODE?.trim();if(code&&/^[a-zA-Z0-9_-]{1,64}$/.test(code))return 'https://erlc.gg/join/'+encodeURIComponent(code);
 try{const url=new URL(env.PUBLIC_ERLC_JOIN_URL??'');if(url.protocol==='https:'&&url.hostname==='erlc.gg'&&!url.port&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/join\/[a-zA-Z0-9_-]{1,64}$/.test(url.pathname))return url.href;}catch{}return null;
}
export function sanitizeStatus(snapshot:{data:Snapshot;at:number}|undefined,failed:boolean,configured:boolean,refresh:number,joinUrl:string|null,now=Date.now()):PublicErlcStatus{
 const data=snapshot?.data,age=snapshot?now-snapshot.at:Infinity;
 const state=!data?'unavailable':failed||age>90000||age<0?'stale':'live';
 let teams:Record<string,number>|null=null,onlineStaff:number|null=null;
 if(data?.Players&&data.Players.length===data.CurrentPlayers){
  teams={Police:0,Sheriff:0,'Fire / EMS':0,DOT:0,Civilian:0};
  for(const player of data.Players){const name=player.Team?.trim().toLowerCase();if(!name){teams=null;break;}const label=/^(police|police team)$/.test(name)?'Police':/sheriff/.test(name)?'Sheriff':/fire|ems|medical/.test(name)?'Fire / EMS':/^(dot|department of transportation)$/.test(name)?'DOT':/^(civilian|civilian team)$/.test(name)?'Civilian':/^(prisoner|criminal|inmate)$/.test(name)?name[0].toUpperCase()+name.slice(1):'Other';teams[label]=(teams[label]??0)+1;}
  if(data.Players.every(player=>typeof player.Permission==='string'&&/^(Normal|Server Administrator|Server Owner|Server Moderator|Server Helper)$/i.test(player.Permission)))onlineStaff=data.Players.filter(player=>player.Permission!.toLowerCase()!=='normal').length;
 }
 return {state,reason:!configured?'not_configured':failed||!data?'upstream_unavailable':null,updatedAt:snapshot?new Date(snapshot.at).toISOString():null,generatedAt:new Date(now).toISOString(),refreshAfterSeconds:refresh,
  server:{name:data?.Name??null,players:data?.CurrentPlayers??null,capacity:data?.MaxPlayers??null,populationPercent:data?Math.min(100,Math.round(data.CurrentPlayers/data.MaxPlayers*1000)/10):null,queue:data?.Queue===undefined?null:data.Queue.length,availability:state==='live'?'responding':'unknown',teams,onlineStaff,joinUrl},sessions:[],sessionsAvailable:false};
}
type Sessions=()=>Promise<PublicErlcStatus['sessions']>;
export function configurePublicErlc(app:Express,erlc:ErlcAdapter,options:{env?:NodeJS.ProcessEnv;sessions?:Sessions}={}){
 const env=options.env??process.env;let sessionCache:{at:number;data:PublicErlcStatus['sessions'];available:boolean}|undefined;let sessionPending:Promise<void>|undefined;
 const sessionData=async()=>{if(!options.sessions)return;if(sessionCache&&Date.now()-sessionCache.at<60000)return;if(sessionPending)return sessionPending;sessionPending=(async()=>{try{sessionCache={at:Date.now(),data:await options.sessions!(),available:true};}catch{sessionCache={at:Date.now(),data:[],available:false};}})();try{await sessionPending;}finally{sessionPending=undefined;}};
 app.get('/api/public/erlc-status',async(req,res)=>{
  res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.headers.origin&&req.headers.origin===env.PUBLIC_SITE_ORIGIN){res.set('Access-Control-Allow-Origin',req.headers.origin);res.vary('Origin');}
  let failed=false;try{await erlc.snapshot();}catch{failed=true;}
  const payload=sanitizeStatus(erlc.last,failed,erlc.configured,Math.max(45,erlc.retryAfterSeconds),publicJoinUrl(env));
  await sessionData();if(sessionCache){payload.sessions=sessionCache.data.map(session=>({startsAt:session.startsAt,status:'scheduled',announcementUrl:session.announcementUrl}));payload.sessionsAvailable=sessionCache.available;}
  res.json(payload);
 });
}
