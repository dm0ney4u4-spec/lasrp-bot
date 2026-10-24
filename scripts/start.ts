import 'dotenv/config';
import fs from 'node:fs';
try{const response=await fetch('http://127.0.0.1:'+(process.env.PORT??3000)+'/health',{signal:AbortSignal.timeout(1000)}),health=await response.json() as {service?:string;database?:string};if(health.service==='LASRP Operations'&&health.database==='connected'){console.log('LASRP is already running. Open http://localhost:'+(process.env.PORT??3000)+'. Use npm run stop before restarting.');process.exit(0);}}catch{}
fs.mkdirSync('data',{recursive:true});const lock='data/startup-lock.json';
const {acquireStartupLock}=await import('./startup-lock.js');const releaseLock=acquireStartupLock(lock);
if(!releaseLock){console.log('LASRP is already starting in another verified launcher. Wait for its startup window.');process.exit(0);}
const {onShutdown:releaseOnShutdown}=await import('../packages/shared/src/runtime.js');releaseOnShutdown(async()=>{releaseLock();});process.once('exit',releaseLock);
if(process.env.DATABASE_MODE==='portable'){const{startPortablePostgres}=await import('./portable-postgres.js');await startPortablePostgres();}
if(process.env.DATABASE_MODE==='local'){
 if(process.env.NODE_ENV==='production')throw Error('Use PostgreSQL hosting for production; DATABASE_MODE=local is for a single local development process.');
 const {PGlite}=await import('@electric-sql/pglite'),{PGLiteSocketServer}=await import('@electric-sql/pglite-socket');
 fs.mkdirSync('data',{recursive:true});const databasePath=process.env.LOCAL_DATABASE_PATH??'data/local-postgres';let engine;try{engine=await PGlite.create(databasePath);}catch{console.error('Local database could not start. Preserve the data directory and review docs/DISCORD_CONFIGURATION.md. Do not delete the database.');process.exit(1);}
 await engine.exec('CREATE TABLE IF NOT EXISTS "_LasrpLocalMigration" ("name" TEXT PRIMARY KEY, "appliedAt" TIMESTAMP NOT NULL DEFAULT NOW())');
 for(const name of fs.readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort()){
  const done=await engine.query('SELECT 1 FROM "_LasrpLocalMigration" WHERE "name"=$1',[name]);if(done.rows.length)continue;
  await engine.transaction(async tx=>{await tx.exec(fs.readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8'));await tx.query('INSERT INTO "_LasrpLocalMigration" ("name") VALUES ($1)',[name]);});
 }
 const socket=new PGLiteSocketServer({db:engine,host:'127.0.0.1',port:54328,maxConnections:1});await socket.start();
 process.env.DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54328/postgres?connection_limit=1';
 process.env.DEMO_MODE='false';
 const {onShutdown}=await import('../packages/shared/src/runtime.js');onShutdown(async()=>{await socket.stop();await engine.close();});
 console.log('Local persistent database ready. Normal Discord sign-in is enabled; demo access is disabled.');
}
await import('../apps/api/src/main.js');
