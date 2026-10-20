import type { Express } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { demand,requireAgency,allowed,type Principal } from '../../../packages/shared/src/permissions.js';
import { operationalCreate,operationalUpdate,operationalTransitions,fireDetails,emsDetails,towDetails } from '../../../packages/shared/src/agency-schemas.js';
import { notification } from './cad-workflows.js';
import { ids } from '../../../config/ids.js';
const demo=()=>process.env.DEMO_MODE==='true'&&process.env.NODE_ENV!=='production';
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const agencyFor=(kind:string)=>({fire:'fire',ems:'ems',tow:'dot'}[kind]);
function writer(user:Principal,agency:string,assignee:string|null){requireAgency(user,agency);if(assignee!==user.id)demand(user,'supervisor');}
export function configureAgencies(app:Express){
 app.get('/api/operational-cases',async(req,res)=>{
  const kind=z.enum(['fire','ems','tow']).parse(req.query.kind);requireAgency(req.principal,agencyFor(kind)!);
  const skip=Math.max(0,Math.min(100000,Math.floor(Number(req.query.page)||0)))*25;res.json(await db.operationalCase.findMany({where:{kind,demo:demo()},include:{report:true},orderBy:{updatedAt:'desc'},skip,take:25}));
 });
 app.post('/api/operational-cases',async(req,res)=>{
  const body=operationalCreate.parse(req.body),agency=agencyFor(body.kind)!;
  if(body.kind==='tow')demand(req.principal,'police','sheriff','dispatcher','dot');else requireAgency(req.principal,agency);
  const result=await db.$transaction(async tx=>{
   if(body.incidentId){const incident=await tx.incident.findUniqueOrThrow({where:{id:body.incidentId,demo:demo()}});requireAgency(req.principal,incident.agency);if(incident.mergedIntoId||incident.status==='closed')throw Error('Choose an active, unmerged incident.');}
   if(body.kind==='ems'&&body.data.characterId&&!await tx.civilianCharacter.findFirst({where:{id:body.data.characterId,demo:demo()}}))throw Error('Fictional patient character not found');
   if(body.kind==='tow'){
    if(body.data.vehicleId&&!await tx.vehicleRegistration.findFirst({where:{id:body.data.vehicleId,plate:body.data.plate,demo:demo()}}))throw Error('Registered vehicle does not match the plate.');
    if(body.data.trafficStopId){const stop=await tx.trafficStop.findUniqueOrThrow({where:{id:body.data.trafficStopId,demo:demo()}});requireAgency(req.principal,stop.agency);if(stop.plate!==body.data.plate)throw Error('Traffic-stop plate does not match.');}
   }
   const activeKey=body.kind==='tow'&&body.data.trafficStopId?`tow:${body.data.trafficStopId}`:null;if(activeKey&&await tx.operationalCase.findUnique({where:{activeKey}}))throw Object.assign(Error('This traffic stop already has an active tow request.'),{status:409});
   const row=await tx.operationalCase.create({data:{kind:body.kind,agency,creatorId:req.principal.id,incidentId:body.incidentId,activeKey,status:{fire:'dispatched',ems:'awaiting_response',tow:'requested'}[body.kind],data:body.data,demo:demo()}});
   const units=await tx.unit.findMany({where:{agency,status:{not:'out_of_service'},updatedAt:{gte:new Date(Date.now()-ids.settings.unitFreshnessMinutes*60000)}}});for(const unit of units)await notification(tx,unit.userId,'agency_case_created',`${body.kind.toUpperCase()} request`,`${row.id}: ${body.data.location}`,body.kind==='tow'?'#DOT%20%2F%20Towing':'#Fire%20%2F%20EMS');
   await audit(req.principal.id,'agency-case.create',row.id,null,row,tx);return row;
  });changed();res.status(201).json(result);
 });
 app.post('/api/operational-cases/:id/claim',async(req,res)=>{
  const {version}=z.object({version:z.number().int().positive()}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{
   const row=await tx.operationalCase.findUniqueOrThrow({where:{id:String(req.params.id),demo:demo()}});requireAgency(req.principal,row.agency);
   if(!Object.keys(operationalTransitions[row.kind]??{}).includes(row.status)||!(operationalTransitions[row.kind][row.status]?.length))throw Error('This case is closed');
   const unit=await tx.unit.findUniqueOrThrow({where:{userId:req.principal.id}});if(unit.agency!==row.agency||unit.status==='out_of_service')throw Error('Go on duty in the responding agency before claiming.');
   if(row.assigneeId&&row.assigneeId!==req.principal.id)throw Object.assign(Error('Another responder already claimed this case.'),{status:409});
   const update=await tx.operationalCase.updateMany({where:{id:row.id,version},data:{assigneeId:req.principal.id,...(row.kind==='tow'&&row.status==='requested'?{status:'assigned'}:{}),version:{increment:1}}});if(!update.count)throw Object.assign(Error('This case changed; refresh first.'),{status:409});
   const next=await tx.operationalCase.findUniqueOrThrow({where:{id:row.id}});await audit(req.principal.id,'agency-case.claim',row.id,row,next,tx);return next;
  });changed();res.json(result);
 });
 app.patch('/api/operational-cases/:id',async(req,res)=>{
  const body=operationalUpdate.parse(req.body);
  const result=await db.$transaction(async tx=>{
   const row=await tx.operationalCase.findUniqueOrThrow({where:{id:String(req.params.id),demo:demo()}});writer(req.principal,row.agency,row.assigneeId);
   if(!(operationalTransitions[row.kind]?.[row.status]??[]).includes(body.nextStatus))throw Object.assign(Error('That status transition is not permitted.'),{status:409});
   const details={...row.data as Record<string,unknown>,...body.data};
   const data=row.kind==='fire'?fireDetails.parse(details):row.kind==='ems'?emsDetails.parse(details):towDetails.parse(details);
   if(row.kind==='ems'){
    const patient=emsDetails.parse(data);const previous=emsDetails.parse(row.data);if(patient.characterId!==previous.characterId)throw Error('Patient identity cannot be changed after case creation.');
    if(['transporting','arrived'].includes(body.nextStatus)&&!ids.settings.fictionalHospitals.includes(patient.hospital))throw Error('Choose a configured fictional hospital before transporting.');
   }
   if(row.kind==='tow'){
    const tow=towDetails.parse(data),previous=towDetails.parse(row.data);if(tow.plate!==previous.plate||tow.vehicleId!==previous.vehicleId||tow.trafficStopId!==previous.trafficStopId||tow.releaseRequestedBy!==previous.releaseRequestedBy)throw Error('Vehicle and release-request identity fields cannot be replaced.');
    if(body.nextStatus==='impounded'&&(!tow.impoundLot.trim()||!tow.inventoryNotes.trim()))throw Error('Impound location and inventory notes are required.');
    if(body.nextStatus==='released'&&tow.releaseReason.trim().length<5)throw Error('Record an authorized release reason.');
   }
   const terminal=!(operationalTransitions[row.kind][body.nextStatus]?.length);
   if(row.kind==='ems'&&terminal&&await tx.operationalPatient.count({where:{caseId:row.id,status:{notIn:['arrived','released']}}}))throw Error('Complete or release all fictional patient transports before closing the EMS case.');
   const update=await tx.operationalCase.updateMany({where:{id:row.id,version:body.version,status:row.status},data:{status:body.nextStatus,data:json(data),...(terminal?{activeKey:null}:{}),version:{increment:1}}});if(!update.count)throw Object.assign(Error('This case changed; refresh first.'),{status:409});
   let reportId=row.reportId;
   if(terminal&&!reportId){const report=await tx.cadRecord.create({data:{kind:{fire:'fire_incident',ems:'ems_report',tow:'tow_request'}[row.kind]!,agency:row.agency,ownerId:req.principal.id,incidentId:row.incidentId,status:'submitted',demo:demo(),data:{title:`${row.kind.toUpperCase()} ${row.id} — ${body.nextStatus}`,narrative:data.summary,location:data.location,disposition:'none',evidenceUrls:[],operationalCaseId:row.id}}});reportId=report.id;await tx.operationalCase.update({where:{id:row.id},data:{reportId}});await audit(req.principal.id,'report.agency-completion',report.id,null,report,tx);}
   const next=await tx.operationalCase.findUniqueOrThrow({where:{id:row.id},include:{report:true}});await audit(req.principal.id,'agency-case.transition',row.id,row,next,tx);await notification(tx,row.creatorId,'agency_case_updated',`${row.kind.toUpperCase()} case updated`,`${row.id}: ${body.nextStatus}`,row.kind==='tow'?'#DOT%20%2F%20Towing':'#Fire%20%2F%20EMS');return next;
  });changed();res.json(result);
 });
 app.get('/api/my-impounds',async(req,res)=>{
  const vehicles=await db.vehicleRegistration.findMany({where:{ownerId:req.principal.id,demo:demo()},select:{id:true}});
  const rows=vehicles.length?await db.operationalCase.findMany({where:{kind:'tow',demo:demo(),status:'impounded',OR:vehicles.map(v=>({data:{path:['vehicleId'],equals:v.id}}))},select:{id:true,status:true,data:true,version:true},take:25}):[];
  res.json(rows.map(row=>{const data=towDetails.parse(row.data);return {id:row.id,status:row.status,version:row.version,plate:data.plate,impoundLot:data.impoundLot,releaseRequested:Boolean(data.releaseRequestedBy)};}));
 });
 app.post('/api/operational-cases/:id/request-release',async(req,res)=>{
  const body=z.object({version:z.number().int().positive()}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{
   const row=await tx.operationalCase.findUniqueOrThrow({where:{id:String(req.params.id),demo:demo(),kind:'tow',status:'impounded'}});const data=towDetails.parse(row.data);if(!data.vehicleId||!await tx.vehicleRegistration.findFirst({where:{id:data.vehicleId,ownerId:req.principal.id,demo:demo()}}))throw Object.assign(Error('Only the registered fictional vehicle owner can request release.'),{status:403});
   const update=await tx.operationalCase.updateMany({where:{id:row.id,version:body.version},data:{data:{...data,releaseRequestedBy:req.principal.id},version:{increment:1}}});if(!update.count)throw Object.assign(Error('Case changed; refresh first.'),{status:409});if(row.assigneeId)await notification(tx,row.assigneeId,'tow_release_requested','Vehicle release requested',`${data.plate}: owner review requested. No vehicle was released automatically.`,'#DOT%20%2F%20Towing');await audit(req.principal.id,'tow.release-request',row.id,null,{vehicleId:data.vehicleId},tx);return {ok:true};
  });changed();res.json(result);
 });
}
