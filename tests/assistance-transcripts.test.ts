import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import express from 'express';
import { assistanceFixture, users } from './helpers/assistance-fixture.js';
import { configureAssistanceTranscripts } from '../apps/api/src/assistance-transcripts.js';
import { transcriptReturnPath } from '../apps/api/src/auth.js';
test('transcript website checks shared login and fresh Discord Administrator permission for every list, view and download', async () => {
    const f = await assistanceFixture();
    const app = express(), server = http.createServer(app);
    try {
        const ticket = await f.create();
        await f.service.close(ticket.id, f.staff, { reason: 'Resolved' });
        f.members.set(users.other, { ...f.other, administrator: true });
        configureAssistanceTranscripts(app, f.service, f.client, async (cookie: string) => cookie ? { principal: { id: cookie === 'admin' ? users.other : users.creator } } : null);
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
        const origin = 'http://127.0.0.1:' + (server.address() as any).port, url = origin + '/tickets/transcripts/' + ticket.id;
        let response = await fetch(url, { redirect: 'manual' });
        assert.equal(response.status, 302);
        assert.ok(response.headers.get('location')?.startsWith('/auth/discord?returnTo='));
        for (const suffix of ['', '/part/1', '/part/1?download=1'])
            assert.equal((await fetch(url + suffix, { headers: { cookie: 'member' } })).status, 403);
        response = await fetch(url, { headers: { cookie: 'admin' } });
        assert.equal(response.status, 200);
        assert.ok((await response.text()).includes('View part 1'));
        assert.ok(response.headers.get('cache-control')?.includes('no-store'));
        response = await fetch(url + '/part/1', { headers: { cookie: 'admin' } });
        assert.equal(response.status, 200);
        assert.ok(response.headers.get('content-security-policy')?.includes("default-src 'none'"));
        assert.ok((await response.text()).includes('Resolved'));
        response = await fetch(url + '/part/1?download=1', { headers: { cookie: 'admin' } });
        assert.ok(response.headers.get('content-disposition')?.startsWith('attachment'));
        f.members.set(users.other, { ...f.other, administrator: false });
        assert.equal((await fetch(url + '/part/1', { headers: { cookie: 'admin' } })).status, 403);
        f.members.set(users.other, { ...f.other, administrator: true });
        assert.equal((await fetch(url + '/part/999', { headers: { cookie: 'admin' } })).status, 404);
        const part = f.repo.get(ticket.id)?.transcript.parts[0];
        await fs.appendFile(part.path, 'tampered');
        assert.equal((await fetch(url + '/part/1', { headers: { cookie: 'admin' } })).status, 409);
    }
    finally {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
        await f.cleanup();
    }
});
test('OAuth transcript return targets allow only local transcript pages and reject open redirects or traversal', () => {
    const path = '/tickets/transcripts/12345678-1234-1234-1234-123456789abc';
    assert.equal(transcriptReturnPath(path), path);
    assert.equal(transcriptReturnPath(path + '/part/1'), path + '/part/1');
    for (const value of ['https://evil.invalid', '//evil.invalid', '/admin', '/tickets/transcripts/../../secret', path + '?next=https://evil.invalid', path + '/part/-1', null])
        assert.equal(transcriptReturnPath(value), null);
});
