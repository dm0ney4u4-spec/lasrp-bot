import { createHash } from 'node:crypto';
import type { Express } from 'express';
import { z } from 'zod';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { allowed,demand } from '../../../packages/shared/src/permissions.js';
import { ids } from '../../../config/ids.js';
const demo=()=>process.env.DEMO_MODE==='true'&&process.env.NODE_ENV!=='production';
export function configureSessionBoard(app:Express){
 app.get('/api/session-board',async(req,res)=>{
  const schedules=await db.scheduledSession.findMany({where:{guildId:ids.guildId,status:'scheduled',startsAt:{gt:new Date()}},orderBy:{startsAt:'asc'},take:25});
  const reservations=await db.cadRecord.findMany({where:{kind:'session_reservation',status:'reserved',demo:demo(),subjectId:{in:schedules.map(s=>s.id)}},select:{ownerId:true,subjectId:true}});
  const sessions=await db.session.findMany({where:{guildId:ids.guildId},include:{_count:{select:{attendance:true}}},orderBy:{startedAt:'desc'},take:25});
  const scorecards=allowed(req.principal,'host','moderator')?await db.cadRecord.findMany({where:{kind:'session_scorecard',demo:demo(),subjectId:{in:sessions.filter(s=>allowed(req.principal,'management')||s.hostId===req.principal.id).map(s=>s.id)}},take:25}):[];
  res.json({schedules:schedules.map(s=>({...s,reservations:reservations.filter(r=>r.subjectId===s.id).length,attending:reservations.some(r=>r.subjectId===s.id&&r.ownerId===req.principal.id)})),sessions:sessions.map(s=>({id:s.id,hostId:s.hostId,status:s.status,startedAt:s.startedAt,endedAt:s.endedAt,peakPlayers:s.peakPlayers,observedParticipants:s._count.attendance,durationMinutes:s.endedAt?Math.floor((s.endedAt.getTime()-s.startedAt.getTime())/60000):null})),scorecards});
 });
 app.put('/api/schedules/:id/rsvp',async(req,res)=>{
  if(!ids.featureFlags.sessions)throw Error('Sessions are disabled.');const body=z.object({attending:z.boolean()}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{
   const schedule=await tx.scheduledSession.findFirstOrThrow({where:{id:String(req.params.id),guildId:ids.guildId}});
   const lock=await tx.scheduledSession.updateMany({where:{id:schedule.id,status:'scheduled',startsAt:{gt:new Date()}},data:{note:schedule.note}});if(!lock.count)throw Object.assign(Error('This schedule is cancelled or has already started.'),{status:409});
   const id='RSVP-'+createHash('sha256').update(`${demo()}:${schedule.id}:${req.principal.id}`).digest('hex');
   const row=await tx.cadRecord.upsert({where:{id},create:{id,kind:'session_reservation',agency:'dispatch',ownerId:req.principal.id,subjectId:schedule.id,status:body.attending?'reserved':'cancelled',demo:demo(),data:{workflow:'session_v1',title:'Session RSVP',narrative:'Community session attendance intention; not a guaranteed in-game slot.'}},update:{status:body.attending?'reserved':'cancelled',version:{increment:1}}});
   await audit(req.principal.id,'session.rsvp',id,null,{scheduleId:schedule.id,attending:body.attending},tx);return {attending:row.status==='reserved'};
  });changed();res.json(result);
 });
 app.put('/api/sessions/:id/scorecard',async(req,res)=>{
  demand(req.principal,'management');const body=z.object({version:z.number().int().nonnegative(),coordination:z.number().int().min(1).max(5),professionalism:z.number().int().min(1).max(5),policy:z.number().int().min(1).max(5),notes:z.string().trim().min(10).max(2000)}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{
   const session=await tx.session.findFirstOrThrow({where:{id:String(req.params.id),guildId:ids.guildId,status:'ended'}});if(session.hostId===req.principal.id)throw Object.assign(Error('Another manager must review your hosted session.'),{status:403});
   const id='SCORE-'+session.id,previous=await tx.cadRecord.findUnique({where:{id}}),data={workflow:'session_v1',title:'Session quality review',narrative:body.notes,coordination:body.coordination,professionalism:body.professionalism,policy:body.policy,reviewerId:req.principal.id};
   if(previous){const count=await tx.cadRecord.updateMany({where:{id,version:body.version},data:{data,version:{increment:1}}});if(!count.count)throw Object.assign(Error('Scorecard changed. Refresh first.'),{status:409});}else{if(body.version!==0)throw Object.assign(Error('Scorecard changed. Refresh first.'),{status:409});await tx.cadRecord.create({data:{id,kind:'session_scorecard',agency:'dispatch',ownerId:session.hostId,subjectId:session.id,status:'submitted',demo:demo(),data}});}
   const row=await tx.cadRecord.findUniqueOrThrow({where:{id}});await audit(req.principal.id,'session.scorecard',id,previous,row,tx);return row;
  });changed();res.json(result);
 });
}
