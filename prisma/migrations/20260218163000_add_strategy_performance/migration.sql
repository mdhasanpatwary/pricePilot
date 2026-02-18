-- CreateTable
CREATE TABLE "StrategyPerformance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competitorWebsiteId" TEXT NOT NULL,
    "strategyType" TEXT NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgExecutionTimeMs" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategyPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StrategyPerformance_competitorWebsiteId_idx" ON "StrategyPerformance"("competitorWebsiteId");

-- CreateIndex
CREATE INDEX "StrategyPerformance_tenantId_idx" ON "StrategyPerformance"("tenantId");

-- CreateIndex
CREATE INDEX "StrategyPerformance_strategyType_idx" ON "StrategyPerformance"("strategyType");

-- CreateIndex
CREATE INDEX "StrategyPerformance_successRate_idx" ON "StrategyPerformance"("successRate");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyPerformance_tenantId_competitorWebsiteId_strategyType_key" ON "StrategyPerformance"("tenantId", "competitorWebsiteId", "strategyType");

-- AddForeignKey
ALTER TABLE "StrategyPerformance"
ADD CONSTRAINT "StrategyPerformance_competitorWebsiteId_fkey" FOREIGN KEY ("competitorWebsiteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyPerformance"
ADD CONSTRAINT "StrategyPerformance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

