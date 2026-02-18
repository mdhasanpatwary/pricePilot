-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "priceAnomalyActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "priceAnomalyDetectedAt" TIMESTAMP(6),
ADD COLUMN "priceAnomalyData" JSONB;

-- CreateIndex
CREATE INDEX "Product_priceAnomalyActive_idx" ON "Product" ("priceAnomalyActive");

