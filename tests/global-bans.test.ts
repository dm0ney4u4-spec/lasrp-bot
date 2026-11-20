import test from 'node:test';
import assert from 'node:assert/strict';
import { Collection, MessageFlags } from 'discord.js';
import { GlobalBans, parseGlobalBan, globalBanDm } from '../apps/bot/src/global-bans.js';
import { globalBanConfig } from '../config/global-bans.js';
const actorId = '111111111111111111', targetId = '222222222222222222', botId = '333333333333333333';
function fixture() {
    const events: any[] = [], records: any = {}, guilds = new Map<string, any>(), replies: any[] = [];
    let role = true, blockedDm = false, failLog = false, failEdit = false, saves = 0;
    const log: any = { isTextBased: () => true, permissionsFor: () => ({ has: () => true }), send: async (payload: any) => {
            if (failLog)
                throw Object.assign(Error('Unavailable'), { code: 50013 });
            events.push({ kind: 'log', payload });
            return { id: '555555555555555555', edit: async (value: any) => {
                    if (failEdit)
                        throw Object.assign(Error('missing'), { code: 10008 });
                    events.push({ kind: 'logEdit', payload: value });
                } };
        } };
    for (const entry of globalBanConfig.guilds) {
        const guild: any = { id: entry.id, ownerId: 'other', roles: { fetch: async () => ({ id: globalBanConfig.executorRoleId }) }, channels: { fetch: async () => log }, members: { fetchMe: async () => ({ permissions: { has: () => true } }), fetch: async (options: any) => {
                    assert.equal(options.force, true);
                    return { roles: { cache: new Collection(role ? [[globalBanConfig.executorRoleId, {}]] : []) } };
                }, ban: async (id: string, options: any) => {
                    events.push({ kind: 'ban', guildId: entry.id, id, options });
                } } };
        guilds.set(entry.id, guild);
    }
    const client: any = { user: { id: botId }, guilds: { fetch: async (id: string) => {
                if (!guilds.has(id))
                    throw Object.assign(Error('not found'), { code: 50001 });
                return guilds.get(id);
            } }, users: { fetch: async (id: string) => ({ id, send: async (payload: any) => {
                    events.push({ kind: 'dmAttempt', payload });
                    if (blockedDm)
                        throw Object.assign(Error('blocked'), { code: 50007 });
                    events.push({ kind: 'dm', payload });
                } }) } };
    const store: any = { guild: (id: string) => {
            assert.equal(id, globalBanConfig.mainGuildId);
            return { records };
        }, save: () => {
            saves++;
        }, flush: async () => {
        } };
    const handler = new GlobalBans(client, store), message: any = { id: '444444444444444444', guildId: globalBanConfig.mainGuildId, author: { id: actorId, bot: false }, content: `-gb <@${targetId}> Serious rule violation`, reply: async (payload: any) => {
            replies.push(payload);
        } };
    return { handler, message, events, records, guilds, client, store, replies, setRole: (value: boolean) => {
            role = value;
        }, blockDm: () => {
            blockedDm = true;
        }, failLog: () => {
            failLog = true;
        }, failEdit: () => {
            failEdit = true;
        }, saveCount: () => saves };
}
test('global-ban parser accepts mentions and IDs, requires a reason and rejects ambiguous usernames', () => {
    assert.deepEqual(parseGlobalBan(`-gb <@!${targetId}> Rule violation`), { targetId, reason: 'Rule violation' });
    assert.deepEqual(parseGlobalBan(`-GB ${targetId} Multiple word reason`), { targetId, reason: 'Multiple word reason' });
    for (const content of ['-gb', '-gb ' + targetId, '-gb username reason', '-gb <@&' + targetId + '> reason'])
        assert.throws(() => parseGlobalBan(content));
    assert.equal(parseGlobalBan('-gbother'), null);
});
test('main-server role is mandatory for ordinary members; wrong guild, bots and webhooks cannot ban', async () => {
    const f = fixture();
    f.setRole(false);
    await f.handler.message(f.message);
    assert.equal(f.events.length, 0);
    assert.ok(JSON.stringify(f.replies).includes('Global Ban role'));
    f.setRole(true);
    await f.handler.message({ ...f.message, guildId: globalBanConfig.guilds[1].id });
    assert.equal(f.events.length, 0);
    assert.equal(await f.handler.message({ ...f.message, author: { id: actorId, bot: true } }), false);
    assert.equal(await f.handler.message({ ...f.message, webhookId: 'webhook' }), false);
    assert.equal(await f.handler.message({ ...f.message, guildId: null }), false);
});
test('configured bot owner can authorize global bans without the executor role, only in the main guild',async()=>{
    const f=fixture();f.setRole(false);
    await assert.doesNotReject(()=>f.handler.authorize({...f.message,author:{id:'1425577335637413961'}}));
    await assert.rejects(()=>f.handler.authorize({...f.message,guildId:'other',author:{id:'1425577335637413961'}}),/main NYC/);
    await assert.rejects(()=>f.handler.authorize(f.message),/Global Ban role/);
});
test('authorized global ban DMs screenshot-style text, bans exactly the five configured servers and logs all results', async () => {
    const f = fixture();
    await f.handler.message(f.message);
    const bans = f.events.filter(e => e.kind === 'ban');
    assert.deepEqual(bans.map(e => e.guildId), globalBanConfig.guilds.map(g => g.id));
    assert.ok(bans.every(e => e.id === targetId && e.options.reason.includes(actorId) && e.options.reason.includes('Serious rule violation') && e.options.deleteMessageSeconds === 0));
    const dm = f.events.find(e => e.kind === 'dm');
    assert.equal(dm.payload.content, 'You have been **Globally Banned** from **New York City Roleplay**\nReason: `Serious rule violation`');
    assert.deepEqual(dm.payload.allowedMentions.parse, []);
    assert.ok(f.events.findIndex(e => e.kind === 'dm') < f.events.findIndex(e => e.kind === 'ban'));
    const record = f.records['global-ban:' + f.message.id];
    assert.equal(record.status, 'completed');
    assert.equal(record.dmStatus, 'sent');
    assert.equal(record.logStatus, 'updated');
    assert.ok(f.saveCount() >= 8);
    const log = f.events.find(e => e.kind === 'logEdit');
    assert.ok(Number(log.payload.flags) & MessageFlags.IsComponentsV2);
    assert.ok(JSON.stringify(log.payload).includes('Serious rule violation'));
    assert.ok(JSON.stringify(f.replies).includes('5/5'));
    assert.deepEqual(log.payload.allowedMentions.parse, []);
});
test('missing guilds and hierarchy failures are reported independently without cancelling the other bans', async () => {
    const f = fixture();
    f.guilds.delete(globalBanConfig.guilds[1].id);
    f.guilds.get(globalBanConfig.guilds[2].id).members.ban = async () => {
        throw Object.assign(Error('hierarchy'), { code: 50013 });
    };
    await f.handler.message(f.message);
    const record = f.records['global-ban:' + f.message.id];
    assert.equal(record.status, 'partial');
    assert.equal(record.results.filter((r: any) => r.status === 'banned').length, 3);
    assert.equal(record.results.filter((r: any) => r.status === 'failed').length, 2);
    assert.ok(JSON.stringify(f.replies).includes('3/5'));
    assert.ok(JSON.stringify(f.events.find(e => e.kind === 'logEdit').payload).includes('role hierarchy'));
});
test('blocked DMs do not cancel bans; inaccessible log prevents every ban', async () => {
    const f = fixture();
    f.blockDm();
    await f.handler.message(f.message);
    assert.equal(f.events.filter(e => e.kind === 'ban').length, 5);
    assert.equal(f.records['global-ban:' + f.message.id].dmStatus, 'blocked');
    const g = fixture();
    g.failLog();
    await g.handler.message(g.message);
    assert.equal(g.events.filter(e => e.kind === 'ban' || e.kind === 'dmAttempt').length, 0);
});
test('duplicate gateway messages and concurrent commands do not repeat an active global ban', async () => {
    const f = fixture();
    await f.handler.message(f.message);
    await f.handler.message(f.message);
    assert.equal(f.events.filter(e => e.kind === 'ban').length, 5);
    assert.equal(f.events.filter(e => e.kind === 'dmAttempt').length, 1);
    const g = fixture();
    await Promise.all([g.handler.message(g.message), g.handler.message({ ...g.message, id: '666666666666666666' })]);
    assert.equal(g.events.filter(e => e.kind === 'ban').length, 5);
    assert.equal(g.events.filter(e => e.kind === 'dmAttempt').length, 1);
});
test('self/bot targets, missing/oversized reasons, missing Ban Members and guild owners are handled safely', async () => {
    for (const target of [actorId, botId]) {
        const f = fixture();
        await f.handler.message({ ...f.message, content: `-gb ${target} Reason` });
        assert.equal(f.events.length, 0);
    }
    for (const content of ['-gb ' + targetId, '-gb ' + targetId + ' ' + 'x'.repeat(1001)]) {
        const f = fixture();
        await f.handler.message({ ...f.message, content });
        assert.equal(f.events.length, 0);
    }
    const f = fixture();
    for (const guild of f.guilds.values())
        guild.members.fetchMe = async () => ({ permissions: { has: () => false } });
    await f.handler.message(f.message);
    assert.equal(f.events.filter(e => e.kind === 'ban' || e.kind === 'dmAttempt').length, 0);
    const g = fixture();
    for (const guild of g.guilds.values())
        guild.ownerId = targetId;
    await g.handler.message(g.message);
    assert.equal(g.events.filter(e => e.kind === 'ban' || e.kind === 'dmAttempt').length, 0);
});
test('DM reasons cannot break inline code or trigger mentions; log update failures retain durable outcomes', async () => {
    const dm = globalBanDm('bad `code`\n@everyone');
    assert.ok(!dm.content.includes('bad `code`'));
    assert.deepEqual(dm.allowedMentions.parse, []);
    const f = fixture();
    f.failEdit();
    await f.handler.message(f.message);
    const record = f.records['global-ban:' + f.message.id];
    assert.equal(record.status, 'completed');
    assert.equal(record.logStatus, 'update_failed');
    assert.ok(JSON.stringify(f.replies).includes('complete result is saved'));
});
test('read-only diagnostics verify configuration without issuing bans or DMs', async () => {
    const f = fixture();
    const result = await f.handler.diagnose();
    assert.equal(result.length, 5);
    assert.ok(result.every((r: any) => r.available));
    assert.equal(f.events.length, 0);
});
