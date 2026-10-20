import { ids } from '../../../config/ids.js';
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { assets, bannerFor } from '../../../config/assets.js';
import { icon, monochrome } from '../../../config/icons.js';

export const colors = { blue: 0x244a91, green: 0x428574, red: 0xa85461, orange: 0xb28e54, purple: 0x6689ba, cyan: 0x6689ba, gray: 0x747f8d };
export const actions = new Set(['panel', 'ack', 'verify', 'ticket', 'apply', 'applicationStatus', 'vote', 'results', 'case', 'appeal', 'history', 'shift', 'ticketAction', 'review', 'dispatchAck', 'dispatchAssign', 'role', 'record', 'feedback', 'activity', 'dm', 'appReview', 'appPage', 'web', 'ticketV2', 'setupBind', 'sessionAction']);
export function safeUrl(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || !['cdn.discordapp.com', 'media.discordapp.net', 'images.unsplash.com'].includes(u.hostname) || u.username || u.password) throw Error('Media URL is not on the HTTPS allowlist.');
  return u.href;
}
export function actionId(action, args = '') {
  if (!actions.has(action)) throw Error('Unsupported action');
  const id = `ls:${action}:${args}`;
  if (id.length > 100) throw Error('Action is too long');
  return id;
}
export const button = (label, action, args = '', style = 2) => ({ label, action, args, style });
export function interpolate(text, vars) {
  return String(text).replace(/\{([a-z_]+)\}/g, (_, key) => String(vars[key] ?? 'Not configured'));
}
export function render(template, vars = {}, { page = 0, ephemeral = false } = {}) {
  const pages = template.pages ?? [template.sections ?? []];
  if (!Number.isInteger(page) || page < 0 || page >= pages.length) throw Error('Unknown page');
  const text = value => new TextDisplayBuilder().setContent(monochrome(interpolate(value, vars)));
  const container = new ContainerBuilder().setAccentColor(colors[template.color] ?? template.color ?? colors.blue);
  const heading = `# ${icon('shield')} ${monochrome(template.title)}`;
  if (template.thumbnail) container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(text(heading)).setThumbnailAccessory(new ThumbnailBuilder().setURL(safeUrl(template.thumbnail))));
  else container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(text(heading)).setThumbnailAccessory(new ThumbnailBuilder().setURL('attachment://la-logo.png').setDescription('LASRP white LA logo')));
  container.addSeparatorComponents(new SeparatorBuilder());
  for (const section of pages[page]) {
    if (section === '---') container.addSeparatorComponents(new SeparatorBuilder());
    else container.addTextDisplayComponents(text(section));
  }
  if (template.media?.length) container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...template.media.map(url => new MediaGalleryItemBuilder().setURL(safeUrl(url)))));
  else container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://panel-banner.png').setDescription(`${monochrome(template.title)} — Los Angeles State Roleplay`)));
  const buttonIcon=b=>{const key=/accept|acknowledge|confirm|submit|begin|apply|yes/i.test(b.label)?'check':/deny|cancel|close|no$/i.test(b.label)?'close':'shield';return ids.emojis[key]?{id:ids.emojis[key],name:key}:undefined;};
  const buttons = [...(template.buttons ?? [])];
  if (pages.length > 1) {
    if (page > 0) buttons.push(button('Previous', 'panel', `${template.key},${page - 1}`));
    if (page + 1 < pages.length) buttons.push(button('Next', 'panel', `${template.key},${page + 1}`));
  }
  for (let i = 0; i < buttons.length; i += 5) container.addActionRowComponents(new ActionRowBuilder().addComponents(...buttons.slice(i, i + 5).map(b => new ButtonBuilder().setLabel(monochrome(b.label)).setStyle(b.style ?? 2).setCustomId(actionId(b.action, interpolate(b.args ?? '', vars))).setEmoji(buttonIcon(b)))));
  if (template.select) container.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(actionId(template.select.action, template.select.args ?? '')).setPlaceholder(template.select.placeholder ?? 'Choose an option').addOptions(template.select.options.map(o=>({...o,label:monochrome(o.label)})))));
  container.addSeparatorComponents(new SeparatorBuilder()).addTextDisplayComponents(text(`-# {community}${pages.length > 1 ? ` • Page ${page + 1}/${pages.length}` : ''} • ${template.footer ?? 'Operations & Public Safety'}`));
  const payload = { components: [container.toJSON()], flags: MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0), allowedMentions: { parse: [] }, attachments:[], files:[{attachment:assets.logo,name:'la-logo.png'},...(!template.media?.length?[{attachment:bannerFor(template.key??template.title),name:'panel-banner.png'}]:[])] };
  validatePayload(payload);
  return payload;
}
export function validatePayload(payload) {
  if (!(payload.flags & MessageFlags.IsComponentsV2) || ['content', 'embeds', 'poll', 'stickers'].some(k => k in payload)) throw Error('Only Components V2 messages are allowed');
  let count = 0, length = 0;
  const ids = new Set();
  function walk(c) {
    count++;
    if (c.type === 10) length += c.content.length;
    if (c.custom_id) {
      if (ids.has(c.custom_id) || c.custom_id.length > 100 || !actions.has(c.custom_id.split(':')[1])) throw Error('Invalid or duplicate interaction');
      ids.add(c.custom_id);
    }
    if (c.components) c.components.forEach(walk);
    if (c.accessory) walk(c.accessory);
  }
  payload.components.forEach(walk);
  if (count > 40 || length > 4000) throw Error(`Discord limits exceeded: ${count}/40 components, ${length}/4000 text characters`);
  return payload;
}
export function notice(title, description, color = 'blue', ephemeral = true) {
  return render({ title, color, sections: [description] }, { community: 'Los Angeles State Roleplay' }, { ephemeral });
}
export function validateTemplate(template) {
  if (!template || typeof template.title !== 'string' || !template.title.trim()) throw Error('Title is required');
  for (let page = 0; page < (template.pages?.length ?? 1); page++) render(template, { community: 'Los Angeles State Roleplay' }, { page });
  return template;
}
