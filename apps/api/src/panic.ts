import type { Express } from 'express';
import { z } from 'zod';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { requireAgency,type Principal } from '../../../packages/shared/src/permissions.js';
import { ids } from '../../../config/ids.js';
import { notification } from './cad-workflows.js';
export const panicInput=z.object({version:z.number().int().positive(),reason:z.string().trim().min(5).max(500)}).strict();
export async function signalPanic(user:Principal,input:unknown){
 const body=panicInput.parse(input);const result=await db.$transaction(async tx=>{
  const unit=await tx.unit.findUniqueOrThrow({where:{userId:user.id}});requireAgency(user,unit.agency);
  if(unit.status==='out_of_service'||unit.updatedAt.getTime()<Date.now()-ids.settings.unitFreshnessMinutes*60000)throw Error('Go on duty and refresh your unit before sending an emergency.');
  const recent=await tx.auditEvent.findFirst({where:{actorId:user.id,action:'unit.panic',createdAt:{gte:new Date(Date.now()-60000)}}});if(recent)throw Object.assign(Error('An emergency alert was already sent within the last minute.'),{status:429});
  const count=await tx.unit.updateMany({where:{id:unit.id,version:body.version},data:{status:'panic',version:{increment:1}}});if(!count.count)throw Object.assign(Error('Unit changed. Refresh first.'),{status:409});
  const agencies=unit.agency==='police'||unit.agency==='sheriff'?['police','sheriff','dispatch']:[unit.agency,'dispatch'];
  const recipients=await tx.unit.findMany({where:{agency:{in:agencies},status:{not:'out_of_service'},updatedAt:{gte:new Date(Date.now()-ids.settings.unitFreshnessMinutes*60000)}}});
  for(const recipient of recipients)await notification(tx,recipient.userId,'panic','UNIT EMERGENCY',`${unit.callsign} • ${unit.location??'Location not provided'} • ${body.reason}`,'#Dispatch');
  await audit(user.id,'unit.panic',unit.id,null,{callsign:unit.callsign,agency:unit.agency,location:unit.location,reason:body.reason,recipientCount:recipients.length},tx);
  return {unit:await tx.unit.findUniqueOrThrow({where:{id:unit.id}}),recipientCount:recipients.length};
 });changed();return result;
}
export function configurePanic(app:Express){app.post('/api/unit/panic',async(req,res)=>res.json(await signalPanic(req.principal,req.body)));}
