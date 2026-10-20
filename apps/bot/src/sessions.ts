import { SlashCommandBuilder,type Client,type ChatInputCommandInteraction,type Interaction } from 'discord.js';
import { randomUUID } from 'node:crypto';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { ids } from '../../../config/ids.js';
import type { Principal } from '../../../packages/shared/src/permissions.js';
import { render,notice,button } from './panels.js';
import { editReply } from './replies.js';
import type { CommunityService } from './service.js';
const cmd=(name:string,description:string)=>new SlashCommandBuilder().setName(name).setDescription(description).setDMPermission(false);
export function requireSessionRole(p:Principal){if(!p.roles.some(role=>ids.commandPolicy.sessionRoles.includes(role)))throw Error('The configured session staff role is required.');}
export function sessionPing(payload:any){payload.components[0].components.unshift({type:10,content:ids.commandPolicy.sessionPingRoles.map(role=>`<@&${role}>`).join(' ')});payload.allowedMentions={parse:[],roles:ids.commandPolicy.sessionPingRoles};return payload;}
export async function reserveSession(guildId:string,hostId:string){const id='SES-'+randomUUID();const result=await db.session.createMany({data:[{id,guildId,hostId,activeKey:guildId}],skipDuplicates:true});if(!result.count)throw Error('An official session is already active or starting.');return db.session.findUniqueOrThrow({where:{id}});}
export const sessionCommands=[cmd('ssu','Start the official LASRP session'),cmd('ssd','End the official LASRP session').addStringOption(o=>o.setName('reason').setDescription('Shutdown reason').setRequired(true).setMaxLength(500)),cmd('session','Session vote or boost')
 .addSubcommand(c=>c.setName('vote').setDescription('Open a session vote').addIntegerOption(o=>o.setName('votes').setDescription('Number of yes votes needed to start a session').setRequired(true).setMinValue(1).setMaxValue(1000)).addIntegerOption(o=>o.setName('minutes').setDescription('Voting duration, defaults to 15 minutes').setMinValue(1).setMaxValue(120)))
 .addSubcommand(c=>c.setName('boost').setDescription('Announce a boost for the active session'))];
export class Sessions {
 constructor(private client:Client,private service:CommunityService,private principal:(id:string)=>Promise<Principal>){}
 async flush(){await(this.service.store as unknown as {flush():Promise<void>}).flush();}
 async channel(){const channel=await(await this.client.guilds.fetch(ids.guildId)).channels.fetch(ids.channels.sessions);if(!channel?.isTextBased()||!('send'in channel))throw Error('The configured sessions channel is unavailable.');return channel;}
 async command(i:ChatInputCommandInteraction){
  const p=await this.principal(i.user.id);requireSessionRole(p);if(!ids.featureFlags.sessions)throw Error('Sessions are disabled.');const g=this.service.store.guild(ids.guildId);if(g.config.commandLockdown&&!ids.owners.includes(i.user.id))throw Error('Owner command lockdown is active.');
  const action=i.commandName==='ssu'?'start':i.commandName==='ssd'?'stop':i.options.getSubcommand();
  if(action==='stop'){
   const active=await db.session.findUnique({where:{activeKey:ids.guildId}});if(!active)throw Error('No active session');g.records[`ssd-confirm:${active.id}:${i.user.id}`]={id:active.id,reason:i.options.getString('reason',true),actor:i.user.id};this.service.store.save();await this.flush();await i.reply(render({key:'ssd',title:'LASRP | CONFIRM SESSION SHUTDOWN',color:'blue',sections:[`**Reason:** ${i.options.getString('reason',true)}`,'Conclude the official session and save attendance.'],buttons:[button('Confirm Shutdown','sessionAction',`stop,${active.id}`,1)]},{community:ids.settings.community},{ephemeral:true}));return;
  }
  await i.deferReply({flags:64});const channel=await this.channel();
  if(action==='start'){
   const session=await reserveSession(ids.guildId,i.user.id),compat={id:session.id,host:i.user.id,start:session.startedAt.getTime(),peak:0,participants:[] as string[],channel:channel.id,message:''};g.sessions.push(compat);this.service.store.save();await this.flush();
   try{const message=await channel.send(sessionPing(render(this.service.template(g,'ssu'),this.service.variables(g))));compat.message=message.id;await db.session.update({where:{id:session.id},data:{status:'active',channelId:channel.id,messageId:message.id}});this.service.store.change(ids.guildId,i.user.id,'session.start',compat);await this.flush();await audit(i.user.id,'session.start',session.id,null,{host:i.user.id});}
   catch(error){await db.session.update({where:{id:session.id},data:{status:'failed',activeKey:null,endedAt:new Date()}});Object.assign(compat,{end:Date.now(),reason:'Announcement failed'});this.service.store.save();await this.flush();throw error;}
  }else if(action==='vote'){
   if(Object.values(g.votes).some((v:any)=>v.end>Date.now()&&!v.closed))throw Error('A session vote is already open.');
   const vote={id:randomUUID().slice(0,8),host:i.user.id,threshold:i.options.getInteger('votes',true),end:Date.now()+(i.options.getInteger('minutes')??15)*60000,ballots:{},channel:channel.id,message:'',notified:false};
   const message=await channel.send(sessionPing(render(this.service.template(g,'session_vote'),{community:ids.settings.community,...this.service.voteVars(vote)})));vote.message=message.id;g.votes[vote.id]=vote;this.service.store.change(ids.guildId,i.user.id,'session.vote',vote);await this.flush();
  }else if(action==='boost'){
   const active=await db.session.findUnique({where:{activeKey:ids.guildId}});if(!active||active.status!=='active')throw Error('Start a session before boosting it.');
   if(g.records.sessionBoostAt&&Date.now()-g.records.sessionBoostAt<300000)throw Error('Wait five minutes between session boosts.');
   await channel.send(sessionPing(render({key:'ssu',title:'LASRP | SESSION BOOST',color:'blue',sections:['The official LASRP session is active. Join the community in game for realistic roleplay.',`**Host:** <@${active.hostId}>\n**Join code:** ${g.config.joinCode||'See the server information channel.'}`]},{community:ids.settings.community})));g.records.sessionBoostAt=Date.now();this.service.store.change(ids.guildId,i.user.id,'session.boost',{sessionId:active.id});await this.flush();
  }else throw Error('Unknown session action');
  changed();await editReply(i,notice('Session updated',`The announcement was sent to <#${ids.channels.sessions}>.`));
 }
 async interaction(i:Interaction){
  if(!i.isButton()||!i.customId.startsWith('ls:sessionAction:'))return false;requireSessionRole(await this.principal(i.user.id));const [action,sessionId]=i.customId.slice('ls:sessionAction:'.length).split(',');if(action!=='stop')throw Error('Unknown session action');
  const g=this.service.store.guild(ids.guildId),pending=g.records[`ssd-confirm:${sessionId}:${i.user.id}`];if(!pending)throw Error('Request shutdown again with /ssd');
  await i.deferReply({flags:64});const session=await db.session.findUniqueOrThrow({where:{id:sessionId,guildId:ids.guildId}});const result=await db.session.updateMany({where:{id:session.id,status:'active'},data:{status:'ending',endedAt:new Date(),version:{increment:1}}});if(!result.count)throw Error('Session is already ending or ended');
  const compat=g.sessions.find((s:any)=>s.id===session.id);if(compat){compat.end=Date.now();compat.reason=pending.reason;}delete g.records[`ssd-confirm:${sessionId}:${i.user.id}`];this.service.store.save();await this.flush();
  await db.session.update({where:{id:session.id},data:{status:'ended',endedAt:new Date(),reason:pending.reason,activeKey:null}});await audit(i.user.id,'session.stop',session.id,{status:session.status},{status:'ended',reason:pending.reason});
  const channel=await this.channel();await channel.send(render(this.service.template(g,'ssd'),this.service.variables(g)));try{if(session.messageId)await(await channel.messages.fetch(session.messageId)).edit(render(this.service.template(g,'ssd'),this.service.variables(g)));}catch{await audit(i.user.id,'session.shutdown-refresh-failed',session.id,null,{});}
  await editReply(i,notice('Session concluded',`Shutdown posted in <#${ids.channels.sessions}>. Attendance is saved.`));changed();return true;
 }
}
