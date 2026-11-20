import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ids } from './ids.js';
const branding = fileURLToPath(new URL('../assets/branding/', import.meta.url));
export const legacyTicketConfig = {
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
// Current assistance policy. Historical categories are retained only for existing records.
export const ticketConfig = {
    ...legacyTicketConfig, accentColor: 0xD8C5A4, creatorCanClose: false, secureTranscripts: true,
    maxOpenTickets: 1, inquiryDelayMs: 10000, selectionLifetimeMs: 14 * 60 * 1000,
    dmUponClosure: true, deleteClosedTickets: true, supportRatings: true, transcriptAccess: 'discord-administrators',
    logo: path.join(branding, 'nyc-logo.png'), footerBanner: path.join(branding, 'nyc-assistance-footer.png'),
    emojiIds: { support: '1530309174506950727', information: '1557908396928409640', claim: '1530309124682813552', unclaim: '1530309124682813552', close: '1530317213238562847' },
    legacyCategories: legacyTicketConfig.categories.filter(c => c.key !== 'general'),
    categories: [
        { key: 'general', name: 'General Support', categoryId: '1530304754045943808', supportRoleId: '1529545919907762397', confidential: false },
        { key: 'staff_report', name: 'Staff Reports', categoryId: '1573101012799987872', supportRoleId: '1529545769462272140', confidential: true },
        { key: 'purchase', name: 'Purchase Support', categoryId: '1573101137442115594', supportRoleId: '1529545703024627754', confidential: false },
        { key: 'appeal', name: 'Punishment Appeals', categoryId: '1573103713000886384', supportRoleId: '1529545769462272140', confidential: true },
        { key: 'escalated', name: 'Escalated Tickets', categoryId: '1573101311145152625', supportRoleId: '1529542214336778322', confidential: true },
    ].map(c => ({ ...c, viewerRoleIds: [], escalateTo: c.key === 'escalated' ? null : 'escalated' })),
};
export const assistanceForms = {
    general: { title: 'Support Ticket Inquiry', fields: [{ id: 'reason', label: 'What is your reason for opening this ticket?', placeholder: 'I need help with...', required: true, min: 10, max: 1000 }] },
    staff_report: { title: 'Staff Report', fields: [{ id: 'reported', label: 'Which staff member are you reporting?', placeholder: 'Discord mention or user ID', required: true, max: 100 }, { id: 'incident', label: 'Please describe the incident.', required: true, min: 10, max: 1000 }, { id: 'when', label: 'When did the incident occur?', required: true, max: 200 }, { id: 'evidence', label: 'Please provide any supporting evidence.', required: false, max: 1000 }] },
    purchase: { title: 'Purchase Assistance', fields: [{ id: 'product', label: 'What product or service did you purchase?', required: true, max: 300 }, { id: 'roblox', label: 'What is your Roblox username?', required: true, max: 30 }, { id: 'reference', label: 'What is your transaction or order reference?', placeholder: 'Order reference only; never payment details', required: true, max: 200 }, { id: 'additional', label: 'Additional information.', required: false, max: 1000 }] },
    appeal: { title: 'Punishment Appeal', fields: [{ id: 'roblox', label: 'What is your Roblox username?', required: true, max: 30 }, { id: 'punishment', label: 'What punishment did you receive?', required: true, max: 300 }, { id: 'reason', label: 'Why should your punishment be reconsidered?', required: true, min: 10, max: 1000 }, { id: 'evidence', label: 'Do you have any supporting evidence?', required: false, max: 1000 }] },
};
