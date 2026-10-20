import { ids } from '../../../config/ids.js';
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { seeds } from './seeds.js';
import { id } from './service.js';
import { render, notice } from './panels.js';
import { requireAccess, canViewCase } from './access.js';
import { lockdown } from './security.js';
import { editReply } from './replies.js';

const str=(c,name,description,required=true)=>c.addStringOption(o=>o.setName(name).setDescription(description).setRequired(required));
const cmd=(name,description)=>new SlashCommandBuilder().setName(name).setDescription(description).setDMPermission(false);
export const commands = [
  cmd('security','Lock or restore public text channels').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).addStringOption(o=>o.setName('action').setDescription('Action').setRequired(true).addChoices({name:'Lockdown',value:'lockdown'},{name:'Unlock',value:'unlock'})).addStringOption(o=>o.setName('reason').setDescription('Reason for the change').setRequired(true).setMaxLength(500)),
  cmd('activity','Start a poll or giveaway').addStringOption(o=>o.setName('kind').setDescription('Activity type').setRequired(true).addChoices({name:'Poll',value:'poll'},{name:'Giveaway',value:'giveaway'})).addStringOption(o=>o.setName('title').setDescription('Question or prize and eligibility').setRequired(true).setMaxLength(500)).addIntegerOption(o=>o.setName('minutes').setDescription('Minutes until closing').setRequired(true).setMinValue(1).setMaxValue(10080)).addStringOption(o=>o.setName('options').setDescription('Poll choices separated by | (2 to 5)').setMaxLength(400)),
  str(cmd('panel','Read a community panel'),'name','Panel key, e.g. community_rules or support'),
  cmd('setup','Configure community settings').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption(o=>o.setName('key').setDescription('Configuration key').setRequired(true).addChoices(...['community','serverName','joinCode','staffRoles','managementRoles','departmentRoles','verifiedRole','ticketCategory','sessionChannel','moderationLogChannel','applicationReviewChannel','dispatchChannel','welcomeChannel','priority','weeklyMinutes','requirements','maxPlayers'].map(name=>({name,value:name})))).addStringOption(o=>o.setName('value').setDescription('Value; role lists are comma-separated IDs').setRequired(true)),
  str(str(cmd('session','Manage an official session').addStringOption(o=>o.setName('action').setDescription('Session action').setRequired(true).addChoices(...['start','stop','vote'].map(name=>({name,value:name})))),'reason','Shutdown reason',false),'settings','Vote threshold,minutes e.g. 10,15',false),
  cmd('moderate','Apply and record a moderation action').addStringOption(o=>o.setName('action').setDescription('Action').setRequired(true).addChoices(...['warning','kick','ban','tempban','timeout'].map(name=>({name,value:name})))).addUserOption(o=>o.setName('member').setDescription('Affected member').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Specific conduct and evidence').setRequired(true).setMaxLength(1000)).addIntegerOption(o=>o.setName('minutes').setDescription('Timeout or temporary-ban duration').setMinValue(1).setMaxValue(40320)),
  cmd('case','Review, revoke, or resolve an appeal').addStringOption(o=>o.setName('action').setDescription('Action').setRequired(true).addChoices(...['view','revoke','accept-appeal','deny-appeal'].map(name=>({name,value:name})))).addStringOption(o=>o.setName('id').setDescription('Case ID').setRequired(true)).addStringOption(o=>o.setName('reason').setDescription('Decision reason').setMaxLength(1000)),
  cmd('staff','Manage staff profiles and rank announcements').addUserOption(o=>o.setName('member').setDescription('Staff member').setRequired(true)).addStringOption(o=>o.setName('action').setDescription('Action').setRequired(true).addChoices(...['profile','promote','demote','infraction'].map(name=>({name,value:name})))).addStringOption(o=>o.setName('details').setDescription('Reason or profile JSON').setRequired(true).setMaxLength(1000)).addRoleOption(o=>o.setName('old_rank').setDescription('Previous rank')).addRoleOption(o=>o.setName('new_rank').setDescription('New rank')),
  cmd('cad','Create a department dispatch event').addStringOption(o=>o.setName('event').setDescription('Event template').setRequired(true).addChoices(...Object.keys(seeds).filter(k=>k.startsWith('dispatch_')).map(k=>({name:k.replace('dispatch_','').replaceAll('_',' '),value:k})))).addStringOption(o=>o.setName('location').setDescription('Incident location').setRequired(true)).addStringOption(o=>o.setName('details').setDescription('Incident details').setRequired(true).setMaxLength(1000)).addStringOption(o=>o.setName('priority').setDescription('Dispatch priority').setRequired(true))
];
export async function command(service,i) {
  const {store}=service,g=store.guild(i.guildId),member=await i.guild.members.fetch(i.user.id),opt=i.options;
  if(i.commandName==='panel') return i.reply(service.panel(g,opt.getString('name'),member,{},0,true));
  if(i.commandName==='security') {
    requireAccess(member,g.config,'management');await i.deferReply({flags:64});
    const enabled=opt.getString('action')==='lockdown',reason=opt.getString('reason');const result=await lockdown(service,i.guild,member,enabled,reason);
    await i.channel.send(render(service.template(g,'lockdown'),{...service.variables(g,member),status:enabled?'Text channel lockdown active':'Normal permissions restored',reason}));
    const failed=Object.values(result.channels).filter(x=>x.error&&!x.applied).length;
    return editReply(i, notice('🔒 Security status updated',`${enabled?'Lockdown processed. Members with role-specific send overrides may retain access.':'Previous @everyone send-message permissions restored.'}${failed?` ${failed} channels could not be locked; review bot permissions.`:''}`,failed?'orange':'green'));
  }
  if(i.commandName==='activity') {
    requireAccess(member,g.config,'management');const kind=opt.getString('kind'),options=opt.getString('options')?.split('|').map(x=>x.trim());
    if(kind==='poll'&&(!options||options.length<2||options.length>5||options.some(x=>!x||x.length>80)||new Set(options).size!==options.length))throw Error('Provide 2–5 distinct poll choices, each under 80 characters');
    await i.deferReply({flags:64});const activity={id:id(),kind,title:opt.getString('title'),options:options??[],end:Date.now()+opt.getInteger('minutes')*60000,entries:{},channel:i.channelId};
    const message=await i.channel.send(service.activityPanel(g,activity));activity.message=message.id;g.records[activity.id]=activity;store.change(i.guildId,member.id,'activity-created',activity);
    return editReply(i, notice('✅ Activity opened',`Reference **${activity.id}**. Entries close automatically.`,'green'));
  }
  if(i.commandName==='setup') {
    requireAccess(member,g.config,'management');const key=opt.getString('key'),value=opt.getString('value');
    if(key.endsWith('Roles')) {const roles=value.split(',').map(x=>x.trim()).filter(Boolean);for(const roleId of roles) if(!await i.guild.roles.fetch(roleId)) throw Error('Role not found');g.config[key]=roles;}
    else if(['weeklyMinutes','maxPlayers'].includes(key)){ const n=Number(value);if(!Number.isInteger(n)||n<1||n>10080)throw Error('Invalid number');g.config[key]=n; }
    else {if(value.length>1500)throw Error('Setting too long');g.config[key]=value;}
    store.change(i.guildId,member.id,'setup',{key,value});return i.reply(notice('✅ Configuration saved',`${key} has been updated.`,'green'));
  }
  if(i.commandName==='session') {
    requireAccess(member,g.config);await i.deferReply({flags:64});
    const channel=await i.guild.channels.fetch(g.config.sessionChannel);if(!channel?.isTextBased())throw Error('Configure a session channel first');
    const action=opt.getString('action');
    if(action==='start') {
      if(g.sessions.at(-1)&&!g.sessions.at(-1).end)throw Error('A session is already active');
      const session={id:id(),host:member.id,start:Date.now(),peak:0,participants:[]};g.sessions.push(session);store.save();
      try { const message=await channel.send(render(service.template(g,'ssu'),service.variables(g,member)));session.channel=channel.id;session.message=message.id;store.save(); } catch(error) {session.end=Date.now();session.reason='Announcement failed';store.save();throw error;}
    } else if(action==='stop') {
      const session=g.sessions.at(-1);if(!session||session.end)throw Error('No active session');session.end=Date.now();session.reason=opt.getString('reason')??'Scheduled session conclusion';store.save();
      const payload=render(service.template(g,'ssd'),service.variables(g,member));
      await (await (await i.guild.channels.fetch(session.channel)).messages.fetch(session.message)).edit(payload);
    } else {
      const [threshold,minutes]=(opt.getString('settings')??'10,15').split(',').map(Number);
      if(!Number.isInteger(threshold)||threshold<1||threshold>10000||!Number.isInteger(minutes)||minutes<1||minutes>1440)throw Error('Use threshold 1–10000 and duration 1–1440 minutes');
      const vote={id:id(),threshold,end:Date.now()+minutes*60000,ballots:{},channel:channel.id};
      const message=await channel.send(render(service.template(g,'session_vote'),{community:g.config.community,...service.voteVars(vote)}));vote.message=message.id;g.votes[vote.id]=vote;store.save();
    }
    return editReply(i, notice('✅ Session updated','The session panel has been updated.','green'));
  }
  if(i.commandName==='moderate') {
    requireAccess(member,g.config);await i.deferReply({flags:64});
    const kind=opt.getString('action'),user=opt.getUser('member'),reason=opt.getString('reason'),minutes=opt.getInteger('minutes');
    if(user.id===member.id||user.id===service.client.user.id||user.id===i.guild.ownerId||g.config.owners?.includes(user.id))throw Error('Cannot moderate this protected account');
    const target=await i.guild.members.fetch(user.id).catch(()=>null);
    if(!target)throw Error('Target must be a current guild member');
    if(member.id!==i.guild.ownerId && target.roles.highest.position>=member.roles.highest.position)throw Error('Target is at or above your highest role');
    const permission={warning:'ModerateMembers',timeout:'ModerateMembers',kick:'KickMembers',ban:'BanMembers',tempban:'BanMembers'}[kind];
    if(!member.roles.cache.some(role=>ids.commandPolicy.moderationRoles.includes(role.id)))throw Error('Configured moderation role required');
    if(['timeout','tempban'].includes(kind)&&!minutes)throw Error('Duration in minutes is required');
    const log=await service.restrictedChannel(i.guild,g,'moderationLogChannel');
    if(kind==='kick'){if(!target.kickable)throw Error('Bot cannot kick this member');await target.kick(reason);}
    if(['ban','tempban'].includes(kind)){if(!target.bannable)throw Error('Bot cannot ban this member');await target.ban({reason});}
    if(kind==='timeout'){if(!target.moderatable)throw Error('Bot cannot timeout this member');await target.timeout(minutes*60000,reason);}
    const record={id:id(),kind,memberId:user.id,moderator:member.id,reason,at:Date.now(),status:'active',expires:minutes ? Date.now()+minutes*60000 : null};
    record.vars={...service.variables(g,member),member:`<@${user.id}>`,member_id:user.id,moderator:`<@${member.id}>`,reason,case_id:record.id,warning_count:Object.values(g.cases).filter(x=>x.memberId===user.id&&x.kind==='warning'&&x.status==='active').length+(kind==='warning'?1:0),duration:minutes?`${minutes} minutes`:'Not applicable'};
    g.cases[record.id]=record;store.change(i.guildId,member.id,'moderation',record);
    const payload=render(service.template(g,kind),record.vars);await log.send(payload);
    try{await user.send(payload);}catch{record.dmFailed=true;store.save();}
    return editReply(i, notice('✅ Moderation recorded',`Case **${record.id}** saved.${record.dmFailed?' Direct message could not be delivered.':''}`,'green'));
  }
  if(i.commandName==='case') {
    const record=g.cases[opt.getString('id')];if(!canViewCase(member,g.config,record))throw Error('Case access denied');
    const action=opt.getString('action');
    if(action==='view')return i.reply(render(service.template(g,record.kind),record.vars,{ephemeral:true}));
    requireAccess(member,g.config,'management');if(record.memberId===member.id)throw Error('You cannot modify your own disciplinary record');
    const reason=opt.getString('reason');if(!reason)throw Error('Provide a decision reason');
    await i.deferReply({flags:64});
    const log=await service.restrictedChannel(i.guild,g,'moderationLogChannel',record.kind==='staff_infraction'?'management':'staff');
    if(action.includes('appeal')&&record.appeal?.status!=='submitted')throw Error('No pending appeal');
    if(action==='revoke'||action==='accept-appeal') {
      if(['ban','tempban'].includes(record.kind))await i.guild.bans.remove(record.memberId,reason);
      if(record.kind==='timeout')await (await i.guild.members.fetch(record.memberId)).timeout(null,reason);
      record.status='revoked';
    }
    const template=action==='revoke'?'revoked':action==='accept-appeal'?'appeal_accepted':'appeal_denied';
    if(record.appeal&&action.includes('appeal'))record.appeal.status=action==='accept-appeal'?'accepted':'denied';
    store.change(i.guildId,member.id,'case-decision',{id:record.id,action,reason});
    const payload=render(service.template(g,template),{...record.vars,reason,moderator:`<@${member.id}>`});await log.send(payload);
    await (await service.client.users.fetch(record.memberId)).send(payload).catch(()=>{});
    return editReply(i, notice('✅ Case updated',`Case **${record.id}** decision saved.`,'green'));
  }
  if(i.commandName==='staff') {
    requireAccess(member,g.config,'management');const user=opt.getUser('member'),action=opt.getString('action'),details=opt.getString('details');
    if(user.id===member.id||g.config.owners?.includes(user.id)||user.id===i.guild.ownerId)throw Error('Managers cannot modify their own or protected owner records');
    if(action==='profile') {
      const profile=JSON.parse(details);if(Object.keys(profile).some(k=>!['training','supervisor','discipline'].includes(k))||Object.values(profile).some(v=>typeof v!=='string'||v.length>500))throw Error('Use training, supervisor, and discipline text fields');
      g.records[`profile:${user.id}`]=profile;store.change(i.guildId,member.id,'staff-profile',{user:user.id,profile});return i.reply(notice('✅ Profile updated','Staff profile saved.','green'));
    }
    await i.deferReply({flags:64});
    const log=await service.restrictedChannel(i.guild,g,'moderationLogChannel','management');
    const vars={...service.variables(g,member),member:`<@${user.id}>`,member_id:user.id,manager:`<@${member.id}>`,reason:details,timestamp:`<t:${Math.floor(Date.now()/1000)}:f>`};
    if(action==='infraction') {
      const record={id:id(),kind:'staff_infraction',memberId:user.id,moderator:member.id,reason:details,at:Date.now(),status:'active'};record.vars={...vars,case_id:record.id,infraction_type:'Staff conduct review',evidence:'See case reason and restricted management records',status:'active'};g.cases[record.id]=record;store.change(i.guildId,member.id,'staff-infraction',record);
      const payload=render(seeds.staff_infraction,record.vars);await log.send(payload);await user.send(payload).catch(()=>{});
    } else {
      const oldRole=opt.getRole('old_rank'),newRole=opt.getRole('new_rank');if(!oldRole||!newRole||oldRole.id===newRole.id)throw Error('Provide different previous and new rank roles');
      const target=await i.guild.members.fetch(user.id),bot=await i.guild.members.fetchMe();
      if(target.id===i.guild.ownerId || (member.id!==i.guild.ownerId && (target.roles.highest.position>=member.roles.highest.position || newRole.position>=member.roles.highest.position || oldRole.position>=member.roles.highest.position)))throw Error('Rank hierarchy prevents this change');
      if(newRole.position>=bot.roles.highest.position||oldRole.position>=bot.roles.highest.position||newRole.managed||newRole.permissions.has(PermissionFlagsBits.Administrator))throw Error('Unsafe or unmanageable rank');
      if(!target.roles.cache.has(oldRole.id))throw Error('Member does not have the previous rank');
      await target.roles.add(newRole);try{await target.roles.remove(oldRole);}catch(error){await target.roles.remove(newRole);throw error;}
      Object.assign(vars,{old_rank:oldRole.name,new_rank:newRole.name});
      await log.send(notice('📋 Restricted rank change',`${user.tag}: ${oldRole.name} → ${newRole.name}\n**Manager:** <@${member.id}>\n**Reason:** ${details}`,'purple',false));
      await i.channel.send(render(service.template(g,action==='promote'?'promotion':'demotion'),vars));store.change(i.guildId,member.id,'staff-rank',{user:user.id,action,details,old:oldRole.id,new:newRole.id});
    }
    return editReply(i, notice('✅ Staff record updated','The update has been saved.','green'));
  }
  if(i.commandName==='cad') {
    requireAccess(member,g.config,'department');await i.deferReply({flags:64});
    const channel=await service.restrictedChannel(i.guild,g,'dispatchChannel','department');
    const call={id:id(),event:opt.getString('event'),location:opt.getString('location'),details:opt.getString('details'),priority:opt.getString('priority'),reporting:member.id,at:Date.now(),units:[],acknowledged:[]};
    g.records[`cad:${call.id}`]=call;store.change(i.guildId,member.id,'dispatch',call);
    await channel.send(render(service.template(g,call.event),{...service.variables(g,member),call_id:call.id,priority:call.priority,location:call.location,incident_type:call.event.replace('dispatch_','').replaceAll('_',' '),reporting_unit:`<@${member.id}>`,details:call.details}));
    return editReply(i, notice('📡 Dispatch recorded',`Call reference: **${call.id}**`,'cyan'));
  }
}
