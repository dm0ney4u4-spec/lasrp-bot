import {z} from 'zod';
import type {Express} from 'express';
import {Prisma,type PrismaClient} from '@prisma/client';
import {db,changed} from '../../../packages/shared/src/database.js';
import {ids} from '../../../config/ids.js';
import {cadAccessConfig} from '../../../config/cad-access.js';
import {websiteAdmin,websiteOwner,cadReviewer,cadRevoker,memberCapabilities} from '../../../packages/shared/src/website-permissions.js';
import type {Principal} from '../../../packages/shared/src/permissions.js';
import {cadAdmission} from './cad-admission.js';
import {authOrigins} from './auth.js';
const fail=(message:string,status=409)=>Object.assign(Error(message),{status});
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const cadSettingsSchema=z.object({open:z.boolean(),allowDeniedReapply:z.boolean(),allowRevokedReapply:z.boolean(),cooldownHours:z.number().int().min(0).max(8760),rulesVersion:z.string().trim().min(1).max(30),rules:z.string().trim().min(20).max(3000),questions:z.array(z.object({id:z.string().regex(/^[a-z][a-z0-9_]{0,39}$/).refine(id=>id!=='agreement','Reserved question ID'),label:z.string().trim().min(10).max(400).refine(label=>!/password|passcode|api.?key|access.?token/i.test(label),'Application questions must not request credentials'),minLength:z.number().int().min(1).max(1000)}).strict()).min(1).max(15).refine(v=>new Set(v.map(q=>q.id)).size===v.length,'Question IDs must be unique')}).strict();
const submission=z.object({robloxUsername:z.string().trim().regex(/^[a-zA-Z0-9_]{3,20}$/),requestedRole:z.enum(['civilian','police','sheriff','fire','ems','dot','dispatch']),answers:z.record(z.string().trim().max(2000)),agreement:z.literal(true),rulesVersion:z.string(),settingsVersion:z.number().int().nonnegative()}).strict();
const decision=z.object({version:z.number().int().positive(),action:z.enum(['approve','deny','more_info','revoke']),reason:z.string().trim().min(5).max(1500)}).strict();
export class CadAccessService {
 constructor(public database:PrismaClient=db){}
 async settings(){const row=await this.database.cadAccessSettings.findUnique({where:{guildId:ids.guildId}});return {value:cadSettingsSchema.parse(row?.value??cadAccessConfig.defaults),version:row?.version??0};}
 async current(userId:string){return this.database.cadAdmission.findUnique({where:{guildId_userId:{guildId:ids.guildId,userId}},include:{application:{include:{history:{orderBy:{createdAt:'asc'}}}}}});}
 async transaction<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>){try{return await this.database.$transaction(fn,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:15000});}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002'].includes(error.code))throw fail('This application changed or another request completed. Refresh before trying again.');throw error;}}
 async canApply(userId:string){const {value}=await this.settings(),current=await this.current(userId),status=current?.status??'not_applied';let reason:string|null=null;
  if(!value.open)reason='CAD applications are currently closed.';
  else if(['pending','more_info','approved'].includes(status))reason='You already have an active CAD application or approval.';
  else if(status==='denied'&&!value.allowDeniedReapply||status==='revoked'&&!value.allowRevokedReapply)reason='Reapplication is not enabled for this decision. Contact an administrator.';
  else if(['denied','revoked'].includes(status)&&current&&Date.now()-current.updatedAt.getTime()<value.cooldownHours*3600000)reason='Your configured reapplication cooldown has not ended.';
  return {allowed:reason===null,reason};
 }
 async submit(user:Principal,input:unknown){const body=submission.parse(input),{value:settings,version:settingsVersion}=await this.settings();if(body.settingsVersion!==settingsVersion||body.rulesVersion!==settings.rulesVersion)throw fail('The application questions or rules changed. Refresh and review them before submitting.');if(!settings.open)throw fail('CAD applications are closed.',403);
  if(Object.keys(body.answers).length!==settings.questions.length||settings.questions.some(q=>!body.answers[q.id]||body.answers[q.id].length<q.minLength)||Object.keys(body.answers).some(key=>!settings.questions.some(q=>q.id===key)))throw fail('Answer every configured question with the required detail.',400);
  const row=await this.transaction(async tx=>{
   const liveSettings=await tx.cadAccessSettings.findUnique({where:{guildId:ids.guildId}});if((liveSettings?.version??0)!==settingsVersion)throw fail('Application settings changed. Refresh before submitting.');
   const key={guildId:ids.guildId,userId:user.id};const current=await tx.cadAdmission.upsert({where:{guildId_userId:key},create:key,update:{}});
   if(['pending','more_info','approved'].includes(current.status))throw fail('An active CAD application or approval already exists.');
   if(current.status==='denied'&&!settings.allowDeniedReapply||current.status==='revoked'&&!settings.allowRevokedReapply)throw fail('Reapplication is not enabled.',403);
   if(['denied','revoked'].includes(current.status)&&Date.now()-current.updatedAt.getTime()<settings.cooldownHours*3600000)throw fail('The reapplication cooldown has not ended.');
   const application=await tx.cadAccessApplication.create({data:{...key,discordName:user.name,robloxUsername:body.robloxUsername,requestedRole:body.requestedRole,questions:json(settings.questions),answers:body.answers,rulesVersion:settings.rulesVersion}});
   const updated=await tx.cadAdmission.updateMany({where:{...key,version:current.version},data:{status:'pending',applicationId:application.id,version:{increment:1}}});if(!updated.count)throw fail('Admission changed. Refresh first.');
   await tx.cadAccessAudit.create({data:{applicationId:application.id,actorId:user.id,action:'submit',fromStatus:current.status,toStatus:'pending',reason:'Applicant submitted CAD access request.',detail:json({agreement:true,rulesVersion:settings.rulesVersion,rules:settings.rules})}});
   await tx.notification.create({data:{userId:user.id,kind:'cad_application',title:'CAD application submitted',body:'Your CAD access request is pending review.',href:'/cad'}});
   await tx.cadAccessDelivery.create({data:{applicationId:application.id,kind:'review',payload:{userId:user.id,status:'pending',reason:'New CAD access application'}}});return application;
  });changed();return row;
 }
 async respond(user:Principal,id:string,input:unknown){const body=z.object({version:z.number().int().positive(),response:z.string().trim().min(10).max(4000)}).strict().parse(input);
  return this.transaction(async tx=>{const row=await tx.cadAccessApplication.findFirst({where:{id,guildId:ids.guildId,userId:user.id}});if(!row)throw fail('Application not found.',404);if(row.status!=='more_info'||row.version!==body.version)throw fail('Only the current more-information request can be answered.');
   if(!(await tx.cadAccessApplication.updateMany({where:{id,version:body.version,status:'more_info'},data:{status:'pending',version:{increment:1}}})).count)throw fail('Application changed.');
   if(!(await tx.cadAdmission.updateMany({where:{guildId:ids.guildId,userId:user.id,applicationId:id,status:'more_info'},data:{status:'pending',version:{increment:1}}})).count)throw fail('Admission changed.');
   await tx.cadAccessAudit.create({data:{applicationId:id,actorId:user.id,action:'respond',fromStatus:'more_info',toStatus:'pending',reason:body.response}});
   await tx.cadAccessDelivery.create({data:{applicationId:id,kind:'review',payload:{userId:user.id,status:'pending',reason:'Applicant supplied requested information'}}});changed();return {ok:true};});
 }
 async review(user:Principal,id:string,input:unknown){const body=decision.parse(input);if(body.action==='revoke'?!cadRevoker(user):!cadReviewer(user))throw fail('CAD reviewer permission required.',403);
  const row=await this.transaction(async tx=>{const before=await tx.cadAccessApplication.findFirst({where:{id,guildId:ids.guildId}});if(!before)throw fail('Application not found.',404);if(before.userId===user.id&&!websiteOwner(user))throw fail('Another authorized reviewer must decide your own request.',403);if(before.version!==body.version)throw fail('Application changed. Refresh before reviewing.');
   const valid=body.action==='revoke'?before.status==='approved':body.action==='more_info'?before.status==='pending':['pending','more_info'].includes(before.status);if(!valid)throw fail('This decision is not valid for the current application status.');
   const status=({approve:'approved',deny:'denied',more_info:'more_info',revoke:'revoked'} as const)[body.action];
   if(!(await tx.cadAccessApplication.updateMany({where:{id,version:body.version,status:before.status},data:{status,version:{increment:1}}})).count)throw fail('Application changed.');
   if(!(await tx.cadAdmission.updateMany({where:{guildId:ids.guildId,userId:before.userId,applicationId:id,status:before.status},data:{status,version:{increment:1}}})).count)throw fail('Admission changed.');
   await tx.cadAccessAudit.create({data:{applicationId:id,actorId:user.id,action:body.action,fromStatus:before.status,toStatus:status,reason:body.reason}});
   await tx.notification.create({data:{userId:before.userId,kind:'cad_decision',title:'CAD access: '+status.replace('_',' '),body:body.reason,href:'/cad'}});
   await tx.cadAccessDelivery.create({data:{applicationId:id,kind:'decision',payload:{userId:before.userId,status,reason:body.reason}}});return {...before,status,version:body.version+1};
  });changed();return row;
 }
}
export function configureCadAccess(app:Express,service=new CadAccessService()){
 app.use('/api/cad-access',(req,res,next)=>{if(!req.principal)return res.status(401).json({error:'Discord login required.'});next();});
 app.get('/api/cad-access',async(req,res)=>{const current=await service.current(req.principal.id),settings=await service.settings(),admission=await cadAdmission(req.principal,service.database);res.json({status:admission.status,admitted:admission.admitted,emergencyBypass:admission.bypass,application:current?.application??null,settings:settings.value,settingsVersion:settings.version,applicationUrl:authOrigins().website+'/cad',reapplication:await service.canApply(req.principal.id),capabilities:memberCapabilities(req.principal),cadUrl:process.env.WEB_BASE_URL??'http://localhost:3000'});});
 app.post('/api/cad-access/applications',async(req,res)=>res.status(201).json(await service.submit(req.principal,req.body)));
 app.post('/api/cad-access/applications/:id/respond',async(req,res)=>res.json(await service.respond(req.principal,String(req.params.id),req.body)));
 app.use('/api/cad-access/review',(req,res,next)=>{if(!cadReviewer(req.principal)&&!cadRevoker(req.principal))return res.status(403).json({error:'CAD reviewer permission required.'});next();});
 app.get('/api/cad-access/review',async(req,res)=>{const status=z.enum(['pending','more_info','approved','denied','revoked','all']).parse(req.query.status??'pending');res.json(await service.database.cadAccessApplication.findMany({where:{guildId:ids.guildId,...(status==='all'?{}:{status})},orderBy:{createdAt:'asc'},take:50,skip:z.coerce.number().int().min(0).max(10000).parse(req.query.page??0)*50,select:{id:true,userId:true,discordName:true,robloxUsername:true,requestedRole:true,status:true,version:true,createdAt:true}}));});
 app.get('/api/cad-access/review/:id',async(req,res)=>{const row=await service.database.cadAccessApplication.findFirst({where:{id:String(req.params.id),guildId:ids.guildId},include:{history:{orderBy:{createdAt:'asc'}},deliveries:{select:{kind:true,status:true,attempts:true,errorCode:true,deliveredAt:true}}}});if(!row)return res.sendStatus(404);res.json(row);});
 app.post('/api/cad-access/review/:id/decision',async(req,res)=>res.json(await service.review(req.principal,String(req.params.id),req.body)));
 app.use('/api/website/administration',(req,res,next)=>{if(!websiteAdmin(req.principal))return res.status(403).json({error:'Website administrator permission required.'});next();});
 app.get('/api/website/administration',async(_req,res)=>res.json({settings:await service.settings(),counts:await service.database.cadAccessApplication.groupBy({by:['status'],where:{guildId:ids.guildId},_count:true}),permissions:{reviewChannelConfigured:Boolean(cadAccessConfig.reviewChannelId),reviewerRoleIds:cadAccessConfig.reviewerRoleIds,revokerRoleIds:cadAccessConfig.revokerRoleIds,websiteAdminRoleIds:cadAccessConfig.websiteAdminRoleIds,ownerEmergencyBypass:cadAccessConfig.ownerEmergencyBypass}}));
 app.put('/api/website/administration/settings',async(req,res)=>{const body=z.object({version:z.number().int().nonnegative(),value:cadSettingsSchema}).strict().parse(req.body);const result=await service.transaction(async tx=>{const existing=await tx.cadAccessSettings.findUnique({where:{guildId:ids.guildId}});const previousSettings=cadSettingsSchema.parse(existing?.value??cadAccessConfig.defaults);if(previousSettings.rules!==body.value.rules&&previousSettings.rulesVersion===body.value.rulesVersion)throw fail('Change the rules version when editing CAD rules.',400);if((existing?.version??0)!==body.version)throw fail('Settings changed. Refresh before saving.');const row=existing?await tx.cadAccessSettings.update({where:{guildId:ids.guildId},data:{value:json(body.value),version:{increment:1}}}):await tx.cadAccessSettings.create({data:{guildId:ids.guildId,value:json(body.value)}});await tx.auditEvent.create({data:{actorId:req.principal.id,action:'cad-access.settings',entityId:ids.guildId,before:existing?.value??Prisma.JsonNull,after:json(body.value)}});return row;});res.json({value:result.value,version:result.version});});
}
