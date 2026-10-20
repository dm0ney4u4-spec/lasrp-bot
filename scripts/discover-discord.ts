import 'dotenv/config';
import fs from 'node:fs';
const token=process.env.DISCORD_BOT_TOKEN;if(!token)throw Error('Configure DISCORD_BOT_TOKEN in .env first.');
async function get(route:string){const response=await fetch('https://discord.com/api/v10'+route,{headers:{Authorization:'Bot '+token},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`Discord discovery failed (HTTP ${response.status}). Check token and bot installation. No secret values were printed.`);return response.json() as Promise<any>;}
try{
 const application=await get('/oauth2/applications/@me'),guilds=await get('/users/@me/guilds');
 const result={clientId:application.id,guilds:[] as {id:string;name:string;ownerId:string}[]};
 for(const guild of guilds){const detail=await get('/guilds/'+guild.id);result.guilds.push({id:detail.id,name:detail.name,ownerId:detail.owner_id});}
 fs.mkdirSync('data',{recursive:true});fs.writeFileSync('data/discord-discovery.json',JSON.stringify(result,null,2));
 console.log('Discord token accepted. Nonsecret application/server IDs:');console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error instanceof Error&&/^Discord discovery/.test(error.message)?error.message:'Could not reach Discord discovery. Check internet connectivity. No credentials were printed.');process.exitCode=1;}
