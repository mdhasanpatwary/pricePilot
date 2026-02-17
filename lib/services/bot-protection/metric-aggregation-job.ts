/**
 * Metric Aggregation Job - Hourly rollup of scraping metrics
 * 
 * This job runs periodically to aggregate scrape attempts into hourly metrics,
 * maintaining real-time counters in Redis and storing aggregated data in the database.
 * 
 * Requirements: 9.2
 */

import { prisma } from '@/lib/prisma';
import { getRedisConnection } from "@/lib/queue/connection";

// Shared Redis connection for real-time counters.
const redis = getRedisConnection();

/**
 * Run hourly metric aggregation
 * 
 * This function aggregates scrape attempts from the last hour into the
 * scraping_metrics table. It can be called by a cron job or scheduler.
 * 
 * @param hoursBack - Number of hours back to aggregate (default: 1)
 */
export async function runHourlyAggregation(hoursBack: number = 1): Promise<void> {
    console.log(`Starting hourly metric aggregation for ${hoursBack} hour(s) back...`);

    const now = new Date();
    const targetHour = new Date(now);
    targetHour.setHours(targetHour.getHours() - hoursBack);
    targetHour.setMinutes(0, 0, 0); // Round down to hour

    const startTime = new Date(targetHour);
    const endTime = new Date(targetHour);
    endTime.setHours(endTime.getHours() + 1);

    console.log(`Aggregating data from ${startTime.toISOString()} to ${endTime.toISOString()}`);

    try {
        // Get all unique tenant/site combinations that had attempts in this hour
        const combinations = await prisma.scrapeAttempt.findMany({
            where: {
                createdAt: {
                    gte: startTime,
                    lt: endTime,
                },
            },
            select: {
                tenantId: true,
                competitorWebsiteId: true,
            },
            distinct: ['tenantId', 'competitorWebsiteId'],
        });

        console.log(`Found ${combinations.length} tenant/site combinations to aggregate`);

        // Aggregate each combination
        for (const combo of combinations) {
            await aggregateForSite(combo.tenantId, combo.competitorWebsiteId, targetHour);
        }

        console.log('Hourly metric aggregation completed successfully');
    } catch (error) {
        console.error('Error during hourly metric aggregation:', error);
        throw error;
    }
}

/**
 * Aggregate metrics for a specific site and hour
 * 
 * @param tenantId - The tenant ID
 * @param competitorWebsiteId - The competitor website ID
 * @param hourTimestamp - The hour to aggregate (rounded down)
 */
async function aggregateForSite(
    tenantId: string,
    competitorWebsiteId: string,
    hourTimestamp: Date
): Promise<void> {
    const startTime = new Date(hourTimestamp);
    const endTime = new Date(hourTimestamp);
    endTime.setHours(endTime.getHours() + 1);

    // Get all attempts for this site in this hour
    const attempts = await prisma.scrapeAttempt.findMany({
        where: {
            tenantId,
            competitorWebsiteId,
            createdAt: {
                gte: startTime,
                lt: endTime,
            },
        },
        select: {
            success: true,
            protectionType: true,
            strategy: true,
            responseTimeMs: true,
        },
    });

    if (attempts.length === 0) {
        return; // No attempts to aggregate
    }

    // Calculate aggregations
    const totalAttempts = attempts.length;
    const successfulAttempts = attempts.filter((a) => a.success).length;
    const failedAttempts = totalAttempts - successfulAttempts;

    // Calculate average response time
    const totalResponseTime = attempts.reduce((sum, a) => sum + (a.responseTimeMs || 0), 0);
    const avgResponseTimeMs = Math.round(totalResponseTime / totalAttempts);

    // Build protection type breakdown
    const protectionTypeCounts: Record<string, number> = {};
    attempts.forEach((attempt) => {
        if (attempt.protectionType) {
            protectionTypeCounts[attempt.protectionType] =
                (protectionTypeCounts[attempt.protectionType] || 0) + 1;
        }
    });

    // Build strategy breakdown
    const strategyCounts: Record<string, number> = {};
    attempts.forEach((attempt) => {
        strategyCounts[attempt.strategy] = (strategyCounts[attempt.strategy] || 0) + 1;
    });

    // Store in database (upsert to handle re-runs)
    await prisma.scrapingMetric.upsert({
        where: {
            tenantId_competitorWebsiteId_hourTimestamp: {
                tenantId,
                competitorWebsiteId,
                hourTimestamp,
            },
        },
        create: {
            tenantId,
            competitorWebsiteId,
            hourTimestamp,
            totalAttempts,
            successfulAttempts,
            failedAttempts,
            avgResponseTimeMs,
            protectionTypeCounts,
            strategyCounts,
        },
        update: {
            totalAttempts,
            successfulAttempts,
            failedAttempts,
            avgResponseTimeMs,
            protectionTypeCounts,
            strategyCounts,
        },
    });

    console.log(
        `Aggregated ${totalAttempts} attempts for site ${competitorWebsiteId} at ${hourTimestamp.toISOString()}`
    );
}

/**
 * Maintain real-time counters in Redis
 * 
 * This function updates Redis counters for the current hour. It should be called
 * after each scrape attempt to maintain real-time metrics.
 * 
 * @param tenantId - The tenant ID
 * @param competitorWebsiteId - The competitor website ID
 * @param success - Whether the scrape was successful
 * @param protectionType - The protection type detected (if any)
 * @param strategy - The scraping strategy used
 * @param responseTime - The response time in milliseconds
 */
export async function updateRealTimeCounters(
    tenantId: string,
    competitorWebsiteId: string,
    success: boolean,
    protectionType: string | null,
    strategy: string,
    responseTime: number
): Promise<void> {
    try {
        const now = new Date();
        const hour = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        const keyPrefix = `metrics:${tenantId}:${competitorWebsiteId}:${hour}`;

        // Increment counters
        await redis.incr(`${keyPrefix}:total`);
        if (success) {
            await redis.incr(`${keyPrefix}:success`);
        } else {
            await redis.incr(`${keyPrefix}:failed`);
        }

        // Add response time to list for averaging
        await redis.rpush(`${keyPrefix}:response_times`, responseTime);

        // Increment protection type counter if present
        if (protectionType) {
            await redis.hincrby(`${keyPrefix}:protection_types`, protectionType, 1);
        }

        // Increment strategy counter
        await redis.hincrby(`${keyPrefix}:strategies`, strategy, 1);

        // Set expiration (keep for 48 hours)
        await redis.expire(`${keyPrefix}:total`, 48 * 60 * 60);
        await redis.expire(`${keyPrefix}:success`, 48 * 60 * 60);
        await redis.expire(`${keyPrefix}:failed`, 48 * 60 * 60);
        await redis.expire(`${keyPrefix}:response_times`, 48 * 60 * 60);
        await redis.expire(`${keyPrefix}:protection_types`, 48 * 60 * 60);
        await redis.expire(`${keyPrefix}:strategies`, 48 * 60 * 60);
    } catch (error) {
        console.error('Failed to update Redis counters:', error);
        // Don't throw - Redis failures should not break scraping
    }
}

/**
 * Get real-time metrics from Redis for the current hour
 * 
 * @param tenantId - The tenant ID
 * @param competitorWebsiteId - The competitor website ID
 * @returns Real-time metrics for the current hour
 */
export async function getRealTimeMetrics(
    tenantId: string,
    competitorWebsiteId: string
): Promise<{
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    avgResponseTime: number;
    protectionTypeCounts: Record<string, number>;
    strategyCounts: Record<string, number>;
} | null> {
    try {
        const now = new Date();
        const hour = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        const keyPrefix = `metrics:${tenantId}:${competitorWebsiteId}:${hour}`;

        // Get counters
        const totalRaw = await redis.get(`${keyPrefix}:total`);
        if (!totalRaw) {
            return null; // No data for this hour
        }
        const total = Number(totalRaw) || 0;

        const success = Number(await redis.get(`${keyPrefix}:success`)) || 0;
        const failed = Number(await redis.get(`${keyPrefix}:failed`)) || 0;

        // Get response times and calculate average
        const responseTimesRaw = await redis.lrange(
            `${keyPrefix}:response_times`,
            0,
            -1
        );
        const responseTimes = responseTimesRaw
            .map((v) => Number(v))
            .filter((n) => Number.isFinite(n));
        const avgResponseTime =
            responseTimes.length > 0
                ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
                : 0;

        // Get protection type counts
        const protectionTypeCountsRaw = await redis.hgetall(`${keyPrefix}:protection_types`);
        const protectionTypeCounts: Record<string, number> = Object.fromEntries(
            Object.entries(protectionTypeCountsRaw).map(([k, v]) => [k, Number(v) || 0])
        );

        // Get strategy counts
        const strategyCountsRaw = await redis.hgetall(`${keyPrefix}:strategies`);
        const strategyCounts: Record<string, number> = Object.fromEntries(
            Object.entries(strategyCountsRaw).map(([k, v]) => [k, Number(v) || 0])
        );

        return {
            totalAttempts: total,
            successfulAttempts: success,
            failedAttempts: failed,
            avgResponseTime: Math.round(avgResponseTime),
            protectionTypeCounts,
            strategyCounts,
        };
    } catch (error) {
        console.error('Failed to get real-time metrics from Redis:', error);
        return null;
    }
}

/**
 * Generate protection type and strategy breakdowns from aggregated metrics
 * 
 * @param tenantId - The tenant ID
 * @param startDate - Start date for the breakdown
 * @param endDate - End date for the breakdown
 * @returns Breakdowns by protection type and strategy
 */
export async function generateBreakdowns(
    tenantId: string,
    startDate: Date,
    endDate: Date
): Promise<{
    protectionTypeBreakdown: Record<string, number>;
    strategyBreakdown: Record<string, number>;
}> {
    // Get all metrics for the tenant in the date range
    const metrics = await prisma.scrapingMetric.findMany({
        where: {
            tenantId,
            hourTimestamp: {
                gte: startDate,
                lt: endDate,
            },
        },
        select: {
            protectionTypeCounts: true,
            strategyCounts: true,
        },
    });

    // Aggregate protection type counts
    const protectionTypeBreakdown: Record<string, number> = {};
    metrics.forEach((metric) => {
        const counts = metric.protectionTypeCounts as Record<string, number> | null;
        if (counts) {
            Object.entries(counts).forEach(([type, count]) => {
                protectionTypeBreakdown[type] = (protectionTypeBreakdown[type] || 0) + count;
            });
        }
    });

    // Aggregate strategy counts
    const strategyBreakdown: Record<string, number> = {};
    metrics.forEach((metric) => {
        const counts = metric.strategyCounts as Record<string, number> | null;
        if (counts) {
            Object.entries(counts).forEach(([strategy, count]) => {
                strategyBreakdown[strategy] = (strategyBreakdown[strategy] || 0) + count;
            });
        }
    });

    return {
        protectionTypeBreakdown,
        strategyBreakdown,
    };
}

/**
 * Clean up old aggregated metrics
 * 
 * This function removes aggregated metrics older than the retention period.
 * Should be run periodically (e.g., daily).
 * 
 * @param retentionDays - Number of days to retain metrics (default: 90)
 */
export async function cleanupOldMetrics(retentionDays: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    console.log(`Cleaning up metrics older than ${cutoffDate.toISOString()}`);

    const result = await prisma.scrapingMetric.deleteMany({
        where: {
            hourTimestamp: {
                lt: cutoffDate,
            },
        },
    });

    console.log(`Deleted ${result.count} old metric records`);
}
