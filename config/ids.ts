// PASTE NONSECRET DISCORD IDs HERE. Secrets belong ONLY in .env.
// Empty optional values disable their module; never paste fake emoji IDs.
export const ids = {
 guildId:'1529507818452029650',clientId:'1561426484554506270',owners:['1425577335637413961'] as string[],
 channels:{rules:'1561876833065115790',announcements:'',serverInfo:'',cadPanel:'1557887343472676916',applicationsPanel:'1557893259840458792',applicationReviews:'1529672366202814715',applicationLogs:'',ticketPanel:'',ticketCategory:'',ticketLogs:'',sessions:'1529553843199807590',sessionVotes:'1529553843199807590',sessionLogs:'',staffLogs:'1529614627619475608',moderationLogs:'1529567359713546411',securityAlerts:'',infractions:'1529614587450622002',promotions:'1529565497438372000',staffReports:'',erlcLogs:'',dispatch:'',generalSupport:'',appeals:'',training:'',suggestions:''},
 roles:{owner:'',communityManagement:'1529545703024627754',seniorAdmin:'',admin:'',seniorModerator:'',moderator:'1529545703024627754',trialModerator:'',applicationReviewer:'1529545703024627754',ticketSupport:'',securityTeam:'',sessionHost:'1529545703024627754',staff:'1529557245631791104',trainee:'1529549373552197663',verified:'',police:'',sheriff:'',fire:'',ems:'',dot:'',dispatcher:'',supervisor:'',doj:'',judge:'',prosecutor:'',defense:'',clerk:'',civilian:''},
 emojis:{shield:'1561878995014914191',cad:'',police:'',radio:'',ticket:'',application:'',check:'1561878996231389234',close:'1561878997275779143',info:'',warning:'',clock:'',document:'',settings:''},
 categories:{tickets:'',archivedTickets:''},
 // AutoMod uses Discord's native filters. Add exact unwanted domains, without protocols.
 automod:{mentionLimit:5,blockedDomains:[] as string[],exemptRoles:[] as string[],exemptChannels:[] as string[]},
 featureFlags:{cad:true,tickets:true,applications:true,security:true,sessions:true,automod:true,courts:false},
 courtsPolicy:{specialistRolesEnabled:false},
 // Rank order is lowest to highest; team badges are assigned automatically.
 staffRankRoles:['1529549373552197663','1529544880626602146','1529544875308089558','1529544864960745553','1529544859126333682','1529544806555193434','1529544798288220442','1529544793699516486','1529544677777342625','1529543672612388894','1529543669000962209','1529543662445269022','1534213008710959185','1534212901122867272','1529545703024627754','1529542214336778322','1529552680287080459','1529541899860316201','1529541841450565773'],
 staffTeams:{staff:'1529557245631791104',moderation:'1529544884783022100',administration:'1529544817712037939',management:'1529543684511498462',highRank:'1529545769462272140',seniorHighRank:'1529545703024627754'},
 // Old ranks remain removable/restorable, but cannot be selected for new promotions.
 legacyStaffRoles:['1529544812959633429','1529543786290614453','1529543770821890049','1529543754824814652','1529543741919072316'],
 disciplineRoles:{warnings:['1529546501402132621','1529546504077836349','1561917636604858448'],strikes:['1529546506980425900','1529546509547339826','1561917868097015868'],suspended:'1529546313195327688',investigation:'1529546375661092874',terminated:'1529546436574711868',zeroTolerance:'1529546707929530640'},
 // Existing private staff logs also allow the server's Ownership role to read.
 staffLogReaderRoles:['1529541555726057615','1529545769462272140','1529545703024627754'],
 commandPolicy:{staffActions:['1529545769462272140','1529545703024627754'],moderationRoles:['1529545703024627754'],sessionRoles:['1529545703024627754'],sessionPingRoles:['1557914073889509486','1529610820588146700']},
 sessionAlerts:{enabled:true,lowPopulationThreshold:8,lowPopulationMinutes:10},
 settings:{community:'Los Angeles State Roleplay',serverName:'Los Angeles State Roleplay',joinCode:'',weeklyMinutes:120,selfDispatchEnabled:false,unitFreshnessMinutes:5,fictionalHospitals:['Fictional County Medical Center','Fictional River City Hospital'],priority:'Normal roleplay. Follow published priority policy.',applicationOpen:false,applicationCooldownHours:168,applicationExpiryHours:48,applicationRequirements:'Read and acknowledge community and staff policies; provide honest answers. Leadership must configure eligibility before opening recruitment.',infractionExpiryDays:90,infractionPoints:{verbal_warning:1,written_warning:2,strike:3,suspension_review:5,removal_recommendation:5},securityMode:'review' as 'monitor'|'review'|'contain',autoContainEnabled:false,trustedUsers:[] as string[],protectedChannels:[] as string[],protectedRoles:[] as string[],joinThreshold:10,auditThreshold:3,securityWindowSeconds:10,ticketCooldownSeconds:60,transcriptRetentionDays:30},
};
