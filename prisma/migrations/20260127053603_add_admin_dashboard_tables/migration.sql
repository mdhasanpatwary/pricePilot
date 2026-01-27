-- CreateTable
CREATE TABLE "ScrapingSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentStage" TEXT NOT NULL,
    "proxyUsed" TEXT,
    "userAgent" TEXT,
    "requestsCompleted" INTEGER NOT NULL DEFAULT 0,
    "requestsTotal" INTEGER NOT NULL DEFAULT 0,
    "challengeType" TEXT,
    "challengeStatus" TEXT,
    "extractedData" JSONB,
    "errors" JSONB,
    "metrics" JSONB,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationResult" (
    "id" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "requests" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "recommendations" JSONB,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAlert" (
    "id" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapingSession_tenantId_idx" ON "ScrapingSession"("tenantId");

-- CreateIndex
CREATE INDEX "ScrapingSession_status_idx" ON "ScrapingSession"("status");

-- CreateIndex
CREATE INDEX "ScrapingSession_startTime_idx" ON "ScrapingSession"("startTime");

-- CreateIndex
CREATE INDEX "SimulationResult_scenario_idx" ON "SimulationResult"("scenario");

-- CreateIndex
CREATE INDEX "SimulationResult_createdAt_idx" ON "SimulationResult"("createdAt");

-- CreateIndex
CREATE INDEX "SystemAlert_acknowledged_idx" ON "SystemAlert"("acknowledged");

-- CreateIndex
CREATE INDEX "SystemAlert_createdAt_idx" ON "SystemAlert"("createdAt");

-- CreateIndex
CREATE INDEX "SystemAlert_severity_idx" ON "SystemAlert"("severity");
