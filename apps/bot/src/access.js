import { PermissionFlagsBits } from 'discord.js';
export function access(member, config, level) {
  if (!member) return false;
  if (config.owners?.includes(member.id)) return true;
  const roles = level === 'management' ? config.managementRoles : level === 'department' ? [...config.departmentRoles, ...config.managementRoles] : [...config.staffRoles, ...config.managementRoles];
  return roles.some(id => member.roles.cache.has(id));
}
export function requireAccess(member, config, level = 'staff') {
  if (!access(member, config, level)) throw Error('You do not have permission for this action.');
}
export function canViewCase(member, config, record) {
  return record && (record.memberId === member.id || access(member, config, record.kind === 'staff_infraction' ? 'management' : 'staff'));
}
