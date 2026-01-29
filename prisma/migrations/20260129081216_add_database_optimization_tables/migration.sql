-- CreateTable
CREATE TABLE "SlowQuery" (
    "id" TEXT NOT NULL,
    "queryFingerprint" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "executionTimeMs" INTEGER NOT NULL,
    "affectedRows" INTEGER,
    "tenantId" TEXT,
    "executionPlan" TEXT,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlowQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryPerformanceMetric" (
    "id" TEXT NOT NULL,
    "queryFingerprint" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "executionCount" INTEGER NOT NULL,
    "avgExecutionTimeMs" DECIMAL(10,2) NOT NULL,
    "maxExecutionTimeMs" INTEGER NOT NULL,
    "minExecutionTimeMs" INTEGER NOT NULL,
    "p95ExecutionTimeMs" INTEGER NOT NULL,
    "totalRowsAffected" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryPerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexRecommendation" (
    "id" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "columns" TEXT[],
    "reason" TEXT NOT NULL,
    "estimatedImpact" TEXT NOT NULL,
    "createStatement" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "IndexRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlowQuery_queryFingerprint_idx" ON "SlowQuery"("queryFingerprint");

-- CreateIndex
CREATE INDEX "SlowQuery_executionTimeMs_idx" ON "SlowQuery"("executionTimeMs");

-- CreateIndex
CREATE INDEX "SlowQuery_createdAt_idx" ON "SlowQuery"("createdAt");

-- CreateIndex
CREATE INDEX "QueryPerformanceMetric_queryFingerprint_date_idx" ON "QueryPerformanceMetric"("queryFingerprint", "date");

-- CreateIndex
CREATE UNIQUE INDEX "QueryPerformanceMetric_queryFingerprint_date_key" ON "QueryPerformanceMetric"("queryFingerprint", "date");

-- CreateIndex
CREATE INDEX "IndexRecommendation_status_idx" ON "IndexRecommendation"("status");

-- CreateIndex
CREATE INDEX "IndexRecommendation_tableName_idx" ON "IndexRecommendation"("tableName");
