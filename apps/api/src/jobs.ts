import { refreshLiveSessionPanel } from '../../bot/src/community.js';
import { randomInt } from 'node:crypto';
import type { CommunityService } from '../../bot/src/service.js';
import type { Applications } from '../../bot/src/applications.js';
import type { DatabaseStore } from '../../../packages/shared/src/store.js';
import type { ErlcAdapter } from './erlc.js';
import { db,changed } from '../../../packages/shared/src/database.js';
import { ids } from '../../../config/ids.js';
import { render } from '../../bot/src/panels.js';
import { expireLegal } from './legal.js';
import { populationObservation,type PopulationState } from '../../../packages/shared/src/population.js';
import { notification } from './cad-workflows.js';
import { audit } from '../../../packages/shared/src/database.js';

export function startJobs(service:CommunityService,applications:Applications,erlc:ErlcAdapter,store:DatabaseStore){
 let running=false;
 const tick=async()=>{
  if(running)return;running=true;
  try{
   await db.oAuthChallenge.deleteMany({where:{expiresAt:{lt:new Date()}}});
   await expireLegal();
   await applications.expire();await applications.recover();await db.webSession.deleteMany({where:{expiresAt:{lt:new Date()}}});await db.ticketTranscript.deleteMany({where:{expiresAt:{lt:new Date()}}});
   if(!service.client.isReady()||!ids.guildId)return;
   const g=store.guild(ids.guildId),guild=await service.client.guilds.fetch(ids.guildId);
   const interrupted=await db.session.findMany({where:{guildId:ids.guildId,OR:[{status:'starting',startedAt:{lt:new Date(Date.now()-300000)}},{status:'ending',endedAt:{lt:new Date(Date.now()-300000)}}]}});
   for(const s of interrupted){await db.session.update({where:{id:s.id},data:{status:s.status==='ending'?'ended':'failed',activeKey:null,endedAt:new Date(),reason:s.reason??'Recovered interrupted operation; review the session channel'}});const compat=g.sessions.find((x:any)=>x.id===s.id);if(compat&&!compat.end){compat.end=Date.now();compat.reason='Recovered interrupted session operation';}store.save();}
   if(process.env.ERLC_SERVER_API_KEY){try{
    const snapshot=await erlc.snapshot(),s=g.sessions.at(-1);g.live={players:snapshot.data.Players??[],maxPlayers:snapshot.data.MaxPlayers,currentPlayers:snapshot.data.CurrentPlayers,synced:snapshot.at,healthy:true,queue:snapshot.data.Queue??[],vehicles:snapshot.data.Vehicles??[],source:'ERLC_API'};
    if(ids.sessionAlerts.enabled&&s&&!s.end){
     const key='population:'+s.id,observation=populationObservation(g.records[key] as PopulationState|undefined,snapshot.data.CurrentPlayers,ids.sessionAlerts.lowPopulationThreshold,ids.sessionAlerts.lowPopulationMinutes,snapshot.at);
     if(observation.state)g.records[key]=observation.state;
     if(observation.alert){const id='LOWPOP-'+s.id+'-'+observation.state!.since;await db.$transaction(async tx=>{const created=await tx.notification.createMany({data:[{id,userId:s.host,kind:'session_low_population',title:'Session population is low',body:`${snapshot.data.CurrentPlayers} API-reported players; below ${ids.sessionAlerts.lowPopulationThreshold} for ${ids.sessionAlerts.lowPopulationMinutes} minutes. Review whether to continue or announce.`,href:'#Sessions'}],skipDuplicates:true});if(created.count)await audit('system','session.low-population',s.id,null,{players:snapshot.data.CurrentPlayers,threshold:ids.sessionAlerts.lowPopulationThreshold},tx);});}
    }
    if(s&&!s.end){s.peak=Math.max(s.peak,snapshot.data.CurrentPlayers);s.participants=[...new Set([...s.participants,...(snapshot.data.Players??[]).map(p=>p.Player)])];const active=await db.session.findUnique({where:{activeKey:ids.guildId}});if(active){await db.session.update({where:{id:active.id},data:{peakPlayers:s.peak}});for(const player of snapshot.data.Players??[])await db.sessionAttendance.upsert({where:{sessionId_player:{sessionId:active.id,player:player.Player}},create:{sessionId:active.id,player:player.Player},update:{lastSeen:new Date()}});}}
    for(const call of snapshot.data.EmergencyCalls??[])await db.incident.upsert({where:{id:`ERLC-${call.CallNumber}-${call.StartedAt}`},create:{id:`ERLC-${call.CallNumber}-${call.StartedAt}`,source:'ERLC_API',callerId:String(call.Caller),location:call.PositionDescriptor||'Location not supplied',narrative:call.Description||'No narrative supplied by API',type:'ER:LC Emergency Call',priority:3,agency:/fire/i.test(call.Team??'')?'fire':/sheriff/i.test(call.Team??'')?'sheriff':'police'},update:{}});
    store.save();changed();
   }catch(error){if(g.live)g.live.healthy=false;console.error('ER:LC sync:',error instanceof Error?error.message:'unavailable');}}
   try{await refreshLiveSessionPanel(service);}catch{console.error('Live session status panel refresh failed.');}
   const session=g.sessions.at(-1);if(session&&!session.end&&session.message){try{const channel=await guild.channels.fetch(session.channel);if(channel?.isTextBased()&&'messages'in channel)await(await channel.messages.fetch(session.message)).edit(render(service.template(g,'ssu'),service.variables(g)));}catch{console.error('Session panel refresh failed.');}}
   const reminders=await db.scheduledSession.findMany({where:{guildId:ids.guildId,status:'scheduled',reminderSent:false,startsAt:{lte:new Date(Date.now()+15*60000)}}});
   for(const reminder of reminders){const channel=await guild.channels.fetch(g.config.sessionChannel);if(channel?.isTextBased()&&'send'in channel){await channel.send(render({key:'session_schedule',title:'LASRP | UPCOMING SESSION',color:'blue',sections:[`**Host:** <@${reminder.hostId}>\n**Scheduled:** <t:${Math.floor(reminder.startsAt.getTime()/1000)}:f>\n${reminder.note}`,'Staff will confirm the session is live with an official SSU announcement.']},{community:ids.settings.community}));await db.scheduledSession.update({where:{id:reminder.id},data:{reminderSent:true}});}}
   for(const vote of Object.values(g.votes) as any[])if(vote.end<Date.now()&&!vote.closed){await service.updateVote(guild,g,vote);vote.closed=true;store.save();}
   for(const a of Object.values(g.records) as any[])if(['poll','giveaway'].includes(a.kind)){
    if(!a.closed&&a.end<=Date.now()){a.closed=true;if(a.kind==='giveaway'){const entries=Object.keys(a.entries);a.winners=entries.length?[entries[randomInt(entries.length)]]:[];}store.save();}
    if(a.closed&&!a.finalPosted){try{const channel=await guild.channels.fetch(a.channel);if(channel?.isTextBased()&&'messages'in channel)await(await channel.messages.fetch(a.message)).edit(service.activityPanel(g,a));a.finalPosted=true;store.save();}catch{console.error('Activity result refresh failed.');}}
   }
   for(const record of Object.values(g.cases) as any[])if(record.kind==='tempban'&&record.status==='active'&&record.expires<=Date.now()){try{await guild.bans.remove(record.memberId,'Temporary ban expired');record.status='expired';store.change(ids.guildId,'system','temporary-ban-expired',{caseId:record.id});}catch{console.error('Temporary ban expiry requires review.');}}
   for(const schedule of Object.values(g.schedules) as any[])if(!schedule.sent&&!schedule.failed&&schedule.at<=Date.now()){
    if(schedule.inFlight){schedule.failed='Delivery uncertain after restart; review channel before retrying';store.save();continue;}
    schedule.inFlight=true;store.save();await store.flush();try{await service.publish(ids.guildId,schedule.channel,schedule.key,schedule.actor,schedule.vars);schedule.sent=Date.now();}catch(error){schedule.failed=error instanceof Error?error.message:'Delivery failed';}finally{schedule.inFlight=false;store.save();}
   }
   await store.flush();
  }catch(error){const detail=error as {code?:string;meta?:{modelName?:string}};console.error('Background maintenance:',error instanceof Error?error.name:'Error',detail.code??'',detail.meta?.modelName??'');}finally{running=false;}
 };
 let current:Promise<void>=Promise.resolve();const run=()=>{if(!running)current=tick();};
 const timer=setInterval(run,60000);timer.unref();run();
 return async()=>{clearInterval(timer);await current;};
}
