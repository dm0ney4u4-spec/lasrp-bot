// Nonsecret, explicitly verified MAIN GUILD role IDs only. No names grant access.
// Membership uses existing config/ids.ts roles or database rbacRoles bindings.
// Order ranks highest first; leave empty until leadership supplies verified IDs.
export const websiteDepartments={
 nypd:{agency:'police',rankRoleIds:[] as string[],commandRoleIds:[] as string[]},
 nycso:{agency:'sheriff',rankRoleIds:[] as string[],commandRoleIds:[] as string[]},
 nyfd:{agency:'fire',rankRoleIds:[] as string[],commandRoleIds:[] as string[]},
 nydot:{agency:'dot',rankRoleIds:[] as string[],commandRoleIds:[] as string[]},
} as const;
