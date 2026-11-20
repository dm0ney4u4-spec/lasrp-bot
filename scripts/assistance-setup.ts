import 'dotenv/config';
import fs from 'node:fs';
import { Client, GatewayIntentBits, Events, PermissionFlagsBits } from 'discord.js';
import { AssistanceSystem } from '../apps/bot/src/ticket-system/assistance.js';
import { ticketConfig } from '../config/tickets.js';
import {secureHistoricalTranscripts} from './secure-historical-transcripts.js';
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const system = new AssistanceSystem(client);
try {
    const ready = new Promise<void>(resolve => client.once(Events.ClientReady, () => resolve()));
    await client.login(process.env.DISCORD_BOT_TOKEN);
    await ready;
    const guild = await client.guilds.fetch(ticketConfig.guildId);
    if (process.argv.includes('--secure-logs')) {
        const channel = await guild.channels.fetch(ticketConfig.transcriptChannelId);
        if (!channel || !('permissionOverwrites' in channel))
            throw Error('Assistance log channel unavailable.');
        await channel.permissionOverwrites.set([{ id: guild.id, type: 0, deny: [PermissionFlagsBits.ViewChannel] }, { id: client.user!.id, type: 1, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] }], 'Administrator-only confidential assistance logs and transcripts');
        console.log('Shared assistance log access restricted to Discord Administrators and this bot.');
    }
    const results = await system.diagnose();
    for (const result of results)
        console.log(result);
    if(process.argv.includes('--migrate-transcripts'))await secureHistoricalTranscripts(system,client);
    if (process.argv.includes('--publish')) {
        const message = await system.publish(ticketConfig.panelChannelId, await system.actor(guild.ownerId));
        console.log('Assistance panel: ' + message.url);
        fs.writeFileSync('data/assistance-panel.json', JSON.stringify({ channelId: message.channelId, messageId: message.id, url: message.url, updatedAt: new Date().toISOString() }, null, 2));
    }
    if (process.argv.includes('--avatar')) {
        await client.user!.setAvatar(fs.readFileSync(ticketConfig.logo));
        await client.application!.edit({ icon: fs.readFileSync(ticketConfig.logo) });
        console.log('Existing bot avatar and application icon updated to the supplied white NYC skyline logo.');
    }
}
catch (error) {
    console.error('Assistance setup:', error instanceof Error ? error.message : 'Configuration check failed');
    process.exitCode = 1;
}
finally {
    client.destroy();
    await system.stop();
}
