import 'dotenv/config';
import {REST,Routes} from 'discord.js';
import {projectName} from '../config/project.js';
import {globalBanConfig} from '../config/global-bans.js';
const rest=new REST({version:'10'}).setToken(process.env.DISCORD_BOT_TOKEN??'');
try{
 const current=await rest.get(Routes.user('@me')) as {username:string};
 if(current.username!==projectName)await rest.patch(Routes.user('@me'),{body:{username:projectName}});
 console.log('Discord bot username: '+projectName);
 for(const guild of globalBanConfig.guilds){try{await rest.patch(Routes.guildMember(guild.id,'@me'),{body:{nick:projectName}});console.log(guild.name+' nickname: '+projectName);}catch(error){console.error(guild.name+' nickname could not update; code '+String((error as {code?:number}).code??'unknown'));process.exitCode=1;}}
}catch(error){console.error('Bot rename failed; code '+String((error as {code?:number}).code??'unknown'));process.exitCode=1;}
