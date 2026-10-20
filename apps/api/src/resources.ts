import type { Express } from 'express';
import { z } from 'zod';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { demand,requireAgency } from '../../../packages/shared/src/permissions.js';
import { ids } from '../../../config/ids.js';
const demo=()=>process.env.DEMO_MODE==='true'&&process.env.NODE_ENV!=='production';
const resource=z.object({agency:z.enum(['fire','ems','dot']),kind:z.enum(['station','apparatus']),code:z.string().trim().min(2).max(30),name:z.string().trim().min(2).max(100),stationId:z.string().optional()}).strict();
const patient=z.object({alias:z.string().trim().min(2).max(80),triage:z.enum(['minor','delayed','immediate','expectant']),characterId:z.string().optional(),summary:z.string().trim().min(5).max(1000)}).strict();
const transitions:Record<string,string[]>={assessed:['treating','released'],treating:['transporting','released'],transporting:['arrived'],arrived:[],released:[]};
export function configureResources(app:Express){
 app.get('/api/resources',async(req,res)=>{const agency=z.enum(['fire','ems','dot']).parse(req.query.agency);requireAgency(req.principal,agency);res.json(await db.agencyResource.findMany({where:{agency,demo:demo()},include:{assignedUnit:true},orderBy:{code:'asc'},take:100}));});
 app.post('/api/resources',async(req,res)=>{
  demand(req.principal,'supervisor');const body=resource.parse(req.body);requireAgency(req.principal,body.agency);
  const row=await db.$transaction(async tx=>{if(body.kind==='station'&&body.stationId)throw Error('A station cannot be nested inside another station.');if(body.stationId&&!await tx.agencyResource.findFirst({where:{id:body.stationId,agency:body.agency,kind:'station',demo:demo()}}))throw Error('Choose a station in the same agency.');const row=await tx.agencyResource.create({data:{...body,demo:demo()}});await audit(req.principal.id,'resource.create',row.id,null,row,tx);return row;});changed();res.status(201).json(row);
 });
 app.patch('/api/resources/:id',async(req,res)=>{
  demand(req.principal,'supervisor');const body=z.object({version:z.number().int().positive(),status:z.enum(['available','busy','out_of_service']),assignedUnitId:z.string().nullable().default(null)}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{const row=await tx.agencyResource.findFirstOrThrow({where:{id:String(req.params.id),demo:demo()}});requireAgency(req.principal,row.agency);
   if(body.assignedUnitId){if(row.kind!=='apparatus'||body.status==='out_of_service')throw Error('Only in-service apparatus can be assigned.');const unit=await tx.unit.findUniqueOrThrow({where:{id:body.assignedUnitId}});if(unit.agency!==row.agency||unit.status==='out_of_service')throw Error('Choose an on-duty unit in the same agency.');const existing=await tx.agencyResource.findFirst({where:{assignedUnitId:unit.id,id:{not:row.id}}});if(existing)throw Object.assign(Error('This unit already has assigned apparatus.'),{status:409});}
   const count=await tx.agencyResource.updateMany({where:{id:row.id,version:body.version},data:{status:body.status,assignedUnitId:body.assignedUnitId,version:{increment:1}}});if(!count.count)throw Object.assign(Error('Resource changed. Refresh first.'),{status:409});const next=await tx.agencyResource.findUniqueOrThrow({where:{id:row.id}});await audit(req.principal.id,'resource.update',row.id,row,next,tx);return next;});changed();res.json(result);
 });
 app.get('/api/operational-cases/:id/patients',async(req,res)=>{const row=await db.operationalCase.findFirstOrThrow({where:{id:String(req.params.id),kind:'ems',demo:demo()}});requireAgency(req.principal,'ems');res.json(await db.operationalPatient.findMany({where:{caseId:row.id},orderBy:{updatedAt:'asc'},take:50}));});
 app.post('/api/operational-cases/:id/patients',async(req,res)=>{
  requireAgency(req.principal,'ems');const body=patient.parse(req.body);const result=await db.$transaction(async tx=>{
   const row=await tx.operationalCase.findFirstOrThrow({where:{id:String(req.params.id),kind:'ems',demo:demo()}});if(row.assigneeId!==req.principal.id)demand(req.principal,'supervisor');if(['closed','cancelled','released'].includes(row.status))throw Error('This EMS case is closed to new patients.');if(await tx.operationalPatient.count({where:{caseId:row.id}})>=50)throw Error('This incident has reached its patient limit.');
   if(body.characterId&&!await tx.civilianCharacter.findFirst({where:{id:body.characterId,demo:demo()}}))throw Error('Fictional character was not found.');
   const lock=await tx.operationalCase.updateMany({where:{id:row.id,version:row.version,status:row.status},data:{version:{increment:1}}});if(!lock.count)throw Object.assign(Error('EMS case changed. Refresh first.'),{status:409});
   const next=await tx.operationalPatient.create({data:{...body,caseId:row.id}});await audit(req.principal.id,'patient.add',next.id,null,next,tx);return next;});changed();res.status(201).json(result);
 });
 app.patch('/api/patients/:id',async(req,res)=>{
  requireAgency(req.principal,'ems');const body=z.object({version:z.number().int().positive(),status:z.enum(['treating','transporting','arrived','released']),hospital:z.string().max(150).default(''),summary:z.string().trim().min(5).max(1000)}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{const row=await tx.operationalPatient.findUniqueOrThrow({where:{id:String(req.params.id)},include:{case:true}});if(row.case.demo!==demo())throw Error('Patient was not found.');if(row.case.assigneeId!==req.principal.id)demand(req.principal,'supervisor');if(!(transitions[row.status]??[]).includes(body.status))throw Object.assign(Error('Patient transition is not permitted.'),{status:409});if(['closed','cancelled'].includes(row.case.status))throw Error('EMS case is closed.');if(['transporting','arrived'].includes(body.status)&&!ids.settings.fictionalHospitals.includes(body.hospital))throw Error('Choose a configured fictional hospital.');
   const lock=await tx.operationalCase.updateMany({where:{id:row.case.id,version:row.case.version,status:row.case.status},data:{version:{increment:1}}});if(!lock.count)throw Object.assign(Error('EMS case changed. Refresh first.'),{status:409});
   const count=await tx.operationalPatient.updateMany({where:{id:row.id,version:body.version},data:{status:body.status,hospital:body.hospital,summary:body.summary,version:{increment:1}}});if(!count.count)throw Object.assign(Error('Patient changed. Refresh first.'),{status:409});const next=await tx.operationalPatient.findUniqueOrThrow({where:{id:row.id}});await audit(req.principal.id,'patient.transition',row.id,{status:row.status},next,tx);return next;});changed();res.json(result);
 });
}
