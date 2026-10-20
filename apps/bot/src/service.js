import { ids } from '../../../config/ids.js';
import { randomUUID } from 'node:crypto';
import { ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { seeds, ticketCategories, departments } from './seeds.js';
import { render, notice, button, validateTemplate } from './panels.js';
import { access, requireAccess, canViewCase } from './access.js';
import { editReply } from './replies.js';

export const id = () => randomUUID().slice(0, 8);
const stamp = time => `<t:${Math.floor(time / 1000)}:f>`;
export class CommunityService {
  constructor(client, store) { this.client = client; this.store = store; }
  template(g, key) { const t = g.templates[key] ?? seeds[key]; if (!t) throw Error('Unknown template'); return t; }
  variables(g, member) {
    const c = g.config, s = g.sessions.at(-1), uid = member?.id;
    const shifts = Object.values(g.shifts).filter(x => x.start >= Date.now() - 7 * 86400000);
    const minutes = xs => Math.floor(xs.reduce((sum, x) => sum + ((x.end ?? Date.now()) - x.start), 0) / 60000);
    const profile = g.records[`profile:${uid}`] ?? {};
    return { community: c.community, server_name: c.serverName ?? c.community, join_code: c.joinCode, max_players: g.live?.maxPlayers ?? c.maxPlayers, current_players: g.live?.players?.length ?? 0, session_status: s && !s.end ? (g.live?.healthy ? 'ONLINE' : 'AWAITING LIVE SYNC') : 'OFFLINE', host: s ? `<@${s.host}>` : 'No active host', started: s ? stamp(s.start) : 'No session', ended: s?.end ? stamp(s.end) : 'Not ended', duration: s ? `${Math.floor(((s.end ?? Date.now()) - s.start) / 60000)} minutes` : 'No session', peak_players: s?.peak ?? 0, participants: s?.participants?.length ?? 0, reason: s?.reason ?? 'Not supplied', priority: c.priority, last_sync: g.live?.synced ? stamp(g.live.synced) : 'Not synchronized', member: uid ? `<@${uid}>` : 'Member', member_id: uid, member_count: member?.guild?.memberCount ?? 0, timestamp: stamp(Date.now()), weekly_minutes: c.weeklyMinutes, requirements: c.requirements, training: profile.training ?? 'Awaiting assessment', supervisor: profile.supervisor ?? 'Not assigned', discipline: profile.discipline ?? 'No recorded disciplinary status', rank: member?.roles?.highest?.name ?? 'Member', shift_status: Object.values(g.shifts).some(x => x.user === uid && !x.end) ? 'On duty' : 'Off duty', shift_minutes: minutes(shifts.filter(x => x.user === uid)), leaderboard: [...new Set(shifts.map(x => x.user))].map(user => ({ user, minutes: minutes(shifts.filter(x => x.user === user)) })).sort((a,b) => b.minutes-a.minutes).slice(0,15).map((x,i) => `${i+1}. <@${x.user}> — ${x.minutes} minutes`).join('\n') || 'No shifts recorded this week.', online_staff: Object.values(g.shifts).filter(x => !x.end).map(x => `<@${x.user}> — on duty`).join('\n') || 'No staff currently clocked in.', player_list: (g.live?.players ?? []).slice(0,25).map(p => p.Player ?? p.name ?? 'Unknown player').join('\n') || 'No live player data available.', application_list: departments.map((name, i) => `### ${name}\n**Status:** ${c.applications[i]?.open ? 'Open' : 'Closed'}\n**Requirements:** ${c.applications[i]?.requirements ?? 'Awaiting department configuration'}${c.applications[i]?.reviewPeriod ? `\n**Estimated review:** ${c.applications[i].reviewPeriod}` : ''}`).join('\n\n'), upcoming_sessions: Object.values(g.schedules).filter(x => !x.sent && x.key === 'ssu').map(x => stamp(x.at)).join('\n') || 'No upcoming sessions have been scheduled.' };
  }
  panel(g, key, member, vars = {}, page = 0, ephemeral = false) {
    if(key==='applications'&&member?.guild)return notice('Staff applications',`Start your application in <#${ids.channels.applicationsPanel}>.`, 'blue',ephemeral);
    const template = this.template(g, key);
    if (['case', 'ticket'].includes(template.audience)) throw Error('Open this private panel from its case or ticket.');
    if (template.audience && template.audience !== 'public') requireAccess(member, g.config, template.audience);
    const t = structuredClone(template);
    if (['polls','giveaways'].includes(key)) {
      const active=Object.values(g.records).filter(x=>x.kind===(key==='polls'?'poll':'giveaway')&&!x.closed&&x.end>Date.now()).slice(-3);
      t.sections.push(...active.map(x=>`### ${x.title}\n**Reference:** ${x.id}\n**Closes:** ${stamp(x.end)}`));
    }
    if (key === 'roles') {
      const roles = g.config.selfRoles;
      if (roles.length) t.select = { action: 'role', options: roles.map(r => ({ label: r.name, value: r.id })) };
    }
    return render(t, { ...this.variables(g, member), ...vars }, { page, ephemeral });
  }
  async publish(guildId, channelId, key, actor, vars = {}, publishedId) {
    const g = this.store.guild(guildId), guild = await this.client.guilds.fetch(guildId);
    if(key==='cad'){if(actor!==guild.ownerId)throw Error('Only the server owner may deploy CAD');channelId=ids.channels.cadPanel;}
    if(key==='applications')channelId=ids.channels.applicationsPanel;
    if(key==='community_rules')channelId=ids.channels.rules;
    const member = await guild.members.fetch(actor);
    requireAccess(member, g.config, 'management');
    const template = this.template(g, key);
    if (template.audience && template.audience !== 'public') throw Error('Restricted templates cannot be published through the public panel editor.');
    if (['ssu', 'ssd', 'session_vote'].includes(key)) throw Error('Use /session for stateful session messages.');
    const channel = await guild.channels.fetch(channelId);
    if (!channel?.isTextBased() || channel.isThread()) throw Error('Choose a guild text channel.');
    const payload = key==='applications'?render(this.template(g,key),{...this.variables(g,member),...vars}):this.panel(g, key, member, vars);
    let message;
    if (publishedId) {
      const p = g.published[publishedId];
      if (!p || p.channel !== channelId) throw Error('Published panel does not match channel');
      message = await (await channel.messages.fetch(p.message)).edit(payload);
    } else message = await channel.send(payload);
    const publication = { id: publishedId ?? id(), key, channel: channelId, message: message.id, vars };
    g.published[publication.id] = publication;
    this.store.change(guildId, actor, 'publish', publication);
    return publication;
  }
  form(i, purpose, title, fields) {
    const modal = new ModalBuilder().setCustomId(`ls:form:${purpose}`).setTitle(title.slice(0,45));
    for (const [key, label] of fields) modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(key).setLabel(label.slice(0,45)).setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)));
    return i.showModal(modal);
  }
  async interact(i) {
    if (!i.guildId) throw Error('Use this action inside the community server.');
    const member = await i.guild.members.fetch(i.user.id), g = this.store.guild(i.guildId);
    if (i.isModalSubmit()) return this.submit(i, g, member);
    const [, action, raw = ''] = i.customId.split(':');
    const arg = i.isStringSelectMenu() ? i.values[0] : raw;
    const [key, extra] = arg.split(',');
    const reply = payload => i.reply(payload);
    if (action === 'panel') return reply(this.panel(g, key, member, {}, Number(extra ?? 0), true));
    if (action === 'ack') {
      if (key === 'case' && !canViewCase(member, g.config, g.cases[extra])) throw Error('Case access denied');
      if (!['community_rules','server_rules','case'].includes(key)) throw Error('Unknown acknowledgment');
      g.acknowledgments[`${member.id}:${arg}`] = { at: Date.now(), version: g.templates[key]?.version ?? 1 };
      this.store.change(i.guildId, member.id, 'acknowledge', { key: arg });
      return reply(notice('✅ Rules acknowledged', 'Your acknowledgment has been saved.'));
    }
    if (action === 'verify') {
      if (!g.acknowledgments[`${member.id}:community_rules`] || !g.acknowledgments[`${member.id}:server_rules`]) throw Error('Read and acknowledge both rule panels before verification.');
      for(const rule of ['community_rules','server_rules']) if(g.acknowledgments[`${member.id}:${rule}`].version!==(g.templates[rule]?.version??1)) throw Error('The rules were updated. Please acknowledge the current versions.');
      if (!g.config.verifiedRole) throw Error('Management must configure a verification role first.');
      const role = await i.guild.roles.fetch(g.config.verifiedRole);
      if (!role || role.managed || role.permissions.bitfield !== 0n) throw Error('Verification roles must have no permissions.');
      await member.roles.add(role);
      this.store.change(i.guildId, member.id, 'verify', {});
      return reply(notice('✅ Verified', 'Verification complete. Welcome to the community!', 'green'));
    }
    if (action === 'ticket') {
      if (!ticketCategories[Number(key)]) throw Error('Unknown ticket category');
      return this.form(i, `ticket,${key}`, ticketCategories[Number(key)], [['summary','What do you need assistance with?'], ['evidence','Details, evidence links, or case ID']]);
    }
    if (action === 'apply') {
      if (!g.config.applications[key]?.open || !departments[Number(key)]) throw Error('This application is closed.');
      return this.form(i, `apply,${key}`, departments[Number(key)], [['experience','Relevant experience'], ['motivation','Why would you like to join?'], ['scenario','How would you handle a disruptive player?']]);
    }
    if (action === 'applicationStatus') {
      const entries = Object.values(g.applications).filter(x => x.user === member.id);
      return reply(notice('📨 Your Applications', entries.map(x => `**${departments[x.department]}:** ${x.status} (${x.id})\n${x.reason ?? ''}`).join('\n') || 'You have not submitted any applications.'));
    }
    if (action === 'vote' || action === 'results') {
      const vote = g.votes[key];
      if (!vote) throw Error('Vote not found');
      if (action === 'vote') {
        if (vote.end <= Date.now()) throw Error('Voting has ended');
        if (!['yes','no'].includes(extra)) throw Error('Invalid choice');
        vote.ballots[member.id] = extra;
        this.store.save();
        await i.deferReply({ flags: 64 });
        await this.updateVote(i.guild, g, vote);
        return editReply(i, notice('✅ Vote recorded', 'Your choice has been saved. Changing your choice replaces your previous vote.', 'green'));
      }
      return reply(render(seeds.session_vote, { ...this.variables(g,member), ...this.voteVars(vote) }, { ephemeral: true }));
    }
    if (action === 'case' || action === 'appeal') {
      const record = g.cases[key];
      if (!canViewCase(member, g.config, record)) throw Error('Case access denied');
      if (action === 'appeal') {
        if (record.memberId !== member.id) throw Error('Only the affected member may appeal.');
        return this.form(i, `appeal,${key}`, 'Appeal Punishment', [['reason', 'Why should this case be reviewed?'], ['evidence', 'Evidence or additional context']]);
      }
      return reply(render(this.template(g, record.kind), { ...this.variables(g,member), ...record.vars }, { ephemeral: true }));
    }
    if (action === 'history') {
      if (key !== member.id) requireAccess(member, g.config);
      const entries = Object.values(g.cases).filter(x => x.memberId === key && canViewCase(member,g.config,x));
      return reply(notice('📋 Moderation History', entries.slice(-12).map(x => `**${x.id} — ${x.kind}:** ${x.reason}`).join('\n') || 'No cases found.'));
    }
    if (action === 'shift') {
      requireAccess(member,g.config);
      const current = Object.values(g.shifts).find(x => x.user === member.id && !x.end);
      if (key === 'in') { if (current) throw Error('Already clocked in'); const shift = { id:id(),user:member.id,start:Date.now() }; g.shifts[shift.id] = shift; }
      else { if (!current) throw Error('No active shift'); current.end = Date.now(); }
      this.store.change(i.guildId,member.id,'shift',{action:key});
      return reply(this.panel(g,'staff_clock',member,{},0,true));
    }
    if (action === 'ticketAction') return this.ticketAction(i,g,member,key,extra);
    if (action === 'review') {
      requireAccess(member,g.config,'management');
      if (!g.applications[key] || !['accepted','denied'].includes(extra)) throw Error('Application not found');
      return this.form(i,`review,${key},${extra}`,'Application Review',[['reason','Review notes and decision reason']]);
    }
    if (action === 'role') {
      if (!g.config.selfRoles.some(x => x.id === key)) throw Error('Role not approved for self-service');
      const role = await i.guild.roles.fetch(key);
      if (!role || role.managed || role.permissions.bitfield !== 0n) throw Error('Self-service roles must have no permissions.');
      await (member.roles.cache.has(key) ? member.roles.remove(key) : member.roles.add(key));
      return reply(notice('✅ Role updated','Your role selection has been applied.','green'));
    }
    if (action === 'dispatchAssign' || action === 'dispatchAck') {
      requireAccess(member,g.config,'department');
      const call = g.records[`cad:${key}`]; if (!call) throw Error('Call not found');
      if (action === 'dispatchAssign') call.units = [...new Set([...(call.units ?? []),member.id])];
      else call.acknowledged = [...new Set([...(call.acknowledged ?? []),member.id])];
      this.store.change(i.guildId,member.id,action,{call:key});
      return reply(notice('📡 Dispatch updated',`Call ${key} updated. Assigned units: ${(call.units ?? []).map(x=>`<@${x}>`).join(', ') || 'None'}`,'cyan'));
    }
    if (action === 'record') {
      if (key === 'cad') { requireAccess(member,g.config,'department'); const call=g.records[`cad:${extra}`]; if(!call) throw Error('Call not found'); return reply(notice('📡 CAD Record',JSON.stringify(call,null,2).slice(0,3000),'cyan')); }
      if (!['leave','suggestion'].includes(key)) throw Error('Unknown form');
      if (key === 'leave') requireAccess(member,g.config);
      return this.form(i,`record,${key}`,key === 'leave' ? 'Leave Request' : 'Community Suggestion',[['details',key === 'leave' ? 'Start date, return date, and reason' : 'Your suggestion and expected benefit']]);
    }
    if(action==='activity') {
      const activity=g.records[key];if(!activity||!['poll','giveaway'].includes(activity.kind))throw Error('Activity not found');
      if(activity.closed||activity.end<=Date.now())throw Error('This activity has ended');
      if(activity.kind==='poll'&&(!Number.isInteger(Number(extra))||!activity.options[Number(extra)]))throw Error('Invalid poll option');
      activity.entries[member.id]=activity.kind==='poll'?Number(extra):true;this.store.save();
      await i.deferReply({flags:64});
      const channel=await i.guild.channels.fetch(activity.channel);await(await channel.messages.fetch(activity.message)).edit(this.activityPanel(g,activity));
      return editReply(i, notice('✅ Entry recorded',activity.kind==='poll'?'Your vote is saved. Changes replace your previous vote.':'Your giveaway entry is saved. Each member receives one entry.','green'));
    }
    if (action === 'feedback') { const ticket=g.tickets[key]; if(!ticket || ticket.user!==member.id || !['1','2','3','4','5'].includes(extra)) throw Error('Feedback access denied'); ticket.feedback=Number(extra);this.store.save();return reply(notice('✅ Feedback saved','Thank you for helping us improve.','green')); }
    throw Error('Unknown interaction');
  }
  async submit(i,g,member) {
    const [purpose,key,state] = i.customId.slice('ls:form:'.length).split(',');
    const answers = Object.fromEntries([...i.fields.fields.values()].map(x => [x.customId,x.value]));
    if (purpose === 'ticket') {
      if (!ticketCategories[Number(key)]) throw Error('Unknown ticket category');
      if (Object.values(g.tickets).some(x => x.user === member.id && x.status !== 'closed')) throw Error('You already have an open ticket.');
      const restricted = ['2','4','6'].includes(key), roles = restricted ? g.config.managementRoles : [...g.config.staffRoles,...g.config.managementRoles];
      if (!roles.length) throw Error('Management must configure support roles first.');
      await i.deferReply({flags:64});
      const ticketId=id();
      const channel = await i.guild.channels.create({ name:`ticket-${ticketId}`,type:ChannelType.GuildText,parent:g.config.ticketCategory || undefined,permissionOverwrites:[{id:i.guild.id,deny:[PermissionFlagsBits.ViewChannel]},{id:member.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},{id:this.client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels]},...roles.map(role=>({id:role,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]}))] });
      const ticket={id:ticketId,user:member.id,category:Number(key),restricted,channel:channel.id,status:'created',request:Object.values(answers).join('\n'),created:Date.now()};
      g.tickets[ticketId]=ticket;this.store.change(i.guildId,member.id,'ticket-created',ticket);
      await channel.send(this.ticketPanel(g,ticket));
      return editReply(i, notice('🎫 Ticket created',`Your private ticket is ready: <#${channel.id}>`,'green'));
    }
    if (purpose === 'apply') {
      if (!g.config.applications[key]?.open || !departments[Number(key)]) throw Error('Application closed');
      if (Object.values(g.applications).some(x=>x.user===member.id && x.department===Number(key) && x.status==='submitted')) throw Error('An application is already pending.');
      if (!g.config.applicationReviewChannel) throw Error('Configure a restricted application review channel first.');
      const app={id:id(),user:member.id,department:Number(key),answers,status:'submitted',at:Date.now()};
      await i.deferReply({flags:64});
      const channel=await this.restrictedChannel(i.guild,g,'applicationReviewChannel','management');
      const t={title:'📨 APPLICATION REVIEW',color:'purple',sections:[`**Applicant:** <@${member.id}>\n**Department:** ${departments[key]}`, ...Object.entries(answers).map(([k,v])=>`**${k}:** ${v}`)],buttons:[button('Accept','review',`${app.id},accepted`,3),button('Deny','review',`${app.id},denied`,4)]};
      await channel.send(render(t,this.variables(g,member)));
      g.applications[app.id]=app;this.store.change(i.guildId,member.id,'application-submitted',app);
      return editReply(i, notice('📨 Application submitted',`Your application reference is **${app.id}**. Check status from the Application Center.`,'green'));
    }
    if (purpose === 'review') {
      requireAccess(member,g.config,'management');
      const app=g.applications[key];if(!app || app.status!=='submitted' || !['accepted','denied'].includes(state)) throw Error('Application is no longer pending');
      app.status=state;app.reason=answers.reason;app.reviewer=member.id;
      this.store.change(i.guildId,member.id,'application-reviewed',app);
      await i.deferReply({flags:64});
      const user=await this.client.users.fetch(app.user);
      try { await user.send(render(seeds[`application_${state}`],{...this.variables(g,member),member:`<@${app.user}>`,department:departments[app.department],status:state,reason:answers.reason})); } catch { app.dmFailed=true;this.store.save(); }
      return editReply(i, notice('✅ Review saved',`Application ${key}: ${state}.${app.dmFailed ? ' DM delivery failed; the applicant can use Check Status.' : ''}`,'green'));
    }
    if (purpose === 'appeal') {
      const record=g.cases[key];if (!record || record.memberId!==member.id) throw Error('Case access denied');
      if (record.appeal?.status==='submitted') throw Error('Appeal already pending');
      record.appeal={status:'submitted',answers,at:Date.now()};this.store.change(i.guildId,member.id,'appeal-submitted',{caseId:key,...record.appeal});
      return i.reply(notice('⚖️ Appeal submitted',`Your appeal for case ${key} has been saved for management review.`));
    }
    if (purpose === 'record' && ['leave','suggestion'].includes(key)) {
      if(key==='leave') requireAccess(member,g.config);
      const record={id:id(),kind:key,user:member.id,answers,status:'pending',at:Date.now()};g.records[record.id]=record;this.store.change(i.guildId,member.id,'record-submitted',record);
      return i.reply(notice('✅ Request saved',`Your reference is **${record.id}**. Management can review it in the dashboard.`,'green'));
    }
    throw Error('Unknown form');
  }
  ticketPanel(g,ticket) { return render(this.template(g,`ticket_${ticket.status}`),{community:g.config.community,ticket_id:ticket.id,category:ticketCategories[ticket.category],member:`<@${ticket.user}>`,status:ticket.status,assignee:ticket.assignee ? `<@${ticket.assignee}>` : 'Unassigned',request:ticket.request}); }
  async ticketAction(i,g,member,key,action) {
    const t=g.tickets[key];if(!t || t.channel!==i.channelId) throw Error('Ticket not found in this channel');
    const staff=access(member,g.config,t.restricted ? 'management' : 'staff');
    if(!staff && !(t.user===member.id && ['close','reopen'].includes(action))) throw Error('Ticket access denied');
    const status={claim:'claimed',waiting:'waiting',escalate:'escalated',close:'closed',reopen:'reopened'}[action];
    if(!status) throw Error('Unknown ticket action');
    await i.deferReply({flags:64});
    if(action==='claim') t.assignee=member.id;
    if(action==='escalate') {
      if(!g.config.managementRoles.length) throw Error('Management roles are not configured');
      for(const role of g.config.staffRoles.filter(x=>!g.config.managementRoles.includes(x))) await i.channel.permissionOverwrites.edit(role,{ViewChannel:false});
      t.restricted=true;
    }
    if(action==='close') await i.channel.permissionOverwrites.edit(t.user,{SendMessages:false});
    if(action==='reopen') await i.channel.permissionOverwrites.edit(t.user,{SendMessages:true});
    t.status=status;this.store.change(i.guildId,member.id,'ticket-updated',t);
    await i.message.edit(this.ticketPanel(g,t));
    if(action==='close') await i.channel.send(render(seeds.feedback,{community:g.config.community,ticket_id:t.id}));
    return editReply(i, notice('✅ Ticket updated',`Ticket status: **${status}**`,'green'));
  }
  voteVars(v) {return {vote_id:v.id,yes_votes:Object.values(v.ballots).filter(x=>x==='yes').length,no_votes:Object.values(v.ballots).filter(x=>x==='no').length,threshold:v.threshold,voting_ends:stamp(v.end)};}
  activityPanel(g,a) {
    const sections=[a.title,`**Ends:** ${stamp(a.end)}\n**Status:** ${a.closed?'Closed':'Open'}\n**Entries:** ${Object.keys(a.entries).length}`];
    if(a.kind==='poll')sections.push(a.options.map((label,index)=>`**${label}:** ${Object.values(a.entries).filter(x=>x===index).length}`).join('\n'));
    if(a.winners)sections.push(`**Winner:** ${a.winners.map(x=>`<@${x}>`).join(', ')||'No eligible entries'}`);
    const buttons=a.closed?[]:a.kind==='poll'?a.options.map((label,index)=>button(label,'activity',`${a.id},${index}`)):[button('🎁 Enter Giveaway','activity',a.id,3)];
    return render({title:a.kind==='poll'?'🗳️ COMMUNITY POLL':'🎁 COMMUNITY GIVEAWAY',color:a.kind==='poll'?'blue':'green',sections,buttons},{community:g.config.community});
  }
  async notifyVote(guild,g,v) {
    if(!v.host||v.notified||Object.values(v.ballots).filter(x=>x==='yes').length<v.threshold)return;
    v.notified=true;this.store.save();await this.store.flush();
    try{const channel=await guild.channels.fetch(ids.channels.sessions);const payload=notice('Session vote target reached',`<@${v.host}>, your session vote reached **${v.threshold} yes votes**. You can now start the session with /ssu.`,'blue',false);payload.allowedMentions={parse:[],users:[v.host]};await channel.send(payload);}catch(error){v.notified=false;this.store.save();throw error;}
  }
  async updateVote(guild,g,v) {await this.notifyVote(guild,g,v); const channel=await guild.channels.fetch(v.channel);await (await channel.messages.fetch(v.message)).edit(render(this.template(g,'session_vote'),{community:g.config.community,...this.voteVars(v)})); }
  async restrictedChannel(guild,g,key,level='staff') {
    const channel=await guild.channels.fetch(g.config[key]);
    if(!channel?.isTextBased() || channel.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel)) throw Error(`${key} must be a restricted text channel.`);
    // Reject channels visible to any role outside the authorized role set.
    const allowed=new Set(level==='management' ? g.config.managementRoles : level==='department' ? [...g.config.departmentRoles,...g.config.managementRoles] : [...g.config.staffRoles,...g.config.managementRoles]);
    const roles=await guild.roles.fetch();
    for(const role of roles.values()) if(role.id!==guild.id && role.tags?.botId!==this.client.user.id && !role.permissions.has(PermissionFlagsBits.Administrator) && !allowed.has(role.id) && channel.permissionsFor(role)?.has(PermissionFlagsBits.ViewChannel)) throw Error(`${key} is visible to an unauthorized role.`);
    for(const overwrite of channel.permissionOverwrites.cache.values()) if(overwrite.type===1 && overwrite.id!==this.client.user.id && overwrite.allow.has(PermissionFlagsBits.ViewChannel)) { const m=await guild.members.fetch(overwrite.id);if(!access(m,g.config,level)) throw Error(`${key} has an unauthorized member override.`); }
    return channel;
  }
  saveTemplate(guildId,key,value,actor) {
    if(!/^[a-z0-9_]{1,64}$/.test(key)) throw Error('Invalid template key');
    const g=this.store.guild(guildId),previous=g.templates[key] ?? seeds[key];
    if(previous?.audience && previous.audience!=='public' && value.audience!==previous.audience) throw Error('Cannot remove template access restrictions');
    const next={...value,key,version:(previous?.version ?? 1)+1};validateTemplate(next);
    g.templates[key]=next;this.store.change(guildId,actor,'template-saved',{key,previous,next});return next;
  }
}
