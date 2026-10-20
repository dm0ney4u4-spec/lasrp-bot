import {randomUUID}from'node:crypto';
﻿import { PermissionFlagsBits,type GuildMember } from 'discord.js';
import { ids } from '../../../config/ids.js';
import type { CommunityService } from './service.js';
import { audit } from '../../../packages/shared/src/database.js';
export const rankIndex=(id:string)=>ids.staffRankRoles.indexOf(id);
export function rankRoles(rankId:string){const index=rankIndex(rankId);if(index<0)throw Error('This role is not in the configured staff rank ladder.');const roles=new Set([rankId,ids.staffTeams.staff]);
 if(index>=rankIndex('1529544880626602146')&&index<=rankIndex('1529544859126333682'))roles.add(ids.staffTeams.moderation);
 if(index>=rankIndex('1529544806555193434')&&index<=rankIndex('1529544793699516486'))roles.add(ids.staffTeams.administration);
 if(index>=rankIndex('1529544677777342625'))roles.add(ids.staffTeams.highRank);
 if(index>=rankIndex('1529543672612388894'))roles.add(ids.staffTeams.management);
 if(index>=rankIndex(ids.staffTeams.seniorHighRank))roles.add(ids.staffTeams.seniorHighRank);
 return [...roles];}
export function staffRoleIds(g:any){const mapped={...ids.roles,...g.config.rbacRoles};return new Set<string>([...ids.staffRankRoles,...ids.legacyStaffRoles,...Object.values(ids.staffTeams),...g.config.staffRoles,...g.config.managementRoles,...['staff','trialModerator','moderator','seniorModerator','admin','seniorAdmin','communityManagement','applicationReviewer','ticketSupport','securityTeam','sessionHost','supervisor'].map(k=>mapped[k])].filter(id=>id&&id!==mapped.owner));}
export function disciplineCounts(roleIds:Iterable<string>){const roles=new Set(roleIds);return{warnings:ids.disciplineRoles.warnings.reduce((n,r,index)=>roles.has(r)?Math.max(n,index+1):n,0),strikes:ids.disciplineRoles.strikes.reduce((n,r,index)=>roles.has(r)?Math.max(n,index+1):n,0)};}
export function disciplineProgress(counts:{warnings:number;strikes:number},type:string){let {warnings,strikes}=counts;let terminated=false;if(type==='warning'){warnings++;if(warnings>=3){warnings=0;strikes++;}}else if(type==='strike')strikes++;else throw Error('Unknown warning / strike action');if(strikes>=3){warnings=0;strikes=0;terminated=true;}return{warnings,strikes,terminated};}
export function counterRoles(warnings:number,strikes:number){return[...ids.disciplineRoles.warnings.slice(0,warnings),...ids.disciplineRoles.strikes.slice(0,strikes)];}
export async function applyRoleChange(service:CommunityService,target:GuildMember,actor:GuildMember,bot:GuildMember,desired:Iterable<string>,reason:string,kind:string){
 const g=service.store.guild(ids.guildId),profile=g.records[`profile:${target.id}`]??={},before=[...target.roles.cache.keys()].filter(id=>id!==target.guild.id),after=[...new Set(desired)].filter(id=>id!==target.guild.id),old=new Set(before),next=new Set(after),changed=[...new Set([...before,...after])].filter(id=>old.has(id)!==next.has(id));
 if(['pending','uncertain'].includes(profile.roleOperation?.status))throw Error('A previous role change was interrupted. Management must review the recorded before/after role lists before another change.');
 if(!bot.permissions.has(PermissionFlagsBits.ManageRoles))throw Error('The bot needs Manage Roles.');
 for(const id of changed){const role=await target.guild.roles.fetch(id);if(!role||role.managed||role.position>=bot.roles.highest.position)throw Error(`Move the bot role above ${role?.name??id}; this role cannot currently be managed.`);if(!ids.owners.includes(actor.id)&&role.position>=actor.roles.highest.position)throw Error('Cannot change roles at or above your own rank.');if(!old.has(id)&&role.permissions.has(PermissionFlagsBits.Administrator))throw Error('Administrator roles cannot be granted automatically.');}
 const operation={id:'ROLE-'+randomUUID(),status:'pending',kind,before,after,actor:actor.id,at:Date.now(),reason};profile.roleOperation=operation;service.store.change(ids.guildId,actor.id,'staff.role-intent',{member:target.id,...operation});await service.store.flush();
 try{if(changed.length)await target.roles.set(after,reason);}catch(error){operation.status='uncertain';service.store.change(ids.guildId,actor.id,'staff.role-change-uncertain',{member:target.id,...operation});await service.store.flush();throw Error('Discord could not confirm the role change. Its before/after state is saved for review; no further action was silently applied.');}
 operation.status='applied';service.store.change(ids.guildId,actor.id,'staff.roles-applied',{member:target.id,...operation});await service.store.flush();await audit(actor.id,'staff.roles-applied',target.id,{roles:before},{roles:after,kind});return{before,after};
}
export async function restrictStaff(service:CommunityService,target:GuildMember,actor:GuildMember,bot:GuildMember,type:'suspended'|'investigation'|'terminated',reason:string){const g=service.store.guild(ids.guildId),profile=g.records[`profile:${target.id}`]??={},staff=staffRoleIds(g),existing=profile.restriction;
 if(existing&&!existing.completedAt&&existing.type!==type&&type!=='terminated')throw Error('Resolve the current staff restriction before replacing it.');
 const originals=existing&&!existing.completedAt?existing.originalRoleIds:[...target.roles.cache.keys()].filter(id=>staff.has(id));
 if(type!=='terminated'&&!originals.length)throw Error('No staff roles were found to suspend or place under investigation.');
 const restriction=existing&&!existing.completedAt&&existing.type===type?existing:{id:'RESTRICT-'+randomUUID(),type,originalRoleIds:originals,actor:actor.id,reason,at:Date.now()};profile.restriction=restriction;profile.status=type+'_pending';service.store.save();await service.store.flush();
 const markers=new Set([ids.disciplineRoles.suspended,ids.disciplineRoles.investigation,ids.disciplineRoles.terminated]);const roles=[...target.roles.cache.keys()].filter(id=>!staff.has(id)&&!markers.has(id)&&!(type==='terminated'&&[...ids.disciplineRoles.warnings,...ids.disciplineRoles.strikes,ids.disciplineRoles.zeroTolerance].includes(id)));roles.push(ids.disciplineRoles[type]);
 await applyRoleChange(service,target,actor,bot,roles,reason,type);profile.status=type;restriction.appliedAt=Date.now();service.store.save();await service.store.flush();return restriction;
}
export async function restoreStaff(service:CommunityService,target:GuildMember,actor:GuildMember,bot:GuildMember,reason:string){const g=service.store.guild(ids.guildId),profile=g.records[`profile:${target.id}`]??={},restriction=profile.restriction??(profile.suspension&&!profile.suspension.completedAt?{...profile.suspension,type:'suspended'}:undefined);if(restriction&&!profile.restriction)profile.restriction=restriction;
 if(!restriction||restriction.completedAt)throw Error('No recorded suspension or investigation is active.');if(restriction.type==='terminated')throw Error('Termination cannot be revoked through the suspension / investigation restore command.');
 const permitted=staffRoleIds(g);for(const id of restriction.originalRoleIds)if(!permitted.has(id))throw Error('An original staff role is no longer configured. Review the saved role snapshot.');
 const roles=new Set<string>([...target.roles.cache.keys()].filter(id=>!permitted.has(id)&&id!==ids.disciplineRoles.suspended&&id!==ids.disciplineRoles.investigation));for(const id of restriction.originalRoleIds)roles.add(id);
 await applyRoleChange(service,target,actor,bot,roles,reason,'restriction-revoked');restriction.completedAt=Date.now();restriction.revokedBy=actor.id;restriction.revocationReason=reason;profile.status='active';service.store.save();await service.store.flush();return restriction;
}
