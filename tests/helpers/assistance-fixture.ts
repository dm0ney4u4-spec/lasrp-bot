import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Collection, ChannelType, PermissionsBitField } from 'discord.js';
import { AssistanceSystem } from '../../apps/bot/src/ticket-system/assistance.js';
import { TicketRepository } from '../../apps/bot/src/ticket-system/database.js';
import { ticketConfig } from '../../config/tickets.js';
export const users = { owner: '100000000000000001', creator: '100000000000000002', staff: '100000000000000003', other: '100000000000000004', senior: '100000000000000005', reported: '100000000000000006', outsider: '100000000000000007', bot: '100000000000000009' };
export async function assistanceFixture() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nycrp-assistance-')), config = { ...structuredClone(ticketConfig), databasePath: path.join(directory, 'tickets.sqlite'), transcriptDirectory: path.join(directory, 'transcripts'), renameTimeoutMs: 100 };
    const repo = new TicketRepository(config.databasePath), channels = new Collection<string, any>(), members = new Map<string, any>(), roles = new Collection<string, any>(), effects: any[] = [], timers: any[] = [];
    let serial = 0, time = Date.now(), failLog = false, blockedDm = false, failDelete = false, publicLog = false;
    const actor = (id: string, roleIds: string[] = [], admin = false) => ({ id, roles: roleIds, administrator: admin, username: 'user-' + id.slice(-2) });
    const owner = actor(users.owner, [], true), creator = actor(users.creator), staff = actor(users.staff, [config.categories[0].supportRoleId]), other = actor(users.other, [config.categories[0].supportRoleId]), senior = actor(users.senior, [config.categories[4].supportRoleId]), reported = actor(users.reported, [config.categories[0].supportRoleId]);
    for (const member of [owner, creator, staff, other, senior, reported, actor(users.outsider)])
        members.set(member.id, member);
    for (const c of [...config.categories, ...config.legacyCategories])
        roles.set(c.supportRoleId, { id: c.supportRoleId, mentionable: false, permissions: new PermissionsBitField(0n) });
    const makeChannel = (id: string, type = ChannelType.GuildText) => {
        const messages = new Collection<string, any>();
        const channel: any = { id, type, name: id, topic: null, parentId: null, isTextBased: () => true, permissionsFor: (who: any) => ({ has: () => who.id === config.guildId ? publicLog : true }), permissionOverwrites: { cache: new Collection(), set: async (overwrites: any) => {
                    channel.overwrites = overwrites;
                }, edit: async () => {
                } }, edit: async (options: any) => {
                Object.assign(channel, { parentId: options.parent });
                channel.overwrites = options.permissionOverwrites;
                return channel;
            }, messages: { fetch: async (arg: any) => {
                    if (typeof arg === 'string') {
                        const message = messages.get(arg);
                        if (!message)
                            throw Object.assign(Error('missing'), { code: 10008 });
                        return message;
                    }
                    const list = [...messages.values()].sort((a, b) => Number(b.id) - Number(a.id)).filter(m => !arg.before || BigInt(m.id) < BigInt(arg.before)).slice(0, arg.limit);
                    return new Collection(list.map(m => [m.id, m]));
                } }, send: async (payload: any) => {
                if (id === config.transcriptChannelId && failLog)
                    throw Object.assign(Error('log unavailable'), { code: 50013 });
                const message: any = { id: String(++serial), content: payload.content ?? '', components: payload.components ?? [], attachments: new Collection(), embeds: [], createdTimestamp: time, nonce: payload.nonce, pinned: false, author: { id: users.bot, username: 'New York Automation' }, url: 'https://discord.com/channels/' + config.guildId + '/' + id + '/' + serial, edit: async (p: any) => {
                        Object.assign(message, { components: p.components, content: p.content ?? '', payload: p });
                        return message;
                    }, delete: async () => messages.delete(message.id), pin: async () => {
                        message.pinned = true;
                        return message;
                    } };
                messages.set(message.id, message);
                effects.push({ kind: id === config.transcriptChannelId ? 'log' : 'send', channelId: id, payload, message });
                return message;
            }, delete: async () => {
                if (failDelete)
                    throw Object.assign(Error('delete denied'), { code: 50013 });
                effects.push({ kind: 'delete', channelId: id });
                channels.delete(id);
            } };
        channels.set(id, channel);
        return channel;
    };
    const guild: any = { id: config.guildId, ownerId: users.owner, roles: { everyone: { id: config.guildId }, cache: roles, fetch: async (id: string) => roles.get(id) ?? null }, emojis: { fetch: async () => new Collection(Object.entries(config.emojiIds).map(([key, id]) => [id, { id, name: 'actual_' + key, animated: false }])) }, channels: { fetch: async (id?: string) => id ? channels.get(id) ?? null : channels, create: async (options: any) => {
                const channel = makeChannel('channel-' + (++serial));
                Object.assign(channel, { name: options.name, topic: options.topic, parentId: options.parent, overwrites: options.permissionOverwrites });
                effects.push({ kind: 'create', options });
                return channel;
            } }, members: { fetchMe: async () => ({ id: users.bot, permissions: new PermissionsBitField(8n) }), fetch: async (options: any) => {
                if (options.query)
                    return new Collection([...members.values()].filter(m => m.username === options.query).map(m => [m.id, toMember(m)]));
                const userId = typeof options === 'string' ? options : options.user;
                const value = members.get(userId);
                if (!value)
                    throw Object.assign(Error('missing member'), { code: 10007 });
                return toMember(value);
            } } };
    function toMember(value: any) {
        return { id: value.id, guild, user: { username: value.username }, displayName: value.username, roles: { cache: new Collection(value.roles.map((id: string) => [id, roles.get(id)])) }, permissions: new PermissionsBitField(value.administrator ? 8n : 0n) };
    }
    for (const c of [...config.categories, ...config.legacyCategories])
        makeChannel(c.categoryId, ChannelType.GuildCategory);
    makeChannel(config.panelChannelId);
    makeChannel(config.transcriptChannelId);
    const client: any = { user: { id: users.bot }, options: { intents: { has: () => true } }, guilds: { fetch: async () => guild }, rest: { patch: async (route: string, { body }: any) => {
                const channel = channels.get(route.split('/').at(-1)!);
                if (channel)
                    channel.name = body.name;
            } }, users: { fetch: async (id: string) => ({ id, send: async (payload: any) => {
                    effects.push({ kind: 'dmAttempt', payload });
                    if (blockedDm)
                        throw Object.assign(Error('blocked'), { code: 50007 });
                    effects.push({ kind: 'dm', payload });
                    return { id: String(++serial) };
                } }) } };
    const service = new AssistanceSystem(client, config, repo as any, { clock: () => time, schedule: (callback: any, delay: number) => {
            const timer = { callback, delay, unref: () => {
                } };
            timers.push(timer);
            return timer;
        }, lookupRoblox: async () => ({ username: 'LinkedExample', robloxId: '12345', createdAt: '2020-01-02T00:00:00Z' }) } as any);
    const answers: any = { general: { reason: 'I need help with a player report.' }, staff_report: { reported: users.reported, incident: 'A staff member mishandled this scene.', when: 'Yesterday at 3 PM', evidence: 'https://example.com/evidence' }, purchase: { product: 'Marketplace pack', roblox: 'SubmittedExample', reference: 'ORDER-123', additional: 'Please review the order.' }, appeal: { roblox: 'SubmittedExample', punishment: 'Server ban', reason: 'Please review the supporting evidence.', evidence: 'Evidence reference' } };
    const create = (type = 'general', userId = users.creator) => service.create(type, { id: userId, username: 'Example_User', createdTimestamp: 1000 }, answers[type]);
    const interaction = (customId: string, userId = users.creator, extra: any = {}) => {
        const replies: any[] = [];
        const i: any = { customId, guildId: config.guildId, user: { id: userId, username: 'Example_User', createdTimestamp: 1000 }, channelId: config.panelChannelId, member: toMember(members.get(userId)), isChatInputCommand: () => false, isModalSubmit: () => false, deferred: false, replied: false, deferReply: async () => {
                i.deferred = true;
            }, reply: async (payload: any) => {
                i.replied = true;
                replies.push(payload);
            }, editReply: async (payload: any) => {
                replies.push(payload);
            }, showModal: async (payload: any) => {
                replies.push(payload);
            }, ...extra };
        return { i, replies };
    };
    return { service, repo, config, client, guild, channels, members, roles, effects, owner, creator, staff, other, senior, reported, makeChannel, answers, create, interaction, timers, directory, advance: (ms: number) => {
            time += ms;
        }, setPublicLog: (value: boolean) => {
            publicLog = value;
        }, setFailLog: (value: boolean) => {
            failLog = value;
        }, setBlockedDm: (value: boolean) => {
            blockedDm = value;
        }, setFailDelete: (value: boolean) => {
            failDelete = value;
        }, cleanup: async () => {
            await service.stop();
            await fs.rm(directory, { recursive: true, force: true });
        } };
}
