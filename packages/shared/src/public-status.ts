// This DTO contains aggregates only. Never add raw Players, Staff, Queue IDs, or locations.
export interface PublicErlcStatus {
 state:'live'|'stale'|'unavailable'; reason:'not_configured'|'upstream_unavailable'|null;
 updatedAt:string|null; generatedAt:string; refreshAfterSeconds:number;
 server:{name:string|null;players:number|null;capacity:number|null;populationPercent:number|null;queue:number|null;availability:'responding'|'unknown';teams:Record<string,number>|null;onlineStaff:number|null;joinUrl:string|null};
 sessions:{startsAt:string;status:'scheduled';announcementUrl:string}[];sessionsAvailable:boolean;
}
