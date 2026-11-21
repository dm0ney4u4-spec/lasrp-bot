import { promotionConfig, promotionBundle } from '../../../../config/promotions.js';
export function promotionPlan(roleIds, rankId, config = promotionConfig) {
  const ranks = config.groups.flatMap(g => g.ranks), index = ranks.findIndex(r => r.id === rankId);
  if (index < 0) throw Error('Choose a valid individual rank from autocomplete.');
  const before = new Set(roleIds), existing = ranks.filter(r => before.has(r.id)), previous = existing.at(-1);
  if (previous && ranks.findIndex(r => r.id === previous.id) >= index) throw Error('Choose a higher individual rank for a promotion.');
  const managed = new Set([config.staffRoleId, config.staffSeparatorId, ...config.groups.flatMap(g => [...g.auxiliary, ...g.ranks.map(r => r.id)])]);
  const desired = promotionBundle(rankId, config), desiredSet = new Set(desired), beforeManaged = [...before].filter(id => managed.has(id)).sort();
  return { rankId, rankName: ranks[index].name, group: ranks[index].group, previousRankId: previous?.id ?? null, previousRankName: previous?.name ?? 'Not previously ranked', beforeManaged, desired: desired.sort(), add: desired.filter(id => !before.has(id)).sort(), remove: beforeManaged.filter(id => !desiredSet.has(id)).sort() };
}
export function destinationAuthorized(actorRoleIds, rankId, config = promotionConfig) {
  const group = config.groups.find(g => g.ranks.some(r => r.id === rankId));
  return Boolean(group && group.permissions.some(id => actorRoleIds.includes(id)));
}
export const sameRoles = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
