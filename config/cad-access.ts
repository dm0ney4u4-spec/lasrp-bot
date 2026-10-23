// CAD admission is independent of Discord department/staff permissions.
// Exact owner IDs come from config/ids.ts; role names never grant these powers.
export const cadAccessConfig={
 websiteAdminRoleIds:[] as string[],
 reviewerRoleIds:[] as string[],
 revokerRoleIds:[] as string[],
 ownerEmergencyBypass:false,
 reviewChannelId:'', // A private channel in the existing LASRP guild. Never guess an ID.
 defaults:{
  open:true,allowDeniedReapply:true,allowRevokedReapply:false,cooldownHours:168,
  rulesVersion:'1',rules:'Use CAD only for fictional LASRP roleplay. Keep private records confidential, follow your authorized department permissions, and never submit passwords or real sensitive information.',
  questions:[{id:'experience',label:'Describe your roleplay and CAD experience.',minLength:20},{id:'scenario',label:'How would you handle discovering a private CAD record you are not authorized to use?',minLength:30}],
 },
};
