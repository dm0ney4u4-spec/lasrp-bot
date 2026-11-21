CREATE TABLE "PromotionOperation" (
 "id" TEXT PRIMARY KEY,
 "guildId" TEXT NOT NULL,
 "actorId" TEXT NOT NULL,
 "memberId" TEXT NOT NULL,
 "rankId" TEXT NOT NULL,
 "reason" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'preview',
 "activeKey" TEXT UNIQUE,
 "data" JSONB NOT NULL,
 "expiresAt" TIMESTAMPTZ(3) NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PromotionOperation_recovery" ON "PromotionOperation"("guildId", "status", "updatedAt");
