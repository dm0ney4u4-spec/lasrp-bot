import { AutoModerationActionType,AutoModerationRuleEventType,AutoModerationRuleTriggerType,PermissionFlagsBits,type Guild } from 'discord.js';
import { ids } from '../../../config/ids.js';
import { audit } from '../../../packages/shared/src/database.js';
import { z } from 'zod';
export function desiredRules(){
 const settings=z.object({mentionLimit:z.number().int().min(1).max(50),blockedDomains:z.array(z.string().max(58).regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i)).max(1000),exemptRoles:z.array(z.string().regex(/^\d{17,20}$/)).max(20),exemptChannels:z.array(z.string().regex(/^\d{17,20}$/)).max(50)}).parse(ids.automod);
 const exemptRoles=[ids.roles.owner,ids.roles.communityManagement,...settings.exemptRoles].filter(Boolean);
 const common={eventType:AutoModerationRuleEventType.MessageSend,enabled:ids.featureFlags.automod,exemptRoles,exemptChannels:settings.exemptChannels,actions:[{type:AutoModerationActionType.BlockMessage,metadata:{customMessage:'LASRP community protection blocked this message. Contact support if this was a mistake.'}}]};
 return [
  {...common,name:'LASRP • Mention protection',triggerType:AutoModerationRuleTriggerType.MentionSpam,triggerMetadata:{mentionTotalLimit:settings.mentionLimit,mentionRaidProtectionEnabled:true}},
  ...(settings.blockedDomains.length?[{...common,name:'LASRP • Blocked links',triggerType:AutoModerationRuleTriggerType.Keyword,triggerMetadata:{keywordFilter:settings.blockedDomains.map(d=>`*${d}*`)}}]:[]),
 ];
}
export async function syncAutomod(guild:Guild,actorId:string){
 const bot=await guild.members.fetchMe();if(!bot.permissions.has(PermissionFlagsBits.ManageGuild))throw Error('The bot needs Manage Server to configure AutoMod.');
 const rules=await guild.autoModerationRules.fetch(),desired=desiredRules(),result=[];
 for(const spec of desired){const existing=rules.find(r=>r.creatorId===guild.client.user.id&&r.name===spec.name);const rule=existing?await existing.edit({...spec,reason:'LASRP management AutoMod synchronization'}):await guild.autoModerationRules.create({...spec,reason:'LASRP management AutoMod synchronization'});result.push({id:rule.id,name:rule.name,enabled:rule.enabled});}
 // Disable only rules owned by this bot when their configured definition is removed.
 for(const rule of rules.values())if(rule.creatorId===guild.client.user.id&&rule.name.startsWith('LASRP • ')&&!desired.some(d=>d.name===rule.name)){await rule.edit({enabled:false,reason:'LASRP rule removed from configuration'});result.push({id:rule.id,name:rule.name,enabled:false});}
 await audit(actorId,'security.automod-sync',guild.id,null,result);return result;
}
