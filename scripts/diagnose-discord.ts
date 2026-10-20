import 'dotenv/config';
import fs from 'node:fs';
import {ids} from '../config/ids.js';
const base='https://discord.com/api/v10';
const get=async(path:string)=>{const r=await fetch(base+path,{headers:{Authorization:'Bot '+process.env.DISCORD_BOT_TOKEN},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Discord HTTP '+r.status);return r.json() as Promise<any>;};
try{const app=await get('/oauth2/applications/@me');console.log(JSON.stringify({applicationId:app.id,redirectUris:app.redirect_uris??'Not returned',botPublic:app.bot_public}));
const channels=await get('/guilds/'+ids.guildId+'/channels'),roles=await get('/guilds/'+ids.guildId+'/roles');fs.writeFileSync('data/guild-configuration.json',JSON.stringify({channels:channels.map((c:any)=>({id:c.id,name:c.name,type:c.type})),roles:roles.map((r:any)=>({id:r.id,name:r.name,position:r.position,permissions:r.permissions}))},null,2));
for(const [name,id]of Object.entries(ids.channels).filter(([,id])=>id))console.log(name+': '+(channels.find((c:any)=>c.id===id)?.name??'NOT FOUND'));
console.log('Staff roles: '+ids.commandPolicy.staffActions.map(id=>roles.find((r:any)=>r.id===id)?.name??'NOT FOUND').join(', '));
const r=await fetch(base+'/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:ids.clientId,client_secret:process.env.DISCORD_OAUTH_CLIENT_SECRET??'',grant_type:'client_credentials',scope:'applications.commands.update'}),signal:AbortSignal.timeout(15000)});const data=await r.json() as any;console.log('OAuth client credentials: '+(r.ok?'ACCEPTED':String(data.error??r.status)));if(r.ok&&data.access_token){await fetch(base+'/oauth2/token/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:ids.clientId,client_secret:process.env.DISCORD_OAUTH_CLIENT_SECRET??'',token:data.access_token,token_type_hint:'access_token'}),signal:AbortSignal.timeout(15000)});}
}catch{console.error('Discord diagnostics failed. No credentials printed.');process.exitCode=1;}
