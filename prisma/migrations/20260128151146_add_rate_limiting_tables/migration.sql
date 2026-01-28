-- CreateTable
CREATE TABLE "RateLimitMetric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "limiterType" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "violationCount" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBypass" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "setBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitBypass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitCustomMultiplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "setBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitCustomMultiplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimitMetric_tenantId_timestamp_idx" ON "RateLimitMetric"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "RateLimitMetric_limiterType_timestamp_idx" ON "RateLimitMetric"("limiterType", "timestamp");

-- CreateIndex
CREATE INDEX "RateLimitMetric_tenantId_limiterType_timestamp_idx" ON "RateLimitMetric"("tenantId", "limiterType", "timestamp");

-- CreateIndex
CREATE INDEX "RateLimitBypass_tenantId_isActive_expiresAt_idx" ON "RateLimitBypass"("tenantId", "isActive", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitCustomMultiplier_tenantId_key" ON "RateLimitCustomMultiplier"("tenantId");

-- CreateIndex
CREATE INDEX "RateLimitCustomMultiplier_tenantId_idx" ON "RateLimitCustomMultiplier"("tenantId");

-- AddForeignKey
ALTER TABLE "RateLimitMetric" ADD CONSTRAINT "RateLimitMetric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateLimitBypass" ADD CONSTRAINT "RateLimitBypass_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateLimitCustomMultiplier" ADD CONSTRAINT "RateLimitCustomMultiplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
