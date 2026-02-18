-- CreateEnum
CREATE TYPE "ScrapeFailureType" AS ENUM (
  'NAVIGATION_FAILED',
  'BOT_BLOCKED',
  'SEARCH_EMPTY',
  'STRUCTURE_CHANGED',
  'PARSE_FAILED',
  'PRICE_ZERO',
  'TIMEOUT'
);

-- AlterTable
ALTER TABLE "ScrapeAttempt"
ADD COLUMN "failureType" "ScrapeFailureType";

-- AlterTable
ALTER TABLE "ScrapingMetric"
ADD COLUMN "failureTypeCounts" JSONB;

-- CreateIndex
CREATE INDEX "ScrapeAttempt_failureType_idx" ON "ScrapeAttempt"("failureType");

-- CreateIndex
CREATE INDEX "ScrapeAttempt_competitorWebsiteId_failureType_idx" ON "ScrapeAttempt"("competitorWebsiteId", "failureType");

