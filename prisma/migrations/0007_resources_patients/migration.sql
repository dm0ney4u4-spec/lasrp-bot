CREATE TABLE "AgencyResource" (
 "id" TEXT NOT NULL, "agency" TEXT NOT NULL, "kind" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'available', "stationId" TEXT, "assignedUnitId" TEXT, "version" INTEGER NOT NULL DEFAULT 1,
 "demo" BOOLEAN NOT NULL DEFAULT false, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AgencyResource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgencyResource_assignedUnitId_key" ON "AgencyResource"("assignedUnitId");
CREATE UNIQUE INDEX "AgencyResource_agency_code_demo_key" ON "AgencyResource"("agency", "code", "demo");
ALTER TABLE "AgencyResource" ADD CONSTRAINT "AgencyResource_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "AgencyResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgencyResource" ADD CONSTRAINT "AgencyResource_assignedUnitId_fkey" FOREIGN KEY ("assignedUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "OperationalPatient" (
 "id" TEXT NOT NULL, "caseId" TEXT NOT NULL, "alias" TEXT NOT NULL, "triage" TEXT NOT NULL, "characterId" TEXT,
 "status" TEXT NOT NULL DEFAULT 'assessed', "hospital" TEXT NOT NULL DEFAULT '', "summary" TEXT NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 1, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "OperationalPatient_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OperationalPatient_caseId_idx" ON "OperationalPatient"("caseId");
ALTER TABLE "OperationalPatient" ADD CONSTRAINT "OperationalPatient_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "OperationalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
