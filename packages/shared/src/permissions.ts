import { ids } from '../../../config/ids.js';
export type Group='owner'|'management'|'moderator'|'reviewer'|'support'|'security'|'host'|'dispatcher'|'police'|'sheriff'|'fire'|'ems'|'dot'|'supervisor'|'doj'|'judge'|'prosecutor'|'defense'|'clerk'|'civilian';
export interface Principal { id:string; name:string; groups:Group[]; roles:string[] }
export const groupsFor=(userId:string,roles:string[],bindings:Partial<typeof ids.roles>={}):Group[]=>{
 const mapped={...ids.roles,...bindings,owner:ids.roles.owner};
 const has=(...values:string[])=>values.some(x=>x&&roles.includes(x));
 const groups:Group[]=['civilian'];
 if(ids.owners.includes(userId)||has(mapped.owner))groups.push('owner');
 if(has(mapped.communityManagement))groups.push('management');
 if(has(mapped.admin,mapped.seniorAdmin,mapped.moderator,mapped.seniorModerator,mapped.trialModerator,mapped.staff))groups.push('moderator');
 if(has(mapped.applicationReviewer))groups.push('reviewer');
 if(has(mapped.ticketSupport))groups.push('support');
 if(has(mapped.securityTeam))groups.push('security');
 if(has(mapped.sessionHost))groups.push('host');
 for(const group of ['dispatcher','police','sheriff','fire','ems','dot','supervisor','doj'] as const)if(has(mapped[group]))groups.push(group);
 for(const group of ['judge','prosecutor','defense','clerk'] as const)if(has(mapped[group])){groups.push(group);if(!groups.includes('doj'))groups.push('doj');}
 return groups;
};
export function allowed(user:Principal,...groups:Group[]){return user.groups.includes('owner')||user.groups.includes('management')||groups.some(g=>user.groups.includes(g));}
export function demand(user:Principal,...groups:Group[]){if(!allowed(user,...groups))throw Object.assign(Error('Access denied'),{status:403});}
export const agencies=['police','sheriff','fire','ems','dot','dispatch','doj'] as const;
export type Agency=typeof agencies[number];
export function agencyAccess(user:Principal,agency:string){return agencies.includes(agency as Agency)&&(agency!=='doj'||ids.featureFlags.courts)&&(allowed(user,'dispatcher','supervisor')||user.groups.includes((agency==='dispatch'?'dispatcher':agency) as Group));}
export function requireAgency(user:Principal,agency:string){if(!agencyAccess(user,agency))throw Object.assign(Error('Agency access denied'),{status:403});if(agency==='doj'&&!ids.featureFlags.courts)throw Error('Courts module is disabled');}
export function recordReadable(user:Principal,record:{agency:string;kind:string;sealed:boolean;ownerId:string;data:unknown}){if(!agencyAccess(user,record.agency))return false;if(!record.sealed)return true;if(record.kind==='court_case'){const data=record.data as {prosecutorId?:string;defenseId?:string};return allowed(user,'judge','clerk')||record.ownerId===user.id||data.prosecutorId===user.id||data.defenseId===user.id;}return allowed(user,'supervisor','doj');}
export function requireRecord(user:Principal,record:{agency:string;kind:string;sealed:boolean;ownerId:string;data:unknown}){if(!recordReadable(user,record))throw Object.assign(Error('Record access denied'),{status:403});}
