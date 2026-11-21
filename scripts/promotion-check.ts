import 'dotenv/config';
import fs from 'node:fs';
import {Client,PermissionFlagsBits} from 'discord.js';
import {promotionConfig as config,promotionRanks,promotionManagedRoles} from '../config/promotions.js';
const client=new Client({intents:[]});client.rest.setToken(process.env.DISCORD_BOT_TOKEN!);
try{
 const guild=await client.guilds.fetch(config.guildId);await guild.roles.fetch();const bot=await guild.members.fetch(process.env.DISCORD_CLIENT_ID||'1561426484554506270');
 const missing:string[]=[],unmanageable:string[]=[];
 for(const id of promotionManagedRoles){const role=await guild.roles.fetch(id);if(!role)missing.push(id);else if(role.managed||role.position>=bot.roles.highest.position)unmanageable.push(role.name+' ('+id+')');}
 console.log(`Individual ranks: ${promotionRanks.length}; managed staff roles: ${promotionManagedRoles.size}`);
 console.log('Missing configured roles: '+(missing.join(', ')||'none'));console.log('Roles not below the bot: '+(unmanageable.join(', ')||'none'));
 for(const [name,id]of[['announcements',config.announcementChannelId],['private logs',config.logChannelId]]){const c=await guild.channels.fetch(id);console.log(name+': '+(c&&[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.ReadMessageHistory].every(p=>c.permissionsFor(bot)?.has(p))?'ready':'MISSING permissions'));if(name==='private logs')console.log('Logs private: '+Boolean(c&&!c.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel)));}
 for(const [key,path]of Object.entries(config.assets))console.log(key+' artwork: '+(fs.existsSync(path)?'ready':'MISSING'));
 console.log('Promotion custom icon: '+(await guild.emojis.fetch(config.iconId).catch(()=>null)?'found':'MISSING'));
 console.log('Manage Roles: '+bot.permissions.has(PermissionFlagsBits.ManageRoles));
 if(missing.length||unmanageable.length)process.exitCode=1;
}catch(error){console.error('Promotion diagnostics:',(error as {code?:number}).code??(error instanceof Error?error.name:'Error'));process.exitCode=1;}
finally{client.destroy();}
