import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Collection, ChannelType, MessageFlags, PermissionsBitField } from 'discord.js';
import { TicketRepository } from '../apps/bot/src/ticket-system/database.js';
import { TicketSystem } from '../apps/bot/src/ticket-system/service.js';
import { ticketConfig } from '../config/tickets.js';
import { authorize, permissionOverwrites, nextEscalation } from '../apps/bot/src/ticket-system/permissions.js';
import { ticketPanel, ticketCard, closureSummary } from '../apps/bot/src/ticket-system/views.js';
import { captureTranscript, verifyParts, safeUrl } from '../apps/bot/src/ticket-system/transcripts.js';
const owner: any = { id: 'owner', roles: [], administrator: true }, creator: any = { id: 'member', roles: [], administrator: false };
const staff: any = { id: 'staff', roles: [ticketConfig.categories[0].supportRoleId], administrator: false };
const otherStaff: any = { ...staff, id: 'staff2' };
const viewer: any = { id: 'viewer', roles: [ticketConfig.categories[0].viewerRoleIds[0]], administrator: false };
async function fixture() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nyc-ticket-test-')), config = { ...ticketConfig, databasePath: path.join(directory, 'tickets.sqlite'), transcriptDirectory: path.join(directory, 'transcripts'), renameTimeoutMs: 100 };
    const repo = new TicketRepository(config.databasePath), channels = new Collection<string, any>(), users = new Map(), effects: any[] = [];
    let serial = 0, failLog = false, failDm = false, failDelete = false, failRename = false;
    const makeChannel = (id: string, type = ChannelType.GuildText) => {
        const messages = new Collection<string, any>();
        const channel: any = { id, type, name: id, topic: null, messages: { fetch: async (arg: any) => {
                    if (typeof arg === 'string') {
                        const message = messages.get(arg);
                        if (!message)
                            throw Object.assign(Error('missing'), { code: 10008 });
                        return message;
                    }
                    const sorted = [...messages.values()].sort((a, b) => Number(b.id) - Number(a.id));
                    const filtered = arg.before ? sorted.filter(m => BigInt(m.id) < BigInt(arg.before)) : sorted;
                    return new Collection(filtered.slice(0, arg.limit).map(m => [m.id, m]));
                } }, permissionsFor: () => ({ has: () => id === config.transcriptChannelId ? false : true }), permissionOverwrites: { set: async (overwrites: any) => {
                    channel.overwrites = overwrites;
                }, edit: async (role: string, permissions: any) => {
                    effects.push({ kind: 'grant', role, permissions });
                } }, send: async (payload: any) => {
                if (id === config.transcriptChannelId && failLog)
                    throw Object.assign(Error('log unavailable'), { code: 50013 });
                const message: any = { id: String(++serial), author: { id: 'bot', username: 'New York Automation' }, createdTimestamp: Date.now(), content: payload.content ?? '', components: payload.components ?? [], attachments: new Collection(), embeds: [], nonce: payload.nonce, url: 'https://discord.com/channels/guild/' + id + '/' + serial, edit: async (p: any) => {
                        Object.assign(message, { components: p.components, content: p.content ?? '' });
                        return message;
                    }, delete: async () => messages.delete(message.id) };
                messages.set(message.id, message);
                effects.push({ kind: id === config.transcriptChannelId ? 'log' : 'send', channel: id, payload, message });
                return message;
            }, delete: async () => {
                if (failDelete)
                    throw Object.assign(Error('cannot delete'), { code: 50013 });
                effects.push({ kind: 'delete', channel: id });
                channels.delete(id);
            } };
        channels.set(id, channel);
        return channel;
    };
    makeChannel(config.transcriptChannelId);
    makeChannel(config.panelChannelId);
    const guild: any = { id: config.guildId, ownerId: 'owner', roles: { everyone: { id: config.guildId }, fetch: async (id: string) => ({ id }) }, emojis: { fetch: async () => new Collection(config.categories.map(c => [c.emojiId, {}])) }, channels: { fetch: async (id?: string) => id ? (channels.get(id) ?? null) : channels, create: async (options: any) => {
                const channel = makeChannel('channel-' + (++serial));
                Object.assign(channel, { name: options.name, topic: options.topic, parentId: options.parent, overwrites: options.permissionOverwrites });
                effects.push({ kind: 'create', options });
                return channel;
            } }, members: { fetchMe: async () => ({ id: 'bot' }), fetch: async ({ user }: any) => {
                const actor = users.get(user);
                if (!actor)
                    throw Error('member missing');
                return { id: actor.id, guild, user: { username: actor.id }, roles: { cache: new Collection(actor.roles.map((id: string) => [id, {}])) }, permissions: new PermissionsBitField(actor.administrator ? 8n : 0n) };
            } } };
    for (const c of config.categories)
        makeChannel(c.categoryId, ChannelType.GuildCategory);
    // Only @everyone visibility is tested by logChannel; diagnose needs separate bot permissions.
    channels.get(config.transcriptChannelId).permissionsFor = (who: any) => ({ has: () => who.id !== config.guildId });
    for (const actor of [owner, creator, staff, otherStaff, viewer])
        users.set(actor.id, actor);
    const client: any = { user: { id: 'bot' }, options: { intents: { has: () => true } }, guilds: { fetch: async () => guild }, rest: { patch: async (route: string, { body }: any) => {
                if (failRename)
                    throw Object.assign(Error('rate limited'), { code: 429 });
                const id = route.split('/').at(-1);
                channels.get(id!).name = body.name;
            } }, users: { fetch: async (id: string) => ({ send: async (payload: any) => {
                    if (failDm)
                        throw Object.assign(Error('DM blocked'), { code: 50007 });
                    effects.push({ kind: 'dm', id, payload });
                    return { id: String(++serial) };
                } }) } };
    const service = new TicketSystem(client, config, repo);
    return { service, repo, config, channels, effects, users, guild, client, makeChannel, setFailLog: (v: boolean) => {
            failLog = v;
        }, setFailDm: (v: boolean) => {
            failDm = v;
        }, setFailDelete: (v: boolean) => {
            failDelete = v;
        }, setFailRename: (v: boolean) => {
            failRename = v;
        }, create: (key = 'general') => service.create(key, { id: 'member', username: 'Member', createdTimestamp: 1000 }, 'Please help with my support request.'), cleanup: async () => {
            await service.stop();
            await fs.rm(directory, { recursive: true, force: true });
        }, directory };
}
test('V2 panels have exact three categories, supplied banners and a separate control row', () => {
    const panel = ticketPanel(ticketConfig);
    assert.ok(Number(panel.flags) & MessageFlags.IsComponentsV2);
    const json = panel.components.map((c: any) => c.toJSON());
    const menu: any = (json[0] as any).components.find((c: any) => c.type === 1).components[0];
    assert.deepEqual(menu.options.map((o: any) => o.emoji.id), ticketConfig.categories.map(c => c.emojiId));
    assert.equal(menu.options.length, 3);
    assert.ok(panel.files.every((f: any) => f.attachment.includes('nyc-')));
    const ticket: any = { id: 'x', category: 'department', creatorId: 'member', creatorUsername: '<@everyone>', inquiry: 'Help @everyone', createdAt: Date.now(), number: 1, lifecycle: 'OPEN', escalationLevel: 0, escalatedRoles: [] };
    const card = ticketCard(ticket, ticketConfig, null);
    assert.equal(card.components[1].toJSON().type, 1);
    assert.equal((card.components[1].toJSON() as any).components.length, 2);
    assert.deepEqual(card.allowedMentions.parse, []);
    assert.ok(!JSON.stringify(card.components).includes('nt:escalate'));
});
test('SQLite WAL migrations, unique active tickets, leases, numbering and confirmations persist', async () => {
    const f = await fixture();
    try {
        const one = f.repo.reserve({ guildId: f.config.guildId, creatorId: 'member', category: 'general' });
        assert.equal(one.ticket.number, 1);
        assert.equal(f.repo.reserve({ guildId: f.config.guildId, creatorId: 'member', category: 'general' }).created, false);
        assert.equal(f.repo.reserve({ guildId: f.config.guildId, creatorId: 'member', category: 'department' }).ticket.number, 2);
        assert.equal((f.repo.db.prepare('PRAGMA journal_mode').get() as any).journal_mode, 'wal');
        const second = new TicketRepository(f.config.databasePath);
        try {
            assert.equal(second.get(one.ticket.id)?.number, 1);
            const token = f.repo.acquire(one.ticket.id, 'test');
            assert.throws(() => second.acquire(one.ticket.id, 'race'));
            assert.throws(() => second.update(one.ticket.id, { claimantId: 'bad' }, 'bad', 'claim'));
            f.repo.release(one.ticket.id, token);
            const confirm = f.repo.confirmation(one.ticket.id, 'owner', 'close', {});
            assert.throws(() => second.consumeConfirmation(confirm, 'member'));
            assert.equal(second.consumeConfirmation(confirm, 'owner').action, 'close');
            assert.throws(() => f.repo.consumeConfirmation(confirm, 'owner'));
        }
        finally {
            second.close();
        }
    }
    finally {
        await f.cleanup();
    }
});
test('viewer roles can view but cannot manage, creators close only their own, department cannot escalate', () => {
    const t: any = { guildId: ticketConfig.guildId, creatorId: creator.id, category: 'general', escalatedRoles: [], escalationLevel: 0 };
    assert.doesNotThrow(() => authorize(t, viewer, 'view', ticketConfig));
    for (const action of ['claim', 'close', 'escalate', 'reassign', 'repair'])
        assert.throws(() => authorize(t, viewer, action, ticketConfig));
    assert.doesNotThrow(() => authorize(t, creator, 'close', ticketConfig));
    assert.throws(() => authorize(t, creator, 'claim', ticketConfig));
    assert.equal(nextEscalation({ ...t, category: 'department', escalationLevel: 99 }, ticketConfig), null);
    const overwrites = permissionOverwrites(t, 'bot', ticketConfig.guildId, ticketConfig);
    assert.equal(overwrites[0].id, ticketConfig.guildId);
    assert.ok(overwrites.find(o => o.id === ticketConfig.categories[0].supportRoleId));
});
test('creation uses correct category, immutable inquiry, explicit private overwrites and actual limited pings', async () => {
    const f = await fixture();
    try {
        for (const category of f.config.categories) {
            const t = await f.create(category.key);
            assert.equal(f.channels.get(t.channelId).parentId, category.categoryId);
            assert.equal(t.inquiry, 'Please help with my support request.');
            const ping = f.effects.find(e => e.channel === t.channelId && e.payload.content?.startsWith('<@member>'));
            assert.deepEqual(ping.payload.allowedMentions, { parse: [], users: ['member'], roles: [category.supportRoleId] });
            assert.equal(f.channels.get(t.channelId).name, '🔴丨ticket-' + String(t.number).padStart(4, '0'));
        }
        const count = f.effects.filter(e => e.kind === 'create').length;
        assert.equal((await f.create()).number, 1);
        assert.equal(f.effects.filter(e => e.kind === 'create').length, count);
        await assert.rejects(() => f.service.create('general', { id: 'member' }, 'short'));
        await assert.rejects(() => f.service.create('bad', { id: 'member' }, 'long enough inquiry'));
    }
    finally {
        await f.cleanup();
    }
});
test('concurrent claims have one winner, ownership is enforced, rename failures preserve assignment', async () => {
    const f = await fixture();
    try {
        let t = await f.create();
        const results = await Promise.allSettled([f.service.change(t.id, staff, 'claim'), f.service.change(t.id, otherStaff, 'claim')]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        t = f.repo.get(t.id)!;
        assert.equal(t.claimantId, 'staff');
        assert.ok(f.channels.get(t.channelId).name.startsWith('🟢'));
        await assert.rejects(() => f.service.change(t.id, otherStaff, 'unclaim'));
        await f.service.change(t.id, staff, 'unclaim');
        assert.equal(f.repo.get(t.id)?.claimantId, null);
        f.setFailRename(true);
        await f.service.change(t.id, staff, 'claim');
        assert.equal(f.repo.get(t.id)?.claimantId, 'staff');
        assert.equal(f.repo.get(t.id)?.nameSyncPending, true);
        f.setFailRename(false);
        await f.service.recover();
        assert.equal(f.repo.get(t.id)?.nameSyncPending, false);
    }
    finally {
        await f.cleanup();
    }
});
test('escalation retains parent, creator and primary access; stale escalation and department bypass rejected', async () => {
    const f = await fixture();
    try {
        let t = await f.create();
        await f.service.change(t.id, staff, 'claim');
        await f.service.change(t.id, staff, 'escalate', { expectedLevel: 0 });
        t = f.repo.get(t.id)!;
        assert.equal(t.claimantId, 'staff');
        assert.equal(t.escalationLevel, 1);
        assert.equal(f.channels.get(t.channelId).parentId, f.config.categories[0].categoryId);
        assert.ok(t.escalatedRoles.includes(f.config.categories[1].supportRoleId));
        await assert.rejects(() => f.service.change(t.id, staff, 'escalate', { expectedLevel: 0 }));
        await f.service.change(t.id, staff, 'escalate', { expectedLevel: 1 });
        assert.equal(f.repo.get(t.id)?.escalationLevel, 2);
        await assert.rejects(() => f.service.change(t.id, staff, 'escalate', { expectedLevel: 2 }));
        const department = await f.create('department');
        await assert.rejects(() => f.service.change(department.id, owner, 'escalate', { expectedLevel: 0 }));
    }
    finally {
        await f.cleanup();
    }
});
test('close confirmations are private, creator-bound, one-use, and authorization is rechecked', async () => {
    const f = await fixture();
    try {
        const t = await f.create();
        const payload = f.service.requestConfirmation(t, creator, 'close');
        assert.ok(Number(payload.flags) & MessageFlags.Ephemeral);
        const json: any = payload.components[0].toJSON();
        const id = json.components.at(-1).components[0].custom_id.split(':')[2];
        assert.throws(() => f.repo.consumeConfirmation(id, 'staff'));
        assert.equal(f.repo.consumeConfirmation(id, 'member').ticket_id, t.id);
        assert.throws(() => f.repo.consumeConfirmation(id, 'member'));
        assert.throws(() => f.service.requestConfirmation(t, viewer, 'close'));
        assert.throws(() => f.service.requestConfirmation(t, staff, 'reassign', { targetId: 'owner' }));
        assert.ok(f.service.requestConfirmation(t, owner, 'reassign', { targetId: 'staff' }));
    }
    finally {
        await f.cleanup();
    }
});
test('failed log delivery preserves channel; retry logs once, attempts DM, deletes only afterward', async () => {
    const f = await fixture();
    try {
        const t = await f.create();
        f.setFailLog(true);
        await assert.rejects(() => f.service.close(t.id, creator), /preserved/);
        assert.ok(f.channels.has(t.channelId));
        assert.equal(f.repo.get(t.id)?.lifecycle, 'CLOSING');
        assert.equal(f.repo.delivery(t.id).log_status, 'sending');
        f.setFailLog(false);
        f.setFailDm(true);
        await f.service.close(t.id, owner, { retry: true });
        assert.equal(f.repo.get(t.id)?.lifecycle, 'CLOSED');
        assert.equal(f.repo.delivery(t.id).dm_status, 'blocked');
        assert.equal(f.effects.filter(e => e.kind === 'log').length, 1);
        assert.ok(f.effects.findIndex(e => e.kind === 'log') < f.effects.findIndex(e => e.kind === 'delete'));
        assert.equal(f.channels.has(t.channelId), false);
        await verifyParts(f.repo.get(t.id)?.transcript.parts);
    }
    finally {
        await f.cleanup();
    }
});
test('delete failure/restart recovers without duplicate transcript summaries or successful DMs', async () => {
    const f = await fixture();
    try {
        const t = await f.create();
        f.setFailDelete(true);
        await assert.rejects(() => f.service.close(t.id, creator));
        assert.ok(f.channels.has(t.channelId));
        assert.equal(f.effects.filter(e => e.kind === 'dm').length, 1);
        f.setFailDelete(false);
        await f.service.recover();
        assert.equal(f.repo.get(t.id)?.lifecycle, 'CLOSED');
        assert.equal(f.effects.filter(e => e.kind === 'log').length, 1);
        assert.equal(f.effects.filter(e => e.kind === 'dm').length, 1);
    }
    finally {
        await f.cleanup();
    }
});
test('recovery adopts a channel created before DB binding and detects externally deleted open channels', async () => {
    const f = await fixture();
    try {
        const reserved = f.repo.reserve({ guildId: f.config.guildId, creatorId: 'member', creatorUsername: 'Member', category: 'general', inquiry: 'Recovery inquiry text' }).ticket;
        const channel = f.makeChannel('orphan');
        channel.topic = 'nyc-ticket:' + reserved.id;
        await f.service.recover();
        assert.equal(f.repo.get(reserved.id)?.channelId, 'orphan');
        assert.equal(f.repo.get(reserved.id)?.lifecycle, 'OPEN');
        f.channels.delete('orphan');
        await f.service.recover();
        assert.equal(f.repo.get(reserved.id)?.errorCode, 'CHANNEL_DELETED_EXTERNALLY');
        assert.equal(f.repo.get(reserved.id)?.active, false);
    }
    finally {
        await f.cleanup();
    }
});
test('transcripts paginate all history, escape HTML, sanitize links and split by bytes with hashes', async () => {
    const f = await fixture();
    try {
        let t = await f.create();
        const channel = f.channels.get(t.channelId);
        for (let n = 0; n < 220; n++)
            await channel.send({ content: `message-${n} <script>alert('x')</script> ` + 'x'.repeat(300) });
        t = f.repo.update(t.id, { closure: { actorId: 'owner', startedAt: Date.now() } }, 'owner', 'test');
        const result = await captureTranscript(t, channel, f.repo, { ...f.config, transcriptPartBytes: 16000 });
        assert.equal(result.messageCount, 222);
        assert.ok(result.parts.length > 1);
        await verifyParts(result.parts);
        const html = (await Promise.all(result.parts.map((p: any) => fs.readFile(p.path, 'utf8')))).join('');
        assert.ok(html.includes('message-0'));
        assert.ok(html.includes('message-219'));
        assert.ok(html.includes('&lt;script&gt;'));
        assert.ok(!html.includes('<script>'));
        assert.ok(result.parts.every((p: any) => p.bytes <= 16000));
        assert.equal(safeUrl('javascript:alert(1)'), null);
        assert.equal(safeUrl('https://evil.invalid/image', { avatar: true }), null);
        await fs.appendFile(result.parts[0].path, 'tamper');
        await assert.rejects(() => verifyParts(result.parts));
    }
    finally {
        await f.cleanup();
    }
});
test('admin panel deployment updates tracked message and refuses public log channels', async () => {
    const f = await fixture();
    try {
        await assert.rejects(() => f.service.publish(f.config.panelChannelId, staff));
        const first = await f.service.publish(f.config.panelChannelId, owner), second = await f.service.publish(f.config.panelChannelId, owner);
        assert.equal(first.id, second.id);
        assert.equal(f.repo.panels(f.config.guildId).length, 1);
        f.channels.get(f.config.transcriptChannelId).permissionsFor = () => ({ has: () => true });
        await assert.rejects(() => f.service.publish(f.config.panelChannelId, owner), /deny @everyone/);
    }
    finally {
        await f.cleanup();
    }
});
test('persistent button routing acknowledges before member lookups and opens modal immediately', async () => {
    const f = await fixture();
    try {
        const calls: string[] = [], base: any = { guildId: f.config.guildId, user: { id: 'member' }, isChatInputCommand: () => false };
        assert.equal(await f.service.interaction({ ...base, customId: 'unrelated' }), false);
        await f.service.interaction({ ...base, customId: 'nt:select', values: ['general'], showModal: async (modal: any) => {
                calls.push('modal');
                assert.equal(modal.toJSON().components[0].components[0].min_length, 10);
            } });
        assert.deepEqual(calls, ['modal']);
        const t = await f.create();
        let reply: any;
        await f.service.interaction({ ...base, user: { id: 'viewer' }, customId: 'nt:claim:' + t.id, channelId: t.channelId, deferred: true, deferReply: async () => calls.push('deferred'), editReply: async (payload: any) => {
                reply = payload;
            } });
        assert.ok(JSON.stringify(reply).includes('permission'));
        assert.equal(f.repo.get(t.id)?.claimantId, null);
    }
    finally {
        await f.cleanup();
    }
});
function prefixMessage(f: any, ticket: any, userId: string, content: string) {
    return { guildId: f.config.guildId, channelId: ticket.channelId, content, author: { id: userId, bot: false }, reply: async (payload: any) => {
            f.effects.push({ kind: 'commandReply', payload });
        } };
}
test('prefix close requires a reason and ticket management permission; viewer and creator cannot invoke staff commands', async () => {
    const f = await fixture();
    try {
        const ticket = await f.create();
        for (const user of ['member', 'viewer'])
            for (const command of ['-close Resolved', '-closer Can we close?']) {
                await f.service.message(prefixMessage(f, ticket, user, command));
                assert.equal(f.repo.get(ticket.id)?.lifecycle, 'OPEN');
                assert.equal(f.repo.get(ticket.id)?.closeRequest, undefined);
            }
        assert.ok(f.effects.filter(e => e.kind === 'commandReply').every(e => JSON.stringify(e.payload).includes('permission')));
        await f.service.message(prefixMessage(f, ticket, 'staff', '-close'));
        assert.equal(f.repo.get(ticket.id)?.lifecycle, 'OPEN');
        assert.ok(JSON.stringify(f.effects.at(-1).payload).includes('reason is required'));
        await f.service.message(prefixMessage(f, ticket, 'staff', '-close ' + 'x'.repeat(1001)));
        assert.equal(f.repo.get(ticket.id)?.lifecycle, 'OPEN');
        assert.equal(await f.service.message({ ...prefixMessage(f, ticket, 'staff', '-close Done'), guildId: 'other' }), false);
        assert.equal(await f.service.message({ ...prefixMessage(f, ticket, 'staff', '-close Done'), author: { id: 'staff', bot: true } }), false);
        assert.equal(await f.service.message(prefixMessage(f, ticket, 'staff', '-closeother')), false);
    }
    finally {
        await f.cleanup();
    }
});
test('prefix close immediately uses safe transcript delivery and stores the exact supplied closing reason', async () => {
    const f = await fixture();
    try {
        const ticket = await f.create();
        await f.service.message(prefixMessage(f, ticket, 'staff', '-close Issue resolved @everyone'));
        const final = f.repo.get(ticket.id)!;
        assert.equal(final.lifecycle, 'CLOSED');
        assert.equal(final.closure.reason, 'Issue resolved @everyone');
        assert.equal(final.closure.actorId, 'staff');
        assert.equal(f.effects.filter(e => e.kind === 'log').length, 1);
        assert.ok(JSON.stringify(f.effects.find(e => e.kind === 'log').payload).includes('Issue resolved'));
        assert.deepEqual(f.effects.find(e => e.kind === 'log').payload.allowedMentions.parse, []);
        const html = await fs.readFile(final.transcript.parts[0].path, 'utf8');
        assert.ok(html.includes('Issue resolved @everyone'));
        assert.ok(html.includes(ticket.inquiry));
    }
    finally {
        await f.cleanup();
    }
});
test('closer sends a persistent V2 creator-only ping, blocks duplicates and permits only the creator to answer', async () => {
    const f = await fixture();
    try {
        const ticket = await f.create();
        await f.service.message(prefixMessage(f, ticket, 'staff', '-closer Are you all set? @everyone'));
        let updated = f.repo.get(ticket.id)!;
        const request = updated.closeRequest;
        assert.equal(request.reason, 'Are you all set? @everyone');
        assert.equal(updated.lifecycle, 'OPEN');
        const sent = f.effects.find(e => e.message?.id === request.messageId);
        assert.ok(Number(sent.payload.flags) & MessageFlags.IsComponentsV2);
        assert.deepEqual(sent.payload.allowedMentions, { parse: [], users: ['member'] });
        assert.ok(JSON.stringify(sent.payload).includes('Keep Open'));
        await assert.rejects(() => f.service.requestClose(ticket.id, staff, 'Duplicate'));
        await assert.rejects(() => f.service.answerCloseRequest(ticket.id, request.id, otherStaff, true));
        assert.equal(f.repo.get(ticket.id)?.lifecycle, 'OPEN');
        await f.service.answerCloseRequest(ticket.id, request.id, creator, false);
        updated = f.repo.get(ticket.id)!;
        assert.equal(updated.closeRequest.status, 'declined');
        assert.equal(updated.lifecycle, 'OPEN');
        await assert.rejects(() => f.service.answerCloseRequest(ticket.id, request.id, creator, true));
        await f.service.message(prefixMessage(f, ticket, 'staff', '-closer'));
        assert.equal(f.repo.get(ticket.id)?.closeRequest.reason, '');
    }
    finally {
        await f.cleanup();
    }
});
test('creator approval closes under requesting staff identity and records creator approval once', async () => {
    const f = await fixture();
    try {
        const ticket = await f.create();
        await f.service.requestClose(ticket.id, staff, 'Support completed');
        const request = f.repo.get(ticket.id)?.closeRequest;
        const results = await Promise.allSettled([f.service.answerCloseRequest(ticket.id, request.id, creator, true), f.service.answerCloseRequest(ticket.id, request.id, creator, true)]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        const final = f.repo.get(ticket.id)!;
        assert.equal(final.lifecycle, 'CLOSED');
        assert.equal(final.closeRequest.status, 'approved');
        assert.equal(final.closure.actorId, 'staff');
        assert.equal(final.closure.approvedBy, 'member');
        assert.equal(final.closure.reason, 'Support completed');
        assert.equal(f.effects.filter(e => e.kind === 'log').length, 1);
    }
    finally {
        await f.cleanup();
    }
});
test('expired requests and removed requester permissions leave tickets open; recovery resends no successful request', async () => {
    const f = await fixture();
    try {
        const ticket = await f.create();
        await f.service.requestClose(ticket.id, staff);
        let request = f.repo.get(ticket.id)?.closeRequest;
        f.users.set('staff', { ...staff, roles: [] });
        await assert.rejects(() => f.service.answerCloseRequest(ticket.id, request.id, creator, true));
        assert.equal(f.repo.get(ticket.id)?.lifecycle, 'OPEN');
        f.users.set('staff', staff);
        f.repo.update(ticket.id, { closeRequest: { ...request, expiresAt: Date.now() - 1000 } }, 'owner', 'test_expired');
        await assert.rejects(() => f.service.answerCloseRequest(ticket.id, request.id, creator, true));
        assert.equal(f.repo.get(ticket.id)?.lifecycle, 'OPEN');
        await f.service.requestClose(ticket.id, staff, 'New request');
        request = f.repo.get(ticket.id)?.closeRequest;
        const before = f.effects.filter(e => e.kind === 'send').length;
        await f.service.recover();
        assert.equal(f.effects.filter(e => e.kind === 'send').length, before);
        // Crash window: request sent but its message receipt was not saved. Recover by its persistent button ID.
        f.repo.update(ticket.id, { closeRequest: { ...request, messageId: null } }, 'owner', 'test_receipt_lost');
        await f.service.recover();
        assert.equal(f.effects.filter(e => e.kind === 'send').length, before);
        assert.equal(f.repo.get(ticket.id)?.closeRequest.messageId, request.messageId);
    }
    finally {
        await f.cleanup();
    }
});
test('prefix commands preserve the channel when logging fails and reject non-ticket channels', async () => {
    const f = await fixture();
    try {
        const ticket = await f.create();
        f.setFailLog(true);
        await f.service.message(prefixMessage(f, ticket, 'staff', '-close Resolved safely'));
        assert.ok(f.channels.has(ticket.channelId));
        assert.equal(f.repo.get(ticket.id)?.lifecycle, 'CLOSING');
        assert.equal(f.repo.get(ticket.id)?.closure.reason, 'Resolved safely');
        await f.service.message(prefixMessage(f, { channelId: f.config.panelChannelId }, 'staff', '-closer'));
        assert.ok(JSON.stringify(f.effects.at(-1).payload).includes('active support ticket'));
    }
    finally {
        await f.cleanup();
    }
});
test('request response buttons enforce the ticket channel and creator identity through persistent interaction routing', async () => {
    const f = await fixture();
    try {
        const ticket = await f.create();
        await f.service.requestClose(ticket.id, staff, 'Completed');
        const request = f.repo.get(ticket.id)?.closeRequest;
        let response: any;
        const interaction: any = { guildId: f.config.guildId, channelId: ticket.channelId, user: { id: 'viewer' }, customId: `nt:requestDecline:${ticket.id}:${request.id}`, deferred: true, deferReply: async () => {
            }, editReply: async (payload: any) => {
                response = payload;
            }, isChatInputCommand: () => false };
        await f.service.interaction(interaction);
        assert.ok(JSON.stringify(response).includes('Only the ticket creator'));
        assert.equal(f.repo.get(ticket.id)?.closeRequest.status, 'pending');
        await f.service.interaction({ ...interaction, user: { id: 'member' }, channelId: 'other' });
        assert.ok(JSON.stringify(response).includes('does not belong'));
        assert.equal(f.repo.get(ticket.id)?.closeRequest.status, 'pending');
        await f.service.interaction({ ...interaction, user: { id: 'member' } });
        assert.equal(f.repo.get(ticket.id)?.closeRequest.status, 'declined');
        assert.ok(JSON.stringify(response).includes('Ticket remains open'));
        assert.equal(f.repo.get(ticket.id)?.lifecycle, 'OPEN');
    }
    finally {
        await f.cleanup();
    }
});
