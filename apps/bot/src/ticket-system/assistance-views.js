import { assistanceForms as inquiryForms } from '../../../../config/tickets.js';
import { ContainerBuilder, TextDisplayBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, escapeMarkdown } from 'discord.js';
export const DENIED = 'You do not have permission to perform this action.';
const text = value => new TextDisplayBuilder().setContent(value);
const row = (...buttons) => new ActionRowBuilder().addComponents(...buttons);
export function icon(config, key) {
    return config.resolvedEmojis?.[key] ?? null;
}
export function controlButton(config, label, id, style = ButtonStyle.Secondary, key) {
    const button = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
    const emoji = icon(config, key);
    if (emoji)
        button.setEmoji(emoji);
    return button;
}
const gallery = (file, description) => new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://' + file).setDescription(description));
export function footer(container) {
    return container.addSeparatorComponents(new SeparatorBuilder()).addMediaGalleryComponents(gallery('NYC-Footer.png', 'Your Story, Your City, Your Legacy'));
}
export function branded(config, container, ephemeral = false) {
    return { components: [container], flags: MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0), files: [{ attachment: config.assistanceBanner, name: 'NYC-Assistance.png' }, { attachment: config.footerBanner, name: 'NYC-Footer.png' }], attachments: [], allowedMentions: { parse: [], repliedUser: false } };
}
function base(config, title) {
    return new ContainerBuilder().setAccentColor(config.accentColor).addMediaGalleryComponents(gallery('NYC-Assistance.png', 'New York City Assistance')).addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(text('## ' + title));
}
export function assistancePanel(config) {
    const container = base(config, 'New York City Assistance').addTextDisplayComponents(text("Welcome to New York City Roleplay's Assistance Center.\nTo receive assistance, select **Get Support** below and choose the option that best matches your inquiry."));
    container.addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(text('**General Support**\nFor general questions, community concerns, and player reports.'), text('**High Rank Support**\nFor staff reports, administrative concerns, and punishment appeals. Please provide sufficient evidence where applicable.'), text('**Purchase Support**\nFor marketplace questions, purchase claims, and product-related assistance.'));
    footer(container);
    container.addActionRowComponents(row(controlButton(config, 'Get Support', 'na:support', ButtonStyle.Secondary, 'support')));
    return branded(config, container);
}
export function notice(config, title, description, buttons = [], ephemeral = true) {
    const container = new ContainerBuilder().setAccentColor(config.accentColor).addTextDisplayComponents(text('## ' + title), text(description));
    if (buttons.length)
        for (let i = 0; i < buttons.length; i += 5)
            container.addActionRowComponents(row(...buttons.slice(i, i + 5)));
    return { components: [container], flags: MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0), allowedMentions: { parse: [], repliedUser: false } };
}
export function selectionPanel(config, selection, ready) {
    const buttons = [['Staff Report', 'staff_report'], ['Claim Purchase', 'purchase'], ['Appeal Punishment', 'appeal']].map(([label, key]) => controlButton(config, label, `na:choose:${selection.id}:${key}`));
    if (ready)
        buttons.push(controlButton(config, "Inquiry Isn't Listed", `na:choose:${selection.id}:general`, ButtonStyle.Danger));
    return notice(config, 'Get Support', 'Please select the button that best matches your inquiry.', buttons);
}
export { assistanceForms as inquiryForms } from '../../../../config/tickets.js';
export function modal(id, title, fields) {
    return new ModalBuilder().setCustomId(id).setTitle(title).addComponents(...fields.map(field => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(field.id).setLabel(field.label).setStyle(field.short ? TextInputStyle.Short : TextInputStyle.Paragraph).setRequired(field.required ?? true).setMaxLength(field.max ?? 1000).setMinLength(field.min ?? 0).setPlaceholder(field.placeholder ?? 'Enter your response'))));
}
export function inquiryModal(key, selection) {
    const form = inquiryForms[key];
    return modal(`na:inquiry:${selection.id}:${key}`, form.title, form.fields);
}
export function openingPanel(config, ticket, category) {
    const roblox = ticket.roblox ?? {}, infoEmoji = icon(config, 'information'), heading = (infoEmoji ? `<${infoEmoji.animated ? 'a' : ''}:${infoEmoji.name}:${infoEmoji.id}> ` : '') + 'Information';
    const reason = escapeMarkdown(ticket.summary ?? ticket.inquiry);
    const container = base(config, 'Support Ticket').addTextDisplayComponents(text("Thank you for contacting New York City Roleplay. A member of our Assistance Team will be with you shortly.\n\nPlease avoid unnecessarily mentioning staff members.")).addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(text('## ' + heading), text(`**Roblox Username:** ${escapeMarkdown(roblox.username ?? 'Not Linked')}\n**Joined Roblox:** ${roblox.createdAt ? `<t:${Math.floor(new Date(roblox.createdAt).getTime() / 1000)}:D>` : 'Unknown'}\n**Inquiry:** ${category.name}\n**Reason:** ${reason}\n**Ticket ID:** ${String(ticket.number).padStart(4, '0')}`));
    container.addSeparatorComponents(new SeparatorBuilder()).addActionRowComponents(row(controlButton(config, 'Close', `na:close:${ticket.id}`, ButtonStyle.Danger, 'close').setDisabled(ticket.lifecycle !== 'OPEN'), controlButton(config, ticket.claimantId ? 'Unclaim' : 'Claim', `na:${ticket.claimantId ? 'unclaim' : 'claim'}:${ticket.id}`, ButtonStyle.Secondary, ticket.claimantId ? 'unclaim' : 'claim').setDisabled(ticket.lifecycle !== 'OPEN')));
    footer(container);
    return branded(config, container);
}
export function openedPanel(config, ticket) {
    const container = new ContainerBuilder().setAccentColor(config.accentColor).addTextDisplayComponents(text('## Ticket Opened'), text(`Your ticket has been opened. You may visit it in <#${ticket.channelId}>.`));
    footer(container);
    container.addActionRowComponents(row(new ButtonBuilder().setLabel('Open Ticket').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${config.guildId}/${ticket.channelId}`)));
    return { ...branded(config, container, true), files: [{ attachment: config.footerBanner, name: 'NYC-Footer.png' }] };
}
export function staffControl(config, ticket) {
    const options = [['Add Member', 'add'], ['Remove Member', 'remove'], ['Transfer Ticket', 'transfer'], ['Escalate Ticket', 'escalate'], ['Change Priority', 'priority'], ['Rename Ticket', 'rename'], ['Request Response', 'respond'], ['Lock Ticket', 'lock'], ['Unlock Ticket', 'unlock'], ['Ticket Information', 'info'], ['Generate Transcript', 'transcript'], ['Close Ticket', 'close']];
    return notice(config, 'Staff Control Panel', `Ticket **#${String(ticket.number).padStart(4, '0')}** · Controls are checked against your current Discord permissions.`, options.map(([label, action]) => controlButton(config, label, `na:${action}:${ticket.id}`, action === 'close' ? ButtonStyle.Danger : ButtonStyle.Secondary)));
}
export function transcriptLog(config, ticket, category, url) {
    return notice(config, 'Ticket Closed', `**Ticket:** #${String(ticket.number).padStart(4, '0')}\n**Type:** ${category.name}\n**Creator:** <@${ticket.creatorId}>\n**Assigned Staff:** ${ticket.claimantId ? '<@' + ticket.claimantId + '>' : 'Unclaimed'}\n**Closed By:** <@${ticket.closure.actorId}>\n**Closing Reason:** ${escapeMarkdown(ticket.closure.reason || 'Not supplied')}\n**Transcript:** ${ticket.transcript.messageCount} messages · ${ticket.transcript.parts.length} part(s)\n\nDiscord Administrator permission is required to view the transcript.`, [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('View Transcript').setURL(url)], false);
}
export function closureDm(config, ticket, category) {
    const container = base(config, 'Ticket Closed').addTextDisplayComponents(text("Thank you for contacting New York City Roleplay's Assistance Team. Your support ticket has officially been closed."), text(`**Ticket ID:** ${String(ticket.number).padStart(4, '0')}\n**Ticket Type:** ${category.name}\n**Closed By:** <@${ticket.closure.actorId}>\n**Reason:** ${escapeMarkdown(ticket.closure.reason || 'Not supplied')}`), text('We appreciate your patience and hope we were able to assist you.'));
    footer(container);
    if (config.supportRatings)
        container.addActionRowComponents(row(controlButton(config, 'Rate Your Experience', `na:rate:${ticket.id}`)));
    return branded(config, container);
}
