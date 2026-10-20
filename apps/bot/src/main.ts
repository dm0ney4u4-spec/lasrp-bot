import {acknowledgeInteraction}from'./acknowledgment.js';
import fs from 'node:fs';
import { bootstrapCommunity } from './community.js';
import { signalPanic } from '../../api/src/panic.js';
import { syncAutomod } from './automod.js';
import { Client,GatewayIntentBits,Events,SlashCommandBuilder,PermissionFlagsBits,ActionRowBuilder,ChannelSelectMenuBuilder,RoleSelectMenuBuilder,ContainerBuilder,type Interaction,type ChatInputCommandInteraction } from 'discord.js';
import { ids } from '../../../config/ids.js';
import { commands as baseCommands,command as baseCommand } from './commands.js';
import { CommunityService } from './service.js';
import { Applications } from './applications.js';
import { Tickets } from './tickets.js';
import { Sessions,sessionCommands } from './sessions.js';
import { staffCommand,staffAction } from './staff.js';
import { render,notice,button } from './panels.js';
import { editReply } from './replies.js';
import { protect } from './protection.js';
import { lockdown } from './security.js';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { groupsFor,allowed,requireAgency,type Principal } from '../../../packages/shared/src/permissions.js';
import type { DatabaseStore } from '../../../packages/shared/src/store.js';
import type { ErlcAdapter } from '../../api/src/erlc.js';
import { seeds } from './seeds.js';
import { publicError } from '../../../packages/shared/src/errors.js';
const command=(name:string,description:string)=>new SlashCommandBuilder().setName(name).setDescription(description).setDMPermission(false);
const bindableRoles=['communityManagement','admin','moderator','trialModerator','staff','applicationReviewer','ticketSupport','securityTeam','sessionHost','verified','police','sheriff','fire','ems','dot','dispatcher','supervisor','doj','judge','prosecutor','defense','clerk'] as const;
export const extraCommands=[
 command('panic','Alert on-duty responders to a fictional unit emergency').addStringOption(o=>o.setName('reason').setDescription('Fictional emergency details and location').setRequired(true).setMinLength(5).setMaxLength(500)),
 command('security','Protected operations and security review').addSubcommand(c=>c.setName('automod').setDescription('Management: synchronize configured native AutoMod rules')).addSubcommand(c=>c.setName('status').setDescription('Security posture and incidents')).addSubcommand(c=>c.setName('lockdown').setDescription('Owner: lock dangerous commands and public text channels').addStringOption(o=>o.setName('reason').setDescription('Reason').setRequired(true))).addSubcommand(c=>c.setName('unlock').setDescription('Owner: restore command and channel access')).addSubcommand(c=>c.setName('mode').setDescription('Owner: choose monitoring mode').addStringOption(o=>o.setName('mode').setDescription('Response mode').setRequired(true).addChoices({name:'Monitor Only',value:'monitor'},{name:'Alert and Review',value:'review'},{name:'Auto Contain (owner opt-in required)',value:'contain'}))).addSubcommand(c=>c.setName('test').setDescription('Create a clearly marked test incident')),
 command('applications','Staff recruitment').addSubcommand(c=>c.setName('status').setDescription('View your application status')).addSubcommand(c=>c.setName('open').setDescription('Open staff recruitment')).addSubcommand(c=>c.setName('close').setDescription('Close recruitment')).addSubcommand(c=>c.setName('panel').setDescription('Deploy the application panel')),
 command('setup','Validate and configure LASRP').addSubcommand(c=>c.setName('validate').setDescription('Check IDs, permissions, DB and branding')).addSubcommand(c=>c.setName('wizard').setDescription('Bind a channel or role').addStringOption(o=>o.setName('setting').setDescription('Setting').setRequired(true).addChoices(...['sessionChannel','dispatchChannel','applicationReviewChannel','moderationLogChannel','securityChannel','ticketCategory','staffRoles','managementRoles','departmentRoles','verifiedRole'].map(value=>({name:value,value}))))).addSubcommand(c=>c.setName('roles').setDescription('Bind a role group shared by Discord and CAD').addStringOption(o=>o.setName('group').setDescription('Permission group').setRequired(true).addChoices(...bindableRoles.map(value=>({name:value,value}))))),
 command('panel','Read, deploy or refresh a V2 panel').addSubcommand(c=>c.setName('read').setDescription('Read a panel privately').addStringOption(o=>o.setName('name').setDescription('Panel key').setRequired(true))).addSubcommand(c=>c.setName('deploy').setDescription('Create or update a public panel').addStringOption(o=>o.setName('name').setDescription('Panel key').setRequired(true))),
 command('help','Show available LASRP commands'),command('cad','Server owner: deploy CAD information').addSubcommand(c=>c.setName('panel').setDescription('Deploy or refresh the CAD panel in its configured channel')),
 command('erlc','Read live ER:LC information').addSubcommand(c=>c.setName('status').setDescription('Server health and population')).addSubcommand(c=>c.setName('players').setDescription('Live player list')).addSubcommand(c=>c.setName('queue').setDescription('Queue size')).addSubcommand(c=>c.setName('message').setDescription('Send an approved in-game announcement').addStringOption(o=>o.setName('text').setDescription('Announcement').setRequired(true).setMaxLength(160))),
];
export const allCommands=[...baseCommands.filter(c=>!['setup','panel','cad','security','session','staff'].includes(c.name)),...extraCommands.filter(c=>c.name!=='panic'),...sessionCommands,staffCommand];
export function createBot(store:DatabaseStore,erlc:ErlcAdapter){
 const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildModeration,GatewayIntentBits.DirectMessages,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
 const service=new CommunityService(client,store),applications=new Applications(client,service);
 const tickets=new Tickets(client,service);
 protect(service);
 // Replace the previous guild-modal entry point with the durable DM application flow.
 seeds.applications.buttons=[button('Apply via DM','apply','0',1),button('Requirements','panel','application_guidelines'),button('Application Status','applicationStatus')];delete seeds.applications.select;
 seeds.applications.sections=['Join the Los Angeles State Roleplay staff team. Applications are completed privately through DMs, answered once in order, and reviewed by authorized leadership. Answers cannot be edited; there is no pause or back button.','**Recruitment:** {recruitment_status}\n**Requirements:** {application_requirements}'];
 seeds.cad={key:'cad',title:'LASRP CAD',color:'blue',sections:['The shared fictional public-safety workspace for dispatch, responders, and civilians.','**CAD:** {cad_url}\nThe current localhost address works only on the hosting computer. Community-wide access requires a public HTTPS host; this panel will use WEB_BASE_URL after hosting is configured.\nCreate fictional characters and vehicles, submit calls, and access department records according to your assigned role.'],buttons:[button('Launch CAD','web','cad'),button('Create Civilian Profile','web','civilian'),button('Help','panel','help')]};
 const originalVars=service.variables.bind(service);service.variables=(g:any,member?:any)=>({...originalVars(g,member),community:ids.settings.community,cad_url:process.env.WEB_BASE_URL??'http://localhost:3000',recruitment_status:applications.settings().open?'OPEN':'CLOSED',application_requirements:applications.settings().requirements});
 const principal=async(userId:string):Promise<Principal>=>applications.principal(userId);
 const sessions=new Sessions(client,service,principal);
 const management=async(userId:string)=>{const p=await principal(userId);if(!allowed(p,'management'))throw Error('Management access required');return p;};
 const locks=new Set<string>();
 client.on(Events.InteractionCreate,async i=>{
  const actorKey=i.user.id;
  try{
   i=await acknowledgeInteraction(i);
   if(await applications.interaction(i))return;
   if(await tickets.interaction(i))return;
   if(await sessions.interaction(i))return;
   if(i.isChatInputCommand()){
    if(['moderate','case'].includes(i.commandName)){const p=await principal(i.user.id);if(!p.roles.some(role=>ids.commandPolicy.moderationRoles.includes(role)))throw Error('Configured moderation role required');}
    if(i.commandName==='panic'){const p=await principal(i.user.id),unit=await db.unit.findUniqueOrThrow({where:{userId:i.user.id}});await i.deferReply({flags:64});const result=await signalPanic(p,{version:unit.version,reason:i.options.getString('reason',true)});await editReply(i,notice('Unit emergency sent',String(result.recipientCount)+' on-duty recipients were notified in CAD. This does not contact real emergency services.'));return;}
    if(i.commandName==='staff'){await staffAction(service,i,await principal(i.user.id));return;}
    if(['ssu','ssd','session'].includes(i.commandName)){await sessions.command(i);return;}
    if(i.commandName==='security'){
     const p=await principal(i.user.id),g=store.guild(ids.guildId),action=i.options.getSubcommand();
     if(action==='automod'){if(!allowed(p,'management'))throw Error('Management access required');await i.deferReply({flags:64});const result=await syncAutomod(await client.guilds.fetch(ids.guildId),i.user.id);await i.editReply(notice('AutoMod synchronized',result.map(r=>r.name+': '+(r.enabled?'enabled':'disabled')).join('\n')));return;}
     if(action==='status'||action==='test'){
      if(!allowed(p,'security'))throw Error('Security team access required');
      if(action==='test'){const test={id:'SEC-TEST-'+Date.now(),kind:'explicit_test',status:'awaiting_review',actor:i.user.id,at:Date.now()};g.records[test.id]=test;store.change(ids.guildId,i.user.id,'security.test',test);await store.flush();}
      await i.reply(notice('LASRP Security',`**Mode:** ${g.config.security?.securityMode??ids.settings.securityMode}\n**Owner auto-containment opt-in:** ${ids.settings.autoContainEnabled?'enabled':'disabled'}\n**Command lockdown:** ${g.config.commandLockdown?'active':'inactive'}\n**Recent incidents:** ${Object.values(g.records).filter((r:any)=>r.id?.startsWith('SEC-')).length}\nReview full incident records in Staff Center.`));return;
     }
     if(!ids.owners.includes(i.user.id))throw Error('Only an explicitly configured owner can change emergency security settings');
     if(action==='mode'){const mode=i.options.getString('mode',true);if(mode==='contain'&&!ids.settings.autoContainEnabled)throw Error('Enable autoContainEnabled explicitly in config/ids.ts before selecting containment');g.config.security={...g.config.security,securityMode:mode};store.change(ids.guildId,i.user.id,'security.mode',{mode});await store.flush();await i.reply(notice('Security mode saved',mode));return;}
     await i.deferReply({flags:64});if(action==='lockdown'){g.config.commandLockdown=true;store.change(ids.guildId,i.user.id,'security.command-lockdown',{});await store.flush();await lockdown(service,i.guild!,await i.guild!.members.fetch(i.user.id),true,i.options.getString('reason',true));}else{await lockdown(service,i.guild!,await i.guild!.members.fetch(i.user.id),false,'Owner-authorized recovery');g.config.commandLockdown=false;store.change(ids.guildId,i.user.id,'security.command-unlock',{});await store.flush();}await editReply(i,notice('Owner security action saved',action==='lockdown'?'Dangerous commands are owner-only. Public text-channel restrictions were applied where permitted.':'Stored channel permissions and command access have been restored.'));return;
    }
    if(i.commandName==='applications'){
     const action=i.options.getSubcommand();
     if(action==='status'){const rows=await db.application.findMany({where:{applicantId:i.user.id,guildId:ids.guildId},orderBy:{createdAt:'desc'},take:10});await i.reply(notice('Your applications',rows.map(a=>`**LASRP-APP-${String(a.number).padStart(6,'0')}:** ${a.status}`).join('\n')||'No applications yet.'));return;}
     await management(i.user.id);
     if(action==='panel'){await deploy(i,service,'applications');return;}
     const g=store.guild(ids.guildId);g.config.applicationSettings={...applications.settings(),open:action==='open'};store.change(ids.guildId,i.user.id,'recruitment-status',{open:action==='open'});await store.flush();await i.reply(notice('Recruitment updated',`Applications are now ${action==='open'?'open':'closed'}.`));return;
    }
    if(i.commandName==='panel'){const key=i.options.getString('name',true);if(i.options.getSubcommand()==='deploy'){await management(i.user.id);await deploy(i,service,key);}else await i.reply(service.panel(store.guild(ids.guildId),key,await i.guild!.members.fetch(i.user.id),{},0,true));return;}
    if(i.commandName==='setup'){
     await management(i.user.id);
     if(i.options.getSubcommand()==='validate'){await i.deferReply({flags:64});await editReply(i,notice('LASRP Setup Validation',await validateSetup(service,erlc)));return;}
     const setting=i.options.getSubcommand()==='roles'?'role~'+i.options.getString('group',true):i.options.getString('setting',true),role=setting.startsWith('role~')||setting.endsWith('Roles')||setting==='verifiedRole';
     if((setting==='managementRoles'||setting==='role~communityManagement')&&!ids.owners.includes(i.user.id))throw Error('Only configured owners can bind management roles');
     const payload=notice('Setup Wizard',`Choose the ${role?'role':'channel'} for **${setting}**.`),container=new ContainerBuilder(payload.components[0]);
     if(role)container.addActionRowComponents(new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId(`ls:setupBind:${setting}`).setMaxValues(setting.endsWith('Roles')?10:1)));
     else container.addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId(`ls:setupBind:${setting}`)));
     await i.reply({...payload,components:[container]});return;
    }
    if(i.commandName==='help'){const p=await principal(i.user.id);await i.reply(notice('LASRP Operations | Help',`**Members:** Applications: <#${ids.channels.applicationsPanel}>. CAD: <#${ids.channels.cadPanel}>. /applications status\n${allowed(p,'host','moderator')?'**Operations:** /ssu, /ssd, /session vote, /session boost, /moderate\n':''}${allowed(p,'management')?'**Management:** /setup, /panel deploy, /staff, /case, /security, /applications open or close\n':''}**CAD:** ${process.env.WEB_BASE_URL??'http://localhost:3000'}\nOnly registered commands are available.`));return;}
    if(i.commandName==='cad'){if(i.user.id!==i.guild!.ownerId)throw Error('Only the server owner can deploy the CAD panel');await deploy(i,service,'cad');return;}
    if(i.commandName==='erlc'){
     const p=await principal(i.user.id);if(!allowed(p,'moderator','host','dispatcher'))throw Error('Operational access required');await i.deferReply({flags:64});const action=i.options.getSubcommand();
     if(action==='message'){if(!allowed(p,'management'))throw Error('Management approval required');const text=i.options.getString('text',true);const outcome=await erlc.message(text);await audit(i.user.id,'erlc.message',ids.guildId,null,{confirmed:outcome.confirmed});await editReply(i,notice('ER:LC confirmed','The API confirmed execution of the approved announcement.'));return;}
     const {data,at}=await erlc.snapshot();await editReply(i,notice('ER:LC | Live Server',action==='players'?(data.Players??[]).slice(0,25).map(x=>x.Player).join('\n')||'No players':action==='queue'?`**Queued:** ${data.Queue?.length??0}`:`**Server:** ${data.Name}\n**Players:** ${data.CurrentPlayers}/${data.MaxPlayers}\n**Updated:** <t:${Math.floor(at/1000)}:R>`));return;
    }
    const g=store.guild(ids.guildId);if(g.config.commandLockdown&&!ids.owners.includes(i.user.id))throw Error('Owner emergency command lockdown is active');
    if(locks.has(i.guildId??actorKey))throw Error('Another operation is in progress. Try again shortly.');locks.add(i.guildId??actorKey);try{await baseCommand(service,i);await store.flush();}finally{locks.delete(i.guildId??actorKey);}return;
   }
   if(!('customId'in i))return;
   if(i.customId.startsWith('ls:setupBind:')&&(i.isRoleSelectMenu()||i.isChannelSelectMenu())){
    await management(i.user.id);const key=i.customId.slice('ls:setupBind:'.length),allowedKeys=['sessionChannel','dispatchChannel','applicationReviewChannel','moderationLogChannel','securityChannel','ticketCategory','staffRoles','managementRoles','departmentRoles','verifiedRole',...bindableRoles.map(k=>'role~'+k)];if(!allowedKeys.includes(key))throw Error('Unknown setup setting');if((key==='managementRoles'||key==='role~communityManagement')&&!ids.owners.includes(i.user.id))throw Error('Owner access required');
    const g=store.guild(ids.guildId);if(key.startsWith('role~')){const name=key.slice(5);g.config.rbacRoles={...g.config.rbacRoles,[name]:i.values[0]};if(name==='communityManagement')g.config.managementRoles=[...new Set([...g.config.managementRoles,i.values[0]])];if(['admin','moderator','trialModerator','staff','sessionHost','ticketSupport'].includes(name))g.config.staffRoles=[...new Set([...g.config.staffRoles,i.values[0]])];if(['police','sheriff','fire','ems','dot','dispatcher','supervisor'].includes(name))g.config.departmentRoles=[...new Set([...g.config.departmentRoles,i.values[0]])];if(name==='verified')g.config.verifiedRole=i.values[0];}else g.config[key]=key.endsWith('Roles')?i.values:i.values[0];store.change(ids.guildId,i.user.id,'setup-bind',{key,value:i.values});await store.flush();await i.reply(notice('Configuration saved',`${key} is now configured. Use /setup validate to check access.`));return;
   }
   if((i.isButton()||i.isStringSelectMenu())&&i.customId.startsWith('ls:apply:')){if(i.channelId!==ids.channels.applicationsPanel)throw Error('Start applications from the designated applications channel');await i.deferReply({flags:64});await applications.start(i.user.id);await editReply(i,notice('Check your DMs','Your application is ready.'));return;}
   if(i.isButton()&&i.customId.startsWith('ls:applicationStatus:')){const rows=await db.application.findMany({where:{applicantId:i.user.id,guildId:ids.guildId},orderBy:{createdAt:'desc'},take:10});await i.reply(notice('Application status',rows.map(x=>`**${x.number}:** ${x.status}`).join('\n')||'No applications yet.'));return;}
   if(i.isButton()&&i.customId.startsWith('ls:web:')){const tab=i.customId.slice('ls:web:'.length);await i.reply(notice('LASRP CAD',`[Open your secure CAD workspace](${process.env.WEB_BASE_URL??'http://localhost:3000'}/#${tab==='civilian'?'Civilian Portal':'Dashboard'})`));return;}
   if(i.isButton()&&/^ls:(dispatchAssign|dispatchAck):/.test(i.customId)){
    const [,action,incidentId]=i.customId.split(':'),incident=await db.incident.findUnique({where:{id:incidentId}});
    if(incident){const p=await principal(i.user.id);requireAgency(p,incident.agency);const unit=await db.unit.findUnique({where:{userId:i.user.id}});if(!unit)throw Error('Go on duty in CAD first');if(action==='dispatchAssign'){await db.callAssignment.upsert({where:{incidentId_unitId:{incidentId,unitId:unit.id}},create:{incidentId,unitId:unit.id,assignedBy:i.user.id},update:{}});}await audit(i.user.id,action,incident.id,null,{unitId:unit.id});changed();await i.reply(notice('CAD Updated',`Call **${incident.id}** ${action==='dispatchAssign'?'assigned to your unit':'acknowledged'}.`));return;}
   }
   if(i.isButton()&&i.customId.startsWith('ls:record:cad,')){
    const incidentId=i.customId.slice('ls:record:cad,'.length),incident=await db.incident.findUnique({where:{id:incidentId}});if(incident){requireAgency(await principal(i.user.id),incident.agency);await i.reply(notice('CAD Incident',`**${incident.id} | P${incident.priority}:** ${incident.type}\n**Location:** ${incident.location}\n**Status:** ${incident.status}\n${incident.narrative}`));return;}
   }
   if(i.isButton()||i.isStringSelectMenu()||i.isModalSubmit()){await service.interact(i);await store.flush();}
  }catch(error){const failure={at:new Date().toISOString(),action:i.isChatInputCommand()?i.commandName:'customId'in i?i.customId.split(':').slice(0,2).join(':'):'other',code:(error as {code?:number}).code,name:error instanceof Error?error.name:'Unknown failure',acknowledged:'deferred'in i&&i.deferred};console.error('Interaction failed:',JSON.stringify(failure));try{fs.mkdirSync('data',{recursive:true});fs.appendFileSync('data/interaction-errors.ndjson',JSON.stringify(failure)+'\n');}catch{}if('reply'in i){const payload=notice('Action needs attention',publicError(error),'orange',i.inGuild());try{if(i.deferred)await editReply(i,payload);else if(i.replied)await i.followUp(payload);else await i.reply(payload);}catch{console.error('Could not deliver interaction response.');}}}
 });
 client.on(Events.GuildMemberAdd,async member=>{if(member.guild.id!==ids.guildId)return;const g=store.guild(ids.guildId);if(!g.config.welcomeChannel)return;try{const channel=await member.guild.channels.fetch(g.config.welcomeChannel);if(channel?.isTextBased()&&'send'in channel)await channel.send(service.panel(g,'welcome',member));}catch{console.error('Welcome delivery failed.');}});
 client.on(Events.Error,()=>console.error('Discord connection reported an error.'));
 return {client,service,applications,bootstrap:async()=>{await bootstrapCommunity(service);try{await applications.compactExistingReviews();}catch{console.error('Existing application review compaction needs attention.');}}};
}
async function deploy(i:ChatInputCommandInteraction,service:CommunityService,key:string){
 await i.deferReply({flags:64});if(key==='cad'&&i.user.id!==i.guild!.ownerId)throw Error('Only the server owner can deploy the CAD panel');const channelId=key==='cad'?ids.channels.cadPanel:key==='applications'?ids.channels.applicationsPanel:key==='community_rules'?ids.channels.rules:i.channelId;const g=service.store.guild(i.guildId!),old=Object.values(g.published).find((p:any)=>p.key===key&&p.channel===channelId) as {id:string}|undefined;const publication=await service.publish(i.guildId!,channelId,key,i.user.id,{},old?.id);await editReply(i,notice('Panel ready',`**${key}** published as message ${publication.message}. Repeating this command updates the existing panel.`));
}
export async function validateSetup(service:CommunityService,erlc:ErlcAdapter){
 const lines:string[]=[];await db.$queryRaw`SELECT 1`;lines.push('◆ PostgreSQL: connected');
 const guild=await service.client.guilds.fetch(ids.guildId),bot=await guild.members.fetchMe();
 lines.push(`◆ Bot: ${bot.user.tag}`,`◆ Owners: ${ids.owners.length?'configured':'MISSING'}`,`◆ OAuth redirect: ${(process.env.WEB_BASE_URL??'http://localhost:3000')+'/auth/callback'}`);
 const needed=['ViewChannel','SendMessages','ManageChannels','ManageRoles','ReadMessageHistory','ModerateMembers','KickMembers','BanMembers','ViewAuditLog'] as const;
 for(const name of needed)if(!bot.permissions.has(PermissionFlagsBits[name]))lines.push(`◇ Missing permission: ${name}`);
 for(const [name,value] of Object.entries(ids.channels)){if(!value){lines.push(`◇ Optional channel ${name}: unconfigured`);continue;}const channel=await guild.channels.fetch(value).catch(()=>null);lines.push(`${channel?'◆':'◇'} ${name}: ${channel?'found':'NOT FOUND'}`);}
 const {assets}=await import('../../../config/assets.js'),fs=await import('node:fs');for(const [key,value] of Object.entries(assets))lines.push(`${fs.existsSync(value)?'◆':'◇'} Branding ${key}: ${fs.existsSync(value)?'local file ready':'MISSING'}`);
 if(process.env.ERLC_SERVER_API_KEY){try{await erlc.snapshot();lines.push('◆ ER:LC authentication: confirmed');}catch(error){lines.push(`◇ ER:LC: ${error instanceof Error?error.message:'unavailable'}`);}}else lines.push('◇ ER:LC API key: optional, not configured');
 return lines.join('\n').slice(0,3000);
}
