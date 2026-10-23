import express, {type Express} from 'express';
import {requireCadAdmission} from './cad-admission.js';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { allowed,demand,requireAgency,agencyAccess,requireRecord,recordReadable } from '../../../packages/shared/src/permissions.js';
import { incidentSchema,incidentUpdate,unitSchema,characterSchema,vehicleSchema,recordSchema,recordUpdate,recordKinds } from '../../../packages/shared/src/schemas.js';
import { ids } from '../../../config/ids.js';
import type { CommunityService } from '../../bot/src/service.js';
import { configureCadWorkflows,configureMemberNotifications,notification } from './cad-workflows.js';
import { configureEvidence } from './evidence.js';
import { configureAgencies } from './agencies.js';
import { configurePreferences } from './preferences.js';
import { configureCourts } from './courts.js';
import { configureRoblox } from './roblox.js';
import { configureLegal } from './legal.js';
import { configurePanic } from './panic.js';
import { configureResources } from './resources.js';
import { configureSessionBoard } from './session-board.js';
import { configureMap } from './map.js';
import { configureCivilianPermits } from './civilian-permits.js';
import { configureMutualAid } from './mutual-aid.js';
import { configureEvidenceCustody } from './evidence-custody.js';
import { configureExports } from './exports.js';
import { operationalTransitions } from '../../../packages/shared/src/agency-schemas.js';
const demo=()=>process.env.DEMO_MODE==='true'&&process.env.NODE_ENV!=='production';
const conflict=()=>Object.assign(Error('This record changed. Refresh and try again.'),{status:409});
const pagination=(query:Record<string,unknown>)=>({skip:Math.max(0,Number(query.page)||0)*25,take:25});
const normalAgencies=['police','sheriff','fire','ems','dot','dispatch','doj'];
export function configureCad(parent:Express,service:CommunityService){
 configurePreferences(parent);configureMemberNotifications(parent);
 const app=express.Router() as unknown as Express;
 // Attach admission to every operational route registration, not unmatched parent routes.
 // This preserves staff applications mounted after this router in the existing API.
 for(const method of ['get','post','put','patch','delete','head','options','all'] as const){
  const register=(app[method] as (...args:any[])=>unknown).bind(app);
  (app as unknown as Record<string,unknown>)[method]=(path:unknown,...handlers:unknown[])=>register(path,requireCadAdmission,...handlers);
 }
 parent.use(app);
 configureCadWorkflows(app);
 configureEvidence(app);
 configureAgencies(app);

 configureCourts(app);
 configureRoblox(app);
 configureLegal(app);
 configurePanic(app);
 configureResources(app);
 configureSessionBoard(app);
 configureMap(app,service);
 configureCivilianPermits(app);
 configureMutualAid(app);
 configureEvidenceCustody(app);
 configureExports(app);
 app.get('/api/summary',async(req,res)=>{
  const g=service.store.guild(ids.guildId||'DEMO_GUILD');
  const responder=allowed(req.principal,'dispatcher','police','sheriff','fire','ems','dot');
  res.json({community:ids.settings.community,live:responder?g.live??null:{synced:g.live?.synced,healthy:g.live?.healthy,playerCount:g.live?.players?.length??0},sessions:g.sessions.slice(-10),schedules:await db.scheduledSession.findMany({where:{guildId:ids.guildId,status:'scheduled'},orderBy:{startsAt:'asc'},take:10}),notificationUnread:await db.notification.count({where:{userId:req.principal.id,readAt:null}}),cadPolicy:{selfDispatchEnabled:ids.settings.selfDispatchEnabled,unitFreshnessMinutes:ids.settings.unitFreshnessMinutes},incidents:responder?await db.incident.count({where:{status:{not:'closed'},mergedIntoId:null,demo:demo()}}):null,units:responder?await db.unit.findMany({orderBy:{updatedAt:'desc'},take:50}):[],source:'MANUAL_ROLEPLAY records are fictional CAD entries, separate from ER:LC telemetry.'});
 });
 app.get('/api/incidents',async(req,res)=>{
  const responder=allowed(req.principal,'dispatcher','police','sheriff','fire','ems','dot');
  const visible=normalAgencies.filter(a=>agencyAccess(req.principal,a));
  const rows=await db.incident.findMany({where:{demo:demo(),...(req.query.includeMerged==='true'?{}:{mergedIntoId:null}),...(responder?{agency:{in:visible}}:{callerId:req.principal.id}),...(req.query.status?{status:String(req.query.status)}:{})},include:{assignments:{include:{unit:true}},mergedIncidents:{select:{id:true,type:true,location:true}}},orderBy:[{priority:'asc'},{createdAt:'desc'}],...pagination(req.query)});
  res.json(responder?rows:rows.map(({notes,assignments,mergedIncidents,...publicFields})=>publicFields));
 });
 app.post('/api/incidents',async(req,res)=>{
  const data=incidentSchema.parse(req.body);
  const result=await db.$transaction(async tx=>{const incident=await tx.incident.create({data:{...data,callerId:req.principal.id,demo:demo(),source:'MANUAL_ROLEPLAY'}});await audit(req.principal.id,'incident.create',incident.id,null,incident,tx);return incident;});
  changed();res.status(201).json(result);void notifyIncident(service,result.id);
 });
 app.patch('/api/incidents/:id',async(req,res)=>{
  const body=incidentUpdate.parse(req.body),current=await db.incident.findUniqueOrThrow({where:{id:String(req.params.id),demo:demo()}});requireAgency(req.principal,current.agency);
  if(current.mergedIntoId)throw Object.assign(Error('This incident was merged. Open the surviving incident.'),{status:409});
  const {version,note,...patch}=body;
  const result=await db.$transaction(async tx=>{
   const notes=(current.notes as unknown[]);const timestamps=current.timestamps as Record<string,string>;
   const update=await tx.incident.updateMany({where:{id:current.id,version,mergedIntoId:null},data:{...patch,version:{increment:1},...(note?{notes:JSON.parse(JSON.stringify([...notes,{text:note,user:req.principal.id,at:new Date().toISOString()}]))}:{}),...(body.status?{timestamps:{...timestamps,[body.status]:new Date().toISOString()}}:{})}});if(update.count!==1)throw conflict();
   const next=await tx.incident.findUniqueOrThrow({where:{id:current.id}});await audit(req.principal.id,'incident.update',current.id,current,next,tx);return next;
  });changed();res.json(result);void notifyIncident(service,result.id);
 });
 app.post('/api/incidents/:id/assign',async(req,res)=>{
  demand(req.principal,'dispatcher','supervisor');const body=z.object({unitId:z.string(),version:z.number().int().positive(),remove:z.boolean().default(false)}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{
   const incident=await tx.incident.findUniqueOrThrow({where:{id:String(req.params.id),demo:demo()}});requireAgency(req.principal,incident.agency);
   const unit=await tx.unit.findUniqueOrThrow({where:{id:body.unitId}});requireAgency(req.principal,unit.agency);
   if(!body.remove&&unit.status==='out_of_service')throw Error('Cannot assign an out-of-service unit.');
   const count=await tx.callAssignment.count({where:{incidentId:incident.id,unitId:{not:unit.id}}});
   const updated=await tx.incident.updateMany({where:{id:incident.id,version:body.version,mergedIntoId:null,status:{not:'closed'}},data:{version:{increment:1},status:body.remove?(incident.status==='dispatched'&&!count?'pending':incident.status):incident.status==='pending'?'dispatched':incident.status}});if(!updated.count)throw conflict();
   if(body.remove)await tx.callAssignment.deleteMany({where:{incidentId:incident.id,unitId:unit.id}});else await tx.callAssignment.upsert({where:{incidentId_unitId:{incidentId:incident.id,unitId:unit.id}},create:{incidentId:incident.id,unitId:unit.id,assignedBy:req.principal.id},update:{}});
   await notification(tx,unit.userId,body.remove?'unit_unassigned':'unit_assigned',body.remove?'Assignment released':'New dispatch assignment',`${incident.id}: ${incident.type} at ${incident.location}.`);
   await audit(req.principal.id,body.remove?'dispatch.unassign':'dispatch.assign',incident.id,null,{unitId:unit.id},tx);return tx.incident.findUnique({where:{id:incident.id},include:{assignments:{include:{unit:true}}}});
  });changed();res.json(result);
 });
 app.put('/api/unit',async(req,res)=>{
  const body=unitSchema.parse(req.body);requireAgency(req.principal,body.agency);const {version,...data}=body;
  const result=await db.$transaction(async tx=>{const current=await tx.unit.findUnique({where:{userId:req.principal.id}});if(current){if(current.version!==version)throw conflict();const changed=await tx.unit.updateMany({where:{id:current.id,version},data:{...data,version:{increment:1}}});if(!changed.count)throw conflict();}else await tx.unit.create({data:{...data,userId:req.principal.id}});const next=await tx.unit.findUniqueOrThrow({where:{userId:req.principal.id}});await audit(req.principal.id,'unit.update',next.id,current,next,tx);return next;});changed();res.json(result);
 });
 app.get('/api/characters',async(req,res)=>{res.json(await db.civilianCharacter.findMany({where:{ownerId:req.principal.id,demo:demo()},orderBy:{createdAt:'desc'},...pagination(req.query)}));});
 app.post('/api/characters',async(req,res)=>{const body=characterSchema.parse(req.body);const result=await db.$transaction(async tx=>{const row=await tx.civilianCharacter.create({data:{...body,ownerId:req.principal.id,demo:demo()}});await audit(req.principal.id,'character.create',row.id,null,row,tx);return row;});changed();res.status(201).json(result);});
 app.get('/api/vehicles',async(req,res)=>res.json(await db.vehicleRegistration.findMany({where:{ownerId:req.principal.id,demo:demo()},...pagination(req.query)})));
 app.post('/api/vehicles',async(req,res)=>{
  const body=vehicleSchema.parse(req.body);const character=await db.civilianCharacter.findFirst({where:{id:body.characterId,ownerId:req.principal.id,demo:demo()}});if(!character)throw Object.assign(Error('You do not own this character'),{status:403});
  const result=await db.$transaction(async tx=>{const row=await tx.vehicleRegistration.create({data:{...body,ownerId:req.principal.id,demo:demo()}});await audit(req.principal.id,'vehicle.register',row.id,null,row,tx);return row;});changed();res.status(201).json(result);
 });
 app.patch('/api/vehicles/:id',async(req,res)=>{
  const body=z.object({version:z.number().int().positive(),stolen:z.boolean().optional(),transferTo:z.string().optional(),characterId:z.string().optional()}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{const row=await tx.vehicleRegistration.findFirstOrThrow({where:{id:String(req.params.id),ownerId:req.principal.id,demo:demo()}});let transfer={};if(body.transferTo){const recipient=await tx.civilianCharacter.findFirst({where:{id:body.characterId,ownerId:body.transferTo,demo:demo()}});if(!recipient)throw Error('Recipient character does not exist');transfer={ownerId:body.transferTo,characterId:recipient.id};}const update=await tx.vehicleRegistration.updateMany({where:{id:row.id,version:body.version,ownerId:req.principal.id},data:{...transfer,...(body.stolen!==undefined?{stolen:body.stolen}:{}),version:{increment:1}}});if(!update.count)throw conflict();await audit(req.principal.id,'vehicle.update',row.id,row,body,tx);return tx.vehicleRegistration.findUnique({where:{id:row.id}});});changed();res.json(result);
 });
 app.get('/api/lookup',async(req,res)=>{
  demand(req.principal,'police','sheriff','dispatcher','supervisor');const q=z.string().min(2).max(80).parse(req.query.q);
  const personSelect={id:true,name:true,demographics:true,licenses:true} as const,vehicleSelect={id:true,characterId:true,plate:true,make:true,model:true,color:true,stolen:true} as const;
  const [matchedPeople,matchedVehicles]=await Promise.all([db.civilianCharacter.findMany({where:{demo:demo(),OR:[{name:{contains:q,mode:'insensitive'}},{id:q}]},select:personSelect,take:25}),db.vehicleRegistration.findMany({where:{demo:demo(),plate:{contains:q.toUpperCase()}},select:vehicleSelect,take:25})]);
  const [owners,registrations]=await Promise.all([db.civilianCharacter.findMany({where:{demo:demo(),id:{in:matchedVehicles.map(v=>v.characterId)}},select:personSelect,take:25}),db.vehicleRegistration.findMany({where:{demo:demo(),characterId:{in:matchedPeople.map(p=>p.id)}},select:vehicleSelect,take:25})]);
  const people=[...new Map([...matchedPeople,...owners].map(p=>[p.id,p])).values()].slice(0,25),vehicles=[...new Map([...matchedVehicles,...registrations].map(v=>[v.id,v])).values()].slice(0,25),agencies=normalAgencies.filter(a=>agencyAccess(req.principal,a));
  const [records,stops,bulletins,findings]=await Promise.all([
   db.cadRecord.findMany({where:{demo:demo(),kind:{in:[...recordKinds]},sealed:false,agency:{in:agencies},OR:[{subjectId:{in:people.map(p=>p.id)}},{subjectId:q},{id:q},{data:{path:['plate'],string_contains:q.toUpperCase()}}]},include:{charges:true},take:25}),
   db.trafficStop.findMany({where:{demo:demo(),agency:{in:agencies},OR:[{driverId:{in:people.map(p=>p.id)}},{plate:{in:vehicles.map(v=>v.plate)}}]},select:{id:true,agency:true,callsign:true,plate:true,driverId:true,status:true,disposition:true,reportId:true,createdAt:true},take:25}),
   db.cadRecord.findMany({where:{demo:demo(),sealed:false,agency:{in:agencies},kind:{in:['warrant','bolo']},status:{in:['issued','active']},OR:[...people.map(p=>({data:{path:['characterIds'],array_contains:[p.id]}})),...vehicles.map(v=>({data:{path:['vehicleIds'],array_contains:[v.id]}}))]},take:100}),
   ids.featureFlags.courts?db.cadRecord.findMany({where:{demo:demo(),sealed:false,agency:'doj',kind:'court_case',subjectId:{in:people.map(p=>p.id)},status:{in:['decided','appealed']}},select:{id:true,subjectId:true,status:true,data:true},take:25}):Promise.resolve([]),
  ]);
  const alerts=bulletins.filter(row=>{const data=row.data as any;return data.workflow==='legal_v1'&&(!data.expiresAt||Date.parse(data.expiresAt)>Date.now());});
  await audit(req.principal.id,'lookup.search',q,null,{personCount:people.length,vehicleCount:vehicles.length,alertIds:alerts.map(a=>a.id)});res.json({people,vehicles,records,stops,alerts,findings:findings.map(row=>({caseId:row.id,characterId:row.subjectId,status:row.status,verdict:(row.data as any).verdict,fine:(row.data as any).fine})),legalNotice:'Accusations, warrants, arrests and fictional court verdicts are separate records; an allegation is not a conviction.'});
 });
 app.get('/api/records',async(req,res)=>{
  const agency=String(req.query.agency??'police');requireAgency(req.principal,agency);const kind=req.query.kind?z.enum(recordKinds).parse(req.query.kind):undefined;const rows=await db.cadRecord.findMany({where:{demo:demo(),agency,kind:kind??{in:[...recordKinds]},...(!allowed(req.principal,'supervisor','doj')?{sealed:false}:{})},include:{charges:true},orderBy:{updatedAt:'desc'},...pagination(req.query)});res.json(rows.filter(row=>recordReadable(req.principal,row)));
 });
 app.post('/api/records',async(req,res)=>{
  const body=recordSchema.parse(req.body);requireAgency(req.principal,body.agency);
  if(body.data.disposition==='conviction')throw Error('Record fictional verdicts through the court workflow.');
  if(['crash','use_of_force','witness_statement','search_seizure','highway_assistance'].includes(body.kind)&&body.data.details?.type!==body.kind)throw Error('Complete the structured fields for this report type.');
  if(['use_of_force','witness_statement','search_seizure'].includes(body.kind)&&!['police','sheriff'].includes(body.agency))throw Error('This report requires a law-enforcement agency.');
  if(body.kind==='highway_assistance'&&body.agency!=='dot')throw Error('Highway assistance requires DOT.');
  if(body.kind==='court_case')throw Error('Submit court cases through the court workflow.');
  if(body.kind==='ems_report'&&!['ems','fire'].includes(body.agency))throw Error('Patient reports require Fire/EMS agency');
  if(body.incidentId){const incident=await db.incident.findUniqueOrThrow({where:{id:body.incidentId,demo:demo()}});requireAgency(req.principal,incident.agency);}
  const result=await db.$transaction(async tx=>{const row=await tx.cadRecord.create({data:{...body,ownerId:req.principal.id,demo:demo(),status:body.kind==='warrant'?'submitted':'draft'}});await audit(req.principal.id,'report.create',row.id,null,row,tx);return row;});changed();res.status(201).json(result);
 });
 app.patch('/api/records/:id',async(req,res)=>{
  const body=recordUpdate.parse(req.body),current=await db.cadRecord.findUniqueOrThrow({where:{id:String(req.params.id),demo:demo()}});requireAgency(req.principal,current.agency);
  if((current.data as Record<string,unknown>).workflow==='court_v1')throw Error('Use the court workflow to update this case.');
  if((current.data as Record<string,unknown>).workflow==='legal_v1')throw Error('Use the investigation / warrant / BOLO workflow to update this case.');
  if((current.data as Record<string,unknown>).workflow==='session_v1')throw Error('Use the session workflow to update this record.');
  if((current.data as Record<string,unknown>).workflow==='map_v1')throw Error('Use the map workflow to update this record.');
  if((current.data as Record<string,unknown>).workflow==='civilian_v1')throw Error('Use the civilian registration workflow to update this record.');
  if((current.data as Record<string,unknown>).workflow==='aid_v1')throw Error('Use the mutual aid workflow to update this record.');
  if((current.data as Record<string,unknown>).workflow==='custody_v1')throw Error('Use the evidence custody workflow to update this record.');
  if((current.data as Record<string,unknown>).workflow==='radio_v1')throw Error('Radio acknowledgments are immutable.');
  requireRecord(req.principal,current);
  if(body.data?.disposition==='conviction')throw Error('Record fictional verdicts through the court workflow.');
  if(body.data&&['crash','use_of_force','witness_statement','search_seizure','highway_assistance'].includes(current.kind)&&body.data.details?.type!==current.kind)throw Error('Preserve the structured fields for this report type.');
  if(current.ownerId!==req.principal.id)demand(req.principal,'supervisor','doj');
  if(body.data){const data=current.data as Record<string,unknown>,linked=await db.trafficStop.findUnique({where:{reportId:current.id}});if(linked&&(body.data.fine!==data.fine||body.data.disposition!==data.disposition))throw Error('Traffic-stop fines and disposition are fixed by the recorded stop and charge snapshots.');if(data.operationalCaseId&&body.data.disposition!=='none')throw Error('Agency completion reports cannot be converted into criminal dispositions.');body.data={...body.data,...(data.trafficStopId?{trafficStopId:data.trafficStopId}:{}),...(data.operationalCaseId?{operationalCaseId:data.operationalCaseId}:{})} as typeof body.data;}
  if(body.sealed!==undefined||['approved','denied','issued','cancelled'].includes(body.status??'')){demand(req.principal,'supervisor','doj');if(current.ownerId===req.principal.id&&!allowed(req.principal,'owner'))throw Error('A supervisor must review their own warrant/report through another reviewer.');}
  const {version,...data}=body;const result=await db.$transaction(async tx=>{const update=await tx.cadRecord.updateMany({where:{id:current.id,version},data:{...data,version:{increment:1}}});if(!update.count)throw conflict();const next=await tx.cadRecord.findUniqueOrThrow({where:{id:current.id}});await audit(req.principal.id,'report.update',current.id,current,next,tx);return next;});changed();res.json(result);
 });
 app.get('/api/radio',async(req,res)=>{const agency=String(req.query.agency??'police');requireAgency(req.principal,agency);const rows=await db.radioMessage.findMany({where:{agency},orderBy:{createdAt:'desc'},take:50}),acks=await db.cadRecord.findMany({where:{kind:'radio_ack',agency,subjectId:{in:rows.map(r=>r.id)}},select:{subjectId:true,ownerId:true}});res.json(rows.map(row=>({...row,acknowledgments:acks.filter(a=>a.subjectId===row.id).length,acknowledged:acks.some(a=>a.subjectId===row.id&&a.ownerId===req.principal.id)})));});
 app.post('/api/radio',async(req,res)=>{const body=z.object({agency:z.string(),text:z.string().min(1).max(1000),priority:z.boolean().default(false)}).strict().parse(req.body);requireAgency(req.principal,body.agency);if(body.priority)demand(req.principal,'dispatcher','supervisor');const unit=await db.unit.findUnique({where:{userId:req.principal.id}});if(!unit||unit.agency!==body.agency||unit.status==='out_of_service'||unit.updatedAt.getTime()<Date.now()-ids.settings.unitFreshnessMinutes*60000)throw Error('Go on duty in this agency first');const row=await db.radioMessage.create({data:{...body,userId:req.principal.id,callsign:unit.callsign}});await audit(req.principal.id,'radio.transmit',row.id,null,row);changed();res.status(201).json(row);});
 app.post('/api/radio/:id/ack',async(req,res)=>{z.object({}).strict().parse(req.body);const message=await db.radioMessage.findUniqueOrThrow({where:{id:String(req.params.id)}});requireAgency(req.principal,message.agency);const unit=await db.unit.findUnique({where:{userId:req.principal.id}});if(!unit||unit.agency!==message.agency||unit.status==='out_of_service')throw Error('Go on duty in this agency before acknowledging.');const id='RADIOACK:'+message.id+':'+req.principal.id;await db.$transaction(async tx=>{const count=await tx.cadRecord.createMany({data:[{id,kind:'radio_ack',agency:message.agency,ownerId:req.principal.id,subjectId:message.id,status:'acknowledged',demo:demo(),data:{workflow:'radio_v1',title:'Radio acknowledgment',narrative:'Agency message acknowledged',callsign:unit.callsign}}],skipDuplicates:true});if(count.count)await audit(req.principal.id,'radio.acknowledge',message.id,null,{callsign:unit.callsign},tx);});changed();res.json({acknowledged:true});});
 app.get('/api/audit',async(req,res)=>{demand(req.principal,'security');res.json(await db.auditEvent.findMany({where:{...(req.query.entity?{entityId:String(req.query.entity)}:{}),...(!allowed(req.principal,'management')?{action:{startsWith:'security.'}}:{})},orderBy:{createdAt:'desc'},...pagination(req.query)}));});
 app.get('/api/operational-policy',(req,res)=>{demand(req.principal,'fire','ems','dot','dispatcher','police','sheriff');res.json({transitions:operationalTransitions,hospitals:ids.settings.fictionalHospitals});});
 app.get('/api/record-history/:id',async(req,res)=>{const record=await db.cadRecord.findUniqueOrThrow({where:{id:String(req.params.id),demo:demo()}});if(!(recordKinds as readonly string[]).includes(record.kind))throw Object.assign(Error('Agency report not found.'),{status:404});requireAgency(req.principal,record.agency);requireRecord(req.principal,record);res.json(await db.auditEvent.findMany({where:{entityId:record.id},orderBy:{createdAt:'asc'},take:100}));});
 app.get('/api/staff',async(req,res)=>{demand(req.principal,'moderator','reviewer','support','security');const g=service.store.guild(ids.guildId||'DEMO_GUILD');res.json({shifts:g.shifts,sessions:g.sessions,records:Object.fromEntries(Object.entries(g.records).filter(([key,record])=>{const value=record as any;if(key.startsWith('profile:'))return allowed(req.principal,'management')||key===`profile:${req.principal.id}`;if(key.startsWith('SEC-'))return allowed(req.principal,'security');if(value.kind==='leave')return value.user===req.principal.id||allowed(req.principal,'management');return allowed(req.principal,'management');})),cases:Object.values(g.cases).filter((c:any)=>c.memberId===req.principal.id||allowed(req.principal,c.kind==='staff_infraction'?'management':'moderator')),tickets:Object.values(g.tickets).filter((t:any)=>t.accusedId!==req.principal.id&&(t.user===req.principal.id||allowed(req.principal,'management')||(![2,3].includes(t.category)&&(!t.assignee||t.assignee===req.principal.id)&&allowed(req.principal,'support')))),history:allowed(req.principal,'management')?g.history.slice(-100):[]});});
 app.get('/api/export',async(req,res)=>{demand(req.principal,'supervisor');const agency=String(req.query.agency??'police');requireAgency(req.principal,agency);const rows=await db.cadRecord.findMany({where:{agency,demo:demo(),sealed:false,kind:{in:[...recordKinds]}},take:1000});const escape=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""').replace(/^[=+@-]/,"'")+'"';res.set({'Content-Type':'text/csv','Content-Disposition':'attachment; filename="lasrp-reports.csv"'}).send(['id,kind,status,title,createdAt',...rows.map(r=>[r.id,r.kind,r.status,(r.data as {title:string}).title,r.createdAt.toISOString()].map(escape).join(','))].join('\r\n'));});
}
async function notifyIncident(service:CommunityService,incidentId:string){
 if(!service.client.isReady()||!ids.channels.dispatch)return;
 try{const incident=await db.incident.findUniqueOrThrow({where:{id:incidentId}});const guild=await service.client.guilds.fetch(ids.guildId);const g=service.store.guild(ids.guildId);const channel=await service.restrictedChannel(guild,g,'dispatchChannel','department');const {render}=await import('../../bot/src/panels.js');await channel.send(render(service.template(g,'dispatch_new_emergency_call'),{community:ids.settings.community,call_id:incident.id,priority:`P${incident.priority}`,location:incident.location,incident_type:incident.type,reporting_unit:'LASRP CAD',timestamp:`<t:${Math.floor(Date.now()/1000)}:f>`,details:incident.narrative}));}catch{console.error('CAD Discord notification could not be delivered.');}
}
