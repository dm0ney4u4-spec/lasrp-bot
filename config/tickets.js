import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ids } from './ids.js';
const branding = fileURLToPath(new URL('../assets/branding/', import.meta.url));
export const ticketConfig = {
    botName: 'New York Automation',
    guildId: process.env.DISCORD_GUILD_ID || ids.guildId,
    panelChannelId: process.env.TICKET_PANEL_CHANNEL_ID || '1569512860986380449',
    transcriptChannelId: '1530312641728217189',
    databasePath: process.env.TICKET_DATABASE_PATH || 'data/nyc-tickets.sqlite',
    transcriptDirectory: process.env.TICKET_TRANSCRIPT_DIRECTORY || 'data/ticket-transcripts',
    assistanceBanner: path.join(branding, 'nyc-assistance.png'), footerBanner: path.join(branding, 'nyc-footer.png'),
    startingNumber: 1, minInquiryLength: 10, maxInquiryLength: 1000,
    creatorCanClose: true, allowDiscordAdministrators: true, administratorRoleIds: [], supervisorRoleIds: [],
    confirmationSeconds: 120, closeRequestSeconds: 86400, operationLeaseMs: 180000, recoveryIntervalMs: 30000,
    creationRecoveryGraceMs: 120000, transcriptPartBytes: 7 * 1024 * 1024, renameTimeoutMs: 10000,
    categories: [
        { key: 'general', name: 'General Support', categoryId: '1530304754045943808', emojiId: '1530309174506950727', supportRoleId: '1529544817712037939', viewerRoleIds: ['1529545769462272140', '1529545703024627754'], description: 'General questions and assistance', summary: 'Questions, basic assistance, and general server concerns.', escalateTo: 'high_rank' },
        { key: 'high_rank', name: 'High Rank Support', categoryId: '1530304783637025009', emojiId: '1529841131939041300', supportRoleId: '1529545769462272140', viewerRoleIds: ['1529545703024627754', '1529545769462272140'], description: 'Senior staff assistance', summary: 'Serious issues or situations requiring senior staff attention.', escalateTo: 'department' },
        { key: 'department', name: 'Department Support', categoryId: '1569530969327927366', emojiId: '1529664985238867998', supportRoleId: '1529545703024627754', viewerRoleIds: ['1529545703024627754'], description: 'Department-related matters', summary: 'Department-related concerns, inquiries, and leadership matters.', escalateTo: null },
    ],
};
