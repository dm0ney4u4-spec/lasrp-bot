import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Collection,PermissionsBitField,PermissionFlagsBits} from 'discord.js';
import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {promotionConfig,promotionRanks,promotionManagedRoles,promotionBundle,staffAuthorityRanks} from '../config/promotions.js';
import {promotionPlan,destinationAuthorized,sameRoles} from '../apps/bot/src/promotions/model.js';
import {announcement,directMessage,promoteCommand} from '../apps/bot/src/promotions/views.js';
import {PromotionRepository} from '../apps/bot/src/promotions/repository.js';

test('all 23 individual ranks have exact bundles and destination-specific permission alternatives',()=>{
 assert.equal(promotionRanks.length,23);assert.equal(new Set(promotionRanks.map(r=>r.id)).size,23);
 for(const group of promotionConfig.groups)for(const rank of group.ranks){assert.deepEqual(new Set(promotionBundle(rank.id)),new Set([rank.id,...group.auxiliary,promotionConfig.staffRoleId,promotionConfig.staffSeparatorId]));for(const role of group.permissions)assert.equal(destinationAuthorized([role],rank.id),true);assert.equal(destinationAuthorized([promotionConfig.rankLockOverrideRoleId],rank.id),false);assert.equal(destinationAuthorized([],rank.id),false);}
 for(const role of promotionManagedRoles)if(!promotionRanks.some(r=>r.id===role))assert.throws(()=>promotionBundle(role),/individual rank/);
 assert.ok(!promotionManagedRoles.has(promotionConfig.rankLockRoleId));assert.ok(!promotionManagedRoles.has('1529545919907762397'));
 assert.equal(promoteCommand.name,'promote');const options=promoteCommand.toJSON().options!;assert.deepEqual(options.map(o=>o.name),['user','rank','reason']);assert.equal((options[1] as any).autocomplete,true);assert.ok(options.every(o=>o.required));
});
test('role plans replace the individual rank/team only and retain all unrelated roles',()=>{
 const old=promotionBundle('1529544880626602146'),next=promotionPlan([...old,'discipline','department','booster','loa','currently-moderating','support',promotionConfig.rankLockRoleId],'1529544875308089558');
 assert.deepEqual(next.add,['1529544875308089558']);assert.deepEqual(next.remove,['1529544880626602146']);
 const cross=promotionPlan(promotionBundle('1569737318577872988'),'1529544806555193434');
 assert.deepEqual(new Set(cross.remove),new Set(['1569737318577872988','1529544884783022100','1529549543409193092']));
 assert.ok(!cross.remove.includes(promotionConfig.staffRoleId));assert.ok(!cross.remove.includes(promotionConfig.staffSeparatorId));
 assert.throws(()=>promotionPlan(old,'1529544880626602146'),/higher/);
});
test('promotion announcements use V2 branding and role mentions without rank or staff pings',()=>{
 const plan=promotionPlan([],'1529544880626602146'),row:any={id:'test-id',memberId:'member',actorId:'actor',rankId:plan.rankId,reason:'PRIVATE REASON',data:{plan,actorName:'Manager_Name'}};
 const p:any=announcement({...promotionConfig,iconName:'white_promotion'},row);assert.equal(p.flags,32768);assert.deepEqual(p.allowedMentions,{parse:[],roles:[],users:['member'],repliedUser:false});assert.ok(JSON.stringify(p.components).includes('<@&'+row.rankId+'>'));assert.ok(JSON.stringify(p.components).includes(row.reason));assert.ok(JSON.stringify(p.components).includes('<:white_promotion:1530309174506950727>'));assert.equal(p.files.length,3);
 const dm=directMessage(promotionConfig,row);assert.ok(JSON.stringify(dm.components).includes(plan.rankName));assert.ok(!JSON.stringify(dm.components).includes('<@&'));assert.ok(JSON.stringify(dm.components).includes(row.reason));
});

test('promotion PostgreSQL integration: confirmed bundles, permissions, rollback, recovery and idempotent delivery',async t=>{
 const engine=await PGlite.create();for(const name of fs.readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort())await engine.exec(fs.readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8'));
 const socket=new PGLiteSocketServer({db:engine,host:'127.0.0.1',port:0,maxConnections:1});await socket.start();process.env.DATABASE_URL=`postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`;
 const {db}=await import('../packages/shared/src/database.js'),{Promotions}=await import('../apps/bot/src/promotions/index.js');let fixtureId=0;
 function fixture({unranked=false}={}){
  const config=structuredClone(promotionConfig);config.guildId='promotion-test-'+(++fixtureId);
  const actorId='actor',targetId='target',ownerId='1425577335637413961',effects:any[]=[],roles=new Map<string,any>(),members=new Map<string,any>(),records:any={};let privateLogs=true,dmBlocked=false,fault:any=null,mutation=0,injectUnrelated=false,failRollback=false,serial=0;
  const addRole=(id:string,position=3)=>{roles.set(id,{id,name:promotionRanks.find(r=>r.id===id)?.name||id,position,managed:false,permissions:new PermissionsBitField(0n)});};
  for(const id of promotionManagedRoles)addRole(id);for(const[r,i]of promotionRanks.map((r,i)=>[r,i]as const))roles.get(r.id).position=i+10;
  for(const id of [config.rankLockRoleId,config.rankLockOverrideRoleId,'1529541363547504781','unrelated','department','loa','discipline','external-unrelated','bot-high','actor-high'])addRole(id,id==='bot-high'?200:id==='actor-high'?100:2);
  const makeMember=(id:string,ids:string[],bot=false)=>{
   const cache=new Collection<string,any>(ids.map(id=>[id,roles.get(id)]));const member:any={id,displayName:id,permissions:new PermissionsBitField(PermissionFlagsBits.Administrator),user:{id,username:id,bot,send:async(p:any)=>{effects.push({type:'dm-attempt',payload:p});if(dmBlocked)throw Object.assign(Error('DM blocked'),{code:50007});effects.push({type:'dm',payload:p});}},roles:{cache,get highest(){return [...cache.values()].sort((a,b)=>b.position-a.position)[0]||{position:0};},set:()=>{throw Error('Whole-member role replacement is forbidden');}}};
   const change=async(type:string,roleId:string)=>{mutation++;effects.push({type,roleId});const match=fault&&fault.at===mutation;if(match&&!fault.after)throw Error('Simulated Discord failure');if(type==='add')cache.set(roleId,roles.get(roleId));else cache.delete(roleId);if(injectUnrelated)cache.set('external-unrelated',roles.get('external-unrelated'));if(match&&fault.after)throw Error('Uncertain response after mutation');if(failRollback&&mutation>3)throw Error('Rollback unavailable');};
   member.roles.add=(id:string)=>change('add',id);member.roles.remove=(id:string)=>change('remove',id);members.set(id,member);return member;
  };
  const actor=makeMember(actorId,['actor-high','1529545703024627754','1529541841450565773']),target=makeMember(targetId,[...(unranked?[]:promotionBundle('1529544880626602146')),'unrelated','department','loa','discipline']),bot=makeMember('bot',['bot-high'],true);makeMember(ownerId,['1529541841450565773']);makeMember('other',['actor-high','1529545703024627754']);
  const allMessages=new Map<string,Collection<string,any>>();
  const channel=(id:string)=>{if(!allMessages.has(id))allMessages.set(id,new Collection());const messages=allMessages.get(id)!;return{id,isTextBased:()=>true,permissionsFor:(who:any)=>({has:(p:bigint)=>who.id===config.guildId?!privateLogs:true}),send:async(payload:any)=>{effects.push({type:id===config.logChannelId?'log':'announcement',payload});const m:any={id:String(++serial),author:{id:'bot'},createdTimestamp:Date.now(),components:payload.components.map((c:any)=>({toJSON:()=>JSON.parse(JSON.stringify(c).replaceAll('attachment://','https://cdn.discordapp.com/attachments/test/'))})),attachments:new Collection()};messages.set(m.id,m);return m;},messages:{fetch:async(o:any)=>new Collection([...messages.entries()].reverse().filter(([id])=>!o.before||+id<+o.before).slice(0,o.limit))}};};
  const guild:any={id:config.guildId,ownerId:'guild-owner',members:{fetch:async(o:any)=>{assert.equal(o.force,true);const m=members.get(o.user);if(!m)throw Error('Invalid member');return m;},fetchMe:async()=>bot},roles:{everyone:{id:config.guildId},fetch:async(id:string)=>roles.get(id)},channels:{fetch:async(id:string)=>channel(id)},emojis:{fetch:async()=>({name:'promotion_white'})}};
  const client:any={user:{id:'bot'},guilds:{fetch:async()=>guild}},service:any={store:{guild:()=>({records}),save:()=>{},flush:async()=>{}}};
  const repo=new PromotionRepository(db,config);let manager=new Promotions(client,service,config,repo);
  return{config,actor,target,bot,roles,members,repo,effects,records,manager,client,service,restart:()=>manager=new Promotions(client,service,config,repo),setFault:(at:number,after=false)=>{fault={at,after};},inject:()=>{injectUnrelated=true;},rollbackFail:()=>{failRollback=true;},blockDm:()=>{dmBlocked=true;},publicLogs:()=>{privateLogs=false;},prepare:(rank='1529544875308089558',who=actorId)=>manager.begin(who,targetId,rank,'Private test promotion reason')};
 }
 try{
  await t.test('new command replaces staff promote, autocomplete is permission-filtered and direct promotion acknowledges early without a confirmation step',async()=>{
   const {allCommands}=await import('../apps/bot/src/main.js');assert.equal(allCommands.filter(c=>c.name==='promote').length,1);const staff=allCommands.find(c=>c.name==='staff')!.toJSON();assert.ok(!staff.options!.some((o:any)=>o.name==='promote'));assert.ok(staff.options!.some((o:any)=>o.name==='demote'));
   const f=fixture();let choices:any[]=[];await f.manager.interaction({isAutocomplete:()=>true,isChatInputCommand:()=>false,commandName:'promote',guildId:f.config.guildId,user:{id:'actor'},options:{getFocused:()=>''},respond:async(c:any[])=>{choices=c;}});assert.ok(choices.length>0);assert.ok(choices.every(c=>destinationAuthorized(['1529545703024627754'],c.value,f.config)));assert.ok(!choices.some(c=>c.value===f.config.staffRoleId));
   let ack=false,payload:any;await f.manager.interaction({isAutocomplete:()=>false,isChatInputCommand:()=>true,commandName:'promote',guildId:f.config.guildId,user:{id:'actor'},options:{getUser:()=>({id:'target'}),getString:(name:string)=>name==='rank'?'1529544875308089558':'Test reason'},deferReply:async()=>{ack=true;},editReply:async(p:any)=>{assert.equal(ack,true);payload=p;}});assert.ok(JSON.stringify(payload).includes('Promotion Successful'));assert.ok(!JSON.stringify(payload).includes('Confirm Promotion'));assert.ok(!JSON.stringify(payload).includes('nycp:confirm:'));assert.equal(f.effects.filter(x=>x.type==='announcement').length,1);assert.ok(f.target.roles.cache.has('1529544875308089558'));
  });
  await t.test('destination alternatives and rank-lock override are separate from general promotion permission',async()=>{
   for(const group of promotionConfig.groups){const f=fixture({unranked:true});for(const permission of group.permissions){f.actor.roles.cache.clear();f.actor.roles.cache.set('actor-high',f.roles.get('actor-high'));f.actor.roles.cache.set('1529541841450565773',f.roles.get('1529541841450565773'));f.actor.roles.cache.set(permission,f.roles.get(permission));if(staffAuthorityRanks.some(r=>r.id===permission))f.actor.roles.cache.delete('1529541841450565773');await assert.doesNotReject(()=>f.manager.validate('actor','target',group.ranks[0].id));}}
   const f=fixture();f.target.roles.cache.set(f.config.rankLockRoleId,f.roles.get(f.config.rankLockRoleId));await assert.rejects(()=>f.prepare(),/Rank Lock/);
   f.actor.roles.cache.set(f.config.rankLockOverrideRoleId,f.roles.get(f.config.rankLockOverrideRoleId));await assert.doesNotReject(()=>f.prepare());f.actor.roles.cache.delete('1529545703024627754');await assert.rejects(()=>f.manager.validate('actor','target','1529544875308089558'),/destination team/);
  });
  await t.test('owner bypass still rejects self, protected owners, bots and insufficient bot hierarchy',async()=>{
   const f=fixture();await assert.doesNotReject(()=>f.manager.validate('1425577335637413961','target','1529544875308089558'));await assert.rejects(()=>f.manager.validate('actor','actor','1529544875308089558'),/self/);await assert.rejects(()=>f.manager.validate('actor','1425577335637413961','1529544875308089558'),/protected owner/);await assert.rejects(()=>f.manager.validate('actor','bot','1529544875308089558'),/Bots/);
   f.bot.permissions=new PermissionsBitField(0n);await assert.rejects(()=>f.prepare(),/Manage Roles/);
   const g=fixture();g.service.store.guild=()=>({records:g.records,config:{commandLockdown:true}});await assert.rejects(()=>g.prepare(),/emergency command lockdown/);await assert.doesNotReject(()=>g.prepare('1529544875308089558','1425577335637413961'));
  });
  await t.test('every rank is applied and verified with its exact bundle, retaining unrelated roles',async()=>{
   for(const rank of promotionRanks){const f=fixture({unranked:true});if(rank.id==='1529541841450565773'){await assert.rejects(()=>f.prepare(rank.id,'1425577335637413961'),/destination must be below/);continue;}const row=await f.prepare(rank.id,'1425577335637413961');assert.equal(f.effects.length,0,'preview cannot mutate Discord');const result=await f.manager.confirm(row.id,row.actorId);assert.equal(result.status,'applied');assert.ok(sameRoles(f.manager.managed(f.target),promotionBundle(rank.id)));for(const id of ['unrelated','department','loa','discipline'])assert.ok(f.target.roles.cache.has(id));assert.equal(f.effects.filter(x=>x.type==='announcement').length,1);assert.equal(f.effects.filter(x=>x.type==='dm').length,1);assert.ok(f.records['RANK-'+row.id]);}
  });
  await t.test('confirmation is executor-bound, cancellation persistent, duplicate preview safe, expiry enforced',async()=>{
   const f=fixture(),row=await f.prepare();const remaining=new Date(row.expiresAt).getTime()-Date.now();assert.ok(remaining>590000&&remaining<=600000,'expiry must remain ten real minutes regardless of PostgreSQL timezone');assert.equal((await f.prepare()).id,row.id);await assert.rejects(()=>f.manager.confirm(row.id,'other'),/original/);await f.repo.claim(row.id,'actor',true);await assert.rejects(()=>f.manager.confirm(row.id,'actor'),/no longer/);assert.equal(f.effects.length,0);
   const next=await f.prepare();await db.$executeRawUnsafe('UPDATE "PromotionOperation" SET "expiresAt"=$2 WHERE "id"=$1',next.id,new Date(1));await assert.rejects(()=>f.manager.confirm(next.id,'actor'),/expired/);const latest=await f.prepare();assert.notEqual(latest.id,next.id);assert.equal((await f.repo.get(next.id)).status,'expired');
  });
  await t.test('permission revocation and stale previews fail before role mutations',async()=>{
   const f=fixture(),row=await f.prepare();f.actor.roles.cache.delete('1529545703024627754');await assert.rejects(()=>f.manager.confirm(row.id,'actor'),/destination team/);assert.equal(f.effects.length,0);
   const g=fixture(),p=await g.prepare();g.target.roles.cache.set('1529544864960745553',g.roles.get('1529544864960745553'));await assert.rejects(()=>g.manager.confirm(p.id,'actor'),/higher|changed/);assert.equal(g.effects.length,0);
   const h=fixture(),altered=await h.prepare();altered.data.plan.add.push('unrelated');await h.repo.save(altered);await assert.rejects(()=>h.manager.confirm(altered.id,'actor'),/configuration changed/);assert.equal(h.effects.length,0);
  });
  await t.test('actor hierarchy, missing/managed roles, public logs and privilege escalation fail closed',async()=>{
   const f=fixture();f.roles.get('1529544875308089558').position=101;await assert.rejects(()=>f.prepare(),/hierarchy/);f.roles.get('1529544875308089558').position=12;f.roles.get('1529544875308089558').managed=true;await assert.rejects(()=>f.prepare(),/cannot manage/);
   const g=fixture();g.publicLogs();await assert.rejects(()=>g.prepare(),/private/);assert.equal(g.effects.length,0);
   const h=fixture();h.actor.permissions=new PermissionsBitField(0n);h.roles.get('1529544875308089558').permissions=new PermissionsBitField(PermissionFlagsBits.Administrator);await assert.rejects(()=>h.prepare(),/permissions you do not possess/);
  });
  await t.test('incremental changes preserve an unrelated role added during execution and do not ping rank roles',async()=>{
   const f=fixture();f.inject();const row=await f.prepare('1529544806555193434');const result=await f.manager.confirm(row.id,'actor');assert.equal(result.status,'applied');assert.ok(f.target.roles.cache.has('external-unrelated'));assert.ok(!f.target.roles.cache.has('1529544884783022100'));const p=f.effects.find(x=>x.type==='announcement').payload;assert.deepEqual(p.allowedMentions.roles,[]);assert.ok(JSON.stringify(p).includes(row.reason));
  });
  await t.test('blocked DM records failure without rollback; duplicate confirmation never repeats announcements',async()=>{
   const f=fixture();f.blockDm();const row=await f.prepare();const result=await f.manager.confirm(row.id,'actor');assert.equal(result.status,'applied');assert.match(result.data.dmStatus,/failed/);await f.manager.confirm(row.id,'actor');assert.equal(f.effects.filter(x=>x.type==='announcement').length,1);assert.equal(f.effects.filter(x=>x.type==='dm-attempt').length,1);assert.equal(f.effects.filter(x=>x.type==='log').length,1);
  });
  await t.test('partial failure restores only managed changes and retains unrelated concurrent changes',async()=>{
   const f=fixture();f.inject();const before=f.manager.managed(f.target),row=await f.prepare('1529544806555193434');f.setFault(3);await assert.rejects(()=>f.manager.confirm(row.id,'actor'),/restored and verified/);assert.equal((await f.repo.get(row.id)).status,'rolled_back');assert.ok(sameRoles(f.manager.managed(f.target),before));assert.ok(f.target.roles.cache.has('external-unrelated'));assert.equal(f.effects.filter(x=>x.type==='announcement').length,0);
  });
  await t.test('a mutation followed by uncertain HTTP failure is reconciled rather than falsely succeeding',async()=>{
   const f=fixture(),before=f.manager.managed(f.target),row=await f.prepare('1529544806555193434');f.setFault(2,true);await assert.rejects(()=>f.manager.confirm(row.id,'actor'),/restored and verified/);assert.ok(sameRoles(f.manager.managed(f.target),before));assert.equal((await f.repo.get(row.id)).status,'rolled_back');
  });
  await t.test('an interrupted operation is rolled back after restart; completed roles are recovered as verified',async()=>{
   const f=fixture(),row=await f.prepare('1529544806555193434');const applying=await f.repo.claim(row.id,'actor');await f.manager.persistProfile(applying,'pending');await f.manager.step(applying,'add',applying.data.plan.add[0]);await f.restart().recover();assert.equal((await f.repo.get(row.id)).status,'rolled_back');assert.ok(sameRoles(f.manager.managed(f.target),row.data.plan.beforeManaged));
   const g=fixture(),p=await g.prepare(),active=await g.repo.claim(p.id,'actor');for(const id of active.data.plan.add)g.target.roles.cache.set(id,g.roles.get(id));for(const id of active.data.plan.remove)g.target.roles.cache.delete(id);await g.restart().recover();assert.equal((await g.repo.get(p.id)).status,'applied');assert.equal(g.effects.filter(x=>x.type==='announcement').length,1);
  });
  await t.test('failed rollback is recorded as uncertain with no announcement and a persistent member lock',async()=>{
   const f=fixture(),row=await f.prepare('1529544806555193434');f.setFault(3);f.rollbackFail();await assert.rejects(()=>f.manager.confirm(row.id,'actor'),/requires administrator reconciliation/);const saved=await f.repo.get(row.id);assert.equal(saved.status,'uncertain');assert.ok(saved.activeKey);assert.equal(f.effects.filter(x=>x.type==='announcement').length,0);assert.equal(f.records['profile:target'].roleOperation.status,'uncertain');
  });
  await t.test('unreconciled external managed changes remain locked and are never silently overwritten',async()=>{
   const f=fixture(),row=await f.prepare(),active=await f.repo.claim(row.id,'actor');await f.manager.persistProfile(active,'pending');f.target.roles.cache.set('1529544864960745553',f.roles.get('1529544864960745553'));await f.restart().recover();assert.equal((await f.repo.get(row.id)).status,'uncertain');assert.ok(f.target.roles.cache.has('1529544864960745553'));await assert.rejects(()=>f.prepare('1529544806555193434'),/requires review|Conflicting/);
  });
  await t.test('concurrent confirmations apply once; announcement receipt crashes recover without duplicate sends',async()=>{
   const f=fixture(),row=await f.prepare();const results=await Promise.allSettled([f.manager.confirm(row.id,'actor'),f.manager.confirm(row.id,'actor')]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.effects.filter(x=>x.type==='announcement').length,1);
   const g=fixture(),p=await g.prepare(),original=g.repo.save.bind(g.repo);let crash=true;g.repo.save=async(r:any,status?:string)=>{if(crash&&r.data.announcementId){crash=false;throw Error('Receipt save failed');}return original(r,status);};await g.manager.confirm(p.id,'actor');g.repo.save=original;await g.restart().recover();assert.equal(g.effects.filter(x=>x.type==='announcement').length,1);assert.equal((await g.repo.get(p.id)).data.delivered,true);
  });
  await t.test('a stale recovery scan cannot replay completed deliveries or race another staff operation',async()=>{
   const f=fixture(),row=await f.prepare();await f.manager.confirm(row.id,'actor');const stale=structuredClone(await f.repo.get(row.id));stale.status='applying';stale.data.delivered=false;stale.data.dmStatus='pending';delete stale.data.announcementId;delete stale.data.logId;f.repo.recovery=async()=>[stale];await f.restart().recover();assert.equal(f.effects.filter(x=>x.type==='dm').length,1);assert.equal(f.effects.filter(x=>x.type==='announcement').length,1);
   const interrupted=await f.repo.get(row.id);interrupted.data.delivered=false;await f.repo.save(interrupted);f.records['profile:target'].roleOperation.status='pending';await f.restart().recover();assert.equal(f.records['profile:target'].roleOperation.status,'applied');assert.equal(f.effects.filter(x=>x.type==='dm').length,1);
   const {staffLocks}=await import('../apps/bot/src/staff-locks.js');const g=fixture(),p=await g.prepare();const key=g.config.guildId+':target';staffLocks.add(key);try{await assert.rejects(()=>g.manager.confirm(p.id,'actor'),/staff update is in progress/);assert.equal(g.effects.length,0);}finally{staffLocks.delete(key);}
  });
 }finally{await db.$disconnect();await socket.stop();await engine.close();}
});
