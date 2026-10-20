import { Store } from '../../../apps/bot/src/store.js';
import { db,events } from './database.js';
import { ids } from '../../../config/ids.js';
// One shared API/bot process owns this compatibility document. CAD and DM application
// records use normalized Prisma tables and transactional version checks.
export class DatabaseStore extends Store {
 private queue:Promise<unknown>=Promise.resolve();
 constructor(){super('data/local-recovery.json');this.data={guilds:{}};}
 async load(){for(const row of await db.guildState.findMany())this.data.guilds[row.id]=row.data as never;}
 override guild(guildId:string){
  const existed=Boolean(this.data.guilds[guildId]);const g=super.guild(guildId);
  if(!existed){const r=ids.roles;Object.assign(g.config,{community:ids.settings.community,serverName:ids.settings.serverName,joinCode:ids.settings.joinCode,owners:ids.owners,weeklyMinutes:ids.settings.weeklyMinutes,priority:ids.settings.priority,staffRoles:[r.staff,r.moderator,r.seniorModerator,r.trialModerator,r.admin,r.seniorAdmin,r.sessionHost,r.ticketSupport].filter(Boolean),managementRoles:[r.owner,r.communityManagement].filter(Boolean),departmentRoles:[r.police,r.sheriff,r.fire,r.ems,r.dot,r.dispatcher,r.supervisor].filter(Boolean),verifiedRole:r.verified,sessionChannel:ids.channels.sessions,moderationLogChannel:ids.channels.moderationLogs,applicationReviewChannel:ids.channels.applicationReviews,ticketCategory:ids.categories.tickets||ids.channels.ticketCategory,dispatchChannel:ids.channels.dispatch,securityChannel:ids.channels.securityAlerts,welcomeChannel:ids.channels.serverInfo,promotionChannel:ids.channels.promotions,staffLogChannel:ids.channels.staffLogs,infractionChannel:ids.channels.infractions,applications:{}});}
  for(const [key,value] of Object.entries({sessionChannel:ids.channels.sessions,applicationReviewChannel:ids.channels.applicationReviews,staffLogChannel:ids.channels.staffLogs,infractionChannel:ids.channels.infractions,promotionChannel:ids.channels.promotions,moderationLogChannel:ids.channels.moderationLogs}))if(value)g.config[key]=value;
  g.config.owners=ids.owners;
  g.config.managementRoles=[...new Set([...g.config.managementRoles,ids.roles.communityManagement].filter(Boolean))];
  g.config.staffRoles=[...new Set([...g.config.staffRoles,ids.roles.staff,ids.roles.moderator,ids.roles.sessionHost].filter(Boolean))];
  return g;
 }
 override save(){
  const snapshots=Object.entries(this.data.guilds).map(([id,data])=>({id,data:JSON.parse(JSON.stringify(data))}));
  this.queue=this.queue.then(async()=>{for(const row of snapshots)await db.guildState.upsert({where:{id:row.id},create:row,update:{data:row.data}});events.emit('changed');});
  this.queue.catch(()=>console.error('Database persistence failed; writes are blocked until restart.'));
 }
 async flush(){await this.queue;}
}
