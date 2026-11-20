import { PermissionFlagsBits } from 'discord.js';
import { isBotOwner } from '../owner-access.js';
import { TicketError } from './database.js';
export const categoryFor = (config, key) => {
    const found = config.categories.find(c => c.key === key);
    if (!found)
        throw new TicketError('Choose one of the three support categories.');
    return found;
};
export function actorFromMember(member) {
    return { id: member.id, roles: [...member.roles.cache.keys()], administrator: isBotOwner(member.id) || member.id === member.guild?.ownerId || member.permissions.has(PermissionFlagsBits.Administrator), username: member.user?.username ?? member.displayName };
}
export function isAdministrator(actor, config) {
    return isBotOwner(actor.id) || config.allowDiscordAdministrators && actor.administrator || config.administratorRoleIds.some(id => actor.roles.includes(id));
}
export function managementRoles(ticket, config) {
    return [...new Set([categoryFor(config, ticket.category).supportRoleId, ...ticket.escalatedRoles])];
}
export function canManage(ticket, actor, config) {
    return isAdministrator(actor, config) || managementRoles(ticket, config).some(id => actor.roles.includes(id));
}
export function canSupervise(ticket, actor, config) {
    return isAdministrator(actor, config) || canManage(ticket, actor, config) && config.supervisorRoleIds.some(id => actor.roles.includes(id));
}
export function canView(ticket, actor, config) {
    const category = categoryFor(config, ticket.category);
    return actor.id === ticket.creatorId || isAdministrator(actor, config) || [category.supportRoleId, ...category.viewerRoleIds, ...ticket.escalatedRoles].some(id => actor.roles.includes(id));
}
export function authorize(ticket, actor, action, config) {
    if (!ticket || ticket.guildId !== config.guildId)
        throw new TicketError('Ticket not found.');
    if (action === 'close' && actor.id === ticket.creatorId && config.creatorCanClose)
        return;
    if (action === 'view' && canView(ticket, actor, config))
        return;
    if (!canManage(ticket, actor, config))
        throw new TicketError('You do not have permission to manage this ticket.', 'TICKET_FORBIDDEN');
    if (['repair', 'reassign', 'retry'].includes(action) && !canSupervise(ticket, actor, config))
        throw new TicketError('Ticket supervisor permission is required.', 'TICKET_FORBIDDEN');
}
export function nextEscalation(ticket, config) {
    if (ticket.category === 'department')
        return null;
    let current = categoryFor(config, ticket.category);
    for (let i = 0; i < ticket.escalationLevel; i++) {
        if (!current.escalateTo)
            return null;
        current = categoryFor(config, current.escalateTo);
    }
    return current.escalateTo ? categoryFor(config, current.escalateTo) : null;
}
export function permissionOverwrites(ticket, botId, guildId, config, { closing = false } = {}) {
    const category = categoryFor(config, ticket.category), roles = [...new Set([category.supportRoleId, ...category.viewerRoleIds, ...ticket.escalatedRoles, ...config.administratorRoleIds])];
    if (roles.includes(guildId) || [ticket.creatorId, botId].includes(guildId))
        throw new TicketError('Ticket access configuration is invalid.');
    const read = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], write = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
    return [{ id: guildId, type: 0, deny: [...read, ...write, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads] }, { id: ticket.creatorId, type: 1, allow: [...read, ...(closing ? [] : write)], deny: closing ? write : [] }, { id: botId, type: 1, allow: [...read, ...write, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] }, ...roles.map(id => ({ id, type: 0, allow: [...read, ...(closing ? [] : write)], deny: closing ? write : [] }))];
}
