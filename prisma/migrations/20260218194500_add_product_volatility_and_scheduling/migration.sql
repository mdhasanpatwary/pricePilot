-- Product volatility scoring + adaptive scheduling fields.

-- 1) Add scheduling fields to Product
ALTER TABLE "Product"
ADD COLUMN "nextScrapeAt" TIMESTAMP(3),
ADD COLUMN "lastScrapeAttemptAt" TIMESTAMP(3),
ADD COLUMN "lastScrapeSucceededAt" TIMESTAMP(3),
ADD COLUMN "lastScrapeFailedAt" TIMESTAMP(3),
ADD COLUMN "consecutiveScrapeFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "businessPriority" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Product_nextScrapeAt_idx" ON "Product"("nextScrapeAt");

-- 2) Create ProductVolatility
CREATE TABLE "ProductVolatility" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "volatilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastPriceChangeAt" TIMESTAMP(3),
  "priceChangeCount30d" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductVolatility_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductVolatility_productId_key" ON "ProductVolatility"("productId");
CREATE INDEX "ProductVolatility_volatilityScore_idx" ON "ProductVolatility"("volatilityScore");
CREATE INDEX "ProductVolatility_lastPriceChangeAt_idx" ON "ProductVolatility"("lastPriceChangeAt");

ALTER TABLE "ProductVolatility"
ADD CONSTRAINT "ProductVolatility_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

