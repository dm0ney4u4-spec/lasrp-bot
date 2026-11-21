import 'dotenv/config';
import fs from 'node:fs';
import {Client,PermissionFlagsBits} from 'discord.js';
import {infractionConfig as config} from '../config/infractions.js';
const client=new Client({intents:[]});client.rest.setToken(process.env.DISCORD_BOT_TOKEN!);
try {
 const guild=await client.guilds.fetch(config.guildId);await guild.roles.fetch();const identity=await client.rest.get('/users/@me') as {id:string};const bot=await guild.members.fetch(identity.id);
 let failed=false;
 for(const id of new Set(Object.values(config.roles).flat().filter(Boolean) as string[])) {const role=await guild.roles.fetch(id).catch(()=>null);const ready=!!role&&!role.managed&&role.position<bot.roles.highest.position;console.log(`Role ${id}: ${ready?'ready':'MISSING or unmanageable'}`);if(!ready)failed=true;}
 for(const [name,id] of [['announcements',config.announcementChannelId],['private audit',config.logChannelId]]) {const channel=await guild.channels.fetch(id);const ready=!!channel&&[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.ReadMessageHistory].every(p=>channel.permissionsFor(bot)?.has(p));const privateEnough=name!=='private audit'||!!channel&&!channel.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel);console.log(`${name}: ${ready&&privateEnough?'ready':'CHECK permissions/privacy'}`);if(!ready||!privateEnough)failed=true;}
 for(const key of ['ManageRoles'] as const) {const ready=bot.permissions.has(PermissionFlagsBits[key]);console.log(`${key}: ${ready}`);if(!ready)failed=true;}
 for(const [key,path] of Object.entries(config.assets)) {const ready=fs.existsSync(path);console.log(`${key} artwork: ${ready?'ready':'MISSING'}`);if(!ready)failed=true;}
 console.log('White icon: '+(await guild.emojis.fetch(config.iconId).catch(()=>null)?'ready':'unavailable'));
 if(failed)process.exitCode=1;
} catch(error) {console.error('Infraction diagnostics:',(error as {code?:number}).code??(error instanceof Error?error.name:'Error'));process.exitCode=1;} finally {client.destroy();}
