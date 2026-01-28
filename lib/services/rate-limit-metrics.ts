/**
 * Rate Limit Metrics Service
 * 
 * Tracks rate limit hits and violations, aggregates metrics for dashboards,
 * and generates alerts when thresholds are exceeded.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.5, 3.6
 */

import { prisma } from "@/lib/prisma";
import { ALERT_THRESHOLDS, RateLimiterType } from "./rate-limit-config";
import { NotificationService } from "./notification";
import { logger } from "../logger";

/**
 * Tenant metrics aggregated over a time period
 */
export interface TenantMetrics {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  byLimiterType: {
    [key: string]: {
      hitCount: number;
      violationCount: number;
      violationRate: number;
    };
  };
  totalHits: number;
  totalViolations: number;
  topEndpoints: Array<{
    endpoint: string;
    hitCount: number;
    violationCount: number;
  }>;
}

/**
 * Record a successful rate-limited request (hit)
 * 
 * This function is called for every successful request that passes rate limiting.
 * It records the hit asynchronously to avoid blocking the request.
 * 
 * @param tenantId - The tenant making the request
 * @param limiterType - The type of rate limiter applied
 * @param identifier - The rate limit identifier (user:xxx or ip:xxx)
 * @param endpoint - The API endpoint path
 * 
 * Requirements: 3.2, 3.6
 * 
 * @example
 * ```typescript
 * await recordHit('tenant-123', 'read', 'user:abc', '/api/v1/products');
 * ```
 */
export async function recordHit(
  tenantId: string,
  limiterType: RateLimiterType,
  identifier: string,
  endpoint: string
): Promise<void> {
  try {
    // Round timestamp to the current hour for aggregation
    const hourTimestamp = new Date();
    hourTimestamp.setMinutes(0, 0, 0);

    // Try to find existing metric for this hour
    const existing = await prisma.rateLimitMetric.findFirst({
      where: {
        tenantId,
        limiterType,
        identifier,
        endpoint,
        timestamp: hourTimestamp,
      },
    });

    if (existing) {
      // Update existing record
      await prisma.rateLimitMetric.update({
        where: { id: existing.id },
        data: {
          hitCount: {
            increment: 1,
          },
        },
      });
    } else {
      // Create new record
      await prisma.rateLimitMetric.create({
        data: {
          tenantId,
          limiterType,
          identifier,
          endpoint,
          hitCount: 1,
          violationCount: 0,
          timestamp: hourTimestamp,
        },
      });
    }
  } catch (error) {
    // Log error but don't throw - metrics recording should not block requests
    logger.error("[RateLimitMetrics] Failed to record hit:", {
      error,
      tenantId,
      limiterType,
      endpoint,
    });
  }
}

/**
 * Record a rate limit violation (429 response)
 * 
 * This function is called when a request exceeds the rate limit.
 * It records the violation and checks if alert thresholds are exceeded.
 * 
 * @param tenantId - The tenant that exceeded the limit
 * @param limiterType - The type of rate limiter that was exceeded
 * @param identifier - The rate limit identifier (user:xxx or ip:xxx)
 * @param endpoint - The API endpoint path
 * 
 * Requirements: 3.1, 3.3, 3.5, 3.6
 * 
 * @example
 * ```typescript
 * await recordViolation('tenant-123', 'write', 'user:abc', '/api/v1/products');
 * ```
 */
export async function recordViolation(
  tenantId: string,
  limiterType: RateLimiterType,
  identifier: string,
  endpoint: string
): Promise<void> {
  try {
    // Round timestamp to the current hour for aggregation
    const hourTimestamp = new Date();
    hourTimestamp.setMinutes(0, 0, 0);

    // Try to find existing metric for this hour
    const existing = await prisma.rateLimitMetric.findFirst({
      where: {
        tenantId,
        limiterType,
        identifier,
        endpoint,
        timestamp: hourTimestamp,
      },
    });

    if (existing) {
      // Update existing record
      await prisma.rateLimitMetric.update({
        where: { id: existing.id },
        data: {
          violationCount: {
            increment: 1,
          },
        },
      });
    } else {
      // Create new record
      await prisma.rateLimitMetric.create({
        data: {
          tenantId,
          limiterType,
          identifier,
          endpoint,
          hitCount: 0,
          violationCount: 1,
          timestamp: hourTimestamp,
        },
      });
    }

    // Check thresholds asynchronously (don't await to avoid blocking)
    checkThresholds(tenantId).catch((error) => {
      logger.error("[RateLimitMetrics] Failed to check thresholds:", {
        error,
        tenantId,
      });
    });
  } catch (error) {
    // Log error but don't throw - metrics recording should not block requests
    logger.error("[RateLimitMetrics] Failed to record violation:", {
      error,
      tenantId,
      limiterType,
      endpoint,
    });
  }
}

/**
 * Get aggregated metrics for a tenant over a time period
 * 
 * This function retrieves and aggregates rate limit metrics for dashboard display.
 * It groups metrics by limiter type and identifies top endpoints by usage.
 * 
 * @param tenantId - The tenant to get metrics for
 * @param startDate - Start of the time period
 * @param endDate - End of the time period
 * @returns Aggregated metrics for the tenant
 * 
 * Requirements: 3.2, 3.3, 3.4
 * 
 * @example
 * ```typescript
 * const metrics = await getTenantMetrics(
 *   'tenant-123',
 *   new Date('2024-01-01'),
 *   new Date('2024-01-31')
 * );
 * console.log(metrics.totalViolations); // 42
 * ```
 */
export async function getTenantMetrics(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<TenantMetrics> {
  try {
    // Fetch all metrics for the tenant in the time period
    const metrics = await prisma.rateLimitMetric.findMany({
      where: {
        tenantId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    // Aggregate by limiter type
    const byLimiterType: TenantMetrics["byLimiterType"] = {};
    let totalHits = 0;
    let totalViolations = 0;

    // Track endpoint usage for top endpoints
    const endpointStats: Map<
      string,
      { hitCount: number; violationCount: number }
    > = new Map();

    for (const metric of metrics) {
      // Aggregate by limiter type
      if (!byLimiterType[metric.limiterType]) {
        byLimiterType[metric.limiterType] = {
          hitCount: 0,
          violationCount: 0,
          violationRate: 0,
        };
      }

      byLimiterType[metric.limiterType].hitCount += metric.hitCount;
      byLimiterType[metric.limiterType].violationCount += metric.violationCount;

      totalHits += metric.hitCount;
      totalViolations += metric.violationCount;

      // Track endpoint stats
      const existing = endpointStats.get(metric.endpoint) || {
        hitCount: 0,
        violationCount: 0,
      };
      endpointStats.set(metric.endpoint, {
        hitCount: existing.hitCount + metric.hitCount,
        violationCount: existing.violationCount + metric.violationCount,
      });
    }

    // Calculate violation rates
    for (const limiterType in byLimiterType) {
      const stats = byLimiterType[limiterType];
      const totalRequests = stats.hitCount + stats.violationCount;
      stats.violationRate =
        totalRequests > 0 ? (stats.violationCount / totalRequests) * 100 : 0;
    }

    // Get top 10 endpoints by total requests
    const topEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        hitCount: stats.hitCount,
        violationCount: stats.violationCount,
      }))
      .sort(
        (a, b) =>
          b.hitCount + b.violationCount - (a.hitCount + a.violationCount)
      )
      .slice(0, 10);

    return {
      tenantId,
      periodStart: startDate,
      periodEnd: endDate,
      byLimiterType,
      totalHits,
      totalViolations,
      topEndpoints,
    };
  } catch (error) {
    logger.error("[RateLimitMetrics] Failed to get tenant metrics:", {
      error,
      tenantId,
      startDate,
      endDate,
    });

    // Return empty metrics on error
    return {
      tenantId,
      periodStart: startDate,
      periodEnd: endDate,
      byLimiterType: {},
      totalHits: 0,
      totalViolations: 0,
      topEndpoints: [],
    };
  }
}

/**
 * Check if rate limit violations exceed alert thresholds
 * 
 * This function checks if a tenant has exceeded violation thresholds
 * and creates alerts if necessary. It checks both hourly and daily thresholds.
 * 
 * @param tenantId - The tenant to check thresholds for
 * 
 * Requirements: 3.5
 * 
 * @example
 * ```typescript
 * await checkThresholds('tenant-123');
 * // Creates alert if violations exceed thresholds
 * ```
 */
export async function checkThresholds(tenantId: string): Promise<void> {
  try {
    const now = new Date();

    // Check hourly threshold
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const hourlyMetrics = await getTenantMetrics(tenantId, oneHourAgo, now);

    if (
      hourlyMetrics.totalViolations >= ALERT_THRESHOLDS.violationsPerHour
    ) {
      await NotificationService.create({
        tenantId,
        type: "SYSTEM",
        title: "⚠️ High Rate Limit Violations",
        message: `Your account has exceeded ${hourlyMetrics.totalViolations} rate limit violations in the past hour (threshold: ${ALERT_THRESHOLDS.violationsPerHour}). Please review your API usage.`,
        link: "/dashboard/settings",
      });

      logger.warn("[RateLimitMetrics] Hourly threshold exceeded:", {
        tenantId,
        violations: hourlyMetrics.totalViolations,
        threshold: ALERT_THRESHOLDS.violationsPerHour,
      });
    }

    // Check daily threshold
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dailyMetrics = await getTenantMetrics(tenantId, oneDayAgo, now);

    if (dailyMetrics.totalViolations >= ALERT_THRESHOLDS.violationsPerDay) {
      await NotificationService.create({
        tenantId,
        type: "SYSTEM",
        title: "🚨 Critical: Excessive Rate Limit Violations",
        message: `Your account has exceeded ${dailyMetrics.totalViolations} rate limit violations in the past 24 hours (threshold: ${ALERT_THRESHOLDS.violationsPerDay}). This may indicate an issue with your integration. Please contact support if you need assistance.`,
        link: "/dashboard/settings",
      });

      logger.error("[RateLimitMetrics] Daily threshold exceeded:", {
        tenantId,
        violations: dailyMetrics.totalViolations,
        threshold: ALERT_THRESHOLDS.violationsPerDay,
      });
    }

    // Check violation rate threshold
    const totalRequests =
      dailyMetrics.totalHits + dailyMetrics.totalViolations;
    if (totalRequests > 0) {
      const violationRate =
        (dailyMetrics.totalViolations / totalRequests) * 100;

      if (violationRate >= ALERT_THRESHOLDS.violationRatePercent) {
        await NotificationService.create({
          tenantId,
          type: "SYSTEM",
          title: "⚠️ High Rate Limit Violation Rate",
          message: `${violationRate.toFixed(1)}% of your API requests are being rate limited (threshold: ${ALERT_THRESHOLDS.violationRatePercent}%). Consider upgrading your plan or optimizing your API usage.`,
          link: "/dashboard/settings",
        });

        logger.warn("[RateLimitMetrics] Violation rate threshold exceeded:", {
          tenantId,
          violationRate: violationRate.toFixed(1),
          threshold: ALERT_THRESHOLDS.violationRatePercent,
        });
      }
    }
  } catch (error) {
    logger.error("[RateLimitMetrics] Failed to check thresholds:", {
      error,
      tenantId,
    });
    // Don't throw - threshold checking should not block requests
  }
}

/**
 * Get recent violations for a tenant
 * 
 * Helper function to retrieve recent violation details for dashboard display.
 * 
 * @param tenantId - The tenant to get violations for
 * @param limit - Maximum number of violations to return (default: 50)
 * @returns Array of recent violations with details
 * 
 * @example
 * ```typescript
 * const violations = await getRecentViolations('tenant-123', 10);
 * ```
 */
export async function getRecentViolations(
  tenantId: string,
  limit: number = 50
): Promise<
  Array<{
    timestamp: Date;
    limiterType: string;
    endpoint: string;
    identifier: string;
    violationCount: number;
  }>
> {
  try {
    const violations = await prisma.rateLimitMetric.findMany({
      where: {
        tenantId,
        violationCount: {
          gt: 0,
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: limit,
      select: {
        timestamp: true,
        limiterType: true,
        endpoint: true,
        identifier: true,
        violationCount: true,
      },
    });

    return violations;
  } catch (error) {
    logger.error("[RateLimitMetrics] Failed to get recent violations:", {
      error,
      tenantId,
    });
    return [];
  }
}

/**
 * Export all functions for use in other modules
 */
export const RateLimitMetrics = {
  recordHit,
  recordViolation,
  getTenantMetrics,
  checkThresholds,
  getRecentViolations,
} as const;
