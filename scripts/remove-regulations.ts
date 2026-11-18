import 'dotenv/config';
import fs from 'node:fs';
import {REST,Routes} from 'discord.js';
import {ids} from '../config/ids.js';
const rest=new REST({version:'10'}).setToken(process.env.DISCORD_BOT_TOKEN??'');
const me=await rest.get(Routes.user('@me')) as {id:string};
const channel=await rest.get(Routes.channel(ids.channels.rules)) as {guild_id:string};
if(channel.guild_id!==ids.guildId)throw Error('Configured regulations channel is not in the main server.');
let before:string|undefined;const removed:string[]=[];
while(true){
 const batch=await rest.get(Routes.channelMessages(ids.channels.rules),{query:new URLSearchParams({limit:'100',...(before?{before}:{})})}) as {id:string;author:{id:string};components?:unknown[];embeds?:unknown[]}[];
 if(!batch.length)break;
 for(const message of batch){if(message.author.id!==me.id)continue;const content=JSON.stringify({components:message.components,embeds:message.embeds});if(!content.includes('ls:regulations:')&&!content.includes('NEW YORK CITY ROLEPLAY | REGULATIONS'))continue;await rest.delete(Routes.channelMessage(ids.channels.rules,message.id));removed.push(message.id);}
 const last=batch.at(-1)!.id;if(last===before)throw Error('History pagination did not advance.');before=last;if(batch.length<100)break;
}
fs.writeFileSync('data/removed-regulations.json',JSON.stringify({channelId:ids.channels.rules,removed,at:new Date().toISOString()},null,2));
console.log('Regulations panels removed: '+removed.length);
