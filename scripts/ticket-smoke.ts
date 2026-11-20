import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { AssistanceSystem as TicketSystem } from '../apps/bot/src/ticket-system/assistance.js';
import { ticketConfig } from '../config/tickets.js';
// Explicit operator-only test. Creates one real owner ticket and exercises the real delivery path.
if (!process.argv.includes('--run'))
    throw Error('Use --run to create and close one real test ticket. This notifies the owner and General Support role.');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const tickets = new TicketSystem(client);
try {
    const ready = new Promise<void>(resolve => client.once(Events.ClientReady, () => resolve()));
    await client.login(process.env.DISCORD_BOT_TOKEN);
    await ready;
    await tickets.diagnose();
    const guild = await client.guilds.fetch(ticketConfig.guildId), actor = await tickets.actor(client.user!.id), user = await client.users.fetch(guild.ownerId);
    if (tickets.repo.activeFor(ticketConfig.guildId, user.id, 'general'))
        throw Error('Owner already has an active General Support ticket. Test stopped without altering it.');
    const ticket = await tickets.create('general', user, 'Controlled setup test: verify private ticket creation, claim, HTML transcript logging, and safe closure.');
    console.log('Created live test ticket #' + String(ticket.number).padStart(4, '0') + ' in channel ' + ticket.channelId);
    await tickets.change(ticket.id, actor, 'claim');
    const card = tickets.requestConfirmation(tickets.repo.get(ticket.id), actor, 'close');
    const container: any = card.components[0].toJSON();
    const confirmId = container.components.at(-1).components[0].custom_id.split(':')[2];
    tickets.repo.consumeConfirmation(confirmId, actor.id);
    await tickets.close(ticket.id, actor);
    const final = tickets.repo.get(ticket.id), delivery = tickets.repo.delivery(ticket.id);
    console.log(JSON.stringify({ ticketNumber: final.number, status: final.lifecycle, transcriptMessages: final.transcript.messageCount, transcriptParts: final.transcript.parts.length, logStatus: delivery.log_status, summaryId: delivery.summary_id, dmStatus: delivery.dm_status, channelDeleted: !await guild.channels.fetch(final.channelId).catch(error => {
            if (error.code === 10003)
                return null;
            throw error;
        }) }));
}
catch (error) {
    console.error('Live ticket test failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
}
finally {
    client.destroy();
    await tickets.stop();
}
