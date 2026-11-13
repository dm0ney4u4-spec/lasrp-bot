-- Additive, idempotent table. Applied ONLY by npm run livery:setup, never startup migrations.
CREATE TABLE IF NOT EXISTS "LiveryLibrary" (
  "id" TEXT PRIMARY KEY,
  "version" INTEGER NOT NULL CHECK ("version" > 0),
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
