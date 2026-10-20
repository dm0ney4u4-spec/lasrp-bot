-- CreateTable
CREATE TABLE "OperationalCase" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "incidentId" TEXT,
    "reportId" TEXT,
    "activeKey" TEXT,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperationalCase_reportId_key" ON "OperationalCase"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalCase_activeKey_key" ON "OperationalCase"("activeKey");

-- CreateIndex
CREATE INDEX "OperationalCase_kind_status_createdAt_idx" ON "OperationalCase"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OperationalCase_creatorId_idx" ON "OperationalCase"("creatorId");

-- AddForeignKey
ALTER TABLE "OperationalCase" ADD CONSTRAINT "OperationalCase_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CadRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
