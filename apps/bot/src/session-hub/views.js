import fs from 'node:fs';
import { label } from './model.js';
const text = content => ({ type: 10, content });
const separator = () => ({ type: 14, spacing: 1 });
export const button = (custom_id, label, style = 2, disabled = false) => ({ type: 2, custom_id, label, style, disabled });
export const row = (...components) => ({ type: 1, components });
export const safe = value => String(value ?? 'Not configured').replace(/[@`*_~<>]/g, '').slice(0, 200);
export function serverInfo(env = process.env) {
  const code = env.ERLC_JOIN_CODE || env.PUBLIC_ERLC_JOIN_CODE || '';
  let url = env.ERLC_JOIN_URL || env.PUBLIC_ERLC_JOIN_URL || '';
  if (!url && /^[\w-]{1,64}$/.test(code)) url = 'https://erlc.gg/join/' + encodeURIComponent(code);
  try { const u = new URL(url); if (u.protocol !== 'https:' || u.hostname !== 'erlc.gg' || !/^\/join\/[\w-]{1,64}\/?$/.test(u.pathname) || u.search || u.hash || u.username || u.password || u.port) url = ''; } catch { url = ''; }
  return { name: env.ERLC_SERVER_NAME || '', owner: env.ERLC_SERVER_OWNER || '', code, url };
}
export const joinButton = info => info.url ? { type: 2, style: 5, label: 'Quick Join', url: info.url } : button('nycs:join', 'Quick Join');
export function layout(config, title, body, controls = [], kind = 'main', key = 'panel', ephemeral = false) {
  const files = [], components = [];
  const image = (path, name) => { if (!path) return; if (/^https:\/\//.test(path)) { components.push({ type: 12, items: [{ media: { url: path } }] }); return; } if (fs.existsSync(path)) { files.push({ attachment: path, name }); components.push({ type: 12, items: [{ media: { url: 'attachment://' + name } }] }); } };
  const banner = config.assets[kind]; image(banner && (fs.existsSync(banner) || /^https:\/\//.test(banner)) ? banner : config.assets.main, `session-${key}-banner.png`);
  const logo = config.assets.logo, logoName = `session-${key}-logo.png`;
  if (logo && (/^https:\/\//.test(logo) || fs.existsSync(logo))) {
    if (!/^https:\/\//.test(logo)) files.push({ attachment: logo, name: logoName });
    components.push({ type: 9, components: [text('# ' + title)], accessory: { type: 11, media: { url: /^https:\/\//.test(logo) ? logo : 'attachment://' + logoName } } });
  } else components.push(text('# ' + title));
  components.push(separator(), ...body.map(text));
  if (controls.length) components.push(separator(), ...controls);
  image(config.assets.divider, `session-${key}-footer.png`);
  return { flags: 32768 | (ephemeral ? 64 : 0), allowedMentions: { parse: [] }, files, components: [{ type: 17, accent_color: config.color, components }] };
}
export function statistics(state) {
  const s = state.lastStats, fresh = s?.available && Date.now() - s.at < 120000;
  return `**Players:** ${fresh ? `${s.players} / ${s.capacity}` : 'Unavailable'}\n**Staff In-Game:** ${fresh && s.staff !== null ? s.staff : 'Unavailable'}\n**Queue:** ${fresh && s.queue !== null ? s.queue : 'Unavailable'}\n**Session Status:** ${label(state.mode)}\n**Last Updated:** ${s?.at ? `<t:${Math.floor(s.at / 1000)}:R>` : 'Unavailable'}${fresh ? '' : '\nER:LC telemetry is unavailable. Session controls remain available.'}`;
}
export function information(info) { return `**Server Name:** ${safe(info.name || 'Not configured')}\n**Join Code:** ${safe(info.code || 'Not configured')}\n**Server Owner:** ${safe(info.owner || 'Not configured')}`; }
export function panelView(config, state, info) {
  return layout(config, 'New York City Roleplay Sessions', ['Welcome to the New York City Roleplay session hub! Find upcoming sessions, live server activity, voting, and official announcements here.', '## ER:LC Server Information\n' + information(info), '## Server Statistics\n' + statistics(state)], [row(button('nycs:notifications', 'Notifications'), button('nycs:status', label(state.mode), state.mode === 'ONLINE' ? 3 : state.mode === 'SHUTTING_DOWN' ? 4 : 2), joinButton(info))]);
}
export function voteView(config, state) {
  const v = state.vote, reached = v.voters.length >= v.threshold;
  return layout(config, v.closed ? 'Session Vote Closed' : reached ? 'Required Votes Reached!' : 'Session Vote!', ['Our staff team is considering starting a new New York City Roleplay session! If you are available to participate, cast your vote below.', v.closed ? safe(v.closeReason) : reached ? 'The session has enough votes and is awaiting a staff member to start it. Voting does not start a session automatically.' : 'Once enough votes are received, staff can begin the session. Click Vote again to remove your vote.'], [row(button('nycs:vote:' + v.id, `Vote — ${v.voters.length}/${v.threshold}`, 1, v.closed), button('nycs:voters:' + v.id, 'View Voters'), button('nycs:cancel:' + v.id, 'Cancel Vote', 4, v.closed))], 'vote', v.id);
}
export function announcement(config, event, state, info) {
  const titles = { start: 'Session Started!', low: 'Session Low!', shutdown: 'Session Shutdown', threshold: 'Required Votes Reached!', cancel: 'Session Vote Cancelled' };
  if (event.kind === 'vote') {
    const payload = voteView(config, state);
    payload.components[0].components.splice(2, 0, text(`<@&${config.roles.sessionPing}>`));
    payload.components[0].components.splice(-1, 0, row(button('nycs:receipt:' + event.id, 'Session Vote', 2, true)));
    payload.allowedMentions = { parse: [], roles: [config.roles.sessionPing] };
    return payload;
  }
  const current = event.data.current || state.current;
  const bodies = {
    start: ['The New York City Roleplay session is officially underway! Join us for a professional and realistic ER:LC experience. We encourage everyone who voted to participate.', '## Session Information\n' + information(info) + `\n**Session Host:** <@${current?.hostId}>\n**Session Started:** <t:${Math.floor((current?.startedAt || event.data.at) / 1000)}:f>`],
    low: ['Our current New York City Roleplay session is experiencing low activity. Join us and help bring the city back to life! The current session remains active.'],
    shutdown: ['The New York City Roleplay session has officially come to an end. Thank you to everyone who participated! Stay tuned for future session announcements.', `**Ended by:** <@${event.actorId}>\n**Reason:** ${safe(current?.reason)}\n**Ended:** <t:${Math.floor(event.data.at / 1000)}:f>`],
    threshold: [`<@${event.data.hostId}> · <@&${config.roles.sessionStaff[0]}>\nThe vote reached ${event.data.votes}/${event.data.threshold}. Authorized staff can use **/session start** when ready. This does not start the session automatically.`],
    cancel: [`<@${event.actorId}> cancelled the session vote.`]
  };
  const ping = ['vote', 'start'].includes(event.kind) || (event.kind === 'low' && config.settings.pingLow);
  const body = bodies[event.kind] || ['Session updated.'];
  if (ping) body.unshift(`<@&${config.roles.sessionPing}>`);
  const controls = ['start', 'low'].includes(event.kind) ? [row(joinButton(info))] : [];
  controls.push(row(button('nycs:receipt:' + event.id, label(event.data.after), 2, true)));
  const payload = layout(config, titles[event.kind] || 'Session Update', body, controls, event.kind, event.id);
  payload.allowedMentions = { parse: [], roles: ping ? [config.roles.sessionPing] : event.kind === 'threshold' ? config.roles.sessionStaff : [], users: event.kind === 'threshold' ? [event.data.hostId] : [] };
  return payload;
}
export function logView(config, event) {
  const current = event.data.current;
  const details = event.data.voteId ? `**Vote:** ${event.data.voteId}${event.data.votes !== undefined ? `\n**Votes:** ${event.data.votes}/${event.data.threshold}` : ''}` : current ? `**Host:** <@${current.hostId}>\n**Started:** <t:${Math.floor(current.startedAt / 1000)}:f>${current.reason ? '\n**Reason:** ' + safe(current.reason) : ''}${current.finalStats?.available ? `\n**Final observed players:** ${current.finalStats.players}/${current.finalStats.capacity}\n**Observation:** <t:${Math.floor(current.finalStats.at / 1000)}:f>` : ''}` : 'The action has been recorded.';
  return layout(config, 'Session Activity · ' + event.kind, [`**Staff:** <@${event.actorId}>\n**Session:** ${event.data.sessionId || 'No active session'}\n**State:** ${label(event.data.before)} → ${label(event.data.after)}\n**Time:** <t:${Math.floor(event.data.at / 1000)}:f>`, event.kind === 'error' ? 'The session action could not be completed. Check the local session diagnostics.' : details], [row(button('nycs:receipt:' + event.id, 'Recorded', 2, true))], 'main', event.id + '-log');
}
