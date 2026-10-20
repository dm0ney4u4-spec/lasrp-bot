import type { Express } from 'express';
import { z } from 'zod';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { demand } from '../../../packages/shared/src/permissions.js';
import { notification } from './cad-workflows.js';
const demo=()=>process.env.DEMO_MODE==='true'&&process.env.NODE_ENV!=='production';
const schema=z.object({kind:z.enum(['property','business','permit']),characterId:z.string().min(1),title:z.string().trim().min(3).max(120),location:z.string().trim().min(3).max(150),description:z.string().trim().min(10).max(2000)}).strict();
export function configureCivilianPermits(app:Express){
 app.get('/api/my-registrations',async(req,res)=>res.json(await db.cadRecord.findMany({where:{kind:'civilian_registration',ownerId:req.principal.id,demo:demo()},orderBy:{updatedAt:'desc'},take:25,skip:Math.max(0,Math.min(100000,Math.floor(Number(req.query.page)||0)))*25})));
 app.post('/api/my-registrations',async(req,res)=>{
  const body=schema.parse(req.body);const row=await db.$transaction(async tx=>{if(!await tx.civilianCharacter.findFirst({where:{id:body.characterId,ownerId:req.principal.id,demo:demo()}}))throw Object.assign(Error('Choose a fictional character you own.'),{status:403});const row=await tx.cadRecord.create({data:{kind:'civilian_registration',agency:'dispatch',ownerId:req.principal.id,subjectId:body.characterId,status:'submitted',demo:demo(),data:{...body,narrative:body.description,workflow:'civilian_v1'}}});await audit(req.principal.id,'civilian.registration-submit',row.id,null,row,tx);return row;});changed();res.status(201).json(row);
 });
 app.get('/api/registration-reviews',async(req,res)=>{demand(req.principal,'management');res.json(await db.cadRecord.findMany({where:{kind:'civilian_registration',demo:demo(),...(req.query.all==='true'?{}:{status:'submitted'})},orderBy:{createdAt:'asc'},take:25,skip:Math.max(0,Math.min(100000,Math.floor(Number(req.query.page)||0)))*25}));});
 app.post('/api/registrations/:id/review',async(req,res)=>{
  demand(req.principal,'management');const body=z.object({version:z.number().int().positive(),status:z.enum(['approved','denied','revoked']),reason:z.string().trim().min(5).max(1000)}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{const row=await tx.cadRecord.findFirstOrThrow({where:{id:String(req.params.id),kind:'civilian_registration',demo:demo()}});if(row.ownerId===req.principal.id)throw Object.assign(Error('Another manager must review your fictional registration.'),{status:403});if(!(row.status==='submitted'&&['approved','denied'].includes(body.status)||row.status==='approved'&&body.status==='revoked'))throw Object.assign(Error('This registration cannot make that transition.'),{status:409});const count=await tx.cadRecord.updateMany({where:{id:row.id,version:body.version,status:row.status},data:{status:body.status,data:{...row.data as Record<string,any>,reviewerId:req.principal.id,reason:body.reason},version:{increment:1}}});if(!count.count)throw Object.assign(Error('Registration changed. Refresh first.'),{status:409});const next=await tx.cadRecord.findUniqueOrThrow({where:{id:row.id}});await audit(req.principal.id,'civilian.registration-review',row.id,row,next,tx);await notification(tx,row.ownerId,'registration_updated','Fictional registration reviewed',`${(row.data as any).title}: ${body.status}. ${body.reason}`,'#Civilian%20Portal');return next;});changed();res.json(result);
 });
}
