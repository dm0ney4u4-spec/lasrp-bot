import type { Express } from 'express';
import { Prisma,type Incident } from '@prisma/client';
import { z } from 'zod';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { demand,allowed,requireAgency,agencyAccess,type Principal } from '../../../packages/shared/src/permissions.js';
import { mergeSchema,transferSchema,selfDispatchSchema,stopSchema,stopUpdateSchema,stopCloseSchema,penalCodeSchema } from '../../../packages/shared/src/cad-workflow-schemas.js';
import { ids } from '../../../config/ids.js';

const demo=()=>process.env.DEMO_MODE==='true'&&process.env.NODE_ENV!=='production';
const conflict=()=>Object.assign(Error('This record changed. Refresh before trying again.'),{status:409});
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const page=(value:unknown)=>({skip:Math.min(100000,Math.max(0,Math.floor(Number(value)||0)))*25,take:25});
export async function notification(tx:Prisma.TransactionClient,userId:string,kind:string,title:string,body:string,href='#Dispatch'){
 const user=await tx.user.findUnique({where:{id:userId},select:{preferences:true}});
 const preferences=user?.preferences as {mutedKinds?:string[]}|undefined;
 if(!['panic','security_alert','unit_assigned'].includes(kind)&&preferences?.mutedKinds?.includes(kind))return null;
 return tx.notification.create({data:{userId,kind,title,body,href}});
}
function activeIncident(incident:Incident){if(incident.status==='closed'||incident.mergedIntoId)throw Object.assign(Error('Use an open, unmerged incident.'),{status:409});}
function operational(user:Principal){demand(user,'dispatcher','supervisor');}
function law(user:Principal){demand(user,'police','sheriff');}

export function configureCadWorkflows(app:Express){
 app.post('/api/unit/heartbeat',async(req,res)=>{demand(req.principal,'police','sheriff','fire','ems','dot','dispatcher');const unit=await db.unit.findUnique({where:{userId:req.principal.id}});if(unit){requireAgency(req.principal,unit.agency);await db.unit.updateMany({where:{id:unit.id,status:{not:'out_of_service'}},data:{updatedAt:new Date()}});}res.json({ok:true});});
 app.get('/api/incidents/:id',async(req,res)=>{
  const incident=await db.incident.findUniqueOrThrow({where:{id:String(req.params.id),demo:demo()},include:{assignments:{include:{unit:true}},mergedIncidents:{select:{id:true,location:true,type:true,createdAt:true}}}});
  const agencyAuthorized=agencyAccess(req.principal,incident.agency);if(incident.callerId!==req.principal.id)requireAgency(req.principal,incident.agency);
  if(!agencyAuthorized){const {notes,assignments,mergedIncidents,...publicFields}=incident;res.json(publicFields);}else res.json(incident);
 });
 app.post('/api/incidents/:id/merge',async(req,res)=>{
  operational(req.principal);const body=mergeSchema.parse(req.body),sourceId=String(req.params.id);if(sourceId===body.targetId)throw Error('Choose a different incident to merge into.');
  const result=await db.$transaction(async tx=>{
   const source=await tx.incident.findUniqueOrThrow({where:{id:sourceId,demo:demo()}}),target=await tx.incident.findUniqueOrThrow({where:{id:body.targetId,demo:demo()}});
   requireAgency(req.principal,source.agency);requireAgency(req.principal,target.agency);activeIncident(source);activeIncident(target);
   if(source.version!==body.version||target.version!==body.targetVersion)throw conflict();
   // Lock both incident revisions in a stable order. A concurrent merge/assignment
   // either wins a revision or rolls this whole transaction back.
   for(const row of [source,target].sort((a,b)=>a.id.localeCompare(b.id))){const changed=await tx.incident.updateMany({where:{id:row.id,version:row.version,mergedIntoId:null,status:{not:'closed'}},data:{version:{increment:1}}});if(!changed.count)throw conflict();}
   const sourceAssignments=await tx.callAssignment.findMany({where:{incidentId:source.id}});
   if(sourceAssignments.length)await tx.callAssignment.createMany({data:sourceAssignments.map(a=>({incidentId:target.id,unitId:a.unitId,assignedBy:req.principal.id})),skipDuplicates:true});
   await tx.callAssignment.deleteMany({where:{incidentId:source.id}});
   const records=await tx.cadRecord.findMany({where:{incidentId:source.id,demo:demo()}});
   for(const record of records){await tx.cadRecord.update({where:{id:record.id},data:{incidentId:target.id,version:{increment:1}}});await audit(req.principal.id,'report.incident-merged',record.id,{incidentId:source.id},{incidentId:target.id},tx);}
   await tx.trafficStop.updateMany({where:{incidentId:source.id,demo:demo()},data:{incidentId:target.id,version:{increment:1}}});
   const note={type:'merged_incident',sourceId:source.id,location:source.location,narrative:source.narrative,reason:body.reason,by:req.principal.id,at:new Date().toISOString()};
   await tx.incident.update({where:{id:source.id},data:{mergedIntoId:target.id,status:'closed',timestamps:json({...source.timestamps as object,merged:new Date().toISOString(),closed:new Date().toISOString()})}});
   const next=await tx.incident.update({where:{id:target.id},data:{priority:Math.min(source.priority,target.priority),notes:json([...(target.notes as unknown[]),note]),...(sourceAssignments.length&&target.status==='pending'?{status:'dispatched'}:{})},include:{assignments:{include:{unit:true}},mergedIncidents:true}});
   await audit(req.principal.id,'incident.merge',source.id,{source,target},{mergedIntoId:target.id,reason:body.reason,reportIds:records.map(r=>r.id)},tx);
   for(const assigned of next.assignments)await notification(tx,assigned.unit.userId,'incident_merged','Incident merged',`${source.id} was merged into ${target.id}. ${body.reason}`);
   return next;
  });changed();res.json(result);
 });
 app.post('/api/incidents/:id/transfer',async(req,res)=>{
  operational(req.principal);const body=transferSchema.parse(req.body);
  const result=await db.$transaction(async tx=>{
   const current=await tx.incident.findUniqueOrThrow({where:{id:String(req.params.id),demo:demo()}});requireAgency(req.principal,current.agency);requireAgency(req.principal,body.agency);activeIncident(current);if(current.agency===body.agency)throw Error('Choose a different receiving agency.');
   const changed=await tx.incident.updateMany({where:{id:current.id,version:body.version,mergedIntoId:null,status:{not:'closed'}},data:{agency:body.agency,status:'pending',dispatcherId:req.principal.id,version:{increment:1},notes:json([...(current.notes as unknown[]),{type:'agency_transfer',from:current.agency,to:body.agency,reason:body.reason,by:req.principal.id,at:new Date().toISOString()}])}});if(!changed.count)throw conflict();
   const previous=await tx.callAssignment.findMany({where:{incidentId:current.id},include:{unit:true}});await tx.callAssignment.deleteMany({where:{incidentId:current.id}});
   for(const assignment of previous)await notification(tx,assignment.unit.userId,'incident_transferred','Assignment released',`${current.id} transferred to ${body.agency}; your assignment was released. ${body.reason}`);
   const receivers=await tx.unit.findMany({where:{agency:body.agency,status:{not:'out_of_service'},updatedAt:{gte:new Date(Date.now()-ids.settings.unitFreshnessMinutes*60000)}}});
   for(const receiver of receivers)await notification(tx,receiver.userId,'incident_transferred','Transferred incident',`${current.id}: ${current.type} at ${current.location}. ${body.reason}`);
   const next=await tx.incident.findUniqueOrThrow({where:{id:current.id},include:{assignments:{include:{unit:true}}}});await audit(req.principal.id,'incident.transfer',current.id,current,{...next,reason:body.reason},tx);return next;
  });changed();res.json(result);
 });
 app.post('/api/incidents/:id/self-dispatch',async(req,res)=>{
  demand(req.principal,'police','sheriff','fire','ems','dot');const body=selfDispatchSchema.parse(req.body);if(!ids.settings.selfDispatchEnabled)throw Object.assign(Error('Self-dispatch is disabled by community policy.'),{status:403});
  const result=await db.$transaction(async tx=>{
   const incident=await tx.incident.findUniqueOrThrow({where:{id:String(req.params.id),demo:demo()}});requireAgency(req.principal,incident.agency);activeIncident(incident);
   const cutoff=new Date(Date.now()-ids.settings.unitFreshnessMinutes*60000);
   if(await tx.unit.count({where:{agency:'dispatch',status:{not:'out_of_service'},updatedAt:{gte:cutoff}}}))throw Object.assign(Error('A dispatcher is on duty. Request assignment through dispatch.'),{status:409});
   const unit=await tx.unit.findUniqueOrThrow({where:{userId:req.principal.id}});if(unit.status==='out_of_service'||unit.updatedAt<cutoff)throw Error('Confirm your current duty status before self-dispatching.');if(unit.agency!==incident.agency)throw Object.assign(Error('Your duty agency does not match this incident.'),{status:403});
   const update=await tx.incident.updateMany({where:{id:incident.id,version:body.version,status:{not:'closed'},mergedIntoId:null},data:{version:{increment:1},status:incident.status==='pending'?'dispatched':incident.status}});if(!update.count)throw conflict();
   await tx.callAssignment.upsert({where:{incidentId_unitId:{incidentId:incident.id,unitId:unit.id}},create:{incidentId:incident.id,unitId:unit.id,assignedBy:req.principal.id},update:{}});
   await audit(req.principal.id,'dispatch.self-assign',incident.id,null,{unitId:unit.id,policy:'no_fresh_dispatcher'},tx);await notification(tx,unit.userId,'unit_assigned','Self-dispatch recorded',`${unit.callsign} is assigned to ${incident.id}.`);
   return tx.incident.findUniqueOrThrow({where:{id:incident.id},include:{assignments:{include:{unit:true}}}});
  });changed();res.json(result);
 });
 app.get('/api/notifications',async(req,res)=>res.json(await db.notification.findMany({where:{userId:req.principal.id,...(req.query.unread==='true'?{readAt:null}:{})},orderBy:{createdAt:'desc'},...page(req.query.page)})));
 app.post('/api/notifications/read-all',async(req,res)=>{await db.notification.updateMany({where:{userId:req.principal.id,readAt:null},data:{readAt:new Date()}});changed();res.json({ok:true});});
 app.post('/api/notifications/:id/read',async(req,res)=>{const result=await db.notification.updateMany({where:{id:String(req.params.id),userId:req.principal.id},data:{readAt:new Date()}});if(!result.count)throw Object.assign(Error('Notification not found'),{status:404});changed();res.json({ok:true});});
 app.get('/api/penal-codes',async(req,res)=>{demand(req.principal,'police','sheriff','dispatcher','supervisor','doj');res.json(await db.penalCode.findMany({where:allowed(req.principal,'management')&&req.query.all==='true'?{}:{active:true},orderBy:{code:'asc'},take:500}));});
 app.post('/api/penal-codes',async(req,res)=>{demand(req.principal,'management');const body=penalCodeSchema.parse(req.body);const result=await db.$transaction(async tx=>{const row=await tx.penalCode.create({data:body});await audit(req.principal.id,'penal-code.create',row.id,null,row,tx);return row;});changed();res.status(201).json(result);});
 app.patch('/api/penal-codes/:id',async(req,res)=>{demand(req.principal,'management');const {version,...data}=penalCodeSchema.extend({version:z.number().int().positive()}).parse(req.body);const result=await db.$transaction(async tx=>{const before=await tx.penalCode.findUniqueOrThrow({where:{id:String(req.params.id)}});const update=await tx.penalCode.updateMany({where:{id:before.id,version},data:{...data,version:{increment:1}}});if(!update.count)throw conflict();const next=await tx.penalCode.findUniqueOrThrow({where:{id:before.id}});await audit(req.principal.id,'penal-code.update',before.id,before,next,tx);return next;});changed();res.json(result);});
 app.get('/api/traffic-stops',async(req,res)=>{
  law(req.principal);const agency=z.enum(['police','sheriff']).parse(req.query.agency??'police');requireAgency(req.principal,agency);
  res.json(await db.trafficStop.findMany({where:{agency,demo:demo(),...(req.query.status?{status:z.enum(['active','closed']).parse(req.query.status)}:{})},include:{report:{include:{charges:true}}},orderBy:{createdAt:'desc'},...page(req.query.page)}));
 });
 app.post('/api/traffic-stops',async(req,res)=>{
  law(req.principal);const body=stopSchema.parse(req.body);requireAgency(req.principal,body.agency);
  const result=await db.$transaction(async tx=>{
   const unit=await tx.unit.findUniqueOrThrow({where:{userId:req.principal.id}});if(unit.agency!==body.agency||unit.status==='out_of_service')throw Error('Go on duty in the selected law-enforcement agency first.');
   if(body.driverId&&!await tx.civilianCharacter.findFirst({where:{id:body.driverId,demo:demo()}}))throw Error('Fictional driver character not found.');
   for(const id of body.passengers)if(!await tx.civilianCharacter.findFirst({where:{id,demo:demo()}}))throw Error('Fictional passenger character not found.');
   if(body.incidentId){const incident=await tx.incident.findUniqueOrThrow({where:{id:body.incidentId,demo:demo()}});requireAgency(req.principal,incident.agency);activeIncident(incident);}
   const stop=await tx.trafficStop.create({data:{...body,officerId:req.principal.id,callsign:unit.callsign,demo:demo()}});await audit(req.principal.id,'traffic-stop.create',stop.id,null,stop,tx);return stop;
  });changed();res.status(201).json(result);
 });
 app.patch('/api/traffic-stops/:id',async(req,res)=>{
  law(req.principal);const body=stopUpdateSchema.parse(req.body);const result=await db.$transaction(async tx=>{
   const current=await tx.trafficStop.findUniqueOrThrow({where:{id:String(req.params.id),demo:demo()}});requireAgency(req.principal,current.agency);if(current.officerId!==req.principal.id)demand(req.principal,'supervisor');
   const {version,...data}=body;const update=await tx.trafficStop.updateMany({where:{id:current.id,version,status:'active'},data:{...data,version:{increment:1}}});if(!update.count)throw conflict();
   const next=await tx.trafficStop.findUniqueOrThrow({where:{id:current.id}});await audit(req.principal.id,'traffic-stop.update',current.id,current,next,tx);
   if((body.backupRequested&&!current.backupRequested)||(body.towRequested&&!current.towRequested)){
    const units=await tx.unit.findMany({where:{status:{not:'out_of_service'},agency:{in:[...(body.backupRequested&&!current.backupRequested?[current.agency,'dispatch']:[]),...(body.towRequested&&!current.towRequested?['dot','dispatch']:[])]},updatedAt:{gte:new Date(Date.now()-ids.settings.unitFreshnessMinutes*60000)}}});
    for(const unit of units)await notification(tx,unit.userId,'traffic_stop_assistance','Traffic stop assistance',`${current.callsign}: ${current.plate} at ${next.location}. ${body.backupRequested?'Backup requested. ':''}${body.towRequested?'Tow requested.':''}`,'#Police%20MDT');
   }return next;
  });changed();res.json(result);
 });
 app.post('/api/traffic-stops/:id/close',async(req,res)=>{
  law(req.principal);const body=stopCloseSchema.parse(req.body);
  const result=await db.$transaction(async tx=>{
   const current=await tx.trafficStop.findUniqueOrThrow({where:{id:String(req.params.id),demo:demo()}});requireAgency(req.principal,current.agency);if(current.officerId!==req.principal.id)demand(req.principal,'supervisor');
   if(body.disposition==='arrest'&&!current.driverId)throw Error('Link the fictional driver before recording an arrest.');
   const update=await tx.trafficStop.updateMany({where:{id:current.id,version:body.version,status:'active'},data:{status:'closed',disposition:body.disposition,narrative:body.narrative,closedAt:new Date(),version:{increment:1}}});if(!update.count)throw conflict();
   const codes=await tx.penalCode.findMany({where:{id:{in:body.charges.map(c=>c.penalCodeId)},active:true}});if(codes.length!==body.charges.length)throw Error('One or more selected penal codes are inactive or missing.');
   const charges=body.charges.map(c=>{const code=codes.find(code=>code.id===c.penalCodeId)!;return {penalCodeId:code.id,codeSnapshot:code.code,titleSnapshot:code.title,fine:code.fine,count:c.count};});const total=charges.reduce((sum,c)=>sum+c.fine*c.count,0);
   const report=await tx.cadRecord.create({data:{kind:body.disposition==='arrest'?'arrest':body.disposition==='citation'?'citation':'traffic_stop',agency:current.agency,ownerId:req.principal.id,subjectId:current.driverId,incidentId:current.incidentId,demo:demo(),status:'submitted',data:{title:`Traffic stop ${current.plate} — ${body.disposition}`,narrative:body.narrative,plate:current.plate,location:current.location,disposition:body.disposition==='no_action'?'none':body.disposition,evidenceUrls:[],fine:total,trafficStopId:current.id},charges:{create:charges}}});
   const next=await tx.trafficStop.update({where:{id:current.id},data:{reportId:report.id},include:{report:{include:{charges:true}}}});await audit(req.principal.id,'traffic-stop.close',current.id,current,next,tx);await audit(req.principal.id,'report.traffic-disposition',report.id,null,{report,charges},tx);
   await notification(tx,current.officerId,'traffic_stop_closed','Traffic stop recorded',`${current.plate}: ${body.disposition}. Report ${report.id}.`,'#Police%20MDT');return next;
  });changed();res.json(result);
 });
}
