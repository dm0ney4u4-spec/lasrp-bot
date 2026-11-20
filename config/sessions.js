// Session permissions are independent of moderation and website administration.
export const sessionConfig = {
  server: { name: 'New York City Roleplay', owner: 'Dm0ney_4u' },
  guildId: '1529507818452029650',
  channels: { announcements: '1529553843199807590', permanentPanel: '1529553843199807590', sessionLogs: '1573179359957876826' },
  roles: { sessionStaff: ['1529541555726057615'], sessionAdmin: ['1529541555726057615'], sessionPing: '1529610820588146700', notificationSubscriber: '1529610820588146700' },
  settings: { requiredVotes: 2, enableAutomaticSessionStart: false, enableAutomaticLowAlerts: false, lowPlayerThreshold: null, verifiedRoleRequired: false, refreshMs: 60000, lowCooldownMs: 300000, pingLow: true },
  assets: { main: 'assets/sessions/main-banner.png', vote: 'assets/sessions/vote-banner.png', start: 'assets/sessions/started-banner.png', low: 'assets/sessions/low-banner.png', shutdown: 'assets/sessions/shutdown-banner.png', divider: 'assets/sessions/divider.png', logo: 'assets/sessions/logo.png' },
  color: 0xD8C5A4
};
