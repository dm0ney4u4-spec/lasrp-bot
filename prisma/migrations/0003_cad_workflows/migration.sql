-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "mergedIntoId" TEXT;

-- CreateTable
CREATE TABLE "PenalCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "fine" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PenalCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "penalCodeId" TEXT NOT NULL,
    "codeSnapshot" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "fine" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafficStop" (
    "id" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "callsign" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "driverId" TEXT,
    "passengers" JSONB NOT NULL DEFAULT '[]',
    "narrative" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "disposition" TEXT NOT NULL DEFAULT 'pending',
    "backupRequested" BOOLEAN NOT NULL DEFAULT false,
    "towRequested" BOOLEAN NOT NULL DEFAULT false,
    "incidentId" TEXT,
    "reportId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrafficStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PenalCode_code_key" ON "PenalCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Charge_recordId_penalCodeId_key" ON "Charge"("recordId", "penalCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "TrafficStop_reportId_key" ON "TrafficStop"("reportId");

-- CreateIndex
CREATE INDEX "TrafficStop_agency_status_createdAt_idx" ON "TrafficStop"("agency", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TrafficStop_plate_idx" ON "TrafficStop"("plate");

-- CreateIndex
CREATE INDEX "TrafficStop_driverId_idx" ON "TrafficStop"("driverId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "CadRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_penalCodeId_fkey" FOREIGN KEY ("penalCodeId") REFERENCES "PenalCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficStop" ADD CONSTRAINT "TrafficStop_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficStop" ADD CONSTRAINT "TrafficStop_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CadRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
