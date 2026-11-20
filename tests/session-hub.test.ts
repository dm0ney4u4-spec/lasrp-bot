import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Collection, PermissionsBitField, PermissionFlagsBits } from 'discord.js';
import { sessionConfig } from '../config/sessions.js';
import { initialState, transition } from '../apps/bot/src/session-hub/model.js';
import { SessionRepository } from '../apps/bot/src/session-hub/repository.js';
import { panelView, voteView, announcement, serverInfo, statistics } from '../apps/bot/src/session-hub/views.js';
import { sessionCommands } from '../apps/bot/src/session-hub/commands.js';
import { snapshotSchema } from '../apps/api/src/erlc.js';
const config = structuredClone(sessionConfig);
const act = (s:any, type:string, who='staff', extra:any={}, now=1000000) => transition(s, {type,...extra}, who, config, now);
test('session vote toggle, one vote, threshold notification once, and no automatic start', () => {
  let result=act(initialState(),'vote'); let s=result.state;
  assert.equal(s.vote.threshold,2); assert.equal(s.mode,'VOTING');assert.equal(result.events[0].kind,'vote');
  assert.throws(()=>act(s,'vote'),/already active/);
  s=act(s,'ballot','a',{voteId:s.vote.id}).state;
  result=act(s,'ballot','b',{voteId:s.vote.id});s=result.state;
  assert.equal(result.events[0].kind,'threshold');assert.equal(s.mode,'VOTING');assert.equal(s.current,null);
  s=act(s,'ballot','b',{voteId:s.vote.id}).state;assert.deepEqual(s.vote.voters,['a']);
  result=act(s,'ballot','b',{voteId:s.vote.id});assert.equal(result.events.length,0);
  s=act(result.state,'cancel','staff',{voteId:s.vote.id}).state;assert.equal(s.mode,'OFFLINE');assert.equal(s.vote.closed,true);
  assert.throws(()=>act(s,'ballot','a',{voteId:s.vote.id}),/closed/);
});
test('start closes votes, prevents duplicates; low preserves host/time and enforces cooldown',()=>{
  let s=act(initialState(),'vote').state;s=act(s,'start').state;
  const id=s.current.id,at=s.current.startedAt;assert.equal(s.vote.closed,true);assert.equal(s.voteHistory.length,1);
  assert.throws(()=>act(s,'start'),/already active/);
  s=act(s,'low','staff',{},1100000).state;assert.equal(s.current.id,id);assert.equal(s.current.startedAt,at);assert.equal(s.mode,'LOW_ACTIVITY');
  assert.throws(()=>act(s,'low','staff',{},1100001),/five minutes/);
  assert.throws(()=>act(initialState(),'low'),/Start a session/);
});
test('shutdown confirmation is bound to actor, session, expiry and is consumed once',()=>{
  let s=act(initialState(),'start').state;
  s=act(s,'confirm','staff',{id:'token',reason:'End test'}).state;
  assert.throws(()=>act(s,'shutdown','other',{id:'token'}),/someone else/);
  assert.throws(()=>act(s,'shutdown','staff',{id:'token'},1200001),/expired/);
  s=act(s,'stats','system',{stats:{available:true,players:5,capacity:40,staff:1,queue:0,at:1000000}}).state;
  s=act(s,'shutdown','staff',{id:'token'}).state;const id=s.current.id;
  assert.equal(s.mode,'SHUTTING_DOWN');assert.equal(s.current.endedBy,'staff');assert.equal(s.current.finalStats.players,5);
  assert.throws(()=>act(s,'shutdown','staff',{id:'token'}),/expired/);
  s=act(s,'finalize','staff',{sessionId:id}).state;assert.equal(s.mode,'OFFLINE');assert.equal(s.current,null);assert.equal(s.history[0].reason,'End test');
});
test('configured IDs, disabled automation, V2 branding, safe join destinations and real unavailable states',()=>{
  assert.deepEqual(config.roles.sessionStaff,['1529541555726057615']);assert.equal(config.settings.enableAutomaticSessionStart,false);assert.equal(config.settings.enableAutomaticLowAlerts,false);
  assert.equal(config.roles.sessionPing,config.roles.notificationSubscriber);
  assert.equal(serverInfo({ERLC_JOIN_URL:'https://evil.example/'}).url,'');
  assert.equal(serverInfo({ERLC_JOIN_CODE:'NYC-test'}).url,'https://erlc.gg/join/NYC-test');
  const panel=panelView(config,initialState(),serverInfo({}));assert.equal(panel.flags,32768);assert.equal(panel.components[0].accent_color,0xD8C5A4);
  assert.ok(panel.files.some(f=>String(f.attachment).endsWith('main-banner.png')));assert.ok(JSON.stringify(panel).includes('Unavailable'));
  assert.ok(statistics({...initialState(),lastStats:{available:true,at:Date.now()-180000,players:20,capacity:40,staff:2,queue:3}}).includes('**Players:** Unavailable'));
  const result=act(initialState(),'vote'),e=result.events[0];const v:any=announcement(config,e,result.state,serverInfo({}));assert.deepEqual(v.allowedMentions.roles,[config.roles.sessionPing]);assert.equal(JSON.stringify(v.components).split('<@&'+config.roles.sessionPing+'>').length-1,1);
  assert.ok(!JSON.stringify(v.components).includes('Cancel Vote'));
  const edited=voteView(config,result.state);assert.equal(edited.components.filter((c:any)=>c.type===17).length,1);assert.ok(JSON.stringify(edited.components).includes('<@&'+config.roles.notificationSubscriber+'>'));assert.deepEqual(edited.allowedMentions,{parse:[]});
  const threshold=announcement(config,{id:'threshold-event',kind:'threshold',data:{hostId:'staff',votes:2,threshold:2}},result.state,serverInfo({}));assert.ok(!threshold.components.some((c:any)=>c.type===17));assert.equal((threshold as any).files,undefined);
  assert.deepEqual(sessionCommands.map(c=>c.name),['session','ssu','ssd']);
  const subs=sessionCommands[0].toJSON().options!.map(o=>o.name);for(const name of ['vote','start','low','shutdown','status','panel'])assert.ok(subs.includes(name));
});
test('incomplete optional ER emergency-call caller does not reject actual server telemetry',()=>{
  const s=snapshotSchema.parse({Name:'NYC',CurrentPlayers:0,MaxPlayers:40,Players:[],Queue:[],EmergencyCalls:[{CallNumber:1,StartedAt:10,Description:'test',PositionDescriptor:'test',Position:[1,2]}]});assert.equal(s.CurrentPlayers,0);assert.equal(s.EmergencyCalls![0].Caller,undefined);
});
test('PostgreSQL session integration: migrations, concurrent actions, restart, outbox recovery, permissions and panels',async t=>{
  const engine=await PGlite.create();for(const name of fs.readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort())await engine.exec(fs.readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8'));
  const socket=new PGLiteSocketServer({db:engine,host:'127.0.0.1',port:0,maxConnections:1});await socket.start();process.env.DATABASE_URL=`postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`;
  const {db}=await import('../packages/shared/src/database.js');const {Sessions}=await import('../apps/bot/src/session-hub/index.js');
  const repository=new SessionRepository(db,config);await repository.initialize();
  const messages=new Map<string,Collection<string,any>>();let serial=0;const sent:any[]=[];
  const channel=(id:string)=>{
    if(!messages.has(id))messages.set(id,new Collection());const records=messages.get(id)!;
    const make=(payload:any)=>{const mid=String(++serial);const m:any={id:mid,url:'https://discord.com/channels/'+config.guildId+'/'+id+'/'+mid,author:{id:'bot'},createdTimestamp:Date.now(),edit:async(p:any)=>{m.payload=p;apply(p);return m;}};const apply=(p:any)=>{const actual=JSON.parse(JSON.stringify(p.components).replaceAll("attachment://","https://cdn.discordapp.com/attachments/test/"));m.components=actual.map((c:any)=>({toJSON:()=>c}));m.attachments=new Collection();};apply(payload);m.payload=payload;records.set(mid,m);return m;};
    return{id,isTextBased:()=>true,send:async(p:any)=>{sent.push({channelId:id,...p});return make(p);},messages:{fetch:async(arg:any)=>{if(typeof arg==='string'){if(!records.has(arg))throw Object.assign(Error('deleted'),{code:10008});return records.get(arg);}return new Collection([...records.entries()].reverse().filter(([id])=>!arg.before||+id<+arg.before).slice(0,arg.limit));}}};
  };
  let held=true,roleDanger=false;const member={roles:{cache:new Collection([[config.roles.sessionStaff[0],{}]]),add:async()=>{held=true;},remove:async()=>{held=false;}}};
  const guild={members:{fetch:async({user}:any)=>user==='staff'?member:{roles:{cache:new Collection(held?[[config.roles.notificationSubscriber,{}]]:[]),add:async()=>{held=true;},remove:async()=>{held=false;}}},fetchMe:async()=>({permissions:new PermissionsBitField(PermissionFlagsBits.ManageRoles),roles:{highest:{comparePositionTo:()=>1}}})},roles:{fetch:async()=>({id:config.roles.notificationSubscriber,managed:false,permissions:new PermissionsBitField(roleDanger?PermissionFlagsBits.Administrator:0n)})},channels:{fetch:async(id:string)=>channel(id)}};
  const client:any={user:{id:'bot'},guilds:{fetch:async()=>guild}};const g:any={records:{},votes:{},sessions:[]};const service:any={store:{guild:()=>g,save:()=>{},flush:async()=>{}}};
  const erlc:any={snapshot:async()=>({at:Date.now(),data:{CurrentPlayers:0,MaxPlayers:40,Players:[],Queue:[]}})};
  let hub=new Sessions(client,service,erlc,config,repository);
  const interaction=(name:string,sub:string,user='staff',customId?:string,options:any={})=>{const replies:any[]=[];return {guildId:config.guildId,user:{id:user},commandName:name,customId,options:{getSubcommand:()=>sub,getInteger:()=>options.votes??null,getString:()=>options.reason??null},isChatInputCommand:()=>!customId,deferReply:async()=>{},editReply:async(p:any)=>{replies.push(p);},replies};};
  try{
    await t.test('fresh role checks reject members and wrong guild while allowing public status',async()=>{
      await assert.rejects(()=>hub.staff('member',config.guildId),/Session Staff/);await assert.rejects(()=>hub.staff('staff','other'),/main NYC/);
      const i=interaction('session','start','member');await hub.interaction(i);assert.equal((await repository.read()).mode,'OFFLINE');assert.ok(JSON.stringify(i.replies).includes('Session Staff'));
      const status=interaction('session','status','member');await hub.interaction(status);assert.ok(JSON.stringify(status.replies).includes('Session Status'));
    });
    await t.test('notification role toggles and refuses privilege-bearing role',async()=>{assert.equal(await hub.toggleNotifications('member'),false);assert.equal(await hub.toggleNotifications('member'),true);roleDanger=true;await assert.rejects(()=>hub.toggleNotifications('member'),/safely assigned/);roleDanger=false;});
    await t.test('concurrent native starts create only one active session and one event',async()=>{
      const results=await Promise.allSettled([repository.act({type:'start'},'staff'),repository.act({type:'start'},'staff')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await db.session.count({where:{activeKey:config.guildId}}),1);
      await hub.serialize(()=>hub.flush());const state=await repository.read();assert.equal(state.mode,'ONLINE');assert.equal(sent.filter(s=>s.channelId===config.channels.announcements).length,1);
    });
    await t.test('shutdown confirmation, real history, no second shutdown and no automatic session',async()=>{
      await hub.interaction(interaction('session','shutdown','staff',undefined,{reason:'Finished test'}));const state=await repository.read(),id=Object.keys(state.confirmations)[0];
      await hub.interaction(interaction('','', 'staff','nycs:shutdown-confirm:'+id));assert.equal((await repository.read()).mode,'OFFLINE');assert.equal((await repository.read()).history.length,1);assert.equal(await db.session.count({where:{activeKey:config.guildId}}),0);
      const count=sent.length;await hub.interaction(interaction('','', 'staff','nycs:shutdown-confirm:'+id));assert.equal((await repository.read()).history.length,1);assert.equal(sent.filter(s=>JSON.stringify(s.components).includes('# Session Shutdown')).length,1);assert.ok(sent.length>=count);
    });
    await t.test('outbox recovers send-before-receipt crash without duplicate announcement',async()=>{
      await repository.act({type:'vote'},'staff');const original=repository.receipt.bind(repository);let fail=true;
      repository.receipt=async(...args:any[])=>{if(fail&&args[1]==='announcement'){fail=false;throw Error('Simulated receipt crash');}return original(args[0],args[1],args[2]);};
      await assert.rejects(()=>hub.flush(),/receipt crash/);const count=sent.filter(s=>JSON.stringify(s.components).includes('# Session Vote!')).length;
      repository.receipt=original;hub=new Sessions(client,service,erlc,config,new SessionRepository(db,config));await hub.initialize();await hub.flush();assert.equal(sent.filter(s=>JSON.stringify(s.components).includes('# Session Vote!')).length,count);
      assert.ok((await repository.read()).vote.messageId);assert.equal((await repository.read()).mode,'VOTING');
    });
    await t.test('persistent buttons, threshold once, original message edits, deleted vote and panel repair',async()=>{
      const voteId=(await repository.read()).vote.id;
      const before=sent.filter(s=>s.channelId===config.channels.announcements).length;
      const click=interaction('','','a','nycs:vote:'+voteId);await hub.interaction(click);
      assert.equal(sent.filter(s=>s.channelId===config.channels.announcements).length,before,'a vote must edit the existing message without posting another announcement');
      assert.equal(click.replies.length,1);assert.equal(click.replies[0].content,'Your vote has been added.');assert.equal(click.replies[0].components,undefined);assert.equal(click.replies[0].files,undefined);
      await hub.interaction(interaction('','','b','nycs:vote:'+voteId));assert.equal((await repository.read()).mode,'VOTING');
      const threshold=sent.filter(s=>JSON.stringify(s.components).includes('Required votes reached (')).length;assert.equal(threshold,1);
      await hub.interaction(interaction('','','b','nycs:vote:'+voteId));await hub.interaction(interaction('','','b','nycs:vote:'+voteId));assert.equal(sent.filter(s=>JSON.stringify(s.components).includes('Required votes reached (')).length,threshold);
      const old=(await repository.read()).vote.messageId;messages.get(config.channels.announcements)!.delete(old);await hub.updateVote();assert.notEqual((await repository.read()).vote.messageId,old);
      await hub.refresh();const p=(await repository.read()).panel.messageId;await hub.refresh();assert.equal((await repository.read()).panel.messageId,p);assert.equal((await repository.read()).lastStats.players,0);assert.equal((await repository.read()).lastStats.staff,0);
      messages.get(config.channels.permanentPanel)!.delete(p);await hub.refresh();assert.notEqual((await repository.read()).panel.messageId,p);
      const payload=messages.get(config.channels.permanentPanel)!.get((await repository.read()).panel.messageId)!.payload;assert.ok(JSON.stringify(payload).includes('**Players:** 0 / 40'));
    });
    await t.test('unavailable API removes live numbers and pending session data survives restart',async()=>{
      erlc.snapshot=async()=>{throw Error('API timeout');};await hub.refresh();const s=await repository.read();assert.equal(s.lastStats.available,false);assert.equal(s.vote.voters.length,2);assert.equal(s.mode,'VOTING');
      assert.equal(await db.session.count(),1);assert.equal((await db.session.findFirst())!.status,'ended');
    });
  }finally{await hub.stop();await db.$disconnect();await socket.stop();await engine.close();}
});
