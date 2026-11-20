import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
export class TicketError extends Error {
    constructor(message, code = 'TICKET_ACTION_REJECTED') {
        super(message);
        this.name = 'TicketError';
        this.code = code;
    }
}
export class TicketRepository {
    constructor(filename, startingNumber = 1) {
        this.filename = filename;
        this.startingNumber = startingNumber;
        if (filename !== ':memory:')
            fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
        this.db = new DatabaseSync(filename);
        if(filename!==':memory:')fs.chmodSync(filename,0o600);
        this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
        this.migrate();
    }
    migrate() {
        this.db.exec(`
 CREATE TABLE IF NOT EXISTS ticket_migrations(version INTEGER PRIMARY KEY,applied_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS ticket_counters(guild_id TEXT PRIMARY KEY,last_number INTEGER NOT NULL CHECK(last_number>=0));
 CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY,guild_id TEXT NOT NULL,number INTEGER NOT NULL,creator_id TEXT NOT NULL,category TEXT NOT NULL,channel_id TEXT,lifecycle TEXT NOT NULL CHECK(lifecycle IN ('CREATING','OPEN','CLOSING','CLOSED','ERROR')),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),claimant_id TEXT,escalation_level INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 1,operation_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0,data TEXT NOT NULL,UNIQUE(guild_id,number));
 CREATE UNIQUE INDEX IF NOT EXISTS tickets_one_active ON tickets(guild_id,creator_id,category) WHERE active=1;
 CREATE UNIQUE INDEX IF NOT EXISTS tickets_channel ON tickets(channel_id) WHERE channel_id IS NOT NULL;
 CREATE TABLE IF NOT EXISTS ticket_events(id INTEGER PRIMARY KEY AUTOINCREMENT,ticket_id TEXT NOT NULL REFERENCES tickets(id),type TEXT NOT NULL,actor_id TEXT NOT NULL,created_at INTEGER NOT NULL,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS ticket_panels(guild_id TEXT NOT NULL,channel_id TEXT NOT NULL,message_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(guild_id,channel_id));
 CREATE TABLE IF NOT EXISTS ticket_panel_locks(channel_id TEXT PRIMARY KEY,token TEXT NOT NULL,lease_until INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS transcript_deliveries(ticket_id TEXT PRIMARY KEY REFERENCES tickets(id),log_status TEXT NOT NULL DEFAULT 'pending',log_message_ids TEXT NOT NULL DEFAULT '[]',summary_id TEXT,dm_status TEXT NOT NULL DEFAULT 'pending',dm_message_ids TEXT NOT NULL DEFAULT '[]',dm_attempted_at INTEGER,delivered_at INTEGER,error_code TEXT);
 CREATE TABLE IF NOT EXISTS ticket_confirmations(id TEXT PRIMARY KEY,ticket_id TEXT NOT NULL REFERENCES tickets(id),user_id TEXT NOT NULL,action TEXT NOT NULL,payload TEXT NOT NULL,expires_at INTEGER NOT NULL);
 INSERT OR IGNORE INTO ticket_migrations VALUES(1,CAST(strftime('%s','now') AS INTEGER)*1000);
 `);
    }
    transaction(fn) {
        this.db.exec('BEGIN IMMEDIATE');
        try {
            const result = fn();
            this.db.exec('COMMIT');
            return result;
        }
        catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        }
    }
    decode(row) {
        if (!row)
            return null;
        return { ...JSON.parse(row.data), id: row.id, guildId: row.guild_id, number: row.number, creatorId: row.creator_id, category: row.category, channelId: row.channel_id, lifecycle: row.lifecycle, active: Boolean(row.active), claimantId: row.claimant_id, escalationLevel: row.escalation_level, version: row.version, operationToken: row.operation_token, leaseUntil: row.lease_until };
    }
    get(id) {
        return this.decode(this.db.prepare('SELECT * FROM tickets WHERE id=?').get(id));
    }
    byNumber(guildId, number) {
        return this.decode(this.db.prepare('SELECT * FROM tickets WHERE guild_id=? AND number=?').get(guildId, number));
    }
    byChannel(channelId) {
        return this.decode(this.db.prepare('SELECT * FROM tickets WHERE channel_id=?').get(channelId));
    }
    activeFor(guildId, creatorId, category) {
        return this.decode(this.db.prepare('SELECT * FROM tickets WHERE guild_id=? AND creator_id=? AND category=? AND active=1').get(guildId, creatorId, category));
    }
    activeForMember(guildId,creatorId){return this.decode(this.db.prepare('SELECT * FROM tickets WHERE guild_id=? AND creator_id=? AND active=1 ORDER BY number LIMIT 1').get(guildId,creatorId));}
    listActive(guildId) {
        return this.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND (active=1 OR lifecycle='CLOSING') ORDER BY number").all(guildId).map(row => this.decode(row));
    }
    event(id, type, actorId, data = {}) {
        this.db.prepare('INSERT INTO ticket_events(ticket_id,type,actor_id,created_at,data) VALUES(?,?,?,?,?)').run(id, type, actorId, Date.now(), JSON.stringify(data));
    }
    events(id) {
        return this.db.prepare('SELECT * FROM ticket_events WHERE ticket_id=? ORDER BY id').all(id).map(row => ({ id: row.id, type: row.type, actorId: row.actor_id, at: row.created_at, ...JSON.parse(row.data) }));
    }
    reserve(input) {
        return this.transaction(() => {
            const existing = input.singleActive?this.activeForMember(input.guildId,input.creatorId):this.activeFor(input.guildId, input.creatorId, input.category);
            if (existing)
                return { ticket: existing, created: false };
            this.db.prepare('INSERT OR IGNORE INTO ticket_counters(guild_id,last_number) VALUES(?,?)').run(input.guildId, Math.max(0, this.startingNumber - 1));
            const { last_number: number } = this.db.prepare('UPDATE ticket_counters SET last_number=last_number+1 WHERE guild_id=? RETURNING last_number').get(input.guildId);
            const id = randomUUID(), data = { ...input, createdAt: input.createdAt??Date.now(), panelMessageId: null, openingPingId: null, escalatedRoles: [], escalatedCategories: [], nameSyncPending: true, panelSyncPending: true, errorCode: null, closure: null };
            this.db.prepare("INSERT INTO tickets(id,guild_id,number,creator_id,category,channel_id,lifecycle,active,data) VALUES(?,?,?,?,?,?,?,?,?)").run(id, input.guildId, number, input.creatorId, input.category,input.channelId??null,input.initialLifecycle??'CREATING',input.initialActive===false?0:1, JSON.stringify(data));
            this.db.prepare('INSERT INTO transcript_deliveries(ticket_id) VALUES(?)').run(id);
            this.event(id, 'creation_reserved', input.creatorId, { number, category: input.category });
            return { ticket: this.get(id), created: true };
        });
    }
    acquire(id, purpose, leaseMs = 180000) {
        return this.transaction(() => {
            const t = this.get(id);
            if (!t)
                throw new TicketError('Ticket not found.');
            if (t.operationToken && t.leaseUntil > Date.now())
                throw new TicketError('Another ticket update is in progress. Try again shortly.', 'TICKET_BUSY');
            const token = randomUUID();
            this.db.prepare('UPDATE tickets SET operation_token=?,lease_until=? WHERE id=?').run(token, Date.now() + leaseMs, id);
            return token;
        });
    }
    heartbeat(id, token, leaseMs = 180000) {
        if (!this.db.prepare('UPDATE tickets SET lease_until=? WHERE id=? AND operation_token=?').run(Date.now() + leaseMs, id, token).changes)
            throw new TicketError('Ticket processing ownership changed. Retry the action.', 'LEASE_LOST');
    }
    release(id, token) {
        this.db.prepare('UPDATE tickets SET operation_token=NULL,lease_until=0 WHERE id=? AND operation_token=?').run(id, token);
    }
    update(id, changes, actorId, type, metadata = {}, token) {
        return this.transaction(() => {
            const old = this.get(id);
            if (!old)
                throw new TicketError('Ticket not found.');
            if (token && old.operationToken !== token)
                throw new TicketError('Ticket processing ownership changed.', 'LEASE_LOST');
            if (!token && old.operationToken && old.leaseUntil > Date.now())
                throw new TicketError('Another ticket update is in progress.', 'TICKET_BUSY');
            const delta = typeof changes === 'function' ? changes(old) : changes;
            const next = { ...old, ...delta };
            const result = this.db.prepare('UPDATE tickets SET category=?,channel_id=?,lifecycle=?,active=?,claimant_id=?,escalation_level=?,version=version+1,data=? WHERE id=? AND version=?').run(next.category,next.channelId ?? null, next.lifecycle, next.active ? 1 : 0, next.claimantId ?? null, next.escalationLevel ?? 0, JSON.stringify(next), id, old.version);
            if (!result.changes)
                throw new TicketError('This ticket changed. Refresh before trying again.');
            if (type)
                this.event(id, type, actorId, metadata);
            return this.get(id);
        });
    }
    confirmation(ticketId, userId, action, payload, seconds = 120) {
        const id = randomUUID();
        this.db.prepare('DELETE FROM ticket_confirmations WHERE expires_at<?').run(Date.now());
        this.db.prepare('INSERT INTO ticket_confirmations VALUES(?,?,?,?,?,?)').run(id, ticketId, userId, action, JSON.stringify(payload), Date.now() + seconds * 1000);
        return id;
    }
    peekConfirmation(id, userId) {
        const row = this.db.prepare('SELECT * FROM ticket_confirmations WHERE id=? AND user_id=? AND expires_at>=?').get(id, userId, Date.now());
        if (!row)
            throw new TicketError('This confirmation expired or belongs to another member.');
        return { ...row, payload: JSON.parse(row.payload) };
    }
    consumeConfirmation(id, userId) {
        return this.transaction(() => {
            const row = this.peekConfirmation(id, userId);
            this.db.prepare('DELETE FROM ticket_confirmations WHERE id=?').run(id);
            return row;
        });
    }
    panels(guildId) {
        return this.db.prepare('SELECT * FROM ticket_panels WHERE guild_id=?').all(guildId);
    }
    acquirePanel(channelId, leaseMs) {
        return this.transaction(() => {
            const old = this.db.prepare('SELECT * FROM ticket_panel_locks WHERE channel_id=?').get(channelId);
            if (old && old.lease_until > Date.now())
                throw new TicketError('This support panel is already being updated.', 'TICKET_BUSY');
            const token = randomUUID();
            this.db.prepare('INSERT INTO ticket_panel_locks VALUES(?,?,?) ON CONFLICT(channel_id) DO UPDATE SET token=excluded.token,lease_until=excluded.lease_until').run(channelId, token, Date.now() + leaseMs);
            return token;
        });
    }
    releasePanel(channelId, token) {
        this.db.prepare('DELETE FROM ticket_panel_locks WHERE channel_id=? AND token=?').run(channelId, token);
    }
    savePanel(guildId, channelId, messageId) {
        this.db.prepare('INSERT INTO ticket_panels VALUES(?,?,?,?) ON CONFLICT(guild_id,channel_id) DO UPDATE SET message_id=excluded.message_id').run(guildId, channelId, messageId, Date.now());
    }
    /** @returns {any} */
    delivery(id) {
        const row = this.db.prepare('SELECT * FROM transcript_deliveries WHERE ticket_id=?').get(id);
        return { ...row, logMessageIds: JSON.parse(row.log_message_ids), dmMessageIds: JSON.parse(row.dm_message_ids) };
    }
    updateDelivery(id, changes) {
        const columns = { logStatus: 'log_status', logMessageIds: 'log_message_ids', summaryId: 'summary_id', dmStatus: 'dm_status', dmMessageIds: 'dm_message_ids', dmAttemptedAt: 'dm_attempted_at', deliveredAt: 'delivered_at', errorCode: 'error_code' };
        const entries = Object.entries(changes);
        if (entries.some(([k]) => !columns[k]))
            throw Error('Unknown delivery field');
        this.db.prepare('UPDATE transcript_deliveries SET ' + entries.map(([k]) => columns[k] + '=?').join(',') + ' WHERE ticket_id=?').run(...entries.map(([k, v]) => k.endsWith('Ids') ? JSON.stringify(v) : v), id);
    }
    close() {
        this.db.close();
    }
}
