import { randomUUID } from 'node:crypto';
export class PromotionRepository {
  constructor(db, config) { this.db = db; this.config = config; }
  async get(id, tx = this.db) { const [row] = await tx.$queryRawUnsafe('SELECT * FROM "PromotionOperation" WHERE "id"=$1 AND "guildId"=$2', id, this.config.guildId); return row; }
  async create(input) {
    return this.db.$transaction(async tx => {
      await tx.$executeRawUnsafe('UPDATE "PromotionOperation" SET "status"=\'expired\',"activeKey"=NULL WHERE "guildId"=$1 AND "memberId"=$2 AND "status"=\'preview\' AND "expiresAt"<CURRENT_TIMESTAMP', this.config.guildId, input.memberId);
      const [existing] = await tx.$queryRawUnsafe('SELECT * FROM "PromotionOperation" WHERE "activeKey"=$1', this.config.guildId + ':' + input.memberId);
      if (existing) {
        if (existing.status === 'preview' && existing.actorId === input.actorId && existing.rankId === input.rankId && existing.reason === input.reason) return existing;
        throw Error('A promotion is already pending or requires reconciliation for this member. Cancel the existing preview or wait for its expiry.');
      }
      const id = randomUUID();
      await tx.$executeRawUnsafe('INSERT INTO "PromotionOperation" ("id","guildId","actorId","memberId","rankId","reason","activeKey","data","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)', id, this.config.guildId, input.actorId, input.memberId, input.rankId, input.reason, this.config.guildId + ':' + input.memberId, JSON.stringify(input.data), new Date(Date.now() + this.config.confirmationMs));
      return this.get(id, tx);
    });
  }
  async claim(id, actorId, cancel = false) {
    return this.db.$transaction(async tx => {
      const [row] = await tx.$queryRawUnsafe('SELECT * FROM "PromotionOperation" WHERE "id"=$1 AND "guildId"=$2 FOR UPDATE', id, this.config.guildId);
      if (!row || row.actorId !== actorId) throw Error('Only the original command executor may use this confirmation.');
      if (row.status === 'applied' && !cancel) return row;
      if (row.status !== 'preview') throw Error('This promotion confirmation is no longer active.');
      if (new Date(row.expiresAt).getTime() <= Date.now()) throw Error('This promotion confirmation expired. Run /promote again.');
      await tx.$executeRawUnsafe('UPDATE "PromotionOperation" SET "status"=$2,"activeKey"=CASE WHEN $2=\'cancelled\' THEN NULL ELSE "activeKey" END,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', id, cancel ? 'cancelled' : 'applying');
      return this.get(id, tx);
    });
  }
  async save(row, status = row.status) {
    const active = ['preview','applying','uncertain'].includes(status) ? this.config.guildId + ':' + row.memberId : null;
    await this.db.$executeRawUnsafe('UPDATE "PromotionOperation" SET "status"=$2,"activeKey"=$3,"data"=$4::jsonb,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "guildId"=$5', row.id, status, active, JSON.stringify(row.data), this.config.guildId); row.status = status; return row;
  }
  async recovery() { return this.db.$queryRawUnsafe('SELECT * FROM "PromotionOperation" WHERE "guildId"=$1 AND ("status"=\'applying\' OR ("status"=\'applied\' AND NOT COALESCE(("data"->>\'delivered\')::boolean,FALSE)) OR ("status"=\'preview\' AND "expiresAt"<CURRENT_TIMESTAMP)) ORDER BY "createdAt"', this.config.guildId); }
}
