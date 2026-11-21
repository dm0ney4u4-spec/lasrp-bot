// Only explicit individual ranks below are valid /promote destinations, lowest first.
const group = (key, name, permissions, auxiliary, ranks) => ({ key, name, permissions, auxiliary, ranks: ranks.map(([id, name]) => ({ id, name, group: key })) });
const high = '1529545769462272140', senior = '1529545703024627754', director = '1529541363547504781';
export const promotionConfig = {
  guildId: '1529507818452029650', announcementChannelId: '1529565497438372000', logChannelId: '1529614627619475608', iconId: '1530309174506950727',
  staffRoleId: '1529557245631791104', staffSeparatorId: '1529546092503367833', rankLockRoleId: '1529546002116116580', rankLockOverrideRoleId: '1569461995869184010',
  confirmationMs: 600000, color: 0xD8C5A4,
  assets: { banner: 'assets/promotions/banner.png', footer: 'assets/promotions/footer.png', logo: 'assets/promotions/logo.png' },
  groups: [
    group('trainee', 'Trainee Staff', [high, senior], ['1529544891921731645'], [['1529549373552197663', 'Trainee Staff']]),
    group('moderation', 'Moderation', [high, senior], ['1529544884783022100', '1529549543409193092'], [['1529544880626602146','Trial Moderator'],['1529544875308089558','Junior Moderator'],['1529544864960745553','Moderator'],['1529544859126333682','Senior Moderator'],['1569737318577872988','Lead Moderator']]),
    group('administration', 'Administration', [high, senior], ['1529544817712037939', '1529544826071154888'], [['1529544806555193434','Trial Administrator'],['1529544798288220442','Junior Administrator'],['1529544793699516486','Senior Administrator'],['1569737287036567572','Lead Administrator']]),
    group('internal_affairs', 'Internal Affairs', ['1567679203275575467', senior], ['1529544677777342625','1529543806402301982',high], [['1569737733633482842','Trial Internal Affairs'],['1567679537104429127','Internal Affairs'],['1567679407147978942','Senior Internal Affairs'],['1567679203275575467','Lead Internal Affairs']]),
    group('management', 'Management', [senior], ['1529543684511498462','1529543689855172768',high], [['1569737982200647792','Trial Manager'],['1529543672612388894','Junior Manager'],['1529543669000962209','Manager'],['1529543662445269022','Senior Manager']]),
    group('senior_high_rank', 'Senior High Rank', [director], [senior,'1529542558865424595',high], [['1534213008710959185','Community Manager'],['1534212901122867272','Head of Staff']]),
    group('directive', 'Directive Team', [director], ['1529542214336778322','1534213128722845696',senior,high], [['1529552680287080459','Assistant Director'],['1529541899860316201','Deputy Director'],['1529541841450565773','Director']])
  ]
};
export const promotionRanks = promotionConfig.groups.flatMap(g => g.ranks);
// Existing Founder authority is checked by the shared chain of command, never assigned by /promote.
export const staffAuthorityRanks = [...promotionRanks, {id:'1529541363547504781',name:'Founder',group:'foundation'}];
export const promotionManagedRoles = new Set([promotionConfig.staffRoleId, promotionConfig.staffSeparatorId, ...promotionConfig.groups.flatMap(g => [...g.auxiliary, ...g.ranks.map(r => r.id)])]);
export function promotionBundle(rankId, config = promotionConfig) {
  const group = config.groups.find(g => g.ranks.some(r => r.id === rankId));
  if (!group) throw Error('Choose a valid individual rank from autocomplete. Team and separator roles are not promotion ranks.');
  return [...new Set([rankId, ...group.auxiliary, config.staffRoleId, config.staffSeparatorId])];
}
