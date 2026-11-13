import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { GlobalBans } from '../apps/bot/src/global-bans.js';
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
try {
    const ready = new Promise<void>(resolve => client.once(Events.ClientReady, () => resolve()));
    await client.login(process.env.DISCORD_BOT_TOKEN);
    await ready;
    const handler = new GlobalBans(client, null);
    console.log(JSON.stringify(await handler.diagnose(), null, 2));
}
catch (error) {
    console.error('Global ban setup check failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
}
finally {
    client.destroy();
}
