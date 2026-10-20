import { AuditLogEvent,Events,PermissionFlagsBits,type Client,type Guild,type GuildMember,type GuildAuditLogsEntry } from 'discord.js';
import { ids } from '../../../config/ids.js';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { render } from './panels.js';
import type { CommunityService } from './service.js';
const monitored=new Set<number>([AuditLogEvent.ChannelCreate,AuditLogEvent.ChannelDelete,AuditLogEvent.RoleCreate,AuditLogEvent.RoleDelete,AuditLogEvent.RoleUpdate,AuditLogEvent.MemberBanAdd,AuditLogEvent.MemberKick,AuditLogEvent.BotAdd,AuditLogEvent.WebhookCreate,AuditLogEvent.WebhookUpdate,AuditLogEvent.GuildUpdate,AuditLogEvent.MemberRoleUpdate]);
export function protect(service:CommunityService){
 const counters=new Map<string,number[]>();
 async function incident(guild:Guild,kind:string,executor:string|undefined,target:string|undefined,count:number){
  const g=service.store.guild(guild.id),settings={...ids.settings,...g.config.security};
  const event={id:'SEC-'+Date.now().toString(36),kind,executor:executor??'unknown',target,count,at:new Date().toISOString(),mode:settings.securityMode,status:'awaiting_review',removedRoles:[] as string[]};
  g.records[event.id]=event;service.store.change(guild.id,'system','security.incident',event);await audit('system','security.incident',event.id,null,event);
  const trusted=new Set([...ids.owners,guild.ownerId,...settings.trustedUsers,service.client.user!.id]);
  if(executor&&!trusted.has(executor)&&settings.securityMode==='contain'&&ids.settings.autoContainEnabled){
   const member=await guild.members.fetch(executor).catch(()=>null),bot=await guild.members.fetchMe();
   if(member?.manageable&&bot.permissions.has(PermissionFlagsBits.ManageRoles)){
    const risky=[PermissionFlagsBits.Administrator,PermissionFlagsBits.ManageRoles,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.BanMembers,PermissionFlagsBits.KickMembers,PermissionFlagsBits.ManageGuild,PermissionFlagsBits.ManageWebhooks];
    for(const role of member.roles.cache.values())if(role.id!==guild.id&&!role.managed&&role.position<bot.roles.highest.position&&risky.some(p=>role.permissions.has(p))&&!settings.protectedRoles.includes(role.id)){
     try{await member.roles.remove(role,`Owner-opted-in containment: ${event.id}`);event.removedRoles.push(role.id);await audit('system','security.contain-role',event.id,null,{executor,role:role.id});}catch{event.status='containment_partial';}
    }
    if(event.status!=='containment_partial')event.status=event.removedRoles.length?'contained_review_required':'no_manageable_roles';
   }else event.status='containment_not_permitted';
  }
  service.store.save();await(service.store as unknown as {flush():Promise<void>}).flush();changed();
  if(settings.securityMode!=='monitor'&&g.config.securityChannel){try{const channel=await service.restrictedChannel(guild,{...g,config:{...g.config,managementRoles:[...g.config.managementRoles,ids.roles.securityTeam].filter(Boolean)}},'securityChannel','management');await channel.send(render(service.template(g,kind==='join_burst'?'anti_raid':'anti_nuke'),{community:ids.settings.community,event:kind,details:`**Executor:** ${executor?`<@${executor}>`:'Unknown — no attribution'}\n**Target:** ${target??'Not specified'}\n**Events in window:** ${count}\n**Case:** ${event.id}\n**Containment:** ${event.status}`,status:event.status,timestamp:`<t:${Math.floor(Date.now()/1000)}:f>`}));}catch{console.error('Restricted security alert delivery failed.');}}
 }
 function count(key:string,windowMs:number){const now=Date.now(),values=(counters.get(key)??[]).filter(t=>now-t<windowMs);values.push(now);counters.set(key,values);return values.length;}
 service.client.on(Events.GuildMemberAdd,async(member:GuildMember)=>{if(!ids.featureFlags.security||member.guild.id!==ids.guildId)return;const n=count('join:'+member.guild.id,ids.settings.securityWindowSeconds*1000);if(n===ids.settings.joinThreshold)await incident(member.guild,'join_burst',undefined,undefined,n);});
 service.client.on(Events.GuildAuditLogEntryCreate,async(entry:GuildAuditLogsEntry,guild:Guild)=>{
  if(!ids.featureFlags.security||guild.id!==ids.guildId||!monitored.has(entry.action)||entry.executorId===service.client.user?.id)return;
  const g=service.store.guild(guild.id),settings={...ids.settings,...g.config.security};
  if(settings.trustedUsers.includes(entry.executorId??'')||ids.owners.includes(entry.executorId??'')||entry.executorId===guild.ownerId)return;
  const n=count(`audit:${guild.id}:${entry.executorId??'unknown'}`,settings.securityWindowSeconds*1000),protectedTarget=settings.protectedChannels.includes(entry.targetId??'')||settings.protectedRoles.includes(entry.targetId??'');
  if(n===settings.auditThreshold||protectedTarget)await incident(guild,`audit_${entry.action}`,entry.executorId??undefined,entry.targetId??undefined,n);
 });
}
