-- AlterTable
ALTER TABLE "PendingPriceChange" ADD COLUMN     "autoApprovedAt" TIMESTAMP(3),
ADD COLUMN     "autoApprovedBy" TEXT;

-- CreateTable
CREATE TABLE "AutoApprovalRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "conditions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoApprovalRule_tenantId_enabled_priority_idx" ON "AutoApprovalRule"("tenantId", "enabled", "priority");

-- CreateIndex
CREATE INDEX "AutoApprovalRule_tenantId_idx" ON "AutoApprovalRule"("tenantId");

-- AddForeignKey
ALTER TABLE "AutoApprovalRule" ADD CONSTRAINT "AutoApprovalRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
