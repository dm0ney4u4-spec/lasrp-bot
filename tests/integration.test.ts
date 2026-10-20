import {ids}from'../config/ids.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Client,Collection,ChannelType,Events,AuditLogEvent } from 'discord.js';
import { JSDOM } from 'jsdom';
import type { CommunityService } from '../apps/bot/src/service.js';

test('PostgreSQL integration: real migrations, CAD routes, privacy, concurrency and applications',async t=>{
 const engine=await PGlite.create();for(const name of fs.readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort())await engine.exec(fs.readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8'));
 const socket=new PGLiteSocketServer({db:engine,host:'127.0.0.1',port:54339,maxConnections:1});await socket.start();
 process.env.DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54339/postgres?connection_limit=1';process.env.DEMO_MODE='true';process.env.APP_SESSION_SECRET='test-session-secret-abcdefghijklmnopqrstuvwxyz';
 const {db}=await import('../packages/shared/src/database.js');const {configureCad}=await import('../apps/api/src/cad.js');const {configureAuth}=await import('../apps/api/src/auth.js');const {Applications}=await import('../apps/bot/src/applications.js');
 const g={config:{applicationSettings:{open:true,requirements:'Test requirements',cooldownHours:0,questions:['Question one','Question two']}},sessions:[],records:{},cases:{},tickets:{},shifts:{},history:[]};
 const service={store:{guild:()=>g},client:{isReady:()=>false}} as unknown as CommunityService;
 const app=express();app.use(express.json());
 app.use((req,res,next)=>{const role=String(req.headers['x-test-role']??'owner');const groups:Record<string,any[]>={owner:['owner'],civilian:['civilian'],police:['police'],police2:['police'],dispatcher:['dispatcher'],ems:['ems'],fire:['fire'],dot:['dot'],doj:['doj'],defense:['doj','defense'],judge:['doj','judge'],clerk:['doj','clerk']};req.principal={id:'TEST_'+role.toUpperCase(),name:'TEST',roles:[],groups:groups[role]??['civilian']};next();});
 app.get('/api/me',(req,res)=>res.json({user:req.principal,csrf:'TEST_CSRF',demo:true,features:{courts:false}}));configureCad(app,service);
 app.use((e:Error&{status?:number},req:express.Request,res:express.Response,next:express.NextFunction)=>res.status(e.status??400).json({error:e.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const address=server.address() as {port:number},url=`http://127.0.0.1:${address.port}`;
 const request=async(path:string,method='GET',body?:unknown,role='owner')=>{const response=await fetch(url+'/api'+path,{method,headers:{'Content-Type':'application/json','x-test-role':role},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 try{
  await db.user.createMany({data:['OWNER','CIVILIAN','POLICE','POLICE2','DISPATCHER','EMS','FIRE','DOT','DOJ','DEFENSE','JUDGE','CLERK'].map(name=>({id:'TEST_'+name,displayName:'Test '+name}))});
  await t.test('radio requires agency duty, restricts priority broadcasts and deduplicates acknowledgments',async()=>{
   const unit=await db.unit.create({data:{userId:'TEST_POLICE2',callsign:'RADIO-TEST',agency:'police',status:'available'}});
   try{assert.equal((await request('/radio','POST',{agency:'police',text:'Fictional priority test',priority:true},'police2')).status,403);const message=await request('/radio','POST',{agency:'police',text:'Fictional unit radio check',priority:false},'police2');assert.equal(message.status,201);
    assert.equal((await request('/radio/'+message.data.id+'/ack','POST',{},'ems')).status,403);assert.equal((await request('/radio/'+message.data.id+'/ack','POST',{},'police2')).status,200);assert.equal((await request('/radio/'+message.data.id+'/ack','POST',{},'police2')).status,200);const messages=await request('/radio?agency=police','GET',undefined,'police2');assert.equal(messages.data.find((r:any)=>r.id===message.data.id).acknowledgments,1);
   }finally{await db.unit.delete({where:{id:unit.id}});}
  });
  await t.test('specialized reports validate typed fields and cannot turn allegations into convictions',async()=>{
   const base={kind:'search_seizure',agency:'police',data:{title:'Fictional search inventory',narrative:'A fictional search and property inventory training report.',disposition:'accusation',evidenceUrls:[]}};
   assert.equal((await request('/records','POST',base,'police')).status,400);const created=await request('/records','POST',{...base,data:{...base.data,details:{type:'search_seizure',basis:'Fictional consent documented',items:'One fictional training item'}}},'police');assert.equal(created.status,201);
   assert.equal((await request('/records/'+created.data.id,'PATCH',{version:1,data:base.data},'police')).status,400);
   assert.equal((await request('/records','POST',{...base,data:{...base.data,disposition:'conviction',details:{type:'search_seizure',basis:'Fictional search authority',items:'Training evidence'}}},'police')).status,400);
   assert.equal((await request('/records','POST',{kind:'highway_assistance',agency:'police',data:{...base.data,details:{type:'highway_assistance',service:'debris',outcome:'Fictional road cleared'}}},'police')).status,400);
   assert.equal((await request('/records?agency=dispatch&kind=evidence_control')).status,400);
  });
  await t.test('sealed court records restrict lists, histories and PDF exports to authorized parties',async()=>{
   const {ids}=await import('../config/ids.js');const previous=ids.featureFlags.courts;ids.featureFlags.courts=true;
   try{const person=await db.civilianCharacter.create({data:{ownerId:'TEST_OWNER',name:'Fictional Sealed Subject',demo:true}}),report=await db.cadRecord.create({data:{kind:'incident_report',agency:'police',ownerId:'TEST_POLICE',status:'submitted',demo:true,data:{title:'Court source',narrative:'Fictional court source narrative'}}});const file=await request('/court-cases','POST',{title:'Fictional sealed proceeding',narrative:'A fictional proceeding testing restricted court access.',subjectId:person.id,reportIds:[report.id]});assert.equal(file.status,201);
    const seal=await request('/court-cases/'+file.data.id+'/access','POST',{version:1,sealed:true,reason:'Fictional judicial sealing order'});assert.equal(seal.status,200);
    assert.equal((await request('/court-cases','GET',undefined,'doj')).data.length,0);assert.equal((await request('/record-history/'+file.data.id,'GET',undefined,'doj')).status,403);
    assert.equal((await fetch(`${url}/api/records/${file.data.id}/pdf`,{headers:{'x-test-role':'doj'}})).status,403);
    assert.equal((await request('/records?agency=doj','GET',undefined,'doj')).data.length,0);
    const parties=await request('/court-cases/'+file.data.id+'/access','POST',{version:2,sealed:true,defenseId:'TEST_DEFENSE',reason:'Appoint fictional defense counsel'});assert.equal(parties.status,200);
    assert.equal((await request('/court-cases','GET',undefined,'defense')).data.length,1);assert.equal((await request('/record-history/'+file.data.id,'GET',undefined,'defense')).status,200);
    assert.equal((await request('/court-cases/'+file.data.id+'/access','POST',{version:3,sealed:false,reason:'Unauthorized unsealing attempt'},'defense')).status,403);
   }finally{ids.featureFlags.courts=previous;}
  });
  await t.test('mutual aid preserves agency privacy, rejects duplicates and requires a completed receiving call',async()=>{
   const source=(await request('/incidents','POST',{location:'Fictional aid site',narrative:'Private source agency narrative.',type:'Training assistance',priority:3,agency:'police'},'police')).data;
   const body={incidentId:source.id,version:1,agency:'ems',summary:'Only this fictional aid summary is shared.'};
   assert.equal((await request('/mutual-aid','POST',body,'police')).status,403);const aid=await request('/mutual-aid','POST',body);assert.equal(aid.status,201);
   assert.equal((await request('/mutual-aid','POST',{...body,version:2})).status,409);
   assert.equal((await request('/incidents/'+source.id,'GET',undefined,'ems')).status,403);
   const receiver=await request('/mutual-aid','GET',undefined,'ems');assert.equal(receiver.data.length,1);assert.equal(receiver.data[0].data.narrative,body.summary);
   assert.equal((await request('/mutual-aid','GET',undefined,'fire')).data.length,0);
   const accepted=await request('/mutual-aid/'+aid.data.id+'/respond','POST',{version:1,status:'accepted',reason:'Fictional EMS assistance approved.'});assert.equal(accepted.status,200);
   const response=await db.incident.findUniqueOrThrow({where:{id:accepted.data.data.responseIncidentId}});assert.equal(response.agency,'ems');assert.equal(response.narrative,body.summary);
   assert.equal((await request('/mutual-aid/'+aid.data.id+'/respond','POST',{version:2,status:'completed',reason:'Response is not closed yet'})).status,400);
   await request('/incidents/'+response.id,'PATCH',{version:1,status:'closed'});assert.equal((await request('/mutual-aid/'+aid.data.id+'/respond','POST',{version:2,status:'completed',reason:'Fictional response concluded'})).status,200);
   assert.equal((await request('/records/'+aid.data.id,'PATCH',{version:3,status:'closed'})).status,400);
  });
  await t.test('investigation tasks enforce assignees, state transitions and completion before case closure',async()=>{
   const file=await request('/legal','POST',{kind:'investigation',agency:'police',title:'Fictional detective exercise',narrative:'A fictional investigation with an assigned follow-up task.'},'police');assert.equal(file.status,201);
   const task=await request('/legal/'+file.data.id+'/tasks','POST',{version:1,title:'Collect fictional witness statement'},'police');assert.equal(task.status,201);
   assert.equal((await request('/legal/'+file.data.id+'/tasks','GET',undefined,'ems')).status,403);
   assert.equal((await request('/legal/'+file.data.id+'/tasks/'+task.data.id,'PATCH',{version:2,status:'in_progress',note:'Unauthorized progress attempt'},'police2')).status,403);
   assert.equal((await request('/legal/'+file.data.id+'/action','POST',{version:2,action:'submit',reason:'Submitted for review'},'police')).status,200);
   assert.equal((await request('/legal/'+file.data.id+'/action','POST',{version:3,action:'approve',reason:'Independent case review'})).status,200);
   assert.equal((await request('/legal/'+file.data.id+'/action','POST',{version:4,action:'close',reason:'Unfinished task remains'})).status,400);
   assert.equal((await request('/legal/'+file.data.id+'/tasks/'+task.data.id,'PATCH',{version:4,status:'in_progress',note:'Fictional interview underway'},'police')).status,200);
   assert.equal((await request('/legal/'+file.data.id+'/tasks/'+task.data.id,'PATCH',{version:4,status:'completed',note:'Stale completion attempt'},'police')).status,409);
   assert.equal((await request('/legal/'+file.data.id+'/tasks/'+task.data.id,'PATCH',{version:5,status:'completed',note:'Fictional statement collected'},'police')).status,200);
   assert.equal((await request('/legal/'+file.data.id+'/action','POST',{version:6,action:'close',reason:'All follow-up tasks completed'})).status,200);
  });
  await t.test('fictional property/business permits enforce character ownership, private listing and independent review',async()=>{
   const person=await db.civilianCharacter.create({data:{name:'Fictional Business Owner',ownerId:'TEST_POLICE',demo:true}}),body={kind:'business',characterId:person.id,title:'Fictional Training Cafe',location:'Fictional Commerce Way',description:'An invented community roleplay business.'};
   assert.equal((await request('/my-registrations','POST',body,'civilian')).status,403);const created=await request('/my-registrations','POST',body,'police');assert.equal(created.status,201);
   assert.equal((await request('/my-registrations','GET',undefined,'civilian')).data.length,0);assert.equal((await request('/registration-reviews','GET',undefined,'police')).status,403);
   const approved=await request('/registrations/'+created.data.id+'/review','POST',{version:1,status:'approved',reason:'Fictional registration reviewed.'});assert.equal(approved.status,200);
   assert.equal((await request('/registrations/'+created.data.id+'/review','POST',{version:1,status:'revoked',reason:'Stale decision test'})).status,409);
   assert.equal((await request('/records/'+created.data.id,'PATCH',{version:2,status:'closed'})).status,400);
   const own=await db.cadRecord.create({data:{kind:'civilian_registration',agency:'dispatch',ownerId:'TEST_OWNER',status:'submitted',demo:true,data:{workflow:'civilian_v1',title:'Fictional owner permit'}}});assert.equal((await request('/registrations/'+own.id+'/review','POST',{version:1,status:'approved',reason:'Cannot approve myself'})).status,403);
  });
  await t.test('map calibration and overlays persist with agency privacy and optimistic concurrency',async()=>{
   assert.equal((await request('/map','GET',undefined,'civilian')).status,403);
   const anchors=[{worldX:0,worldZ:0,x:50,y:50},{worldX:1000,worldZ:0,x:70,y:50},{worldX:0,worldZ:1000,x:50,y:70}];
   assert.equal((await request('/map/calibration','PUT',{version:0,anchors},'police')).status,403);
   const saved=await request('/map/calibration','PUT',{version:0,anchors});assert.equal(saved.status,200);assert.equal(saved.data.version,1);
   assert.equal((await request('/map/calibration','PUT',{version:0,anchors})).status,409);
   const feature=await request('/map/features','POST',{kind:'patrol',agency:'police',label:'Fictional training patrol',notes:'Community boundary',points:[{x:10,y:10},{x:30,y:10},{x:30,y:30}]});assert.equal(feature.status,201);
   assert.equal((await request('/map/features','POST',{kind:'station',agency:'police',label:'No privilege',points:[{x:50,y:50}]},'police')).status,403);
   assert.equal((await request('/records/'+feature.data.id,'PATCH',{version:1,status:'closed'})).status,400);
   (g as any).live={healthy:true,synced:Date.now(),players:[{Player:'FictionalPolice:101',Team:'Police',Location:{LocationX:500,LocationZ:0,PostalCode:'TEST'}},{Player:'FictionalMedic:102',Team:'EMS',Location:{LocationX:0,LocationZ:500}}]};
   const police=await request('/map','GET',undefined,'police');assert.equal(police.data.features.length,1);assert.equal(police.data.players.length,1);assert.deepEqual(police.data.players[0].point,{x:60,y:50});assert.equal(police.data.telemetry.stale,false);
   const ems=await request('/map','GET',undefined,'ems');assert.equal(ems.data.features.length,0);assert.equal(ems.data.players.length,1);
   (g as any).live.synced=Date.now()-180000;assert.equal((await request('/map')).data.telemetry.stale,true);
   assert.equal((await request('/map/features/'+feature.data.id,'DELETE',{version:99,reason:'Wrong record revision'})).status,409);
   assert.equal((await request('/map/features/'+feature.data.id,'DELETE',{version:1,reason:'Training boundary removed'})).status,200);
   assert.equal((await request('/map','GET',undefined,'police')).data.features.length,0);
   assert.ok(await db.auditEvent.count({where:{entityId:feature.data.id}})>=2);delete (g as any).live;
  });
  await t.test('session RSVP is idempotent and cancelled schedules reject changes; scorecards require independent management',async()=>{
   const {ids}=await import('../config/ids.js');const schedule=await db.scheduledSession.create({data:{guildId:ids.guildId,hostId:'TEST_OWNER',startsAt:new Date(Date.now()+3600000),note:'Fictional community training'}});
   const path='/schedules/'+schedule.id+'/rsvp';assert.equal((await request(path,'PUT',{attending:true},'civilian')).status,200);assert.equal((await request(path,'PUT',{attending:true},'civilian')).status,200);
   const board=await request('/session-board','GET',undefined,'civilian');assert.equal(board.data.schedules.find((s:any)=>s.id===schedule.id).reservations,1);
   await db.scheduledSession.update({where:{id:schedule.id},data:{status:'cancelled'}});assert.equal((await request(path,'PUT',{attending:false},'civilian')).status,409);
   const session=await db.session.create({data:{guildId:ids.guildId,hostId:'TEST_POLICE',status:'ended',endedAt:new Date()}}),body={version:0,coordination:4,professionalism:4,policy:5,notes:'Fictional independent host review.'};
   assert.equal((await request('/sessions/'+session.id+'/scorecard','PUT',body,'police')).status,403);const review=await request('/sessions/'+session.id+'/scorecard','PUT',body);assert.equal(review.status,200);assert.equal(review.data.version,1);
   assert.equal((await request('/sessions/'+session.id+'/scorecard','PUT',body)).status,409);
   const own=await db.session.create({data:{guildId:ids.guildId,hostId:'TEST_OWNER',status:'ended',endedAt:new Date()}});assert.equal((await request('/sessions/'+own.id+'/scorecard','PUT',body)).status,403);
  });
  function staffFixture(initial:string[]){const roles=new Collection<string,any>();let administrator=false;const all=[...ids.staffRankRoles,...ids.legacyStaffRoles,...Object.values(ids.staffTeams),...ids.disciplineRoles.warnings,...ids.disciplineRoles.strikes,ids.disciplineRoles.suspended,ids.disciplineRoles.investigation,ids.disciplineRoles.terminated,ids.disciplineRoles.zeroTolerance,'ROLE_STAFF','UNRELATED'];for(const id of all)roles.set(id,{id,name:id,position:id==='UNRELATED'?1:10+all.indexOf(id),managed:false,permissions:{has:()=>id==='ROLE_STAFF'&&administrator}});const cache=new Collection<string,any>(initial.map(id=>[id,roles.get(id)]));const user={id:'TEST_POLICE',send:async()=>{}};const actor={id:'TEST_OWNER',roles:{highest:{position:900}}};const bot={permissions:{has:()=>true},roles:{highest:{position:1000}}};const target:any={id:user.id,user,roles:{cache,get highest(){return{position:Math.max(0,...[...cache.values()].map(r=>r.position))};},set:async(values:string[])=>{cache.clear();for(const id of values)cache.set(id,roles.get(id));}}};const guild:any={id:'TEST_GUILD',ownerId:'PROTECTED_GUILD_OWNER',members:{fetch:async(value:any)=>(typeof value==='string'?value:value.user)===user.id?target:actor,fetchMe:async()=>bot},roles:{cache:roles,fetch:async(id:string)=>roles.get(id)}};target.guild=guild;const record:any={config:{staffRoles:[ids.staffTeams.staff,'ROLE_STAFF'],managementRoles:[ids.staffTeams.seniorHighRank],rbacRoles:{}},records:{},cases:{}};const service:any={variables:()=>({}),template:()=>({title:'Staff change',sections:['Saved']}),restrictedChannel:async()=>({send:async()=>{}}),store:{guild:()=>record,change:()=>{},save:()=>{},flush:async()=>{}}};return{roles,cache,user,actor,bot,target,guild,record,service,setAdministrator:(value:boolean)=>administrator=value};}
  await t.test('staff promotions and demotions assign the correct team badges and preserve unrelated roles',async()=>{const {staffAction}=await import('../apps/bot/src/staff.js');const f=staffFixture(['UNRELATED']);let action='promote',rank=ids.staffRankRoles[1];const interaction:any={guildId:f.guild.id,guild:f.guild,user:{id:'TEST_OWNER'},options:{getSubcommand:()=>action,getSubcommandGroup:()=>null,getUser:()=>f.user,getString:(key:string)=>key==='id'?null:'Fictional promotion review.',getRole:()=>f.roles.get(rank)},deferReply:async()=>{},editReply:async()=>{}};const principal:any={id:'TEST_OWNER',name:'Test',groups:['owner'],roles:[]};
   for(const next of [ids.staffRankRoles[1],'1529544806555193434','1534213008710959185','1529541841450565773']){rank=next;await staffAction(f.service,interaction,principal);const expected=(await import('../apps/bot/src/staff-roles.js')).rankRoles(rank);assert.deepEqual(new Set(f.cache.keys()),new Set(['UNRELATED',...expected]));}action='demote';rank='1529544864960745553';await staffAction(f.service,interaction,principal);assert.deepEqual(new Set(f.cache.keys()),new Set(['UNRELATED',rank,ids.staffTeams.staff,ids.staffTeams.moderation]));
  });
  await t.test('suspension and investigation restore original staff roles and reject newly privileged roles',async()=>{const {restrictStaff,restoreStaff}=await import('../apps/bot/src/staff-roles.js');const f=staffFixture(['ROLE_STAFF','UNRELATED']);await restrictStaff(f.service,f.target,f.actor as any,f.bot as any,'suspended','Fictional suspension');assert.deepEqual(new Set(f.cache.keys()),new Set(['UNRELATED',ids.disciplineRoles.suspended]));f.setAdministrator(true);await assert.rejects(()=>restoreStaff(f.service,f.target,f.actor as any,f.bot as any,'Fictional reinstatement'),/Administrator/);f.setAdministrator(false);await restoreStaff(f.service,f.target,f.actor as any,f.bot as any,'Fictional reinstatement');assert.deepEqual(new Set(f.cache.keys()),new Set(['UNRELATED','ROLE_STAFF']));assert.ok(f.record.records['profile:TEST_POLICE'].restriction.completedAt);await restrictStaff(f.service,f.target,f.actor as any,f.bot as any,'investigation','Fictional investigation');assert.ok(f.cache.has(ids.disciplineRoles.investigation));assert.ok(!f.cache.has('ROLE_STAFF'));await restoreStaff(f.service,f.target,f.actor as any,f.bot as any,'Investigation cleared');assert.ok(f.cache.has('ROLE_STAFF'));assert.ok(!f.cache.has(ids.disciplineRoles.investigation));});
  await t.test('nine warnings convert to three strikes and termination removes all staff roles',async()=>{const {issueDiscipline}=await import('../apps/bot/src/discipline.js');const f=staffFixture(['UNRELATED',ids.staffTeams.staff,ids.staffTeams.moderation,'1529544864960745553']);for(let n=1;n<=9;n++){const record=await issueDiscipline(f.service,f.target,f.actor as any,f.bot as any,'warning','Fictional warning','Fictional evidence');assert.equal(record.status,'active');if(n===3){assert.ok(!f.cache.has(ids.disciplineRoles.warnings[0]));assert.ok(f.cache.has(ids.disciplineRoles.strikes[0]));}if(n===6)assert.ok(f.cache.has(ids.disciplineRoles.strikes[1]));}assert.deepEqual(new Set(f.cache.keys()),new Set(['UNRELATED',ids.disciplineRoles.terminated]));assert.equal(f.record.records['profile:TEST_POLICE'].status,'terminated');});
  await t.test('warning revocation reverses escalation, and hierarchy failures do not leave pending discipline',async()=>{const {issueDiscipline,revokeDiscipline}=await import('../apps/bot/src/discipline.js');const f=staffFixture(['UNRELATED',ids.staffTeams.staff]);const records:any[]=[];for(let n=0;n<3;n++)records.push(await issueDiscipline(f.service,f.target,f.actor as any,f.bot as any,'warning','Fictional warning','Evidence'));await assert.rejects(()=>revokeDiscipline(f.service,f.target,f.actor as any,f.bot as any,records[0],'Earlier case'),/newer/);await revokeDiscipline(f.service,f.target,f.actor as any,f.bot as any,records[2],'Warning overturned');assert.ok(f.cache.has(ids.disciplineRoles.warnings[1]));assert.ok(!f.cache.has(ids.disciplineRoles.strikes[0]));const blocked=staffFixture(['UNRELATED',ids.staffTeams.staff]);blocked.roles.get(ids.disciplineRoles.warnings[0]).position=2000;await assert.rejects(()=>issueDiscipline(blocked.service,blocked.target,blocked.actor as any,blocked.bot as any,'warning','Fictional warning','Evidence'),/Move the bot/);assert.ok(!blocked.record.records['profile:TEST_POLICE'].pendingInfractionId);assert.deepEqual(new Set(blocked.cache.keys()),new Set(['UNRELATED',ids.staffTeams.staff]));});
  await t.test('agency resources restrict management and validate same-agency station assignments',async()=>{
   const station=await request('/resources','POST',{agency:'fire',kind:'station',code:'FIRE-01',name:'Fictional training station'});assert.equal(station.status,201);
   assert.equal((await request('/resources','POST',{agency:'fire',kind:'apparatus',code:'FIRE-02',name:'Unprivileged engine'},'fire')).status,403);
   assert.equal((await request('/resources','POST',{agency:'ems',kind:'apparatus',code:'EMS-01',name:'Wrong agency station',stationId:station.data.id})).status,400);
   const engine=await request('/resources','POST',{agency:'fire',kind:'apparatus',code:'ENGINE-01',name:'Fictional engine',stationId:station.data.id});assert.equal(engine.status,201);
   assert.equal((await request('/resources?agency=fire','GET',undefined,'police')).status,403);
   const changed=await request('/resources/'+engine.data.id,'PATCH',{version:1,status:'out_of_service',assignedUnitId:null});assert.equal(changed.status,200);
   assert.equal((await request('/resources/'+engine.data.id,'PATCH',{version:1,status:'available'})).status,409);
  });
  await t.test('fictional multi-patient records enforce EMS privacy, transport and case closure',async()=>{
   const data={summary:'Fictional multiple patient exercise.',location:'Fictional EMS training site',patientAlias:'Primary fictional patient',hospital:'Fictional County Medical Center',transportNotes:'Invented roleplay transport',notes:''};
   const incident=await db.operationalCase.create({data:{kind:'ems',agency:'ems',creatorId:'TEST_OWNER',assigneeId:'TEST_OWNER',status:'arrived',data,demo:true}});
   assert.equal((await request('/operational-cases/'+incident.id+'/patients','GET',undefined,'police')).status,403);
   const patient=await request('/operational-cases/'+incident.id+'/patients','POST',{alias:'Invented Patient Alpha',triage:'minor',summary:'Fictional minor injury roleplay.'});assert.equal(patient.status,201);
   assert.equal((await request('/operational-cases/'+incident.id,'PATCH',{version:2,nextStatus:'closed',data})).status,400);
   assert.equal((await request('/patients/'+patient.data.id,'PATCH',{version:1,status:'transporting',hospital:data.hospital,summary:'Skipped treatment stage'})).status,409);
   const treating=await request('/patients/'+patient.data.id,'PATCH',{version:1,status:'treating',summary:'Fictional care started.'});assert.equal(treating.status,200);
   assert.equal((await request('/patients/'+patient.data.id,'PATCH',{version:2,status:'transporting',hospital:'Unconfigured hospital',summary:'Fictional transport.'})).status,400);
   assert.equal((await request('/patients/'+patient.data.id,'PATCH',{version:2,status:'transporting',hospital:data.hospital,summary:'Fictional transport underway.'})).status,200);
   assert.equal((await request('/patients/'+patient.data.id,'PATCH',{version:3,status:'arrived',hospital:data.hospital,summary:'Fictional handoff completed.'})).status,200);
   const current=await db.operationalCase.findUniqueOrThrow({where:{id:incident.id}});assert.equal((await request('/operational-cases/'+incident.id,'PATCH',{version:current.version,nextStatus:'closed',data})).status,200);
   assert.equal((await request('/operational-cases/'+incident.id+'/patients','POST',{alias:'Invented Late Patient',triage:'minor',summary:'Closed incident intake.'})).status,400);
  });
  await t.test('panic needs fresh agency duty, notifies on-duty responders and rejects stale or repeated alerts',async()=>{
   assert.equal((await request('/unit/panic','POST',{version:1,reason:'Fictional emergency test'},'civilian')).status,400);
   await request('/unit','PUT',{callsign:'PANIC-TEST',agency:'police',status:'available',location:'Fictional training site'},'police2');
   const result=await request('/unit/panic','POST',{version:1,reason:'Fictional unit requires urgent assistance'},'police2');assert.equal(result.status,200);assert.equal(result.data.unit.status,'panic');assert.ok(result.data.recipientCount>=1);
   assert.equal((await request('/unit/panic','POST',{version:2,reason:'Repeated fictional emergency'},'police2')).status,429);
   assert.ok(await db.notification.findFirst({where:{userId:'TEST_POLICE2',kind:'panic'}}));
   await db.unit.delete({where:{userId:'TEST_POLICE2'}});
  });
  await t.test('AutoMod synchronization updates owned rules and leaves unrelated rules intact',async()=>{
   const {syncAutomod,desiredRules}=await import('../apps/bot/src/automod.js');const {ids}=await import('../config/ids.js');const {PermissionFlagsBits}=await import('discord.js');const domains=[...ids.automod.blockedDomains];ids.automod.blockedDomains=['blocked.example'];
   const edits:unknown[]=[],creates:unknown[]=[];const rules=new Collection<string,any>([['owned',{id:'owned',name:'LASRP • Mention protection',creatorId:'BOT',edit:async(spec:any)=>{edits.push(spec);return {id:'owned',name:'LASRP • Mention protection',enabled:spec.enabled};}}],['unrelated',{id:'unrelated',name:'LASRP • External',creatorId:'OTHER',edit:()=>{throw Error('Must not edit external rules');}}]]);
   const guild={id:'TEST_GUILD',client:{user:{id:'BOT'}},members:{fetchMe:async()=>({permissions:{has:(permission:bigint)=>permission===PermissionFlagsBits.ManageGuild}})},autoModerationRules:{fetch:async()=>rules,create:async(spec:any)=>{creates.push(spec);return {id:'created',name:spec.name,enabled:spec.enabled};}}};
   try{const result=await syncAutomod(guild as any,'TEST_OWNER');assert.equal(result.length,2);assert.equal(edits.length,1);assert.equal(creates.length,1);assert.equal(desiredRules()[1].triggerMetadata.keywordFilter?.[0],'*blocked.example*');}finally{ids.automod.blockedDomains=domains;}
  });
  await t.test('structured warrants require independent approval, preserve notes and filter expired matches',async()=>{
   const person=await db.civilianCharacter.create({data:{ownerId:'TEST_POLICE',name:'Fictional Warrant Subject',demo:true}});
   const created=await request('/legal','POST',{kind:'warrant',agency:'police',title:'Fictional warrant request',narrative:'A fictional allegation requiring independent supervisory review.',characterIds:[person.id],expiresAt:new Date(Date.now()+3600000).toISOString()},'police');assert.equal(created.status,201);
   assert.equal((await request('/legal?agency=police','GET',undefined,'ems')).status,403);
   const submitted=await request('/legal/'+created.data.id+'/action','POST',{version:1,action:'submit',reason:'Fictional probable cause narrative attached.'},'police');assert.equal(submitted.status,200);
   assert.equal((await request('/legal/'+created.data.id+'/action','POST',{version:2,action:'approve',reason:'Unprivileged approval attempt'},'police')).status,403);
   const issued=await request('/legal/'+created.data.id+'/action','POST',{version:2,action:'approve',reason:'Independent fictional supervisor review'});assert.equal(issued.status,200);assert.equal(issued.data.status,'issued');
   assert.equal((await request('/records/'+created.data.id,'PATCH',{version:3,status:'cancelled'})).status,400);
   const matches=await request('/legal-matches?characterId='+person.id,'GET',undefined,'police');assert.equal(matches.data.length,1);
   const lookup=await request('/lookup?q='+encodeURIComponent('Fictional Warrant Subject'),'GET',undefined,'police');assert.equal(lookup.status,200);assert.ok(lookup.data.records.some((r:any)=>r.id===created.data.id));assert.ok(lookup.data.alerts.some((r:any)=>r.id===created.data.id));assert.ok(lookup.data.legalNotice.includes('not a conviction'));
   assert.equal((await request('/legal/'+created.data.id+'/action','POST',{version:3,action:'expire',reason:'Cannot expire before time'})).status,400);
   await db.cadRecord.update({where:{id:created.data.id},data:{data:{...issued.data.data,expiresAt:new Date(Date.now()-1000).toISOString()}}});
   assert.equal((await request('/legal-matches?characterId='+person.id,'GET',undefined,'police')).data.length,0);
   const expired=await request('/legal/'+created.data.id+'/action','POST',{version:3,action:'expire',reason:'Fictional warrant has expired'});assert.equal(expired.status,200);assert.equal(expired.data.status,'expired');
   assert.equal((await request('/legal/'+created.data.id+'/action','POST',{version:3,action:'note',reason:'Stale edit is rejected'},'police')).status,409);
  });
  await t.test('Roblox OAuth binds state to session, verifies identity and rejects replay',async()=>{
   const {configureRoblox}=await import('../apps/api/src/roblox.js');const clientId=process.env.ROBLOX_OAUTH_CLIENT_ID,clientSecret=process.env.ROBLOX_OAUTH_CLIENT_SECRET;
   process.env.ROBLOX_OAUTH_CLIENT_ID='TEST_CLIENT';process.env.ROBLOX_OAUTH_CLIENT_SECRET='TEST_SECRET';
   const oauth=express();oauth.use(express.json());oauth.use((req,res,next)=>{req.principal={id:'TEST_CIVILIAN',name:'Test',groups:['civilian'],roles:[]};req.sessionHash=String(req.headers['x-test-session']??'SESSION_A');next();});
   const calls:string[]=[];configureRoblox(oauth,(async(input:RequestInfo|URL,init?:RequestInit)=>{calls.push(String(input));if(String(input).endsWith('/token')){assert.match(String(init?.body),/code_verifier=/);return Response.json({access_token:'TEST_ACCESS',token_type:'Bearer'});}assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer TEST_ACCESS');return Response.json({sub:'1234567',preferred_username:'FictionalTestAccount'});}) as typeof fetch);
   oauth.use((error:Error&{status?:number},req:express.Request,res:express.Response,next:express.NextFunction)=>res.status(error.status??400).json({error:error.message}));
   const local=oauth.listen(0,'127.0.0.1');await new Promise<void>(r=>local.once('listening',r));const endpoint='http://127.0.0.1:'+(local.address() as {port:number}).port;
   try{
    const start=await fetch(endpoint+'/api/roblox/start',{method:'POST'});assert.equal(start.status,200);const authorization=new URL((await start.json() as {url:string}).url);assert.equal(authorization.origin,'https://apis.roblox.com');assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
    const callback=endpoint+'/api/roblox/callback?state='+authorization.searchParams.get('state')+'&code=TEST_CODE';
    assert.equal((await fetch(callback,{headers:{'x-test-session':'SESSION_B'},redirect:'manual'})).status,403);assert.equal(calls.length,0);
    assert.equal((await fetch(callback,{redirect:'manual'})).status,302);assert.equal(calls.length,2);
    const link=await db.linkedRobloxAccount.findUniqueOrThrow({where:{userId:'TEST_CIVILIAN'}});assert.equal(link.robloxId,'1234567');
    assert.equal((await fetch(callback,{redirect:'manual'})).status,403);assert.equal(calls.length,2);
    assert.equal((await fetch(endpoint+'/api/roblox/link',{method:'DELETE'})).status,200);assert.equal(await db.linkedRobloxAccount.count({where:{userId:'TEST_CIVILIAN'}}),0);
   }finally{local.close();if(clientId===undefined)delete process.env.ROBLOX_OAUTH_CLIENT_ID;else process.env.ROBLOX_OAUTH_CLIENT_ID=clientId;if(clientSecret===undefined)delete process.env.ROBLOX_OAUTH_CLIENT_SECRET;else process.env.ROBLOX_OAUTH_CLIENT_SECRET=clientSecret;}
  });
  await t.test('preferences persist privately, reject stale versions and enforce mandatory alerts',async()=>{
   const initial=await request('/preferences','GET',undefined,'civilian');assert.equal(initial.status,200);assert.equal(initial.data.version,0);
   const saved=await request('/preferences','PUT',{...initial.data,theme:'light',mutedKinds:['agency_case_created','unit_assigned']},'civilian');assert.equal(saved.status,200);assert.equal(saved.data.version,1);
   assert.equal((await request('/preferences','PUT',initial.data,'civilian')).status,409);
   assert.equal((await request('/preferences')).data.theme,'dark');
   const {notification}=await import('../apps/api/src/cad-workflows.js');
   await db.$transaction(async tx=>{assert.equal(await notification(tx,'TEST_CIVILIAN','agency_case_created','Muted','Quiet update'),null);assert.ok(await notification(tx,'TEST_CIVILIAN','unit_assigned','Mandatory','Assignment'));});
   assert.equal((await request('/preferences','PUT',{...saved.data,dashboardWidgets:['calls','calls']},'civilian')).status,400);
   await db.notification.deleteMany({where:{userId:'TEST_CIVILIAN'}});
  });
  await t.test('court workflow enforces feature flag, role, independent decision and appeal transitions',async()=>{
   const {ids}=await import('../config/ids.js');const prior=ids.featureFlags.courts;
   assert.equal((await request('/court-cases')).status,404);ids.featureFlags.courts=true;
   try{
    assert.equal((await request('/court-cases','GET',undefined,'civilian')).status,403);
    const character=await db.civilianCharacter.create({data:{ownerId:'TEST_OWNER',name:'Fictional Court Citizen',demo:true}});
    const report=await db.cadRecord.create({data:{kind:'incident_report',agency:'police',ownerId:'TEST_POLICE',status:'submitted',data:{title:'Fictional court report'},demo:true}});
    const submitted=await request('/court-cases','POST',{title:'Fictional training proceeding',subjectId:character.id,reportIds:[report.id],narrative:'A fictional proceeding to exercise court transitions.'});assert.equal(submitted.status,201);
    assert.equal((await request('/records/'+submitted.data.id,'PATCH',{version:1,status:'approved'})).status,400);
    assert.equal((await request('/court-cases/'+submitted.data.id+'/transition','POST',{version:1,status:'decided',reason:'Skip the hearing',verdict:'guilty'})).status,409);
    const scheduled=await request('/court-cases/'+submitted.data.id+'/transition','POST',{version:1,status:'scheduled',hearingAt:new Date(Date.now()+3600000).toISOString(),reason:'Training hearing scheduled'});assert.equal(scheduled.status,200);
    const hearing=await request('/court-cases/'+submitted.data.id+'/transition','POST',{version:2,status:'hearing',reason:'The fictional hearing has opened.'});assert.equal(hearing.status,200);
    assert.equal((await request('/court-cases/'+submitted.data.id+'/transition','POST',{version:3,status:'decided',reason:'Fictional findings recorded',verdict:'not_guilty'})).status,403);
    await db.cadRecord.update({where:{id:submitted.data.id},data:{ownerId:'TEST_POLICE'}});
    const decided=await request('/court-cases/'+submitted.data.id+'/transition','POST',{version:3,status:'decided',reason:'Independent fictional findings',verdict:'guilty',fine:100});assert.equal(decided.status,200);assert.equal(decided.data.data.fine,100);
    const appeal=await request('/court-cases/'+submitted.data.id+'/transition','POST',{version:4,status:'appealed',reason:'Fictional appeal received'});assert.equal(appeal.status,200);
    assert.equal((await request('/court-cases/'+submitted.data.id+'/transition','POST',{version:4,status:'scheduled',hearingAt:new Date(Date.now()+7200000).toISOString(),reason:'New fictional hearing'})).status,409);
   }finally{ids.featureFlags.courts=prior;}
  });
  await t.test('incident -> duty -> assignment -> status -> report -> close persists',async()=>{
   const call=await request('/incidents','POST',{location:'Fictional training station',narrative:'Fictional integration exercise only.',type:'Training call',priority:3,agency:'police'});assert.equal(call.status,201);
   const unit=await request('/unit','PUT',{callsign:'TEST-01',agency:'police',status:'available'});assert.equal(unit.status,200);
   const assignment=await request(`/incidents/${call.data.id}/assign`,'POST',{unitId:unit.data.id,version:call.data.version,remove:false});assert.equal(assignment.status,200);assert.equal(assignment.data.assignments.length,1);
   const arrived=await request(`/incidents/${call.data.id}`,'PATCH',{version:assignment.data.version,status:'on_scene',note:'Fictional unit arrived.'});assert.equal(arrived.status,200);
   const report=await request('/records','POST',{kind:'incident_report',agency:'police',incidentId:call.data.id,data:{title:'Training report',narrative:'Fictional report describing a successful training exercise.',disposition:'none',evidenceUrls:[]}});assert.equal(report.status,201);
   const close=await request(`/incidents/${call.data.id}`,'PATCH',{version:arrived.data.version,status:'closed'});assert.equal(close.status,200);assert.equal((await db.incident.findUniqueOrThrow({where:{id:call.data.id}})).status,'closed');
   const audit=await db.auditEvent.findMany({where:{entityId:call.data.id}});assert.ok(audit.length>=4);
  });
  await t.test('stale incident versions cannot overwrite newer edits',async()=>{
   const call=await request('/incidents','POST',{location:'Training road',narrative:'A fictional version conflict test.',type:'Training',priority:4,agency:'police'});
   const a=await request(`/incidents/${call.data.id}`,'PATCH',{version:1,status:'responding'});assert.equal(a.status,200);
   const b=await request(`/incidents/${call.data.id}`,'PATCH',{version:1,status:'closed'});assert.equal(b.status,409);
  });
  await t.test('civilian ownership and agency access survive direct URL access',async()=>{
   const character=await request('/characters','POST',{name:'Fictional Test Citizen',demographics:{occupation:'Fictional'},licenses:[]});assert.equal(character.status,201);
   const denied=await request('/vehicles','POST',{characterId:character.data.id,plate:'TEST22',make:'Fictional',model:'Sedan',color:'Blue'},'civilian');assert.equal(denied.status,403);
   assert.equal((await request('/records?agency=police','GET',undefined,'civilian')).status,403);
   assert.equal((await request('/lookup?q=Test','GET',undefined,'civilian')).status,403);
   assert.equal((await request('/characters','GET',undefined,'civilian')).data.length,0);
   const registration=await request('/vehicles','POST',{characterId:character.data.id,plate:'TEST22',make:'Fictional',model:'Sedan',color:'Blue'});assert.equal(registration.status,201);
   const lookup=await request('/lookup?q=TEST22');assert.equal(lookup.data.vehicles.length,1);assert.ok(!('ownerId'in lookup.data.vehicles[0]));
  });
  await t.test('production and demo records remain separated',async()=>{
   await db.incident.create({data:{id:'PRODUCTION-HIDDEN',callerId:'TEST_OWNER',location:'Production',narrative:'Not a demo record',type:'Call',priority:3,agency:'police',demo:false}});
   const list=await request('/incidents');assert.equal(list.data.some((r:{id:string})=>r.id==='PRODUCTION-HIDDEN'),false);
  });
  await t.test('merge and transfer preserve narratives, assignments, linked reports, stops and audits',async()=>{
   const source=(await request('/incidents','POST',{location:'Fictional merge source',narrative:'Original source narrative for the duplicate.',type:'Duplicate source',priority:1,agency:'police'})).data;
   const target=(await request('/incidents','POST',{location:'Fictional merge target',narrative:'Original survivor narrative.',type:'Surviving call',priority:4,agency:'police'})).data;
   const unit=await db.unit.findUniqueOrThrow({where:{userId:'TEST_OWNER'}});
   const assigned=await request(`/incidents/${source.id}/assign`,'POST',{unitId:unit.id,version:source.version,remove:false});assert.equal(assigned.status,200);
   const report=await request('/records','POST',{kind:'incident_report',agency:'police',incidentId:source.id,data:{title:'Linked merge report',narrative:'Fictional linked report that must survive the merge.',disposition:'none',evidenceUrls:[]}});assert.equal(report.status,201);
   const stop=await request('/traffic-stops','POST',{agency:'police',plate:'MERGE1',location:'Fictional training road',narrative:'Fictional observed traffic offense.',incidentId:source.id});assert.equal(stop.status,201);
   assert.equal((await request(`/incidents/${source.id}/merge`,'POST',{version:assigned.data.version,targetId:target.id,targetVersion:999,reason:'Same fictional event.'})).status,409);
   assert.equal((await db.incident.findUniqueOrThrow({where:{id:source.id}})).mergedIntoId,null);
   const merged=await request(`/incidents/${source.id}/merge`,'POST',{version:assigned.data.version,targetId:target.id,targetVersion:target.version,reason:'Duplicate report of the same fictional event.'});assert.equal(merged.status,200);assert.equal(merged.data.assignments.length,1);assert.equal(merged.data.priority,1);
   const original=await request('/incidents/'+source.id);assert.equal(original.data.mergedIntoId,target.id);assert.equal(original.data.status,'closed');assert.match(original.data.narrative,/Original source/);
   assert.equal((await request('/incidents/'+source.id,'PATCH',{version:original.data.version,status:'pending'})).status,409);
   assert.equal((await db.cadRecord.findUniqueOrThrow({where:{id:report.data.id}})).incidentId,target.id);assert.equal((await db.trafficStop.findUniqueOrThrow({where:{id:stop.data.id}})).incidentId,target.id);
   await request('/unit','PUT',{callsign:'EMS-TEST',agency:'ems',status:'available'},'ems');
   const transfer=await request(`/incidents/${target.id}/transfer`,'POST',{version:merged.data.version,agency:'ems',reason:'Fictional medical response now required.'});assert.equal(transfer.status,200);assert.equal(transfer.data.assignments.length,0);assert.equal(transfer.data.agency,'ems');assert.equal(transfer.data.status,'pending');
   assert.equal((await db.cadRecord.findUniqueOrThrow({where:{id:report.data.id}})).agency,'police');assert.ok(await db.notification.count({where:{userId:'TEST_EMS',kind:'incident_transferred'}}));
   assert.equal((await request(`/incidents/${target.id}/transfer`,'POST',{version:transfer.data.version,agency:'police',reason:'Unauthorized reassignment.'},'civilian')).status,403);
  });
  await t.test('self-dispatch enforces policy, fresh duty and dispatcher presence',async()=>{
   const {ids}=await import('../config/ids.js');const previous=ids.settings.selfDispatchEnabled;
   const incident=(await request('/incidents','POST',{location:'Fictional self-dispatch site',narrative:'A fictional self-dispatch permission exercise.',type:'Self-dispatch test',priority:3,agency:'police'})).data;
   await request('/unit','PUT',{callsign:'POL-TEST',agency:'police',status:'available'},'police');
   assert.equal((await request(`/incidents/${incident.id}/self-dispatch`,'POST',{version:1},'police')).status,403);
   ids.settings.selfDispatchEnabled=true;
   try{
    const dispatcher=await request('/unit','PUT',{callsign:'DISP-TEST',agency:'dispatch',status:'available'},'dispatcher');assert.equal(dispatcher.status,200);
    assert.equal((await request(`/incidents/${incident.id}/self-dispatch`,'POST',{version:1},'police')).status,409);
    await request('/unit','PUT',{callsign:'DISP-TEST',agency:'dispatch',status:'out_of_service',version:dispatcher.data.version},'dispatcher');
    const result=await request(`/incidents/${incident.id}/self-dispatch`,'POST',{version:1},'police');assert.equal(result.status,200);assert.equal(result.data.assignments[0].unit.userId,'TEST_POLICE');
    assert.equal((await request(`/incidents/${incident.id}/self-dispatch`,'POST',{version:1},'police')).status,409);
    await db.unit.update({where:{userId:'TEST_POLICE'},data:{updatedAt:new Date(Date.now()-3600000)}});
    assert.equal((await request(`/incidents/${incident.id}/self-dispatch`,'POST',{version:result.data.version},'police')).status,400);
    await request('/unit/heartbeat','POST',{},'police');assert.equal((await request(`/incidents/${incident.id}/self-dispatch`,'POST',{version:result.data.version},'police')).status,200);
    assert.equal((await request(`/incidents/${incident.id}/self-dispatch`,'POST',{version:99,unitId:'someone-else'},'police')).status,400);
   }finally{ids.settings.selfDispatchEnabled=previous;}
  });
  await t.test('traffic dispositions create linked charge snapshots and reject unauthorized or repeated closure',async()=>{
   const code=await request('/penal-codes','POST',{code:'RP-TEST',title:'Fictional training offense',classification:'infraction',fine:125,description:'Community roleplay test rule, not real law.',active:true});assert.equal(code.status,201);
   assert.equal((await request('/penal-codes','POST',{code:'RP-OTHER',title:'Unauthorized code',classification:'infraction',fine:1,description:'Not authorized to create.',active:true},'police')).status,403);
   const driver=await db.civilianCharacter.findFirstOrThrow({where:{ownerId:'TEST_OWNER',demo:true}});
   const stop=await request('/traffic-stops','POST',{agency:'police',plate:'STOP1',driverId:driver.id,location:'Training road',narrative:'Fictional conduct observed by the officer.'},'police');assert.equal(stop.status,201);
   await request('/unit','PUT',{callsign:'DOT-TEST',agency:'dot',status:'available'},'dot');
   assert.equal((await request(`/traffic-stops/${stop.data.id}`,'PATCH',{version:1,narrative:'Another officer cannot edit this stop.'},'police2')).status,403);
   const updated=await request(`/traffic-stops/${stop.data.id}`,'PATCH',{version:1,backupRequested:true,towRequested:true},'police');assert.equal(updated.status,200);assert.ok(await db.notification.count({where:{userId:'TEST_DOT',kind:'traffic_stop_assistance'}}));
   const closed=await request(`/traffic-stops/${stop.data.id}/close`,'POST',{version:updated.data.version,disposition:'citation',narrative:'Fictional citation issued for the documented conduct.',charges:[{penalCodeId:code.data.id,count:2}]},'police');assert.equal(closed.status,200);assert.equal(closed.data.report.data.fine,250);assert.equal(closed.data.report.charges[0].fine,125);assert.equal(closed.data.report.subjectId,driver.id);
   assert.equal((await request(`/traffic-stops/${stop.data.id}/close`,'POST',{version:closed.data.version,disposition:'citation',narrative:'Duplicate closure must be rejected.',charges:[{penalCodeId:code.data.id,count:1}]},'police')).status,409);
   const changed=await request('/penal-codes/'+code.data.id,'PATCH',{...code.data,id:undefined,updatedAt:undefined,version:code.data.version,fine:999,title:'Revised fictional offense'});assert.equal(changed.status,200);
   const snapshot=await db.charge.findFirstOrThrow({where:{recordId:closed.data.report.id}});assert.equal(snapshot.fine,125);assert.equal(snapshot.titleSnapshot,'Fictional training offense');
   const {trafficStopId,...reportData}=closed.data.report.data;
   assert.equal((await request('/records/'+closed.data.report.id,'PATCH',{version:closed.data.report.version,data:{...reportData,fine:1}},'police')).status,400);
   const revision=await request('/records/'+closed.data.report.id,'PATCH',{version:closed.data.report.version,data:{...reportData,narrative:'A corrected fictional narrative with unchanged charge calculations.'}},'police');assert.equal(revision.status,200);assert.equal(revision.data.data.trafficStopId,stop.data.id);
   const unidentified=await request('/traffic-stops','POST',{agency:'police',plate:'STOP2',location:'Training road',narrative:'Fictional driver identity is not established.'},'police');
   assert.equal((await request(`/traffic-stops/${unidentified.data.id}/close`,'POST',{version:1,disposition:'arrest',narrative:'Cannot arrest an unidentified fictional character.',charges:[{penalCodeId:code.data.id,count:1}]},'police')).status,400);
   assert.equal((await db.trafficStop.findUniqueOrThrow({where:{id:unidentified.data.id}})).status,'active');
  });
  await t.test('notification reads are private to the recipient including management callers',async()=>{
   const policeNotification=await db.notification.findFirstOrThrow({where:{userId:'TEST_POLICE'}});
   assert.equal((await request(`/notifications/${policeNotification.id}/read`,'POST',{})).status,404);
   assert.equal((await request(`/notifications/${policeNotification.id}/read`,'POST',{},'police')).status,200);
   const inbox=await request('/notifications','GET',undefined,'civilian');assert.equal(inbox.data.length,0);
  });
  await t.test('civilian call views omit dispatch notes and revoked duty roles cannot refresh presence',async()=>{
   const created=await request('/incidents','POST',{location:'Civilian fictional call',type:'Training',priority:4,agency:'police',narrative:'A fictional caller-facing incident.'},'civilian');assert.equal(created.status,201);
   assert.equal((await request('/incidents/'+created.data.id,'PATCH',{version:1,note:'Private dispatcher coordination notes.'})).status,200);
   const detail=await request('/incidents/'+created.data.id,'GET',undefined,'civilian');assert.equal(detail.status,200);assert.equal('notes'in detail.data,false);assert.equal('assignments'in detail.data,false);
   const list=await request('/incidents','GET',undefined,'civilian');assert.equal(list.data.some((r:Record<string,unknown>)=>'notes'in r),false);
   await db.unit.update({where:{userId:'TEST_POLICE'},data:{agency:'dispatch'}});try{assert.equal((await request('/unit/heartbeat','POST',{},'police')).status,403);}finally{await db.unit.update({where:{userId:'TEST_POLICE'},data:{agency:'police'}});}
  });
  await t.test('private evidence encrypts files, verifies downloads and enforces report access',async()=>{
   const previous=process.env.FILE_STORAGE_SECRET;process.env.FILE_STORAGE_SECRET='ab'.repeat(32);const files:string[]=[];
   try{
    const report=await request('/records','POST',{kind:'investigation',agency:'police',data:{title:'Private evidence test',narrative:'Fictional investigation for encrypted file testing.',disposition:'none',evidenceUrls:[]}},'police');assert.equal(report.status,201);
    const original=Buffer.from('Fictional private evidence — integration test.','utf8');
    const upload=async(name:string,version:number,role='police',bytes=original)=>fetch(`${url}/api/records/${report.data.id}/evidence`,{method:'POST',headers:{'x-test-role':role,'Content-Type':'application/octet-stream','x-file-name':encodeURIComponent(name),'x-record-version':String(version)},body:bytes});
    assert.equal((await upload('evidence.txt',1,'civilian')).status,403);
    assert.equal((await upload('../escape.txt',1)).status,400);assert.equal((await upload('script.exe',1)).status,400);
    const response=await upload('evidence.txt',1);assert.equal(response.status,201);const evidence=await response.json() as {id:string;recordVersion:number;checksum:string};assert.equal(evidence.recordVersion,2);assert.equal(evidence.checksum,createHash('sha256').update(original).digest('hex'));
    const stored=await db.evidence.findUniqueOrThrow({where:{id:evidence.id}});const filename=`data/evidence/${stored.storageKey}`;files.push(filename);const encrypted=fs.readFileSync(filename);assert.equal(encrypted.includes(original),false);
    assert.equal((await upload('second.txt',1)).status,409);assert.equal(await db.evidence.count({where:{recordId:report.data.id}}),1);
    const denied=await fetch(`${url}/api/evidence/${evidence.id}/download`,{headers:{'x-test-role':'ems'}});assert.equal(denied.status,403);
    const downloaded=await fetch(`${url}/api/evidence/${evidence.id}/download`,{headers:{'x-test-role':'police2'}});assert.equal(downloaded.status,200);assert.match(downloaded.headers.get('Content-Disposition')!,/^attachment;/);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),original);
    const chain=await request(`/evidence/${evidence.id}/custody`,'GET',undefined,'police');assert.equal(chain.status,200);assert.deepEqual(chain.data.map((e:{action:string})=>e.action),['uploaded','downloaded']);
    const previousUnit=await db.unit.findUnique({where:{userId:'TEST_POLICE2'}});if(!previousUnit)await db.unit.create({data:{userId:'TEST_POLICE2',callsign:'CUSTODY-02',agency:'police',status:'available'}});
    const handoff=await request(`/evidence/${evidence.id}/physical-custody`,'POST',{version:0,toId:'TEST_POLICE2',location:'Fictional evidence desk',reason:'Training custody handoff'},'police');assert.equal(handoff.status,200);
    assert.equal((await request(`/evidence/${evidence.id}/physical-custody`,'POST',{version:1,toId:'TEST_POLICE2',location:'Fictional desk',reason:'Duplicate transfer attempt'},'police')).status,409);
    assert.equal((await request(`/evidence/${evidence.id}/physical-custody/respond`,'POST',{version:1,accept:true,note:'Wrong recipient attempt'})).status,403);
    const acknowledged=await request(`/evidence/${evidence.id}/physical-custody/respond`,'POST',{version:1,accept:true,note:'Fictional sealed package received'},'police2');assert.equal(acknowledged.status,200);assert.equal(acknowledged.data.ownerId,'TEST_POLICE2');
    assert.equal((await request(`/evidence/${evidence.id}/physical-custody/respond`,'POST',{version:1,accept:true,note:'Repeated receipt attempt'},'police2')).status,403);
    const pdf=await fetch(`${url}/api/records/${report.data.id}/pdf`,{headers:{'x-test-role':'police'}});assert.equal(pdf.status,200);const {PDFDocument}=await import('pdf-lib');assert.ok((await PDFDocument.load(await pdf.arrayBuffer())).getPageCount()>=1);
    assert.equal((await fetch(`${url}/api/records/${report.data.id}/pdf`,{headers:{'x-test-role':'civilian'}})).status,403);
    assert.equal((await request('/exports','POST',{recordIds:[report.data.id],includeEvidence:true},'police')).status,403);
    const zipResponse=await fetch(`${url}/api/exports`,{method:'POST',headers:{'Content-Type':'application/json','x-test-role':'owner'},body:JSON.stringify({recordIds:[report.data.id],includeEvidence:true})});assert.equal(zipResponse.status,200);const {unzipSync}=await import('fflate');const archive=unzipSync(new Uint8Array(await zipResponse.arrayBuffer()));assert.ok(archive['manifest.json']);assert.deepEqual(Buffer.from(archive[`evidence/${evidence.id}.txt`]),original);assert.ok(archive[`records/${report.data.id}.pdf`]);
    if(!previousUnit)await db.unit.delete({where:{userId:'TEST_POLICE2'}});
    const sealed=await request('/records/'+report.data.id,'PATCH',{version:2,sealed:true});assert.equal(sealed.status,200);
    assert.equal((await request(`/records/${report.data.id}/evidence`,'GET',undefined,'police2')).status,403);
    const tampered=Buffer.from(encrypted);tampered[tampered.length-1]^=1;fs.writeFileSync(filename,tampered);
    const damaged=await fetch(`${url}/api/evidence/${evidence.id}/download`,{headers:{'x-test-role':'owner'}});assert.equal(damaged.status,400);assert.equal(await db.evidenceCustody.count({where:{evidenceId:evidence.id,action:'downloaded'}}),1);
   }finally{for(const filename of files)fs.rmSync(filename,{force:true});if(previous===undefined)delete process.env.FILE_STORAGE_SECRET;else process.env.FILE_STORAGE_SECRET=previous;}
  });
  await t.test('EMS response requires a valid fictional hospital and protects patient records',async()=>{
   const {ids}=await import('../config/ids.js');
   const created=await request('/operational-cases','POST',{kind:'ems',data:{summary:'A fictional patient transport exercise.',location:'Fictional training site',patientAlias:'Training Patient A'}},'ems');assert.equal(created.status,201);
   assert.equal((await request('/operational-cases?kind=ems','GET',undefined,'police')).status,403);
   const claimed=await request(`/operational-cases/${created.data.id}/claim`,'POST',{version:1},'ems');assert.equal(claimed.status,200);
   assert.equal((await request(`/operational-cases/${created.data.id}`,'PATCH',{version:claimed.data.version,nextStatus:'closed',data:{}},'ems')).status,409);
   let row=(await request(`/operational-cases/${created.data.id}`,'PATCH',{version:claimed.data.version,nextStatus:'on_scene',data:{}},'ems')).data;
   assert.equal((await request(`/operational-cases/${row.id}`,'PATCH',{version:row.version,nextStatus:'transporting',data:{hospital:'Unconfigured location'}},'ems')).status,400);
   for(const nextStatus of ['transporting','arrived','closed']){const response=await request(`/operational-cases/${row.id}`,'PATCH',{version:row.version,nextStatus,data:{hospital:ids.settings.fictionalHospitals[0],transportNotes:'Fictional transport exercise completed.'}},'ems');assert.equal(response.status,200);row=response.data;}
   assert.equal(row.report.kind,'ems_report');assert.equal(row.report.agency,'ems');assert.ok(await db.auditEvent.count({where:{entityId:row.id,action:'agency-case.transition'}}));
  });
  await t.test('fire command workflow creates a completion report without skipped stages',async()=>{
   assert.equal((await request('/unit','PUT',{callsign:'FIRE-TEST',agency:'fire',status:'available'},'fire')).status,200);
   const created=await request('/operational-cases','POST',{kind:'fire',data:{summary:'Fictional fire command training.',location:'Training station',station:'Station TEST',apparatus:'Training Engine',commander:'FIRE-TEST',staging:'Training staging area',hazard:'low'}},'fire');assert.equal(created.status,201);
   let row=(await request(`/operational-cases/${created.data.id}/claim`,'POST',{version:1},'fire')).data;
   assert.equal((await request(`/operational-cases/${row.id}`,'PATCH',{version:row.version,nextStatus:'cleared',data:{}},'fire')).status,409);
   for(const nextStatus of ['on_scene','controlled','cleared']){const response=await request(`/operational-cases/${row.id}`,'PATCH',{version:row.version,nextStatus,data:{notes:'Fictional command update.'}},'fire');assert.equal(response.status,200);row=response.data;}
   assert.equal(row.report.kind,'fire_incident');assert.equal((await request(`/operational-cases/${row.id}/claim`,'POST',{version:row.version},'fire')).status,400);
  });
  await t.test('tow impound inventory and owner-requested release require authorized DOT action',async()=>{
   const vehicle=await db.vehicleRegistration.findUniqueOrThrow({where:{plate:'TEST22'}});
   const created=await request('/operational-cases','POST',{kind:'tow',data:{summary:'Fictional tow request for a registered training vehicle.',location:'Training road',plate:vehicle.plate,vehicleId:vehicle.id}},'police');assert.equal(created.status,201);
   let row=(await request(`/operational-cases/${created.data.id}/claim`,'POST',{version:1},'dot')).data;assert.equal(row.status,'assigned');
   for(const nextStatus of ['en_route','on_scene'])row=(await request(`/operational-cases/${row.id}`,'PATCH',{version:row.version,nextStatus,data:{}},'dot')).data;
   assert.equal((await request(`/operational-cases/${row.id}`,'PATCH',{version:row.version,nextStatus:'impounded',data:{}},'dot')).status,400);
   row=(await request(`/operational-cases/${row.id}`,'PATCH',{version:row.version,nextStatus:'impounded',data:{impoundLot:'Fictional training lot',inventoryNotes:'Training vehicle and contents documented.'}},'dot')).data;
   assert.equal((await request(`/operational-cases/${row.id}/request-release`,'POST',{version:row.version},'civilian')).status,403);
   const mine=await request('/my-impounds');assert.equal(mine.status,200);assert.ok(mine.data.some((i:{id:string})=>i.id===row.id));assert.equal('data'in mine.data[0],false);
   assert.equal((await request(`/operational-cases/${row.id}/request-release`,'POST',{version:row.version})).status,200);
   const pending=await db.operationalCase.findUniqueOrThrow({where:{id:row.id}});assert.equal(pending.status,'impounded');
   const released=await request(`/operational-cases/${row.id}`,'PATCH',{version:pending.version,nextStatus:'released',data:{releaseReason:'Fictional owner identity and release approved.'}},'dot');assert.equal(released.status,200);assert.equal(released.data.report.kind,'tow_request');
   assert.equal((await request('/my-impounds')).data.some((i:{id:string})=>i.id===row.id),false);
  });
  await t.test('CAD DOM navigation and traffic-stop form submit through the actual API',async()=>{
   const dom=new JSDOM(fs.readFileSync('apps/web/public/index.html','utf8'),{url,runScripts:'outside-only'}),window=dom.window;
   let pending=0;window.fetch=(async(input:string|URL|Request,init?:RequestInit)=>{pending++;try{return await fetch(new URL(String(input),url),init);}finally{pending--;}}) as typeof window.fetch;
   window.WebSocket=class {onmessage:unknown;onclose:unknown;close(){}} as unknown as typeof window.WebSocket;
   window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;};window.confirm=()=>true;
   const wait=async(check:()=>boolean)=>{for(let i=0;i<150;i++){if(check())return;await new Promise(r=>setTimeout(r,10));}throw Error('DOM did not reach the expected state: '+window.document.body.textContent?.slice(-800));};
   const click=(label:string,scope:ParentNode=window.document)=>{const button=Array.from(scope.querySelectorAll('button')).find(b=>b.textContent?.trim()===label||b.lastElementChild?.textContent?.trim()===label);assert.ok(button,`button ${label} exists`);button.click();};
   try{
    window.eval(fs.readFileSync('apps/web/public/cad.js','utf8'));await wait(()=>window.document.querySelector('h1')?.textContent==='Operations overview');
    await wait(()=>Boolean(window.document.querySelector('.dashboard-widget')));const widget=window.document.querySelector('[data-widget="calls"]') as HTMLElement;click('Move earlier',widget);const width=widget.querySelector('select') as HTMLSelectElement;width.value='2';width.dispatchEvent(new window.Event('change'));widget.style.height='480px';click('Save dashboard layout');await wait(()=>window.document.getElementById('toast')?.textContent==='Dashboard layout saved to your account.');const layout=(await db.user.findUniqueOrThrow({where:{id:'TEST_OWNER'}})).preferences as any;assert.equal(layout.dashboardWidgets[0],'calls');assert.deepEqual(layout.widgetSizes.calls,{columns:2,height:480});
    click('Traffic Stops',window.document.querySelector('nav')!);await wait(()=>window.document.querySelector('h1')?.textContent==='Traffic stops');click('New traffic stop');await wait(()=>Boolean(window.document.querySelector('dialog[open] form')));
    const form=window.document.querySelector('dialog form') as HTMLFormElement;for(const [name,value] of Object.entries({plate:'UITEST',location:'Fictional UI training road',narrative:'Fictional traffic observation submitted through the real interface.'}))(form.elements.namedItem(name) as HTMLInputElement).value=value;
    form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!window.document.querySelector('dialog[open]'));
    assert.ok(await db.trafficStop.findFirst({where:{plate:'UITEST',officerId:'TEST_OWNER'}}));
    click('Penal Codes',window.document.querySelector('nav')!);await wait(()=>window.document.querySelector('h1')?.textContent==='Fictional penal code');click('New penal code');await wait(()=>Boolean(window.document.querySelector('dialog[open] form')));
    const codeForm=window.document.querySelector('dialog form') as HTMLFormElement;for(const [name,value] of Object.entries({code:'RP-UI',title:'Fictional UI offense',fine:'75',description:'Fictional roleplay code created through the management interface.'}))(codeForm.elements.namedItem(name) as HTMLInputElement).value=value;
    codeForm.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!window.document.querySelector('dialog[open]'));assert.equal((await db.penalCode.findUniqueOrThrow({where:{code:'RP-UI'}})).fine,75);
    click('Notifications',window.document.querySelector('nav')!);await wait(()=>window.document.querySelector('h1')?.textContent==='Notifications'&&Boolean(window.document.querySelector('#content .card')));
    click('Live Map',window.document.querySelector('nav')!);await wait(()=>Boolean(window.document.querySelector('.map-stage svg')));
    let svg=window.document.querySelector('.map-stage svg')!;assert.equal(window.document.querySelectorAll('.map-layers input').length,7);const original=svg.getAttribute('viewBox');click('Zoom in');await wait(()=>svg.getAttribute('viewBox')!==original);click('Fit map');await wait(()=>svg.getAttribute('viewBox')==='0 0 100 100');
    const image=svg.querySelector('image')!;image.dispatchEvent(new window.Event('load'));svg.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:500,bottom:500,width:500,height:500,toJSON:()=>({})});
    click('station');await wait(()=>window.document.querySelector('.map-coordinate-readout')?.textContent==='Tool: station');svg.dispatchEvent(new window.MouseEvent('pointerdown',{clientX:250,clientY:250,button:0,bubbles:true}));svg.dispatchEvent(new window.MouseEvent('pointerup',{clientX:250,clientY:250,button:0,bubbles:true}));await wait(()=>Boolean(window.document.querySelector('dialog[open] form')));
    const mapForm=window.document.querySelector('dialog form') as HTMLFormElement;(mapForm.elements.namedItem('label') as HTMLInputElement).value='DOM training station';mapForm.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await wait(()=>!window.document.querySelector('dialog[open]'));assert.ok(await db.cadRecord.findFirst({where:{kind:'map_feature',data:{path:['label'],equals:'DOM training station'}}}));
   }finally{await wait(()=>pending===0);await new Promise(r=>setTimeout(r,20));window.close();}
  });
  await t.test('database permits only one active session and deduplicates attendance',async()=>{
   const {reserveSession}=await import('../apps/bot/src/sessions.js');const starts=await Promise.allSettled([reserveSession('TEST_GUILD','TEST_OWNER'),reserveSession('TEST_GUILD','TEST_OWNER')]);assert.equal(starts.filter(x=>x.status==='fulfilled').length,1);
   const session=await db.session.findUniqueOrThrow({where:{activeKey:'TEST_GUILD'}});for(let n=0;n<2;n++)await db.sessionAttendance.upsert({where:{sessionId_player:{sessionId:session.id,player:'FictionalPlayer:123'}},create:{sessionId:session.id,player:'FictionalPlayer:123'},update:{lastSeen:new Date()}});assert.equal(await db.sessionAttendance.count({where:{sessionId:session.id}}),1);
   await db.session.update({where:{id:session.id},data:{status:'ended',activeKey:null,endedAt:new Date()}});await db.session.create({data:{guildId:'TEST_GUILD',hostId:'TEST_OWNER',activeKey:'TEST_GUILD'}});
  });
  await t.test('DM application progress survives service recreation and contradictory reviews are rejected',async()=>{
   const fakeClient={users:{fetch:async()=>({send:async()=>{throw Error('DM blocked');}})}} as unknown as Client;
   const first=new Applications(fakeClient,service);first.principal=async userId=>({id:userId,name:'Test',roles:[],groups:['owner']});
   const application=await first.start('TEST_CIVILIAN',false);let draft=await first.update(application,{status:'draft',answers:['Saved first answer'],step:1},'TEST_CIVILIAN','application.answer');
   const restarted=new Applications(fakeClient,service);restarted.principal=first.principal;
   const persisted=await db.application.findUniqueOrThrow({where:{id:draft.id}});assert.deepEqual(persisted.answers,['Saved first answer']);assert.equal(persisted.step,1);
   await assert.rejects(restarted.update(persisted,{answers:['Changed answer']},'TEST_CIVILIAN','application.answer'),/cannot be changed/);
   await assert.rejects(restarted.interaction({isModalSubmit:()=>true,customId:`ls:appAnswer:${persisted.id},${persisted.version-1},0`,user:{id:'TEST_CIVILIAN'}} as any),/already been answered|replaced/);
   draft=await restarted.update(persisted,{answers:['Saved first answer','Saved second answer'],step:2,status:'submitted'},'TEST_CIVILIAN','application.submitted');
   const outcomes=await Promise.allSettled([restarted.review(draft,'TEST_OWNER','accept','Welcome to training.'),restarted.review(draft,'TEST_OWNER','deny','Alternate review.')]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
   const final=await db.application.findUniqueOrThrow({where:{id:draft.id}});assert.ok(['accepted','denied'].includes(final.status));assert.equal(final.activeKey,null);assert.equal(final.dmFailed,true);
  });
  await t.test('application review posts one paginated V2 message with complete untruncated answers',async()=>{const questions=Array.from({length:12},(_,i)=>'Situational question '+(i+1)),answers=questions.map((_,i)=>'Answer '+i+' '+('x'.repeat(2480)));const app=await db.application.create({data:{guildId:ids.guildId,applicantId:'TEST_CIVILIAN',status:'submitted',questions,answers}});const sent:any[]=[];const channel={id:'ONE_REVIEW_CHANNEL',send:async(p:any)=>{sent.push(p);return{id:'ONE_REVIEW_MESSAGE'};}};const fakeService:any={store:{guild:()=>({config:{managementRoles:[]}})},restrictedChannel:async()=>channel};const applications=new Applications({guilds:{fetch:async()=>({})}} as any,fakeService);await applications.publishReview(app);assert.equal(sent.length,1);const pages=applications.reviewPages(app);assert.ok(pages.length>1);const combined=pages.flat().join('\n');for(const answer of answers)assert.ok(combined.includes(answer));for(let page=0;page<pages.length;page++){const card=applications.reviewCard(app,page);assert.equal(card.components.length,1);assert.equal(card.components[0].type,17);const buttons=card.components[0].components.filter((c:any)=>c.type===1).flatMap((c:any)=>c.components);assert.ok(buttons.some((b:any)=>b.label==='Accept'));assert.ok(buttons.some((b:any)=>b.label==='Deny'));}const saved=await db.application.findUniqueOrThrow({where:{id:app.id}});assert.equal(saved.reviewMessageId,'ONE_REVIEW_MESSAGE');});
  await t.test('ticket claim, close, transcript retention and reopen change real stored state',async()=>{
   const {Tickets}=await import('../apps/bot/src/tickets.js');const overwrites:{id:string;values:unknown}[]=[],dms:unknown[]=[];const ticket={id:'TEST-TICKET',user:'TEST_CIVILIAN',channel:'TEST_CHANNEL',category:0,status:'created',request:'Private fictional support request',priority:'normal',created:Date.now(),members:[] as string[],message:'CARD'};
   const messages=new Collection<string,any>();messages.set('MSG1',{id:'MSG1',createdAt:new Date(),author:{id:'TEST_CIVILIAN',tag:'Test Civilian'},content:'Private fictional evidence',attachments:new Collection(),components:[]});
   const channel={type:ChannelType.GuildText,permissionOverwrites:{edit:async(id:string,values:unknown)=>{overwrites.push({id,values});}},messages:{fetch:async(arg:unknown)=>typeof arg==='string'?{edit:async()=>{}}:messages}};
   const fakeClient={user:{id:'TEST_BOT'},users:{fetch:async()=>({send:async(payload:unknown)=>{dms.push(payload);}})}} as unknown as Client;
   const ticketService={client:fakeClient,store:{guild:()=>g,change:()=>{},save:()=>{},flush:async()=>{}}} as unknown as CommunityService;
   const staff={id:'TEST_OWNER',guild:{id:'TEST_GUILD',channels:{fetch:async()=>channel}}} as any;
   const tickets=new Tickets(fakeClient,ticketService);await tickets.change('TEST_GUILD',ticket,'claim',staff,'');assert.equal(ticket.status,'claimed');assert.equal((ticket as any).assignee,'TEST_OWNER');
   await tickets.change('TEST_GUILD',ticket,'close',staff,'Resolved after fictional review.');assert.equal(ticket.status,'closed');const transcript=await db.ticketTranscript.findUniqueOrThrow({where:{id:ticket.id}});assert.match(transcript.text,/Private fictional evidence/);assert.ok(transcript.expiresAt.getTime()>Date.now());assert.equal(dms.length,1);
   await tickets.change('TEST_GUILD',ticket,'reopen',staff,'');assert.equal(ticket.status,'reopened');assert.ok(overwrites.some(o=>o.id===ticket.user&&(o.values as {SendMessages:boolean}).SendMessages===true));
  });
  await t.test('security audit burst records a review incident and does not auto-punish by default',async()=>{
   const {protect}=await import('../apps/bot/src/protection.js');const {ids}=await import('../config/ids.js');const original=ids.guildId;ids.guildId='TEST_SECURITY_GUILD';
   const handlers=new Map<string,(...args:any[])=>Promise<void>>();const securityState={config:{},records:{} as Record<string,any>};let attemptedPunishment=false;
   const securityService={client:{user:{id:'TEST_BOT'},on:(event:string,handler:(...args:any[])=>Promise<void>)=>{handlers.set(event,handler);}},store:{guild:()=>securityState,change:()=>{},save:()=>{},flush:async()=>{}}} as unknown as CommunityService;
   try{protect(securityService);const guild={id:ids.guildId,ownerId:'OWNER',members:{fetch:async()=>{attemptedPunishment=true;throw Error('Must not run');}}};const handler=handlers.get(Events.GuildAuditLogEntryCreate)!;for(let n=0;n<3;n++)await handler({action:AuditLogEvent.ChannelDelete,executorId:'UNTRUSTED',targetId:'TARGET'},guild);assert.equal(Object.keys(securityState.records).length,1);assert.equal(attemptedPunishment,false);assert.equal(Object.values(securityState.records)[0].mode,'review');}finally{ids.guildId=original;}
  });
  await t.test('session cookies and CSRF reject anonymous and cross-origin mutations',async()=>{
   const authApp=express();authApp.use(express.json());const client=new Client({intents:[]});configureAuth(authApp,client);authApp.post('/api/probe',(req,res)=>res.json({ok:true}));
   const authServer=authApp.listen(0,'127.0.0.1');await new Promise<void>(r=>authServer.once('listening',r));const authUrl=`http://127.0.0.1:${(authServer.address() as {port:number}).port}`;process.env.WEB_BASE_URL=authUrl;
   try{assert.equal((await fetch(authUrl+'/api/me')).status,401);assert.equal((await fetch(authUrl+'/auth/demo',{method:'POST',headers:{Origin:'https://evil.invalid'}})).status,403);
    assert.equal((await(await fetch(authUrl+'/auth/options')).json() as {demo:boolean}).demo,true);process.env.DEMO_MODE='false';assert.equal((await(await fetch(authUrl+'/auth/options')).json() as {demo:boolean}).demo,false);assert.equal((await fetch(authUrl+'/auth/demo',{method:'POST',headers:{Origin:authUrl}})).status,404);process.env.DEMO_MODE='true';
    const login=await fetch(authUrl+'/auth/demo',{method:'POST',headers:{Origin:authUrl}});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie')!.split(';')[0];const identity=await(await fetch(authUrl+'/api/me',{headers:{Cookie:cookie}})).json() as {csrf:string};
    assert.equal((await fetch(authUrl+'/api/probe',{method:'POST',headers:{Cookie:cookie,Origin:authUrl}})).status,403);assert.equal((await fetch(authUrl+'/api/probe',{method:'POST',headers:{Cookie:cookie,Origin:authUrl,'x-csrf-token':identity.csrf}})).status,200);
   }finally{authServer.closeAllConnections();await new Promise<void>(r=>authServer.close(()=>r()));client.destroy();}
  });
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await db.$disconnect();await socket.stop();await engine.close();}
});
