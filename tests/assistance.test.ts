import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PermissionFlagsBits, PermissionsBitField, MessageFlags } from 'discord.js';
import { assistanceFixture, users } from './helpers/assistance-fixture.js';
import { assistancePanel, openingPanel, inquiryForms, inquiryModal, staffControl, DENIED } from '../apps/bot/src/ticket-system/assistance-views.js';
import { ticketCommands } from '../apps/bot/src/ticket-system/assistance-commands.js';
import { ticketConfig } from '../config/tickets.js';
test('new assistance panel and opening controls match the reference layout and supplied warm branding', async () => {
    const f = await assistanceFixture();
    try {
        await f.service.diagnose();
        const panel = assistancePanel(f.service.config), json = JSON.stringify(panel.components.map((c: any) => c.toJSON()));
        assert.ok(Number(panel.flags) & MessageFlags.IsComponentsV2);
        assert.equal(panel.components[0].toJSON().accent_color, 0xD8C5A4);
        assert.ok(json.includes('Get Support'));
        assert.ok(!json.includes('Staff Application'));
        assert.ok(!json.includes('North Carolina'));
        assert.ok(json.includes('actual_support'));
        const t = await f.create();
        const card = openingPanel(f.service.config, t, f.service.category(t)).components[0].toJSON() as any;
        const actions = card.components.filter((c: any) => c.type === 1).flatMap((c: any) => c.components);
        assert.deepEqual(actions.map((b: any) => b.label), ['Close', 'Claim']);
        assert.ok(JSON.stringify(card).includes('LinkedExample'));
        assert.ok(f.effects.find(e => e.message?.id === t.panelMessageId).message.pinned);
    }
    finally {
        await f.cleanup();
    }
});
test('support selection is private, binds the creator, delays the fallback exactly 10 seconds and survives selection lookup after restart', async () => {
    const f = await assistanceFixture();
    try {
        const { i, replies } = f.interaction('na:support');
        await f.service.interaction(i);
        assert.ok(Number(replies[0].flags) & MessageFlags.IsComponentsV2);
        const json = JSON.stringify(replies[0]);
        assert.ok(!json.includes("Inquiry Isn't Listed"));
        assert.equal(f.timers[0].delay, 10000);
        const row = f.repo.db.prepare('SELECT * FROM assistance_selections').get() as any;
        assert.throws(() => f.service.selection(row.id, users.outsider, 'purchase'));
        assert.throws(() => f.service.selection(row.id, users.creator, 'general'));
        f.advance(10000);
        f.timers[0].callback();
        await new Promise(resolve => setImmediate(resolve));
        assert.ok(JSON.stringify(replies.at(-1)).includes("Inquiry Isn't Listed"));
        assert.equal(f.service.selection(row.id, users.creator, 'general').id, row.id);
        const modal = inquiryModal('general', { id: row.id }).toJSON();
        assert.equal(modal.title, 'Support Ticket Inquiry');
        assert.equal((modal.components[0] as any).components[0].placeholder, 'I need help with...');
    }
    finally {
        await f.cleanup();
    }
});
test('every inquiry modal validates and routes to the configured category; answers and real linked Roblox data persist', async () => {
    const f = await assistanceFixture();
    try {
        for (const [index, key] of Object.keys(inquiryForms).entries()) {
            assert.ok(inquiryModal(key, { id: 'test' }).toJSON().components.length <= 5);
            const userId = '10000000000000001' + index;
            f.members.set(userId, { ...f.creator, id: userId });
            const ticket = await f.create(key, userId);
            assert.equal(f.channels.get(ticket.channelId).parentId, f.service.category(key).categoryId);
            assert.equal(ticket.roblox.username, 'LinkedExample');
            assert.equal(ticket.answers[Object.keys(f.answers[key])[0]], f.answers[key][Object.keys(f.answers[key])[0]]);
            assert.ok(f.channels.get(ticket.channelId).name.startsWith('🔴-'));
        }
        await assert.rejects(() => f.service.create('general', { id: users.creator }, 'short'));
    }
    finally {
        await f.cleanup();
    }
});
test('one active ticket across all categories is enforced atomically and existing ticket records are preserved', async () => {
    const f = await assistanceFixture();
    try {
        const results = await Promise.all([f.create('general'), f.create('purchase')]);
        assert.equal(results[0].id, results[1].id);
        assert.equal(f.effects.filter(e => e.kind === 'create').length, 1);
        const legacy = f.repo.reserve({ guildId: f.config.guildId, creatorId: users.other, category: 'department', inquiry: 'Existing department ticket' }).ticket;
        assert.equal((await f.create('appeal', users.other)).id, legacy.id);
        assert.equal(f.repo.get(legacy.id)?.category, 'department');
    }
    finally {
        await f.cleanup();
    }
});
test('current-category staff permission, claim races, handler-only unclaim, transfers and private control authorization', async () => {
    const f = await assistanceFixture();
    try {
        const ticket = await f.create();
        await assert.rejects(() => f.service.change(ticket.id, f.creator, 'claim'), new RegExp(DENIED));
        await assert.rejects(() => f.service.change(ticket.id, f.senior, 'claim'));
        const claimed = await Promise.allSettled([f.service.change(ticket.id, f.staff, 'claim'), f.service.change(ticket.id, f.other, 'claim')]);
        assert.equal(claimed.filter(r => r.status === 'fulfilled').length, 1);
        const assigned = f.repo.get(ticket.id)?.claimantId, winner = assigned === users.staff ? f.staff : f.other, loser = assigned === users.staff ? f.other : f.staff;
        assert.ok(f.channels.get(ticket.channelId).name.startsWith('🟢-'));
        await assert.rejects(() => f.service.change(ticket.id, loser, 'unclaim'));
        await f.service.change(ticket.id, winner, 'transfer', { targetId: loser.id });
        assert.equal(f.repo.get(ticket.id)?.claimantId, loser.id);
        await f.service.change(ticket.id, loser, 'unclaim');
        const announcements = f.effects.filter(e => e.payload?.content).map(e => e.payload.content);
        assert.ok(announcements.includes('<@' + winner.id + '> has claimed this ticket.'));
        const control = staffControl(f.service.config, ticket);
        assert.equal((control.components[0].toJSON() as any).components.filter((c: any) => c.type === 1).flatMap((c: any) => c.components).length, 12);
    }
    finally {
        await f.cleanup();
    }
});
test('unrelated roles and reported staff are excluded; administrators cannot be secretly excluded and reports fail closed', async () => {
    const f = await assistanceFixture();
    try {
        const ticket = await f.create('staff_report'), overwrites = f.channels.get(ticket.channelId).overwrites;
        assert.deepEqual(overwrites.filter((o: any) => o.type === 0 && o.allow?.includes(PermissionFlagsBits.ViewChannel)).map((o: any) => o.id), [f.service.category('staff_report').supportRoleId]);
        assert.ok(overwrites.find((o: any) => o.id === users.reported).deny.includes(PermissionFlagsBits.ViewChannel));
        assert.equal(f.service.canManage(ticket, { ...f.reported, roles: [f.service.category('staff_report').supportRoleId] }), false);
        f.members.set(users.owner, { ...f.owner, administrator: true });
        f.answers.staff_report.reported = users.owner;
        await assert.rejects(() => f.create('staff_report', users.other), /administrators cannot be excluded/);
        assert.equal(f.effects.filter(e => e.kind === 'create').length, 1);
    }
    finally {
        await f.cleanup();
    }
});
test('escalation changes parent and access, clears claim, pings only escalation support and removes old team access', async () => {
    const f = await assistanceFixture();
    try {
        const ticket = await f.create();
        await f.service.change(ticket.id, f.staff, 'claim');
        await f.service.change(ticket.id, f.staff, 'escalate', { reason: 'Senior review needed' });
        const current = f.repo.get(ticket.id)!, channel = f.channels.get(ticket.channelId);
        assert.equal(current.category, 'escalated');
        assert.equal(current.claimantId, null);
        assert.equal(channel.parentId, f.service.category('escalated').categoryId);
        assert.ok(channel.name.startsWith('🔵-'));
        assert.ok(!channel.overwrites.some((o: any) => o.id === f.service.category('general').supportRoleId));
        await assert.rejects(() => f.service.change(ticket.id, f.staff, 'claim'));
        await f.service.change(ticket.id, f.senior, 'claim');
        await assert.rejects(() => f.service.change(ticket.id, f.senior, 'escalate', { reason: 'Again' }));
        const ping = f.effects.find(e => e.payload?.content?.includes('has escalated'));
        assert.deepEqual(ping.payload.allowedMentions.roles, [f.service.category('escalated').supportRoleId]);
    }
    finally {
        await f.cleanup();
    }
});
test('member management, confidentiality escalation, priority, rename, response requests, lock and unlock persist', async () => {
    const f = await assistanceFixture();
    try {
        const ticket = await f.create();
        await f.service.change(ticket.id, f.staff, 'add', { targetId: users.outsider });
        assert.ok(f.repo.get(ticket.id)?.addedMembers.includes(users.outsider));
        await f.service.change(ticket.id, f.staff, 'remove', { targetId: users.outsider });
        assert.equal(f.repo.get(ticket.id)?.addedMembers.length, 0);
        await f.service.change(ticket.id, f.staff, 'priority', { value: 'urgent' });
        assert.equal(f.repo.get(ticket.id)?.priority, 'urgent');
        await f.service.change(ticket.id, f.staff, 'rename', { value: 'Special / Request @everyone' });
        assert.ok(f.channels.get(ticket.channelId).name.includes('special-request-everyone'));
        await f.service.change(ticket.id, f.staff, 'lock');
        assert.equal(f.repo.get(ticket.id)?.locked, true);
        await f.service.change(ticket.id, f.staff, 'unlock');
        await f.service.change(ticket.id, f.staff, 'respond', { reason: 'Please provide details' });
        assert.ok(f.channels.get(ticket.channelId).name.startsWith('🟡-'));
        assert.equal(f.repo.get(ticket.id)?.awaitingResponse, true);
        await f.service.message({ guildId: f.config.guildId, channelId: ticket.channelId, author: { id: users.creator }, content: 'Here are the details.' });
        assert.equal(f.repo.get(ticket.id)?.awaitingResponse, false);
        await f.service.change(ticket.id, f.staff, 'escalate', { reason: 'Escalating' });
        await assert.rejects(() => f.service.change(ticket.id, f.senior, 'add', { targetId: users.outsider }));
        await f.service.change(ticket.id, f.owner, 'add', { targetId: users.outsider });
    }
    finally {
        await f.cleanup();
    }
});
test('staff-only close modal is required, creator close is denied and secure closure sends no HTML files to logs or DMs', async () => {
    const f = await assistanceFixture();
    try {
        const ticket = await f.create();
        const denied = f.interaction('na:close:' + ticket.id, users.creator, { channelId: ticket.channelId });
        await f.service.interaction(denied.i);
        assert.ok(JSON.stringify(denied.replies).includes(DENIED));
        const allowed = f.interaction('na:close:' + ticket.id, users.staff, { channelId: ticket.channelId });
        await f.service.interaction(allowed.i);
        assert.equal(allowed.replies[0].toJSON().title, 'Close Ticket');
        await assert.rejects(() => f.service.close(ticket.id, f.staff), /reason/);
        await assert.rejects(() => f.service.close(ticket.id, f.creator, { reason: 'Done' }));
        await f.service.close(ticket.id, f.staff, { reason: 'Resolved safely' });
        const final = f.repo.get(ticket.id)!;
        assert.equal(final.lifecycle, 'CLOSED');
        assert.equal(final.closure.reason, 'Resolved safely');
        const log = f.effects.find(e => e.kind === 'log' && JSON.stringify(e.payload).includes('View Transcript'));
        assert.ok(log);
        assert.equal(log.payload.files, undefined);
        const dm = f.effects.find(e => e.kind === 'dm');
        assert.ok(JSON.stringify(dm.payload.components).includes('Rate Your Experience'));
        assert.ok(!JSON.stringify(dm.payload.components).includes('/tickets/transcripts'));
        assert.ok(dm.payload.files.every((p: any) => !p.name.endsWith('.html')));
        assert.ok(f.effects.findIndex(e => e === log) < f.effects.findIndex(e => e.kind === 'delete'));
        const html = await fs.readFile(final.transcript.parts[0].path, 'utf8');
        assert.ok(html.includes('Resolved safely'));
    }
    finally {
        await f.cleanup();
    }
});
test('unsafe log permissions prevent confidential creation and closure; upload/storage failures preserve channels', async () => {
    const f = await assistanceFixture();
    try {
        f.setPublicLog(true);
        await assert.rejects(() => f.create());
        assert.equal(f.effects.length, 0);
        f.setPublicLog(false);
        const ticket = await f.create();
        const log = f.channels.get(f.config.transcriptChannelId);
        log.permissionOverwrites.cache.set('untrusted', { id: f.config.categories[0].supportRoleId, type: 0, allow: new PermissionsBitField(PermissionFlagsBits.ViewChannel) });
        await assert.rejects(() => f.service.close(ticket.id, f.staff, { reason: 'Done' }));
        assert.ok(f.channels.has(ticket.channelId));
        log.permissionOverwrites.cache.clear();
        f.setFailLog(true);
        await assert.rejects(() => f.service.close(ticket.id, f.staff, { reason: 'Done' }));
        assert.ok(f.channels.has(ticket.channelId));
        f.setFailLog(false);
        f.setBlockedDm(true);
        await f.service.close(ticket.id, f.owner, { retry: true });
        assert.equal(f.repo.get(ticket.id)?.lifecycle, 'CLOSED');
        assert.equal(f.repo.delivery(ticket.id).dm_status, 'blocked');
    }
    finally {
        await f.cleanup();
    }
});
test('ratings are creator-only, closed-only, one per ticket, with optional feedback and saved assigned staff', async () => {
    const f = await assistanceFixture();
    try {
        const ticket = await f.create();
        await assert.rejects(() => f.service.rate(ticket.id, users.creator, 5, ''));
        await f.service.change(ticket.id, f.staff, 'claim');
        await f.service.close(ticket.id, f.staff, { reason: 'Complete' });
        await assert.rejects(() => f.service.rate(ticket.id, users.outsider, 5, ''));
        await f.service.rate(ticket.id, users.creator, 5, 'Helpful staff');
        await assert.rejects(() => f.service.rate(ticket.id, users.creator, 1, 'Again'));
        const rating = f.repo.db.prepare('SELECT * FROM assistance_ratings WHERE ticket_id=?').get(ticket.id) as any;
        assert.equal(rating.score, 5);
        assert.equal(rating.staff_id, users.staff);
        assert.equal(rating.feedback, 'Helpful staff');
    }
    finally {
        await f.cleanup();
    }
});
test('preview transcripts are administrator-only and do not close the ticket; command builders have every requested subcommand', async () => {
    const f = await assistanceFixture();
    try {
        const ticket = await f.create();
        await assert.rejects(() => f.service.generateTranscript(ticket, f.staff));
        const snapshot = await f.service.generateTranscript(ticket, f.owner);
        assert.ok(snapshot.previewTranscript.parts.length);
        assert.equal(snapshot.lifecycle, 'OPEN');
        const main = ticketCommands[0].toJSON();
        assert.deepEqual(main.options?.map((o: any) => o.name).sort(), ['panel', 'control', 'claim', 'unclaim', 'add', 'remove', 'transfer', 'escalate', 'priority', 'close', 'transcript', 'stats', 'config', 'repair'].sort());
        assert.equal(ticketCommands[1].name, 'mytickets');
    }
    finally {
        await f.cleanup();
    }
});
test('interrupted escalation has a durable intent and recovers routing, current-team authority and notification once', async () => {
    const f = await assistanceFixture();
    try {
        const ticket = await f.create(), channel = f.channels.get(ticket.channelId), edit = channel.edit;
        channel.edit = async () => {
            throw Object.assign(Error('temporary failure'), { code: 50013 });
        };
        await assert.rejects(() => f.service.change(ticket.id, f.staff, 'escalate', { reason: 'Requires senior review' }));
        assert.ok(f.repo.get(ticket.id)?.pendingEscalation);
        await assert.rejects(() => f.service.change(ticket.id, f.staff, 'claim'));
        channel.edit = edit;
        await f.service.recover();
        assert.equal(f.repo.get(ticket.id)?.category, 'escalated');
        assert.equal(f.repo.get(ticket.id)?.pendingEscalation, null);
        assert.equal(channel.parentId, f.service.category('escalated').categoryId);
        await f.service.recover();
        assert.equal(f.effects.filter(e => e.payload?.content?.includes('has escalated')).length, 1);
    }
    finally {
        await f.cleanup();
    }
});
test('existing SQLite tickets are repaired and legacy JSON open tickets migrate without losing channels or source records', async () => {
    const f = await assistanceFixture();
    try {
        const channel = f.makeChannel('legacy-channel'), legacy: any = { id: 'old-ticket-1', user: users.creator, channel: channel.id, category: 0, status: 'created', request: 'Existing support inquiry', created: 1000, members: [] };
        (f.service as any).legacyTickets = () => [legacy];
        assert.ok(f.service.activeMessage(users.creator));
        await f.service.recover();
        const migrated = f.repo.byChannel(channel.id)!;
        assert.equal(migrated.legacyTicketId, legacy.id);
        assert.equal(migrated.inquiry, legacy.request);
        assert.equal(migrated.createdAt, 1000);
        assert.equal(migrated.assistanceVersion, 2);
        assert.equal(channel.parentId, f.service.category('general').categoryId);
        assert.equal(legacy.status, 'created');
        await f.service.close(migrated.id, f.staff, { reason: 'Resolved after migration' });
        assert.equal(f.service.activeMessage(users.creator), null);
    }
    finally {
        await f.cleanup();
    }
});
test('each staff modal, response control and rating modal routes through persistent handlers with independent authorization', async () => {
    const f = await assistanceFixture();
    try {
        const ticket = await f.create();
        for (const action of ['close', 'add', 'remove', 'transfer', 'escalate', 'priority', 'rename', 'respond']) {
            const { i, replies } = f.interaction('na:' + action + ':' + ticket.id, users.staff, { channelId: ticket.channelId });
            await f.service.interaction(i);
            const modal = replies[0].toJSON();
            assert.equal(modal.custom_id, `na:action:${ticket.id}:${action}`);
            assert.ok(modal.components.length);
        }
        for (const action of ['lock', 'unlock', 'info', 'answers']) {
            const { i, replies } = f.interaction('na:' + action + ':' + ticket.id + (action === 'answers' ? ':0' : ''), users.staff, { channelId: ticket.channelId });
            await f.service.interaction(i);
            assert.ok(replies.length);
        }
        await f.service.close(ticket.id, f.staff, { reason: 'Complete' });
        const rate = f.interaction('na:rate:' + ticket.id, users.creator, { guildId: null });
        await f.service.interaction(rate.i);
        assert.ok(JSON.stringify(rate.replies).includes('5 / 5'));
        const score = f.interaction('na:score:' + ticket.id + ':5', users.creator, { guildId: null });
        await f.service.interaction(score.i);
        assert.equal(score.replies[0].toJSON().title, 'Rate Your Experience');
    }
    finally {
        await f.cleanup();
    }
});
test('staff slash commands, config, mytickets and statistics enforce their separate permission scopes', async () => {
    const f = await assistanceFixture();
    try {
        const ticket = await f.create();
        const run = async (sub: string, userId: string, values: any = {}, command = 'ticket') => {
            const request = f.interaction('', userId, { commandName: command, channelId: ticket.channelId, isChatInputCommand: () => true, options: { getSubcommand: () => sub, getInteger: () => null, getUser: (key: string) => values[key] ?? null, getString: (key: string) => values[key] ?? null, getRole: (key: string) => values[key] ?? null, getChannel: (key: string) => values[key] ?? null } });
            await f.service.interaction(request.i);
            return request.replies;
        };
        assert.ok(JSON.stringify(await run('control', users.creator)).includes(DENIED));
        assert.ok(JSON.stringify(await run('control', users.staff)).includes('Staff Control Panel'));
        assert.ok(JSON.stringify(await run('stats', users.staff)).includes('General Support'));
        assert.ok(JSON.stringify(await run('config', users.staff)).includes(DENIED));
        assert.ok(JSON.stringify(await run('config', users.owner)).includes('Assistance Configuration'));
        assert.ok(JSON.stringify(await run('', users.creator, {}, 'mytickets')).includes('My Assistance Tickets'));
        await run('claim', users.staff);
        assert.equal(f.repo.get(ticket.id)?.claimantId, users.staff);
        await run('unclaim', users.staff);
        assert.equal(f.repo.get(ticket.id)?.claimantId, null);
    }
    finally {
        await f.cleanup();
    }
});
test('administrator routing changes are persisted and logged even when no ticket is open; missing emojis use text', async () => {
    const f = await assistanceFixture();
    try {
        f.guild.emojis.fetch = async () => new Map();
        const diagnostics = await f.service.diagnose();
        assert.ok(diagnostics.some((line: string) => line.includes('fallback')));
        const roleId = f.service.category('escalated').supportRoleId;
        const request = f.interaction('', users.owner, { commandName: 'ticket', isChatInputCommand: () => true, options: { getSubcommand: () => 'config', getString: (key: string) => key === 'type' ? 'general' : null, getRole: () => ({ id: roleId }), getChannel: () => null } });
        await f.service.interaction(request.i);
        assert.equal(f.service.category('general').supportRoleId, roleId);
        assert.ok(JSON.stringify(f.repo.db.prepare("SELECT data FROM assistance_settings WHERE key='route:general'").get()).includes(roleId));
        assert.ok(f.effects.some(e => e.kind === 'log' && JSON.stringify(e.payload).includes('Assistance Configuration Changed')));
    }
    finally {
        await f.cleanup();
    }
});
test('deleted legacy channels preserve error metadata without permanently preventing a member from opening support', async () => {
    const f = await assistanceFixture();
    try {
        (f.service as any).legacyTickets = () => [{ id: 'deleted-legacy', user: users.creator, channel: 'deleted-channel', status: 'created', category: 0, request: 'Historical request' }];
        await f.service.recover();
        assert.equal(f.service.activeMessage(users.creator), null);
        const old = f.repo.byChannel('deleted-channel')!;
        assert.equal(old.lifecycle, 'ERROR');
        assert.equal(old.active, false);
        assert.equal(old.historyUnavailable, true);
        assert.equal((await f.create()).lifecycle, 'OPEN');
    }
    finally {
        await f.cleanup();
    }
});
test('feedback modal submission stores a rating, rejects replay, and creators with staff roles still cannot close their own tickets', async () => {
    const f = await assistanceFixture();
    try {
        const ticket = await f.create();
        await assert.rejects(() => f.service.close(ticket.id, { ...f.creator, roles: f.staff.roles }, { reason: 'Own ticket' }));
        await f.service.close(ticket.id, f.staff, { reason: 'Complete' });
        const request = f.interaction('na:feedback:' + ticket.id + ':4', users.creator, { guildId: null, isModalSubmit: () => true, fields: { getTextInputValue: () => 'Good assistance' } });
        await f.service.interaction(request.i);
        assert.equal((f.repo.db.prepare('SELECT score FROM assistance_ratings WHERE ticket_id=?').get(ticket.id) as any).score, 4);
        await f.service.interaction(request.i);
        assert.ok(JSON.stringify(request.replies.at(-1)).includes('already rated'));
    }
    finally {
        await f.cleanup();
    }
});
