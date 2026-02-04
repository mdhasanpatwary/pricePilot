-- CreateTable
CREATE TABLE "Proxy" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" TEXT NOT NULL,
    "username" TEXT,
    "passwordEncrypted" TEXT,
    "region" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "globalSuccessCount" INTEGER NOT NULL DEFAULT 0,
    "globalFailureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Proxy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProxySiteHealth" (
    "id" TEXT NOT NULL,
    "proxyId" TEXT NOT NULL,
    "competitorWebsiteId" TEXT NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "cooldownUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProxySiteHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competitorWebsiteId" TEXT NOT NULL,
    "preferredStrategy" TEXT NOT NULL DEFAULT 'http_client',
    "requiresJavascript" BOOLEAN NOT NULL DEFAULT false,
    "proxyRequired" BOOLEAN NOT NULL DEFAULT false,
    "baseDelayMs" INTEGER NOT NULL DEFAULT 2000,
    "maxDelayMs" INTEGER NOT NULL DEFAULT 300000,
    "backoffMultiplier" DECIMAL(3, 2) NOT NULL DEFAULT 2.0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "priceSelectors" JSONB NOT NULL,
    "currencySelector" TEXT,
    "fallbackRegex" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScrapingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingCookieJar" (
    "id" TEXT NOT NULL,
    "competitorWebsiteId" TEXT NOT NULL,
    "cookies" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScrapingCookieJar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competitorProductId" TEXT NOT NULL,
    "competitorWebsiteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "proxyId" TEXT,
    "userAgent" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "protectionDetected" BOOLEAN NOT NULL DEFAULT false,
    "protectionType" TEXT,
    "statusCode" INTEGER,
    "responseTimeMs" INTEGER,
    "responseSizeBytes" INTEGER,
    "responseSample" TEXT,
    "screenshotUrl" TEXT,
    "errorMessage" TEXT,
    "attemptNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScrapeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtectionDetection" (
    "id" TEXT NOT NULL,
    "scrapeAttemptId" TEXT NOT NULL,
    "protectionType" TEXT NOT NULL,
    "confidence" DECIMAL(5, 2) NOT NULL,
    "indicators" JSONB NOT NULL,
    "reasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProtectionDetection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingMetric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competitorWebsiteId" TEXT NOT NULL,
    "hourTimestamp" TIMESTAMP(3) NOT NULL,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "successfulAttempts" INTEGER NOT NULL DEFAULT 0,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTimeMs" INTEGER,
    "protectionTypeCounts" JSONB,
    "strategyCounts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScrapingMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingAlert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competitorWebsiteId" TEXT,
    "severity" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScrapingAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proxy_host_port_key" ON "Proxy" ("host", "port");

-- CreateIndex
CREATE INDEX "Proxy_status_idx" ON "Proxy" ("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProxySiteHealth_proxyId_competitorWebsiteId_key" ON "ProxySiteHealth" (
    "proxyId",
    "competitorWebsiteId"
);

-- CreateIndex
CREATE INDEX "ProxySiteHealth_proxyId_idx" ON "ProxySiteHealth" ("proxyId");

-- CreateIndex
CREATE INDEX "ProxySiteHealth_competitorWebsiteId_idx" ON "ProxySiteHealth" ("competitorWebsiteId");

-- CreateIndex
CREATE INDEX "ProxySiteHealth_cooldownUntil_idx" ON "ProxySiteHealth" ("cooldownUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapingConfig_competitorWebsiteId_key" ON "ScrapingConfig" ("competitorWebsiteId");

-- CreateIndex
CREATE INDEX "ScrapingConfig_tenantId_idx" ON "ScrapingConfig" ("tenantId");

-- CreateIndex
CREATE INDEX "ScrapingConfig_competitorWebsiteId_idx" ON "ScrapingConfig" ("competitorWebsiteId");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapingCookieJar_competitorWebsiteId_key" ON "ScrapingCookieJar" ("competitorWebsiteId");

-- CreateIndex
CREATE INDEX "ScrapingCookieJar_competitorWebsiteId_idx" ON "ScrapingCookieJar" ("competitorWebsiteId");

-- CreateIndex
CREATE INDEX "ScrapingCookieJar_expiresAt_idx" ON "ScrapingCookieJar" ("expiresAt");

-- CreateIndex
CREATE INDEX "ScrapeAttempt_tenantId_idx" ON "ScrapeAttempt" ("tenantId");

-- CreateIndex
CREATE INDEX "ScrapeAttempt_competitorProductId_idx" ON "ScrapeAttempt" ("competitorProductId");

-- CreateIndex
CREATE INDEX "ScrapeAttempt_competitorWebsiteId_idx" ON "ScrapeAttempt" ("competitorWebsiteId");

-- CreateIndex
CREATE INDEX "ScrapeAttempt_createdAt_idx" ON "ScrapeAttempt" ("createdAt");

-- CreateIndex
CREATE INDEX "ScrapeAttempt_success_idx" ON "ScrapeAttempt" ("success");

-- CreateIndex
CREATE INDEX "ScrapeAttempt_protectionDetected_protectionType_idx" ON "ScrapeAttempt" (
    "protectionDetected",
    "protectionType"
);

-- CreateIndex
CREATE INDEX "ProtectionDetection_scrapeAttemptId_idx" ON "ProtectionDetection" ("scrapeAttemptId");

-- CreateIndex
CREATE INDEX "ProtectionDetection_protectionType_idx" ON "ProtectionDetection" ("protectionType");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapingMetric_tenantId_competitorWebsiteId_hourTimestamp_key" ON "ScrapingMetric" (
    "tenantId",
    "competitorWebsiteId",
    "hourTimestamp"
);

-- CreateIndex
CREATE INDEX "ScrapingMetric_tenantId_hourTimestamp_idx" ON "ScrapingMetric" ("tenantId", "hourTimestamp");

-- CreateIndex
CREATE INDEX "ScrapingMetric_competitorWebsiteId_hourTimestamp_idx" ON "ScrapingMetric" (
    "competitorWebsiteId",
    "hourTimestamp"
);

-- CreateIndex
CREATE INDEX "ScrapingAlert_tenantId_idx" ON "ScrapingAlert" ("tenantId");

-- CreateIndex
CREATE INDEX "ScrapingAlert_competitorWebsiteId_idx" ON "ScrapingAlert" ("competitorWebsiteId");

-- CreateIndex
CREATE INDEX "ScrapingAlert_acknowledged_idx" ON "ScrapingAlert" ("acknowledged");

-- CreateIndex
CREATE INDEX "ScrapingAlert_createdAt_idx" ON "ScrapingAlert" ("createdAt");

-- AddForeignKey
ALTER TABLE "ProxySiteHealth"
ADD CONSTRAINT "ProxySiteHealth_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "Proxy" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProxySiteHealth"
ADD CONSTRAINT "ProxySiteHealth_competitorWebsiteId_fkey" FOREIGN KEY ("competitorWebsiteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapingConfig"
ADD CONSTRAINT "ScrapingConfig_competitorWebsiteId_fkey" FOREIGN KEY ("competitorWebsiteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapingCookieJar"
ADD CONSTRAINT "ScrapingCookieJar_competitorWebsiteId_fkey" FOREIGN KEY ("competitorWebsiteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeAttempt"
ADD CONSTRAINT "ScrapeAttempt_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "Proxy" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeAttempt"
ADD CONSTRAINT "ScrapeAttempt_competitorProductId_fkey" FOREIGN KEY ("competitorProductId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeAttempt"
ADD CONSTRAINT "ScrapeAttempt_competitorWebsiteId_fkey" FOREIGN KEY ("competitorWebsiteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectionDetection"
ADD CONSTRAINT "ProtectionDetection_scrapeAttemptId_fkey" FOREIGN KEY ("scrapeAttemptId") REFERENCES "ScrapeAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapingMetric"
ADD CONSTRAINT "ScrapingMetric_competitorWebsiteId_fkey" FOREIGN KEY ("competitorWebsiteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapingAlert"
ADD CONSTRAINT "ScrapingAlert_competitorWebsiteId_fkey" FOREIGN KEY ("competitorWebsiteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE;