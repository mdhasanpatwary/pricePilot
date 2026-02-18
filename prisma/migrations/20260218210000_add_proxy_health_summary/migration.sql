-- CreateTable
CREATE TABLE "ProxyHealthSummary" (
    "id" TEXT NOT NULL,
    "proxyId" TEXT NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blockRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastFailureAt" TIMESTAMP(3),
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "successfulAttempts" INTEGER NOT NULL DEFAULT 0,
    "blockedAttempts" INTEGER NOT NULL DEFAULT 0,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProxyHealthSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProxyHealthSummary_proxyId_key" ON "ProxyHealthSummary"("proxyId");

-- CreateIndex
CREATE INDEX "ProxyHealthSummary_blockRate_idx" ON "ProxyHealthSummary"("blockRate");

-- CreateIndex
CREATE INDEX "ProxyHealthSummary_successRate_idx" ON "ProxyHealthSummary"("successRate");

-- AddForeignKey
ALTER TABLE "ProxyHealthSummary"
ADD CONSTRAINT "ProxyHealthSummary_proxyId_fkey"
FOREIGN KEY ("proxyId") REFERENCES "Proxy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
