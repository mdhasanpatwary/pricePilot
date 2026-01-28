-- CreateEnum for approval status
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable for PendingPriceChange
CREATE TABLE "PendingPriceChange" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "currentPrice" DECIMAL(10, 2) NOT NULL,
    "recommendedPrice" DECIMAL(10, 2) NOT NULL,
    "reason" TEXT NOT NULL,
    "appliedRule" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PendingPriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingPriceChange_tenantId_status_idx" ON "PendingPriceChange" ("tenantId", "status");

CREATE INDEX "PendingPriceChange_productId_idx" ON "PendingPriceChange" ("productId");

CREATE INDEX "PendingPriceChange_expiresAt_idx" ON "PendingPriceChange" ("expiresAt");

-- AddForeignKey
ALTER TABLE "PendingPriceChange"
ADD CONSTRAINT "PendingPriceChange_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PendingPriceChange"
ADD CONSTRAINT "PendingPriceChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;