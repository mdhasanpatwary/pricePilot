-- Add ScrapeAttempt.contextCreated to track browser context creation rate for scrape cost metrics
ALTER TABLE "ScrapeAttempt"
ADD COLUMN "contextCreated" BOOLEAN NOT NULL DEFAULT false;

-- Optional index to support rollups by context creation
CREATE INDEX "ScrapeAttempt_contextCreated_idx" ON "ScrapeAttempt"("contextCreated");

