
import { ids } from '../../../config/ids.js';
import { render } from './panels.js';
import type { CommunityService } from './service.js';
export function liveSessionPanel(g:any){const live=g.live,fresh=Boolean(live?.healthy&&Date.now()-live.synced<120000);return render({key:'ssu',title:'LASRP | LIVE SERVER STATUS',color:'blue',sections:[fresh?`**In-game players:** ${live.currentPlayers}/${live.maxPlayers}\n**Player queue:** ${live.queue?.length??0}\n**Updated:** <t:${Math.floor(live.synced/1000)}:R>`:'**In-game players:** Unavailable\n**Player queue:** Unavailable\nLive ER:LC telemetry is not connected. Counts will appear after a successful API sync.',`**Session:** ${g.sessions.at(-1)&&!g.sessions.at(-1).end?'Active':'Offline'}\nThis panel refreshes automatically every minute.`]},{community:ids.settings.community});}
export async function refreshLiveSessionPanel(service:CommunityService){const g=service.store.guild(ids.guildId),guild=await service.client.guilds.fetch(ids.guildId),channel=await guild.channels.fetch(ids.channels.sessions);if(!channel?.isTextBased()||!('send'in channel))throw Error('Sessions channel unavailable');const record=g.records.liveSessionPanel;
 if(record){try{await(await channel.messages.fetch(record.message)).edit(liveSessionPanel(g));return;}catch(error){if((error as {code?:number}).code!==10008)throw error;}}
 const message=await channel.send(liveSessionPanel(g));g.records.liveSessionPanel={message:message.id,channel:channel.id};service.store.save();await service.store.flush();}
export async function bootstrapCommunity(service:CommunityService){
 const guild=await service.client.guilds.fetch(ids.guildId),g=service.store.guild(ids.guildId);
 // Only the designated review channel is made private; unrelated channels are untouched.
 try{const review=await guild.channels.fetch(ids.channels.applicationReviews);if(!review||!('permissionOverwrites'in review))throw Error('Review channel not found');await review.permissionOverwrites.set([{id:guild.id,deny:['ViewChannel']},{id:ids.roles.applicationReviewer,allow:['ViewChannel','SendMessages','ReadMessageHistory']},{id:service.client.user!.id,allow:['ViewChannel','SendMessages','ReadMessageHistory','AttachFiles']}], 'Private LASRP application review access');console.log('Application review channel access configured.');}catch(error){console.error('Application review channel setup failed:',(error as {code?:number}).code??'Check channel permissions');}
 for(const [key,channelId]of [['applications',ids.channels.applicationsPanel],['cad',ids.channels.cadPanel],['community_rules',ids.channels.rules]] as const){
  try{const old=Object.values(g.published).find((p:any)=>p.key===key&&p.channel===channelId) as {id:string}|undefined;const result=await service.publish(ids.guildId,channelId,key,guild.ownerId,{},old?.id);await service.store.flush();console.log(`Published ${key}: ${result.message}`);}catch(error){console.error(`Panel ${key} deployment failed:`,(error as {code?:number}).code??(error instanceof Error?error.message:'Unknown error'));}
 }
 try{await refreshLiveSessionPanel(service);console.log('Live session status panel ready.');}catch{console.error('Live session status panel deployment failed. Check the sessions channel permissions.');}
}
