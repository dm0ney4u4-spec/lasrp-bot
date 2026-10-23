import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
fs.mkdirSync('backups',{recursive:true});const file=`backups/LASRP-${new Date().toISOString().replace(/[:.]/g,'-')}.dump`;
const database=new URL(process.env.DATABASE_URL);
const result=spawnSync('pg_dump',['--format=custom',`--file=${file}`],{env:{...process.env,PGHOST:database.hostname,PGPORT:database.port||'5432',PGUSER:decodeURIComponent(database.username),PGPASSWORD:decodeURIComponent(database.password),PGDATABASE:database.pathname.slice(1)},stdio:'inherit'});if(result.status!==0)throw Error('pg_dump failed. Install PostgreSQL client tools and check database connectivity.');
const evidenceDirectory=file+'.evidence';fs.mkdirSync(evidenceDirectory,{recursive:true});let fileCount=0;
if(fs.existsSync('data/evidence'))for(const entry of fs.readdirSync('data/evidence',{withFileTypes:true})){if(entry.isFile()&&/^[a-f\d-]{36}\.enc$/i.test(entry.name)){fs.copyFileSync(path.join('data/evidence',entry.name),path.join(evidenceDirectory,entry.name));fileCount++;}}
fs.writeFileSync(file+'.manifest.json',JSON.stringify({database:path.basename(file),encryptedEvidence:path.basename(evidenceDirectory),fileCount,requiresOriginalFileStorageSecret:true,createdAt:new Date().toISOString()},null,2));
console.log(`Private database backup: ${file}. Included ${fileCount} encrypted evidence files. Preserve FILE_STORAGE_SECRET separately in secure storage; the key was not copied into this backup.`);
