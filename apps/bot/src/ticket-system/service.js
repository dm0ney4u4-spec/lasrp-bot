import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ChannelType, PermissionFlagsBits, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags, Routes } from 'discord.js';
import { ticketConfig } from '../../../../config/tickets.js';
import { TicketRepository, TicketError } from './database.js';
import { actorFromMember, authorize, categoryFor, isAdministrator, canManage, nextEscalation, permissionOverwrites } from './permissions.js';
import { ticketPanel, ticketCard, privateNotice, confirmationCard, closureSummary, transcriptDm, ticketNumber } from './views.js';
import { captureTranscript, verifyParts } from './transcripts.js';
const code = error => String(error?.code ?? error?.name ?? 'UNKNOWN');
const nonce = value => createHash('sha256').update(value).digest('hex').slice(0, 24);
const missing = error => [10003, 10008].includes(Number(error?.code));
const marker = (id, kind, index) => `NYC-TICKET:${id}:${kind}:${index}`;
function addMarker(payload, value) {
    payload.components[0].addTextDisplayComponents(c => c.setContent('-# ' + value));
    return { ...payload, nonce: nonce(value), enforceNonce: true };
}
function contains(message, value) {
    return JSON.stringify(message.components?.map(c => c.toJSON?.() ?? c) ?? []).includes(value);
}
/** All operations use durable leases. Discord mutations are recoverable side effects of SQLite state. */
export class TicketSystem {
    /** @param {any} client @param {any} config @param {TicketRepository|null} repository */
    constructor(client, config = ticketConfig, repository = null) {
        this.client = client;
        this.config = config;
        this.repository = repository;
        this.running = new Set();
        this.stopping = false;
        this.timer = null;
        this.recovering = false;
    }
    get repo() {
        return this.repository ??= new TicketRepository(this.config.databasePath, this.config.startingNumber);
    }
    log(event, error, ticket) {
        console.error(JSON.stringify({ system: 'tickets', event, code: code(error), ticketId: ticket?.id }));
    }
    async guild() {
        return this.client.guilds.fetch(this.config.guildId);
    }
    async actor(userId) {
        return actorFromMember(await (await this.guild()).members.fetch({ user: userId, force: true }));
    }
    async channel(ticket) {
        return (await this.guild()).channels.fetch(ticket.channelId);
    }
    assertAdmin(actor) {
        if (!isAdministrator(actor, this.config))
            throw new TicketError('Only a configured ticket administrator may use this command.', 'TICKET_FORBIDDEN');
    }
    assertOpen(ticket) {
        if (ticket.lifecycle !== 'OPEN')
            throw new TicketError('This ticket is not open for changes. A supervisor can inspect or retry its closure.');
    }
    async leased(id, purpose, work) {
        const token = this.repo.acquire(id, purpose, this.config.operationLeaseMs), timer = setInterval(() => {
            try {
                this.repo.heartbeat(id, token, this.config.operationLeaseMs);
            }
            catch (error) {
                this.log('lease_heartbeat_failed', error, { id });
            }
        }, Math.max(1000, Math.floor(this.config.operationLeaseMs / 3)));
        timer.unref();
        try {
            return await work(token);
        }
        finally {
            clearInterval(timer);
            this.repo.release(id, token);
        }
    }
    async diagnose() {
        const guild = await this.guild(), me = await guild.members.fetchMe(), results = [];
        for (const asset of [this.config.assistanceBanner, this.config.footerBanner])
            await fs.access(asset);
        if (this.config.categories.length !== 3 || new Set(this.config.categories.map(c => c.key)).size !== 3)
            throw new TicketError('Exactly three distinct ticket categories must be configured.');
        const emojis = await guild.emojis.fetch();
        for (const category of this.config.categories) {
            const parent = await guild.channels.fetch(category.categoryId);
            if (parent?.type !== ChannelType.GuildCategory)
                throw new TicketError(`${category.name}: configured category is unavailable.`);
            for (const id of new Set([category.supportRoleId, ...category.viewerRoleIds]))
                if (id === guild.id || !await guild.roles.fetch(id))
                    throw new TicketError(`${category.name}: configured support role is unavailable.`);
            if (!emojis.has(category.emojiId))
                throw new TicketError(`${category.name}: custom emoji is unavailable.`);
            if (!parent.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels]))
                throw new TicketError(`${category.name}: bot requires View Channel and Manage Channels.`);
            results.push(category.name + ': category, roles and emoji verified');
        }
        const log = await guild.channels.fetch(this.config.transcriptChannelId);
        if (log?.type !== ChannelType.GuildText)
            throw new TicketError('Transcript log must be a guild text channel.');
        if (log.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel))
            throw new TicketError('Transcript logging is blocked: the log channel must deny @everyone View Channel.', 'TRANSCRIPT_LOG_NOT_PRIVATE');
        if (!log.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles]))
            throw new TicketError('Bot needs View Channel, Send Messages, Read Message History and Attach Files in transcript logs.');
        this.repo.db.prepare('SELECT 1').get();
        await fs.mkdir(this.config.transcriptDirectory, { recursive: true });
        results.push('Private transcript log and durable SQLite storage verified');
        results.push('Message Content intent: ' + (this.client.options.intents.has(GatewayIntentBits.MessageContent) ? 'requested (also enable it in the Discord Developer Portal)' : 'NOT requested'));
        return results;
    }
    async publish(channelId, actor, { replace = false } = {}) {
        this.assertAdmin(actor);
        const token = this.repo.acquirePanel(channelId, this.config.operationLeaseMs);
        try {
            await this.diagnose();
            const channel = await (await this.guild()).channels.fetch(channelId);
            if (channel?.type !== ChannelType.GuildText)
                throw new TicketError('Choose a text channel in the configured server.');
            const tracked = this.repo.panels(this.config.guildId).find(p => p.channel_id === channelId);
            let old;
            if (tracked) {
                try {
                    old = await channel.messages.fetch(tracked.message_id);
                    if (old.author.id !== this.client.user.id)
                        throw new TicketError('The tracked panel is not owned by this bot.');
                }
                catch (error) {
                    if (!missing(error))
                        throw error;
                }
            }
            if (old && !replace) {
                await old.edit(ticketPanel(this.config));
                return old;
            }
            const sent = await channel.send({ ...ticketPanel(this.config), nonce: nonce('panel:' + channelId + ':' + (replace ? Date.now() : 'initial')), enforceNonce: true });
            this.repo.savePanel(this.config.guildId, channelId, sent.id);
            if (old)
                try {
                    await old.delete();
                }
                catch (error) {
                    this.log('old_panel_cleanup_failed', error);
                }
            return sent;
        }
        finally {
            this.repo.releasePanel(channelId, token);
        }
    }
    async create(categoryKey, user, inquiry) {
        categoryFor(this.config, categoryKey);
        inquiry = inquiry.trim();
        if (inquiry.length < this.config.minInquiryLength || inquiry.length > this.config.maxInquiryLength)
            throw new TicketError('Please provide an inquiry between 10 and 1,000 characters.');
        await this.actor(user.id);
        const existing = this.repo.activeFor(this.config.guildId, user.id, categoryKey);
        if (existing)
            return existing;
        const guild = await this.guild(), category = categoryFor(this.config, categoryKey), role = await guild.roles.fetch(category.supportRoleId), parent = await guild.channels.fetch(category.categoryId), me = await guild.members.fetchMe();
        if (!role || parent?.type !== ChannelType.GuildCategory)
            throw new TicketError('This support team is unavailable. Please contact an administrator.');
        if (!role.mentionable && !parent.permissionsFor(me)?.has(PermissionFlagsBits.MentionEveryone))
            throw new TicketError('The bot cannot notify this support role. An administrator must allow Mention Everyone or make the support role mentionable.');
        const reserved = this.repo.reserve({ guildId: this.config.guildId, creatorId: user.id, creatorUsername: user.username, creatorCreatedAt: user.createdTimestamp, category: categoryKey, inquiry });
        if (!reserved.created)
            return reserved.ticket;
        const ticket = reserved.ticket;
        return this.leased(ticket.id, 'create', async (token) => {
            const category = categoryFor(this.config, categoryKey), guild = await this.guild();
            let channel;
            try {
                const options = { name: `🔴丨ticket-${ticketNumber(ticket.number)}`, type: ChannelType.GuildText, parent: category.categoryId, topic: 'nyc-ticket:' + ticket.id, permissionOverwrites: permissionOverwrites(ticket, this.client.user.id, guild.id, this.config), reason: 'Private New York City Roleplay support ticket' };
                try {
                    channel = await guild.channels.create(options);
                }
                catch (error) {
                    if (Number(error.code) !== 50035 || !error.rawError?.errors?.name)
                        throw error;
                    channel = await guild.channels.create({ ...options, name: 'unclaimed-ticket-' + ticketNumber(ticket.number) });
                }
            }
            catch (error) {
                if ([400, 403, 404].includes(error.status))
                    this.repo.update(ticket.id, { lifecycle: 'ERROR', active: false, errorCode: code(error) }, user.id, 'creation_failed', {}, token);
                throw error;
            }
            this.repo.update(ticket.id, { channelId: channel.id, lifecycle: 'OPEN', nameSyncPending: false }, user.id, 'channel_created', { channelId: channel.id }, token);
            await this.finishOpening(this.repo.get(ticket.id), channel, token);
            return this.repo.get(ticket.id);
        });
    }
    async findMessage(channel, value, since = 0) {
        let before;
        while (true) {
            const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
            if (!batch.size)
                return null;
            const found = batch.find(m => m.author.id === this.client.user.id && (typeof value === 'function' ? value(m) : contains(m, value)));
            if (found)
                return found;
            const last = batch.last();
            if (batch.size < 100 || last.createdTimestamp < since)
                return null;
            if (last.id === before)
                throw new TicketError('Discord history pagination did not advance.');
            before = last.id;
        }
    }
    async finishOpening(ticket, channel, token) {
        await this.syncCard(ticket, channel, token);
        if (!ticket.openingPingId) {
            const category = categoryFor(this.config, ticket.category), value = marker(ticket.id, 'opening', 0), content = `<@${ticket.creatorId}> <@&${category.supportRoleId}>`;
            const found = await this.findMessage(channel, m => m.content === content, ticket.createdAt - 60000);
            const sent = found ?? await channel.send({ content, allowedMentions: { parse: [], users: [ticket.creatorId], roles: [category.supportRoleId] }, nonce: nonce(value), enforceNonce: true });
            this.repo.update(ticket.id, { openingPingId: sent.id }, this.client.user.id, 'opening_notified', {}, token);
        }
    }
    async syncCard(ticket, channel, token) {
        let message;
        if (ticket.panelMessageId)
            try {
                message = await channel.messages.fetch(ticket.panelMessageId);
            }
            catch (error) {
                if (!missing(error))
                    throw error;
            }
        if (!message)
            message = await this.findMessage(channel, `nt:close:${ticket.id}`, ticket.createdAt - 60000);
        const payload = ticketCard(ticket, this.config, nextEscalation(ticket, this.config));
        const sent = message ? await message.edit(payload) : await channel.send({ ...payload, nonce: nonce('card:' + ticket.id), enforceNonce: true });
        return this.repo.update(ticket.id, { panelMessageId: sent.id, panelSyncPending: false }, this.client.user.id, null, {}, token);
    }
    async syncName(ticket, channel, token) {
        const name = `${ticket.claimantId ? '🟢' : '🔴'}丨ticket-${ticketNumber(ticket.number)}`;
        let readableFallback = false;
        if (channel.name !== name)
            try {
                await this.client.rest.patch(Routes.channel(channel.id), { body: { name }, signal: AbortSignal.timeout(this.config.renameTimeoutMs) });
            }
            catch (error) {
                if (Number(error.code) !== 50035 || !error.rawError?.errors?.name)
                    throw error;
                await this.client.rest.patch(Routes.channel(channel.id), { body: { name: (ticket.claimantId ? 'claimed' : 'unclaimed') + '-ticket-' + ticketNumber(ticket.number) }, signal: AbortSignal.timeout(this.config.renameTimeoutMs) });
                readableFallback = true;
            }
        this.repo.update(ticket.id, { nameSyncPending: false, readableFallback }, this.client.user.id, null, {}, token);
    }
    async refresh(ticket, channel, token) {
        try {
            await this.syncCard(this.repo.get(ticket.id), channel, token);
        }
        catch (error) {
            this.log('card_refresh_pending', error, ticket);
        }
        try {
            await this.syncName(this.repo.get(ticket.id), channel, token);
        }
        catch (error) {
            this.log('name_refresh_pending', error, ticket);
        }
    }
    async announce(ticket, channel, pending) {
        const value = nonce(marker(ticket.id, pending.key, pending.version));
        if (!await this.findMessage(channel, m => String(m.nonce) === value || (m.content === pending.content && BigInt(m.id) > BigInt(pending.beforeId ?? '0')), ticket.createdAt - 60000))
            await channel.send({ content: pending.content, allowedMentions: { parse: [], roles: pending.roles, users: pending.users }, nonce: value, enforceNonce: true });
    }
    async change(id, actor, action, { expectedLevel, targetId } = {}) {
        return this.leased(id, action, async (token) => {
            let ticket = this.repo.get(id);
            authorize(ticket, actor, action, this.config);
            this.assertOpen(ticket);
            const channel = await this.channel(ticket);
            if (!channel)
                throw new TicketError('Ticket channel is unavailable.');
            await this.sendPending(ticket, channel, token);
            const beforeId = (await channel.messages.fetch({ limit: 1 })).first()?.id ?? '0';
            const commit = (changes, type, content, roles = [], users = [actor.id], metadata = {}) => this.repo.update(id, old => ({ ...changes, pendingAnnouncement: { content, key: action, roles, users, version: old.version + 1, beforeId } }), actor.id, type, metadata, token);
            if (action === 'claim') {
                if (ticket.claimantId)
                    throw new TicketError(ticket.claimantId === actor.id ? 'You already claimed this ticket.' : 'Another staff member already claimed this ticket.');
                ticket = commit({ claimantId: actor.id, nameSyncPending: true, panelSyncPending: true }, 'claimed', `🟢 Claimed by <@${actor.id}>`);
            }
            else if (action === 'unclaim') {
                if (!ticket.claimantId)
                    throw new TicketError('This ticket is already unclaimed.');
                if (ticket.claimantId !== actor.id) {
                    authorize(ticket, actor, 'reassign', this.config);
                }
                ticket = commit({ claimantId: null, nameSyncPending: true, panelSyncPending: true }, 'unclaimed', `🔴 Unclaimed by <@${actor.id}>`);
            }
            else if (action === 'escalate') {
                const next = nextEscalation(ticket, this.config);
                if (ticket.category === 'department' || !next)
                    throw new TicketError('This ticket cannot be escalated further.');
                if (expectedLevel !== ticket.escalationLevel)
                    throw new TicketError('This escalation was already processed. Refresh the ticket controls.');
                await channel.permissionOverwrites.edit(next.supportRoleId, { ViewChannel: true, ReadMessageHistory: true, SendMessages: true, AttachFiles: true, EmbedLinks: true }, 'Ticket escalation');
                ticket = commit({ escalationLevel: ticket.escalationLevel + 1, escalatedRoles: [...new Set([...ticket.escalatedRoles, next.supportRoleId])], escalatedCategories: [...ticket.escalatedCategories, next.key], panelSyncPending: true }, 'escalated', `⚠️ Escalated to <@&${next.supportRoleId}> by <@${actor.id}>`, [next.supportRoleId], [actor.id], { to: next.key, roleId: next.supportRoleId });
            }
            else if (action === 'reassign') {
                const target = await this.actor(targetId);
                if (!canManage(ticket, target, this.config))
                    throw new TicketError('The selected member is not authorized to manage this ticket.');
                if (!ticket.claimantId)
                    throw new TicketError('Claim this unassigned ticket instead of reassigning it.');
                ticket = commit({ claimantId: targetId, nameSyncPending: true, panelSyncPending: true }, 'reassigned', `🔄 Reassigned to <@${targetId}>`, [], [targetId], { to: targetId });
            }
            else
                throw new TicketError('Unknown ticket action.');
            // Assignment and pending notification are committed in one SQLite transaction.
            await this.sendPending(ticket, channel, token);
            await this.refresh(this.repo.get(id), channel, token);
            return this.repo.get(id);
        });
    }
    async sendPending(ticket, channel, token) {
        if (!ticket.pendingAnnouncement)
            return;
        await this.announce(ticket, channel, ticket.pendingAnnouncement);
        this.repo.update(ticket.id, { pendingAnnouncement: null }, this.client.user.id, null, {}, token);
    }
    requestConfirmation(ticket, actor, action, payload = {}) {
        authorize(ticket, actor, action, this.config);
        this.assertOpen(ticket);
        const id = this.repo.confirmation(ticket.id, actor.id, action, payload, this.config.confirmationSeconds);
        return confirmationCard(ticket, id, action, payload.targetId);
    }
    async close(id, actor, { retry = false } = {}) {
        return this.leased(id, 'close', async (token) => {
            let ticket = this.repo.get(id);
            authorize(ticket, actor, retry ? 'retry' : 'close', this.config);
            if (ticket.lifecycle === 'CLOSED')
                return ticket;
            if (ticket.lifecycle === 'OPEN') {
                if (retry)
                    throw new TicketError('Use Close and confirm before closing an open ticket.');
                ticket = this.repo.update(id, { lifecycle: 'CLOSING', closure: { actorId: actor.id, startedAt: Date.now(), stage: 'capturing' }, panelSyncPending: true }, actor.id, 'close_confirmed', {}, token);
            }
            else if (ticket.lifecycle !== 'CLOSING' || !ticket.closure)
                throw new TicketError('There is no interrupted closure to retry.');
            try {
                return await this.finishClose(ticket, token);
            }
            catch (error) {
                this.repo.update(id, { errorCode: code(error) }, actor.id, 'close_interrupted', { code: code(error) }, token);
                this.log('close_preserved_for_retry', error, ticket);
                throw new TicketError('Closure could not finish safely. The ticket and saved transcript were preserved; an administrator can use /ticket-admin retry-close.', 'CLOSE_PRESERVED');
            }
        });
    }
    async logChannel() {
        const guild = await this.guild(), channel = await guild.channels.fetch(this.config.transcriptChannelId);
        if (channel?.type !== ChannelType.GuildText || channel.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel))
            throw new TicketError('The transcript log is missing or publicly visible.', 'TRANSCRIPT_LOG_NOT_PRIVATE');
        return channel;
    }
    async finishClose(ticket, token) {
        const heartbeat = () => this.repo.heartbeat(ticket.id, token, this.config.operationLeaseMs);
        let channel;
        try {
            channel = await this.channel(ticket);
        }
        catch (error) {
            if (!missing(error))
                throw error;
        }
        let delivery = this.repo.delivery(ticket.id);
        if (!channel && delivery.log_status !== 'sent')
            throw new TicketError('The ticket channel is missing before its transcript was logged. Metadata was retained.', 'CHANNEL_MISSING_BEFORE_LOG');
        if (channel) {
            await this.sendPending(ticket, channel, token);
            await channel.permissionOverwrites.set(permissionOverwrites(ticket, this.client.user.id, this.config.guildId, this.config, { closing: true }), 'Freeze ticket during safe transcript closure');
            await this.syncCard(ticket, channel, token);
        }
        if (!ticket.transcript) {
            if (!channel)
                throw new TicketError('No saved transcript is available.');
            const transcript = await captureTranscript(ticket, channel, this.repo, this.config, heartbeat);
            ticket = this.repo.update(ticket.id, { transcript, closure: { ...ticket.closure, stage: 'logging' } }, ticket.closure.actorId, 'transcript_captured', { messageCount: transcript.messageCount, parts: transcript.parts.length }, token);
        }
        await verifyParts(ticket.transcript.parts);
        heartbeat();
        const category = categoryFor(this.config, ticket.category), batches = [];
        for (let i = 0; i < ticket.transcript.parts.length; i += 10)
            batches.push(ticket.transcript.parts.slice(i, i + 10));
        if (delivery.log_status !== 'sent') {
            const log = await this.logChannel();
            this.repo.updateDelivery(ticket.id, { logStatus: 'sending', errorCode: null });
            for (let i = 0; i < batches.length; i++) {
                heartbeat();
                delivery = this.repo.delivery(ticket.id);
                if (delivery.logMessageIds[i])
                    continue;
                const value = marker(ticket.id, 'log', i), found = await this.findMessage(log, value, ticket.closure.startedAt - 60000);
                const sent = found ?? await log.send(addMarker(closureSummary(ticket, category, batches[i], { continuation: i !== batches.length - 1 }), value));
                const ids = [...delivery.logMessageIds];
                ids[i] = sent.id;
                this.repo.updateDelivery(ticket.id, { logMessageIds: ids, ...(i === batches.length - 1 ? { summaryId: sent.id } : {}) });
            }
            this.repo.updateDelivery(ticket.id, { logStatus: 'sent', deliveredAt: Date.now() });
        }
        delivery = this.repo.delivery(ticket.id);
        if (delivery.log_status !== 'sent' || !delivery.summary_id)
            throw new TicketError('Transcript log delivery is not confirmed.');
        if (!['sent', 'blocked', 'failed', 'uncertain'].includes(delivery.dm_status)) {
            // Mark first: an interrupted unknown DM result is never blindly sent twice.
            const interrupted = delivery.dm_status === 'sending';
            this.repo.updateDelivery(ticket.id, { dmStatus: interrupted ? 'uncertain' : 'sending', dmAttemptedAt: delivery.dm_attempted_at ?? Date.now() });
            if (!interrupted)
                try {
                    const user = await this.client.users.fetch(ticket.creatorId);
                    for (let i = 0; i < batches.length; i++) {
                        heartbeat();
                        delivery = this.repo.delivery(ticket.id);
                        if (delivery.dmMessageIds[i])
                            continue;
                        const sent = await user.send(addMarker(transcriptDm(ticket, category, batches[i], i > 0), marker(ticket.id, 'dm', i)));
                        const ids = [...delivery.dmMessageIds];
                        ids[i] = sent.id;
                        this.repo.updateDelivery(ticket.id, { dmMessageIds: ids });
                    }
                    this.repo.updateDelivery(ticket.id, { dmStatus: 'sent' });
                }
                catch (error) {
                    this.repo.updateDelivery(ticket.id, { dmStatus: Number(error.code) === 50007 ? 'blocked' : 'failed', errorCode: code(error) });
                    this.repo.event(ticket.id, 'creator_dm_unavailable', this.client.user.id, { code: code(error) });
                }
        }
        heartbeat();
        ticket = this.repo.update(ticket.id, { closure: { ...ticket.closure, stage: 'deleting' } }, ticket.closure.actorId, null, {}, token);
        if (channel)
            try {
                await channel.delete('Ticket transcript safely delivered to private logs');
            }
            catch (error) {
                if (!missing(error))
                    throw error;
            }
        return this.repo.update(ticket.id, { lifecycle: 'CLOSED', active: false, closedAt: Date.now(), errorCode: null, closure: { ...ticket.closure, stage: 'complete' } }, ticket.closure.actorId, 'closed', {}, token);
    }
    async repair(ticket, actor) {
        authorize(ticket, actor, 'repair', this.config);
        this.assertOpen(ticket);
        return this.leased(ticket.id, 'repair', async (token) => {
            const channel = await this.channel(ticket);
            await channel.permissionOverwrites.set(permissionOverwrites(ticket, this.client.user.id, this.config.guildId, this.config), 'Repair configured ticket access');
            await this.finishOpening(ticket, channel, token);
            await this.refresh(ticket, channel, token);
            this.repo.event(ticket.id, 'permissions_repaired', actor.id);
        });
    }
    async recover() {
        if (this.recovering || this.stopping)
            return;
        this.recovering = true;
        try {
            for (const ticket of this.repo.listActive(this.config.guildId)) {
                if (this.stopping)
                    break;
                if (ticket.operationToken && ticket.leaseUntil > Date.now())
                    continue;
                try {
                    await this.leased(ticket.id, 'recovery', async (token) => {
                        let current = this.repo.get(ticket.id), channel;
                        if (current.lifecycle === 'CREATING') {
                            const channels = await (await this.guild()).channels.fetch();
                            channel = channels.find(c => c?.topic === 'nyc-ticket:' + current.id);
                            if (!channel) {
                                if (Date.now() - current.createdAt > this.config.creationRecoveryGraceMs)
                                    this.repo.update(current.id, { lifecycle: 'ERROR', active: false, errorCode: 'CREATION_CHANNEL_NOT_FOUND' }, this.client.user.id, 'creation_reconciled_missing', {}, token);
                                return;
                            }
                            current = this.repo.update(current.id, { channelId: channel.id, lifecycle: 'OPEN' }, this.client.user.id, 'creation_recovered', {}, token);
                        }
                        if (current.lifecycle === 'CLOSING') {
                            await this.finishClose(current, token);
                            return;
                        }
                        if (current.lifecycle !== 'OPEN')
                            return;
                        try {
                            channel ??= await this.channel(current);
                        }
                        catch (error) {
                            if (!missing(error))
                                throw error;
                        }
                        if (!channel) {
                            this.repo.update(current.id, { lifecycle: 'ERROR', active: false, errorCode: 'CHANNEL_DELETED_EXTERNALLY' }, this.client.user.id, 'channel_missing', { historyUnavailable: true }, token);
                            return;
                        }
                        if (!current.openingPingId || !current.panelMessageId)
                            await this.finishOpening(current, channel, token);
                        await this.sendPending(this.repo.get(current.id), channel, token);
                        if (current.panelSyncPending || current.nameSyncPending)
                            await this.refresh(this.repo.get(current.id), channel, token);
                    });
                }
                catch (error) {
                    this.log('recovery_deferred', error, ticket);
                }
            }
        }
        finally {
            this.recovering = false;
        }
    }
    start() {
        if (this.timer)
            return;
        void this.recover().catch(error => this.log('recovery_failed', error));
        this.timer = setInterval(() => void this.recover().catch(error => this.log('recovery_failed', error)), this.config.recoveryIntervalMs);
        this.timer.unref();
    }
    async stop() {
        this.stopping = true;
        if (this.timer)
            clearInterval(this.timer);
        await Promise.allSettled([...this.running]);
        while (this.recovering)
            await new Promise(resolve => setTimeout(resolve, 25));
        this.repository?.close();
    }
    async respond(interaction, payload) {
        if (interaction.deferred || interaction.replied) {
            const { flags, ...rest } = payload;
            return interaction.editReply(rest);
        }
        return interaction.reply(payload);
    }
    async interaction(interaction) {
        const custom = interaction.customId ?? '', command = interaction.commandName ?? '';
        if (!custom.startsWith('nt:') && !['ticket-panel', 'ticket-admin'].includes(command) && !custom.startsWith('ls:ticket:') && !custom.startsWith('ls:ticketCreate:') && !custom.startsWith('ls:form:ticket,'))
            return false;
        const task = this.handle(interaction);
        this.running.add(task);
        try {
            await task;
        }
        finally {
            this.running.delete(task);
        }
        return true;
    }
    async handle(i) {
        try {
            if (i.guildId !== this.config.guildId)
                throw new TicketError('Use the ticket system in the configured New York City Roleplay server.');
            const custom = i.customId ?? '';
            if (custom === 'nt:select') {
                const category = categoryFor(this.config, i.values[0]);
                return await i.showModal(new ModalBuilder().setCustomId('nt:create:' + category.key).setTitle('Create a Support Ticket').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('inquiry').setLabel('Why are you opening this ticket?').setPlaceholder('Briefly explain what you need assistance with...').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(this.config.minInquiryLength).setMaxLength(this.config.maxInquiryLength))));
            }
            await i.deferReply({ flags: MessageFlags.Ephemeral });
            if (custom.startsWith('ls:ticket:') || custom.startsWith('ls:ticketCreate:') || custom.startsWith('ls:form:ticket,'))
                return await this.respond(i, ticketPanel(this.config, { ephemeral: true }));
            const actor = await this.actor(i.user.id);
            if (custom.startsWith('nt:create:')) {
                const ticket = await this.create(custom.split(':')[2], i.user, i.fields.getTextInputValue('inquiry'));
                return await this.respond(i, privateNotice(ticket.lifecycle === 'CREATING' ? 'Ticket creation in progress' : 'Your Support Ticket', ticket.channelId ? `Continue in <#${ticket.channelId}>. You may have one active ticket per category.` : 'Your ticket is being recovered safely. Please try again shortly.'));
            }
            if (i.isChatInputCommand()) {
                this.assertAdmin(actor);
                if (i.commandName === 'ticket-panel') {
                    const message = await this.publish(i.options.getChannel('channel')?.id ?? i.channelId, actor, { replace: i.options.getBoolean('replace') ?? false });
                    return await this.respond(i, privateNotice('Support panel ready', `[Open the panel](${message.url})`));
                }
                const sub = i.options.getSubcommand();
                if (sub === 'diagnose')
                    return await this.respond(i, privateNotice('Ticket diagnostics', (await this.diagnose()).join('\n')));
                if (sub === 'refresh-panel') {
                    const message = await this.publish(i.channelId, actor);
                    return await this.respond(i, privateNotice('Panel refreshed', `[Open the panel](${message.url})`));
                }
                const ticket = this.repo.byNumber(this.config.guildId, i.options.getInteger('number', true));
                if (!ticket)
                    throw new TicketError('Ticket number not found.');
                if (sub === 'details') {
                    const delivery = this.repo.delivery(ticket.id), events = this.repo.events(ticket.id).slice(-10);
                    return await this.respond(i, privateNotice('Ticket #' + ticketNumber(ticket.number), `**Status:** ${ticket.lifecycle}\n**Category:** ${categoryFor(this.config, ticket.category).name}\n**Creator:** <@${ticket.creatorId}>\n**Claimant:** ${ticket.claimantId ? '<@' + ticket.claimantId + '>' : 'None'}\n**Escalation level:** ${ticket.escalationLevel}\n**Transcript log:** ${delivery.log_status}\n**Creator DM:** ${delivery.dm_status}\n**Last error:** ${ticket.errorCode ?? 'None'}\n\n**Recent audit events** (complete history is stored)\n${events.map(e => `<t:${Math.floor(e.at / 1000)}:f> ${e.type}`).join('\n')}`));
                }
                if (sub === 'reassign')
                    return await this.respond(i, this.requestConfirmation(ticket, actor, 'reassign', { targetId: i.options.getUser('member', true).id }));
                if (sub === 'repair') {
                    await this.repair(ticket, actor);
                    return await this.respond(i, privateNotice('Ticket repaired', 'Configured access and controls have been restored.'));
                }
                if (sub === 'retry-close') {
                    await this.close(ticket.id, actor, { retry: true });
                    return await this.respond(i, privateNotice('Ticket closed', 'The transcript was logged before channel deletion.'));
                }
            }
            const [, action, id, level] = custom.split(':');
            if (['confirm', 'cancel'].includes(action)) {
                const confirmation = this.repo.peekConfirmation(id, actor.id), ticket = this.repo.get(confirmation.ticket_id);
                authorize(ticket, actor, confirmation.action, this.config);
                this.repo.consumeConfirmation(id, actor.id);
                if (action === 'cancel')
                    return await this.respond(i, privateNotice('Cancelled', 'No changes were made.'));
                if (confirmation.action === 'close') {
                    await this.close(ticket.id, actor);
                    return await this.respond(i, privateNotice('Ticket closed', 'Your conversation was preserved in the private transcript log.'));
                }
                await this.change(ticket.id, actor, 'reassign', confirmation.payload);
                return await this.respond(i, privateNotice('Ticket reassigned', 'The assignment and ticket controls have been updated.'));
            }
            const ticket = this.repo.get(id);
            if (!ticket || ticket.channelId !== i.channelId)
                throw new TicketError('These ticket controls do not belong to this channel.');
            if (action === 'close')
                return await this.respond(i, this.requestConfirmation(ticket, actor, 'close'));
            await this.change(id, actor, action, { expectedLevel: Number(level) });
            await this.respond(i, privateNotice('Ticket updated', 'The ticket status and controls have been updated.'));
        }
        catch (error) {
            this.log('interaction_failed', error);
            const description = error instanceof TicketError ? error.message : 'Discord could not complete this action. The ticket state is preserved. Please retry or contact an administrator.';
            try {
                await this.respond(i, privateNotice('Ticket needs attention', description));
            }
            catch (replyError) {
                this.log('interaction_reply_failed', replyError);
            }
        }
    }
}
