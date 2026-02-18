-- CreateEnum
CREATE TYPE "ScrapeExecutionStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED', 'ANOMALY');

-- AlterTable Product
ALTER TABLE "Product"
ADD COLUMN "canonicalUrl" TEXT,
ADD COLUMN "normalizedSlug" TEXT;

-- AlterTable ScrapeAttempt
ALTER TABLE "ScrapeAttempt"
ADD COLUMN "scrapeStatus" "ScrapeExecutionStatus" NOT NULL DEFAULT 'FAILED';

-- AlterTable DomainProfile
ALTER TABLE "DomainProfile"
ADD COLUMN "needsManualReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastFailureAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ScrapePriceAnomaly" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competitorProductId" TEXT NOT NULL,
    "competitorWebsiteId" TEXT NOT NULL,
    "detectedPrice" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "reasons" JSONB NOT NULL,
    "details" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "reviewNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScrapePriceAnomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeCostMetric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competitorProductId" TEXT NOT NULL,
    "competitorWebsiteId" TEXT NOT NULL,
    "executionTimeMs" INTEGER NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "proxyUsed" BOOLEAN NOT NULL DEFAULT false,
    "finalSuccess" BOOLEAN NOT NULL,
    "scrapeStatus" "ScrapeExecutionStatus" NOT NULL,
    "costPerValidScrape" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScrapeCostMetric_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Product_siteId_canonicalUrl_idx" ON "Product"("siteId", "canonicalUrl");
CREATE INDEX "Product_siteId_normalizedSlug_idx" ON "Product"("siteId", "normalizedSlug");
CREATE INDEX "ScrapeAttempt_scrapeStatus_idx" ON "ScrapeAttempt"("scrapeStatus");
CREATE INDEX "DomainProfile_needsManualReview_idx" ON "DomainProfile"("needsManualReview");
CREATE INDEX "ScrapePriceAnomaly_competitorProductId_createdAt_idx" ON "ScrapePriceAnomaly"("competitorProductId", "createdAt");
CREATE INDEX "ScrapePriceAnomaly_competitorWebsiteId_status_idx" ON "ScrapePriceAnomaly"("competitorWebsiteId", "status");
CREATE INDEX "ScrapePriceAnomaly_status_createdAt_idx" ON "ScrapePriceAnomaly"("status", "createdAt");
CREATE INDEX "ScrapePriceAnomaly_tenantId_status_idx" ON "ScrapePriceAnomaly"("tenantId", "status");
CREATE INDEX "ScrapeCostMetric_competitorWebsiteId_createdAt_idx" ON "ScrapeCostMetric"("competitorWebsiteId", "createdAt");
CREATE INDEX "ScrapeCostMetric_createdAt_idx" ON "ScrapeCostMetric"("createdAt");
CREATE INDEX "ScrapeCostMetric_tenantId_createdAt_idx" ON "ScrapeCostMetric"("tenantId", "createdAt");

-- Foreign keys
ALTER TABLE "ScrapePriceAnomaly"
ADD CONSTRAINT "ScrapePriceAnomaly_competitorProductId_fkey"
FOREIGN KEY ("competitorProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScrapePriceAnomaly"
ADD CONSTRAINT "ScrapePriceAnomaly_competitorWebsiteId_fkey"
FOREIGN KEY ("competitorWebsiteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScrapeCostMetric"
ADD CONSTRAINT "ScrapeCostMetric_competitorProductId_fkey"
FOREIGN KEY ("competitorProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScrapeCostMetric"
ADD CONSTRAINT "ScrapeCostMetric_competitorWebsiteId_fkey"
FOREIGN KEY ("competitorWebsiteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
