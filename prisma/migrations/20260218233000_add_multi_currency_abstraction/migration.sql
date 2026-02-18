-- AlterTable Product
ALTER TABLE "Product"
ADD COLUMN "originalPrice" DECIMAL(10,2),
ADD COLUMN "originalCurrency" TEXT,
ADD COLUMN "normalizedPrice" DECIMAL(10,2),
ADD COLUMN "exchangeRateUsed" DECIMAL(18,8),
ADD COLUMN "exchangeRateTimestamp" TIMESTAMP(3),
ADD COLUMN "geoVariantDetected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "geoVariantDetectedAt" TIMESTAMP(3);

-- AlterTable PriceHistory
ALTER TABLE "PriceHistory"
ADD COLUMN "originalPrice" DECIMAL(10,2),
ADD COLUMN "originalCurrency" TEXT,
ADD COLUMN "normalizedPrice" DECIMAL(10,2),
ADD COLUMN "exchangeRateUsed" DECIMAL(18,8),
ADD COLUMN "exchangeRateTimestamp" TIMESTAMP(3);

-- AlterTable ScrapeAttempt
ALTER TABLE "ScrapeAttempt"
ADD COLUMN "observedPrice" DECIMAL(10,2),
ADD COLUMN "observedCurrency" TEXT,
ADD COLUMN "geoVariantDetected" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable DomainProfile
ALTER TABLE "DomainProfile"
ADD COLUMN "availabilityConfig" JSONB;

-- Backfill existing products to preserve currency-safe records
UPDATE "Product"
SET
  "originalPrice" = "currentPrice",
  "originalCurrency" = COALESCE("currency", 'USD'),
  "normalizedPrice" = "currentPrice",
  "exchangeRateUsed" = 1,
  "exchangeRateTimestamp" = NOW()
WHERE "originalPrice" IS NULL;

-- Backfill existing price history
UPDATE "PriceHistory"
SET
  "originalPrice" = "price",
  "normalizedPrice" = "price",
  "exchangeRateUsed" = 1,
  "exchangeRateTimestamp" = NOW()
WHERE "originalPrice" IS NULL;

-- Indexes
CREATE INDEX "Product_geoVariantDetected_idx" ON "Product"("geoVariantDetected");
CREATE INDEX "ScrapeAttempt_geoVariantDetected_idx" ON "ScrapeAttempt"("geoVariantDetected");
