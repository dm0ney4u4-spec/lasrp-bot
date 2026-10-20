import 'dotenv/config';import{REST}from'discord.js';import{ids}from'../config/ids.js';
const rest=new REST({version:'10'}).setToken(process.env.DISCORD_BOT_TOKEN!);const commands=await rest.get(`/applications/${ids.clientId}/guilds/${ids.guildId}/commands`) as any[];
console.log('Registered session actions: '+commands.filter(c=>['ssu','ssd','session'].includes(c.name)).flatMap(c=>c.name==='session'?c.options.map((s:any)=>'session '+s.name):[c.name]).join(', '));console.log('Apply command present: '+commands.some(c=>c.name==='apply'));console.log('CAD actions: '+commands.find(c=>c.name==='cad')?.options?.map((o:any)=>o.name).join(', '));
for(const key of ['applicationsPanel','cadPanel','rules','sessions'] as const){const messages=await rest.get(`/channels/${ids.channels[key]}/messages?limit=5`) as any[];const ours=messages.filter(m=>m.author.id===ids.clientId);console.log(key+': '+ours.map(m=>m.id+' (V2 '+Boolean(m.flags&32768)+')').join(', '));}
const app=await rest.get(`/applications/${ids.clientId}/commands`) as any[];console.log('Global commands: '+app.map(c=>c.name).join(', '));
console.log('ER:LC key configured: '+Boolean(process.env.ERLC_SERVER_API_KEY));
const r=await fetch('http://localhost:3000/health');console.log('Local health: '+await r.text());
