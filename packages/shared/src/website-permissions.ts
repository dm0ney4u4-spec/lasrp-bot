import type {Principal} from './permissions.js';
import {ids} from '../../../config/ids.js';
import {cadAccessConfig} from '../../../config/cad-access.js';
export const websiteOwner=(user:Principal)=>ids.owners.includes(user.id);
const has=(user:Principal,roles:string[])=>roles.some(id=>id&&user.roles.includes(id));
export const websiteAdmin=(user:Principal)=>websiteOwner(user)||has(user,cadAccessConfig.websiteAdminRoleIds);
export const cadReviewer=(user:Principal)=>websiteAdmin(user)||has(user,cadAccessConfig.reviewerRoleIds);
export const cadRevoker=(user:Principal)=>websiteAdmin(user)||has(user,cadAccessConfig.revokerRoleIds);
export const memberCapabilities=(user:Principal)=>({websiteAdmin:websiteAdmin(user),cadReviewer:cadReviewer(user),cadRevoker:cadRevoker(user)});
