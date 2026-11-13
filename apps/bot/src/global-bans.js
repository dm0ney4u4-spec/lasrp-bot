import { MessageFlags, ContainerBuilder, TextDisplayBuilder, PermissionFlagsBits, escapeMarkdown } from 'discord.js';
import { globalBanConfig } from '../../../config/global-bans.js';
class BanError extends Error {
}
const errorCode = error => String(error?.code ?? error?.name ?? 'UNKNOWN');
const errorLabel = error => ({ 50001: 'Bot is not in this server or cannot access it', 50013: 'Missing permissions or role hierarchy prevents banning', 10004: 'Server unavailable', 10013: 'User unavailable' }[Number(error?.code)] ?? 'Discord request failed (' + errorCode(error) + ')');
function panel(title, body) {
    return { components: [new ContainerBuilder().setAccentColor(0x279bd3).addTextDisplayComponents(new TextDisplayBuilder().setContent('## ' + title), new TextDisplayBuilder().setContent(body))], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [], repliedUser: false } };
}
export function parseGlobalBan(content) {
    const match = /^-gb(?:\s+([\s\S]*))?$/i.exec(content ?? '');
    if (!match)
        return null;
    const args = /^(?:<@!?(\d{17,20})>|(\d{17,20}))\s+([\s\S]+)$/.exec((match[1] ?? '').trim());
    if (!args)
        throw new BanError('Usage: -gb @user reason (or -gb user-ID reason). A reason is required.');
    return { targetId: args[1] ?? args[2], reason: args[3].trim() };
}
export function globalBanDm(reason) {
    return { content: 'You have been **Globally Banned** from **New York City Roleplay**\nReason: `' + reason.replaceAll('`', 'ˋ').replace(/[\r\n]+/g, ' ') + '`', allowedMentions: { parse: [] } };
}
export function globalBanLog(record) {
    const results = record.results.map(row => `**${row.name}:** ${row.status === 'banned' ? 'Banned' : row.status === 'already_banned' ? 'Already banned' : row.status === 'pending' ? 'Pending' : row.detail ?? 'Failed'}`).join('\n');
    return panel(record.status === 'running' ? 'Global ban in progress' : 'Global ban results', `**Target:** <@${record.targetId}> (${record.targetId})\n**Moderator:** <@${record.actorId}> (${record.actorId})\n**Reason:** ${escapeMarkdown(record.reason)}\n**Command:** ${record.messageId}\n\n${results}\n\n**Target DM:** ${record.dmStatus}\n**Recorded:** <t:${Math.floor(record.createdAt / 1000)}:f>`);
}
export class GlobalBans {
    constructor(client, store, config = globalBanConfig) {
        this.client = client;
        this.store = store;
        this.config = config;
        this.targets = new Set();
        this.running = new Set();
        this.stopping = false;
    }
    log(event, error) {
        console.error(JSON.stringify({ system: 'global-bans', event, code: errorCode(error) }));
    }
    async mainGuild() {
        return this.client.guilds.fetch(this.config.mainGuildId);
    }
    async authorize(message) {
        if (message.guildId !== this.config.mainGuildId)
            throw new BanError('This command can only be used in the main NYC server.');
        const member = await (await this.mainGuild()).members.fetch({ user: message.author.id, force: true });
        if (!member.roles.cache.has(this.config.executorRoleId))
            throw new BanError('You need the configured Global Ban role in the main NYC server to use this command.');
    }
    async save(record) {
        this.store.guild(this.config.mainGuildId).records['global-ban:' + record.messageId] = record;
        this.store.save();
        await this.store.flush();
    }
    async diagnose() {
        const results = [];
        const main = await this.mainGuild();
        if (!await main.roles.fetch(this.config.executorRoleId))
            throw new BanError('The configured executor role was not found in the main server.');
        const log = await main.channels.fetch(this.config.logChannelId), me = await main.members.fetchMe();
        if (!log?.isTextBased() || typeof log.send !== 'function' || !log.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]))
            throw new BanError('The bot cannot send to the configured global ban log channel.');
        for (const entry of this.config.guilds) {
            try {
                const guild = await this.client.guilds.fetch(entry.id), bot = await guild.members.fetchMe();
                results.push({ ...entry, available: bot.permissions.has(PermissionFlagsBits.BanMembers), detail: bot.permissions.has(PermissionFlagsBits.BanMembers) ? 'Bot has Ban Members' : 'Bot lacks Ban Members' });
            }
            catch (error) {
                results.push({ ...entry, available: false, detail: errorLabel(error) });
            }
        }
        return results;
    }
    async execute(message, input) {
        await this.authorize(message);
        if (!input.reason || input.reason.length > this.config.maxReasonLength)
            throw new BanError('A reason between 1 and ' + this.config.maxReasonLength + ' characters is required.');
        if ([message.author.id, this.client.user.id].includes(input.targetId))
            throw new BanError('You cannot globally ban yourself or this bot.');
        const existing = this.store.guild(this.config.mainGuildId).records['global-ban:' + message.id];
        if (existing)
            return existing;
        if (this.targets.has(input.targetId))
            throw new BanError('A global ban for this user is already in progress.');
        this.targets.add(input.targetId);
        try {
            const user = await this.client.users.fetch(input.targetId), main = await this.mainGuild(), log = await main.channels.fetch(this.config.logChannelId), me = await main.members.fetchMe();
            if (!log?.isTextBased() || typeof log.send !== 'function' || !log.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]))
                throw new BanError('The global ban log is unavailable. No bans were attempted.');
            const record = { messageId: message.id, actorId: message.author.id, targetId: input.targetId, reason: input.reason, createdAt: Date.now(), status: 'running', dmStatus: 'not_attempted', logMessageId: null, results: this.config.guilds.map(g => ({ ...g, status: 'pending' })) };
            await this.save(record);
            const logMessage = await log.send({ ...globalBanLog(record), nonce: message.id, enforceNonce: true });
            record.logMessageId = logMessage.id;
            await this.save(record);
            // Preflight every server independently; a missing department bot must not cancel other bans.
            const plans = [];
            for (const row of record.results) {
                try {
                    const guild = await this.client.guilds.fetch(row.id), bot = await guild.members.fetchMe();
                    if (!bot.permissions.has(PermissionFlagsBits.BanMembers))
                        throw Object.assign(new Error(), { code: 50013 });
                    if (guild.ownerId === input.targetId)
                        throw Object.assign(new Error(), { code: 50013 });
                    plans.push({ guild, row });
                }
                catch (error) {
                    Object.assign(row, { status: 'failed', detail: errorLabel(error), code: errorCode(error) });
                }
            }
            // Notify before bans remove mutual-server DM eligibility. A blocked DM never cancels moderation.
            if (plans.length) {
                record.dmStatus = 'sending';
                await this.save(record);
                try {
                    await user.send(globalBanDm(input.reason));
                    record.dmStatus = 'sent';
                }
                catch (error) {
                    record.dmStatus = Number(error.code) === 50007 ? 'blocked' : 'failed';
                    record.dmCode = errorCode(error);
                }
                await this.save(record);
            }
            for (const { guild, row } of plans) {
                row.status = 'attempting';
                await this.save(record);
                try {
                    await guild.members.ban(input.targetId, { reason: `Global ban | Moderator ${record.actorId} | ${input.reason.slice(0, 400)}`, deleteMessageSeconds: 0 });
                    row.status = 'banned';
                }
                catch (error) {
                    Object.assign(row, { status: 'failed', detail: errorLabel(error), code: errorCode(error) });
                }
                await this.save(record);
            }
            record.status = record.results.every(r => r.status === 'banned') ? 'completed' : record.results.some(r => r.status === 'banned') ? 'partial' : 'failed';
            record.finishedAt = Date.now();
            await this.save(record);
            try {
                await logMessage.edit(globalBanLog(record));
                record.logStatus = 'updated';
            }
            catch (error) {
                record.logStatus = 'update_failed';
                this.log('final_log_update_failed', error);
            }
            await this.save(record);
            return record;
        }
        finally {
            this.targets.delete(input.targetId);
        }
    }
    async message(message) {
        if (this.stopping || message.author?.bot || message.webhookId || !message.guildId || !/^-(?:gb)(?:\s|$)/i.test(message.content ?? ''))
            return false;
        const task = (async () => {
            try {
                await this.authorize(message);
                const input = parseGlobalBan(message.content), record = await this.execute(message, input);
                const success = record.results.filter(r => r.status === 'banned').length;
                const failures = record.results.filter(r => r.status === 'failed').map(r => r.name + ': ' + r.detail).join('\n');
                await message.reply(panel(record.status === 'completed' ? 'Global ban completed' : 'Global ban ' + record.status, `**Target:** <@${record.targetId}>\n**Banned:** ${success}/${this.config.guilds.length} servers\n**Target DM:** ${record.dmStatus}\n${record.logMessageId ? `**Log:** https://discord.com/channels/${this.config.mainGuildId}/${this.config.logChannelId}/${record.logMessageId}` : ''}${failures ? '\n\n' + failures : ''}${record.logStatus === 'update_failed' ? '\nThe final log update failed; the complete result is saved in the database.' : ''}`));
            }
            catch (error) {
                this.log('command_failed', error);
                try {
                    await message.reply(panel('Global ban needs attention', error instanceof BanError ? error.message : 'The operation could not finish. Check the moderation log; completed bans are not automatically reversed.'));
                }
                catch (replyError) {
                    this.log('reply_failed', replyError);
                }
            }
        })();
        this.running.add(task);
        try {
            await task;
        }
        finally {
            this.running.delete(task);
        }
        return true;
    }
    async stop() {
        this.stopping = true;
        await Promise.allSettled([...this.running]);
    }
}
