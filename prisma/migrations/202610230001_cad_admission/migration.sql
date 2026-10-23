-- Additive migration: preserves all existing users, sessions, CAD and staff records.
CREATE TABLE "CadAccessApplication" (
 "id" TEXT PRIMARY KEY, "guildId" TEXT NOT NULL, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "discordName" TEXT NOT NULL, "robloxUsername" TEXT NOT NULL, "requestedRole" TEXT NOT NULL,
 "questions" JSONB NOT NULL, "answers" JSONB NOT NULL, "rulesVersion" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','more_info','approved','denied','revoked')),
 "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "CadAdmission" (
 "guildId" TEXT NOT NULL, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "status" TEXT NOT NULL DEFAULT 'not_applied' CHECK ("status" IN ('not_applied','pending','more_info','approved','denied','revoked')),
 "applicationId" TEXT UNIQUE REFERENCES "CadAccessApplication"("id") ON DELETE RESTRICT,
 "version" INTEGER NOT NULL DEFAULT 1, "updatedAt" TIMESTAMP(3) NOT NULL, PRIMARY KEY ("guildId","userId")
);
CREATE TABLE "CadAccessAudit" (
 "id" TEXT PRIMARY KEY, "applicationId" TEXT NOT NULL REFERENCES "CadAccessApplication"("id") ON DELETE RESTRICT,
 "actorId" TEXT NOT NULL, "action" TEXT NOT NULL, "fromStatus" TEXT NOT NULL, "toStatus" TEXT NOT NULL,
 "reason" TEXT NOT NULL, "detail" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "CadAccessSettings" ("guildId" TEXT PRIMARY KEY,"value" JSONB NOT NULL,"version" INTEGER NOT NULL DEFAULT 1,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "CadAccessDelivery" (
 "id" TEXT PRIMARY KEY,"applicationId" TEXT NOT NULL REFERENCES "CadAccessApplication"("id") ON DELETE RESTRICT,
 "kind" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'pending',"payload" JSONB NOT NULL,"attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"lockedAt" TIMESTAMP(3),"deliveredAt" TIMESTAMP(3),"errorCode" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CadAccessApplication_guildId_status_createdAt_idx" ON "CadAccessApplication"("guildId","status","createdAt");
CREATE INDEX "CadAccessApplication_guildId_userId_createdAt_idx" ON "CadAccessApplication"("guildId","userId","createdAt");
CREATE UNIQUE INDEX "CadAccessApplication_active_unique" ON "CadAccessApplication"("guildId","userId") WHERE "status" IN ('pending','more_info','approved');
CREATE INDEX "CadAccessAudit_applicationId_createdAt_idx" ON "CadAccessAudit"("applicationId","createdAt");
CREATE INDEX "CadAccessDelivery_status_nextAttemptAt_idx" ON "CadAccessDelivery"("status","nextAttemptAt");
