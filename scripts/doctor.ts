import 'dotenv/config';
import net from 'node:net';
import { ids } from '../config/ids.js';
const valid=(value:string|undefined)=>Boolean(value?.trim()&&!/^(?:REPLACE|PASTE|CHANGE_THIS)/i.test(value.trim()));
let problems=0;
function report(label:string,ok:boolean,detail=''){console.log(`${ok?'OK':'FIX'}: ${label}${detail?' — '+detail:''}`);if(!ok)problems++;}
report('Node.js 22.12 or newer',Number(process.versions.node.split('.')[0])>=22);
report('Discord bot token',valid(process.env.DISCORD_BOT_TOKEN));
report('Discord application/client ID',/^\d{17,20}$/.test(ids.clientId));
report('Discord guild ID',/^\d{17,20}$/.test(ids.guildId));
report('Owner user IDs',ids.owners.length>0&&ids.owners.every(id=>/^\d{17,20}$/.test(id)));
report('BOT_ENABLED',process.env.BOT_ENABLED!=='false','must be true for Discord');
report('DEMO_MODE',process.env.DEMO_MODE!=='true','must be false for normal operation');
report('Application session secret',valid(process.env.APP_SESSION_SECRET)&&Number(process.env.APP_SESSION_SECRET?.length)>=32);
report('Discord OAuth secret',valid(process.env.DISCORD_OAUTH_CLIENT_SECRET),'required for CAD sign-in');
const probe=(port:number,host:string)=>new Promise<boolean>(resolve=>{const socket=net.createConnection({port,host});let done=false;const finish=(ok:boolean)=>{if(done)return;done=true;socket.destroy();resolve(ok);};socket.setTimeout(1500);socket.on('connect',()=>finish(true));socket.on('error',()=>finish(false));socket.on('timeout',()=>finish(false));});
let database:URL|undefined;
try{database=new URL(process.env.DATABASE_URL??'');if(!['postgresql:','postgres:'].includes(database.protocol)||/CHANGE_THIS|REPLACE|PASTE_/i.test(database.password))database=undefined;}catch{}
if(process.env.DATABASE_MODE==='portable'){report('Portable PostgreSQL password',valid(process.env.PORTABLE_DATABASE_PASSWORD));console.log('OK: Durable portable PostgreSQL mode ? npm start launches the local server and reuses recovered records.');}
else if(process.env.DATABASE_MODE==='local')console.log('OK: Local persistent database mode — npm start opens data/local-postgres and applies migrations; demo access stays disabled.');
else{report('PostgreSQL connection string',Boolean(database),'must identify your normal PostgreSQL database');if(database)report('Database TCP connection',await probe(Number(database.port||5432),database.hostname),'reachability only; run db:migrate to verify database access');}
const port=Number(process.env.PORT??3000);if(await probe(port,'127.0.0.1'))console.log(`NOTICE: Local port ${port} is occupied. Stop the running demo/backend before npm start.`);
console.log(`\n${problems?'Resolve the FIX entries above before startup.':['local','portable'].includes(process.env.DATABASE_MODE??'')?'Configuration checks passed. Run npm start.':'Configuration checks passed. Run npm run db:migrate, npm run register and npm start.'}\nNo secret values were printed.`);
if(problems)process.exitCode=1;
