/**
 * MetricsCollector - Aggregates scraping metrics for monitoring and alerting
 *
 * This service collects and aggregates metrics from scrape attempts, calculating
 * success rates, response times, and providing breakdowns by protection type and strategy.
 *
 * Requirements: 9.1, 9.6
 */

import { prisma } from '@/lib/prisma';
import { getRedisConnection } from "@/lib/queue/connection";

// Redis is sourced locally inside functions to prevent build-time side effects

/**
 * Represents a single scrape metric to be recorded
 */
export interface ScrapeMetric {
    tenantId: string;
    competitorWebsiteId: string;
    success: boolean;
    protectionType?: string;
    strategy: string;
    responseTime: number;
    timestamp: Date;
}

/**
 * Time window options for metric queries
 */
export enum TimeWindow {
    LAST_HOUR = 'last_hour',
    LAST_24_HOURS = 'last_24_hours',
    LAST_7_DAYS = 'last_7_days',
    LAST_30_DAYS = 'last_30_days',
}

/**
 * Summary of metrics for a specific scope
 */
export interface MetricsSummary {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    successRate: number;
    averageResponseTime: number;
    protectionTypeBreakdown: Record<string, number>;
    strategyBreakdown: Record<string, number>;
    siteMetrics: SiteMetrics[];
}

/**
 * Metrics for a specific competitor site
 */
export interface SiteMetrics {
    competitorWebsiteId: string;
    siteName: string;
    successRate: number;
    totalAttempts: number;
    averageResponseTime: number;
    lastSuccess?: Date;
    lastFailure?: Date;
    currentStatus: 'healthy' | 'degraded' | 'blocked';
}

/**
 * MetricsCollector class for aggregating and querying scraping metrics
 */
export class MetricsCollector {
    /**
     * Record a scrape attempt metric
     *
     * This method stores the metric in both Redis (for real-time counters) and
     * prepares it for database aggregation.
     *
     * @param metric - The scrape metric to record
     */
    async recordAttempt(metric: ScrapeMetric): Promise<void> {
        try {
            // Update real-time counters in Redis if available
            try {
                await this.updateRedisCounters(metric);
            } catch (e) {
                // Silently bypass redis failure
            }

            // The actual database storage happens via the scrape_attempts table
            // This method primarily updates aggregated counters

            // Update hourly aggregation in background (non-blocking)
            this.updateHourlyAggregation(metric).catch((error) => {
                console.error('Failed to update hourly aggregation:', error);
            });
        } catch (error) {
            console.error('Failed to record metric:', error);
            // Don't throw - metrics recording should not break scraping
        }
    }

    /**
     * Get success rate for a competitor website within a time window
     *
     * @param competitorWebsiteId - The competitor website ID
     * @param timeWindow - The time window to calculate success rate for
     * @returns Success rate as a percentage (0-100)
     */
    async getSuccessRate(
        competitorWebsiteId: string,
        timeWindow: TimeWindow
    ): Promise<number> {
        const startDate = this.getStartDateForWindow(timeWindow);

        const totalAttempts = await prisma.scrapeAttempt.count({
            where: {
                competitorWebsiteId,
                createdAt: {
                    gte: startDate,
                },
            },
        });

        if (totalAttempts === 0) {
            return 0;
        }

        // Count successful attempts
        const successfulAttempts = await prisma.scrapeAttempt.count({
            where: {
                competitorWebsiteId,
                createdAt: {
                    gte: startDate,
                },
                success: true,
            },
        });

        return (successfulAttempts / totalAttempts) * 100;
    }

    /**
     * Get comprehensive metrics summary for a tenant
     *
     * @param tenantId - The tenant ID
     * @param timeWindow - Optional time window (defaults to LAST_24_HOURS)
     * @returns Comprehensive metrics summary
     */
    async getMetricsSummary(
        tenantId: string,
        timeWindow: TimeWindow = TimeWindow.LAST_24_HOURS
    ): Promise<MetricsSummary> {
        const startDate = this.getStartDateForWindow(timeWindow);

        // Get all scrape attempts for the tenant in the time window
        const attempts = await prisma.scrapeAttempt.findMany({
            where: {
                tenantId,
                createdAt: {
                    gte: startDate,
                },
            },
            select: {
                success: true,
                protectionType: true,
                strategy: true,
                responseTimeMs: true,
                competitorWebsiteId: true,
                createdAt: true,
            },
        });

        const totalAttempts = attempts.length;
        const successfulAttempts = attempts.filter((a) => a.success).length;
        const failedAttempts = totalAttempts - successfulAttempts;
        const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;

        // Calculate average response time
        const totalResponseTime = attempts.reduce((sum, a) => sum + (a.responseTimeMs || 0), 0);
        const averageResponseTime = totalAttempts > 0 ? totalResponseTime / totalAttempts : 0;

        // Build protection type breakdown
        const protectionTypeBreakdown: Record<string, number> = {};
        attempts.forEach((attempt) => {
            if (attempt.protectionType) {
                protectionTypeBreakdown[attempt.protectionType] =
                    (protectionTypeBreakdown[attempt.protectionType] || 0) + 1;
            }
        });

        // Build strategy breakdown
        const strategyBreakdown: Record<string, number> = {};
        attempts.forEach((attempt) => {
            strategyBreakdown[attempt.strategy] = (strategyBreakdown[attempt.strategy] || 0) + 1;
        });

        // Get per-site metrics
        const siteMetrics = await this.getSiteMetrics(tenantId, startDate);

        return {
            totalAttempts,
            successfulAttempts,
            failedAttempts,
            successRate,
            averageResponseTime,
            protectionTypeBreakdown,
            strategyBreakdown,
            siteMetrics,
        };
    }

    /**
     * Update Redis counters for real-time metrics
     *
     * @param metric - The metric to update counters for
     */
    private async updateRedisCounters(metric: ScrapeMetric): Promise<void> {
        const redis = getRedisConnection();
        const hour = new Date(metric.timestamp).toISOString().slice(0, 13); // YYYY-MM-DDTHH
        const keyPrefix = `metrics:${metric.tenantId}:${metric.competitorWebsiteId}:${hour}`;

        // Increment counters
        await redis.incr(`${keyPrefix}:total`);
        if (metric.success) {
            await redis.incr(`${keyPrefix}:success`);
        } else {
            await redis.incr(`${keyPrefix}:failed`);
        }

        // Add response time to list for averaging
        await redis.rpush(`${keyPrefix}:response_times`, metric.responseTime);

        // Increment protection type counter if present
        if (metric.protectionType) {
            await redis.hincrby(`${keyPrefix}:protection_types`, metric.protectionType, 1);
        }

        // Increment strategy counter
        await redis.hincrby(`${keyPrefix}:strategies`, metric.strategy, 1);

        // Set expiration (keep for 48 hours)
        await redis.expire(`${keyPrefix}:total`, 48 * 60 * 60);
        await redis.expire(`${keyPrefix}:success`, 48 * 60 * 60);
        await redis.expire(`${keyPrefix}:failed`, 48 * 60 * 60);
        await redis.expire(`${keyPrefix}:response_times`, 48 * 60 * 60);
        await redis.expire(`${keyPrefix}:protection_types`, 48 * 60 * 60);
        await redis.expire(`${keyPrefix}:strategies`, 48 * 60 * 60);
    }

    /**
     * Update hourly aggregation in database
     *
     * This creates or updates the ScrapingMetric record for the current hour.
     *
     * @param metric - The metric to aggregate
     */
    private async updateHourlyAggregation(metric: ScrapeMetric): Promise<void> {
        const hourTimestamp = new Date(metric.timestamp);
        hourTimestamp.setMinutes(0, 0, 0); // Round down to hour

        // Get existing aggregation or create new one
        const existing = await prisma.scrapingMetric.findUnique({
            where: {
                tenantId_competitorWebsiteId_hourTimestamp: {
                    tenantId: metric.tenantId,
                    competitorWebsiteId: metric.competitorWebsiteId,
                    hourTimestamp,
                },
            },
        });

        if (existing) {
            // Update existing aggregation
            const newTotalAttempts = existing.totalAttempts + 1;
            const newSuccessfulAttempts = existing.successfulAttempts + (metric.success ? 1 : 0);
            const newFailedAttempts = existing.failedAttempts + (metric.success ? 0 : 1);

            // Calculate new average response time
            const oldTotalResponseTime = (existing.avgResponseTimeMs || 0) * existing.totalAttempts;
            const newTotalResponseTime = oldTotalResponseTime + metric.responseTime;
            const newAvgResponseTime = Math.round(newTotalResponseTime / newTotalAttempts);

            // Update protection type counts
            const protectionTypeCounts = (existing.protectionTypeCounts as Record<string, number>) || {};
            if (metric.protectionType) {
                protectionTypeCounts[metric.protectionType] =
                    (protectionTypeCounts[metric.protectionType] || 0) + 1;
            }

            // Update strategy counts
            const strategyCounts = (existing.strategyCounts as Record<string, number>) || {};
            strategyCounts[metric.strategy] = (strategyCounts[metric.strategy] || 0) + 1;

            await prisma.scrapingMetric.update({
                where: {
                    id: existing.id,
                },
                data: {
                    totalAttempts: newTotalAttempts,
                    successfulAttempts: newSuccessfulAttempts,
                    failedAttempts: newFailedAttempts,
                    avgResponseTimeMs: newAvgResponseTime,
                    protectionTypeCounts,
                    strategyCounts,
                },
            });
        } else {
            // Create new aggregation
            const protectionTypeCounts: Record<string, number> = {};
            if (metric.protectionType) {
                protectionTypeCounts[metric.protectionType] = 1;
            }

            const strategyCounts: Record<string, number> = {
                [metric.strategy]: 1,
            };

            await prisma.scrapingMetric.create({
                data: {
                    tenantId: metric.tenantId,
                    competitorWebsiteId: metric.competitorWebsiteId,
                    hourTimestamp,
                    totalAttempts: 1,
                    successfulAttempts: metric.success ? 1 : 0,
                    failedAttempts: metric.success ? 0 : 1,
                    avgResponseTimeMs: metric.responseTime,
                    protectionTypeCounts,
                    strategyCounts,
                },
            });
        }
    }

    /**
     * Get per-site metrics for a tenant
     *
     * @param tenantId - The tenant ID
     * @param startDate - Start date for metrics calculation
     * @returns Array of site metrics
     */
    private async getSiteMetrics(tenantId: string, startDate: Date): Promise<SiteMetrics[]> {
        // Get all competitor websites for the tenant
        const sites = await prisma.site.findMany({
            where: {
                tenantId,
                type: 'COMPETITOR',
            },
            select: {
                id: true,
                baseUrl: true,
            },
        });

        const siteMetrics: SiteMetrics[] = [];

        for (const site of sites) {
            // Get attempts for this site
            const attempts = await prisma.scrapeAttempt.findMany({
                where: {
                    competitorWebsiteId: site.id,
                    createdAt: {
                        gte: startDate,
                    },
                },
                select: {
                    success: true,
                    responseTimeMs: true,
                    createdAt: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });

            const totalAttempts = attempts.length;
            if (totalAttempts === 0) {
                continue; // Skip sites with no attempts
            }

            const successfulAttempts = attempts.filter((a) => a.success).length;
            const successRate = (successfulAttempts / totalAttempts) * 100;

            const totalResponseTime = attempts.reduce((sum, a) => sum + (a.responseTimeMs || 0), 0);
            const averageResponseTime = totalResponseTime / totalAttempts;

            // Find last success and failure
            const lastSuccess = attempts.find((a) => a.success)?.createdAt;
            const lastFailure = attempts.find((a) => !a.success)?.createdAt;

            // Determine current status
            let currentStatus: 'healthy' | 'degraded' | 'blocked';
            if (successRate >= 80) {
                currentStatus = 'healthy';
            } else if (successRate >= 50) {
                currentStatus = 'degraded';
            } else {
                currentStatus = 'blocked';
            }

            siteMetrics.push({
                competitorWebsiteId: site.id,
                siteName: site.baseUrl,
                successRate,
                totalAttempts,
                averageResponseTime,
                lastSuccess,
                lastFailure,
                currentStatus,
            });
        }

        return siteMetrics;
    }

    /**
     * Get start date for a time window
     *
     * @param timeWindow - The time window
     * @returns Start date for the window
     */
    private getStartDateForWindow(timeWindow: TimeWindow): Date {
        const now = new Date();
        switch (timeWindow) {
            case TimeWindow.LAST_HOUR:
                return new Date(now.getTime() - 60 * 60 * 1000);
            case TimeWindow.LAST_24_HOURS:
                return new Date(now.getTime() - 24 * 60 * 60 * 1000);
            case TimeWindow.LAST_7_DAYS:
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            case TimeWindow.LAST_30_DAYS:
                return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            default:
                return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }
    }
}

// Export singleton instance
// Lazy proxy avoids import-time side effects in build/dev workers.
let metricsCollectorInstance: MetricsCollector | null = null;
export const metricsCollector = new Proxy({} as MetricsCollector, {
    get(_target, property) {
        if (!metricsCollectorInstance) {
            metricsCollectorInstance = new MetricsCollector();
        }
        const value = (metricsCollectorInstance as any)[property];
        return typeof value === "function" ? value.bind(metricsCollectorInstance) : value;
    },
});
