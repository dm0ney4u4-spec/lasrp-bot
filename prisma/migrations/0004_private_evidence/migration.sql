-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteCount" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceCustody" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceCustody_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_storageKey_key" ON "Evidence"("storageKey");

-- CreateIndex
CREATE INDEX "Evidence_recordId_createdAt_idx" ON "Evidence"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceCustody_evidenceId_createdAt_idx" ON "EvidenceCustody"("evidenceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "CadRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceCustody" ADD CONSTRAINT "EvidenceCustody_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
