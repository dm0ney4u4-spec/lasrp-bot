import type {RequestHandler} from 'express';
import type {Principal} from '../../../packages/shared/src/permissions.js';
import {db} from '../../../packages/shared/src/database.js';
import {ids} from '../../../config/ids.js';
import {cadAccessConfig} from '../../../config/cad-access.js';
import {websiteOwner} from '../../../packages/shared/src/website-permissions.js';
export async function cadAdmission(user:Principal,database:Pick<typeof db,'cadAdmission'>=db){
 const bypass=cadAccessConfig.ownerEmergencyBypass&&websiteOwner(user);
 const record=await database.cadAdmission.findUnique({where:{guildId_userId:{guildId:ids.guildId,userId:user.id}},include:{application:{select:{status:true,userId:true,guildId:true}}}});
 return {admitted:ids.featureFlags.cad&&(bypass||record?.status==='approved'&&record.application?.status==='approved'&&record.application.userId===user.id&&record.application.guildId===ids.guildId),bypass,status:record?.status??'not_applied',record};
}
export function cadAdmissionGuard(check:typeof cadAdmission=cadAdmission):RequestHandler{return async(req,res,next)=>{try{if(!req.principal)return res.status(401).json({error:'Sign in with Discord to continue.'});const admission=await check(req.principal);if(!admission.admitted)return res.status(403).json({code:'CAD_APPROVAL_REQUIRED',status:admission.status,error:'Explicit CAD approval is required. Apply through the website CAD page.'});next();}catch{res.status(503).json({code:'CAD_ADMISSION_UNAVAILABLE',error:'CAD approval could not be verified. Access is closed until verification is available.'});}};}
export const requireCadAdmission=cadAdmissionGuard();
