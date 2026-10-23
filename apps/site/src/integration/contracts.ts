import type { Principal, Group } from '../../../../packages/shared/src/permissions';
// Type-only imports: no Discord IDs, database clients, or server modules enter the bundle.
export interface WebsiteIdentity { principal: Principal; csrf: string; }
export interface DepartmentMembership { department: 'police'|'sheriff'|'fire'|'dot'; userId: string; rankId: string; permissions: string[]; }
export interface RecruitmentSummary { department: string; state:'open'|'closed'|'unpublished'; updatedAt:string|null; }
export interface PublicCommunitySummary { memberCount:number|null; players:number|null; queue:number|null; updatedAt:string|null; }
export interface PlannedDepartmentService {
  roster(department:string):Promise<DepartmentMembership[]>;
  authorize(principal:Principal,department:string,permission:string):Promise<boolean>;
}
export type WebsiteAuthorizationGroup = Group;
// No implementation or localStorage permissions in Phase 1. Future services use the existing API.
