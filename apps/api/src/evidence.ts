import express from 'express';
import type { Express } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { demand,requireAgency,requireRecord,type Principal } from '../../../packages/shared/src/permissions.js';
import { scanEvidence,scanMode } from './scanner.js';
import { recordKinds } from '../../../packages/shared/src/schemas.js';
const demo=()=>process.env.DEMO_MODE==='true'&&process.env.NODE_ENV!=='production';
const directory=fileURLToPath(new URL('../../../data/evidence/',import.meta.url));
const limit=8*1024*1024;
function key(){const value=process.env.FILE_STORAGE_SECRET;if(!value||!/^[a-f\d]{64}$/i.test(value))throw Object.assign(Error('Management must configure FILE_STORAGE_SECRET as 64 hexadecimal characters before uploading evidence.'),{status:503});return Buffer.from(value,'hex');}
function storedPath(storageKey:string){if(!/^[a-f\d-]{36}\.enc$/i.test(storageKey))throw Error('Invalid evidence storage reference');const target=path.resolve(directory,storageKey);if(!target.startsWith(path.resolve(directory)+path.sep))throw Error('Invalid evidence storage path');return target;}
export function inspectEvidence(bytes:Buffer,name:string){
 if(bytes.length===0||bytes.length>limit)throw Error('Evidence files must be between 1 byte and 8 MiB.');
 if(!name||name.length>128||/[\x00-\x1f\x7f/\\]/.test(name))throw Error('Choose a filename without path separators or control characters.');
 const ext=path.extname(name).toLowerCase();
 if(ext==='.png'&&bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return 'image/png';
 if(['.jpg','.jpeg'].includes(ext)&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(ext==='.pdf'&&bytes.subarray(0,5).toString()==='%PDF-')return 'application/pdf';
 if(ext==='.txt'){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('Text evidence must use UTF-8.');}if(bytes.includes(0))throw Error('Binary content cannot be uploaded as text evidence.');return 'text/plain';}
 throw Error('Supported evidence: PNG, JPEG, PDF, and UTF-8 TXT with matching file signatures.');
}
export async function recordAccess(recordId:string,user:Principal,write=false){const record=await db.cadRecord.findUniqueOrThrow({where:{id:recordId,demo:demo()}});if(!(recordKinds as readonly string[]).includes(record.kind))throw Object.assign(Error('Agency report not found.'),{status:404});requireRecord(user,record);if(write&&record.ownerId!==user.id)demand(user,'supervisor');return record;}
export async function evidenceBytes(evidence:{storageKey:string;byteCount:number;checksum:string}){const encrypted=await fs.readFile(storedPath(evidence.storageKey));if(encrypted.length<28)throw Error('Evidence storage integrity check failed');const decipher=createDecipheriv('aes-256-gcm',key(),encrypted.subarray(0,12));decipher.setAuthTag(encrypted.subarray(12,28));const plain=Buffer.concat([decipher.update(encrypted.subarray(28)),decipher.final()]);if(plain.length!==evidence.byteCount||createHash('sha256').update(plain).digest('hex')!==evidence.checksum)throw Error('Evidence storage integrity check failed');return plain;}
export function configureEvidence(app:Express){
 let uploads=0;const uploadSlot:express.RequestHandler=(req,res,next)=>{if(uploads>=4)return void res.status(429).json({error:'Evidence upload capacity is busy. Try again shortly.'});uploads++;let released=false;const release=()=>{if(!released){released=true;uploads--;}};res.once('finish',release);res.once('close',release);next();};
 app.get('/api/records/:id/evidence',async(req,res)=>{const record=await recordAccess(String(req.params.id),req.principal);const evidence=await db.evidence.findMany({where:{recordId:record.id},select:{id:true,recordId:true,uploaderId:true,originalName:true,mimeType:true,byteCount:true,checksum:true,createdAt:true},orderBy:{createdAt:'asc'},take:100});res.json({scanMode:scanMode(),recordVersion:record.version,uploadsEnabled:Boolean(process.env.FILE_STORAGE_SECRET&&/^[a-f\d]{64}$/i.test(process.env.FILE_STORAGE_SECRET)),files:evidence});});
 app.post('/api/records/:id/evidence',uploadSlot,express.raw({type:'application/octet-stream',limit}),async(req,res)=>{
  const record=await recordAccess(String(req.params.id),req.principal,true),version=z.coerce.number().int().positive().parse(req.headers['x-record-version']);
  if(!Buffer.isBuffer(req.body))throw Error('Upload a binary file with Content-Type application/octet-stream.');
  let name:string;try{name=decodeURIComponent(String(req.headers['x-file-name']??''));}catch{throw Error('Invalid encoded filename');}
  const bytes=req.body as Buffer,mimeType=inspectEvidence(bytes,name),storageKey=randomUUID()+'.enc',encryptionKey=key();
  const scan=await scanEvidence(bytes);
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey,nonce),encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
  const filename=storedPath(storageKey);await fs.mkdir(directory,{recursive:true});await fs.writeFile(filename,Buffer.concat([nonce,cipher.getAuthTag(),encrypted]),{flag:'wx',mode:0o600});
  try{
   const result=await db.$transaction(async tx=>{
    const update=await tx.cadRecord.updateMany({where:{id:record.id,version},data:{version:{increment:1}}});if(!update.count)throw Object.assign(Error('The report changed. Refresh its evidence list before uploading.'),{status:409});
    const evidence=await tx.evidence.create({data:{recordId:record.id,uploaderId:req.principal.id,originalName:name,mimeType,byteCount:bytes.length,checksum:createHash('sha256').update(bytes).digest('hex'),storageKey},select:{id:true,recordId:true,originalName:true,mimeType:true,byteCount:true,checksum:true,createdAt:true}});
    await tx.evidenceCustody.create({data:{evidenceId:evidence.id,actorId:req.principal.id,action:'uploaded',note:'Original binary encrypted and SHA-256 fingerprint recorded. Scan: '+scan}});await audit(req.principal.id,'evidence.upload',evidence.id,null,{...evidence,scan},tx);return {...evidence,scan,recordVersion:version+1};
   });changed();res.status(201).json(result);
  }catch(error){await fs.unlink(filename).catch(()=>{});throw error;}
 });
 app.get('/api/evidence/:id/download',async(req,res)=>{
  const evidence=await db.evidence.findUniqueOrThrow({where:{id:String(req.params.id)}});await recordAccess(evidence.recordId,req.principal);
  const encrypted=await fs.readFile(storedPath(evidence.storageKey));if(encrypted.length<28)throw Error('Evidence storage integrity check failed');
  const decipher=createDecipheriv('aes-256-gcm',key(),encrypted.subarray(0,12));decipher.setAuthTag(encrypted.subarray(12,28));const plain=Buffer.concat([decipher.update(encrypted.subarray(28)),decipher.final()]);
  if(plain.length!==evidence.byteCount||createHash('sha256').update(plain).digest('hex')!==evidence.checksum)throw Error('Evidence storage integrity check failed');
  await db.$transaction(async tx=>{await tx.evidenceCustody.create({data:{evidenceId:evidence.id,actorId:req.principal.id,action:'downloaded',note:'Access authorized; stored fingerprint verified before delivery.'}});await audit(req.principal.id,'evidence.download',evidence.id,null,{checksum:evidence.checksum},tx);});
  res.set({'Content-Type':evidence.mimeType,'Content-Disposition':`attachment; filename="evidence-${evidence.id}${path.extname(evidence.originalName).toLowerCase()}"; filename*=UTF-8''${encodeURIComponent(evidence.originalName).replace(/'/g,'%27')}`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cache-Control':'no-store'}).send(plain);
 });
 app.get('/api/evidence/:id/custody',async(req,res)=>{const evidence=await db.evidence.findUniqueOrThrow({where:{id:String(req.params.id)}});await recordAccess(evidence.recordId,req.principal);await audit(req.principal.id,'evidence.custody-view',evidence.id,null,{});res.json(await db.evidenceCustody.findMany({where:{evidenceId:evidence.id},orderBy:{createdAt:'asc'},take:500}));});
}
