import fs from 'node:fs';
import { escapeMarkdown, SlashCommandBuilder } from 'discord.js';
const text = content => ({ type: 10, content });
const separator = () => ({ type: 14, spacing: 1 });
const roles = ids => ids.length ? ids.map(id => `<@&${id}>`).join(', ') : 'None';
export const promoteCommand = new SlashCommandBuilder().setName('promote').setDescription('Promote a staff member with a verified role bundle').setDMPermission(false)
  .addUserOption(o => o.setName('user').setDescription('Staff member being promoted').setRequired(true))
  .addStringOption(o => o.setName('rank').setDescription('Individual destination rank').setRequired(true).setAutocomplete(true))
  .addStringOption(o => o.setName('reason').setDescription('Promotion reason shown in the announcement').setRequired(true).setMinLength(3).setMaxLength(1000));
export function card(config, title, body, key, { branded = false, ephemeral = false, controls = [] } = {}) {
  const files = [], components = [];
  const image = (path, suffix) => { if (!path || !fs.existsSync(path)) return; const name = `promotion-${key}-${suffix}.png`; files.push({ attachment: path, name }); components.push({ type: 12, items: [{ media: { url: 'attachment://' + name } }] }); };
  if (branded) image(config.assets.banner, 'banner');
  components.push(separator());
  if (branded && config.assets.logo && fs.existsSync(config.assets.logo)) {
    const name = `promotion-${key}-logo.png`; files.push({ attachment: config.assets.logo, name });
    components.push({ type: 9, components: [text('## ' + title)], accessory: { type: 11, media: { url: 'attachment://' + name } } });
  } else components.push(text('## ' + title));
  components.push(...body.map(text), separator(), ...controls);
  if (branded) image(config.assets.footer, 'footer');
  return { flags: 32768 | (ephemeral ? 64 : 0), components: [{ type: 17, accent_color: config.color, components }], files, allowedMentions: { parse: [] } };
}
export function announcement(config, row) {
  const icon = config.iconName ? `<:${config.iconName}:${config.iconId}> ` : '';
  const payload = card(config, icon + 'New Promotion', [`**User:** <@${row.memberId}>\n**New Rank:** <@&${row.rankId}>\n**Reason:** ${escapeMarkdown(row.reason)}`, `-# Promoted By: <@${row.actorId}>`], row.id, { branded: true });
  const parts = payload.components[0].components;
  const credit = parts.findIndex(c => c.type === 10 && c.content?.startsWith('-# Promoted By:'));
  if (credit >= 0) { parts.splice(credit + 1, 1); parts.splice(credit, 0, separator()); }
  payload.allowedMentions = { parse: [], roles: [], users: [row.memberId], repliedUser: false };
  return payload;
}
export function directMessage(config, row) {
  return card(config, 'Congratulations!', ['Congratulations on your promotion within the New York City Roleplay staff team. Your continued dedication and contributions are greatly appreciated.', `**New Rank:** ${escapeMarkdown(row.data.plan.rankName)}\n**Promoted By:** ${escapeMarkdown(row.data.actorName)}\n**Reason:** ${escapeMarkdown(row.reason)}`, 'We look forward to seeing you succeed in your new position.'], row.id + '-dm', { branded: true });
}
export function logCard(config, row) {
  const p = row.data.plan, url = row.data.announcementId ? `https://discord.com/channels/${config.guildId}/${config.announcementChannelId}/${row.data.announcementId}` : 'Pending';
  return card(config, 'Promotion Audit', [`**Promotion ID:** ${row.id}\n**Member:** <@${row.memberId}>\n**Previous rank:** ${p.previousRankId ? `<@&${p.previousRankId}>` : 'Not previously ranked'}\n**New rank:** <@&${row.rankId}>\n**Promoted by:** <@${row.actorId}>`, `**Private reason:** ${escapeMarkdown(row.reason)}\n**Roles added:** ${roles(p.add)}\n**Roles removed:** ${roles(p.remove)}`, `**Outcome:** ${row.status}\n**Rank lock override:** ${row.data.lockOverride || 'Not used'}\n**DM delivery:** ${row.data.dmStatus || 'Pending'}\n**Announcement:** ${url}\n**Time:** <t:${Math.floor(new Date(row.createdAt).getTime() / 1000)}:f>${row.data.failure ? '\n**Failure:** ' + escapeMarkdown(row.data.failure) : ''}`], row.id + '-log');
}
export function success(config, row) {
  const p = row.data.plan, url = row.data.announcementId ? `https://discord.com/channels/${config.guildId}/${config.announcementChannelId}/${row.data.announcementId}` : null;
  return card(config, 'Promotion Successful', [`**User:** <@${row.memberId}>\n**Previous Rank:** ${p.previousRankId ? `<@&${p.previousRankId}>` : 'Not previously ranked'}\n**New Rank:** <@&${row.rankId}>\n**Reason:** ${escapeMarkdown(row.reason)}`, 'The appropriate staff roles have been updated and verified successfully.', url ? `[View promotion announcement](${url})` : 'The announcement is saved for automatic delivery retry.'], row.id, { ephemeral: true });
}
