import { randomUUID, createHash } from 'node:crypto';
import { PermissionFlagsBits } from 'discord.js';
import { db } from '../../../../packages/shared/src/database.js';
import { sessionConfig } from '../../../../config/sessions.js';
import { SessionRepository } from './repository.js';
import { initialState, label } from './model.js';
import { sessionPresence } from './presence.js';
import { isBotOwner } from '../owner-access.js';
import { serverInfo, panelView, voteView, announcement, logView, layout, row, button, safe, statistics } from './views.js';
export { sessionCommands } from './commands.js';
const missing = error => error?.code === 10008;
export class Sessions {
  constructor(client, service, erlc, config = sessionConfig, repository = new SessionRepository(db, config)) {
    Object.assign(this, { client, service, erlc, config, repository }); this.ready = null; this.tail = Promise.resolve(); this.stopped = false; this.notificationLocks = new Set(); this.artworkRefreshed = new Set();
  }
  serialize(fn) { const next = this.tail.then(fn); this.tail = next.catch(() => {}); return next; }
  async initialize() {
    if (!this.ready) this.ready = (async () => {
      const seed = initialState(), g = this.service.store.guild(this.config.guildId);
      if (await this.repository.read()) return;
      const legacyPanel = g.records.liveSessionPanel;
      if (legacyPanel?.channel === this.config.channels.permanentPanel) seed.panel = { channelId: legacyPanel.channel, messageId: legacyPanel.message };
      const active = await db.session.findUnique({ where: { activeKey: this.config.guildId } });
      if (active?.status === 'active') { seed.mode = 'ONLINE'; seed.current = { id: active.id, hostId: active.hostId, startedAt: active.startedAt.getTime(), endedAt: null, endedBy: null }; }
      else if (active) await db.session.update({ where: { id: active.id }, data: { activeKey: null, status: active.status === 'ending' ? 'ended' : 'failed', endedAt: active.endedAt || new Date(), reason: active.reason || 'Interrupted legacy session recovered during session upgrade' } });
      const old = Object.values(g.votes).find(v => !v.closed && v.end > Date.now());
      if (!seed.current && old) { seed.mode = 'VOTING'; seed.vote = { id: old.id, hostId: old.host, threshold: old.threshold, voters: Object.entries(old.ballots || {}).filter(([, value]) => value === 'yes').map(([id]) => id), createdAt: Date.now(), closed: false, notified: Boolean(old.notified), messageId: old.message }; }
      await this.repository.initialize(seed);
      for (const v of Object.values(g.votes)) if (!v.closed) { v.closed = true; v.migratedToSessionHub = true; }
      this.service.store.save(); await this.service.store.flush();
    })().catch(error => { this.ready = null; throw error; });
    return this.ready;
  }
  async channel(id) { const guild = await this.client.guilds.fetch(this.config.guildId); const channel = await guild.channels.fetch(id); if (!channel?.isTextBased() || !channel.send) throw Error('Configured session channel is unavailable.'); return channel; }
  async staff(userId, guildId) {
    if (guildId !== this.config.guildId) throw Error('Session management is only available in the main NYC server.');
    const guild = await this.client.guilds.fetch(this.config.guildId), member = await guild.members.fetch({ user: userId, force: true });
    if (isBotOwner(userId)) return member;
    if (!this.config.roles.sessionStaff.some(id => member.roles.cache.has(id))) throw Error('The configured Session Staff role is required.');
    return member;
  }
  async recoverMessage(channel, key, since) {
    let before;
    for (;;) {
      const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      for (const message of batch.values()) {
        if (message.author.id !== this.client.user.id) continue;
        if (message.attachments.some(a => a.name?.includes(key)) || JSON.stringify(message.components.map(c => c.toJSON())).includes(key)) return message;
      }
      if (!batch.size || batch.size < 100 || batch.last().createdTimestamp < since - 60000) return null;
      before = batch.last().id;
    }
  }
  async deliver(event, type, payload) {
    const channel = await this.channel(type === 'announcement' ? this.config.channels.announcements : this.config.channels.sessionLogs);
    const field = type === 'announcement' ? 'announcementMessageId' : 'logMessageId';
    if (event[field]) {
      if (event.kind === 'start' && type === 'announcement') await db.session.update({ where: { id: event.data.sessionId }, data: { channelId: channel.id, messageId: event[field] } });
      return;
    }
    const recovered = await this.recoverMessage(channel, event.kind === 'vote' ? event.data.voteId : event.id, new Date(event.createdAt).getTime());
    const message = recovered || await channel.send({ ...payload, nonce: createHash('sha256').update(event.id + type).digest('hex').slice(0, 24), enforceNonce: true });
    await this.repository.receipt(event.id, type, message.id); event[field] = message.id;
    if (event.kind === 'start' && type === 'announcement') await db.session.update({ where: { id: event.data.sessionId }, data: { channelId: channel.id, messageId: message.id } });
  }
  async editMessage(message, payload) {
    // Discord V2 media lives in components, not necessarily message.attachments.
    // Reuse returned CDN references on routine edits; upload fresh artwork once per restart.
    let reuse = false;
    if (this.artworkRefreshed.has(message.id) && payload.files.length) {
      const urls = JSON.stringify(message.components.map(c => c.toJSON())).match(/https:\/\/cdn\.discordapp\.com\/attachments\/[^"\s]+/g) || [];
      const replacements = new Map(payload.files.map(f => [f.name, urls.find(url => url.split('?')[0].endsWith('/' + f.name))]));
      if ([...replacements.values()].every(Boolean)) {
        const components = JSON.parse(JSON.stringify(payload.components), (key, value) => typeof value === 'string' && value.startsWith('attachment://') ? replacements.get(value.slice(13)) || value : value);
        // Omit BOTH fields. An empty files/attachments array deletes the media
        // backing these CDN URLs, even when V2 hides it from message.attachments.
        payload = { ...payload, components, files: undefined };
        reuse = true;
      }
    }
    const result = await message.edit(reuse ? payload : { ...payload, attachments: [] });
    this.artworkRefreshed.add(message.id); return result;
  }
  async flush() {
    const pending = await this.repository.pending();
    for (const event of pending) {
      let state = await this.repository.read();
      if (['vote', 'start', 'low', 'shutdown', 'threshold', 'cancel'].includes(event.kind)) {
        // A vote announcement must retain its own snapshot even if delivery was interrupted and another action followed.
        if (event.kind === 'vote' && state.vote?.id !== event.data.voteId) { const old = state.voteHistory.find(v => v.id === event.data.voteId); if (old) state = { ...state, vote: old }; }
        await this.deliver(event, 'announcement', announcement(this.config, event, state, serverInfo()));
      }
      await this.deliver(event, 'log', logView(this.config, event));
      if (event.kind === 'shutdown') await this.repository.act({ type: 'finalize', sessionId: event.data.sessionId }, event.actorId);
      await this.repository.complete(event.id);
    }
    await this.syncCompatibility();
  }
  async syncCompatibility() {
    const state = await this.repository.read(), g = this.service.store.guild(this.config.guildId);
    const presence = sessionPresence(state), signature = JSON.stringify(presence);
    if (this.client.user?.setPresence && signature !== this.lastPresence) {
      this.client.user.setPresence(presence); this.lastPresence = signature;
    }
    if (state.current) {
      let s = g.sessions.find(s => s.id === state.current.id);
      if (!s) { s = { id: state.current.id, host: state.current.hostId, start: state.current.startedAt, peak: 0, participants: [], channel: this.config.channels.announcements }; g.sessions.push(s); }
    }
    for (const h of state.history) { const s = g.sessions.find(s => s.id === h.id); if (s) { s.end = h.endedAt; s.reason = h.reason; } }
    this.service.store.save(); await this.service.store.flush();
  }
  async updateVote() {
    const state = await this.repository.read();
    const votes = new Map(state.voteHistory.map(v => [v.id, v]));
    if (state.vote) votes.set(state.vote.id, state.vote);
    if (!votes.size) return;
    const channel = await this.channel(this.config.channels.announcements);
    for (const vote of votes.values()) {
    if (!vote.messageId || vote.controlsFinalized) continue;
    try {
      await this.editMessage(await channel.messages.fetch({ message: vote.messageId, force: true }), voteView(this.config, { ...state, vote }));
      if (vote.closed) await this.repository.act({ type: 'vote-finalized', voteId: vote.id }, 'system');
    }
    catch (error) {
      if (!missing(error)) throw error;
      if (!vote.closed) {
        const recovered = await this.recoverMessage(channel, vote.id, vote.createdAt);
        const message = recovered || await channel.send(voteView(this.config, state));
        await this.repository.act({ type: 'vote-message', voteId: vote.id, messageId: message.id }, 'system');
      }
    }
    }
  }
  async ensurePanel(repaired = false, actorId = this.client.user.id) {
    const state = await this.repository.read(), channel = await this.channel(this.config.channels.permanentPanel);
    const payload = panelView(this.config, state, serverInfo());
    let message;
    if (state.panel?.messageId) try { message = await channel.messages.fetch({ message: state.panel.messageId, force: true }); } catch (error) { if (!missing(error)) throw error; }
    if (!message) message = await this.recoverMessage(channel, 'panel-banner', 0);
    const created = !message;
    if (message) await this.editMessage(message, payload); else message = await channel.send({ ...payload, nonce: createHash('sha256').update(this.config.guildId + ':session-panel').digest('hex').slice(0, 24), enforceNonce: true });
    if (created || repaired || state.panel?.messageId !== message.id) await this.repository.act({ type: 'panel', panel: { channelId: channel.id, messageId: message.id }, repaired: true }, actorId);
    const g = this.service.store.guild(this.config.guildId); g.records.liveSessionPanel = { channel: channel.id, message: message.id }; this.service.store.save(); await this.service.store.flush();
    return message;
  }
  async refresh() {
    return this.serialize(async () => {
      if (this.stopped) return;
      await this.initialize();
      let stats;
      try {
        const { data, at } = await this.erlc.snapshot();
        const validPermissions = data.Players && data.Players.length === data.CurrentPlayers && data.Players.every(p => /^(Normal|Server Administrator|Server Owner|Server Moderator|Server Helper)$/i.test(p.Permission || ''));
        stats = { available: true, at, players: data.CurrentPlayers, capacity: data.MaxPlayers, queue: data.Queue ? data.Queue.length : null, staff: validPermissions ? data.Players.filter(p => !/^Normal$/i.test(p.Permission)).length : null };
      } catch { stats = { available: false, at: Date.now(), players: null, capacity: null, queue: null, staff: null }; }
      await this.repository.act({ type: 'stats', stats }, 'system');
      let state = await this.repository.read();
      if (this.config.settings.enableAutomaticLowAlerts && Number.isInteger(this.config.settings.lowPlayerThreshold) && stats.available && stats.players < this.config.settings.lowPlayerThreshold && ['ONLINE', 'LOW_ACTIVITY'].includes(state.mode) && (!state.lastLowAt || Date.now() - state.lastLowAt >= this.config.settings.lowCooldownMs)) await this.repository.act({ type: 'low' }, this.client.user.id);
      await this.flush(); await this.updateVote(); await this.ensurePanel(); await this.flush();
    });
  }
  async toggleNotifications(userId) {
    if (this.notificationLocks.has(userId)) throw Error('Your notification role is already being updated.');
    this.notificationLocks.add(userId);
    try {
      const guild = await this.client.guilds.fetch(this.config.guildId), member = await guild.members.fetch({ user: userId, force: true }), me = await guild.members.fetchMe(), role = await guild.roles.fetch(this.config.roles.notificationSubscriber);
      const dangerous = [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.MentionEveryone];
      if (!role || role.managed || dangerous.some(p => role.permissions.has(p)) || !me.permissions.has(PermissionFlagsBits.ManageRoles) || me.roles.highest.comparePositionTo(role) <= 0) throw Error('The notification role cannot be safely assigned. Staff must check its permissions and the bot role hierarchy.');
      const enabled = !member.roles.cache.has(role.id); if (enabled) await member.roles.add(role, 'Session notification opt-in'); else await member.roles.remove(role, 'Session notification opt-out');
      return enabled;
    } finally { this.notificationLocks.delete(userId); }
  }
  async interaction(i) {
    const command = i.isChatInputCommand() && ['session', 'ssu', 'ssd'].includes(i.commandName);
    const custom = ('customId' in i ? i.customId : '') || '';
    const legacy = custom.startsWith('ls:sessionAction:') || /^ls:(vote|results):/.test(custom) && Boolean(this.service.store.guild(this.config.guildId).votes[custom.split(':')[2]]);
    if (!command && !custom.startsWith('nycs:') && !legacy) return false;
    await i.deferReply({ flags: 64 });
    let action;
    try {
      if (i.guildId !== this.config.guildId) throw Error('Use session controls in the main NYC server.');
      if (command && i.commandName !== 'session') throw Error('This old session command has been removed. Use /session instead.');
      await this.serialize(() => this.initialize());
      if (legacy) throw Error('These old session controls have been retired. Use /session status or the new session panel.');
      let state = await this.repository.read();
      const reply = (title, body, controls = []) => i.editReply(layout(this.config, title, [body], controls, 'main', 'private', true));
      if (command) action = i.options.getSubcommand();
      else action = custom.split(':')[1];
      if (['status', 'join', 'notifications', 'vote', 'voters'].includes(action) && !command) {
        if (action === 'status') { await reply('Session Status', statistics(state)); return true; }
        if (action === 'join') { const info = serverInfo(); await reply('Quick Join', info.code ? `Open Emergency Response: Liberty County in Roblox, select Private Servers, and enter **${safe(info.code)}**.` : 'The private server join code is not configured yet.'); return true; }
        if (action === 'notifications') { await reply('Session Notifications', await this.toggleNotifications(i.user.id) ? 'Session notifications enabled.' : 'Session notifications disabled.'); return true; }
        const voteId = custom.split(':')[2];
        if (action === 'voters') { const v = state.vote?.id === voteId ? state.vote : state.voteHistory.find(v => v.id === voteId); if (!v) throw Error('This session vote is unavailable.'); const names = v.voters.slice(0, 80).map(id => `<@${id}>`).join(', '); await reply('Session Voters', `**${v.voters.length}/${v.threshold} votes**\n${names || 'No votes yet.'}${v.voters.length > 80 ? `\nPlus ${v.voters.length - 80} more voters.` : ''}`); return true; }
        await this.serialize(async () => { state = await this.repository.act({ type: 'ballot', voteId }, i.user.id); await this.updateVote(); await this.flush(); });
        await i.editReply({ content: state.vote.voters.includes(i.user.id) ? 'Your vote has been added.' : 'Your vote has been removed.', allowedMentions: { parse: [] } }); return true;
      }
      if (command && action === 'status') { await reply('Session Status', statistics(state)); return true; }
      if (action === 'boost') throw Error('The old session boost command has been removed. Use /session low.');
      await this.serialize(async () => {
        await this.staff(i.user.id, i.guildId);
        await this.flush();
        state = await this.repository.read();
        if (action === 'panel') { const m = await this.ensurePanel(true, i.user.id); await this.flush(); await reply('Session Panel Ready', m.url); return; }
        if (action === 'shutdown') {
          const id = randomUUID(); await this.repository.act({ type: 'confirm', id, reason: i.options.getString('reason') }, i.user.id);
          await reply('Confirm Session Shutdown', 'End the current session? This confirmation expires in two minutes.', [row(button('nycs:shutdown-confirm:' + id, 'Confirm Shutdown', 4), button('nycs:dismiss', 'Keep Session Open'))]); return;
        }
        if (action === 'dismiss') { await reply('Session Kept Open', 'No session changes were made.'); return; }
        const request = action === 'shutdown-confirm' ? { type: 'shutdown', id: custom.split(':')[2] } : action === 'vote' ? { type: 'vote', threshold: i.options.getInteger('votes') ?? this.config.settings.requiredVotes } : ['cancel', 'cancel-vote'].includes(action) ? { type: 'cancel', voteId: command ? state.vote?.id : custom.split(':')[2] } : { type: action === 'boost' ? 'low' : action };
        await this.repository.act(request, i.user.id); await this.flush(); await this.updateVote(); await this.ensurePanel();
        await i.editReply({ content: 'The session action has been saved and announced.', allowedMentions: { parse: [] } });
      });
    } catch (error) {
      console.error('Session action failed:', error?.code || error?.name || 'Error');
      try { await this.repository.act({ type: 'error', message: 'Session action failed' }, i.user.id); await this.serialize(() => this.flush()); } catch { /* Database/Discord failures are retried by maintenance. */ }
      const message = error instanceof Error && !error.code ? safe(error.message) : 'The action could not be completed. A saved announcement will retry automatically; check /session status before repeating it.';
      await i.editReply(layout(this.config, 'Session Action Needs Attention', [message], [], 'main', 'private', true));
    }
    return true;
  }
  async stop() { this.stopped = true; await this.tail; }
}
