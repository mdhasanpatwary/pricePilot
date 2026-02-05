-- Add last known good price fields to Product table
ALTER TABLE "Product" ADD COLUMN "lastKnownGoodPrice" DECIMAL(10, 2);

ALTER TABLE "Product" ADD COLUMN "lastKnownGoodPriceAt" TIMESTAMP;

ALTER TABLE "Product" ADD COLUMN "lastKnownGoodCurrency" VARCHAR(10);

-- Add index for querying products with stale prices
CREATE INDEX "idx_product_last_known_good_at" ON "Product" ("lastKnownGoodPriceAt");