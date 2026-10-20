import { z } from 'zod';
import { agency } from './schemas.js';
const version=z.number().int().positive();
export const mergeSchema=z.object({version,targetId:z.string().min(1).max(100),targetVersion:version,reason:z.string().trim().min(5).max(1000)}).strict();
export const transferSchema=z.object({version,agency,reason:z.string().trim().min(5).max(1000)}).strict();
export const selfDispatchSchema=z.object({version}).strict();
export const chargeInput=z.object({penalCodeId:z.string().min(1).max(100),count:z.number().int().min(1).max(20).default(1)}).strict();
export const penalCodeSchema=z.object({code:z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9 .-]+$/),title:z.string().trim().min(3).max(100),classification:z.enum(['infraction','misdemeanor','felony']),fine:z.number().int().min(0).max(100000),description:z.string().trim().min(5).max(1500),active:z.boolean().default(true)}).strict();
export const stopSchema=z.object({agency:z.enum(['police','sheriff']),plate:z.string().trim().toUpperCase().regex(/^[A-Z0-9 -]{2,10}$/),location:z.string().trim().min(2).max(160),driverId:z.string().min(1).max(100).optional(),passengers:z.array(z.string().min(1).max(100)).max(8).default([]),narrative:z.string().trim().min(5).max(3000),incidentId:z.string().min(1).max(100).optional()}).strict();
export const stopUpdateSchema=z.object({version,narrative:z.string().trim().min(5).max(3000).optional(),location:z.string().trim().min(2).max(160).optional(),backupRequested:z.boolean().optional(),towRequested:z.boolean().optional()}).strict();
export const stopCloseSchema=z.object({version,disposition:z.enum(['no_action','warning','citation','arrest']),narrative:z.string().trim().min(5).max(3000),charges:z.array(chargeInput).max(20).default([])}).strict().superRefine((data,ctx)=>{
 if(['citation','arrest'].includes(data.disposition)&&!data.charges.length)ctx.addIssue({code:'custom',path:['charges'],message:'Select at least one active fictional penal code.'});
 if(['no_action','warning'].includes(data.disposition)&&data.charges.length)ctx.addIssue({code:'custom',path:['charges'],message:'Warnings and no-action stops cannot carry charges.'});
 if(new Set(data.charges.map(c=>c.penalCodeId)).size!==data.charges.length)ctx.addIssue({code:'custom',path:['charges'],message:'Use a count instead of duplicate charge rows.'});
});
