import 'dotenv/config';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
if(process.env.NODE_ENV==='production')throw Error('Embedded demo database is not permitted in production.');
process.env.DEMO_MODE='true';process.env.BOT_ENABLED='false';process.env.APP_SESSION_SECRET||='local-demo-only-session-secret-0123456789abcdef';process.env.WEB_BASE_URL||='http://localhost:3000';
fs.mkdirSync('data',{recursive:true});const engine=await PGlite.create('data/demo-postgres');
await engine.exec('CREATE TABLE IF NOT EXISTS "_LasrpDemoMigration" ("name" TEXT PRIMARY KEY, "appliedAt" TIMESTAMP NOT NULL DEFAULT NOW())');
const known:Record<string,string>={'0001_initial':'User','0002_sessions':'Session','0003_cad_workflows':'TrafficStop','0004_private_evidence':'Evidence'};
for(const name of fs.readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort()){
 const done=await engine.query('SELECT 1 FROM "_LasrpDemoMigration" WHERE "name"=$1',[name]);if(done.rows.length)continue;
 const existing=known[name]?await engine.query<{present:string|null}>('SELECT to_regclass($1)::text AS present',[`public."${known[name]}"`]):null;
 await engine.transaction(async tx=>{if(!existing?.rows[0]?.present)await tx.exec(fs.readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8'));await tx.query('INSERT INTO "_LasrpDemoMigration" ("name") VALUES ($1)',[name]);});
}
const socket=new PGLiteSocketServer({db:engine,host:'127.0.0.1',port:54329,maxConnections:1});await socket.start();
process.env.DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1';
const {db}=await import('../packages/shared/src/database.js');
await db.user.upsert({where:{id:'DEMO_OWNER'},create:{id:'DEMO_OWNER',displayName:'DEMO • Local Owner'},update:{}});
console.log('DEMO database ready. Use Local demo sign-in. Production records are excluded.');
await import('../apps/api/src/main.js');
