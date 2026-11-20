import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ticketNumber } from './views.js';
import { TicketError } from './database.js';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function safeUrl(value, { avatar = false } = {}) {
    try {
        const u = new URL(value);
        if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password)
            return null;
        if (avatar && !['cdn.discordapp.com', 'media.discordapp.net'].includes(u.hostname))
            return null;
        return u.href;
    }
    catch {
        return null;
    }
}
const htmlEnd = '</main></body></html>';
function header(ticket, category, events, part) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https://cdn.discordapp.com https://media.discordapp.net; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>NYC Ticket #${ticketNumber(ticket.number)} — Part ${part}</title><style>body{margin:0;background:#313338;color:#f2f3f5;font:15px system-ui;line-height:1.6}header,main{max-width:1100px;margin:auto;padding:24px}header{border-bottom:2px solid #d8c5a4}article{padding:20px 0;border-bottom:1px solid #41434a}.avatar{width:40px;height:40px;border-radius:50%;float:left;margin-right:12px}pre,p{white-space:pre-wrap;overflow-wrap:anywhere}pre{font:inherit;background:#2b2d31;padding:12px}a{color:#ead9ba}.attachment-image{display:block;max-width:100%;max-height:600px;border-radius:8px}.component-container{border:1px solid #454750;border-radius:8px;background:#2b2d31;max-width:700px;padding:16px;margin:12px 0}.component-button{display:inline-block;background:#4e5058;border-radius:4px;padding:4px 14px;margin:4px}hr{border:0;border-top:1px solid #454750}time,small{color:#b5bac1}summary{cursor:pointer}h1{font-size:26px}h2{font-size:20px}ul{padding-left:24px}</style></head><body><header><h1>New York City Roleplay — Ticket #${ticketNumber(ticket.number)}</h1><p>Part ${part} · ${escapeHtml(category.name)}</p><p><strong>Creator:</strong> ${escapeHtml(ticket.creatorUsername)} (${escapeHtml(ticket.creatorId)})<br><strong>Claimant:</strong> ${escapeHtml(ticket.claimantId ?? 'Not claimed')}<br><strong>Closed by:</strong> ${escapeHtml(ticket.closure.actorId)}<br><strong>Created:</strong> ${new Date(ticket.createdAt).toISOString()}<br><strong>${ticket.isPreview?'Snapshot generated':'Closure initiated'}:</strong> ${new Date(ticket.closure.startedAt).toISOString()}</p><p><strong>Closing reason:</strong> ${escapeHtml(ticket.closure.reason??'Not supplied')}</p><h2>Opening inquiry</h2><p>${escapeHtml(ticket.inquiry)}</p><details><summary>Ticket audit and escalation history</summary><ul>${events.map(e => `<li>${new Date(e.at).toISOString()} · ${escapeHtml(e.type)} · ${escapeHtml(e.actorId)} ${escapeHtml(JSON.stringify(e))}</li>`).join('')}</ul></details><p><small>Complete retrievable history captured during closure. Deleted or inaccessible messages are not invented. Attachment links can expire; attachments are referenced, not executed.</small></p></header><main>`;
}
function componentText(components) {
    return (components ?? []).flatMap(c => [...(c.content ? [c.content] : []), ...componentText(c.components), ...(c.accessory?.description ? [c.accessory.description] : [])]).join('\n');
}
function media(url,alt='Attachment'){
    const safe=safeUrl(url,{avatar:true});return safe?`<a href="${escapeHtml(safe)}" rel="noopener noreferrer"><img class="attachment-image" src="${escapeHtml(safe)}" alt="${escapeHtml(alt)}" loading="lazy"></a>`:'';
}
function renderComponents(components){return (components??[]).map(c=>{
    if(c.type===10)return `<p>${escapeHtml(c.content)}</p>`;
    if(c.type===14)return '<hr>';
    if(c.type===12)return (c.items??[]).map(item=>media(item.media?.url,item.description??'Ticket media')).join('');
    if(c.type===13){const url=safeUrl(c.file?.url);return url?`<p><a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(c.file?.name??'File attachment')}</a></p>`:'';}
    if(c.type===2)return `<span class="component-button">${escapeHtml(c.label??'Button')}</span>`;
    const inner=renderComponents(c.components);return `<div class="${c.type===17?'component-container':'component-row'}">${inner}${c.accessory?.media?.url?media(c.accessory.media.url,'Thumbnail'):''}</div>`;
}).join('');}
export function snapshotMessage(message) {
    const componentTree=(message.components??[]).map(c=>c.toJSON?.()??c);
    return { id: message.id, at: message.createdTimestamp, author: message.member?.displayName ?? message.author?.globalName ?? message.author?.username ?? 'Unknown author', authorId: message.author?.id ?? 'unknown', avatar: message.author?.displayAvatarURL?.({ extension: 'png', size: 64 }) ?? null, content: message.content ?? '', attachments: [...(message.attachments?.values?.() ?? [])].map(a => ({ name: a.name ?? 'Attachment', url: a.url, size: a.size,contentType:a.contentType })), embeds: (message.embeds ?? []).map(e => e.toJSON?.() ?? e), components: componentText(componentTree),componentTree };
}
function messageHtml(message, body) {
    const avatar = safeUrl(message.avatar, { avatar: true });
    return `<article data-message="${escapeHtml(message.id)}">${avatar ? `<img class="avatar" src="${escapeHtml(avatar)}" alt="">` : ''}<strong>${escapeHtml(message.author)}</strong> <small>(${escapeHtml(message.authorId)})</small> <time>${new Date(message.at).toISOString()}</time>${body}</article>`;
}
function renderMessage(message) {
    return messageHtml(message, `<p>${escapeHtml(message.content)}</p>${message.componentTree?.length?renderComponents(message.componentTree):message.components ? `<pre>${escapeHtml(message.components)}</pre>` : ''}${message.embeds.map(e => `<section><strong>${escapeHtml(e.title ?? e.author?.name ?? 'Embed')}</strong><p>${escapeHtml(e.description ?? '')}</p>${(e.fields ?? []).map(f => `<p><strong>${escapeHtml(f.name)}</strong>\n${escapeHtml(f.value)}</p>`).join('')}<p>${escapeHtml(e.footer?.text ?? '')}</p></section>`).join('')}${message.attachments.map(a => {
        const url = safeUrl(a.url);
        return `${/^image\/(png|jpeg|webp|gif)$/.test(a.contentType??'')?media(a.url,a.name):''}<p>Attachment: ${url ? `<a href="${escapeHtml(url)}" rel="noopener noreferrer" download>${escapeHtml(a.name)}</a>` : escapeHtml(a.name)}</p>`;
    }).join('')}`);
}
export function transcriptFolder(config, ticket) {
    if (!/^[a-f0-9-]{36}$/.test(ticket.id))
        throw new TicketError('Invalid ticket storage reference.');
    return path.resolve(config.transcriptDirectory, ticket.id);
}
export async function verifyParts(parts) {
    for (const part of parts) {
        const content = await fs.readFile(part.path);
        if (content.length !== part.bytes || createHash('sha256').update(content).digest('hex') !== part.sha256)
            throw new TicketError('Transcript storage is missing or changed. Restore the saved files before retrying.', 'TRANSCRIPT_STORAGE_INVALID');
    }
    return parts;
}
export async function captureTranscript(ticket, channel, repository, config, heartbeat = () => {
}) {
    const directory = transcriptFolder(config, ticket);
    await fs.mkdir(directory, { recursive: true });
    let before, pages = 0, count = 0;
    while (true) {
        heartbeat();
        const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
        if (!batch.size)
            break;
        const rows = [...batch.values()].map(snapshotMessage);
        await fs.writeFile(path.join(directory, `capture-${pages++}.json`), JSON.stringify(rows), { mode: 0o600 });
        count += rows.length;
        const last = batch.last().id;
        if (last === before)
            throw new TicketError('Discord returned repeated message history. The channel was preserved.', 'HISTORY_PAGINATION_FAILED');
        before = last;
        if (batch.size < 100)
            break;
    }
    const category = config.categories.find(c => c.key === ticket.category), events = repository.events(ticket.id), parts = [];
    let part = 1, current = header(ticket, category, events, part);
    const max = config.transcriptPartBytes;
    if (Buffer.byteLength(current + htmlEnd) > max / 2)
        throw new TicketError('Transcript part size is too small for ticket metadata. Increase the configured limit.');
    const flush = async () => {
        const name = `ticket-${ticketNumber(ticket.number)}-part-${String(part).padStart(3, '0')}.html`, filename = path.join(directory, name), content = Buffer.from(current + htmlEnd);
        await fs.writeFile(filename, content, { mode: 0o600 });
        parts.push({ name, path: filename, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') });
        part++;
        current = header(ticket, category, events, part);
    };
    for (let page = pages - 1; page >= 0; page--) {
        const rows = JSON.parse(await fs.readFile(path.join(directory, `capture-${page}.json`), 'utf8')).reverse();
        for (const message of rows) {
            let blocks = [renderMessage(message)];
            const budget = max - Buffer.byteLength(header(ticket, category, events, part) + htmlEnd) - 500;
            if (Buffer.byteLength(blocks[0]) > budget) {
                const plain = [message.content, message.components, JSON.stringify(message.embeds), JSON.stringify(message.attachments),JSON.stringify(message.componentTree??[])].join('\n');
                blocks = [];
                let chunk = '';
                for (const character of plain) {
                    if (Buffer.byteLength(escapeHtml(chunk + character)) > budget / 2) {
                        blocks.push(messageHtml(message, '<pre>' + escapeHtml(chunk) + '</pre>'));
                        chunk = '';
                    }
                    chunk += character;
                }
                if (chunk)
                    blocks.push(messageHtml(message, '<pre>' + escapeHtml(chunk) + '</pre>'));
            }
            for (const block of blocks) {
                if (Buffer.byteLength(current + block + htmlEnd) > max)
                    await flush();
                current += block;
            }
        }
        heartbeat();
    }
    await flush();
    return { parts, messageCount: count, capturedAt: Date.now() };
}
