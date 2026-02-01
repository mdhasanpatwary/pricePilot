-- CreateTable
CREATE TABLE "AutoApprovalMetric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleId" TEXT,
    "ruleName" TEXT,
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "nonMatchingCount" INTEGER NOT NULL DEFAULT 0,
    "totalEvaluated" INTEGER NOT NULL DEFAULT 0,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutoApprovalMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoApprovalMetric_tenantId_date_idx" ON "AutoApprovalMetric" ("tenantId", "date");

-- CreateIndex
CREATE INDEX "AutoApprovalMetric_ruleId_date_idx" ON "AutoApprovalMetric" ("ruleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AutoApprovalMetric_tenantId_ruleId_date_key" ON "AutoApprovalMetric" ("tenantId", "ruleId", "date");

-- AddForeignKey
ALTER TABLE "AutoApprovalMetric"
ADD CONSTRAINT "AutoApprovalMetric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;