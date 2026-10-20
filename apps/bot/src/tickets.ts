import { ActionRowBuilder,ModalBuilder,TextInputBuilder,TextInputStyle,ChannelType,PermissionFlagsBits,type Client,type Interaction,type GuildMember } from 'discord.js';
import { ids } from '../../../config/ids.js';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { groupsFor,allowed,type Principal } from '../../../packages/shared/src/permissions.js';
import { render,button,notice } from './panels.js';
import { editReply } from './replies.js';
import type { CommunityService } from './service.js';
import { seeds } from './seeds.js';
type Ticket={id:string;user:string;channel:string;category:number;accusedId?:string;status:string;assignee?:string;request:string;priority:string;created:number;message?:string;members:string[];closedReason?:string;closedAt?:number};
export const categories=['General Support','Player Report','Staff Complaint','Ban Appeal','Bug / Technical Issue','Partnership','Department Request','Other'];
export class Tickets {
 private locks=new Set<string>();
 constructor(private client:Client,private service:CommunityService){seeds.support.select={action:'ticket',options:categories.map((label,index)=>({label,value:String(index)}))};}
 private principal(member:GuildMember):Principal{return {id:member.id,name:member.displayName,roles:[...member.roles.cache.keys()],groups:groupsFor(member.id,[...member.roles.cache.keys()],this.service.store.guild(member.guild.id).config.rbacRoles??{})};}
 private form(customId:string,title:string,fields:{id:string;label:string;required?:boolean}[]){return new ModalBuilder().setCustomId(customId).setTitle(title).addComponents(...fields.map(f=>new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId(f.id).setLabel(f.label).setStyle(TextInputStyle.Paragraph).setRequired(f.required!==false).setMaxLength(f.id==='accused'||f.id==='member'?20:1500))));}
 card(t:Ticket){return render({key:'support',title:`LASRP SUPPORT | ${t.id}`,color:'blue',sections:[`**Category:** ${categories[t.category]}\n**Opened by:** <@${t.user}>\n**Assigned:** ${t.assignee?`<@${t.assignee}>`:'Unclaimed'}\n**Status:** ${t.status}\n**Priority:** ${t.priority}`,t.request,...(t.closedReason?[`**Closure reason:** ${t.closedReason}`]:[])],buttons:(t.status==='closed'?['reopen','transcript']:['claim','add','remove','escalate','priority','close','resolve']).map(a=>button(a[0].toUpperCase()+a.slice(1),'ticketV2',`${a},${t.id}`))},{community:ids.settings.community});}
 async interaction(i:Interaction):Promise<boolean>{
  if(!('customId'in i))return false;
  if((i.isButton()||i.isStringSelectMenu())&&i.customId.startsWith('ls:ticket:')){
   if(!ids.featureFlags.tickets)throw Error('Tickets are disabled');
   const category=Number(i.isStringSelectMenu()?i.values[0]:i.customId.slice('ls:ticket:'.length));if(!categories[category])throw Error('Unknown support category');
   await i.showModal(this.form(`ls:ticketCreate:${category}`,'LASRP Support Request',[{id:'summary',label:category===2?'Describe the staff complaint':'How can we help?'},{id:'evidence',label:'Evidence links / details / case ID',required:false},...(category===2?[{id:'accused',label:'Accused staff Discord user ID'}]:[])]));return true;
  }
  if(i.isModalSubmit()&&i.customId.startsWith('ls:ticketCreate:')){
   if(!i.guild)throw Error('Open tickets from the LASRP server');const category=Number(i.customId.slice('ls:ticketCreate:'.length));if(!categories[category])throw Error('Unknown ticket category');
   const g=this.service.store.guild(i.guild.id);if(g.config.ticketBlacklist?.includes(i.user.id))throw Error('Ticket access is restricted. Contact an owner for review.');
   if(this.locks.has(i.user.id)||Object.values(g.tickets).some((t:any)=>t.user===i.user.id&&t.status!=='closed'))throw Error('You already have an open support ticket');
   const last=Math.max(0,...Object.values(g.tickets).filter((t:any)=>t.user===i.user.id).map((t:any)=>t.created));if(Date.now()-last<ids.settings.ticketCooldownSeconds*1000)throw Error('Please wait before opening another ticket');
   this.locks.add(i.user.id);try{
    const accused=category===2?i.fields.getTextInputValue('accused').trim():undefined;
    if(accused&&!/^\d{17,20}$/.test(accused))throw Error('Provide the accused member’s Discord user ID');
    if(accused){const accusedMember=await i.guild.members.fetch(accused).catch(()=>null);if(accusedMember?.permissions.has(PermissionFlagsBits.Administrator))throw Error('Discord administrators can see all channels. Send this sensitive complaint directly to a configured community owner instead.');}
    const restricted=[2,3].includes(category),management=[...g.config.managementRoles],support=ids.roles.ticketSupport;
    if(!management.length)throw Error('Configure management roles before opening tickets');
    await i.deferReply({flags:64});
    const ticketId='LASRP-TKT-'+Date.now().toString(36).toUpperCase();
    const channel=await i.guild.channels.create({name:'ticket-'+ticketId.slice(-8).toLowerCase(),type:ChannelType.GuildText,parent:g.config.ticketCategory||undefined,permissionOverwrites:[{id:i.guild.id,deny:[PermissionFlagsBits.ViewChannel]},{id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},{id:this.client.user!.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]},...management.map((id:string)=>({id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]})),...(!restricted&&support?[{id:support,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]}]:[]),...(accused&&accused!==i.user.id?[{id:accused,deny:[PermissionFlagsBits.ViewChannel]}]:[])]});
    const t:Ticket={id:ticketId,user:i.user.id,channel:channel.id,category,accusedId:accused,status:'created',priority:'normal',request:[i.fields.getTextInputValue('summary'),i.fields.getTextInputValue('evidence')].filter(Boolean).join('\n\n'),created:Date.now(),members:[]};
    g.tickets[t.id]=t;this.service.store.change(i.guild.id,i.user.id,'ticket.create',t);await this.flush();const message=await channel.send(this.card(t));t.message=message.id;this.service.store.save();await this.flush();await audit(i.user.id,'ticket.create',t.id,null,{channel:channel.id,category});await editReply(i,notice('Private ticket created',`Your support request is ready: <#${channel.id}>`));changed();return true;
   }finally{this.locks.delete(i.user.id);}
  }
  if(i.isButton()&&i.customId.startsWith('ls:ticketV2:')){
   if(!i.guild)throw Error('Use this in the ticket channel');const [action,ticketId]=i.customId.slice('ls:ticketV2:'.length).split(',');const g=this.service.store.guild(i.guild.id),t=g.tickets[ticketId] as Ticket;if(!t||t.channel!==i.channelId)throw Error('Ticket not found in this channel');
   const member=await i.guild.members.fetch(i.user.id),p=this.principal(member);this.authorize(t,p,action);
   if(['close','resolve','add','remove','priority'].includes(action)){await i.showModal(this.form(`ls:ticketChange:${action},${ticketId}`,'LASRP Ticket Update',[{id:action==='add'||action==='remove'?'member':'reason',label:action==='add'||action==='remove'?'Discord user ID':action==='priority'?'Priority: low, normal, high, urgent':'Resolution / closure reason'}]));return true;}
   if(action==='transcript'){await i.reply(notice('Private transcript',`[Download your private transcript](${process.env.WEB_BASE_URL??'http://localhost:3000'}/api/transcripts/${t.id})\nSign in with Discord. Access is checked before download.`));return true;}
   await i.deferReply({flags:64});await this.change(i.guild.id,t,action,member,'');await editReply(i,notice('Ticket updated',`**${t.id}:** ${t.status}`));return true;
  }
  if(i.isModalSubmit()&&i.customId.startsWith('ls:ticketChange:')){
   if(!i.guild)throw Error('Ticket server required');const [action,ticketId]=i.customId.slice('ls:ticketChange:'.length).split(',');const t=this.service.store.guild(i.guild.id).tickets[ticketId] as Ticket;if(!t||t.channel!==i.channelId)throw Error('Ticket channel mismatch');
   const member=await i.guild.members.fetch(i.user.id);this.authorize(t,this.principal(member),action);await i.deferReply({flags:64});await this.change(i.guild.id,t,action,member,i.fields.getTextInputValue(action==='add'||action==='remove'?'member':'reason'));await editReply(i,notice('Ticket updated',`${t.id}: ${t.status}`));return true;
  }
  return false;
 }
 authorize(t:Ticket,p:Principal,action:string){if(p.id===t.accusedId)throw Error('You cannot access a complaint involving you');const management=allowed(p,'management'),support=allowed(p,'support')&&![2,3].includes(t.category);if(!management&&!support&&!(p.id===t.user&&['close','reopen','transcript'].includes(action)))throw Error('Ticket access denied');if(t.assignee&&t.assignee!==p.id&&!management&&p.id!==t.user)throw Error('This ticket is assigned to another staff member');}
 async change(guildId:string,t:Ticket,action:string,member:GuildMember,value:string){
  if(this.locks.has(t.id))throw Error('Another ticket update is in progress');this.locks.add(t.id);
  try{
   const channel=await member.guild.channels.fetch(t.channel);if(!channel||channel.type!==ChannelType.GuildText)throw Error('Ticket channel missing');
   if(action==='claim'){
    if(t.assignee&&t.assignee!==member.id)throw Error('Already claimed by another member');
    if(ids.roles.ticketSupport)await channel.permissionOverwrites.edit(ids.roles.ticketSupport,{ViewChannel:false});
    await channel.permissionOverwrites.edit(member.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});t.assignee=member.id;t.status='claimed';
   }else if(action==='add'||action==='remove'){
    const p=this.principal(member);if(!allowed(p,'management')&&t.assignee!==member.id)throw Error('Only assigned staff or management can change access');
    if(!/^\d{17,20}$/.test(value.trim())||[t.user,t.accusedId,this.client.user!.id].includes(value.trim()))throw Error('Cannot modify this ticket participant');
    const target=await member.guild.members.fetch(value.trim());if([2,3].includes(t.category)&&!allowed(this.principal(target),'management'))throw Error('Staff complaints and appeals require management-only participants');
    if(action==='add'){await channel.permissionOverwrites.edit(target.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});t.members=[...new Set([...t.members,target.id])];}else{await channel.permissionOverwrites.edit(target.id,{ViewChannel:false});t.members=t.members.filter(x=>x!==target.id);}
   }else if(action==='priority'){if(!['low','normal','high','urgent'].includes(value.trim().toLowerCase()))throw Error('Use low, normal, high, or urgent');t.priority=value.trim().toLowerCase();}
   else if(action==='escalate'){
    if(ids.roles.ticketSupport)await channel.permissionOverwrites.edit(ids.roles.ticketSupport,{ViewChannel:false});
    if(t.assignee&&!allowed(this.principal(await member.guild.members.fetch(t.assignee)),'management'))await channel.permissionOverwrites.edit(t.assignee,{ViewChannel:false});t.assignee=undefined;t.status='escalated';
   }else if(action==='close'||action==='resolve'){
    if(t.status==='closed')throw Error('Ticket already closed');if(!value.trim())throw Error('Closure reason is required');
    const messages:string[]=[];let before:string|undefined;
    for(let count=0;count<50;count++){const batch=await channel.messages.fetch({limit:100,...(before?{before}:{})});if(!batch.size)break;for(const m of batch.values())messages.push(`[${m.createdAt.toISOString()}] ${m.author.tag} (${m.author.id}): ${m.content}${m.attachments.size?'\nAttachments: '+m.attachments.map(a=>a.url).join(', '):''}${m.components.length?'\n[V2 system panel]':''}`);before=batch.last()!.id;if(batch.size<100)break;}
    await db.ticketTranscript.upsert({where:{id:t.id},create:{id:t.id,guildId,openerId:t.user,staffIds:[...(t.assignee?[t.assignee]:[]),...t.members],text:`LASRP PRIVATE TRANSCRIPT\nTicket: ${t.id}\nCategory: ${categories[t.category]}\nRequest:\n${t.request}\nClosure: ${value}\nCapture: up to 5,000 accessible messages\n\n`+messages.reverse().join('\n\n'),expiresAt:new Date(Date.now()+ids.settings.transcriptRetentionDays*86400000)},update:{text:`LASRP PRIVATE TRANSCRIPT\n${t.id}\n${t.request}\nClosure: ${value}\n\n`+messages.reverse().join('\n\n'),expiresAt:new Date(Date.now()+ids.settings.transcriptRetentionDays*86400000)}});
    await channel.permissionOverwrites.edit(t.user,{SendMessages:false});t.status='closed';t.closedReason=value;t.closedAt=Date.now();
    try{await(await this.client.users.fetch(t.user)).send(notice('Support ticket closed',`**${t.id}**\n**Reason:** ${value}\n[Private transcript](${process.env.WEB_BASE_URL??'http://localhost:3000'}/api/transcripts/${t.id})`,'blue',false));}catch{await audit(member.id,'ticket.dm-failed',t.id,null,{});}
   }else if(action==='reopen'){if(t.status!=='closed')throw Error('Ticket is already open');await channel.permissionOverwrites.edit(t.user,{SendMessages:true});t.status='reopened';t.closedReason=undefined;}
   else throw Error('Unknown ticket action');
   this.service.store.change(guildId,member.id,`ticket.${action}`,t);await this.flush();await audit(member.id,`ticket.${action}`,t.id,null,{status:t.status,value});if(t.message)await(await channel.messages.fetch(t.message)).edit(this.card(t));changed();
  }finally{this.locks.delete(t.id);}
 }
 async flush(){await (this.service.store as unknown as {flush():Promise<void>}).flush();}
}
