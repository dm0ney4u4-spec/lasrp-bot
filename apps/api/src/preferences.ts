import type { Express } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db,audit } from '../../../packages/shared/src/database.js';

export const preferenceSchema=z.object({version:z.number().int().nonnegative().default(0),widgetSizes:z.record(z.enum(['population','calls','units','activity','sessions']),z.object({columns:z.number().int().min(1).max(2),height:z.number().int().min(160).max(1200)}).strict()).default({}),theme:z.enum(['dark','light']).default('dark'),mutedKinds:z.array(z.string().regex(/^[a-z_]{1,60}$/)).max(40).default([]),dashboardWidgets:z.array(z.enum(['population','calls','units','activity','sessions'])).max(5).refine(v=>new Set(v).size===v.length,'Widgets must be unique').default(['population','calls','units','activity','sessions'])}).strict();
export function configurePreferences(app:Express){
 app.get('/api/preferences',async(req,res)=>{const user=await db.user.findUniqueOrThrow({where:{id:req.principal.id}});res.json(preferenceSchema.parse(user.preferences));});
 app.put('/api/preferences',async(req,res)=>{
  const body=preferenceSchema.parse(req.body);
  const result=await db.$transaction(async tx=>{
   const user=await tx.user.findUniqueOrThrow({where:{id:req.principal.id}}),previous=preferenceSchema.parse(user.preferences);
   if(previous.version!==body.version)throw Object.assign(Error('Preferences changed. Refresh first.'),{status:409});
   const next={...body,version:body.version+1};const update=await tx.user.updateMany({where:{id:user.id,preferences:{equals:user.preferences as Prisma.InputJsonValue}},data:{preferences:next}});
   if(!update.count)throw Object.assign(Error('Preferences changed. Refresh first.'),{status:409});
   await audit(user.id,'preferences.update',user.id,previous,next,tx);return next;
  });res.json(result);
 });
}
