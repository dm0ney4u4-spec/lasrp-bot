import type { Express } from 'express';
import { z } from 'zod';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { requireAgency,demand,agencyAccess } from '../../../packages/shared/src/permissions.js';
import { notification } from './cad-workflows.js';
import { ids } from '../../../config/ids.js';
const demo=()=>process.env.DEMO_MODE==='true'&&process.env.NODE_ENV!=='production';
export function configureMutualAid(app:Express){
 app.get('/api/mutual-aid',async(req,res)=>{demand(req.principal,'dispatcher','supervisor','police','sheriff','fire','ems','dot');const visible=['police','sheriff','fire','ems','dot','dispatch'].filter(a=>agencyAccess(req.principal,a)),page=Math.max(0,Math.min(10000,Math.floor(Number(req.query.page)||0)));res.json(await db.cadRecord.findMany({where:{kind:'mutual_aid',demo:demo(),OR:[{agency:{in:visible}},...visible.map(agency=>({data:{path:['sourceAgency'],equals:agency}}))]},orderBy:{updatedAt:'desc'},take:25,skip:page*25}));});
 app.post('/api/mutual-aid',async(req,res)=>{
  demand(req.principal,'dispatcher','supervisor');const body=z.object({incidentId:z.string(),version:z.number().int().positive(),agency:z.enum(['police','sheriff','fire','ems','dot']),summary:z.string().trim().min(10).max(1500)}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{
   const incident=await tx.incident.findFirstOrThrow({where:{id:body.incidentId,demo:demo(),mergedIntoId:null,status:{not:'closed'}}});requireAgency(req.principal,incident.agency);if(incident.agency===body.agency)throw Error('Choose a different receiving agency.');
   const lock=await tx.incident.updateMany({where:{id:incident.id,version:body.version,status:{not:'closed'}},data:{version:{increment:1}}});if(!lock.count)throw Object.assign(Error('Incident changed. Refresh first.'),{status:409});
   if(await tx.cadRecord.findFirst({where:{kind:'mutual_aid',subjectId:incident.id,agency:body.agency,demo:demo(),status:{in:['requested','accepted']}}}))throw Object.assign(Error('An active aid request already exists for this agency.'),{status:409});
   const row=await tx.cadRecord.create({data:{kind:'mutual_aid',agency:body.agency,ownerId:req.principal.id,subjectId:incident.id,status:'requested',demo:demo(),data:{workflow:'aid_v1',title:'Mutual aid: '+incident.type,narrative:body.summary,sourceAgency:incident.agency,location:incident.location,priority:incident.priority,events:[]}}});
   const units=await tx.unit.findMany({where:{agency:body.agency,status:{not:'out_of_service'},updatedAt:{gte:new Date(Date.now()-ids.settings.unitFreshnessMinutes*60000)}}});for(const unit of units)await notification(tx,unit.userId,'mutual_aid','Mutual aid requested',`${incident.location}: ${body.summary}`,'#Mutual%20Aid');await audit(req.principal.id,'mutual-aid.request',row.id,null,row,tx);return row;
  });changed();res.status(201).json(result);
 });
 app.post('/api/mutual-aid/:id/respond',async(req,res)=>{
  demand(req.principal,'dispatcher','supervisor');const body=z.object({version:z.number().int().positive(),status:z.enum(['accepted','declined','cancelled','completed']),reason:z.string().trim().min(5).max(1000)}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{
   const row=await tx.cadRecord.findFirstOrThrow({where:{id:String(req.params.id),kind:'mutual_aid',demo:demo()}}),data=row.data as any;
   if(body.status==='cancelled')requireAgency(req.principal,data.sourceAgency);else requireAgency(req.principal,row.agency);
   if(!(row.status==='requested'&&['accepted','declined','cancelled'].includes(body.status)||row.status==='accepted'&&body.status==='completed'))throw Object.assign(Error('Aid transition is not permitted.'),{status:409});
   const count=await tx.cadRecord.updateMany({where:{id:row.id,version:body.version,status:row.status},data:{status:body.status,version:{increment:1}}});if(!count.count)throw Object.assign(Error('Aid request changed. Refresh first.'),{status:409});
   let responseIncidentId=data.responseIncidentId??null;
   if(body.status==='accepted'){const source=await tx.incident.findFirstOrThrow({where:{id:row.subjectId!,demo:demo(),status:{not:'closed'},mergedIntoId:null}});const incident=await tx.incident.create({data:{source:'MUTUAL_AID',callerId:row.ownerId,location:data.location,narrative:data.narrative,type:'Mutual aid response',priority:data.priority,agency:row.agency,demo:demo(),...(source.coordinates?{coordinates:source.coordinates as any}:{})}});responseIncidentId=incident.id;await audit(req.principal.id,'mutual-aid.response-call',incident.id,null,{requestId:row.id,sourceIncidentId:source.id},tx);}
   if(body.status==='completed'&&responseIncidentId){const incident=await tx.incident.findUniqueOrThrow({where:{id:responseIncidentId}});if(incident.status!=='closed')throw Error('Close the receiving agency response incident before completing aid.');}
   const next=await tx.cadRecord.update({where:{id:row.id},data:{data:{...data,responseIncidentId,events:[...(data.events??[]),{status:body.status,actorId:req.principal.id,reason:body.reason,at:new Date().toISOString()}]}}});await audit(req.principal.id,'mutual-aid.'+body.status,row.id,row,next,tx);await notification(tx,row.ownerId,'mutual_aid','Aid request updated',`${row.id}: ${body.status}. ${body.reason}`,'#Mutual%20Aid');return next;
  });changed();res.json(result);
 });
}
