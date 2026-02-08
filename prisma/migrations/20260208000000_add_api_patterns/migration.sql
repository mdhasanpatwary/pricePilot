-- CreateTable
CREATE TABLE "ApiPattern" (
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

-- CreateIndex
CREATE INDEX "ApiPattern_competitorWebsiteId_idx" ON "ApiPattern" ("competitorWebsiteId");

-- CreateIndex
CREATE INDEX "ApiPattern_tenantId_idx" ON "ApiPattern" ("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiPattern_competitorWebsiteId_key" ON "ApiPattern" ("competitorWebsiteId");

-- AddForeignKey
ALTER TABLE "ApiPattern"
ADD CONSTRAINT "ApiPattern_competitorWebsiteId_fkey" FOREIGN KEY ("competitorWebsiteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiPattern"
ADD CONSTRAINT "ApiPattern_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;