-- CreateEnum
CREATE TYPE "MonitoringAlertSeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "MonitoringConditionOp" AS ENUM ('GT', 'GTE', 'LT', 'LTE', 'EQ');

-- CreateEnum
CREATE TYPE "MonitoringAggregationType" AS ENUM ('COUNT', 'AVG', 'SUM', 'MAX', 'MIN', 'P95', 'P99');

-- CreateEnum
CREATE TYPE "MonitoringChannelType" AS ENUM ('EMAIL', 'SLACK');

-- CreateTable

CREATE TABLE "MonitoringAlertRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "severity" "MonitoringAlertSeverity" NOT NULL DEFAULT 'WARNING',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metricType" TEXT NOT NULL,
    "conditionOperator" "MonitoringConditionOp" NOT NULL DEFAULT 'GT',
    "conditionAggregation" "MonitoringAggregationType" NOT NULL DEFAULT 'AVG',
    "timeWindowSeconds" INTEGER NOT NULL,
    "threshold" DECIMAL(10,2) NOT NULL,
    "notificationChannels" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringAlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringNotificationChannel" (
    "id" TEXT NOT NULL,
    "type" "MonitoringChannelType" NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonitoringNotificationChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringAlertHistory" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "severity" "MonitoringAlertSeverity" NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "metricValue" DECIMAL(10, 2) NOT NULL,
    "threshold" DECIMAL(10, 2) NOT NULL,
    "tenantId" TEXT,
    "context" JSONB,
    "notificationsSent" JSONB,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    CONSTRAINT "MonitoringAlertHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringMaintenanceWindow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonitoringMaintenanceWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonitoringAlertRule_tenantId_idx" ON "MonitoringAlertRule" ("tenantId");

-- CreateIndex
CREATE INDEX "MonitoringAlertRule_enabled_idx" ON "MonitoringAlertRule" ("enabled");

-- CreateIndex
CREATE INDEX "MonitoringAlertRule_metricType_idx" ON "MonitoringAlertRule" ("metricType");

-- CreateIndex
CREATE INDEX "MonitoringNotificationChannel_type_idx" ON "MonitoringNotificationChannel" ("type");

-- CreateIndex
CREATE INDEX "MonitoringNotificationChannel_enabled_idx" ON "MonitoringNotificationChannel" ("enabled");

-- CreateIndex
CREATE INDEX "MonitoringAlertHistory_ruleId_idx" ON "MonitoringAlertHistory" ("ruleId");

-- CreateIndex
CREATE INDEX "MonitoringAlertHistory_tenantId_idx" ON "MonitoringAlertHistory" ("tenantId");

-- CreateIndex
CREATE INDEX "MonitoringAlertHistory_triggeredAt_idx" ON "MonitoringAlertHistory" ("triggeredAt");

-- CreateIndex
CREATE INDEX "MonitoringAlertHistory_severity_idx" ON "MonitoringAlertHistory" ("severity");

-- CreateIndex
CREATE INDEX "MonitoringMaintenanceWindow_startTime_endTime_idx" ON "MonitoringMaintenanceWindow" ("startTime", "endTime");

-- CreateIndex
CREATE INDEX "MonitoringMaintenanceWindow_isActive_idx" ON "MonitoringMaintenanceWindow" ("isActive");

-- AddForeignKey
ALTER TABLE "MonitoringAlertRule"
ADD CONSTRAINT "MonitoringAlertRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringAlertHistory"
ADD CONSTRAINT "MonitoringAlertHistory_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "MonitoringAlertRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE;