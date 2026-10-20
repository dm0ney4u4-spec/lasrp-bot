import { randomUUID } from 'node:crypto';
import type { GuildMember } from 'discord.js';
import { ids } from '../../../config/ids.js';
import type { CommunityService } from './service.js';
import {applyRoleChange,restrictStaff,restoreStaff,disciplineCounts,disciplineProgress,counterRoles}from'./staff-roles.js';
export const infractionTypes=['warning','strike','suspended','investigation','terminated','zero_tolerance'] as const;
export async function issueDiscipline(service:CommunityService,target:GuildMember,actor:GuildMember,bot:GuildMember,type:string,reason:string,evidence:string){
 if(!infractionTypes.includes(type as any))throw Error('Select warning, strike, suspended, investigation, terminated, or zero tolerance.');
 const g=service.store.guild(ids.guildId),profile=g.records[`profile:${target.id}`]??={};if(profile.pendingInfractionId)throw Error('An earlier infraction is pending or interrupted. Review its recorded role operation before issuing another.');
 if(profile.status==='terminated'||target.roles.cache.has(ids.disciplineRoles.terminated))throw Error('This member is already terminated.');
 if(['warning','strike'].includes(type)&&profile.restriction&&!profile.restriction.completedAt)throw Error('Revoke the current restriction before applying a warning or strike.');
 const previousOperationId=profile.roleOperation?.id,previousRestriction=profile.restriction?structuredClone(profile.restriction):undefined,previousStatus=profile.status;
 const counts=disciplineCounts(target.roles.cache.keys()),progress=['warning','strike'].includes(type)?disciplineProgress(counts,type):null;
 const record:any={id:'INF-'+randomUUID().slice(0,8),kind:'staff_infraction',memberId:target.id,moderator:actor.id,type,points:type==='warning'?1:type==='strike'?3:0,reason,evidence,at:Date.now(),status:'applying',expires:null,beforeCounts:counts,afterCounts:progress,vars:{...service.variables(g,actor),member:`<@${target.id}>`,member_id:target.id,manager:`<@${actor.id}>`,infraction_type:type,case_id:'',reason,evidence,status:'active'}};record.vars.case_id=record.id;
 g.cases[record.id]=record;profile.pendingInfractionId=record.id;service.store.change(ids.guildId,actor.id,'staff.infraction-intent',record);await service.store.flush();
 try{if(type==='suspended'||type==='investigation'||type==='terminated'||progress?.terminated){const restriction=await restrictStaff(service,target,actor,bot,progress?.terminated?'terminated':type as any,reason);record.restrictionId=restriction.id;record.outcome=progress?.terminated?'terminated':type;}
 else{const counters=new Set([...ids.disciplineRoles.warnings,...ids.disciplineRoles.strikes]);const roles=new Set<string>([...target.roles.cache.keys()].filter(id=>!progress||!counters.has(id)));if(progress)for(const id of counterRoles(progress.warnings,progress.strikes))roles.add(id);if(type==='zero_tolerance')roles.add(ids.disciplineRoles.zeroTolerance);await applyRoleChange(service,target,actor,bot,roles,reason,'infraction-'+type);record.outcome=progress?`${progress.warnings} warning(s), ${progress.strikes} strike(s)`:'zero tolerance policy';}
 }catch(error){if(profile.roleOperation?.id===previousOperationId){record.status='failed';delete profile.pendingInfractionId;profile.restriction=previousRestriction;profile.status=previousStatus;service.store.save();await service.store.flush();}throw error;}
 record.status='active';delete profile.pendingInfractionId;service.store.change(ids.guildId,actor.id,'staff.infraction',record);await service.store.flush();return record;
}
export async function revokeDiscipline(service:CommunityService,target:GuildMember,actor:GuildMember,bot:GuildMember,record:any,reason:string){
 const g=service.store.guild(ids.guildId),profile=g.records[`profile:${target.id}`]??={};if(record.status!=='active')throw Error('This case is not active.');if(profile.pendingInfractionId)throw Error('An infraction role change is pending; review it first.');
 if(record.outcome==='terminated'||record.type==='terminated'||profile.status==='terminated')throw Error('A termination requires a separate management rehiring decision; it cannot be revoked as a warning or suspension.');
 if(['suspended','investigation'].includes(record.type)){if(profile.restriction?.id!==record.restrictionId)throw Error('This case is not the current staff restriction.');await restoreStaff(service,target,actor,bot,reason);}
 else if(['warning','strike'].includes(record.type)){
  const newer=Object.values(g.cases).filter((c:any)=>c.kind==='staff_infraction'&&c.memberId===target.id&&c.status==='active'&&['warning','strike'].includes(c.type)&&(c.at>record.at||c.at===record.at&&Object.keys(g.cases).indexOf(c.id)>Object.keys(g.cases).indexOf(record.id)));if(newer.length)throw Error('Revoke newer warning / strike cases first so escalation history remains consistent.');
  const counters=new Set([...ids.disciplineRoles.warnings,...ids.disciplineRoles.strikes]),roles=new Set<string>([...target.roles.cache.keys()].filter(id=>!counters.has(id)));for(const id of counterRoles(record.beforeCounts.warnings,record.beforeCounts.strikes))roles.add(id);await applyRoleChange(service,target,actor,bot,roles,reason,'infraction-revoked');
 }else if(record.type==='zero_tolerance'){const other=Object.values(g.cases).some((c:any)=>c.id!==record.id&&c.kind==='staff_infraction'&&c.memberId===target.id&&c.status==='active'&&c.type==='zero_tolerance');if(!other)await applyRoleChange(service,target,actor,bot,[...target.roles.cache.keys()].filter(id=>id!==ids.disciplineRoles.zeroTolerance),reason,'zero-tolerance-revoked');}
 record.status='revoked';record.revocationReason=reason;record.revokedBy=actor.id;record.revokedAt=Date.now();service.store.change(ids.guildId,actor.id,'staff.infraction-revoked',record);await service.store.flush();return record;
}
