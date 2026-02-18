-- Idempotent repair for 20260208000000_add_api_patterns
-- Use this when the migration is marked as failed in _prisma_migrations (P3009),
-- but some or all database objects may already exist.

-- Create table if missing
CREATE TABLE IF NOT EXISTS "ApiPattern" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competitorWebsiteId" TEXT NOT NULL,
    "pattern" JSONB NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApiPattern_pkey" PRIMARY KEY ("id")
);

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS "ApiPattern_competitorWebsiteId_idx" ON "ApiPattern" ("competitorWebsiteId");
CREATE INDEX IF NOT EXISTS "ApiPattern_tenantId_idx" ON "ApiPattern" ("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "ApiPattern_competitorWebsiteId_key" ON "ApiPattern" ("competitorWebsiteId");

-- Foreign keys (idempotent via catalog check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApiPattern_competitorWebsiteId_fkey'
  ) THEN
    ALTER TABLE "ApiPattern"
    ADD CONSTRAINT "ApiPattern_competitorWebsiteId_fkey"
    FOREIGN KEY ("competitorWebsiteId") REFERENCES "Site" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApiPattern_tenantId_fkey'
  ) THEN
    ALTER TABLE "ApiPattern"
    ADD CONSTRAINT "ApiPattern_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

