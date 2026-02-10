/**
 * Rate Limit Metrics Service
 *
 * Tracks rate limit hits and violations, aggregates metrics for dashboards,
 * and generates alerts when thresholds are exceeded.
 *
 * OPTIMIZATION: Uses in-memory batching to reduce database write frequency.
 * Hits and violations are aggregated in memory and flushed to the DB periodically.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.5, 3.6
 */

import { prisma } from "@/lib/prisma";
import { ALERT_THRESHOLDS, RateLimiterType } from "./rate-limit-config";
import { NotificationService } from "./notification";
import { logger } from "../logger";

// --- Types ---

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

interface MetricKey {
  tenantId: string;
  limiterType: RateLimiterType;
  identifier: string;
  endpoint: string;
  hourTimestamp: number; // Unix timestamp for the start of the hour
}

interface AggregatedMetric {
  hitCount: number;
  violationCount: number;
}

// --- Batch Processing Service ---

class MetricBatchProcessor {
  private buffer: Map<string, AggregatedMetric> = new Map();
  private isFlushing: boolean = false;
  private readonly FLUSH_INTERVAL_MS = 10000; // Flush every 10 seconds
  private readonly MAX_BUFFER_SIZE = 5000; // Trigger flush if buffer gets too large

  constructor() {
    // Start periodic flush
    if (typeof window === 'undefined') { // server-side only
      setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
    }
  }

  /**
   * Generates a unique string key for the metric map
   */
  private getKey(key: MetricKey): string {
    return `${key.tenantId}|${key.limiterType}|${key.identifier}|${key.endpoint}|${key.hourTimestamp}`;
  }

  /**
   * Parses a string key back into a MetricKey object
   */
  private parseKey(keyString: string): MetricKey {
    const [tenantId, limiterType, identifier, endpoint, timestampStr] = keyString.split('|');
    return {
      tenantId,
      limiterType: limiterType as RateLimiterType,
      identifier,
      endpoint,
      hourTimestamp: parseInt(timestampStr, 10)
    };
  }

  /**
   * Add a hit or violation to the batch
   */
  public add(
    tenantId: string,
    limiterType: RateLimiterType,
    identifier: string,
    endpoint: string,
    isViolation: boolean
  ) {
    // Round to current hour
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const hourTimestamp = now.getTime();

    const key = this.getKey({
      tenantId,
      limiterType,
      identifier,
      endpoint,
      hourTimestamp
    });

    const current = this.buffer.get(key) || { hitCount: 0, violationCount: 0 };

    if (isViolation) {
      current.violationCount++;
    } else {
      current.hitCount++;
    }

    this.buffer.set(key, current);

    // Safety valve: flush if buffer gets too large
    if (this.buffer.size >= this.MAX_BUFFER_SIZE) {
      this.flush();
    }
  }

  /**
   * Flush aggregated metrics to the database
   */
  public async flush() {
    if (this.isFlushing || this.buffer.size === 0) return;

    this.isFlushing = true;
    const currentBuffer = new Map(this.buffer);
    this.buffer.clear();

    try {
      const entries = Array.from(currentBuffer.entries());

      // If Redis is available, we can use it for high-performance increments
      // and only flush to DB periodically for persistence/reporting.
      // For this implementation, we will stick to the DB as the source of truth
      // but optimize the flush logic.

      // Process in batches to avoid overwhelming the DB connection
      const BATCH_SIZE = 50;
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async ([keyString, data]) => {
          const key = this.parseKey(keyString);
          const timestamp = new Date(key.hourTimestamp);

          try {
            // Using a single transaction or more efficient upsert if supported
            // Since we added indexes, findFirst should be fast.
            // But we can use an 'upsert' with a unique constraint if we have one.
            // Looking at the schema, we don't have a unique constraint on (tenantId, limiterType, identifier, endpoint, timestamp).
            // So we'll stick to the findFirst + update/create pattern but optimize it.

            await prisma.$transaction(async (tx) => {
              const existing = await tx.rateLimitMetric.findFirst({
                where: {
                  tenantId: key.tenantId,
                  limiterType: key.limiterType,
                  identifier: key.identifier,
                  endpoint: key.endpoint,
                  timestamp: timestamp,
                },
                select: { id: true }
              });

              if (existing) {
                await tx.rateLimitMetric.update({
                  where: { id: existing.id },
                  data: {
                    hitCount: { increment: data.hitCount },
                    violationCount: { increment: data.violationCount }
                  }
                });
              } else {
                await tx.rateLimitMetric.create({
                  data: {
                    tenantId: key.tenantId,
                    limiterType: key.limiterType,
                    identifier: key.identifier,
                    endpoint: key.endpoint,
                    timestamp: timestamp,
                    hitCount: data.hitCount,
                    violationCount: data.violationCount
                  }
                });
              }
            });
          } catch (err) {
            logger.error("[RateLimitMetrics] Failed to flush individual metric:", { error: err as any, key });
          }
        }));
      }
    } catch (error) {
      logger.error("[RateLimitMetrics] Batch flush failed:", error as any);
      // Logic to restore buffer could be added here, but for metrics, dropping is preferable to infinite retry loops
    } finally {
      this.isFlushing = false;
    }
  }
}

// Global singleton for the batch processor
const batchProcessor = new MetricBatchProcessor();


// --- Public API ---

/**
 * Record a successful rate-limited request (hit)
 *
 * This function is now optimized to use in-memory batching.
 * It returns immediately and the write happens in the background.
 */
export async function recordHit(
  tenantId: string,
  limiterType: RateLimiterType,
  identifier: string,
  endpoint: string
): Promise<void> {
  batchProcessor.add(tenantId, limiterType, identifier, endpoint, false);
}

/**
 * Record a rate limit violation (429 response)
 */
export async function recordViolation(
  tenantId: string,
  limiterType: RateLimiterType,
  identifier: string,
  endpoint: string
): Promise<void> {
  batchProcessor.add(tenantId, limiterType, identifier, endpoint, true);

  // Check thresholds asynchronously
  // We trigger this immediately for violations as they are more critical than hits
  checkThresholds(tenantId).catch((error) => {
    logger.error("[RateLimitMetrics] Failed to check thresholds:", {
      error,
      tenantId,
    });
  });
}

/**
 * Get aggregated metrics for a tenant over a time period
 */
export async function getTenantMetrics(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<TenantMetrics> {
  // Ensure we flush any pending metrics before reading
  await batchProcessor.flush();

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
  // Flush before reading
  await batchProcessor.flush();

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
