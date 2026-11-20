import { initialState, transition } from './model.js';
export class SessionRepository {
  constructor(db, config) { this.db = db; this.config = config; }
  async initialize(seed = initialState()) {
    seed.configuration = { roles: this.config.roles, channels: this.config.channels, settings: this.config.settings };
    await this.db.$executeRawUnsafe('INSERT INTO "SessionHub" ("guildId", "data") VALUES ($1, $2::jsonb) ON CONFLICT ("guildId") DO NOTHING', this.config.guildId, JSON.stringify(seed));
  }
  async read() { const [row] = await this.db.$queryRawUnsafe('SELECT "data" FROM "SessionHub" WHERE "guildId"=$1', this.config.guildId); return row?.data; }
  async act(action, actorId) {
    return this.db.$transaction(async tx => {
      const [row] = await tx.$queryRawUnsafe('SELECT "data" FROM "SessionHub" WHERE "guildId"=$1 FOR UPDATE', this.config.guildId);
      if (!row) throw Error('Session storage is not ready. Restart the bot to apply migrations.');
      const result = transition(row.data, action, actorId, this.config);
      for (const event of result.events) {
        if (event.kind === 'start') await tx.session.create({ data: { id: result.state.current.id, guildId: this.config.guildId, activeKey: this.config.guildId, hostId: actorId, status: 'active', startedAt: new Date(result.state.current.startedAt) } });
        if (event.kind === 'shutdown') await tx.session.update({ where: { id: result.state.current.id }, data: { status: 'ending', endedAt: new Date(result.state.current.endedAt), reason: result.state.current.reason } });
        await tx.$executeRawUnsafe('INSERT INTO "SessionHubEvent" ("id","guildId","kind","actorId","data") VALUES ($1,$2,$3,$4,$5::jsonb)', event.id, this.config.guildId, event.kind, actorId, JSON.stringify(event.data));
      }
      if (action.type === 'finalize' && row.data.current?.id === action.sessionId && result.state.mode === 'OFFLINE') await tx.session.update({ where: { id: action.sessionId }, data: { status: 'ended', activeKey: null } });
      await tx.$executeRawUnsafe('UPDATE "SessionHub" SET "data"=$2::jsonb,"version"="version"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "guildId"=$1', this.config.guildId, JSON.stringify(result.state));
      return result.state;
    });
  }
  async pending() { return this.db.$queryRawUnsafe('SELECT * FROM "SessionHubEvent" WHERE "guildId"=$1 AND NOT "complete" ORDER BY "createdAt", "id"', this.config.guildId); }
  async receipt(id, type, messageId) {
    const column = type === 'announcement' ? 'announcementMessageId' : 'logMessageId';
    await this.db.$executeRawUnsafe(`UPDATE "SessionHubEvent" SET "${column}"=$2 WHERE "id"=$1 AND "guildId"=$3`, id, messageId, this.config.guildId);
    if (type === 'announcement') await this.db.$transaction(async tx => {
      const [row] = await tx.$queryRawUnsafe('SELECT "data" FROM "SessionHub" WHERE "guildId"=$1 FOR UPDATE', this.config.guildId);
      const [event] = await tx.$queryRawUnsafe('SELECT "data","kind" FROM "SessionHubEvent" WHERE "id"=$1', id);
      if (event.kind === 'vote' && row.data.vote?.id === event.data.voteId) row.data.vote.messageId = messageId;
      await tx.$executeRawUnsafe('UPDATE "SessionHub" SET "data"=$2::jsonb WHERE "guildId"=$1', this.config.guildId, JSON.stringify(row.data));
    });
  }
  async complete(id) { await this.db.$executeRawUnsafe('UPDATE "SessionHubEvent" SET "complete"=TRUE WHERE "id"=$1 AND "guildId"=$2', id, this.config.guildId); }
}
