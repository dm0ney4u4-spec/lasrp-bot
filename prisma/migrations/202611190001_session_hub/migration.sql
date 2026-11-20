CREATE TABLE "SessionHub" (
  "guildId" TEXT PRIMARY KEY,
  "version" INTEGER NOT NULL DEFAULT 1,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "SessionHubEvent" (
  "id" TEXT PRIMARY KEY,
  "guildId" TEXT NOT NULL REFERENCES "SessionHub"("guildId"),
  "kind" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data" JSONB NOT NULL,
  "announcementMessageId" TEXT,
  "logMessageId" TEXT,
  "complete" BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX "SessionHubEvent_pending" ON "SessionHubEvent"("guildId", "complete", "createdAt");
