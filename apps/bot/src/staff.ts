import {rankIndex,rankRoles,staffRoleIds,applyRoleChange,restoreStaff}from'./staff-roles.js';
import {infractionTypes,issueDiscipline,revokeDiscipline}from'./discipline.js';
import { SlashCommandBuilder,PermissionFlagsBits,type ChatInputCommandInteraction,type GuildMember,type Role } from 'discord.js';
import { randomUUID } from 'node:crypto';
import { ids } from '../../../config/ids.js';
import { audit,changed } from '../../../packages/shared/src/database.js';
import { allowed,type Principal } from '../../../packages/shared/src/permissions.js';
import { render,notice } from './panels.js';
import { editReply } from './replies.js';
import type { CommunityService } from './service.js';
const command=new SlashCommandBuilder().setName('staff').setDescription('LASRP staff management and records').setDMPermission(false);
const rank=(name:string)=>command.addSubcommand(c=>c.setName(name).setDescription(`${name==='promote'?'Promote':'Demote'} a staff member`).addUserOption(o=>o.setName('member').setDescription('Staff member').setRequired(true)).addRoleOption(o=>o.setName('rank').setDescription('Configured new rank role').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Private management reason').setRequired(true).setMaxLength(1000)));
rank('promote');rank('demote');
for(const action of ['suspend','investigate','reinstate'])command.addSubcommand(c=>c.setName(action).setDescription(action==='suspend'?'Suspend staff roles':action==='investigate'?'Place staff under investigation':'Restore roles from a suspension or investigation').addUserOption(o=>o.setName('member').setDescription('Affected staff member').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Private management reason').setRequired(true).setMinLength(5).setMaxLength(1000)));
command.addSubcommand(c=>c.setName('profile').setDescription('Staff profile').addUserOption(o=>o.setName('member').setDescription('Staff member, defaults to you'))).addSubcommand(c=>c.setName('roster').setDescription('Configured staff roster'))
.addSubcommand(c=>c.setName('note').setDescription('Add confidential management note').addUserOption(o=>o.setName('member').setDescription('Staff member').setRequired(true)).addStringOption(o=>o.setName('text').setDescription('Private note').setRequired(true).setMaxLength(1000)))
.addSubcommand(c=>c.setName('training').setDescription('Update training and supervisor').addUserOption(o=>o.setName('member').setDescription('Staff member').setRequired(true)).addStringOption(o=>o.setName('status').setDescription('Training status').setRequired(true).setMaxLength(200)).addUserOption(o=>o.setName('supervisor').setDescription('Supervisor').setRequired(true)))
.addSubcommand(c=>c.setName('activity').setDescription('Duty time and moderation activity').addUserOption(o=>o.setName('member').setDescription('Staff member')))
.addSubcommandGroup(group=>group.setName('infraction').setDescription('Internal disciplinary cases')
 .addSubcommand(c=>c.setName('issue').setDescription('Issue an internal staff infraction').addUserOption(o=>o.setName('member').setDescription('Affected staff member').setRequired(true)).addStringOption(o=>o.setName('type').setDescription('Infraction category').setRequired(true).addChoices(...infractionTypes.map(value=>({name:value.replaceAll('_',' '),value})))).addStringOption(o=>o.setName('reason').setDescription('Specific policy and conduct').setRequired(true).setMaxLength(1000)).addStringOption(o=>o.setName('evidence').setDescription('Private evidence references').setRequired(true).setMaxLength(600)))
 .addSubcommand(c=>c.setName('history').setDescription('View internal infractions').addUserOption(o=>o.setName('member').setDescription('Member, defaults to yourself')))
 .addSubcommand(c=>c.setName('remove').setDescription('Revoke a staff infraction').addStringOption(o=>o.setName('id').setDescription('Case ID').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Revocation reason').setRequired(true).setMaxLength(1000))));
export const staffCommand=command;
const staffLocks=new Set<string>();
export async function staffAction(service:CommunityService,i:ChatInputCommandInteraction,p:Principal){const caseId=i.options.getString('id'),caseMember=caseId?service.store.guild(ids.guildId).cases[caseId]?.memberId:undefined;const key=i.guildId+':'+(i.options.getUser('member')?.id??caseMember??i.user.id);if(staffLocks.has(key))throw Error('Another staff update is in progress for this member.');staffLocks.add(key);try{await staffActionImpl(service,i,p);}finally{staffLocks.delete(key);}}
async function staffActionImpl(service:CommunityService,i:ChatInputCommandInteraction,p:Principal){
 const g=service.store.guild(ids.guildId),action=i.options.getSubcommand(),group=i.options.getSubcommandGroup(false),user=i.options.getUser('member')??i.user;
 const caseId=action==='remove'?i.options.getString('id',true):null,caseRecord=caseId?g.cases[caseId]:null;const targetId=caseRecord?.memberId??user.id;
 const staffAuthority=p.roles.some(role=>ids.commandPolicy.staffActions.includes(role));
 const manager=allowed(p,'management')||(staffAuthority&&(['promote','demote','suspend','investigate','reinstate'].includes(action)||group==='infraction'));
 if(['profile','activity','history'].includes(action)){
  if(user.id!==i.user.id&&!manager)throw Error('Management access required to view another staff profile');
  const profile=g.records[`profile:${user.id}`]??{},cases=Object.values(g.cases).filter((c:any)=>c.kind==='staff_infraction'&&c.memberId===user.id) as any[],active=cases.filter(c=>c.status==='active'&&(!c.expires||c.expires>Date.now()));
  if(action==='history'){await i.reply(notice('Internal Infraction History',cases.slice(-12).map(c=>`**${c.id}:** ${c.type} — ${c.status}\n**Reason:** ${c.reason}\n**Points:** ${c.points}`).join('\n')||'No internal infractions recorded.'));return;}
  const shifts=(Object.values(g.shifts) as any[]).filter(s=>s.user===user.id),minutes=Math.floor(shifts.reduce((sum,s)=>sum+((s.end??Date.now())-s.start),0)/60000);
  await i.reply(notice('LASRP Staff Profile',`**Member:** <@${user.id}>\n**Training:** ${profile.training??'Not assessed'}\n**Supervisor:** ${profile.supervisor??'Not assigned'}\n**Status:** ${profile.status??'active'}\n**Active internal points:** ${active.reduce((sum,c)=>sum+c.points,0)}\n**Recorded duty minutes:** ${minutes}\n${manager?`**Management notes:** ${profile.notes?.length??0}`:''}`));return;
 }
 if(action==='roster'){if(!allowed(p,'moderator'))throw Error('Staff access required');await i.deferReply({flags:64});const members=await i.guild!.members.fetch();const staff=members.filter(m=>g.config.staffRoles.some((r:string)=>m.roles.cache.has(r))).first(25);await editReply(i,notice('LASRP Staff Roster',staff.map(m=>`**${m.displayName}:** ${m.roles.highest.name}`).join('\n')||'No members have configured staff roles.'));return;}
 if((['promote','demote','suspend','investigate','reinstate'].includes(action)||group==='infraction')&&!staffAuthority&&!p.groups.includes('owner'))throw Error('Configured staff promotion / infraction role required');
 if(!manager)throw Error('Management access required');
 if(action==='remove'&&(!caseRecord||caseRecord.kind!=='staff_infraction'))throw Error('Internal case not found');
 if(targetId===i.user.id||ids.owners.includes(targetId)||targetId===i.guild!.ownerId)throw Error('You cannot alter your own or a protected owner record');
 const target=await i.guild!.members.fetch({user:targetId,force:true}),actor=await i.guild!.members.fetch(i.user.id),bot=await i.guild!.members.fetchMe();
 if(ids.roles.owner&&target.roles.cache.has(ids.roles.owner))throw Error('Configured owner-role members are protected.');
 if(!ids.owners.includes(i.user.id)&&target.roles.highest.position>=actor.roles.highest.position)throw Error('The affected member is at or above your rank');
 await i.deferReply({flags:64});
 const profile=g.records[`profile:${targetId}`]??={};
 if(action==='remove'){await revokeDiscipline(service,target,actor,bot,caseRecord,i.options.getString('reason',true));await audit(i.user.id,'staff.infraction-revoked',caseRecord.id,null,{reason:caseRecord.revocationReason});try{await target.user.send(notice('LASRP Staff Infraction Revoked',`**Case:** ${caseRecord.id}\n**Reason:** ${caseRecord.revocationReason}`,'blue',false));}catch{await audit(i.user.id,'staff.infraction-dm-failed',caseRecord.id,null,{});}}
 else if(['suspend','investigate','reinstate'].includes(action)){
  const reason=i.options.getString('reason',true);
  if(action==='reinstate'){const restriction=await restoreStaff(service,target,actor,bot,reason);for(const c of Object.values(g.cases) as any[])if(c.restrictionId===restriction.id&&c.status==='active'){c.status='revoked';c.revocationReason=reason;}await save(service,i.user.id,'staff.restriction-revoked',{member:target.id,restriction:restriction.id,reason});}
  else{await issueDiscipline(service,target,actor,bot,action==='suspend'?'suspended':'investigation',reason,'Staff status command');await save(service,i.user.id,'staff.restriction',{member:target.id,status:profile.status,reason});}
  try{await target.user.send(notice('LASRP Staff Status Updated',`**Status:** ${profile.status}\n**Reason:** ${reason}`,'blue',false));}catch{await audit(i.user.id,'staff.status-dm-failed',target.id,null,{});}
 }
 else if(action==='note'){profile.notes??=[];profile.notes.push({text:i.options.getString('text',true),actor:i.user.id,at:Date.now()});await save(service,i.user.id,'staff.private-note',{member:user.id,note:profile.notes.at(-1)});}
 else if(action==='training'){profile.training=i.options.getString('status',true);profile.supervisor=`<@${i.options.getUser('supervisor',true).id}>`;await save(service,i.user.id,'staff.training',{member:user.id,training:profile.training,supervisor:profile.supervisor});}
 else if(group==='infraction'&&action==='issue'){
  const type=i.options.getString('type',true),reason=i.options.getString('reason',true),evidence=i.options.getString('evidence',true);
  const log=await service.restrictedChannel(i.guild!,{...g,config:{...g.config,managementRoles:[...g.config.managementRoles,...ids.staffLogReaderRoles],staffLogChannel:g.config.infractionChannel||g.config.staffLogChannel}},'staffLogChannel','management');
  const record=await issueDiscipline(service,target,actor,bot,type,reason,evidence);await audit(i.user.id,'staff.infraction',record.id,null,{type,outcome:record.outcome});const payload=render(service.template(g,'staff_infraction'),{...record.vars,status:record.outcome});try{await log.send(payload);}catch{await audit(i.user.id,'staff.infraction-log-failed',record.id,null,{});}try{await target.user.send(payload);}catch{await audit(i.user.id,'staff.infraction-dm-failed',record.id,null,{});}
 }
 else if(action==='promote'||action==='demote'){
  const ranks=ids.staffRankRoles,newRank=i.options.getRole('rank',true) as Role;
  if(!ranks.includes(newRank.id)){const names=ranks.map(id=>i.guild!.roles.cache.get(id)?.name).filter(Boolean);throw Error(`Select a configured rank. Available ranks: ${names.join(', ')}. Team badges are automatic.`);}
  if(profile.restriction&&!profile.restriction.completedAt||['suspended','investigation','terminated'].some(key=>target.roles.cache.has((ids.disciplineRoles as any)[key])))throw Error('Resolve the active staff restriction before changing ranks.');
  const oldRank=target.roles.cache.filter(r=>ranks.includes(r.id)).sort((a,b)=>rankIndex(b.id)-rankIndex(a.id)).first();
  if(action==='demote'&&!oldRank)throw Error('The member has no staff rank to demote.');if(oldRank&&(action==='promote'?rankIndex(newRank.id)<=rankIndex(oldRank.id):rankIndex(newRank.id)>=rankIndex(oldRank.id)))throw Error('Select a higher rank for promotion or a lower rank for demotion.');
  const log=await service.restrictedChannel(i.guild!,{...g,config:{...g.config,managementRoles:[...g.config.managementRoles,...ids.staffLogReaderRoles]}},'staffLogChannel','management'),reason=i.options.getString('reason',true);
  const staffIds=staffRoleIds(g),desired=new Set<string>([...target.roles.cache.keys()].filter(id=>!staffIds.has(id)));for(const id of rankRoles(newRank.id))desired.add(id);await applyRoleChange(service,target,actor,bot,desired,reason,action);
  const change={id:'RANK-'+randomUUID().slice(0,8),kind:action,member:user.id,oldRank:oldRank?.id??null,newRank:newRank.id,actor:i.user.id,reason,at:Date.now()};g.records[change.id]=change;await save(service,i.user.id,'staff.rank-change',change);
  await log.send(notice('Restricted Staff Rank Change',`**Member:** <@${user.id}>\n**Previous:** ${oldRank?.name??'Not previously ranked'}\n**New:** ${newRank.name}\n**Manager:** <@${i.user.id}>\n**Private reason:** ${reason}`,'blue',false));
  const vars={...service.variables(g,actor),member:`<@${user.id}>`,old_rank:oldRank?.name??'Not previously ranked',new_rank:newRank.name,manager:`<@${i.user.id}>`};
  if(g.config.promotionChannel){const channel=await i.guild!.channels.fetch(g.config.promotionChannel);if(channel?.isTextBased()&&'send'in channel)await channel.send(render(service.template(g,action==='promote'?'promotion':'demotion'),vars));}
  try{await user.send(notice('LASRP Staff Rank Updated',`**Previous:** ${oldRank?.name??'Not previously ranked'}\n**New:** ${newRank.name}\n${action==='promote'?'Thank you for your service. Contact your supervisor for your next responsibilities.':'Your staff assignment has changed. Contact management privately with questions.'}`,'blue',false));}catch{await audit(i.user.id,'staff.rank-dm-failed',change.id,null,{});}
 }
 changed();await editReply(i,notice('Staff Record Saved','The authorized staff change and its audit record have been saved.'));
}
async function save(service:CommunityService,actor:string,action:string,value:unknown){service.store.change(ids.guildId,actor,action,value);await(service.store as unknown as {flush():Promise<void>}).flush();await audit(actor,action,(value as {id?:string}).id??ids.guildId,null,value);}
