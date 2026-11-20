import 'dotenv/config';
import fs from 'node:fs';
import {Client,Events,PermissionFlagsBits} from 'discord.js';
import {sessionConfig as config} from '../config/sessions.js';
import {serverInfo} from '../apps/bot/src/session-hub/views.js';
import {ErlcAdapter} from '../apps/api/src/erlc.js';
const client=new Client({intents:[]});
try {
 const ready=new Promise<void>(r=>client.once(Events.ClientReady,()=>r()));await client.login(process.env.DISCORD_BOT_TOKEN);await ready;
 const guild=await client.guilds.fetch(config.guildId);await guild.roles.fetch();const me=await guild.members.fetchMe();
 for(const [name,id] of Object.entries(config.channels)) {
  const channel=await guild.channels.fetch(id);const permissions=channel?.permissionsFor(me);
  const needed=[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles];
  console.log(`${name}: ${channel&&needed.every(p=>permissions?.has(p))?'ready':'MISSING channel or permissions'} (${id})`);
 }
 for(const id of [...new Set([...config.roles.sessionStaff,...config.roles.sessionAdmin,config.roles.notificationSubscriber])])console.log(`Role ${id}: ${await guild.roles.fetch(id)?'found':'MISSING'}`);
 const subscriber=await guild.roles.fetch(config.roles.notificationSubscriber);
 console.log('Notification role hierarchy: '+(subscriber&&!subscriber.managed&&me.permissions.has(PermissionFlagsBits.ManageRoles)&&me.roles.highest.comparePositionTo(subscriber)>0?'ready':'requires Manage Roles and bot role above subscriber'));
 for(const [name,path] of Object.entries(config.assets))console.log(`${name} artwork: ${fs.existsSync(path)?'ready':'uses main banner fallback'}`);
 const info=serverInfo();for(const name of ['name','owner','code','url'] as const)console.log(`Public server ${name}: ${info[name]?'configured':'not configured'}`);
 try{const snapshot=await new ErlcAdapter(process.env.ERLC_SERVER_API_KEY||'').snapshot();console.log(`ER:LC: live, ${snapshot.data.CurrentPlayers}/${snapshot.data.MaxPlayers} players, ${snapshot.data.Queue?.length??'Unavailable'} queued`);}catch{console.log('ER:LC: unavailable; check private backend API configuration.');}
 console.log('Automatic session start: disabled. Automatic low alerts: '+config.settings.enableAutomaticLowAlerts);
}catch(error){console.error('Session check failed:',(error as {code?:number}).code??(error instanceof Error?error.name:'Error'));if(error instanceof TypeError)console.error(error.stack);process.exitCode=1;}
finally{client.destroy();}
