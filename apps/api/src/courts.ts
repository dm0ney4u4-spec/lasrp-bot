import type { Express } from 'express';
import { z } from 'zod';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { demand,allowed,recordReadable,requireRecord,type Principal,type Group } from '../../../packages/shared/src/permissions.js';
import { ids } from '../../../config/ids.js';
import { notification } from './cad-workflows.js';
const demo=()=>process.env.DEMO_MODE==='true'&&process.env.NODE_ENV!=='production';
const transitions:Record<string,string[]>={submitted:['scheduled','dismissed'],scheduled:['hearing','dismissed'],hearing:['decided','scheduled'],decided:['appealed'],appealed:['scheduled','dismissed'],dismissed:[]};
const create=z.object({title:z.string().trim().min(5).max(120),narrative:z.string().trim().min(20).max(6000),subjectId:z.string().min(1),reportIds:z.array(z.string()).min(1).max(20)}).strict();
const change=z.object({version:z.number().int().positive(),status:z.enum(['scheduled','hearing','decided','appealed','dismissed']),reason:z.string().trim().min(5).max(2000),hearingAt:z.string().datetime().optional(),verdict:z.enum(['not_guilty','guilty','dismissed']).optional(),fine:z.number().int().min(0).max(1000000).default(0)}).strict();
export function courtAuthority(user:Principal,action:string){
 demand(user,'doj');if(!ids.courtsPolicy.specialistRolesEnabled)return;
 const permitted:Record<string,Group[]>={submit:['prosecutor','clerk'],scheduled:['judge','clerk'],hearing:['judge'],decided:['judge'],dismissed:['judge'],appealed:['prosecutor','defense']};demand(user,...(permitted[action]??[]));
}
export function configureCourts(app:Express){
 app.use('/api/court-cases',(req,res,next)=>{if(!ids.featureFlags.courts)return res.status(404).json({error:'Courts are disabled in config/ids.ts.'});demand(req.principal,'doj');next();});
 app.get('/api/court-cases/policy',(req,res)=>{const actions=['submit','scheduled','hearing','decided','dismissed','appealed'].filter(action=>{try{courtAuthority(req.principal,action);return true;}catch{return false;}});res.json({specialistRolesEnabled:ids.courtsPolicy.specialistRolesEnabled,canManageAccess:allowed(req.principal,'judge'),actions});});
 app.get('/api/court-cases',async(req,res)=>{const rows=await db.cadRecord.findMany({where:{kind:'court_case',agency:'doj',demo:demo()},orderBy:{updatedAt:'desc'},take:25,skip:Math.min(100000,Math.max(0,Math.floor(Number(req.query.page)||0)))*25});res.json(rows.filter(row=>recordReadable(req.principal,row)));});
 app.post('/api/court-cases/:id/access',async(req,res)=>{
  demand(req.principal,'judge','clerk');const body=z.object({version:z.number().int().positive(),sealed:z.boolean(),prosecutorId:z.string().max(100).default(''),defenseId:z.string().max(100).default(''),reason:z.string().trim().min(5).max(1000)}).strict().parse(req.body);
  if(!allowed(req.principal,'judge'))throw Object.assign(Error('A judge or management must approve sealing and party access.'),{status:403});
  const result=await db.$transaction(async tx=>{const row=await tx.cadRecord.findFirstOrThrow({where:{id:String(req.params.id),kind:'court_case',agency:'doj',demo:demo()}});for(const userId of [body.prosecutorId,body.defenseId].filter(Boolean))if(!await tx.user.findUnique({where:{id:userId}}))throw Error('Assigned parties must have signed into CAD first.');const data=row.data as any;const nextData={...data,prosecutorId:body.prosecutorId,defenseId:body.defenseId,events:[...(data.events??[]),{action:'access',actorId:req.principal.id,at:new Date().toISOString(),reason:body.reason,sealed:body.sealed}]};const count=await tx.cadRecord.updateMany({where:{id:row.id,version:body.version},data:{sealed:body.sealed,data:nextData,version:{increment:1}}});if(!count.count)throw Object.assign(Error('Court case changed. Refresh first.'),{status:409});const next=await tx.cadRecord.findUniqueOrThrow({where:{id:row.id}});await audit(req.principal.id,'court.access',row.id,row,next,tx);return next;});changed();res.json(result);
 });
 app.post('/api/court-cases',async(req,res)=>{
  courtAuthority(req.principal,'submit');
  const body=create.parse(req.body);const row=await db.$transaction(async tx=>{
   if(!await tx.civilianCharacter.findFirst({where:{id:body.subjectId,demo:demo()}}))throw Error('Choose an existing fictional character.');
   const reports=await tx.cadRecord.findMany({where:{id:{in:body.reportIds},demo:demo(),agency:{in:['police','sheriff']},sealed:false,status:{in:['submitted','approved']}}});
   if(reports.length!==new Set(body.reportIds).size)throw Error('Choose submitted or approved, unsealed law-enforcement reports.');
   const row=await tx.cadRecord.create({data:{kind:'court_case',agency:'doj',ownerId:req.principal.id,subjectId:body.subjectId,status:'submitted',demo:demo(),data:{...body,workflow:'court_v1',events:[],verdict:null,fine:0}}});await audit(req.principal.id,'court.submit',row.id,null,row,tx);return row;
  });changed();res.status(201).json(row);
 });
 app.post('/api/court-cases/:id/transition',async(req,res)=>{
  const body=change.parse(req.body);courtAuthority(req.principal,body.status);const row=await db.$transaction(async tx=>{
   const previous=await tx.cadRecord.findFirstOrThrow({where:{id:String(req.params.id),kind:'court_case',agency:'doj',demo:demo()}}),data=previous.data as Record<string,any>;
   requireRecord(req.principal,previous);
   if(data.workflow!=='court_v1')throw Error('Use a structured court case.');
   if(!(transitions[previous.status]??[]).includes(body.status))throw Object.assign(Error('Court transition is not permitted.'),{status:409});
   if(previous.ownerId===req.principal.id&&['decided','dismissed'].includes(body.status))throw Object.assign(Error('A different DOJ member must decide the case.'),{status:403});
   if(body.status==='scheduled'&&(!body.hearingAt||Date.parse(body.hearingAt)<=Date.now()))throw Error('Choose a future hearing time.');
   if(body.status==='decided'&&!body.verdict)throw Error('Record a fictional verdict.');
   if(body.fine&&!(body.status==='decided'&&body.verdict==='guilty'))throw Error('Fines require a guilty fictional verdict.');
   const nextData={...data,...(body.status==='scheduled'?{hearingAt:body.hearingAt,verdict:null,fine:0}:{}),...(body.status==='decided'?{verdict:body.verdict,fine:body.fine,judgeId:req.principal.id}:{}),events:[...(data.events??[]),{...body,actorId:req.principal.id,at:new Date().toISOString()}]};
   const update=await tx.cadRecord.updateMany({where:{id:previous.id,version:body.version,status:previous.status},data:{status:body.status,data:nextData,version:{increment:1}}});if(!update.count)throw Object.assign(Error('Court case changed. Refresh first.'),{status:409});
   const next=await tx.cadRecord.findUniqueOrThrow({where:{id:previous.id}});await audit(req.principal.id,'court.'+body.status,next.id,previous,next,tx);await notification(tx,previous.ownerId,'court_updated','Court case updated',`${next.id}: ${body.status}`,'#DOJ%20%2F%20Courts');return next;
  });changed();res.json(row);
 });
}
