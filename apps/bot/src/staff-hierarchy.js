import { promotionRanks, promotionManagedRoles } from '../../../config/promotions.js';
export function individualRank(roleIds, { allowUnranked = false } = {}) {
  const roles = new Set(roleIds), found = promotionRanks.filter(r => roles.has(r.id));
  if (found.length > 1) throw Error('Conflicting individual staff ranks were found. Leadership must reconcile the member roles.');
  if (!found.length) { if (allowUnranked && ![...roles].some(id => promotionManagedRoles.has(id))) return null; throw Error('The individual staff rank cannot be determined. Leadership must reconcile the member roles.'); }
  return { ...found[0], index: promotionRanks.findIndex(r => r.id === found[0].id) };
}
/** @param {Iterable<string>} actorRoleIds @param {Iterable<string>} targetRoleIds @param {{destinationId?:string,allowRecruit?:boolean}} options */
export function requireLowerRank(actorRoleIds, targetRoleIds, { destinationId, allowRecruit = false } = {}) {
  const actor = individualRank(actorRoleIds), target = individualRank(targetRoleIds, { allowUnranked: allowRecruit });
  if (target && target.index >= actor.index) throw Error('Chain of command: the affected staff member must have a lower individual rank than the executor.');
  if (destinationId && promotionRanks.findIndex(r => r.id === destinationId) >= actor.index) throw Error('Chain of command: the destination must be below your own individual rank.');
  return { actor, target };
}
