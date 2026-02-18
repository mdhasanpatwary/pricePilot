-- CreateTable
CREATE TABLE "DomainSearchPattern" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainSearchPattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DomainSearchPattern_domain_idx" ON "DomainSearchPattern"("domain");

-- CreateIndex
CREATE INDEX "DomainSearchPattern_successRate_idx" ON "DomainSearchPattern"("successRate");

-- CreateIndex
CREATE UNIQUE INDEX "DomainSearchPattern_domain_pattern_key" ON "DomainSearchPattern"("domain", "pattern");

