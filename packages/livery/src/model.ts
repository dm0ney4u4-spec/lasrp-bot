import {z} from 'zod';
export const LIVERY_OWNER='1425577335637413961';
export const DENIED='Access Denied: You are not authorized to use the Livery Management System.';
export function authorize(actorId:unknown):asserts actorId is typeof LIVERY_OWNER {if(typeof actorId!=='string'||actorId!==LIVERY_OWNER)throw new LiveryError(DENIED);}
export class LiveryError extends Error {override name='LiveryError';}
export const departments=['NYPD','NYCSO','NYSP','NYFD','NYDOT','SPECIAL_OPERATIONS'] as const;
export const sides=['front','rear','left','right','top'] as const;
export type Department=typeof departments[number];
export const canonicalDepartment=(value:unknown)=>typeof value==='string'?({LAPD:'NYPD',LASD:'NYCSO',CHP:'NYSP',LAFD:'NYFD',LADOT:'NYDOT',CALTRANS:'NYDOT'} as Record<string,string>)[value]??value:value;
const departmentSchema=z.preprocess(canonicalDepartment,z.enum(departments));
const text=(max=200)=>z.string().trim().max(max);
const https=z.string().url().max(1000).refine(value=>{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;},'Use an HTTPS URL without credentials');
const nullableUrl=https.nullable().default(null);
const date=z.string().datetime().nullable().default(null);
export const slotSchema=z.object({position:text(100).min(1),assetId:z.string().regex(/^[1-9]\d{0,29}$/,'Decal IDs must be exact positive digit strings, or null for missing').nullable()}).strict();
export const liveryInput=z.object({
 department:departmentSchema,vehicleName:text().min(1),vehicleCategory:text(80).default('Unclassified'),name:text(160).min(1),
 decals:z.object({front:z.array(slotSchema).max(12).default([]),rear:z.array(slotSchema).max(12).default([]),left:z.array(slotSchema).max(12).default([]),right:z.array(slotSchema).max(12).default([]),top:z.array(slotSchema).max(12).default([])}).strict().default({}),
 requiredSides:z.array(z.enum(sides)).min(1).max(5).default([...sides]).refine(v=>new Set(v).size===v.length,'Duplicate required side'),
 primaryColor:text(80).nullable().default(null),secondaryColor:text(80).nullable().default(null),rankRestriction:text(100).nullable().default(null),division:text(100).nullable().default(null),
 creator:text(200).nullable().default(null),sourceUrl:nullableUrl,installation:text(3000).default('Use the current in-game ER:LC livery editor; match the official vehicle and each decal position. Submit for review and test manually. No automatic installation is performed.'),
 notes:text(3000).default(''),previewUrl:nullableUrl,
}).strict();
export type LiveryInput=z.infer<typeof liveryInput>;
export const recordSchema=liveryInput.extend({id:z.string().uuid(),version:z.number().int().positive(),createdAt:z.string().datetime(),updatedAt:z.string().datetime(),assetStatus:z.enum(['MISSING','UNVERIFIED','AVAILABLE','UNAVAILABLE']),approval:z.enum(['UNVERIFIED','PENDING','APPROVED','DENIED']),tested:z.boolean(),lastVerifiedAt:date,verificationEvidence:text(1500).default(''),verifiedBy:z.literal(LIVERY_OWNER).nullable().default(null)}).strict();
export type LiveryRecord=z.infer<typeof recordSchema>;
export const vehicleSchema=z.object({name:text().min(1),category:text(80).default('Unclassified'),departments:z.array(departmentSchema).min(1).max(7),confirmedDepartments:z.array(departmentSchema).default([]),sourceUrl:https,status:z.enum(['TEMPLATE_DOCUMENTED','UNVERIFIED','CONFIRMED_IN_GAME']).default('UNVERIFIED'),observedAt:z.string().datetime(),lastVerifiedAt:date,evidence:text(1500).default('')}).strict();
export type Vehicle=z.infer<typeof vehicleSchema>;
export const defaultRanks:Record<Department,string[]>={NYPD:['Officer','Senior Officer','Sergeant','Lieutenant','Captain','Commander','Chief'],NYCSO:['Deputy','Senior Deputy','Sergeant','Lieutenant','Captain','Commander','Sheriff'],NYSP:['Officer','Sergeant','Lieutenant','Captain','Assistant Chief','Chief'],NYFD:['Firefighter','Engineer','Captain','Battalion Chief','Deputy Chief','Fire Chief'],NYDOT:['Operator','Senior Operator','Supervisor','Manager'],SPECIAL_OPERATIONS:['Operator','Supervisor','Command']};
export const librarySchema=z.object({schemaVersion:z.literal(1),records:z.array(recordSchema).max(10000),vehicles:z.array(vehicleSchema).max(1000),ranks:z.preprocess(value=>{if(!value||typeof value!=='object'||Array.isArray(value))return value;const output:Record<string,unknown[]>={};for(const [key,ranks]of Object.entries(value)){if(!Array.isArray(ranks))return value;const name=String(canonicalDepartment(key));output[name]=[...new Set([...(output[name]??[]),...ranks])];}return output;},z.record(z.enum(departments),z.array(text(100).min(1)).max(50))),history:z.array(z.object({at:z.string(),actor:z.literal(LIVERY_OWNER),action:text(60),entity:text(100)})).max(500)}).strict();
export type Library=z.infer<typeof librarySchema>;
export const emptyLibrary=():Library=>({schemaVersion:1,records:[],vehicles:[],ranks:structuredClone(defaultRanks),history:[]});
export function missing(record:LiveryInput){return record.requiredSides.flatMap(side=>record.decals[side].length?record.decals[side].filter(slot=>!slot.assetId).map(slot=>`${side}: ${slot.position}`):[`${side}: MISSING`]);}
export function fingerprint(record:LiveryInput){return JSON.stringify([record.department,record.vehicleName,record.name,record.rankRestriction??'',record.division??''].map(value=>value.trim().toLocaleLowerCase('en-US')));}
