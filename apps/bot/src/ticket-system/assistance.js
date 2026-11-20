import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { ChannelType, PermissionFlagsBits, Routes, ButtonBuilder, ButtonStyle, MessageFlags, escapeMarkdown } from 'discord.js';
import { TicketSystem } from './service.js';
import { TicketError } from './database.js';
import { ticketConfig } from '../../../../config/tickets.js';
import { actorFromMember } from './permissions.js';
import { captureTranscript, verifyParts } from './transcripts.js';
import { DENIED, assistancePanel, notice, selectionPanel, inquiryForms, inquiryModal, modal, openingPanel, openedPanel, staffControl, transcriptLog, closureDm, controlButton } from './assistance-views.js';
const missing = error => [10003, 10008].includes(Number(error?.code));
const digest = value => createHash('sha256').update(value).digest('hex').slice(0, 24);
const loggedEvents = new Set(['channel_created', 'claimed', 'unclaimed', 'reassigned', 'escalated', 'member_added', 'member_removed', 'priority_changed', 'closed', 'transcript_captured', 'rating_submitted', 'configuration_changed', 'renamed', 'locked', 'unlocked', 'response_requested', 'permissions_repaired', 'confidential_report_blocked', 'legacy_channel_missing']);
export const channelUsername = value => String(value ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'member';
export class AssistanceSystem extends TicketSystem {
    constructor(client, config = ticketConfig, repository = null, dependencies = {}) {
        const copy = structuredClone(config);
        copy.categories = [...copy.categories, ...(copy.legacyCategories ?? []).map(c => ({ ...c, legacy: true, viewerRoleIds: [], escalateTo: 'escalated' }))];
        super(client, copy, repository);
        this.clock = dependencies.clock ?? Date.now;
        this.schedule = dependencies.schedule ?? setTimeout;
        this.lookupRoblox = dependencies.lookupRoblox ?? (async () => null);
        this.legacyTickets = dependencies.legacyTickets ?? (() => []);
        this.timers = new Set();
        this.logging = false;
    }
    get repo() {
        const repository = super.repo;
        if (!repository.assistanceMigrated) {
            repository.db.exec(`
            CREATE TABLE IF NOT EXISTS assistance_selections(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,guild_id TEXT NOT NULL,created_at INTEGER NOT NULL,ready_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS assistance_ratings(ticket_id TEXT PRIMARY KEY REFERENCES tickets(id),creator_id TEXT NOT NULL,staff_id TEXT,category TEXT NOT NULL,score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),feedback TEXT NOT NULL,created_at INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS assistance_settings(key TEXT PRIMARY KEY,data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS assistance_event_deliveries(event_id INTEGER PRIMARY KEY,message_id TEXT NOT NULL);
            INSERT OR IGNORE INTO assistance_settings(key,data) VALUES('audit_start',CAST((SELECT COALESCE(MAX(id),0) FROM ticket_events) AS TEXT));
            INSERT OR IGNORE INTO ticket_migrations VALUES(2,CAST(strftime('%s','now') AS INTEGER)*1000);
            CREATE INDEX IF NOT EXISTS tickets_active_member ON tickets(guild_id,creator_id,active);
        `);
            repository.assistanceMigrated = true;
            for (const setting of repository.db.prepare("SELECT key,data FROM assistance_settings WHERE key LIKE 'route:%'").all()) {
                const category = this.config.categories.find(c => c.key === setting.key.slice(6));
                if (category)
                    Object.assign(category, JSON.parse(setting.data));
            }
        }
        return repository;
    }
    category(ticketOrKey) {
        const key = typeof ticketOrKey === 'string' ? ticketOrKey : ticketOrKey.category;
        const category = this.config.categories.find(c => c.key === key);
        if (!category)
            throw new TicketError('Ticket category is unavailable.');
        return category;
    }
    canManage(ticket, actor) {
        return Boolean(actor.administrator || actor.roles.includes(this.category(ticket).supportRoleId)) && actor.id !== ticket.reportedUserId;
    }
    requireManage(ticket, actor) {
        if (!ticket || ticket.guildId !== this.config.guildId || !this.canManage(ticket, actor))
            throw new TicketError(DENIED, 'TICKET_FORBIDDEN');
    }
    requireAdmin(actor) {
        if (!actor.administrator)
            throw new TicketError(DENIED, 'TICKET_FORBIDDEN');
    }
    assertOpen(ticket) {
        super.assertOpen(ticket);
        if (ticket.pendingEscalation)
            throw new TicketError('An escalation is being recovered. Please wait or ask an administrator to repair the ticket.');
    }
    transcriptUrl(ticket) {
        const origin = new URL(process.env.WEB_BASE_URL ?? 'http://localhost:3000');
        return origin.origin + '/tickets/transcripts/' + ticket.id;
    }
    async loadEmojis(guild) {
        let emojis;
        try {
            emojis = await guild.emojis.fetch();
        }
        catch {
            this.config.resolvedEmojis = {};
            return ['Custom emoji lookup unavailable; using text fallback'];
        }
        this.config.resolvedEmojis = {};
        const warnings = [];
        for (const [key, id] of Object.entries(this.config.emojiIds)) {
            const emoji = emojis.get(id);
            if (emoji?.name)
                this.config.resolvedEmojis[key] = { id: emoji.id, name: emoji.name, animated: emoji.animated ?? false };
            else
                warnings.push(key + ': custom emoji unavailable; using text fallback');
        }
        return warnings;
    }
    async logChannel() {
        const guild = await this.guild(), channel = await guild.channels.fetch(this.config.transcriptChannelId), me = await guild.members.fetchMe();
        if (channel?.type !== ChannelType.GuildText || channel.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel) || !channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]))
            throw new TicketError('The assistance log must be private and accessible to the bot. No confidential information was posted.', 'ASSISTANCE_LOG_UNSAFE');
        for (const overwrite of channel.permissionOverwrites.cache.values()) {
            if (!overwrite.allow.has(PermissionFlagsBits.ViewChannel) || overwrite.id === this.client.user.id)
                continue;
            const principal = overwrite.type === 0 ? await guild.roles.fetch(overwrite.id) : await guild.members.fetch({ user: overwrite.id, force: true });
            if (!principal?.permissions.has(PermissionFlagsBits.Administrator))
                throw new TicketError('The assistance log grants access to a non-administrator. Confidential logging is blocked.', 'ASSISTANCE_LOG_UNSAFE');
        }
        return channel;
    }
    async diagnose() {
        const guild = await this.guild(), me = await guild.members.fetchMe(), warnings = await this.loadEmojis(guild);
        this.repo;
        for (const file of [this.config.assistanceBanner, this.config.footerBanner, this.config.logo])
            await fs.access(file);
        const results = [];
        for (const category of this.config.categories.filter(c => !c.legacy)) {
            const parent = await guild.channels.fetch(category.categoryId), role = await guild.roles.fetch(category.supportRoleId);
            if (parent?.type !== ChannelType.GuildCategory || !role || role.id === guild.id)
                throw new TicketError(category.name + ': category or support role is unavailable.');
            if (!parent.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageMessages]))
                throw new TicketError(category.name + ': bot needs View Channel, Manage Channels, Manage Roles and Manage Messages.');
            results.push(category.name + ': category and support role verified');
        }
        await this.logChannel();
        return [...results, 'Administrator-only shared logs/transcripts verified', ...warnings];
    }
    overwrites(ticket, { closing = false } = {}) {
        const read = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], write = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks], locked = closing || ticket.locked;
        const overrides = [{ id: this.config.guildId, type: 0, deny: [...read, ...write, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads] }, { id: this.client.user.id, type: 1, allow: [...read, ...write, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageMessages] }, { id: this.category(ticket).supportRoleId, type: 0, allow: [...read, ...(closing ? [] : write)], deny: closing ? write : [] }, { id: ticket.creatorId, type: 1, allow: [...read, ...(locked ? [] : write)], deny: locked ? write : [] }];
        for (const id of ticket.addedMembers ?? [])
            if (![ticket.creatorId, this.client.user.id, ticket.reportedUserId].includes(id))
                overrides.push({ id, type: 1, allow: [...read, ...(locked ? [] : write)], deny: locked ? write : [] });
        if (ticket.reportedUserId)
            overrides.push({ id: ticket.reportedUserId, type: 1, deny: [...read, ...write] });
        return overrides;
    }
    closeOverwrites(ticket) {
        return this.overwrites(ticket, { closing: true });
    }
    closureLogPayload(ticket, category) {
        return transcriptLog(this.config, ticket, category, this.transcriptUrl(ticket));
    }
    closureDmPayload(ticket, category) {
        return closureDm(this.config, ticket, category);
    }
    async publish(channelId, actor, { replace = false } = {}) {
        this.requireAdmin(actor);
        const token = this.repo.acquirePanel(channelId, this.config.operationLeaseMs);
        try {
            await this.diagnose();
            const channel = await (await this.guild()).channels.fetch(channelId);
            if (channel?.type !== ChannelType.GuildText)
                throw new TicketError('Choose a text channel in the main server.');
            const record = this.repo.panels(this.config.guildId).find(p => p.channel_id === channelId);
            let existing;
            if (record)
                try {
                    existing = await channel.messages.fetch(record.message_id);
                }
                catch (error) {
                    if (!missing(error))
                        throw error;
                }
            if (existing?.author.id !== this.client.user.id && existing)
                throw new TicketError('Tracked panel is not owned by this bot.');
            if (existing && !replace) {
                await existing.edit(assistancePanel(this.config));
                return existing;
            }
            const sent = await channel.send({ ...assistancePanel(this.config), nonce: digest('assistance-panel:' + channelId + ':' + (replace ? Date.now() : 'initial')), enforceNonce: true });
            this.repo.savePanel(this.config.guildId, channelId, sent.id);
            if (existing)
                await existing.delete();
            return sent;
        }
        finally {
            this.repo.releasePanel(channelId, token);
        }
    }
    beginSelection(userId) {
        this.repo.db.prepare('DELETE FROM assistance_selections WHERE expires_at<?').run(this.clock());
        const selection = { id: randomUUID(), userId, guildId: this.config.guildId, createdAt: this.clock(), readyAt: this.clock() + this.config.inquiryDelayMs, expiresAt: this.clock() + this.config.selectionLifetimeMs };
        this.repo.db.prepare('INSERT INTO assistance_selections VALUES(?,?,?,?,?,?)').run(selection.id, userId, selection.guildId, selection.createdAt, selection.readyAt, selection.expiresAt);
        return selection;
    }
    selection(id, userId, key) {
        const row = this.repo.db.prepare('SELECT * FROM assistance_selections WHERE id=? AND user_id=? AND expires_at>=?').get(id, userId, this.clock());
        if (!row || row.guild_id !== this.config.guildId)
            throw new TicketError('This private selection expired or belongs to another member.');
        if (!inquiryForms[key])
            throw new TicketError('Choose one of the listed inquiries.');
        if (key === 'general' && this.clock() < row.ready_at)
            throw new TicketError("Inquiry Isn't Listed becomes available after 10 seconds.");
        return row;
    }
    activeMessage(userId) {
        const ticket = this.repo.activeForMember(this.config.guildId, userId);
        if (ticket)
            return `You already have an open assistance ticket: ${ticket.channelId ? '<#' + ticket.channelId + '>' : 'creation in progress'}.`;
        const legacy = this.legacyTickets().find(t => t.user === userId && !['closed', 'resolved'].includes(t.status) && !this.repo.byChannel(t.channel));
        return legacy ? `You already have an open assistance ticket: <#${legacy.channel}>.` : null;
    }
    async resolveReported(value, userId) {
        const guild = await this.guild(), id = /^(?:<@!?)?(\d{17,20})>?$/.exec(value.trim())?.[1];
        let member;
        if (id)
            member = await guild.members.fetch({ user: id, force: true }).catch(error => {
                if (Number(error.code) === 10007)
                    return null;
                throw error;
            });
        else {
            const matches = await guild.members.fetch({ query: value.trim(), limit: 10 });
            const exact = [...matches.values()].filter(m => [m.user.username, m.displayName].some(name => name.toLowerCase() === value.trim().toLowerCase()));
            if (exact.length !== 1)
                throw new TicketError('Identify the reported staff member with their Discord mention or user ID.');
            member = exact[0];
        }
        const reportedUserId = member?.id ?? id;
        if (!reportedUserId || [userId, this.client.user.id].includes(reportedUserId))
            throw new TicketError('Provide the Discord ID of the staff member being reported.');
        if (member?.permissions.has(PermissionFlagsBits.Administrator) || member?.id === guild.ownerId) {
            const record = this.repo.reserve({ guildId: this.config.guildId, creatorId: userId, category: 'staff_report', inquiry: 'Administrator report blocked before storing confidential answers', singleActive: true });
            if (record.created) {
                this.repo.update(record.ticket.id, { lifecycle: 'ERROR', active: false }, userId, 'confidential_report_blocked', { reportedUserId });
            }
            await this.flushLogs();
            throw new TicketError('Discord administrators cannot be excluded from guild channels. Please contact the server owner privately; confidential answers were not posted.');
        }
        return reportedUserId;
    }
    validateAnswers(key, answers) {
        const form = inquiryForms[key];
        if (!form)
            throw new TicketError('Choose one of the listed inquiries.');
        const clean = {};
        for (const field of form.fields) {
            const value = String(answers[field.id] ?? '').trim();
            if ((field.required && value.length < (field.min ?? 1)) || value.length > field.max)
                throw new TicketError('Please complete ' + field.label + ' within the specified length.');
            clean[field.id] = value;
        }
        return clean;
    }
    async create(key, user, answers) {
        const existing = this.repo.activeForMember(this.config.guildId, user.id);
        if (existing)
            return existing;
        const values = this.validateAnswers(key, typeof answers === 'string' ? { reason: answers } : answers);
        await this.actor(user.id);
        const category = this.category(key);
        if (category.legacy || key === 'escalated')
            throw new TicketError('Choose a support inquiry from the Assistance panel.');
        await this.logChannel();
        const guild = await this.guild(), parent = await guild.channels.fetch(category.categoryId), role = await guild.roles.fetch(category.supportRoleId), me = await guild.members.fetchMe();
        if (parent?.type !== ChannelType.GuildCategory || !role)
            throw new TicketError('Support routing is unavailable.');
        if (!role.mentionable && !parent.permissionsFor(me)?.has(PermissionFlagsBits.MentionEveryone))
            throw new TicketError('The bot cannot notify this support team. An administrator must configure mention permissions.');
        const reportedUserId = key === 'staff_report' ? await this.resolveReported(values.reported, user.id) : null;
        let roblox = null;
        try {
            roblox = await this.lookupRoblox(user.id);
        }
        catch (error) {
            this.log('roblox_lookup_unavailable', error);
        }
        const inquiry = inquiryForms[key].fields.map(field => field.label + '\n' + (values[field.id] || 'Not supplied')).join('\n\n');
        const summary = key === 'staff_report' ? values.incident : key === 'purchase' ? values.product : values.reason;
        const reserved = this.repo.reserve({ guildId: this.config.guildId, creatorId: user.id, creatorUsername: user.username, creatorCreatedAt: user.createdTimestamp, category: key, originalCategory: key, inquiry, summary, answers: values, reportedUserId, roblox, addedMembers: [], locked: false, priority: 'normal', singleActive: true, assistanceVersion: 2 });
        if (!reserved.created)
            return reserved.ticket;
        return this.leased(reserved.ticket.id, 'create', async (token) => {
            const ticket = reserved.ticket;
            let channel;
            try {
                channel = await guild.channels.create({ name: this.channelName(ticket), type: ChannelType.GuildText, parent: category.categoryId, topic: 'nyc-ticket:' + ticket.id, permissionOverwrites: this.overwrites(ticket), reason: 'NYCRP private assistance ticket' });
            }
            catch (error) {
                if ([400, 403, 404].includes(error.status))
                    this.repo.update(ticket.id, { lifecycle: 'ERROR', active: false, errorCode: String(error.code) }, user.id, 'creation_failed', {}, token);
                throw error;
            }
            this.repo.update(ticket.id, { channelId: channel.id, lifecycle: 'OPEN', nameSyncPending: false, panelSyncPending: true }, user.id, 'channel_created', { category: key }, token);
            await this.finishOpening(this.repo.get(ticket.id), channel, token);
            return this.repo.get(ticket.id);
        });
    }
    channelName(ticket) {
        const circle = ticket.category === 'escalated' ? '🔵' : ticket.awaitingResponse ? '🟡' : ticket.claimantId ? '🟢' : '🔴';
        return circle + '-' + channelUsername(ticket.customName ?? ticket.creatorUsername);
    }
    async syncName(ticket, channel, token) {
        const name = this.channelName(ticket);
        if (channel.name !== name)
            await this.client.rest.patch(Routes.channel(channel.id), { body: { name }, signal: AbortSignal.timeout(this.config.renameTimeoutMs) });
        this.repo.update(ticket.id, { nameSyncPending: false }, this.client.user.id, null, {}, token);
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
            message = await this.findMessage(channel, m => JSON.stringify(m.components?.map(c => c.toJSON?.() ?? c) ?? []).includes('na:close:' + ticket.id) || JSON.stringify(m.components?.map(c => c.toJSON?.() ?? c) ?? []).includes('nt:close:' + ticket.id), ticket.createdAt - 60000);
        const payload = openingPanel(this.config, ticket, this.category(ticket));
        const sent = message ? await message.edit(payload) : await channel.send({ ...payload, nonce: digest('assistance-card:' + ticket.id), enforceNonce: true });
        if (!sent.pinned && sent.pin)
            await sent.pin('NYCRP persistent support controls');
        return this.repo.update(ticket.id, { panelMessageId: sent.id, panelSyncPending: false }, this.client.user.id, null, {}, token);
    }
    async finishOpening(ticket, channel, token) {
        await channel.permissionOverwrites.set(this.overwrites(ticket), 'NYCRP current assistance permissions');
        await this.syncCard(ticket, channel, token);
        if (!ticket.openingPingId) {
            const roleId = this.category(ticket).supportRoleId, content = `<@${ticket.creatorId}> <@&${roleId}>`, found = await this.findMessage(channel, m => m.content === content, ticket.createdAt - 60000);
            const sent = found ?? await channel.send({ content, allowedMentions: { parse: [], users: [ticket.creatorId], roles: [roleId] }, nonce: digest('assistance-opening:' + ticket.id), enforceNonce: true });
            this.repo.update(ticket.id, { openingPingId: sent.id }, this.client.user.id, 'opening_notified', {}, token);
        }
    }
    async close(id, actor, options = {}) {
        const ticket = this.repo.get(id);
        this.requireManage(ticket, actor);
        if (actor.id === ticket.creatorId)
            throw new TicketError(DENIED);
        if (ticket.pendingEscalation)
            throw new TicketError('Wait for escalation recovery before closing this ticket.');
        if (ticket.lifecycle === 'OPEN' && !String(options.reason ?? '').trim())
            throw new TicketError('A closing reason is required.');
        await this.logChannel();
        return super.close(id, actor, { ...options, staffCommand: true });
    }
    async repair(ticket, actor) {
        this.requireAdmin(actor);
        return this.leased(ticket.id, 'repair', async (token) => {
            const current = this.repo.get(ticket.id);
            this.assertOpen(current);
            const channel = await this.channel(current);
            await channel.permissionOverwrites.set(this.overwrites(current), 'Repair NYCRP assistance permissions');
            await this.finishOpening(current, channel, token);
            await this.refresh(this.repo.get(current.id), channel, token);
            this.repo.event(current.id, 'permissions_repaired', actor.id);
        });
    }
    async completeEscalation(ticket, channel, token) {
        const pending = ticket.pendingEscalation;
        if (!pending)
            return ticket;
        const next = { ...ticket, ...pending.changes };
        await channel.edit({ parent: pending.categoryId, lockPermissions: false, permissionOverwrites: this.overwrites(next) }, 'Escalate assistance ticket');
        const beforeId = (await channel.messages.fetch({ limit: 1 })).first()?.id ?? '0';
        const updated = this.repo.update(ticket.id, old => ({ ...pending.changes, pendingEscalation: null, nameSyncPending: true, panelSyncPending: true, pendingAnnouncement: { content: `<@${pending.actorId}> has escalated this ticket.`, key: 'escalated', roles: [this.category('escalated').supportRoleId], users: [pending.actorId], version: old.version + 1, beforeId } }), pending.actorId, 'escalated', { reason: pending.reason }, token);
        await this.sendPending(updated, channel, token);
        await this.refresh(this.repo.get(ticket.id), channel, token);
        return this.repo.get(ticket.id);
    }
    async change(id, actor, action, { targetId, reason, value } = {}) {
        return this.leased(id, action, async (token) => {
            let ticket = this.repo.get(id);
            this.requireManage(ticket, actor);
            this.assertOpen(ticket);
            const channel = await this.channel(ticket);
            let changes = {}, event = action, content = null, roles = [], users = [];
            if (action === 'claim') {
                if (ticket.claimantId)
                    throw new TicketError('This ticket is already claimed.');
                changes = { claimantId: actor.id };
                event = 'claimed';
                content = `<@${actor.id}> has claimed this ticket.`;
                users = [actor.id];
            }
            else if (action === 'unclaim') {
                if (!ticket.claimantId)
                    throw new TicketError('This ticket is not claimed.');
                if (ticket.claimantId !== actor.id && !actor.administrator && !this.config.supervisorRoleIds.some(id => actor.roles.includes(id)))
                    throw new TicketError(DENIED);
                changes = { claimantId: null };
                event = 'unclaimed';
                content = `<@${actor.id}> has unclaimed this ticket.`;
                users = [actor.id];
            }
            else if (action === 'transfer') {
                if (!ticket.claimantId)
                    throw new TicketError('Claim the ticket before transferring it.');
                const target = await this.actor(targetId);
                if (!this.canManage(ticket, target))
                    throw new TicketError('Choose an eligible support handler for this category.');
                changes = { claimantId: targetId };
                event = 'reassigned';
                content = `Ticket transferred to <@${targetId}> by <@${actor.id}>.`;
                users = [targetId];
            }
            else if (action === 'escalate') {
                if (ticket.category === 'escalated')
                    throw new TicketError('This ticket is already escalated.');
                if (!reason?.trim())
                    throw new TicketError('An escalation reason is required.');
                const destination = this.category('escalated');
                const changes = { category: 'escalated', originalCategory: ticket.originalCategory ?? ticket.category, claimantId: null, addedMembers: [], awaitingResponse: false, escalationLevel: ticket.escalationLevel + 1, escalatedRoles: [destination.supportRoleId], escalatedCategories: ['escalated'], escalationReason: reason };
                ticket = this.repo.update(id, { pendingEscalation: { changes, categoryId: destination.categoryId, actorId: actor.id, reason } }, actor.id, 'escalation_started', {}, token);
                return this.completeEscalation(ticket, channel, token);
            }
            else if (action === 'add' || action === 'remove') {
                if (this.category(ticket).confidential)
                    this.requireAdmin(actor);
                if (!/^\d{17,20}$/.test(targetId ?? ''))
                    throw new TicketError('Provide a Discord user ID or mention.');
                if ([ticket.creatorId, this.client.user.id, ticket.reportedUserId].includes(targetId))
                    throw new TicketError('This member cannot be added or removed.');
                const added = new Set(ticket.addedMembers ?? []);
                if (action === 'add') {
                    await this.actor(targetId);
                    if (added.has(targetId))
                        throw new TicketError('Member is already added.');
                    added.add(targetId);
                }
                else {
                    if (!added.delete(targetId))
                        throw new TicketError('That member was not added to this ticket.');
                }
                changes = { addedMembers: [...added] };
                await channel.permissionOverwrites.set(this.overwrites({ ...ticket, ...changes }), 'Update assistance participant');
                event = action === 'add' ? 'member_added' : 'member_removed';
            }
            else if (action === 'priority') {
                if (!['low', 'normal', 'high', 'urgent'].includes(value))
                    throw new TicketError('Choose low, normal, high or urgent.');
                changes = { priority: value };
                event = 'priority_changed';
            }
            else if (action === 'rename') {
                const name = channelUsername(value);
                if (!value?.trim())
                    throw new TicketError('Provide a channel name.');
                changes = { customName: name };
                event = 'renamed';
            }
            else if (action === 'lock' || action === 'unlock') {
                changes = { locked: action === 'lock' };
                await channel.permissionOverwrites.set(this.overwrites({ ...ticket, ...changes }), 'Update assistance lock');
                event = action === 'lock' ? 'locked' : 'unlocked';
            }
            else if (action === 'respond') {
                if (ticket.lastResponseRequestAt && this.clock() - ticket.lastResponseRequestAt < 60000)
                    throw new TicketError('Please wait before requesting another response.');
                changes = { awaitingResponse: true, lastResponseRequestAt: this.clock(), locked: false };
                await channel.permissionOverwrites.set(this.overwrites({ ...ticket, ...changes }), 'Allow creator response');
                event = 'response_requested';
                content = `<@${ticket.creatorId}>, your assistance team is waiting for your response.${reason ? '\n' + escapeMarkdown(reason) : ''}`;
                users = [ticket.creatorId];
            }
            else
                throw new TicketError('Unknown staff action.');
            await this.sendPending(ticket, channel, token);
            const beforeId = (await channel.messages.fetch({ limit: 1 })).first()?.id ?? '0';
            ticket = this.repo.update(id, old => ({ ...changes, nameSyncPending: true, panelSyncPending: true, ...(content ? { pendingAnnouncement: { content, key: event, roles, users, version: old.version + 1, beforeId } } : {}) }), actor.id, event, { targetId: targetId ?? null, reason: reason ?? null, value: value ?? null }, token);
            await this.sendPending(ticket, channel, token);
            await this.refresh(this.repo.get(id), channel, token);
            return this.repo.get(id);
        });
    }
    async generateTranscript(ticket, actor) {
        this.requireAdmin(actor);
        return this.leased(ticket.id, 'transcript', async (token) => {
            const current = this.repo.get(ticket.id);
            if (current.transcript) {
                await verifyParts(current.transcript.parts);
                return current;
            }
            this.assertOpen(current);
            const channel = await this.channel(current), snapshot = { ...current, isPreview: true, closure: { actorId: actor.id, startedAt: this.clock(), reason: 'Administrator-requested transcript snapshot' } };
            const preview = await captureTranscript(snapshot, channel, this.repo, { ...this.config, transcriptDirectory: path.join(this.config.transcriptDirectory, 'previews', randomUUID()) }, () => this.repo.heartbeat(current.id, token, this.config.operationLeaseMs));
            return this.repo.update(current.id, { previewTranscript: preview }, actor.id, 'transcript_captured', { preview: true, messageCount: preview.messageCount }, token);
        });
    }
    async rate(id, userId, score, feedback = '') {
        if (!this.config.supportRatings)
            throw new TicketError('Support ratings are currently disabled.');
        const ticket = this.repo.get(id);
        if (!ticket || ticket.creatorId !== userId)
            throw new TicketError(DENIED);
        if (ticket.lifecycle !== 'CLOSED')
            throw new TicketError('Ratings are available after the ticket has finished closing.');
        if (!Number.isInteger(score) || score < 1 || score > 5 || feedback.length > 1000)
            throw new TicketError('Choose a rating from 1 to 5 and keep feedback under 1,000 characters.');
        this.repo.transaction(() => {
            if (this.repo.db.prepare('SELECT 1 FROM assistance_ratings WHERE ticket_id=?').get(id))
                throw new TicketError('You already rated this ticket.');
            this.repo.db.prepare('INSERT INTO assistance_ratings VALUES(?,?,?,?,?,?,?)').run(id, userId, ticket.claimantId ?? null, ticket.category, score, feedback.trim(), this.clock());
            this.repo.event(id, 'rating_submitted', userId, { score, feedback: feedback.trim(), staffId: ticket.claimantId ?? null });
        });
        await this.flushLogs();
    }
    async flushConfigurationLogs() {
        for (const setting of this.repo.db.prepare("SELECT key,data FROM assistance_settings WHERE key LIKE 'config_audit:%'").all()) {
            const entry = JSON.parse(setting.data);
            if (entry.messageId)
                continue;
            const channel = await this.logChannel(), marker = 'NYC-ASSISTANCE-CONFIG:' + setting.key.slice(13), existing = await this.findMessage(channel, marker, entry.createdAt - 60000);
            const message = existing ?? await channel.send({ ...notice(this.config, 'Assistance Configuration Changed', `**Administrator:** <@${entry.actorId}>\n**Type:** ${this.category(entry.category).name}\n**Category:** ${entry.categoryId}\n**Support Role:** <@&${entry.supportRoleId}>\n-# ${marker}`, [], false), nonce: digest(marker), enforceNonce: true });
            this.repo.db.prepare('UPDATE assistance_settings SET data=? WHERE key=?').run(JSON.stringify({ ...entry, messageId: message.id }), setting.key);
        }
    }
    saveRouting(key, values, actor) {
        this.repo.transaction(() => {
            this.repo.db.prepare('INSERT INTO assistance_settings VALUES(?,?)').run('config_audit:' + randomUUID(), JSON.stringify({ actorId: actor.id, createdAt: this.clock(), category: key, ...values, messageId: null }));
            this.repo.db.prepare('INSERT INTO assistance_settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').run('route:' + key, JSON.stringify(values));
        });
    }
    async flushLogs() {
        if (this.logging || this.stopping)
            return;
        this.logging = true;
        try {
            const start = Number(this.repo.db.prepare("SELECT data FROM assistance_settings WHERE key='audit_start'").get().data);
            const events = this.repo.db.prepare('SELECT e.* FROM ticket_events e LEFT JOIN assistance_event_deliveries d ON d.event_id=e.id WHERE e.id>? AND d.event_id IS NULL ORDER BY e.id LIMIT 100').all(start);
            let channel;
            for (const event of events) {
                if (!loggedEvents.has(event.type)) {
                    this.repo.db.prepare('INSERT OR IGNORE INTO assistance_event_deliveries VALUES(?,?)').run(event.id, 'not-applicable');
                    continue;
                }
                channel = await this.logChannel();
                const ticket = this.repo.get(event.ticket_id);
                if (!ticket || ticket.guildId !== this.config.guildId)
                    continue;
                const marker = 'NYC-ASSISTANCE-EVENT:' + event.id;
                const found = await this.findMessage(channel, marker, event.created_at - 60000);
                const details = JSON.parse(event.data);
                const content = `**Ticket:** #${String(ticket.number).padStart(4, '0')} · ${this.category(ticket).name}\n**Actor:** <@${event.actor_id}>\n**Event:** ${event.type.replaceAll('_', ' ')}\n${Object.entries(details).filter(([, v]) => v !== null).map(([k, v]) => '**' + escapeMarkdown(k) + ':** ' + escapeMarkdown(typeof v === 'string' ? v : JSON.stringify(v))).join('\n')}\n-# ${marker}`;
                const message = found ?? await channel.send({ ...notice(this.config, 'Assistance Log', content, [], false), nonce: digest(marker), enforceNonce: true });
                this.repo.db.prepare('INSERT OR IGNORE INTO assistance_event_deliveries VALUES(?,?)').run(event.id, message.id);
            }
            await this.flushConfigurationLogs();
        }
        catch (error) {
            this.log('private_audit_log_deferred', error);
        }
        finally {
            this.logging = false;
        }
    }
    async importLegacyTickets() {
        for (const legacy of this.legacyTickets().filter(t => !['closed', 'resolved'].includes(t.status))) {
            if (this.repo.byChannel(legacy.channel))
                continue;
            const imported = this.repo.db.prepare('SELECT data FROM tickets WHERE guild_id=?').all(this.config.guildId).some(row => JSON.parse(row.data).legacyTicketId === legacy.id);
            if (imported)
                continue;
            const channel = await (await this.guild()).channels.fetch(legacy.channel).catch(error => {
                if (missing(error))
                    return null;
                throw error;
            });
            if (!channel) {
                const archived = this.repo.reserve({ guildId: this.config.guildId, creatorId: legacy.user, category: 'general', inquiry: legacy.request ?? 'Legacy assistance request', channelId: legacy.channel, legacyTicketId: legacy.id, initialLifecycle: 'ERROR', initialActive: false, historyUnavailable: true });
                if (archived.created)
                    this.repo.event(archived.ticket.id, 'legacy_channel_missing', this.client.user.id, { legacyTicketId: legacy.id });
                continue;
            }
            const category = legacy.category === 2 ? 'staff_report' : legacy.category === 3 ? 'appeal' : 'general';
            let member;
            try {
                member = await (await this.guild()).members.fetch({ user: legacy.user, force: true });
            }
            catch {
            }
            const reserved = this.repo.reserve({ guildId: this.config.guildId, creatorId: legacy.user, channelId: legacy.channel, initialLifecycle: 'OPEN', createdAt: legacy.created, creatorUsername: member?.user.username ?? 'member-' + legacy.user.slice(-6), creatorCreatedAt: member?.user.createdTimestamp ?? null, category, originalCategory: category, inquiry: legacy.request ?? 'Legacy support request', summary: String(legacy.request ?? 'Legacy support request').slice(0, 1000), reportedUserId: legacy.accusedId ?? null, legacyTicketId: legacy.id, addedMembers: legacy.members ?? [], priority: legacy.priority ?? 'normal', singleActive: false, assistanceVersion: 1 });
            if (!reserved.created) {
                this.log('legacy_ticket_migration_waiting', new TicketError('An overlapping active ticket must be reviewed.'));
                continue;
            }
            const ticket = this.repo.update(reserved.ticket.id, { channelId: legacy.channel, lifecycle: 'OPEN', createdAt: legacy.created ?? reserved.ticket.createdAt, claimantId: legacy.assignee ?? null, openingPingId: 'legacy-preserved' }, this.client.user.id, 'legacy_ticket_imported', { legacyTicketId: legacy.id });
            if (legacy.message)
                this.repo.update(ticket.id, { panelMessageId: legacy.message }, this.client.user.id, null);
        }
    }
    async recover() {
        if (this.assistanceRecovering || this.stopping)
            return;
        this.assistanceRecovering = true;
        try {
            await this.loadEmojis(await this.guild());
            await this.importLegacyTickets();
            for (const ticket of this.repo.listActive(this.config.guildId))
                if (ticket.pendingEscalation && (!ticket.operationToken || ticket.leaseUntil < Date.now()))
                    try {
                        await this.leased(ticket.id, 'recover-escalation', async (token) => {
                            const current = this.repo.get(ticket.id), channel = await this.channel(current);
                            if (channel)
                                await this.completeEscalation(current, channel, token);
                        });
                    }
                    catch (error) {
                        this.log('escalation_recovery_deferred', error);
                    }
            for (const ticket of this.repo.listActive(this.config.guildId))
                if (ticket.lifecycle === 'OPEN' && ticket.assistanceVersion !== 2 && (!ticket.operationToken || ticket.leaseUntil < Date.now())) {
                    try {
                        await this.leased(ticket.id, 'upgrade-existing', async (token) => {
                            const current = this.repo.get(ticket.id), channel = await this.channel(current);
                            if (!channel)
                                return;
                            if (current.legacyTicketId && channel.parentId !== this.category(current).categoryId)
                                await channel.edit({ parent: this.category(current).categoryId, lockPermissions: false, permissionOverwrites: this.overwrites(current) }, 'Route existing assistance ticket');
                            else
                                await channel.permissionOverwrites.set(this.overwrites(current), 'Upgrade existing ticket to current assistance permissions');
                            this.repo.update(current.id, { assistanceVersion: 2, panelSyncPending: true, nameSyncPending: true, originalCategory: current.originalCategory ?? current.category }, this.client.user.id, 'permissions_repaired', { upgrade: true }, token);
                        });
                    }
                    catch (error) {
                        this.log('existing_ticket_upgrade_deferred', error);
                    }
                }
            await super.recover();
            await this.flushLogs();
        }
        finally {
            this.assistanceRecovering = false;
        }
    }
    async message(message) {
        if (message.author?.bot || message.guildId !== this.config.guildId)
            return false;
        const ticket = this.repo.byChannel(message.channelId);
        if (ticket?.lifecycle === 'OPEN' && ticket.creatorId === message.author.id && ticket.awaitingResponse)
            try {
                await this.leased(ticket.id, 'creator-response', async (token) => {
                    const current = this.repo.get(ticket.id);
                    this.repo.update(ticket.id, { awaitingResponse: false, nameSyncPending: true, panelSyncPending: true }, message.author.id, 'creator_responded', {}, token);
                    await this.refresh(this.repo.get(ticket.id), await this.channel(current), token);
                });
            }
            catch (error) {
                this.log('response_state_deferred', error);
            }
        const closer = /^-closer(?:\s|$)/i.test(message.content ?? '');
        if (closer) {
            try {
                const actor = await this.actor(message.author.id);
                if (!ticket)
                    throw new TicketError('Use this command inside an assistance ticket.');
                await this.change(ticket.id, actor, 'respond', { reason: message.content.replace(/^-closer\s*/i, '').trim().slice(0, 1000) });
            }
            catch (error) {
                const { flags, ...payload } = notice(this.config, 'Assistance', error instanceof TicketError ? error.message : DENIED);
                await message.reply({ ...payload, flags: MessageFlags.IsComponentsV2 });
            }
            await this.flushLogs();
            return true;
        }
        const handled = await super.message(message);
        if (handled)
            await this.flushLogs();
        return handled;
    }
    async interaction(i) {
        const custom = i.customId ?? '', command = i.commandName ?? '';
        if (!custom.startsWith('na:') && !custom.startsWith('nt:') && !custom.startsWith('ls:ticket') && !custom.startsWith('ls:form:ticket,') && !['ticket', 'mytickets', 'ticket-panel', 'ticket-admin'].includes(command))
            return false;
        const task = this.handleAssistance(i);
        this.running.add(task);
        try {
            await task;
        }
        finally {
            this.running.delete(task);
        }
        return true;
    }
    async respond(i, payload) {
        if (i.deferred || i.replied) {
            const { flags, ...rest } = payload;
            return i.editReply({ ...rest, flags: MessageFlags.IsComponentsV2 });
        }
        return i.reply(payload);
    }
    async handleAssistance(i) {
        try {
            const parts = (i.customId ?? '').split(':'), action = parts[1], id = parts[2], arg = parts[3], isRating = ['rate', 'score', 'feedback'].includes(action) && parts[0] === 'na';
            if (i.guildId !== this.config.guildId && !(isRating && !i.guildId))
                throw new TicketError('Use Assistance in the main New York City Roleplay server.');
            if (isRating) {
                const ticket = this.repo.get(id);
                if (!ticket || ticket.creatorId !== i.user.id)
                    throw new TicketError(DENIED);
                if (ticket.lifecycle !== 'CLOSED')
                    throw new TicketError('Please wait for ticket closure to finish.');
                if (this.repo.db.prepare('SELECT 1 FROM assistance_ratings WHERE ticket_id=?').get(id))
                    throw new TicketError('You already rated this ticket.');
                if (action === 'rate')
                    return await this.respond(i, notice(this.config, 'Rate Your Experience', 'Choose a score from 1 (poor) to 5 (excellent).', [1, 2, 3, 4, 5].map(score => controlButton(this.config, String(score) + ' / 5', `na:score:${id}:${score}`))));
                if (action === 'score') {
                    if (!/^[1-5]$/.test(arg ?? ''))
                        throw new TicketError('Choose a score from 1 to 5.');
                    return await i.showModal(modal(`na:feedback:${id}:${arg}`, 'Rate Your Experience', [{ id: 'feedback', label: 'Optional written feedback', required: false, max: 1000 }]));
                }
                await i.deferReply({ flags: MessageFlags.Ephemeral });
                await this.rate(id, i.user.id, Number(arg), i.fields.getTextInputValue('feedback'));
                return await this.respond(i, notice(this.config, 'Thank you', 'Your support rating has been saved.'));
            }
            if (action === 'choose' && parts[0] === 'na') {
                this.selection(id, i.user.id, arg);
                const existing = this.activeMessage(i.user.id);
                if (existing)
                    return await this.respond(i, notice(this.config, 'Assistance', existing));
                return await i.showModal(inquiryModal(arg, { id }));
            }
            const modalActions = new Set(['close', 'add', 'remove', 'transfer', 'escalate', 'priority', 'rename', 'respond']);
            if (parts[0] === 'na' && modalActions.has(action) && !i.isModalSubmit()) {
                const actor = i.member?.roles?.cache ? actorFromMember(i.member) : await this.actor(i.user.id), ticket = this.repo.get(id);
                if (!ticket || ticket.channelId !== i.channelId)
                    throw new TicketError('Ticket not found in this channel.');
                this.requireManage(ticket, actor);
                this.assertOpen(ticket);
                if (action === 'close' && actor.id === ticket.creatorId)
                    throw new TicketError(DENIED);
                if (['add', 'remove'].includes(action) && this.category(ticket).confidential)
                    this.requireAdmin(actor);
                const fields = action === 'close' ? [{ id: 'reason', label: 'Reason for closing this ticket?', required: true, max: 1000 }] : action === 'escalate' ? [{ id: 'reason', label: 'Reason for escalating this ticket?', required: true, max: 1000 }] : ['add', 'remove', 'transfer'].includes(action) ? [{ id: 'member', label: 'Discord member mention or user ID', short: true, max: 24 }] : action === 'priority' ? [{ id: 'value', label: 'Priority: low, normal, high, urgent', short: true, max: 10 }] : action === 'rename' ? [{ id: 'value', label: 'New ticket name', short: true, max: 60 }] : [{ id: 'reason', label: 'Response request (optional)', required: false, max: 1000 }];
                return await i.showModal(modal(`na:action:${id}:${action}`, action === 'close' ? 'Close Ticket' : action === 'escalate' ? 'Escalate Ticket' : 'Ticket Control', fields));
            }
            await i.deferReply({ flags: MessageFlags.Ephemeral });
            if (action === 'inquiry' && parts[0] === 'na') {
                this.selection(id, i.user.id, arg);
                const existing = this.activeMessage(i.user.id);
                if (existing)
                    return await this.respond(i, notice(this.config, 'Assistance', existing));
                await this.respond(i, notice(this.config, 'Assistance', 'Creating your support ticket...'));
                const answers = Object.fromEntries(inquiryForms[arg].fields.map(field => [field.id, i.fields.getTextInputValue(field.id)]));
                const ticket = await this.create(arg, i.user, answers);
                return await this.respond(i, openedPanel(this.config, ticket));
            }
            const actor = await this.actor(i.user.id);
            if (action === 'support' || parts[0] !== 'na' && i.customId && !i.isChatInputCommand()) {
                const existing = this.activeMessage(i.user.id);
                if (existing)
                    return await this.respond(i, notice(this.config, 'Assistance', existing));
                const selection = this.beginSelection(i.user.id);
                await this.respond(i, selectionPanel(this.config, selection, false));
                const timer = this.schedule(() => {
                    this.timers.delete(timer);
                    if (!this.stopping)
                        void this.respond(i, selectionPanel(this.config, selection, true)).catch(error => this.log('selection_expired', error));
                }, this.config.inquiryDelayMs);
                this.timers.add(timer);
                timer.unref?.();
                return;
            }
            if (i.isChatInputCommand()) {
                return await this.command(i, actor);
            }
            const ticket = this.repo.get(id);
            if (!ticket || ticket.channelId !== i.channelId)
                throw new TicketError('Ticket not found in this channel.');
            this.requireManage(ticket, actor);
            if (action === 'action') {
                const value = name => i.fields.fields.has(name) ? i.fields.getTextInputValue(name).trim() : undefined;
                if (arg === 'close') {
                    await this.close(id, actor, { reason: value('reason') });
                    await this.flushLogs();
                    return await this.respond(i, notice(this.config, 'Ticket Closed', 'The transcript was stored securely and the ticket was closed.'));
                }
                const target = /^(?:<@!?)?(\d{17,20})>?$/.exec(value('member') ?? '')?.[1];
                await this.change(id, actor, arg, { reason: value('reason'), targetId: target, value: value('value')?.toLowerCase() });
            }
            else if (action === 'info')
                return await this.respond(i, this.ticketInfo(ticket));
            else if (action === 'answers') {
                const fields = Object.entries(ticket.answers ?? { inquiry: ticket.inquiry }), index = Number(arg ?? 0);
                if (!Number.isInteger(index) || index < 0 || index >= fields.length)
                    throw new TicketError('Inquiry page not found.');
                const [question, answer] = fields[index], form = inquiryForms[ticket.originalCategory ?? ticket.category], label = form?.fields.find(field => field.id === question)?.label ?? question;
                const buttons = [];
                if (index > 0)
                    buttons.push(controlButton(this.config, 'Previous', `na:answers:${ticket.id}:${index - 1}`));
                if (index + 1 < fields.length)
                    buttons.push(controlButton(this.config, 'Next', `na:answers:${ticket.id}:${index + 1}`));
                return await this.respond(i, notice(this.config, label, escapeMarkdown(String(answer) || 'Not supplied'), buttons));
            }
            else if (action === 'transcript') {
                const snapshot = await this.generateTranscript(ticket, actor);
                return await this.respond(i, notice(this.config, 'Transcript Ready', 'Access is checked against your current Discord Administrator permission.', [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('View Transcript').setURL(this.transcriptUrl(snapshot))]));
            }
            else
                await this.change(id, actor, action);
            await this.flushLogs();
            await this.respond(i, notice(this.config, 'Ticket Updated', 'Your assistance ticket has been updated.'));
        }
        catch (error) {
            this.log('assistance_interaction_failed', error);
            try {
                await this.respond(i, notice(this.config, 'Assistance', error instanceof TicketError ? error.message : 'This action could not finish safely. Please contact an administrator.'));
            }
            catch (replyError) {
                this.log('assistance_reply_failed', replyError);
            }
        }
    }
    ticketInfo(ticket) {
        return notice(this.config, 'Ticket Information', `**ID:** #${String(ticket.number).padStart(4, '0')}\n**Category:** ${this.category(ticket).name}\n**Creator:** <@${ticket.creatorId}>\n**Handler:** ${ticket.claimantId ? '<@' + ticket.claimantId + '>' : 'Unclaimed'}\n**Status:** ${ticket.lifecycle}\n**Priority:** ${ticket.priority ?? 'normal'}\n**Locked:** ${ticket.locked ? 'Yes' : 'No'}\n**Awaiting Response:** ${ticket.awaitingResponse ? 'Yes' : 'No'}\n**Created:** <t:${Math.floor(ticket.createdAt / 1000)}:f>`, [controlButton(this.config, 'View Inquiry Answers', `na:answers:${ticket.id}:0`)]);
    }
    async command(i, actor) {
        const command = i.commandName, sub = command === 'mytickets' ? 'mytickets' : i.options.getSubcommand();
        if (command === 'ticket-panel' || sub === 'panel' || sub === 'refresh-panel') {
            const sent = await this.publish(i.options.getChannel?.('channel')?.id ?? this.config.panelChannelId, actor);
            return this.respond(i, notice(this.config, 'Assistance Panel Ready', `[Open panel](${sent.url})`));
        }
        if (sub === 'mytickets') {
            const tickets = this.repo.db.prepare('SELECT * FROM tickets WHERE guild_id=? AND creator_id=? ORDER BY number DESC LIMIT 25').all(this.config.guildId, actor.id).map(row => this.repo.decode(row));
            return this.respond(i, notice(this.config, 'My Assistance Tickets', tickets.map(t => `**#${String(t.number).padStart(4, '0')}** · ${this.category(t).name} · ${t.lifecycle}${t.active && t.channelId ? ' · <#' + t.channelId + '>' : ''}`).join('\n') || 'You have no assistance tickets.'));
        }
        if (['config', 'diagnose'].includes(sub)) {
            this.requireAdmin(actor);
            if (sub === 'diagnose')
                return this.respond(i, notice(this.config, 'Assistance Diagnostics', (await this.diagnose()).join('\n')));
            const key = i.options.getString('type'), role = i.options.getRole('support-role'), parent = i.options.getChannel('category');
            if (role || parent) {
                const category = this.category(key);
                if (category.legacy)
                    throw new TicketError('Legacy routing is read-only.');
                const guild = await this.guild();
                if (role && (!await guild.roles.fetch(role.id) || role.id === guild.id))
                    throw new TicketError('Choose a support role in this server.');
                if (parent && (await guild.channels.fetch(parent.id))?.type !== ChannelType.GuildCategory)
                    throw new TicketError('Choose a category in this server.');
                await this.logChannel();
                const values = { categoryId: parent?.id ?? category.categoryId, supportRoleId: role?.id ?? category.supportRoleId };
                this.saveRouting(key, values, actor);
                Object.assign(category, values);
                const tickets = this.repo.listActive(this.config.guildId).filter(t => t.category === key && t.lifecycle === 'OPEN');
                for (const ticket of tickets) {
                    this.repo.event(ticket.id, 'configuration_changed', actor.id, { type: key, ...values });
                    await this.repair(ticket, actor);
                }
                await this.flushLogs();
            }
            return this.respond(i, notice(this.config, 'Assistance Configuration', this.config.categories.filter(c => !c.legacy).map(c => `**${c.name}:** category ${c.categoryId} · role <@&${c.supportRoleId}>`).join('\n') + '\n\nOne open ticket per member · Members cannot close · Transcripts: Discord Administrators only'));
        }
        if (sub === 'stats') {
            const categories = this.config.categories.filter(c => actor.administrator || actor.roles.includes(c.supportRoleId));
            if (!categories.length)
                throw new TicketError(DENIED);
            const lines = categories.map(c => {
                const rows = this.repo.db.prepare('SELECT lifecycle,COUNT(*) AS count FROM tickets WHERE guild_id=? AND category=? GROUP BY lifecycle').all(this.config.guildId, c.key);
                const rating = this.repo.db.prepare('SELECT COUNT(*) AS count,AVG(score) AS average FROM assistance_ratings WHERE category=?').get(c.key);
                return `**${c.name}:** ${rows.map(r => r.lifecycle + ': ' + r.count).join(' · ') || 'No tickets'}${rating.count ? ' · Rating ' + Number(rating.average).toFixed(1) + '/5 (' + rating.count + ')' : ''}`;
            });
            return this.respond(i, notice(this.config, 'Assistance Statistics', lines.join('\n')));
        }
        let ticket;
        const number = i.options.getInteger?.('number');
        if (number)
            ticket = this.repo.byNumber(this.config.guildId, number);
        else
            ticket = this.repo.byChannel(i.channelId);
        if (!ticket)
            throw new TicketError('Use this command inside a ticket or supply its number.');
        if (['repair', 'retry-close', 'details', 'reassign'].includes(sub))
            this.requireAdmin(actor);
        else
            this.requireManage(ticket, actor);
        if (sub === 'control')
            return this.respond(i, staffControl(this.config, ticket));
        if (sub === 'details' || sub === 'info')
            return this.respond(i, this.ticketInfo(ticket));
        if (sub === 'repair') {
            await this.repair(ticket, actor);
        }
        else if (sub === 'retry-close') {
            await this.close(ticket.id, actor, { retry: true });
        }
        else if (sub === 'transcript') {
            const snapshot = await this.generateTranscript(ticket, actor);
            return this.respond(i, notice(this.config, 'Transcript Ready', 'Discord Administrator access is required.', [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('View Transcript').setURL(this.transcriptUrl(snapshot))]));
        }
        else if (sub === 'close') {
            const reason = i.options.getString('reason', true);
            await this.close(ticket.id, actor, { reason });
        }
        else
            await this.change(ticket.id, actor, sub === 'reassign' ? 'transfer' : sub, { targetId: i.options.getUser?.('member')?.id, reason: i.options.getString?.('reason') ?? undefined, value: i.options.getString?.('value') ?? undefined });
        await this.flushLogs();
        return this.respond(i, notice(this.config, 'Ticket Updated', 'The requested staff action is complete.'));
    }
    async stop() {
        this.stopping = true;
        for (const timer of this.timers)
            clearTimeout(timer);
        this.timers.clear();
        while (this.assistanceRecovering)
            await new Promise(resolve => setTimeout(resolve, 20));
        await super.stop();
    }
}
