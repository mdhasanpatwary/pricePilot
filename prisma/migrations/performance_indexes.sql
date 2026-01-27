-- Performance Optimization Indexes
-- These indexes improve query performance for the admin dashboard

-- Improve tenant-specific session queries
-- Used by: SessionTracker.getActiveSessions(), SessionTracker.getSessionHistory()
CREATE INDEX IF NOT EXISTS idx_scraping_session_tenant_start 
ON "ScrapingSession"("tenantId", "startTime" DESC);

-- Improve session status queries
-- Used by: SessionTracker.getSessionCountByStatus()
CREATE INDEX IF NOT EXISTS idx_scraping_session_status 
ON "ScrapingSession"("status", "tenantId");

-- Improve metrics aggregation queries by site
-- Used by: MetricsAggregator.getSiteAnalytics()
CREATE INDEX IF NOT EXISTS idx_scraping_metrics_site_timestamp 
ON "ScrapingMetrics"("site", "timestamp" DESC);

-- Improve proxy metrics queries
-- Used by: MetricsAggregator.getProxyAnalytics()
CREATE INDEX IF NOT EXISTS idx_proxy_metrics_proxy_timestamp 
ON "ProxyMetrics"("proxy", "timestamp" DESC);

-- Improve challenge queries
-- Used by: MetricsAggregator.getChallengeMetrics()
CREATE INDEX IF NOT EXISTS idx_challenge_attempt_timestamp 
ON "ChallengeAttempt"("timestamp" DESC);

-- Improve challenge type queries
CREATE INDEX IF NOT EXISTS idx_challenge_attempt_type_timestamp 
ON "ChallengeAttempt"("challengeType", "timestamp" DESC);

-- Improve proxy health queries
-- Used by: MetricsAggregator.getProxyMetrics()
CREATE INDEX IF NOT EXISTS idx_proxy_health_healthy 
ON "ProxyHealth"("isHealthy", "lastChecked" DESC);

-- Improve session end time queries for completed sessions
-- Used by: MetricsAggregator.getPlatformMetrics()
CREATE INDEX IF NOT EXISTS idx_scraping_session_endtime 
ON "ScrapingSession"("endTime" DESC) WHERE "endTime" IS NOT NULL;

-- Composite index for tenant and time range queries
-- Used by: Various tenant-specific analytics queries
CREATE INDEX IF NOT EXISTS idx_scraping_session_tenant_time_status 
ON "ScrapingSession"("tenantId", "startTime" DESC, "status");

-- Index for proxy used queries
-- Used by: Proxy analytics and session tracking
CREATE INDEX IF NOT EXISTS idx_scraping_session_proxy 
ON "ScrapingSession"("proxyUsed") WHERE "proxyUsed" IS NOT NULL;
