import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { PermissionFlagsBits } from 'discord.js';
import { db, audit } from '../../../../packages/shared/src/database.js';
import { ids } from '../../../../config/ids.js';
import { promotionConfig } from '../../../../config/promotions.js';
import { isBotOwner } from '../owner-access.js';
import { staffLocks } from '../staff-locks.js';
import { promotionPlan, destinationAuthorized, sameRoles } from './model.js';
import { PromotionRepository } from './repository.js';
import { card, announcement, directMessage, logCard, success } from './views.js';
export { promoteCommand } from './views.js';
const nonce = value => createHash('sha256').update(value).digest('hex').slice(0,24);
const roleIds = member => [...member.roles.cache.keys()];
export class Promotions {
  constructor(client, service, config = promotionConfig, repository = new PromotionRepository(db, config)) {
    Object.assign(this, { client, service, config: structuredClone(config), repository }); this.processing = new Set(); this.work = new Set(); this.stopped = false;
  }
  async guild() { return this.client.guilds.fetch(this.config.guildId); }
  profile(id) { const g = this.service.store.guild(this.config.guildId); return g.records[`profile:${id}`] ??= {}; }
  async persistProfile(row, status) {
    const g = this.service.store.guild(this.config.guildId), p = this.profile(row.memberId);
    p.roleOperation = { id: 'PROMO-' + row.id, kind: 'promotion', status, actor: row.actorId, at: Date.now(), reason: row.reason, before: row.data.plan.beforeManaged, after: row.data.plan.desired };
    if (status === 'applied') { g.records['RANK-' + row.id] = { id: 'RANK-' + row.id, kind: 'promote', member: row.memberId, oldRank: row.data.plan.previousRankId, newRank: row.rankId, actor: row.actorId, reason: row.reason, at: row.data.appliedAt, promotionId: row.id }; }
    this.service.store.save(); await this.service.store.flush();
  }
  async validate(actorId, memberId, rankId, { ownOperation = null } = {}) {
    if (this.service.store.guild(this.config.guildId).config?.commandLockdown && !isBotOwner(actorId)) throw Error('Owner emergency command lockdown is active.');
    const guild = await this.guild();
    const [actor, member, bot] = await Promise.all([guild.members.fetch({ user: actorId, force: true }), guild.members.fetch({ user: memberId, force: true }), guild.members.fetchMe()]);
    if (member.user.bot || memberId === actorId) throw Error('Bots and self-promotions are not allowed.');
    if (memberId === guild.ownerId || ids.owners.includes(memberId) || ids.roles.owner && member.roles.cache.has(ids.roles.owner)) throw Error('This account is a protected owner.');
    const owner = isBotOwner(actorId), actorRoles = roleIds(actor), targetRoles = roleIds(member);
    const plan = promotionPlan(targetRoles, rankId, this.config);
    if (plan.previousRankId) plan.previousRankName = member.roles.cache.get(plan.previousRankId)?.name || plan.previousRankName;
    if (!owner && !destinationAuthorized(actorRoles, rankId, this.config)) throw Error('You do not have permission to promote into this destination team.');
    const locked = member.roles.cache.has(this.config.rankLockRoleId), override = actor.roles.cache.has(this.config.rankLockOverrideRoleId);
    if (locked && !owner && !override) throw Error('This member has Rank Lock. The configured Rank Lock Override role is required.');
    if (!owner && (member.roles.highest.position >= actor.roles.highest.position)) throw Error('The member is at or above your Discord role hierarchy.');
    if (!bot.permissions.has(PermissionFlagsBits.ManageRoles)) throw Error('The bot needs Manage Roles.');
    if (member.roles.highest.position >= bot.roles.highest.position) throw Error('Move the bot role above the affected member.');
    const profile = this.profile(memberId);
    if (profile.restriction && !profile.restriction.completedAt || [ids.disciplineRoles.suspended, ids.disciplineRoles.investigation, ids.disciplineRoles.terminated].some(id => member.roles.cache.has(id))) throw Error('Resolve the existing staff restriction before promotion.');
    if (['pending','uncertain'].includes(profile.roleOperation?.status) && profile.roleOperation.id !== 'PROMO-' + ownOperation) throw Error('An earlier staff role operation requires review.');
    const required = [...new Set([...plan.desired, ...plan.remove])];
    const dangerous = [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ManageWebhooks];
    for (const id of required) {
      const role = await guild.roles.fetch(id);
      if (!role || role.managed || role.position >= bot.roles.highest.position) throw Error('The bot cannot manage every configured destination/previous role. Check role hierarchy and configuration.');
      if (id === rankId) plan.rankName = role.name;
      if (!owner && role.position >= actor.roles.highest.position) throw Error('A required role is at or above your Discord role hierarchy.');
      if (plan.add.includes(id) && !owner && dangerous.some(p => role.permissions.has(p) && !actor.permissions.has(p))) throw Error('The destination would grant permissions you do not possess.');
    }
    return { guild, actor, member, bot, plan, lockOverride: locked ? owner ? 'Configured owner' : 'Rank Lock Override role' : null };
  }
  async channels() {
    if (![this.config.assets.banner,this.config.assets.footer].every(path => fs.existsSync(path))) throw Error('The configured Promotions banner or footer is missing. Restore the supplied artwork before promoting.');
    const guild = await this.guild(), bot = await guild.members.fetchMe(), result = {};
    for (const [key,id] of [['announcement',this.config.announcementChannelId],['log',this.config.logChannelId]]) {
      const channel = await guild.channels.fetch(id);
      if (!channel?.isTextBased() || !channel.send || ![PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles].every(p => channel.permissionsFor(bot)?.has(p))) throw Error('The configured promotion channels or bot permissions are unavailable.');
      if (key === 'log' && channel.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel)) throw Error('Promotion logs must be private before promotions can run.');
      result[key] = channel;
    }
    const icon = await guild.emojis.fetch(this.config.iconId).catch(() => null); this.config.iconName = icon?.name ?? null;
    return result;
  }
  async exclusive(memberId, fn) {
    const key = this.config.guildId + ':' + memberId;
    if (staffLocks.has(key)) throw Error('Another promotion or staff update is in progress for this member.');
    staffLocks.add(key); try { return await fn(); } finally { staffLocks.delete(key); }
  }
  async begin(actorId, memberId, rankId, reason) {
    if (typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 1000) throw Error('Provide a promotion reason between 3 and 1000 characters.');
    return this.exclusive(memberId, async () => {
      const valid = await this.validate(actorId, memberId, rankId); await this.channels();
      const row = await this.repository.create({ actorId, memberId, rankId, reason: reason.trim(), data: { plan: valid.plan, actorName: valid.actor.displayName || valid.actor.user.username, lockOverride: valid.lockOverride, appliedAdd: [], appliedRemove: [], pendingStep: null, dmStatus: 'pending', delivered: false } });
      await audit(actorId, 'promotion.preview', row.id, null, { memberId, rankId }); return row;
    });
  }
  managed(member) {
    const managed = new Set([this.config.staffRoleId,this.config.staffSeparatorId,...this.config.groups.flatMap(g => [...g.auxiliary,...g.ranks.map(r => r.id)])]);
    return roleIds(member).filter(id => managed.has(id));
  }
  expected(row) { const ids = new Set(row.data.plan.beforeManaged); for (const id of row.data.appliedAdd) ids.add(id); for (const id of row.data.appliedRemove) ids.delete(id); return [...ids]; }
  async step(row, type, roleId) {
    const member = await (await this.guild()).members.fetch({ user: row.memberId, force: true });
    if (!sameRoles(this.managed(member),this.expected(row))) throw Error('Managed staff roles changed while the promotion was executing.');
    row.data.pendingStep = { type, roleId }; await this.repository.save(row);
    const reason = ('Promotion ' + row.id + ': ' + row.reason).slice(0,500);
    if (type === 'add') await member.roles.add(roleId, reason); else await member.roles.remove(roleId, reason);
    row.data[type === 'add' ? 'appliedAdd' : 'appliedRemove'].push(roleId); row.data.pendingStep = null; await this.repository.save(row);
  }
  async rollback(row) {
    const guild = await this.guild(); let member = await guild.members.fetch({ user: row.memberId, force: true });
    const expected = this.expected(row), pending = row.data.pendingStep;
    if (pending) {
      const after = new Set(expected); if (pending.type === 'add') after.add(pending.roleId); else after.delete(pending.roleId);
      if (sameRoles(this.managed(member),after)) { row.data[pending.type === 'add' ? 'appliedAdd' : 'appliedRemove'].push(pending.roleId); row.data.pendingStep = null; await this.repository.save(row); }
      else if (!sameRoles(this.managed(member),expected)) throw Error('External managed role changes require manual reconciliation.');
    } else if (!sameRoles(this.managed(member),expected)) throw Error('External managed role changes require manual reconciliation.');
    for (const id of [...row.data.appliedRemove].reverse()) await member.roles.add(id, 'Restore interrupted promotion ' + row.id);
    for (const id of [...row.data.appliedAdd].reverse()) await member.roles.remove(id, 'Restore interrupted promotion ' + row.id);
    member = await guild.members.fetch({ user: row.memberId, force: true });
    if (!sameRoles(this.managed(member),row.data.plan.beforeManaged)) throw Error('The original managed roles could not be verified.');
    await this.repository.save(row,'rolled_back'); await this.persistProfile(row,'rolled_back');
  }
  async applied(row) {
    row.data.pendingStep = null; row.data.appliedAt = Date.now(); await this.repository.save(row,'applied'); await this.persistProfile(row,'applied');
    await audit(row.actorId,'promotion.applied',row.id,{roles:row.data.plan.beforeManaged},{roles:row.data.plan.desired,memberId:row.memberId});
  }
  async confirm(id, actorId) {
    const initial = await this.repository.get(id); if (!initial || initial.actorId !== actorId) throw Error('Only the original command executor may confirm.');
    return this.exclusive(initial.memberId, async () => {
      let row = await this.repository.get(id);
      if (row.status === 'applied') { if(!row.data.delivered)try{await this.deliver(row);}catch{}return row; }
      const valid = await this.validate(actorId,row.memberId,row.rankId,{ownOperation:row.id});
      if (!sameRoles(valid.plan.beforeManaged,row.data.plan.beforeManaged) || !sameRoles(valid.plan.desired,row.data.plan.desired) || !sameRoles(valid.plan.add,row.data.plan.add) || !sameRoles(valid.plan.remove,row.data.plan.remove)) throw Error('The staff roles or promotion configuration changed after the preview. Cancel this preview and run /promote again.');
      await this.channels(); row = await this.repository.claim(id,actorId); row.data.lockOverride = valid.lockOverride;
      row.data.plan.rankName = valid.plan.rankName;
      await this.persistProfile(row,'pending');
      try {
        for (const id of row.data.plan.add) await this.step(row,'add',id);
        for (const id of row.data.plan.remove) await this.step(row,'remove',id);
        const fresh = await valid.guild.members.fetch({user:row.memberId,force:true});
        if (!sameRoles(this.managed(fresh),row.data.plan.desired)) throw Error('Discord did not verify the destination role bundle.');
        await this.applied(row);
      } catch {
        row.data.failure = 'Role application interrupted; reconciliation required.';
        try {
          const fresh = await valid.guild.members.fetch({user:row.memberId,force:true});
          if (sameRoles(this.managed(fresh),row.data.plan.desired)) await this.applied(row); else await this.rollback(row);
        } catch { await this.repository.save(row,'uncertain'); await this.persistProfile(row,'uncertain'); }
        if (row.status !== 'applied') { await this.failureLog(row); throw Error(row.status === 'rolled_back' ? 'Promotion failed. The original managed roles were restored and verified; unrelated roles were preserved.' : 'Promotion could not be verified. Its saved role operation requires administrator reconciliation; no success was declared.'); }
      }
      try { await this.deliver(row); } catch { /* Verified role success remains saved; recovery retries announcement/log delivery. */ }
      return row;
    });
  }
  async recoverMessage(channel, key, since) {
    let before;
    for (;;) { const batch = await channel.messages.fetch({limit:100,...(before?{before}:{})});
      const found = batch.find(m => m.author.id === this.client.user.id && JSON.stringify(m.components.map(c=>c.toJSON())).includes(key)); if(found)return found;
      if(!batch.size||batch.size<100||batch.last().createdTimestamp<new Date(since).getTime()-60000)return null;before=batch.last().id;
    }
  }
  async failureLog(row) {
    await audit(row.actorId,'promotion.'+row.status,row.id,null,{memberId:row.memberId,rankId:row.rankId});
    try { const {log}=await this.channels();if(!row.data.logId){const prior=await this.recoverMessage(log,row.id,new Date(row.createdAt));const m=prior||await log.send({...logCard(this.config,row),nonce:nonce(row.id+'log'),enforceNonce:true});row.data.logId=m.id;await this.repository.save(row);} }catch{console.error('Promotion failure log saved in database; Discord delivery unavailable.');}
  }
  async deliver(row) {
    const {announcement:channel,log}=await this.channels();
    if (!row.data.announcementId) { const old=await this.recoverMessage(channel,row.id,row.createdAt);const m=old||await channel.send({...announcement(this.config,row),nonce:nonce(row.id+'announcement'),enforceNonce:true});row.data.announcementId=m.id;await this.repository.save(row); }
    if (row.data.dmStatus === 'delivering') { row.data.dmStatus='uncertain after restart';await this.repository.save(row); }
    if (row.data.dmStatus === 'pending') {
      row.data.dmStatus='delivering';await this.repository.save(row);
      try { const member=await (await this.guild()).members.fetch({user:row.memberId,force:true});await member.user.send({...directMessage(this.config,row),nonce:nonce(row.id+'dm'),enforceNonce:true});row.data.dmStatus='sent'; }
      catch (error) { row.data.dmStatus=[50007,50013,10007,10013].includes(Number(error?.code))?'failed (DM unavailable)':'uncertain (Discord did not confirm delivery)'; }
      await this.repository.save(row);
    }
    if (!row.data.logId) { const old=await this.recoverMessage(log,row.id,row.createdAt);const m=old||await log.send({...logCard(this.config,row),nonce:nonce(row.id+'log'),enforceNonce:true});row.data.logId=m.id;await this.repository.save(row); }
    row.data.delivered=true;await this.repository.save(row);
  }
  async recover() {
    if (this.stopped || this.recovering) return;this.recovering=true;
    try { for(const candidate of await this.repository.recovery()) {
      if(this.stopped)break;
      try { await this.exclusive(candidate.memberId,async()=>{
        // A confirmation may finish after the recovery scan. Never replay an old
        // snapshot over its saved delivery receipts or completed role operation.
        const row=await this.repository.get(candidate.id);if(!row)return;
        if(row.status==='preview'){if(new Date(row.expiresAt).getTime()<=Date.now())await this.repository.save(row,'expired');return;}
        if(row.status!=='applying'&&row.status!=='applied'||row.data.delivered)return;
        const profile=this.profile(row.memberId);
        if(row.status==='applied'&&profile.roleOperation?.id==='PROMO-'+row.id&&profile.roleOperation.status==='pending')await this.persistProfile(row,'applied');
        if(row.status==='applying') {const member=await(await this.guild()).members.fetch({user:row.memberId,force:true});try{if(sameRoles(this.managed(member),row.data.plan.desired))await this.applied(row);else await this.rollback(row);}catch{await this.repository.save(row,'uncertain');await this.persistProfile(row,'uncertain');}}
        if(row.status==='applied')await this.deliver(row);else await this.failureLog(row);
      }); }catch{console.error('Promotion recovery will retry; saved records preserved.');}
    }}finally{this.recovering=false;}
  }
  start() { const run=()=>{this.recoveryWork=this.recover().catch(()=>console.error('Promotion storage unavailable. Apply the promotion database migration.'));};this.timer=setInterval(run,60000);this.timer.unref();run(); }
  async stop() {this.stopped=true;clearInterval(this.timer);await Promise.allSettled([...this.work,this.recoveryWork].filter(Boolean));}
  async interaction(i) {
    const command=i.isChatInputCommand?.()&&i.commandName==='promote', autocomplete=i.isAutocomplete?.()&&i.commandName==='promote', button='customId'in i&&i.customId.startsWith('nycp:');
    if(!command&&!autocomplete&&!button)return false;
    if(autocomplete){const focused=String(i.options.getFocused()).toLowerCase();if(i.guildId!==this.config.guildId){await i.respond([]);return true;}const guild=await this.guild(),member=await guild.members.fetch({user:i.user.id,force:true});await i.respond(this.config.groups.flatMap(g=>g.ranks).filter(r=>r.name.toLowerCase().includes(focused)&&(isBotOwner(i.user.id)||destinationAuthorized(roleIds(member),r.id,this.config))).slice(0,25).map(r=>({name:r.name,value:r.id})));return true;}
    if(button)await i.deferUpdate();else await i.deferReply({flags:64});
    const work=(async()=>{try{
      if(i.guildId!==this.config.guildId)throw Error('Use promotion commands in the main NYC server.');
      if(command){const pending=await this.begin(i.user.id,i.options.getUser('user',true).id,i.options.getString('rank',true),i.options.getString('reason',true));const row=await this.confirm(pending.id,i.user.id);await i.editReply(success(this.config,row));return;}
      const [,action,id]=i.customId.split(':');
      if(action==='cancel'){const row=await this.repository.claim(id,i.user.id,true);await i.editReply({...card(this.config,'Promotion Cancelled',['No roles were changed.'],row.id,{ephemeral:true}),attachments:[]});return;}
      throw Error('Promotion confirmation buttons have been removed. Run /promote to apply a promotion directly.');
    }catch(error){console.error('Promotion action failed:',error?.code||error?.name||'Error');try{await audit(i.user.id,'promotion.rejected',this.config.guildId,null,{code:error?.code||'PROMOTION_REJECTED',memberId:command?i.options.getUser('user')?.id:undefined});}catch{}const message=error instanceof Error&&!error.code?error.message:'The promotion could not complete. Its saved record is preserved; check the private audit history.';await i.editReply({...card(this.config,'Promotion Needs Attention',[message],'error',{ephemeral:true}),attachments:[]});}})();
    this.work.add(work);try{await work;}finally{this.work.delete(work);}return true;
  }
}
