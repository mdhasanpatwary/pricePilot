-- CreateIndex
CREATE UNIQUE INDEX "RateLimitMetric_tenantId_limiterType_identifier_endpoint_timestamp_key" ON "RateLimitMetric"("tenantId", "limiterType", "identifier", "endpoint", "timestamp");
