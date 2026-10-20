import type { Express } from 'express';
import fs from 'node:fs/promises';
import { z } from 'zod';
import { PDFDocument,StandardFonts,rgb,type PDFImage } from 'pdf-lib';
import { zip } from 'fflate';
import { createHash } from 'node:crypto';
import { db,audit } from '../../../packages/shared/src/database.js';
import { demand } from '../../../packages/shared/src/permissions.js';
import { recordAccess,evidenceBytes } from './evidence.js';
const printable=(value:string)=>value.normalize('NFKD').replace(/[^\x20-\x7e\n]/g,'?');
export async function reportPdf(record:Record<string,any>){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);doc.setTitle('LASRP '+(record.data.title??record.id));doc.setAuthor('Los Angeles State Roleplay');
 let logo:PDFImage|undefined;try{logo=await doc.embedPng(await fs.readFile('assets/branding/la-logo.png'));}catch{}
 let page=doc.addPage([612,792]),y=0;
 const newPage=(first=false)=>{if(!first)page=doc.addPage([612,792]);page.drawRectangle({x:0,y:714,width:612,height:78,color:rgb(.025,.07,.15)});if(logo)page.drawImage(logo,{x:46,y:732,width:32,height:32});page.drawText('LOS ANGELES STATE ROLEPLAY',{x:90,y:752,size:15,font:bold,color:rgb(1,1,1)});page.drawText('CAD / MDT - FICTIONAL ROLEPLAY RECORD',{x:90,y:734,size:9,font,color:rgb(.75,.83,.95)});page.drawText('LASRP | '+String(doc.getPageCount())+' | Generated '+new Date().toISOString(),{x:46,y:25,size:8,font,color:rgb(.3,.4,.55)});y=690;};newPage(true);
 const line=(text:string,heading=false)=>{if(y<55)newPage();page.drawText(text,{x:46,y,size:heading?12:10,font:heading?bold:font,color:rgb(.04,.09,.18)});y-=heading?20:14;};
 const wrap=(value:string)=>{for(const paragraph of printable(value).split('\n')){let current='';for(const word of paragraph.split(/\s+/)){for(let i=0;i<word.length||i===0;i+=45){const piece=word.slice(i,i+45),candidate=current?(current+' '+piece):piece;if(font.widthOfTextAtSize(candidate,10)>520&&current){line(current);current=piece;}else current=candidate;}}line(current);}};
 wrap(String(record.data.title??record.id));wrap(`Reference: ${record.id}\nAgency: ${record.agency}\nKind: ${record.kind}\nStatus: ${record.status}\nVersion: ${record.version}\nSealed: ${Boolean(record.sealed)}\nCreated: ${new Date(record.createdAt).toISOString()}`);line('Narrative',true);wrap(String(record.data.narrative??record.data.summary??'No narrative.'));
 line('Structured details',true);const details=JSON.stringify(record.data,null,2);wrap(details.slice(0,50000));if(details.length>50000)wrap('PDF detail limit reached. The bulk ZIP contains the complete JSON record.');wrap('This document contains fictional community roleplay records. Unsupported PDF font characters use ?; complete Unicode text remains in the JSON export.');
 return Buffer.from(await doc.save());
}
const zipAsync=(files:Record<string,Uint8Array>)=>new Promise<Uint8Array>((resolve,reject)=>zip(files,{level:6},(error,data)=>error?reject(error):resolve(data)));
export function configureExports(app:Express){
 let active=0;const slot:import('express').RequestHandler=(req,res,next)=>{if(active>=2)return void res.status(429).json({error:'Export capacity is busy. Try again shortly.'});active++;let released=false;const release=()=>{if(!released){released=true;active--;}};res.once('finish',release);res.once('close',release);next();};
 app.get('/api/records/:id/pdf',slot,async(req,res)=>{const record=await recordAccess(String(req.params.id),req.principal),bytes=await reportPdf(record);await audit(req.principal.id,'report.pdf-export',record.id,null,{version:record.version});res.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="LASRP-${record.id.replace(/[^a-zA-Z0-9_-]/g,'')}.pdf"`,'Cache-Control':'no-store'}).send(bytes);});
 app.post('/api/exports',slot,async(req,res)=>{
  demand(req.principal,'supervisor');const body=z.object({recordIds:z.array(z.string().min(1)).min(1).max(20).refine(v=>new Set(v).size===v.length,'Choose unique records.'),includeEvidence:z.boolean().default(false)}).strict().parse(req.body);
  const rows=[];for(const id of body.recordIds)rows.push(await recordAccess(id,req.principal));
  const evidence=body.includeEvidence?await db.evidence.findMany({where:{recordId:{in:body.recordIds}}}):[];
  if(evidence.length>100||evidence.reduce((sum,e)=>sum+e.byteCount,0)>32*1024*1024)throw Object.assign(Error('Choose a smaller batch: evidence exports are limited to 100 files and 32 MiB.'),{status:413});
  const files:Record<string,Uint8Array>={},manifest:{path:string;sha256:string;bytes:number}[]=[];let totalBytes=0;
  const add=(path:string,bytes:Uint8Array)=>{totalBytes+=bytes.byteLength;if(totalBytes>64*1024*1024)throw Object.assign(Error('Export exceeds the 64 MiB total content limit. Choose a smaller batch.'),{status:413});files[path]=bytes;manifest.push({path,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.byteLength});};
  for(const row of rows){const safe=row.id.replace(/[^a-zA-Z0-9_-]/g,'_');add('records/'+safe+'.json',Buffer.from(JSON.stringify(row,null,2)));add('records/'+safe+'.pdf',await reportPdf(row));const history=await db.auditEvent.findMany({where:{entityId:row.id},orderBy:{createdAt:'asc'},take:1000});add('history/'+safe+'.json',Buffer.from(JSON.stringify(history,null,2)));}
  for(const item of evidence){const ext=({ 'image/png':'.png','image/jpeg':'.jpg','application/pdf':'.pdf','text/plain':'.txt'} as Record<string,string>)[item.mimeType]??'.bin';add('evidence/'+item.id.replace(/[^a-zA-Z0-9_-]/g,'_')+ext,await evidenceBytes(item));const custody=await db.evidenceCustody.findMany({where:{evidenceId:item.id},orderBy:{createdAt:'asc'},take:1000});add('custody/'+item.id.replace(/[^a-zA-Z0-9_-]/g,'_')+'.json',Buffer.from(JSON.stringify(custody,null,2)));}
  files['manifest.json']=Buffer.from(JSON.stringify({community:'Los Angeles State Roleplay',generatedAt:new Date().toISOString(),exportedBy:req.principal.id,limits:{auditRowsPerRecord:1000,custodyRowsPerFile:1000},evidence:evidence.map(e=>({id:e.id,recordId:e.recordId,originalName:e.originalName,mimeType:e.mimeType,byteCount:e.byteCount,checksum:e.checksum})),files:manifest},null,2));
  const zipped=await zipAsync(files);
  for(const row of rows){const latest=await recordAccess(row.id,req.principal);if(latest.version!==row.version)throw Object.assign(Error('A report changed during export. Generate a fresh export.'),{status:409});}
  await db.$transaction(async tx=>{for(const item of evidence)await tx.evidenceCustody.create({data:{evidenceId:item.id,actorId:req.principal.id,action:'exported',note:'Authorized bulk export; stored SHA-256 integrity verified.'}});await audit(req.principal.id,'report.bulk-export',body.recordIds.join(','),null,{recordIds:body.recordIds,evidenceCount:evidence.length,bytes:zipped.length},tx);});
  res.set({'Content-Type':'application/zip','Content-Disposition':'attachment; filename="LASRP-CAD-export.zip"','Cache-Control':'no-store'}).send(Buffer.from(zipped));
 });
}
