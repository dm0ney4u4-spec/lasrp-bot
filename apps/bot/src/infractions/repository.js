import { randomUUID } from 'node:crypto';
import { normalizeId } from './model.js';
export class InfractionRepository {
  constructor(db,config){this.db=db;this.config=config;}
  async state(memberId,tx=this.db){const[row]=await tx.$queryRawUnsafe('SELECT * FROM "StaffDisciplineState" WHERE "guildId"=$1 AND "memberId"=$2',this.config.guildId,memberId);return row;}
  async cases(memberId){return this.db.$queryRawUnsafe('SELECT * FROM "InfractionCase" WHERE "guildId"=$1 AND "memberId"=$2 ORDER BY "createdAt","id"',this.config.guildId,memberId);}
  async case(id,tx=this.db){const[row]=await tx.$queryRawUnsafe('SELECT * FROM "InfractionCase" WHERE "guildId"=$1 AND "id"=$2',this.config.guildId,normalizeId(id));return row;}
  async initialize(memberId,data,legacy=[]){await this.db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('INSERT INTO "StaffDisciplineState" ("id","guildId","memberId","data") VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING',this.config.guildId+':'+memberId,this.config.guildId,memberId,JSON.stringify(data));
    for(const c of legacy)await this.insertCase(c,tx);
  });return this.state(memberId);}
  async insertCase(c,tx=this.db){const inserted=await tx.$executeRawUnsafe('INSERT INTO "InfractionCase" ("id","guildId","memberId","issuerId","type","status","data","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) ON CONFLICT ("id") DO NOTHING',c.id,this.config.guildId,c.memberId,c.issuerId,c.type,c.status||'active',JSON.stringify(c.data),new Date(c.createdAt));if(!inserted){const old=await this.case(c.id,tx);if(!old||old.memberId!==c.memberId||!(c.data.imported&&old.data.imported||c.data.operationId&&c.data.operationId===old.data.operationId))throw Error('Infraction ID collision. The original case was preserved; request a new action.');}}
  async operation(id,tx=this.db){const[row]=await tx.$queryRawUnsafe('SELECT * FROM "InfractionOperation" WHERE "id"=$1 AND "guildId"=$2',id,this.config.guildId);return row;}
  async create(memberId,actorId,kind,data,draft=false){return this.db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('UPDATE "InfractionOperation" SET "status"=\'expired\',"activeKey"=NULL WHERE "guildId"=$1 AND "memberId"=$2 AND "status"=\'preview\' AND "expiresAt"<CURRENT_TIMESTAMP',this.config.guildId,memberId);
    const id=randomUUID();for(const c of data.plan?.newCases||[])c.data.operationId=id;await tx.$executeRawUnsafe('INSERT INTO "InfractionOperation" ("id","guildId","memberId","actorId","kind","status","activeKey","data","expiresAt") VALUES ($1,$2,$3,$4,$5,\'preview\',$6,$7::jsonb,$8)',id,this.config.guildId,memberId,actorId,kind,draft?null:this.config.guildId+':'+memberId,JSON.stringify(data),new Date(Date.now()+this.config.confirmationMs));return this.operation(id,tx);
  });}
  async claim(id,actorId,cancel=false){return this.db.$transaction(async tx=>{
    const[row]=await tx.$queryRawUnsafe('SELECT * FROM "InfractionOperation" WHERE "id"=$1 AND "guildId"=$2 FOR UPDATE',id,this.config.guildId);
    if(!row||row.actorId!==actorId)throw Error('Only the original executor may use this confirmation.');
    if(row.status!=='preview'||new Date(row.expiresAt).getTime()<=Date.now())throw Error('This confirmation expired or has already been used.');
    if(!cancel){const[state]=await tx.$queryRawUnsafe('SELECT * FROM "StaffDisciplineState" WHERE "guildId"=$1 AND "memberId"=$2 FOR UPDATE',this.config.guildId,row.memberId);if(!state||state.version!==row.data.plan.version)throw Error('The disciplinary record changed. Run the command again for a fresh confirmation.');}
    await tx.$executeRawUnsafe('UPDATE "InfractionOperation" SET "status"=$2,"activeKey"=CASE WHEN $2=\'cancelled\' THEN NULL ELSE "activeKey" END WHERE "id"=$1',id,cancel?'cancelled':'applying');return this.operation(id,tx);
  });}
  async save(op,status=op.status){await this.db.$executeRawUnsafe('UPDATE "InfractionOperation" SET "status"=$2,"activeKey"=$3,"data"=$4::jsonb WHERE "id"=$1 AND "guildId"=$5',op.id,status,['preview','applying','uncertain'].includes(status)&&op.kind!=='duration'?this.config.guildId+':'+op.memberId:null,JSON.stringify(op.data),this.config.guildId);op.status=status;return op;}
  async commit(op){return this.db.$transaction(async tx=>{
    const[current]=await tx.$queryRawUnsafe('SELECT * FROM "InfractionOperation" WHERE "id"=$1 FOR UPDATE',op.id);if(current.status==='applied')return current;
    const[state]=await tx.$queryRawUnsafe('SELECT * FROM "StaffDisciplineState" WHERE "guildId"=$1 AND "memberId"=$2 FOR UPDATE',this.config.guildId,op.memberId);
    if(state.version!==op.data.plan.version)throw Error('Disciplinary state changed while enforcement was running.');
    for(const c of op.data.plan.newCases)await this.insertCase(c,tx);
    for(const change of op.data.plan.caseChanges)await tx.$executeRawUnsafe('UPDATE "InfractionCase" SET "status"=$2,"data"="data"||$3::jsonb WHERE "id"=$1 AND "guildId"=$4',change.id,change.status,JSON.stringify(change.data),this.config.guildId);
    await tx.$executeRawUnsafe('UPDATE "StaffDisciplineState" SET "version"="version"+1,"data"=$3::jsonb WHERE "guildId"=$1 AND "memberId"=$2',this.config.guildId,op.memberId,JSON.stringify(op.data.plan.afterState));
    op.data.committedAt=Date.now();await tx.$executeRawUnsafe('UPDATE "InfractionOperation" SET "status"=\'applied\',"activeKey"=NULL,"data"=$2::jsonb WHERE "id"=$1',op.id,JSON.stringify(op.data));op.status='applied';return op;
  });}
  async patchCase(id,data,status){await this.db.$executeRawUnsafe('UPDATE "InfractionCase" SET "data"="data"||$3::jsonb,"status"=COALESCE($4,"status") WHERE "id"=$1 AND "guildId"=$2',normalizeId(id),this.config.guildId,JSON.stringify(data),status||null);return this.case(id);}
  async recovery(){return this.db.$queryRawUnsafe('SELECT * FROM "InfractionOperation" WHERE "guildId"=$1 AND ("status"=\'applying\' OR ("status"=\'applied\' AND NOT COALESCE(("data"->>\'delivered\')::boolean,FALSE)) OR ("status"=\'preview\' AND "expiresAt"<CURRENT_TIMESTAMP)) ORDER BY "createdAt"',this.config.guildId);}
  async evidenceCases(){return this.db.$queryRawUnsafe('SELECT * FROM "InfractionCase" WHERE "guildId"=$1 AND "data"?\'evidenceParentId\'',this.config.guildId);}
  async due(){return this.db.$queryRawUnsafe('SELECT * FROM "InfractionCase" WHERE "guildId"=$1 AND "status"=\'active\' AND "type"=\'suspension\' AND "data"->>\'expiresAt\' IS NOT NULL AND NOT COALESCE(("data"->>\'expiryNotified\')::boolean,FALSE)',this.config.guildId);}
  async evidence(caseId,message){await this.db.$executeRawUnsafe('INSERT INTO "InfractionEvidence" ("id","caseId","authorId","data","createdAt") VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT DO NOTHING',message.id,caseId,message.author.id,JSON.stringify({text:message.content,attachments:[...message.attachments.values()].map(a=>({id:a.id,name:a.name,url:a.url,size:a.size})),channelId:message.channelId}),new Date(message.createdTimestamp));}
  async submissions(id){return this.db.$queryRawUnsafe('SELECT "id","authorId","createdAt" FROM "InfractionEvidence" WHERE "caseId"=$1 ORDER BY "createdAt"',id);}
}
