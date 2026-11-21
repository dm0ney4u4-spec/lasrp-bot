import { ids } from './ids.js';
export const infractionConfig = {
  guildId: ids.guildId, announcementChannelId: ids.channels.infractions, logChannelId: ids.channels.staffLogs,
  authorizedRoles: ['1529545769462272140','1529545703024627754'], reviewerRoles: ['1529545703024627754'],
  roles: { warnings: ['1529546501402132621','1529546504077836349','1573526826184347838'], strikes: ['1529546506980425900','1529546509547339826','1573526789152571462'], suspension:'1529546313195327688', investigation:'1529546375661092874', termination:'1529546436574711868', blacklist:'1529551634403688468', former:'1531341333254504468', separator:'1529546801324097618', notice:null },
  legacyCounterRoles: { warnings:['1561917636604858448'], strikes:['1561917868097015868'] },
  investigationRestrictions: 'none', // none | staff | all. Never remove all investigation roles implicitly.
  confirmationMs:600000, color:0xD8C5A4, iconId:ids.emojis.warning || '1530309174506950727',
  assets:{banner:'assets/infractions/banner.png',footer:'assets/infractions/footer.png',logo:'assets/infractions/logo.png'}
};
