import 'dotenv/config';
import { REST,Routes } from 'discord.js';
import { ids } from '../config/ids.js';
import { allCommands } from '../apps/bot/src/main.js';
if(!process.env.DISCORD_BOT_TOKEN||!ids.clientId||!ids.guildId)throw Error('Configure bot token, clientId, and guildId first.');
await new REST({version:'10'}).setToken(process.env.DISCORD_BOT_TOKEN).put(Routes.applicationGuildCommands(ids.clientId,ids.guildId),{body:allCommands.map(c=>c.toJSON())});
console.log(`Registered ${allCommands.length} real commands.`);
