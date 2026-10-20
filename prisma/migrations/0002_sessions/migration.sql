-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'starting',
    "activeKey" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "reason" TEXT,
    "peakPlayers" INTEGER NOT NULL DEFAULT 0,
    "channelId" TEXT,
    "messageId" TEXT,
    "extensionMinutes" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "player" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledSession" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_activeKey_key" ON "Session"("activeKey");

-- CreateIndex
CREATE INDEX "Session_guildId_startedAt_idx" ON "Session"("guildId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionAttendance_sessionId_player_key" ON "SessionAttendance"("sessionId", "player");

-- CreateIndex
CREATE INDEX "ScheduledSession_guildId_status_startsAt_idx" ON "ScheduledSession"("guildId", "status", "startsAt");

-- AddForeignKey
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
