import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { Express } from 'express';
import { sessionUser } from './auth.js';
import { escapeHtml } from '../../bot/src/ticket-system/transcripts.js';
const validId = (id: string) => /^[a-f0-9-]{36}$/.test(id);
export function configureAssistanceTranscripts(app: Express, system: any, client: any, resolveSession: any = sessionUser) {
    const authorize = async (req: any, res: any, next: any) => {
        try {
            res.set({ 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
            const session = await resolveSession(req.headers.cookie, client);
            if (!session) {
                const returnTo = validId(String(req.params.id)) ? req.originalUrl.split('?')[0] : '/';
                return res.redirect('/auth/discord?returnTo=' + encodeURIComponent(returnTo));
            }
            const actor = await system.actor(session.principal.id);
            if (!actor.administrator)
                return res.status(403).type('text/plain').send('Discord Administrator permission is required to access transcripts.');
            const id = String(req.params.id);
            if (!validId(id))
                return res.sendStatus(404);
            const ticket = system.repo.get(id);
            if (!ticket || ticket.guildId !== system.config.guildId)
                return res.sendStatus(404);
            const transcript = ticket.transcript ?? ticket.previewTranscript;
            if (!transcript)
                return res.status(404).type('text/plain').send('A transcript has not been generated.');
            req.assistance = { ticket, transcript, actor };
            next();
        }
        catch {
            res.status(503).type('text/plain').send('Transcript authorization is temporarily unavailable.');
        }
    };
    app.get('/tickets/transcripts/:id', authorize, async (req: any, res) => {
        const { ticket, transcript } = req.assistance;
        res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
        const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NYCRP Ticket ${ticket.number}</title><style>body{margin:0;background:#313338;color:#f2f3f5;font:16px system-ui;line-height:1.6}main{max-width:900px;margin:48px auto;padding:24px;border-top:3px solid #d8c5a4}a{color:#ead9ba}li{margin:16px 0}.muted{color:#b5bac1}</style></head><body><main><h1>New York City Roleplay</h1><h2>Ticket #${String(ticket.number).padStart(4, '0')} — ${escapeHtml(system.category(ticket).name)}</h2><p class="muted">${ticket.transcript ? 'Saved ticket transcript' : 'Administrator-generated snapshot; this ticket may remain open.'} · ${transcript.messageCount} retrievable messages · ${transcript.parts.length} part(s)</p><p>Access is restricted to current Discord Administrators and checked again for every view and download.</p><ul>${transcript.parts.map((part: any, index: number) => `<li><a href="/tickets/transcripts/${ticket.id}/part/${index + 1}">View part ${index + 1}</a> · <a href="/tickets/transcripts/${ticket.id}/part/${index + 1}?download=1">Download HTML</a> <span class="muted">(${part.bytes} bytes)</span></li>`).join('')}</ul></main></body></html>`;
        system.repo.event(ticket.id, 'transcript_viewed', req.assistance.actor.id, { parts: transcript.parts.length });
        res.type('html').send(html);
    });
    app.get('/tickets/transcripts/:id/part/:part', authorize, async (req: any, res) => {
        try {
            const { ticket, transcript, actor } = req.assistance, index = Number(req.params.part) - 1;
            if (!Number.isSafeInteger(index) || index < 0 || index >= transcript.parts.length)
                return res.sendStatus(404);
            const part = transcript.parts[index], root = await fs.realpath(system.config.transcriptDirectory), file = await fs.realpath(part.path);
            if (!file.startsWith(root + path.sep))
                return res.sendStatus(404);
            const content = await fs.readFile(file);
            if (content.length !== part.bytes || createHash('sha256').update(content).digest('hex') !== part.sha256)
                return res.status(409).type('text/plain').send('Transcript integrity verification failed. Contact the server owner.');
            system.repo.event(ticket.id, 'transcript_downloaded', actor.id, { part: index + 1 });
            res.set({ 'Content-Security-Policy': "default-src 'none'; img-src 'self' https://cdn.discordapp.com https://media.discordapp.net; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox allow-downloads", 'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="ticket-${ticket.number}-part-${index + 1}.html"` });
            res.type('html').send(content);
        }
        catch {
            res.status(404).type('text/plain').send('Saved transcript is unavailable.');
        }
    });
}
