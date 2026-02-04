/**
 * Success Rate Calculator - Enhanced success rate calculation with multi-granularity support
 * 
 * This module provides enhanced success rate calculations supporting:
 * - Different time windows (hourly, daily, weekly)
 * - Per-site statistics
 * - Per-method statistics (HTTP client vs headless browser)
 * - Average response time calculations
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.6
 */

import { prisma } from '@/lib/prisma';
import { TimeWindow } from './metrics-collector';

/**
 * Get success rate for a competitor website within a time window
 * 
 * Calculates success rate as (successful / total) × 100
 * 
 * @param competitorWebsiteId - The competitor website ID
 * @param timeWindow - The time window to calculate success rate for
 * @param strategy - Optional strategy filter (e.g., 'http_client', 'headless_browser')
 * @returns Success rate as a percentage (0-100)
 */
export async function getSuccessRate(
    competitorWebsiteId: string,
    timeWindow: TimeWindow,
    strategy?: string
): Promise<number> {
    const startDate = getStartDateForWindow(timeWindow);

    const whereClause: any = {
        competitorWebsiteId,
        createdAt: {
            gte: startDate,
        },
    };

    // Add strategy filter if provided
    if (strategy) {
        whereClause.strategy = strategy;
    }

    const result = await prisma.scrapeAttempt.aggregate({
        where: whereClause,
        _count: {
            _all: true,
        },
    });

    const totalAttempts = result._count._all;
    if (totalAttempts === 0) {
        return 0;
    }

    // Count successful attempts
    const successfulAttempts = await prisma.scrapeAttempt.count({
        where: {
            ...whereClause,
            success: true,
        },
    });

    // Calculate success rate as (successful / total) × 100
    return (successfulAttempts / totalAttempts) * 100;
}

/**
 * Get average response time for a competitor website within a time window
 * 
 * @param competitorWebsiteId - The competitor website ID
 * @param timeWindow - The time window to calculate average for
 * @param strategy - Optional strategy filter
 * @returns Average response time in milliseconds
 */
export async function getAverageResponseTime(
    competitorWebsiteId: string,
    timeWindow: TimeWindow,
    strategy?: string
): Promise<number> {
    const startDate = getStartDateForWindow(timeWindow);

    const whereClause: any = {
        competitorWebsiteId,
        createdAt: {
            gte: startDate,
        },
    };

    if (strategy) {
        whereClause.strategy = strategy;
    }

    const result = await prisma.scrapeAttempt.aggregate({
        where: whereClause,
        _avg: {
            responseTimeMs: true,
        },
    });

    return result._avg.responseTimeMs || 0;
}

/**
 * Get statistics for different time windows (hourly, daily, weekly)
 * 
 * Supports different time windows as required by Requirement 9.2
 * 
 * @param competitorWebsiteId - The competitor website ID
 * @returns Statistics at hourly, daily, and weekly granularities
 */
export async function getMultiGranularityStats(competitorWebsiteId: string): Promise<{
    hourly: { successRate: number; avgResponseTime: number };
    daily: { successRate: number; avgResponseTime: number };
    weekly: { successRate: number; avgResponseTime: number };
}> {
    const hourly = {
        successRate: await getSuccessRate(competitorWebsiteId, TimeWindow.LAST_HOUR),
        avgResponseTime: await getAverageResponseTime(competitorWebsiteId, TimeWindow.LAST_HOUR),
    };

    const daily = {
        successRate: await getSuccessRate(competitorWebsiteId, TimeWindow.LAST_24_HOURS),
        avgResponseTime: await getAverageResponseTime(
            competitorWebsiteId,
            TimeWindow.LAST_24_HOURS
        ),
    };

    const weekly = {
        successRate: await getSuccessRate(competitorWebsiteId, TimeWindow.LAST_7_DAYS),
        avgResponseTime: await getAverageResponseTime(competitorWebsiteId, TimeWindow.LAST_7_DAYS),
    };

    return { hourly, daily, weekly };
}

/**
 * Get per-method statistics for a competitor website
 * 
 * Tracks success rates separately for HTTP client and headless browser strategies
 * as required by Requirement 9.3
 * 
 * @param competitorWebsiteId - The competitor website ID
 * @param timeWindow - The time window to calculate statistics for
 * @returns Statistics broken down by scraping method
 */
export async function getPerMethodStats(
    competitorWebsiteId: string,
    timeWindow: TimeWindow
): Promise<{
    httpClient: { successRate: number; avgResponseTime: number; totalAttempts: number };
    headlessBrowser: { successRate: number; avgResponseTime: number; totalAttempts: number };
}> {
    const startDate = getStartDateForWindow(timeWindow);

    // Get HTTP client stats
    const httpClientAttempts = await prisma.scrapeAttempt.count({
        where: {
            competitorWebsiteId,
            createdAt: { gte: startDate },
            strategy: { in: ['http_client', 'http_with_proxy'] },
        },
    });

    let httpClientSuccessRate = 0;
    let httpClientAvgResponseTime = 0;

    if (httpClientAttempts > 0) {
        // Calculate success rate for HTTP client strategies
        const httpClientSuccessful = await prisma.scrapeAttempt.count({
            where: {
                competitorWebsiteId,
                createdAt: { gte: startDate },
                strategy: { in: ['http_client', 'http_with_proxy'] },
                success: true,
            },
        });
        httpClientSuccessRate = (httpClientSuccessful / httpClientAttempts) * 100;

        // Calculate average response time for HTTP client
        const httpClientAvg = await prisma.scrapeAttempt.aggregate({
            where: {
                competitorWebsiteId,
                createdAt: { gte: startDate },
                strategy: { in: ['http_client', 'http_with_proxy'] },
            },
            _avg: {
                responseTimeMs: true,
            },
        });
        httpClientAvgResponseTime = httpClientAvg._avg.responseTimeMs || 0;
    }

    // Get headless browser stats
    const headlessBrowserAttempts = await prisma.scrapeAttempt.count({
        where: {
            competitorWebsiteId,
            createdAt: { gte: startDate },
            strategy: { in: ['headless_browser', 'headless_with_proxy', 'stealth_browser'] },
        },
    });

    let headlessBrowserSuccessRate = 0;
    let headlessBrowserAvgResponseTime = 0;

    if (headlessBrowserAttempts > 0) {
        // Calculate success rate for headless browser strategies
        const headlessBrowserSuccessful = await prisma.scrapeAttempt.count({
            where: {
                competitorWebsiteId,
                createdAt: { gte: startDate },
                strategy: { in: ['headless_browser', 'headless_with_proxy', 'stealth_browser'] },
                success: true,
            },
        });
        headlessBrowserSuccessRate = (headlessBrowserSuccessful / headlessBrowserAttempts) * 100;

        // Calculate average response time for headless browser
        const headlessBrowserAvg = await prisma.scrapeAttempt.aggregate({
            where: {
                competitorWebsiteId,
                createdAt: { gte: startDate },
                strategy: { in: ['headless_browser', 'headless_with_proxy', 'stealth_browser'] },
            },
            _avg: {
                responseTimeMs: true,
            },
        });
        headlessBrowserAvgResponseTime = headlessBrowserAvg._avg.responseTimeMs || 0;
    }

    return {
        httpClient: {
            successRate: httpClientSuccessRate,
            avgResponseTime: httpClientAvgResponseTime,
            totalAttempts: httpClientAttempts,
        },
        headlessBrowser: {
            successRate: headlessBrowserSuccessRate,
            avgResponseTime: headlessBrowserAvgResponseTime,
            totalAttempts: headlessBrowserAttempts,
        },
    };
}

/**
 * Get per-site statistics for a tenant
 * 
 * Tracks success rates and response times for each competitor site
 * 
 * @param tenantId - The tenant ID
 * @param timeWindow - The time window to calculate statistics for
 * @returns Array of per-site statistics
 */
export async function getPerSiteStats(
    tenantId: string,
    timeWindow: TimeWindow
): Promise<
    Array<{
        competitorWebsiteId: string;
        siteName: string;
        successRate: number;
        avgResponseTime: number;
        totalAttempts: number;
    }>
> {
    const startDate = getStartDateForWindow(timeWindow);

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

    const stats = [];

    for (const site of sites) {
        const totalAttempts = await prisma.scrapeAttempt.count({
            where: {
                competitorWebsiteId: site.id,
                createdAt: { gte: startDate },
            },
        });

        if (totalAttempts === 0) {
            continue; // Skip sites with no attempts
        }

        const successRate = await getSuccessRate(site.id, timeWindow);
        const avgResponseTime = await getAverageResponseTime(site.id, timeWindow);

        stats.push({
            competitorWebsiteId: site.id,
            siteName: site.baseUrl,
            successRate,
            avgResponseTime,
            totalAttempts,
        });
    }

    return stats;
}

/**
 * Get start date for a time window
 * 
 * @param timeWindow - The time window
 * @returns Start date for the window
 */
function getStartDateForWindow(timeWindow: TimeWindow): Date {
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
