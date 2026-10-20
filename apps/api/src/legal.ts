import type { Express } from 'express';
import { z } from 'zod';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { requireAgency,demand,allowed } from '../../../packages/shared/src/permissions.js';
import { notification } from './cad-workflows.js';
import { randomUUID } from 'node:crypto';
const demo=()=>process.env.DEMO_MODE==='true'&&process.env.NODE_ENV!=='production';
const input=z.object({kind:z.enum(['investigation','warrant','bolo']),agency:z.enum(['police','sheriff']),title:z.string().trim().min(5).max(120),narrative:z.string().trim().min(20).max(6000),characterIds:z.array(z.string()).max(30).default([]),vehicleIds:z.array(z.string()).max(30).default([]),reportIds:z.array(z.string()).max(30).default([]),expiresAt:z.string().datetime().optional()}).strict();
const update=z.object({version:z.number().int().positive(),action:z.enum(['note','submit','approve','deny','close','cancel','acknowledge','expire']),reason:z.string().trim().min(5).max(2000)}).strict();
const states:Record<string,Record<string,string[]>>={investigation:{draft:['submit','note'],submitted:['approve','deny','note'],approved:['close','note'],denied:['note'],closed:['note']},warrant:{draft:['submit','note'],submitted:['approve','deny','note'],issued:['cancel','expire','note'],denied:['note'],cancelled:['note'],expired:['note']},bolo:{active:['cancel','expire','note','acknowledge'],cancelled:['note'],expired:['note']}};
export async function expireLegal(){
 const rows=await db.cadRecord.findMany({where:{kind:{in:['warrant','bolo']},status:{in:['issued','active']},data:{path:['workflow'],equals:'legal_v1'}},take:1000});
 for(const row of rows){const data=row.data as Record<string,any>;if(!data.expiresAt||Date.parse(data.expiresAt)>Date.now())continue;await db.$transaction(async tx=>{const count=await tx.cadRecord.updateMany({where:{id:row.id,version:row.version,status:row.status},data:{status:'expired',version:{increment:1},data:{...data,events:[...(data.events??[]),{action:'expire',reason:'Configured expiry reached',actorId:'system',at:new Date().toISOString()}]}}});if(count.count){await audit('system','legal.expire',row.id,row,{status:'expired'},tx);await notification(tx,row.ownerId,'legal_updated','Case expired',row.id,'#Investigations');}});}
}
export function configureLegal(app:Express){
 app.get('/api/legal/:id/tasks',async(req,res)=>{const row=await db.cadRecord.findFirstOrThrow({where:{id:String(req.params.id),kind:'investigation',demo:demo()}});requireAgency(req.principal,row.agency);if(row.sealed)demand(req.principal,'supervisor');res.json({version:row.version,tasks:(row.data as any).tasks??[]});});
 app.post('/api/legal/:id/tasks',async(req,res)=>{
  const body=z.object({version:z.number().int().positive(),title:z.string().trim().min(5).max(200),assigneeId:z.string().optional(),dueAt:z.string().datetime().optional()}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{const row=await tx.cadRecord.findFirstOrThrow({where:{id:String(req.params.id),kind:'investigation',demo:demo()}});requireAgency(req.principal,row.agency);if(row.ownerId!==req.principal.id||row.sealed)demand(req.principal,'supervisor');const data=row.data as any;if(data.workflow!=='legal_v1'||['closed','denied'].includes(row.status))throw Error('Choose an open structured investigation.');if((data.tasks??[]).length>=100)throw Error('This case has reached its task limit.');if(body.dueAt&&Date.parse(body.dueAt)<=Date.now())throw Error('Choose a future task deadline.');
   const assigneeId=body.assigneeId??req.principal.id;if(assigneeId!==req.principal.id){const unit=await tx.unit.findUnique({where:{userId:assigneeId}});if(!unit||unit.agency!==row.agency||unit.status==='out_of_service')throw Error('Choose an on-duty assignee in this agency.');}
   const task={id:randomUUID(),title:body.title,assigneeId,dueAt:body.dueAt??null,status:'pending',notes:[],createdBy:req.principal.id,createdAt:new Date().toISOString()};const count=await tx.cadRecord.updateMany({where:{id:row.id,version:body.version},data:{data:{...data,tasks:[...(data.tasks??[]),task]},version:{increment:1}}});if(!count.count)throw Object.assign(Error('Investigation changed. Refresh first.'),{status:409});await audit(req.principal.id,'investigation.task-create',row.id,null,task,tx);await notification(tx,assigneeId,'investigation_task','Investigation task assigned',body.title,'#Investigations');return task;});changed();res.status(201).json(result);
 });
 app.patch('/api/legal/:id/tasks/:taskId',async(req,res)=>{
  const body=z.object({version:z.number().int().positive(),status:z.enum(['in_progress','completed','cancelled']),note:z.string().trim().min(5).max(1500)}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{const row=await tx.cadRecord.findFirstOrThrow({where:{id:String(req.params.id),kind:'investigation',demo:demo()}});requireAgency(req.principal,row.agency);if(row.sealed)demand(req.principal,'supervisor');const data=row.data as any,task=(data.tasks??[]).find((t:any)=>t.id===String(req.params.taskId));if(!task||['closed','denied'].includes(row.status))throw Error('Open investigation task not found.');if(task.assigneeId!==req.principal.id)demand(req.principal,'supervisor');if(body.status==='cancelled'&&row.ownerId!==req.principal.id)demand(req.principal,'supervisor');const nextStates:Record<string,string[]>={pending:['in_progress','cancelled'],in_progress:['completed','cancelled']};if(!(nextStates[task.status]??[]).includes(body.status))throw Object.assign(Error('Task transition is not permitted.'),{status:409});
   const next={...task,status:body.status,notes:[...(task.notes??[]),{text:body.note,actorId:req.principal.id,at:new Date().toISOString()}]};const count=await tx.cadRecord.updateMany({where:{id:row.id,version:body.version},data:{data:{...data,tasks:data.tasks.map((t:any)=>t.id===task.id?next:t)},version:{increment:1}}});if(!count.count)throw Object.assign(Error('Investigation changed. Refresh first.'),{status:409});await audit(req.principal.id,'investigation.task-update',row.id,task,next,tx);return next;});changed();res.json(result);
 });
 app.get('/api/legal',async(req,res)=>{
  const agency=z.enum(['police','sheriff']).parse(req.query.agency);requireAgency(req.principal,agency);
  res.json(await db.cadRecord.findMany({where:{agency,demo:demo(),kind:{in:['investigation','warrant','bolo']},...(!allowed(req.principal,'supervisor')?{sealed:false}:{})},orderBy:{updatedAt:'desc'},take:25,skip:Math.min(100000,Math.max(0,Math.floor(Number(req.query.page)||0)))*25}));
 });
 app.post('/api/legal',async(req,res)=>{
  const body=input.parse(req.body);requireAgency(req.principal,body.agency);
  if(['warrant','bolo'].includes(body.kind)&&(!body.expiresAt||Date.parse(body.expiresAt)<=Date.now()))throw Error('Choose a future expiry for warrants and BOLOs.');
  if(body.kind==='warrant'&&!body.characterIds.length)throw Error('A warrant requires at least one fictional subject.');
  const result=await db.$transaction(async tx=>{
   for(const [ids,model] of [[body.characterIds,'civilianCharacter'],[body.vehicleIds,'vehicleRegistration'],[body.reportIds,'cadRecord']] as const){
    const rows=model==='cadRecord'?await tx.cadRecord.findMany({where:{id:{in:ids},agency:body.agency,demo:demo(),sealed:false},select:{id:true}}):model==='civilianCharacter'?await tx.civilianCharacter.findMany({where:{id:{in:ids},demo:demo()},select:{id:true}}):await tx.vehicleRegistration.findMany({where:{id:{in:ids},demo:demo()},select:{id:true}});
    if(rows.length!==new Set(ids).size)throw Error('Linked fictional records were not found or are restricted.');
   }
   const row=await tx.cadRecord.create({data:{kind:body.kind,agency:body.agency,ownerId:req.principal.id,status:body.kind==='bolo'?'active':'draft',demo:demo(),subjectId:body.characterIds[0],data:{...body,workflow:'legal_v1',events:[],acknowledgments:[]}}});
   await audit(req.principal.id,'legal.create',row.id,null,row,tx);return row;
  });changed();res.status(201).json(result);
 });
 app.post('/api/legal/:id/action',async(req,res)=>{
  const body=update.parse(req.body);const result=await db.$transaction(async tx=>{
   const row=await tx.cadRecord.findFirstOrThrow({where:{id:String(req.params.id),demo:demo(),kind:{in:['investigation','warrant','bolo']}}});requireAgency(req.principal,row.agency);if(row.sealed)demand(req.principal,'supervisor');
   const data=row.data as Record<string,any>;if(data.workflow!=='legal_v1')throw Error('Use a structured investigation, warrant or BOLO.');
   if(!(states[row.kind]?.[row.status]??[]).includes(body.action))throw Object.assign(Error('That case action is not permitted.'),{status:409});
   if(['approve','deny','cancel','expire'].includes(body.action)){demand(req.principal,'supervisor');if(['approve','deny'].includes(body.action)&&row.ownerId===req.principal.id)throw Object.assign(Error('Another supervisor must review your request.'),{status:403});}
   else if(body.action!=='acknowledge'&&row.ownerId!==req.principal.id)demand(req.principal,'supervisor');
   if(body.action==='expire'&&(!data.expiresAt||Date.parse(data.expiresAt)>Date.now()))throw Error('The record has not reached its expiry.');
   if(body.action==='approve'&&data.expiresAt&&Date.parse(data.expiresAt)<=Date.now())throw Error('The request has expired; submit a new request.');
   if(body.action==='close'&&(data.tasks??[]).some((t:any)=>!['completed','cancelled'].includes(t.status)))throw Error('Complete or cancel open investigation tasks before closing.');
   const status=({submit:'submitted',approve:row.kind==='warrant'?'issued':'approved',deny:'denied',close:'closed',cancel:'cancelled',expire:'expired'} as Record<string,string>)[body.action]??row.status;
   const nextData={...data,events:[...(data.events??[]),{action:body.action,reason:body.reason,actorId:req.principal.id,at:new Date().toISOString()}],...(body.action==='acknowledge'?{acknowledgments:[...new Set([...(data.acknowledgments??[]),req.principal.id])]}:{})};
   const count=await tx.cadRecord.updateMany({where:{id:row.id,version:body.version,status:row.status},data:{status,data:nextData,version:{increment:1}}});if(!count.count)throw Object.assign(Error('Case changed. Refresh first.'),{status:409});
   const next=await tx.cadRecord.findUniqueOrThrow({where:{id:row.id}});await audit(req.principal.id,'legal.'+body.action,row.id,row,next,tx);await notification(tx,row.ownerId,'legal_updated','Case updated',`${row.id}: ${status}`,'#Investigations');return next;
  });changed();res.json(result);
 });
 app.get('/api/legal-matches',async(req,res)=>{
  demand(req.principal,'police','sheriff','dispatcher','supervisor');const query=z.object({characterId:z.string().optional(),vehicleId:z.string().optional()}).refine(q=>q.characterId||q.vehicleId).parse(req.query);
  const rows=await db.cadRecord.findMany({where:{demo:demo(),sealed:false,kind:{in:['warrant','bolo']},status:{in:['issued','active']},agency:{in:['police','sheriff'].filter(a=>allowed(req.principal,'dispatcher','supervisor')||req.principal.groups.includes(a as 'police'|'sheriff'))}},take:500});
  const matches=rows.filter(row=>{const data=row.data as Record<string,any>;return data.workflow==='legal_v1'&&(!data.expiresAt||Date.parse(data.expiresAt)>Date.now())&&((query.characterId&&data.characterIds?.includes(query.characterId))||(query.vehicleId&&data.vehicleIds?.includes(query.vehicleId)));});await audit(req.principal.id,'legal.match-lookup',query.characterId??query.vehicleId!,null,{matches:matches.map(m=>m.id)});res.json(matches);
 });
}
