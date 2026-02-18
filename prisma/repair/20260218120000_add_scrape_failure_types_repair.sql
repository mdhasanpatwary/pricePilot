-- Idempotent repair for 20260218120000_add_scrape_failure_types
-- Use this when the migration is marked as failed (P3018/P3009) due to objects already existing.

-- Enum type (idempotent via catalog check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ScrapeFailureType'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "ScrapeFailureType" AS ENUM (
      'NAVIGATION_FAILED',
      'BOT_BLOCKED',
      'SEARCH_EMPTY',
      'STRUCTURE_CHANGED',
      'PARSE_FAILED',
      'PRICE_ZERO',
      'TIMEOUT'
    );
  END IF;
END $$;

-- Columns (idempotent)
ALTER TABLE "ScrapeAttempt"
ADD COLUMN IF NOT EXISTS "failureType" "ScrapeFailureType";

ALTER TABLE "ScrapingMetric"
ADD COLUMN IF NOT EXISTS "failureTypeCounts" JSONB;

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS "ScrapeAttempt_failureType_idx" ON "ScrapeAttempt"("failureType");
CREATE INDEX IF NOT EXISTS "ScrapeAttempt_competitorWebsiteId_failureType_idx" ON "ScrapeAttempt"("competitorWebsiteId", "failureType");

