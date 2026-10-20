import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import { z } from 'zod';
import { db,audit,changed } from '../../../packages/shared/src/database.js';
import { demand,allowed,agencyAccess,requireAgency } from '../../../packages/shared/src/permissions.js';
import { mapFeatureSchema,calibrationSchema,mapVariants,projectWorld,mapPoint } from '../../../packages/shared/src/map.js';
import { ids } from '../../../config/ids.js';
import type { CommunityService } from '../../bot/src/service.js';
const demo=()=>process.env.DEMO_MODE==='true'&&process.env.NODE_ENV!=='production';
const configId=()=>`MAP-CONFIG:${ids.guildId||'LOCAL'}:${demo()}`;
const mapData=z.object({title:z.string(),narrative:z.string(),workflow:z.literal('map_v1'),anchors:z.union([z.tuple([]),calibrationSchema]),revision:z.number().int().positive()});
export function configureMap(app:Express,service:CommunityService){
 app.use('/api/map',(req,res,next)=>{demand(req.principal,'dispatcher','police','sheriff','fire','ems','dot');next();});
 app.get('/api/map/image/:variant',(req,res)=>{const variant=z.enum(mapVariants).parse(req.params.variant),filename=path.resolve('assets/maps',variant+'.png');if(!fs.existsSync(filename))return res.status(404).json({error:'Install official maps with npm run map:fetch.'});res.set('Cache-Control','private, max-age=86400');res.sendFile(filename,{cacheControl:false});});
 app.get('/api/map',async(req,res)=>{
  const config=await db.cadRecord.findUnique({where:{id:configId()}}),data=config?mapData.parse(config.data):{anchors:[],revision:1};
  const agencies=['police','sheriff','fire','ems','dot','dispatch'].filter(a=>agencyAccess(req.principal,a));
  const [features,incidents,units]=await Promise.all([
   db.cadRecord.findMany({where:{kind:'map_feature',demo:demo(),agency:{in:agencies},status:'active'},orderBy:{createdAt:'asc'},take:1000}),
   db.incident.findMany({where:{demo:demo(),agency:{in:agencies},status:{not:'closed'},mergedIntoId:null},select:{id:true,type:true,agency:true,priority:true,status:true,location:true,coordinates:true,source:true},take:500}),
   db.unit.findMany({where:{agency:{in:agencies},status:{not:'out_of_service'}},select:{id:true,userId:true,callsign:true,agency:true,status:true,coordinates:true,location:true,locationSource:true,updatedAt:true},take:500})]);
  const live=service.store.guild(ids.guildId||'DEMO_GUILD').live,at=live?.synced?new Date(live.synced).getTime():0;
  const players=(live?.players??[]).filter((p:any)=>{const team=String(p.Team??'').toLowerCase();const agency=/police/.test(team)?'police':/sheriff/.test(team)?'sheriff':/fire/.test(team)?'fire':/ems|medical/.test(team)?'ems':/dot|transport/.test(team)?'dot':null;return agency?agencies.includes(agency):allowed(req.principal,'dispatcher','supervisor');}).map((p:any)=>({player:p.Player,team:p.Team??'Unknown',callsign:p.Callsign??'',location:p.Location??null,point:p.Location?projectWorld(data.anchors,p.Location.LocationX,p.Location.LocationZ):null}));
  res.json({config:{version:config?.version??0,revision:data.revision,anchors:data.anchors},variants:mapVariants.map(v=>({id:v,installed:fs.existsSync(path.resolve('assets/maps',v+'.png'))})),features:features.filter(f=>(f.data as any).revision===data.revision),incidents,units,players,telemetry:{at:live?.synced??null,healthy:Boolean(live?.healthy),stale:!live?.healthy||!at||Date.now()-at>120000},canManage:allowed(req.principal,'management'),canDraw:allowed(req.principal,'dispatcher','supervisor'),unitFreshnessMinutes:ids.settings.unitFreshnessMinutes});
 });
 app.put('/api/map/unit',async(req,res)=>{
  const body=z.object({version:z.number().int().positive(),point:mapPoint}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{const unit=await tx.unit.findUniqueOrThrow({where:{userId:req.principal.id}});requireAgency(req.principal,unit.agency);if(unit.status==='out_of_service')throw Error('Go on duty before placing your unit.');const config=await tx.cadRecord.findUnique({where:{id:configId()}}),revision=config?mapData.parse(config.data).revision:1;const count=await tx.unit.updateMany({where:{id:unit.id,version:body.version},data:{coordinates:{...body.point,mapRevision:revision,reportedAt:new Date().toISOString()},locationSource:'MANUAL_ROLEPLAY',version:{increment:1}}});if(!count.count)throw Object.assign(Error('Unit changed; refresh first.'),{status:409});const row=await tx.unit.findUniqueOrThrow({where:{id:unit.id}});await audit(req.principal.id,'map.unit-location',unit.id,null,{coordinates:row.coordinates,source:row.locationSource},tx);return row;});changed();res.json(result);
 });
 app.put('/api/map/calibration',async(req,res)=>{
  demand(req.principal,'management');const body=z.object({version:z.number().int().nonnegative(),anchors:z.union([z.tuple([]),calibrationSchema])}).strict().parse(req.body);
  const result=await db.$transaction(async tx=>{const previous=await tx.cadRecord.findUnique({where:{id:configId()}}),previousData=previous?mapData.parse(previous.data):null;const data={title:'Map calibration',narrative:'Measured world X/Z to map image alignment',workflow:'map_v1',anchors:body.anchors,revision:previousData?.revision??1};if(previous){const count=await tx.cadRecord.updateMany({where:{id:previous.id,version:body.version},data:{data,version:{increment:1}}});if(!count.count)throw Object.assign(Error('Calibration changed; refresh first.'),{status:409});}else{if(body.version!==0)throw Object.assign(Error('Calibration changed; refresh first.'),{status:409});await tx.cadRecord.create({data:{id:configId(),kind:'map_config',agency:'dispatch',ownerId:req.principal.id,demo:demo(),data}});}await audit(req.principal.id,'map.calibrate',configId(),previous?.data??null,data,tx);return tx.cadRecord.findUniqueOrThrow({where:{id:configId()}});});changed();res.json(result);
 });
 app.post('/api/map/features',async(req,res)=>{
  demand(req.principal,'dispatcher','supervisor');const body=mapFeatureSchema.parse(req.body);requireAgency(req.principal,body.agency);
  const result=await db.$transaction(async tx=>{const config=await tx.cadRecord.findUnique({where:{id:configId()}}),revision=config?mapData.parse(config.data).revision:1;
   if(await tx.cadRecord.count({where:{kind:'map_feature',demo:demo(),status:'active'}})>=1000)throw Error('Archive an old feature before adding another.');
   const row=await tx.cadRecord.create({data:{kind:'map_feature',agency:body.agency,ownerId:req.principal.id,demo:demo(),status:'active',data:{...body,revision,workflow:'map_v1',title:body.label,narrative:body.notes}}});await audit(req.principal.id,'map.feature-create',row.id,null,row,tx);return row;});changed();res.status(201).json(result);
 });
 app.delete('/api/map/features/:id',async(req,res)=>{
  demand(req.principal,'dispatcher','supervisor');const body=z.object({version:z.number().int().positive(),reason:z.string().trim().min(5).max(500)}).strict().parse(req.body);
  await db.$transaction(async tx=>{const row=await tx.cadRecord.findFirstOrThrow({where:{id:String(req.params.id),kind:'map_feature',demo:demo(),status:'active'}});requireAgency(req.principal,row.agency);const count=await tx.cadRecord.updateMany({where:{id:row.id,version:body.version,status:'active'},data:{status:'removed',version:{increment:1}}});if(!count.count)throw Object.assign(Error('Feature changed; refresh first.'),{status:409});await audit(req.principal.id,'map.feature-remove',row.id,row,{reason:body.reason},tx);});changed();res.json({ok:true});
 });
}
