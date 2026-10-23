import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('../',import.meta.url));
function files(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):[path.join(directory,entry.name)]);}
const output=files(path.join(project,'dist')).map(file=>({file,data:fs.readFileSync(file)}));
const envFile=path.resolve(project,'../../.env');
const secrets=fs.existsSync(envFile)?fs.readFileSync(envFile,'utf8').split(/\r?\n/).flatMap(line=>{
 const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(!match||!/TOKEN|SECRET|PASSWORD|DATABASE_URL|API_KEY/.test(match[1]))return[];
 const value=match[2].trim().replace(/^(['"])(.*)\1$/,'$2');return value.length>=12?[value]:[];
}):[];
for(const {file,data}of output)if(secrets.some(secret=>data.includes(Buffer.from(secret))))throw Error(`Configured secret found in public output: ${path.relative(project,file)}. Do not deploy.`);
const scripts=output.filter(({file})=>file.endsWith('.js')).map(({data})=>data.toString('utf8')).join('\n');
for(const marker of ['PrismaClient','DISCORD_BOT_TOKEN','PORTABLE_DATABASE_PASSWORD','Staff are trusted to serve the community fairly and protect confidential information.'])if(scripts.includes(marker))throw Error('Server-only or staff-policy content found in public JavaScript. Do not deploy.');
console.log(`Public output audit passed (${output.length} files): no configured secrets, server-only markers, or private staff policy content.`);
