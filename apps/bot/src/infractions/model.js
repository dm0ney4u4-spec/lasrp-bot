import { randomBytes } from 'node:crypto';
export const caseId = () => randomBytes(8).toString('hex').toUpperCase();
export const normalizeId = value => String(value).trim().replace(/^#\s*/, '').toUpperCase();
export const punishments = {notice:'Notice',warning:'Warning',strike:'Strike',suspension:'Suspension',investigation:'Under Investigation',termination:'Termination',blacklist:'Staff Blacklist'};
export function durationMs(value) {
  if (/^(indefinite|indefinitely|none)$/i.test(String(value).trim())) return null;
  const match=/^(\d+)\s*(m|h|d|w)$/i.exec(String(value).trim());if(!match)throw Error('Enter a duration such as 30m, 24h, 7d, or indefinite.');
  const ms=Number(match[1])*({m:60000,h:3600000,d:86400000,w:604800000})[match[2].toLowerCase()];
  if(!Number.isSafeInteger(ms)||ms<60000||ms>31536000000)throw Error('Suspension duration must be from one minute to one year, or indefinite.');return ms;
}
export function progress(cases, baseline={warnings:0,strikes:0}, excluded = new Set()) {
  let warnings=baseline.warnings||0,strikes=baseline.strikes||0,terminated=false;const escalations=[];
  const waived=new Set(cases.filter(c=>c.type==='strike'&&c.data?.generated&&(c.status==='voided'||excluded.has(c.id))).map(c=>c.data.sourceId));
  if(warnings>=3){strikes+=Math.floor(warnings/3);warnings%=3;}if(strikes>=3){terminated=true;warnings=0;strikes=0;}
  for(const row of [...cases].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)||a.id.localeCompare(b.id))){
    if(row.status!=='active'||row.data?.generated||excluded.has(row.id))continue;
    if(row.type==='termination'){warnings=0;strikes=0;terminated=true;continue;}
    if(row.type==='blacklist'){warnings=0;strikes=0;continue;}
    if(!['warning','strike'].includes(row.type))continue;
    if(terminated)continue;
    if(row.type==='warning'){warnings++;if(warnings>=3){warnings=0;if(!waived.has(row.id)){strikes++;escalations.push({sourceId:row.id,type:'strike',level:strikes});}}}else strikes++;
    if(strikes>=3){warnings=0;strikes=0;terminated=true;escalations.push({sourceId:row.id,type:'termination'});}
  }
  return {warnings,strikes,terminated,escalations};
}
export function counterRoles(counts, config) { return [...config.roles.warnings.slice(0,counts.warnings),...(counts.strikes?[config.roles.strikes[counts.strikes-1]]:[]),...(counts.warnings||counts.strikes?[config.roles.separator]:[])]; }
export const same = (a,b) => JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
export const hard = type => ['suspension','termination','blacklist'].includes(type);
