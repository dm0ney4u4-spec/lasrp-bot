import { PermissionFlagsBits, AuditLogEvent, Events, ChannelType } from 'discord.js';
import { render } from './panels.js';
import { requireAccess } from './access.js';

export function watchSecurity(service) {
  const joins=new Map(),audit=new Map();
  async function alert(guild,key,details,event='Activity threshold exceeded') {
    const g=service.store.guild(guild.id);if(!g.config.securityChannel)return;
    try {const channel=await service.restrictedChannel(guild,g,'securityChannel','management');await channel.send(render(service.template(g,key),{...service.variables(g),details,event,status:'Awaiting management review'}));service.store.change(guild.id,'system',key,{details,event});}catch(error){console.error('Security alert:',error.message);}
  }
  service.client.on(Events.GuildMemberAdd,async member=>{
    const now=Date.now(),window=(joins.get(member.guild.id)??[]).filter(x=>x>now-10000);window.push(now);joins.set(member.guild.id,window);
    if(window.length===10)await alert(member.guild,'anti_raid','At least 10 members joined within 10 seconds. Review recent joins and preserve evidence.');
  });
  const destructive=new Set([AuditLogEvent.ChannelDelete,AuditLogEvent.RoleDelete,AuditLogEvent.BotAdd,AuditLogEvent.WebhookCreate]);
  service.client.on(Events.GuildAuditLogEntryCreate,async(entry,guild)=>{
    if(!destructive.has(entry.action)||entry.executorId===service.client.user.id)return;
    const key=`${guild.id}:${entry.executorId}`,now=Date.now(),window=(audit.get(key)??[]).filter(x=>x>now-10000);window.push(now);audit.set(key,window);
    if(window.length===3)await alert(guild,'anti_nuke',`Executor: <@${entry.executorId}>\nAudit action: ${entry.action}\nAt least 3 sensitive audit events in 10 seconds.`,String(entry.action));
  });
}
export async function lockdown(service,guild,actor,enabled,reason) {
  const g=service.store.guild(guild.id);requireAccess(actor,g.config,'management');
  if(!actor.permissions.has(PermissionFlagsBits.ManageChannels))throw Error('Manage Channels permission is required.');
  if(enabled&&g.lockdown&&!g.lockdown.restored)throw Error('A lockdown is already active or requires recovery. Unlock it before starting another.');
  const channels=await guild.channels.fetch();
  if(enabled){
    g.lockdown={actor:actor.id,at:Date.now(),reason,channels:{}};service.store.save();
    for(const channel of channels.values())if(channel&&[ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(channel.type)){
      const overwrite=channel.permissionOverwrites.cache.get(guild.id);
      const previous=overwrite?.allow.has(PermissionFlagsBits.SendMessages)?true:overwrite?.deny.has(PermissionFlagsBits.SendMessages)?false:null;
      g.lockdown.channels[channel.id]={previous,pending:true};service.store.save();
      try{await channel.permissionOverwrites.edit(guild.id,{SendMessages:false},`Community lockdown: ${reason}`);g.lockdown.channels[channel.id].applied=true;g.lockdown.channels[channel.id].pending=false;service.store.save();}catch(error){g.lockdown.channels[channel.id].pending=false;g.lockdown.channels[channel.id].error=error.message;service.store.save();}
    }
  }else{
    if(!g.lockdown||g.lockdown.restored)throw Error('No lockdown to restore');
    for(const [channelId,record] of Object.entries(g.lockdown.channels))if(!record.restored&&(record.applied||record.pending)){
      const channel=channels.get(channelId);if(!channel){record.restored=true;continue;}
      await channel.permissionOverwrites.edit(guild.id,{SendMessages:record.previous},'Restore pre-lockdown permissions');record.restored=true;service.store.save();
    }
    g.lockdown.restored=Date.now();
  }
  service.store.change(guild.id,actor.id,enabled?'lockdown':'unlock',{reason});return g.lockdown;
}
