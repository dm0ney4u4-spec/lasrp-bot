import {rankRoles}from'./staff-roles.js';
import { ActionRowBuilder,ModalBuilder,TextInputBuilder,TextInputStyle,PermissionFlagsBits,type Client,type Interaction,type GuildMember } from 'discord.js';
import type { Application } from '@prisma/client';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { ids } from '../../../config/ids.js';
import { questions as defaultQuestions } from '../../../packages/shared/src/schemas.js';
import { groupsFor,allowed,type Principal } from '../../../packages/shared/src/permissions.js';
import { render,button,notice } from './panels.js';
import { editReply } from './replies.js';
import type { CommunityService } from './service.js';

type Interactive=Extract<Interaction,{customId:string}>;
const number=(a:Application)=>`LASRP-APP-${String(a.number).padStart(6,'0')}`;
const activeStatuses=['intro','draft','paused','more_info','interview','submitted','submitting'];
export class Applications {
 constructor(private client:Client,private service:CommunityService){}
 settings(){return this.service.store.guild(ids.guildId).config.applicationSettings??{open:ids.settings.applicationOpen,requirements:ids.settings.applicationRequirements,cooldownHours:ids.settings.applicationCooldownHours,questions:defaultQuestions};}
 async principal(userId:string):Promise<Principal>{const member=await(await this.client.guilds.fetch(ids.guildId)).members.fetch({user:userId,force:true});return {id:userId,name:member.displayName,roles:[...member.roles.cache.keys()],groups:groupsFor(userId,[...member.roles.cache.keys()],this.service.store.guild(ids.guildId).config.rbacRoles??{})};}
 async start(userId:string,deliver=true){
  if(!ids.featureFlags.applications)throw Error('Applications are disabled.');
  const settings=this.settings();if(!settings.open)throw Error('Staff applications are currently closed.');
   const principal=await this.principal(userId);
  if(ids.roles.verified&&!principal.roles.includes(ids.roles.verified)&&!allowed(principal,'owner'))throw Error('Complete community verification before applying.');
  const existing=await db.application.findUnique({where:{activeKey:`${ids.guildId}:${userId}`}});
  if(existing){if(deliver)await this.send(existing);return existing;}
  const previous=await db.application.findFirst({where:{guildId:ids.guildId,applicantId:userId},orderBy:{createdAt:'desc'}});
  if(previous&&Date.now()-previous.createdAt.getTime()<(settings.cooldownHours??168)*3600000)throw Error('Your configured application cooldown has not ended.');
  const questions:string[]=settings.questions??defaultQuestions;
  const app=await db.application.create({data:{guildId:ids.guildId,applicantId:userId,activeKey:`${ids.guildId}:${userId}`,questions}});
  await audit(userId,'application.begin',app.id,null,{status:app.status});
  try{if(deliver)await this.send(app);}catch{await db.application.update({where:{id:app.id},data:{dmFailed:true}});throw Error('Your DMs are closed. Enable server DMs and click Apply via DM in the applications channel again.');}
  changed();return app;
 }
 card(app:Application,page=app.step){
  const questions=app.questions as string[],answers=app.answers as string[];
  const sections=[`**Application:** ${number(app)}\n**Status:** ${app.status}\n**Requirements:** ${this.settings().requirements}`];
  let buttons:ReturnType<typeof button>[]=[];
  if(app.status==='intro'){
   sections.push('Your answers are private and saved after every step. Use fictional roleplay context where relevant; never provide passwords, exact birthdates, or other sensitive personal information.');
   buttons=[button('Begin Application','dm',`begin,${app.id}`,1),button('Cancel','dm',`cancel,${app.id}`)];
  }else if(['draft','paused'].includes(app.status)){
   sections.push('Complete each question in order. Each submitted answer is final. There is no pause, previous-question, or edit option.');
   if(app.step>=questions.length){sections.push('All answers are final. Submit your application to the review team.');buttons=[button('Submit Application','dm',`submit,${app.id}`,1)];}
   else{sections.push(`### Question ${app.step+1} of ${questions.length}`,questions[app.step]);buttons=[button('Answer','dm',`answer,${app.id},${app.version},${app.step}`,1)];}
  }else{sections.push('Your application is saved. Check status here or from the community application panel.');if(app.decisionReason)sections.push(`**Review response:** ${app.decisionReason}`);if(app.status==='more_info')buttons.push(button('Provide Clarification','dm',`followup,${app.id}`));}
  return render({key:'applications',title:'LASRP | STAFF APPLICATION',color:'blue',sections,buttons},{community:ids.settings.community});
 }
 async send(app:Application){const user=await this.client.users.fetch(app.applicantId);return user.send(this.card(app));}
 async update(app:Application,data:Record<string,unknown>,actor:string,action:string){
  if(Array.isArray(data.answers)){const previous=app.answers as string[],next=data.answers as string[];if(previous.some((answer,index)=>next[index]!==answer)||next.length<previous.length)throw Error('Submitted answers cannot be changed.');}
  const next=await db.$transaction(async tx=>{const updated=await tx.application.updateMany({where:{id:app.id,version:app.version,status:app.status},data:{...data,version:{increment:1}}});if(!updated.count)throw Error('Application changed. Resume or reopen it before continuing.');const next=await tx.application.findUniqueOrThrow({where:{id:app.id}});await audit(actor,action,app.id,{status:app.status,step:app.step},{status:next.status,step:next.step},tx);return next;});changed();return next;
 }
 async interaction(i:Interaction):Promise<boolean>{
  if(!('customId'in i))return false;
  if(i.isModalSubmit()&&i.customId.startsWith('ls:appAnswer:')){
   const [appId,version,step]=i.customId.slice('ls:appAnswer:'.length).split(',');const app=await db.application.findUniqueOrThrow({where:{id:appId}});if(app.version!==Number(version)||app.step!==Number(step))throw Error('This question has already been answered or replaced. Use the latest question.');this.own(app,i.user.id);if(!['draft','paused'].includes(app.status))throw Error('Application is no longer editable');
   const answers=app.answers as string[],questions=app.questions as string[];if(app.step>=questions.length)throw Error('No active question');
   answers[app.step]=i.fields.getTextInputValue('answer');const next=await this.update(app,{answers,step:app.step+1,status:'draft'},i.user.id,'application.answer');await i.reply(this.card(next));return true;
  }
  if(i.isModalSubmit()&&i.customId.startsWith('ls:appFollow:')){
   const app=await db.application.findUniqueOrThrow({where:{id:i.customId.slice('ls:appFollow:'.length)}});this.own(app,i.user.id);if(app.status!=='more_info')throw Error('No clarification is currently requested');
   const history=app.history as object[];const next=await this.update(app,{status:'submitted',history:[...history,{type:'applicant-clarification',text:i.fields.getTextInputValue('answer'),at:new Date().toISOString()}]},i.user.id,'application.clarification');await i.reply(notice('Clarification saved','The review team can see your response.'));await this.refreshReview(next);return true;
  }
  if(i.isModalSubmit()&&i.customId.startsWith('ls:appDecision:')){
   const [action,appId,version]=i.customId.slice('ls:appDecision:'.length).split(',');const app=await db.application.findUniqueOrThrow({where:{id:appId}});if(app.version!==Number(version))throw Error('Another reviewer changed this application. Refresh first.');
   await i.deferReply({flags:64});const next=await this.review(app,i.user.id,action,i.fields.getTextInputValue('reason'));await editReply(i,notice('Application updated',`${number(next)}: ${next.status}. ${next.dmFailed?'DM delivery failed and was recorded.':''}`));return true;
  }
  if(!i.isButton())return false;
  if(i.customId.startsWith('ls:appPage:')){await i.deferUpdate();const [appId,page]=i.customId.slice('ls:appPage:'.length).split(',');const app=await db.application.findUniqueOrThrow({where:{id:appId}});const principal=await this.principal(i.user.id);if(!allowed(principal,'reviewer')||app.guildId!==ids.guildId||i.channelId!==app.reviewChannelId||i.message.id!==app.reviewMessageId)throw Error('Application reviewer access required');await i.editReply(this.reviewCard(app,Number(page)));return true;}

  if(i.customId.startsWith('ls:dm:')){
   const [action,appId,pageString,stepString]=i.customId.slice('ls:dm:'.length).split(',');const app=await db.application.findUniqueOrThrow({where:{id:appId}});this.own(app,i.user.id);
   if(action==='followup'){if(app.status!=='more_info')throw Error('No clarification requested');await i.showModal(this.answerModal(`ls:appFollow:${app.id}`,'Requested clarification'));return true;}
   if(['pause','previous','continue','resume','review'].includes(action))throw Error('Applications cannot be paused or edited. Use your latest DM question.');
   if(action==='answer'){
    if(!['draft','paused'].includes(app.status)||app.step>=(app.questions as string[]).length)throw Error('This application has no editable question');
    if(app.version!==Number(pageString)||app.step!==Number(stepString)||(app.answers as string[])[app.step])throw Error('Use the latest unanswered question. Submitted answers cannot be changed.');await i.showModal(this.answerModal(`ls:appAnswer:${app.id},${app.version},${app.step}`,`Question ${app.step+1}`));return true;
   }
   if(action==='submit'){
    if(!['draft','paused'].includes(app.status)||(app.answers as string[]).length!==(app.questions as string[]).length||(app.answers as string[]).some(x=>!x?.trim()))throw Error('Complete all questions before submitting');
    await i.deferReply();const next=await this.update(app,{status:'submitting'},i.user.id,'application.submit');
    try{await this.publishReview(next);const submitted=await this.update(next,{status:'submitted'},i.user.id,'application.submitted');await editReply(i,this.card(submitted));}
    catch(error){await this.update(next,{status:'draft'},i.user.id,'application.submit-failed');throw error;}
    return true;
   }
   if(!['intro','draft','paused'].includes(app.status))throw Error('Application is already under review or closed');
   let data:Record<string,unknown>;
   if(action==='begin')data={status:'draft'};

   else if(action==='cancel'&&app.status==='intro')data={status:'cancelled',activeKey:null};


   else throw Error('Unknown application action');
   const next=await this.update(app,data,i.user.id,`application.${action}`);await i.reply(this.card(next));return true;
  }
  if(i.customId.startsWith('ls:appReview:')){
   const [action,appId,pageString]=i.customId.slice('ls:appReview:'.length).split(',');const app=await db.application.findUniqueOrThrow({where:{id:appId}});const modalAction=['accept','deny','interview','more_info','note'].includes(action),memberRoles=i.member?.roles,roles=Array.isArray(memberRoles)?memberRoles:memberRoles?[...memberRoles.cache.keys()]:[];const principal=modalAction?{id:i.user.id,name:i.user.username,roles,groups:groupsFor(i.user.id,roles,this.service.store.guild(ids.guildId).config.rbacRoles??{})}:await this.principal(i.user.id);if(!allowed(principal,'reviewer'))throw Error('Application reviewer access required');
   if(app.applicantId===i.user.id)throw Error('You cannot review your own application');
   if(action==='view'){
    const page=Number(pageString??0),questions=app.questions as string[],answers=app.answers as string[];if(!Number.isInteger(page)||page<0||page>=questions.length)throw Error('Unknown answer');
    const buttons=[];if(page>0)buttons.push(button('Previous','appReview',`view,${app.id},${page-1}`));if(page+1<questions.length)buttons.push(button('Next','appReview',`view,${app.id},${page+1}`));
    await i.reply(render({key:'applications',title:`${number(app)} | ANSWER ${page+1}`,color:'blue',sections:[questions[page],answers[page]??'No response'],buttons},{community:ids.settings.community},{ephemeral:true}));return true;
   }
   if(action==='history'){await i.reply(notice('Private application history',JSON.stringify({history:app.history,notes:app.privateNotes},null,2).slice(-2800)));return true;}
   if(action==='claim'){if(app.reviewerId&&app.reviewerId!==i.user.id)throw Error('Already claimed by another reviewer');const next=await this.update(app,{reviewerId:i.user.id},i.user.id,'application.claim');await i.reply(notice('Application claimed',`${number(app)} is assigned to you.`));await this.refreshReview(next);return true;}
   if(!['accept','deny','interview','more_info','note'].includes(action))throw Error('Unknown review action');
   await i.showModal(new ModalBuilder().setCustomId(`ls:appDecision:${action},${app.id},${app.version}`).setTitle('LASRP Application Review').addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('reason').setLabel(action==='note'?'Private staff note':'Reason / applicant instructions').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1500))));return true;
  }
  return false;
 }
 own(app:Application,userId:string){if(app.applicantId!==userId||app.guildId!==ids.guildId)throw Error('Application access denied');}
 answerModal(customId:string,title:string,value?:string){const input=new TextInputBuilder().setCustomId('answer').setLabel(title).setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2500);if(value)input.setValue(value);return new ModalBuilder().setCustomId(customId).setTitle('LASRP Staff Application').addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));}
 async review(app:Application,actor:string,action:string,reason:string){
  const principal=await this.principal(actor);if(!allowed(principal,'reviewer'))throw Error('Application reviewer access required');if(actor===app.applicantId)throw Error('You cannot review your own application');
  if(action==='accept'&&!allowed(principal,'management'))throw Error('Management must approve acceptance');
  if(!['submitted','interview','more_info'].includes(app.status))throw Error('Application is not pending');
  const at=new Date().toISOString(),history=app.history as object[];
  if(action==='note'){const notes=app.privateNotes as object[];return this.update(app,{privateNotes:[...notes,{actor,text:reason,at}]},actor,'application.note');}
  const status:Record<string,string>={accept:'accepted',deny:'denied',interview:'interview',more_info:'more_info'};if(!status[action])throw Error('Invalid decision');
  const next=await this.update(app,{status:status[action],decisionReason:reason,reviewerId:actor,history:[...history,{actor,action,reason,at}],...(['accept','deny'].includes(action)?{activeKey:null}:{})},actor,`application.${action}`);
  if(action==='accept'&&ids.roles.trainee){try{const guild=await this.client.guilds.fetch(ids.guildId),member=await guild.members.fetch(next.applicantId),roles=await Promise.all(rankRoles(ids.roles.trainee).map(id=>guild.roles.fetch(id)));if(roles.some(role=>!role||role.managed||role.permissions.bitfield!==0n))throw Error('Unsafe trainee role');await member.roles.add(roles.map(role=>role!.id));await audit(actor,'application.trainee-role',app.id,null,{roles:roles.map(role=>role!.id)});}catch{await audit(actor,'application.role-delivery-failed',app.id,null,{reason:'Check trainee and Staff Team roles, hierarchy and member presence'});}}
  try{await this.send(next);}catch{await db.application.update({where:{id:app.id},data:{dmFailed:true}});next.dmFailed=true;}
  await this.refreshReview(next);
  if(ids.channels.applicationLogs){try{const guild=await this.client.guilds.fetch(ids.guildId),g=this.service.store.guild(ids.guildId);const channel=await this.service.restrictedChannel(guild,{...g,config:{...g.config,applicationReviewChannel:ids.channels.applicationLogs}},'applicationReviewChannel','management');await channel.send(notice('Application decision',`${number(next)}: ${next.status}\n**Reviewer:** <@${actor}>`, 'blue',false));}catch{console.error('Application outcome log delivery failed.');}}
  return next;
 }
 reviewPages(app:Application){const pages:string[][]=[[]];let length=0;for(let index=0;index<(app.questions as string[]).length;index++){const text=`**Question ${index+1}:** ${(app.questions as string[])[index]}\n${(app.answers as string[])[index]??'No response'}`;if(length+text.length>2850&&pages.at(-1)!.length){pages.push([]);length=0;}pages.at(-1)!.push(text);length+=text.length;}return pages;}
 reviewCard(app:Application,page=0){const pages=this.reviewPages(app);if(!Number.isInteger(page)||page<0||page>=pages.length)throw Error('Unknown application review page');const buttons=[];if(page>0)buttons.push(button('Previous Answers','appPage',`${app.id},${page-1}`));if(page+1<pages.length)buttons.push(button('Next Answers','appPage',`${app.id},${page+1}`));if(['submitted','interview','more_info'].includes(app.status))buttons.push(button('Accept','appReview',`accept,${app.id}`,1),button('Deny','appReview',`deny,${app.id}`));return render({key:'applications',title:`${number(app)} | PRIVATE REVIEW`,color:'blue',sections:[`**Applicant:** <@${app.applicantId}>\n**Status:** ${app.status}\n**Answers:** ${(app.answers as string[]).length} | Page ${page+1}/${pages.length}`,...pages[page]],buttons},{community:ids.settings.community});}
 async publishReview(app:Application){
  if(!ids.channels.applicationReviews)throw Error('Configure channels.applicationReviews before opening recruitment.');
  const guild=await this.client.guilds.fetch(ids.guildId),g=this.service.store.guild(ids.guildId);const reviewerRoles=[...g.config.managementRoles,ids.roles.applicationReviewer].filter(Boolean);
  const channel=await this.service.restrictedChannel(guild,{...g,config:{...g.config,managementRoles:reviewerRoles,applicationReviewChannel:ids.channels.applicationReviews}},'applicationReviewChannel','management');
  const message=await channel.send(this.reviewCard({...app,status:'submitted'}));await db.application.update({where:{id:app.id},data:{reviewChannelId:channel.id,reviewMessageId:message.id}});
 }
 async refreshReview(app:Application){
  const current=await db.application.findUniqueOrThrow({where:{id:app.id}});if(!current.reviewChannelId||!current.reviewMessageId)return false;
  try{const channel=await this.client.channels.fetch(current.reviewChannelId);if(channel?.isTextBased()&&'messages'in channel){await(await channel.messages.fetch(current.reviewMessageId)).edit(this.reviewCard(current));return true;}return false;}catch{console.error('Application review card update failed.');return false;}
 }
 async compactExistingReviews(){const apps=await db.application.findMany({where:{guildId:ids.guildId,reviewMessageId:{not:null}}});if(!apps.length)return;const compacted:Application[]=[];for(const app of apps)if(await this.refreshReview(app))compacted.push(app);const references=new Set(compacted.map(number));if(!references.size)return;let removed=0;const channel=await this.client.channels.fetch(ids.channels.applicationReviews);if(!channel?.isTextBased()||!('messages'in channel))return;let before:string|undefined;for(;;){const messages=await channel.messages.fetch({limit:100,...(before?{before}:{})});if(!messages.size)break;for(const message of messages.values()){if(message.author.id!==this.client.user!.id)continue;const container=message.components[0]?.toJSON() as any,heading=String(container?.components?.[0]?.components?.[0]?.content??'');if(!apps.some(app=>app.reviewMessageId===message.id)&&[...references].some(reference=>heading.includes(reference+' | ANSWER '))){await message.delete();removed++;}}before=messages.last()!.id;if(messages.size<100)break;}console.log(`Application reviews consolidated: ${compacted.length}; separate answer messages removed: ${removed}.`); }
 async expire(){await db.application.updateMany({where:{status:{in:['intro','draft','paused']},updatedAt:{lt:new Date(Date.now()-ids.settings.applicationExpiryHours*3600000)}},data:{status:'expired',activeKey:null,version:{increment:1}}});}
 async recover(){const pending=await db.application.findMany({where:{status:'submitting',updatedAt:{lt:new Date(Date.now()-300000)}}});for(const app of pending)await this.update(app,{status:app.reviewMessageId?'submitted':'draft'},'system','application.recover-submission');}
}
