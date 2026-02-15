/**
 * MetricsAggregator Service
 *
 * Aggregates and provides real-time metrics from multiple sources with dynamic calculations.
 * Integrates with existing MetricsTracker and provides dashboard-level metrics.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { MetricsTracker } from './metrics-tracker';
import { sessionTracker } from './session-tracker';
import {
    DashboardMetrics,
    PlatformMetrics,
    ScrapingMetrics,
    ProxyMetrics,
    ChallengeMetrics,
    TenantMetrics,
    TimeSeriesData,
    TimeSeriesDataPoint,
    FailureStats,
} from '@/lib/types/admin-dashboard';

interface CacheEntry<T> {
    data: T;
    timestamp: Date;
    ttl: number; // milliseconds
}

/**
 * MetricsAggregator class
 * Provides real-time dashboard metrics with caching for expensive calculations
 */
export class MetricsAggregator {
    private static instance: MetricsAggregator;
    private metricsTracker: MetricsTracker;
    private cache: Map<string, CacheEntry<any>> = new Map();
    private readonly DEFAULT_CACHE_TTL = 30000; // 30 seconds

    private constructor() {
        this.metricsTracker = new MetricsTracker();
    }

    static getInstance(): MetricsAggregator {
        if (!MetricsAggregator.instance) {
            MetricsAggregator.instance = new MetricsAggregator();
        }
        return MetricsAggregator.instance;
    }

    /**
     * Get cached data if available and not expired
     */
    private getCached<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        const age = now - entry.timestamp.getTime();

        if (age > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    /**
     * Set cached data with TTL
     */
    private setCache<T>(key: string, data: T, ttl: number = this.DEFAULT_CACHE_TTL): void {
        this.cache.set(key, {
            data,
            timestamp: new Date(),
            ttl,
        });
    }

    /**
     * Clear cache for a specific key or all cache
     */
    clearCache(key?: string): void {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Get real-time dashboard metrics
     * Aggregates metrics from multiple sources
     *
     * Requirements: 3.1, 3.2, 3.3
     */
    async getDashboardMetrics(): Promise<DashboardMetrics> {
        const cacheKey = 'dashboard_metrics';
        const cached = this.getCached<DashboardMetrics>(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // Get platform metrics
            const platform = await this.getPlatformMetrics();

            // Get scraping metrics
            const scraping = await this.getScrapingMetrics();

            // Get proxy metrics
            const proxies = await this.getProxyMetrics();

            // Get challenge metrics
            const challenges = await this.getChallengeMetrics();

            const metrics: DashboardMetrics = {
                platform,
                scraping,
                proxies,
                challenges,
            };

            // Cache for 60 seconds (dashboard metrics don't need sub-minute freshness)
            this.setCache(cacheKey, metrics, 60000);

            return metrics;
        } catch (error) {
            logger.error('[MetricsAggregator] Error getting dashboard metrics', { error });
            throw error;
        }
    }

    /**
     * Get platform-level metrics
     * Requirements: 3.1
     */
    private async getPlatformMetrics(): Promise<PlatformMetrics> {
        try {
            // Get active sessions count
            const activeSessions = await sessionTracker.getActiveSessions();
            const activeSessionsCount = activeSessions.length;

            // Calculate requests per minute from recent sessions
            const oneMinuteAgo = new Date(Date.now() - 60000);
            const recentSessions = activeSessions.filter(
                s => s.startTime >= oneMinuteAgo
            );
            const requestsPerMinute = recentSessions.reduce(
                (sum, s) => sum + s.requestsCompleted,
                0
            );

            // Calculate average session duration from completed sessions in last hour
            const oneHourAgo = new Date(Date.now() - 3600000);
            const completedSessions = await prisma.scrapingSession.findMany({
                where: {
                    status: { in: ['completed', 'failed'] },
                    endTime: { gte: oneHourAgo },
                },
                select: {
                    startTime: true,
                    endTime: true,
                },
            });

            let avgSessionDuration = 0;
            if (completedSessions.length > 0) {
                const totalDuration = completedSessions.reduce((sum, s) => {
                    if (s.endTime) {
                        return sum + (s.endTime.getTime() - s.startTime.getTime());
                    }
                    return sum;
                }, 0);
                avgSessionDuration = totalDuration / completedSessions.length;
            }

            // Get total tenants count (cached separately with 5-minute TTL since this rarely changes)
            const totalTenantsCacheKey = 'total_tenants';
            let totalTenants = this.getCached<number>(totalTenantsCacheKey);
            if (totalTenants === null) {
                totalTenants = await prisma.tenant.count();
                this.setCache(totalTenantsCacheKey, totalTenants, 300000); // 5 minutes
            }

            // Get active tenants (tenants with sessions in last 24 hours)
            const oneDayAgo = new Date(Date.now() - 86400000);
            const activeTenantIds = await prisma.scrapingSession.findMany({
                where: {
                    startTime: { gte: oneDayAgo },
                },
                select: {
                    tenantId: true,
                },
                distinct: ['tenantId'],
            });
            const activeTenants = activeTenantIds.length;

            return {
                activeSessions: activeSessionsCount,
                requestsPerMinute,
                avgSessionDuration,
                totalTenants,
                activeTenants,
            };
        } catch (error) {
            logger.error('[MetricsAggregator] Error getting platform metrics', { error });
            throw error;
        }
    }

    /**
     * Get scraping-level metrics
     * Requirements: 3.3
     */
    private async getScrapingMetrics(): Promise<ScrapingMetrics> {
        try {
            // Get metrics from last 24 hours
            const oneDayAgo = new Date(Date.now() - 86400000);

            const metrics = await prisma.scrapingMetrics.findMany({
                where: {
                    timestamp: { gte: oneDayAgo },
                },
            });

            // Aggregate metrics
            let totalRequests = 0;
            let successfulRequests = 0;
            let blockedRequests = 0;
            let challengedRequests = 0;
            let totalResponseTime = 0;
            let responseCount = 0;

            for (const metric of metrics) {
                totalRequests += metric.totalRequests;
                successfulRequests += metric.successfulRequests;
                blockedRequests += metric.blockedRequests;
                challengedRequests += metric.challengedRequests;
                totalResponseTime += metric.avgResponseTime * metric.totalRequests;
                responseCount += metric.totalRequests;
            }

            // Calculate rates
            const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0;
            const blockRate = totalRequests > 0 ? blockedRequests / totalRequests : 0;
            const challengeRate = totalRequests > 0 ? challengedRequests / totalRequests : 0;
            const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

            return {
                successRate,
                blockRate,
                challengeRate,
                avgResponseTime,
                requestsLast24h: totalRequests,
            };
        } catch (error) {
            logger.error('[MetricsAggregator] Error getting scraping metrics', { error });
            throw error;
        }
    }

    /**
     * Get proxy-level metrics
     * Requirements: 3.4
     */
    private async getProxyMetrics(): Promise<ProxyMetrics> {
        try {
            // Get all proxies
            const allProxies = await prisma.proxyHealth.findMany({
                select: {
                    proxyUrl: true,
                    isHealthy: true,
                },
            });

            const totalProxies = allProxies.length;
            const healthyProxies = allProxies.filter(p => p.isHealthy).length;

            // Get proxy metrics from last 24 hours
            const oneDayAgo = new Date(Date.now() - 86400000);
            const proxyMetrics = await prisma.proxyMetrics.findMany({
                where: {
                    timestamp: { gte: oneDayAgo },
                },
            });

            // Aggregate proxy metrics
            let totalRequests = 0;
            let successfulRequests = 0;
            let totalResponseTime = 0;
            let responseCount = 0;

            for (const metric of proxyMetrics) {
                totalRequests += metric.totalRequests;
                successfulRequests += metric.successfulRequests;
                totalResponseTime += metric.avgResponseTime * metric.totalRequests;
                responseCount += metric.totalRequests;
            }

            const avgSuccessRate = totalRequests > 0 ? successfulRequests / totalRequests : 0;
            const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

            return {
                totalProxies,
                healthyProxies,
                avgSuccessRate,
                avgResponseTime,
            };
        } catch (error) {
            logger.error('[MetricsAggregator] Error getting proxy metrics', { error });
            throw error;
        }
    }

    /**
     * Get challenge-level metrics
     * Requirements: 3.3
     */
    private async getChallengeMetrics(): Promise<ChallengeMetrics> {
        try {
            // Get challenges from last 24 hours
            const oneDayAgo = new Date(Date.now() - 86400000);

            const challenges = await prisma.challengeAttempt.findMany({
                where: {
                    timestamp: { gte: oneDayAgo },
                },
            });

            const totalChallenges = challenges.length;
            const solvedChallenges = challenges.filter(c => c.solved).length;

            const solveRate = totalChallenges > 0 ? solvedChallenges / totalChallenges : 0;

            // Calculate average solve time (only for solved challenges)
            const solvedDurations = challenges.filter(c => c.solved).map(c => c.duration);
            const avgSolveTime = solvedDurations.length > 0
                ? solvedDurations.reduce((sum, d) => sum + d, 0) / solvedDurations.length
                : 0;

            return {
                totalChallenges,
                solveRate,
                avgSolveTime,
            };
        } catch (error) {
            logger.error('[MetricsAggregator] Error getting challenge metrics', { error });
            throw error;
        }
    }

    /**
     * Get tenant-specific metrics
     * Requirements: 3.5
     */
    async getTenantMetrics(tenantId: string): Promise<TenantMetrics> {
        const cacheKey = `tenant_metrics_${tenantId}`;
        const cached = this.getCached<TenantMetrics>(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // Get tenant info
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: {
                    companyName: true,
                    planType: true,
                },
            });

            if (!tenant) {
                throw new Error(`Tenant not found: ${tenantId}`);
            }

            // Get active sessions for tenant
            const activeSessions = await sessionTracker.getActiveSessions(tenantId);
            const activeSessionsCount = activeSessions.length;

            // Get metrics from last 24 hours
            const oneDayAgo = new Date(Date.now() - 86400000);
            const sessions = await prisma.scrapingSession.findMany({
                where: {
                    tenantId,
                    startTime: { gte: oneDayAgo },
                },
            });

            // Calculate success rate
            const completedSessions = sessions.filter(s => s.status === 'completed' || s.status === 'failed');
            const successfulSessions = sessions.filter(s => s.status === 'completed');
            const successRate = completedSessions.length > 0
                ? successfulSessions.length / completedSessions.length
                : 0;

            // Calculate average scrape time
            const sessionsWithDuration = sessions.filter(s => s.endTime);
            let avgScrapeTime = 0;
            if (sessionsWithDuration.length > 0) {
                const totalTime = sessionsWithDuration.reduce((sum, s) => {
                    if (s.endTime) {
                        return sum + (s.endTime.getTime() - s.startTime.getTime());
                    }
                    return sum;
                }, 0);
                avgScrapeTime = totalTime / sessionsWithDuration.length;
            }

            // Calculate data quality score (based on successful extractions)
            const sessionsWithData = sessions.filter(s => s.extractedData !== null);
            const dataQualityScore = sessions.length > 0
                ? sessionsWithData.length / sessions.length
                : 0;

            // Get resource usage
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const requestsToday = await prisma.scrapingSession.count({
                where: {
                    tenantId,
                    startTime: { gte: today },
                },
            });

            // Set quota based on plan type
            const quotaLimit = tenant.planType === 'PRO' ? 10000 :
                tenant.planType === 'PREMIUM' ? 5000 :
                    tenant.planType === 'BASIC' ? 1000 : 500;
            const quotaUsed = quotaLimit > 0 ? requestsToday / quotaLimit : 0;

            const metrics: TenantMetrics = {
                tenantId,
                tenantName: tenant.companyName,
                activeSessions: activeSessionsCount,
                successRate,
                avgScrapeTime,
                dataQualityScore,
                resourceUsage: {
                    requestsToday,
                    quotaLimit,
                    quotaUsed,
                },
            };

            // Cache for 1 minute
            this.setCache(cacheKey, metrics, 60000);

            return metrics;
        } catch (error) {
            logger.error('[MetricsAggregator] Error getting tenant metrics', {
                error,
                tenantId,
            });
            throw error;
        }
    }

    /**
     * Get time-series data for charts
     * Requirements: 13.1, 13.4
     */
    async getTimeSeriesData(
        metric: 'requests' | 'success_rate' | 'block_rate' | 'response_time',
        timeRange: '1h' | '24h' | '7d'
    ): Promise<TimeSeriesData> {
        const cacheKey = `timeseries_${metric}_${timeRange}`;
        const cached = this.getCached<TimeSeriesData>(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const now = new Date();
            const startTime = new Date(now);

            // Calculate start time based on range
            if (timeRange === '1h') {
                startTime.setHours(now.getHours() - 1);
            } else if (timeRange === '24h') {
                startTime.setHours(now.getHours() - 24);
            } else {
                startTime.setDate(now.getDate() - 7);
            }

            // Get metrics from database
            const metrics = await prisma.scrapingMetrics.findMany({
                where: {
                    timestamp: { gte: startTime },
                },
                orderBy: {
                    timestamp: 'asc',
                },
            });

            // Group by time interval
            const intervalMs = timeRange === '1h' ? 300000 : timeRange === '24h' ? 3600000 : 86400000; // 5min, 1h, 1d
            const dataPointsMap = new Map<number, { count: number; sum: number }>();

            for (const m of metrics) {
                const intervalKey = Math.floor(m.timestamp.getTime() / intervalMs) * intervalMs;
                const existing = dataPointsMap.get(intervalKey) || { count: 0, sum: 0 };

                let value = 0;
                switch (metric) {
                    case 'requests':
                        value = m.totalRequests;
                        break;
                    case 'success_rate':
                        value = m.successRate;
                        break;
                    case 'block_rate':
                        value = m.blockRate;
                        break;
                    case 'response_time':
                        value = m.avgResponseTime;
                        break;
                }

                existing.count++;
                existing.sum += value;
                dataPointsMap.set(intervalKey, existing);
            }

            // Convert to array of data points
            const dataPoints: TimeSeriesDataPoint[] = Array.from(dataPointsMap.entries())
                .map(([timestamp, data]) => ({
                    timestamp: new Date(timestamp),
                    value: data.sum / data.count,
                }))
                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

            const result: TimeSeriesData = {
                metric,
                dataPoints,
            };

            // Cache for 1 minute
            this.setCache(cacheKey, result, 60000);

            return result;
        } catch (error) {
            logger.error('[MetricsAggregator] Error getting time-series data', {
                error,
                metric,
                timeRange,
            });
            throw error;
        }
    }

    /**
     * Get top failing sites or proxies
     * Requirements: 13.2
     */
    async getTopFailures(
        type: 'sites' | 'proxies',
        limit: number = 10,
        timeRange: '1h' | '24h' | '7d' = '24h'
    ): Promise<FailureStats[]> {
        const cacheKey = `top_failures_${type}_${limit}_${timeRange}`;
        const cached = this.getCached<FailureStats[]>(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            let failures: FailureStats[];

            if (type === 'sites') {
                const siteFailures = await this.metricsTracker.getTopFailingSites(limit, timeRange);
                // Convert to FailureStats format and add lastFailure timestamp
                failures = await Promise.all(
                    siteFailures.map(async (f) => {
                        const lastSession = await prisma.scrapingSession.findFirst({
                            where: {
                                siteUrl: f.site,
                                status: 'failed',
                            },
                            orderBy: {
                                startTime: 'desc',
                            },
                            select: {
                                startTime: true,
                            },
                        });
                        return {
                            identifier: f.site,
                            totalRequests: f.totalRequests,
                            failedRequests: f.failedRequests,
                            failureRate: f.failureRate,
                            lastFailure: lastSession?.startTime || new Date(),
                        };
                    })
                );
            } else {
                const proxyFailures = await this.metricsTracker.getTopFailingProxies(limit, timeRange);
                // Convert to FailureStats format and add lastFailure
                failures = await Promise.all(
                    proxyFailures.map(async (pf) => {
                        const lastMetric = await prisma.proxyMetrics.findFirst({
                            where: {
                                proxy: pf.proxy,
                                failedRequests: { gt: 0 },
                            },
                            orderBy: {
                                timestamp: 'desc',
                            },
                            select: {
                                timestamp: true,
                            },
                        });
                        return {
                            identifier: pf.proxy,
                            totalRequests: pf.totalRequests,
                            failedRequests: pf.failedRequests,
                            failureRate: pf.failureRate,
                            lastFailure: lastMetric?.timestamp || new Date(),
                        };
                    })
                );
            }

            // Cache for 2 minutes
            this.setCache(cacheKey, failures, 120000);

            return failures;
        } catch (error) {
            logger.error('[MetricsAggregator] Error getting top failures', {
                error,
                type,
                limit,
                timeRange,
            });
            throw error;
        }
    }

    /**
     * Get metrics for all tenants
     * Requirements: 3.5
     */
    async getAllTenantsMetrics(): Promise<TenantMetrics[]> {
        const cacheKey = 'all_tenants_metrics';
        const cached = this.getCached<TenantMetrics[]>(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // Get all tenants
            const tenants = await prisma.tenant.findMany({
                select: {
                    id: true,
                },
            });

            // Get metrics for each tenant
            const metricsPromises = tenants.map(t => this.getTenantMetrics(t.id));
            const metrics = await Promise.all(metricsPromises);

            // Cache for 2 minutes
            this.setCache(cacheKey, metrics, 120000);

            return metrics;
        } catch (error) {
            logger.error('[MetricsAggregator] Error getting all tenants metrics', { error });
            throw error;
        }
    }

    /**
     * Invalidate cache on data changes
     * Should be called when metrics are updated
     */
    invalidateCache(pattern?: string): void {
        if (!pattern) {
            this.clearCache();
            return;
        }

        // Clear cache entries matching pattern
        const keysToDelete: string[] = [];
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));

        logger.debug('[MetricsAggregator] Cache invalidated', { pattern, count: keysToDelete.length });
    }

    /**
     * Get cache statistics (for debugging)
     */
    getCacheStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        };
    }

    /**
     * Get site analytics for export
     * Requirements: 13.1
     */
    async getSiteAnalytics(startDate: string, endDate: string): Promise<any> {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);

            const sessions = await prisma.scrapingSession.findMany({
                where: {
                    startTime: {
                        gte: start,
                        lte: end,
                    },
                },
                select: {
                    siteUrl: true,
                    status: true,
                    tenantId: true,
                    tenantName: true,
                    startTime: true,
                    endTime: true,
                    metrics: true,
                },
            });

            // Group by site
            const siteMap = new Map<string, any>();

            sessions.forEach(session => {
                if (!siteMap.has(session.siteUrl)) {
                    siteMap.set(session.siteUrl, {
                        siteUrl: session.siteUrl,
                        totalScrapes: 0,
                        successfulScrapes: 0,
                        failedScrapes: 0,
                        avgDuration: 0,
                        durations: [],
                    });
                }

                const site = siteMap.get(session.siteUrl);
                site.totalScrapes++;

                if (session.status === 'completed') {
                    site.successfulScrapes++;
                } else if (session.status === 'failed') {
                    site.failedScrapes++;
                }

                if (session.metrics && typeof session.metrics === 'object') {
                    const metricsObj = session.metrics as any;
                    if (metricsObj.totalTime) {
                        site.durations.push(metricsObj.totalTime);
                    }
                }
            });

            // Calculate averages
            const siteAnalytics = Array.from(siteMap.values()).map(site => {
                const avgDuration = site.durations.length > 0
                    ? site.durations.reduce((a: number, b: number) => a + b, 0) / site.durations.length
                    : 0;

                return {
                    siteUrl: site.siteUrl,
                    totalScrapes: site.totalScrapes,
                    successfulScrapes: site.successfulScrapes,
                    failedScrapes: site.failedScrapes,
                    successRate: site.totalScrapes > 0
                        ? (site.successfulScrapes / site.totalScrapes * 100).toFixed(2) + '%'
                        : '0%',
                    avgDuration: avgDuration.toFixed(2) + 'ms',
                };
            });

            return {
                sites: siteAnalytics,
                summary: {
                    totalSites: siteAnalytics.length,
                    totalScrapes: sessions.length,
                    dateRange: { start: startDate, end: endDate },
                },
            };
        } catch (error) {
            logger.error('[MetricsAggregator] Error getting site analytics', { error });
            throw error;
        }
    }

    /**
     * Get proxy analytics for export
     * Requirements: 13.3
     */
    async getProxyAnalytics(startDate: string, endDate: string): Promise<any> {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);

            const sessions = await prisma.scrapingSession.findMany({
                where: {
                    startTime: {
                        gte: start,
                        lte: end,
                    },
                    proxyUsed: {
                        not: null,
                    },
                },
                select: {
                    proxyUsed: true,
                    status: true,
                    metrics: true,
                },
            });

            // Group by proxy
            const proxyMap = new Map<string, any>();

            sessions.forEach(session => {
                if (!session.proxyUsed) return;

                if (!proxyMap.has(session.proxyUsed)) {
                    proxyMap.set(session.proxyUsed, {
                        proxyUrl: session.proxyUsed,
                        totalRequests: 0,
                        successfulRequests: 0,
                        failedRequests: 0,
                        responseTimes: [],
                    });
                }

                const proxy = proxyMap.get(session.proxyUsed);
                proxy.totalRequests++;

                if (session.status === 'completed') {
                    proxy.successfulRequests++;
                } else if (session.status === 'failed') {
                    proxy.failedRequests++;
                }

                if (session.metrics && typeof session.metrics === 'object') {
                    const metricsObj = session.metrics as any;
                    if (metricsObj.totalTime) {
                        proxy.responseTimes.push(metricsObj.totalTime);
                    }
                }
            });

            // Calculate metrics
            const proxyAnalytics = Array.from(proxyMap.values()).map(proxy => {
                const avgResponseTime = proxy.responseTimes.length > 0
                    ? proxy.responseTimes.reduce((a: number, b: number) => a + b, 0) / proxy.responseTimes.length
                    : 0;

                return {
                    proxyUrl: proxy.proxyUrl,
                    totalRequests: proxy.totalRequests,
                    successfulRequests: proxy.successfulRequests,
                    failedRequests: proxy.failedRequests,
                    successRate: proxy.totalRequests > 0
                        ? (proxy.successfulRequests / proxy.totalRequests * 100).toFixed(2) + '%'
                        : '0%',
                    avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
                };
            });

            return {
                proxies: proxyAnalytics,
                summary: {
                    totalProxies: proxyAnalytics.length,
                    totalRequests: sessions.length,
                    dateRange: { start: startDate, end: endDate },
                },
            };
        } catch (error) {
            logger.error('[MetricsAggregator] Error getting proxy analytics', { error });
            throw error;
        }
    }

    /**
     * Get challenge analytics for export
     * Requirements: 13.2
     */
    async getChallengeAnalytics(startDate: string, endDate: string): Promise<any> {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);

            const sessions = await prisma.scrapingSession.findMany({
                where: {
                    startTime: {
                        gte: start,
                        lte: end,
                    },
                    challengeType: {
                        not: null,
                    },
                },
                select: {
                    challengeType: true,
                    challengeStatus: true,
                    siteUrl: true,
                    metrics: true,
                },
            });

            // Group by challenge type
            const challengeMap = new Map<string, any>();

            sessions.forEach(session => {
                if (!session.challengeType) return;

                if (!challengeMap.has(session.challengeType)) {
                    challengeMap.set(session.challengeType, {
                        challengeType: session.challengeType,
                        totalEncountered: 0,
                        solved: 0,
                        failed: 0,
                        solveTimes: [],
                    });
                }

                const challenge = challengeMap.get(session.challengeType);
                challenge.totalEncountered++;

                if (session.challengeStatus === 'solved') {
                    challenge.solved++;
                } else if (session.challengeStatus === 'failed') {
                    challenge.failed++;
                }

                if (session.metrics && typeof session.metrics === 'object') {
                    const metricsObj = session.metrics as any;
                    if (metricsObj.challengeSolveTime) {
                        challenge.solveTimes.push(metricsObj.challengeSolveTime);
                    }
                }
            });

            // Calculate metrics
            const challengeAnalytics = Array.from(challengeMap.values()).map(challenge => {
                const avgSolveTime = challenge.solveTimes.length > 0
                    ? challenge.solveTimes.reduce((a: number, b: number) => a + b, 0) / challenge.solveTimes.length
                    : 0;

                return {
                    challengeType: challenge.challengeType,
                    totalEncountered: challenge.totalEncountered,
                    solved: challenge.solved,
                    failed: challenge.failed,
                    solveRate: challenge.totalEncountered > 0
                        ? (challenge.solved / challenge.totalEncountered * 100).toFixed(2) + '%'
                        : '0%',
                    avgSolveTime: avgSolveTime.toFixed(2) + 'ms',
                };
            });

            return {
                challenges: challengeAnalytics,
                summary: {
                    totalChallenges: sessions.length,
                    uniqueTypes: challengeAnalytics.length,
                    dateRange: { start: startDate, end: endDate },
                },
            };
        } catch (error) {
            logger.error('[MetricsAggregator] Error getting challenge analytics', { error });
            throw error;
        }
    }
}

// Export singleton instance
export const metricsAggregator = MetricsAggregator.getInstance();
