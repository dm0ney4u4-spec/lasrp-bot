-- CreateTable
CREATE TABLE "GuildState" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebSession" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "csrf" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebSession_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "LinkedRobloxAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "robloxId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedRobloxAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CivilianCharacter" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "demographics" JSONB NOT NULL DEFAULT '{}',
    "licenses" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CivilianCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleRegistration" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "stolen" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL_ROLEPLAY',
    "callerId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "agency" TEXT NOT NULL DEFAULT 'police',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dispatcherId" TEXT,
    "coordinates" JSONB,
    "notes" JSONB NOT NULL DEFAULT '[]',
    "timestamps" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "callsign" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "location" TEXT,
    "coordinates" JSONB,
    "locationSource" TEXT NOT NULL DEFAULT 'MANUAL_ROLEPLAY',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallAssignment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CadRecord" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "subjectId" TEXT,
    "incidentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sealed" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CadRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadioMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "callsign" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "priority" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadioMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'intro',
    "step" INTEGER NOT NULL DEFAULT 0,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "questions" JSONB NOT NULL,
    "reviewerId" TEXT,
    "decisionReason" TEXT,
    "privateNotes" JSONB NOT NULL DEFAULT '[]',
    "history" JSONB NOT NULL DEFAULT '[]',
    "reviewMessageId" TEXT,
    "reviewChannelId" TEXT,
    "dmFailed" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activeKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTranscript" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "openerId" TEXT NOT NULL,
    "staffIds" JSONB NOT NULL,
    "text" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebSession_expiresAt_idx" ON "WebSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedRobloxAccount_userId_key" ON "LinkedRobloxAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedRobloxAccount_robloxId_key" ON "LinkedRobloxAccount"("robloxId");

-- CreateIndex
CREATE INDEX "CivilianCharacter_ownerId_idx" ON "CivilianCharacter"("ownerId");

-- CreateIndex
CREATE INDEX "CivilianCharacter_name_idx" ON "CivilianCharacter"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleRegistration_plate_key" ON "VehicleRegistration"("plate");

-- CreateIndex
CREATE INDEX "VehicleRegistration_ownerId_idx" ON "VehicleRegistration"("ownerId");

-- CreateIndex
CREATE INDEX "VehicleRegistration_characterId_idx" ON "VehicleRegistration"("characterId");

-- CreateIndex
CREATE INDEX "Incident_status_priority_createdAt_idx" ON "Incident"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_callerId_idx" ON "Incident"("callerId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_userId_key" ON "Unit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CallAssignment_incidentId_unitId_key" ON "CallAssignment"("incidentId", "unitId");

-- CreateIndex
CREATE INDEX "CadRecord_kind_agency_status_idx" ON "CadRecord"("kind", "agency", "status");

-- CreateIndex
CREATE INDEX "CadRecord_subjectId_idx" ON "CadRecord"("subjectId");

-- CreateIndex
CREATE INDEX "CadRecord_incidentId_idx" ON "CadRecord"("incidentId");

-- CreateIndex
CREATE INDEX "RadioMessage_agency_createdAt_idx" ON "RadioMessage"("agency", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityId_createdAt_idx" ON "AuditEvent"("entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Application_number_key" ON "Application"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Application_activeKey_key" ON "Application"("activeKey");

-- CreateIndex
CREATE INDEX "Application_applicantId_status_idx" ON "Application"("applicantId", "status");

-- CreateIndex
CREATE INDEX "TicketTranscript_expiresAt_idx" ON "TicketTranscript"("expiresAt");

-- AddForeignKey
ALTER TABLE "WebSession" ADD CONSTRAINT "WebSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedRobloxAccount" ADD CONSTRAINT "LinkedRobloxAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CivilianCharacter" ADD CONSTRAINT "CivilianCharacter_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleRegistration" ADD CONSTRAINT "VehicleRegistration_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallAssignment" ADD CONSTRAINT "CallAssignment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallAssignment" ADD CONSTRAINT "CallAssignment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
