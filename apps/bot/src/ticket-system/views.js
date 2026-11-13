import { ContainerBuilder, TextDisplayBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags, FileBuilder, escapeMarkdown } from 'discord.js';
export const ticketNumber = n => String(n).padStart(4, '0');
const stamp = time => time ? `<t:${Math.floor(time / 1000)}:f>` : 'Unavailable';
const text = s => new TextDisplayBuilder().setContent(s);
const image = (name, alt) => new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://' + name).setDescription(alt));
const files = config => [{ attachment: config.assistanceBanner, name: 'NYC-Assistance.png' }, { attachment: config.footerBanner, name: 'NYC-Footer.png' }];
const payload = (components, config, ephemeral = false) => ({ components, files: files(config), attachments: [], flags: MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0), allowedMentions: { parse: [], repliedUser: false } });
export function ticketPanel(config, { ephemeral = false } = {}) {
    const c = new ContainerBuilder().setAccentColor(0x279bd3).addMediaGalleryComponents(image('NYC-Assistance.png', 'New York City Roleplay Assistance')).addTextDisplayComponents(text('# Contact Us — New York City Roleplay'), text('Welcome to **New York City Roleplay Support!**\n\nNeed assistance? Choose the category that best fits your concern. A private ticket will connect you with the appropriate support team.')).addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(text('## Available Support Categories'), ...config.categories.map(category => text(`<:support_${category.key}:${category.emojiId}> **${category.name}**\n${category.summary}`))).addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(text('### Choose Your Category')).addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('nt:select').setPlaceholder('Select a support category').addOptions(config.categories.map(category => ({ label: category.name, value: category.key, description: category.description, emoji: { id: category.emojiId, name: 'support_' + category.key } }))))).addMediaGalleryComponents(image('NYC-Footer.png', 'New York City Roleplay'));
    return payload([c], config, ephemeral);
}
export function ticketCard(ticket, config, next) {
    const category = config.categories.find(c => c.key === ticket.category), closing = ticket.lifecycle === 'CLOSING', status = ticket.lifecycle === 'ERROR' ? 'Staff attention required' : closing ? 'Closing' : ticket.claimantId ? 'Claimed' : 'Unclaimed';
    const c = new ContainerBuilder().setAccentColor(0x279bd3).addMediaGalleryComponents(image('NYC-Assistance.png', 'New York City Roleplay Assistance')).addTextDisplayComponents(text(`# <:support_${category.key}:${category.emojiId}> ${category.name}`), text(`Hello <@${ticket.creatorId}>,\n\nThank you for reaching out to **New York City Roleplay Support**. A member of our support team will assist you as soon as possible. Please remain patient while your request is reviewed.`)).addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(text('## Your Inquiry'), text(escapeMarkdown(ticket.inquiry))).addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(text(`## Discord Information\n**Username:** ${escapeMarkdown(ticket.creatorUsername)}\n**User:** <@${ticket.creatorId}>\n**User ID:** ${ticket.creatorId}\n**Account Created:** ${stamp(ticket.creatorCreatedAt)}\n**Ticket Created:** ${stamp(ticket.createdAt)}\n**Ticket Number:** #${ticketNumber(ticket.number)}`), text(`**Status:** ${status}\n**Assigned Staff:** ${ticket.claimantId ? `<@${ticket.claimantId}>` : 'None'}${ticket.escalationLevel ? '\n**Support:** Escalated to ' + config.categories.find(c => c.key === ticket.escalatedCategories.at(-1))?.name : ''}`)).addMediaGalleryComponents(image('NYC-Footer.png', 'New York City Roleplay'));
    const controls = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`nt:${ticket.claimantId ? 'unclaim' : 'claim'}:${ticket.id}`).setLabel(ticket.claimantId ? 'Unclaim' : 'Claim').setStyle(ticket.claimantId ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(closing), new ButtonBuilder().setCustomId(`nt:close:${ticket.id}`).setLabel('Close').setStyle(ButtonStyle.Danger).setDisabled(closing));
    if (next && ticket.category !== 'department')
        controls.addComponents(new ButtonBuilder().setCustomId(`nt:escalate:${ticket.id}:${ticket.escalationLevel}`).setLabel('Escalate').setStyle(ButtonStyle.Secondary).setDisabled(closing));
    return payload([c, controls], config);
}
export function privateNotice(title, description, buttons = []) {
    const c = new ContainerBuilder().setAccentColor(0x279bd3).addTextDisplayComponents(text('## ' + title), text(description));
    if (buttons.length)
        c.addActionRowComponents(new ActionRowBuilder().addComponents(...buttons.map(b => new ButtonBuilder().setCustomId(b.id).setLabel(b.label).setStyle(b.style ?? ButtonStyle.Secondary))));
    return { components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral, allowedMentions: { parse: [] } };
}
export function confirmationCard(ticket, id, action, target) {
    const close = action === 'close';
    return privateNotice(close ? 'Close Ticket?' : 'Reassign Ticket?', close ? `Are you sure you want to close ticket **#${ticketNumber(ticket.number)}**? The conversation will be preserved before its channel is deleted.` : `Reassign ticket **#${ticketNumber(ticket.number)}** to <@${target}>?`, [{ id: 'nt:confirm:' + id, label: close ? 'Confirm Close' : 'Confirm Reassignment', style: close ? ButtonStyle.Danger : ButtonStyle.Primary }, { id: 'nt:cancel:' + id, label: 'Cancel' }]);
}
export function closureSummary(ticket, category, parts, { continuation = false } = {}) {
    const c = new ContainerBuilder().setAccentColor(0x279bd3).addTextDisplayComponents(text(`# ${continuation ? 'Transcript continuation' : 'Ticket Closed'} — #${ticketNumber(ticket.number)}`));
    if (!continuation)
        c.addTextDisplayComponents(text(`**Category:** ${category.name}\n**Opened By:** <@${ticket.creatorId}>\n**Claimed By:** ${ticket.claimantId ? `<@${ticket.claimantId}>` : 'Not Claimed'}\n**Closed By:** <@${ticket.closure.actorId}>\n**Reason:** ${escapeMarkdown(ticket.inquiry)}\n**Created:** ${stamp(ticket.createdAt)}\n**Closed:** ${stamp(ticket.closedAt ?? ticket.closure.startedAt)}`));
    for (const part of parts)
        c.addFileComponents(new FileBuilder().setURL('attachment://' + part.name));
    return { components: [c], flags: MessageFlags.IsComponentsV2, files: parts.map(p => ({ attachment: p.path, name: p.name })), allowedMentions: { parse: [] } };
}
export function transcriptDm(ticket, category, parts, continuation = false) {
    const c = new ContainerBuilder().setAccentColor(0x279bd3).addTextDisplayComponents(text('## New York City Roleplay — Ticket Transcript'), text(`${continuation ? 'Transcript continuation.' : 'Your support ticket has been closed.\n\nThank you for contacting New York City Roleplay Support. A copy of your ticket transcript is attached for your records.'}\n\n**Ticket Number:** #${ticketNumber(ticket.number)}\n**Category:** ${category.name}\n**Status:** Closed`));
    for (const part of parts)
        c.addFileComponents(new FileBuilder().setURL('attachment://' + part.name));
    return { components: [c], flags: MessageFlags.IsComponentsV2, files: parts.map(p => ({ attachment: p.path, name: p.name })), allowedMentions: { parse: [] } };
}
