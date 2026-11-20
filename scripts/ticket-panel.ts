import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { AssistanceSystem as TicketSystem } from '../apps/bot/src/ticket-system/assistance.js';
import { ticketConfig } from '../config/tickets.js';
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const tickets = new TicketSystem(client);
try {
    const ready = new Promise<void>(resolve => client.once(Events.ClientReady, () => resolve()));
    await client.login(process.env.DISCORD_BOT_TOKEN);
    await ready;
    for (const result of await tickets.diagnose())
        console.log(result);
    if (process.argv.includes('--publish')) {
        const guild = await client.guilds.fetch(ticketConfig.guildId), actor = await tickets.actor(guild.ownerId), message = await tickets.publish(ticketConfig.panelChannelId, actor);
        console.log('Ticket panel: ' + message.url);
    }
    if (process.argv.includes('--rename')) {
        if (client.user!.username !== ticketConfig.botName)
            await client.user!.setUsername(ticketConfig.botName);
        await (await client.guilds.fetch(ticketConfig.guildId)).members.editMe({ nick: ticketConfig.botName });
        console.log('Bot account and guild nickname: ' + ticketConfig.botName);
    }
}
catch (error) {
    console.error('Ticket setup failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
}
finally {
    client.destroy();
    await tickets.stop();
}
