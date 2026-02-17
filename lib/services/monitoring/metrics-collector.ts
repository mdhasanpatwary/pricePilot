import { Redis as UpstashRedis } from "@upstash/redis";
import type { Redis as IORedis } from "ioredis";
import { getRedisConnection } from "@/lib/queue/connection";

/**
 * Metrics Collector Service
 *
 * Collects and aggregates application metrics using Redis for time-series storage.
 * Supports response times, errors, scraping results, price updates, and auth failures.
 *
 * Features:
 * - Time-series data storage using Redis sorted sets
 * - Automatic TTL management (7 days detailed, 90 days aggregated)
 * - Percentile calculations (p50, p95, p99)
 * - Multi-tenant metric isolation
 * - Efficient batch operations
 *
 * @module lib/services/monitoring/metrics-collector
 */

type RedisBackend =
    | { kind: "upstash"; client: UpstashRedis }
    | { kind: "ioredis"; client: IORedis };

/**
 * Metric data point with timestamp and optional labels
 */
export interface MetricDataPoint {
    timestamp: number;
    value: number;
    labels?: Record<string, string>;
}

/**
 * Aggregated metric statistics
 */
export interface MetricAggregates {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
}

/**
 * Complete metric data with time-series and aggregates
 */
export interface MetricData {
    metricType: string;
    timeWindow: number;
    dataPoints: MetricDataPoint[];
    aggregates: MetricAggregates;
}

/**
 * Metrics Collector Interface
 */
export interface IMetricsCollector {
    recordResponseTime(endpoint: string, duration: number, tenantId?: string): Promise<void>;
    recordError(endpoint: string, errorType: string, tenantId?: string): Promise<void>;
    recordScrapingResult(competitorId: string, success: boolean, blocked: boolean, tenantId?: string): Promise<void>;
    recordPriceUpdate(tenantId: string, success: boolean, productCount: number): Promise<void>;
    recordAuthFailure(ipAddress: string): Promise<void>;
    recordSyncLifecycle(siteId: string, stage: 'QUEUE' | 'START' | 'PROGRESS' | 'STOP' | 'FAIL', metadata?: Record<string, any>): Promise<void>;
    getMetrics(metricType: string, timeWindow: number, tenantId?: string): Promise<MetricData>;
}

/**
 * Redis-based Metrics Collector Implementation
 */
export class MetricsCollector implements IMetricsCollector {
    private backend: RedisBackend | null;
    private disabledUntilMs = 0;
    private readonly DETAILED_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
    private readonly AGGREGATED_TTL = 90 * 24 * 60 * 60; // 90 days in seconds

    constructor() {
        // In development, prefer local Redis (ioredis) to avoid burning Upstash quotas.
        // You can force Upstash usage via MONITORING_FORCE_UPSTASH_REDIS=true.
        this.backend = this.initBackend();
    }

    private initBackend(): RedisBackend | null {
        const preferLocalInDev = process.env.REDIS_PREFER_LOCAL_IN_DEV !== "false";
        const forceUpstash = process.env.MONITORING_FORCE_UPSTASH_REDIS === "true";
        const hasUpstash =
            !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

        if (process.env.NODE_ENV !== "production" && preferLocalInDev && !forceUpstash) {
            return { kind: "ioredis", client: getRedisConnection() as any };
        }

        if (hasUpstash) {
            return {
                kind: "upstash",
                client: new UpstashRedis({
                    url: process.env.UPSTASH_REDIS_REST_URL!,
                    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
                }),
            };
        }

        // If no Upstash REST credentials, fall back to whatever REDIS_URL / local dev is configured to use.
        // This relies on lib/queue/connection.ts to decide the effective redis URL.
        return { kind: "ioredis", client: getRedisConnection() as any };
    }

    private isDisabled(): boolean {
        return this.disabledUntilMs > Date.now();
    }

    private disableFor(ms: number, reason: string, error?: unknown): void {
        this.disabledUntilMs = Date.now() + ms;
        console.warn(
            `[MetricsCollector] Disabled temporarily (${Math.round(ms / 1000)}s): ${reason}`,
            error instanceof Error ? { message: error.message } : undefined,
        );
    }

    private handleBackendError(error: unknown): void {
        const msg =
            error instanceof Error
                ? error.message
                : typeof error === "string"
                    ? error
                    : (() => {
                        try {
                            return JSON.stringify(error);
                        } catch {
                            return String(error);
                        }
                    })();

        // Upstash quota exhausted: disable metrics until the next session/day.
        if (msg.includes("max requests limit exceeded")) {
            this.disableFor(60 * 60 * 1000, "Upstash quota exceeded", error);
            return;
        }

        // Transient connection failures: short backoff.
        if (
            msg.includes("ECONNREFUSED") ||
            msg.includes("ENOTFOUND") ||
            msg.includes("ETIMEDOUT") ||
            msg.includes("Connection is closed") ||
            msg.includes("EPERM")
        ) {
            this.disableFor(30 * 1000, "Redis unavailable", error);
            return;
        }
    }

    private async zaddPoint(key: string, score: number, member: string): Promise<void> {
        if (!this.backend || this.isDisabled()) return;

        if (this.backend.kind === "upstash") {
            await this.backend.client.zadd(key, { score, member });
            return;
        }

        // ioredis signature: zadd key score member
        await (this.backend.client as any).zadd(key, score, member);
    }

    private async expireKey(key: string, ttlSeconds: number): Promise<void> {
        if (!this.backend || this.isDisabled()) return;
        await (this.backend.client as any).expire(key, ttlSeconds);
    }

    private async zrangeAll(key: string): Promise<any[]> {
        if (!this.backend || this.isDisabled()) return [];
        return await (this.backend.client as any).zrange(key, 0, -1);
    }

    private async keys(pattern: string): Promise<string[]> {
        if (!this.backend || this.isDisabled()) return [];
        return await (this.backend.client as any).keys(pattern);
    }

    private async exists(key: string): Promise<number> {
        if (!this.backend || this.isDisabled()) return 0;
        return await (this.backend.client as any).exists(key);
    }

    /**
     * Record API response time
     *
     * @param endpoint - API endpoint path
     * @param duration - Response time in milliseconds
     * @param tenantId - Optional tenant ID for multi-tenant tracking
     */
    async recordResponseTime(
        endpoint: string,
        duration: number,
        tenantId?: string
    ): Promise<void> {
        if (!this.backend || this.isDisabled()) return;

        const timestamp = Date.now();
        // Use normalized endpoint as identifier (replace / with :)
        const normalizedEndpoint = endpoint === '/' ? 'root' : endpoint.replace(/^\/|\/$/g, '').replace(/\//g, ':');
        const key = this.buildKey("response_time", normalizedEndpoint, tenantId);

        const dataPoint: MetricDataPoint = {
            timestamp,
            value: duration,
            labels: {
                endpoint,
                ...(tenantId && { tenantId }),
            },
        };

        try {
            await this.zaddPoint(key, timestamp, JSON.stringify(dataPoint));
            await this.expireKey(key, this.DETAILED_TTL);
        } catch (error) {
            this.handleBackendError(error);
            console.error("Failed to record response time:", error);
        }
    }

    /**
     * Record application error
     *
     * @param endpoint - API endpoint where error occurred
     * @param errorType - Type/category of error
     * @param tenantId - Optional tenant ID for multi-tenant tracking
     */
    async recordError(
        endpoint: string,
        errorType: string,
        tenantId?: string
    ): Promise<void> {
        if (!this.backend || this.isDisabled()) return;

        const timestamp = Date.now();
        const normalizedEndpoint = endpoint === '/' ? 'root' : endpoint.replace(/^\/|\/$/g, '').replace(/\//g, ':');
        const key = this.buildKey("error", normalizedEndpoint, tenantId);

        const dataPoint: MetricDataPoint = {
            timestamp,
            value: 1,
            labels: {
                endpoint,
                errorType,
                ...(tenantId && { tenantId }),
            },
        };

        try {
            await this.zaddPoint(key, timestamp, JSON.stringify(dataPoint));
            await this.expireKey(key, this.DETAILED_TTL);
        } catch (error) {
            this.handleBackendError(error);
            console.error("Failed to record error:", error);
        }
    }

    /**
     * Record sync lifecycle event
     *
     * @param siteId - Site ID
     * @param stage - Lifecycle stage
     * @param metadata - Optional metadata
     */
    async recordSyncLifecycle(
        siteId: string,
        stage: 'QUEUE' | 'START' | 'PROGRESS' | 'STOP' | 'FAIL',
        metadata?: Record<string, any>
    ): Promise<void> {
        if (!this.backend || this.isDisabled()) return;

        const timestamp = Date.now();
        const key = this.buildKey("sync_lifecycle", siteId);

        const dataPoint: MetricDataPoint = {
            timestamp,
            value: 1,
            labels: {
                siteId,
                stage,
                ...metadata ? Object.fromEntries(Object.entries(metadata).map(([k,v]) => [k, String(v)])) : {}
            }
        };

        try {
            await this.zaddPoint(key, timestamp, JSON.stringify(dataPoint));
            await this.expireKey(key, this.DETAILED_TTL);
        } catch (error) {
            this.handleBackendError(error);
            console.error("Failed to record sync lifecycle:", error);
        }
    }

    /**
     * Record competitor scraping result
     *
     * @param competitorId - Competitor website ID
     * @param success - Whether scraping was successful
     * @param blocked - Whether request was blocked/detected
     * @param tenantId - Optional tenant ID for multi-tenant tracking
     */
    async recordScrapingResult(
        competitorId: string,
        success: boolean,
        blocked: boolean,
        tenantId?: string
    ): Promise<void> {
        if (!this.backend || this.isDisabled()) return;

        const timestamp = Date.now();

        // Record success/failure
        const successKey = this.buildKey("scraping_success", competitorId, tenantId);
        const successDataPoint: MetricDataPoint = {
            timestamp,
            value: success ? 1 : 0,
            labels: {
                competitorId,
                success: success.toString(),
                ...(tenantId && { tenantId }),
            },
        };

        // Record block rate
        const blockKey = this.buildKey("scraping_blocked", competitorId, tenantId);
        const blockDataPoint: MetricDataPoint = {
            timestamp,
            value: blocked ? 1 : 0,
            labels: {
                competitorId,
                blocked: blocked.toString(),
                ...(tenantId && { tenantId }),
            },
        };

        try {
            await Promise.all([
                this.zaddPoint(successKey, timestamp, JSON.stringify(successDataPoint)),
                this.zaddPoint(blockKey, timestamp, JSON.stringify(blockDataPoint)),
                this.expireKey(successKey, this.DETAILED_TTL),
                this.expireKey(blockKey, this.DETAILED_TTL),
            ]);
        } catch (error) {
            this.handleBackendError(error);
            console.error("Failed to record scraping result:", error);
        }
    }

    /**
     * Record price update operation
     *
     * @param tenantId - Tenant ID
     * @param success - Whether update was successful
     * @param productCount - Number of products updated
     */
    async recordPriceUpdate(
        tenantId: string,
        success: boolean,
        productCount: number
    ): Promise<void> {
        if (!this.backend || this.isDisabled()) return;

        const timestamp = Date.now();
        const key = this.buildKey("price_update", "all", tenantId);

        const dataPoint: MetricDataPoint = {
            timestamp,
            value: success ? productCount : 0,
            labels: {
                tenantId,
                success: success.toString(),
                productCount: productCount.toString(),
            },
        };

        try {
            await this.zaddPoint(key, timestamp, JSON.stringify(dataPoint));
            await this.expireKey(key, this.DETAILED_TTL);
        } catch (error) {
            this.handleBackendError(error);
            console.error("Failed to record price update:", error);
        }
    }

    /**
     * Record authentication failure
     *
     * @param ipAddress - IP address of failed authentication attempt
     */
    async recordAuthFailure(ipAddress: string): Promise<void> {
        if (!this.backend || this.isDisabled()) return;

        const timestamp = Date.now();
        const key = this.buildKey("auth_failure", ipAddress);

        const dataPoint: MetricDataPoint = {
            timestamp,
            value: 1,
            labels: {
                ipAddress,
            },
        };

        try {
            await this.zaddPoint(key, timestamp, JSON.stringify(dataPoint));
            // Shorter TTL for auth failures (1 hour)
            await this.expireKey(key, 60 * 60);
        } catch (error) {
            this.handleBackendError(error);
            console.error("Failed to record auth failure:", error);
        }
    }

    /**
     * Retrieve metrics for a given type and time window
     *
     * @param metricType - Type of metric to retrieve
     * @param timeWindow - Time window in seconds
     * @param tenantId - Optional tenant ID for filtering
     * @returns Metric data with time-series and aggregates
     */
    async getMetrics(
        metricType: string,
        timeWindow: number,
        tenantId?: string
    ): Promise<MetricData> {
        if (!this.backend || this.isDisabled()) {
            return this.getEmptyMetricData(metricType, timeWindow);
        }

        const now = Date.now();
        const startTime = now - timeWindow * 1000;

        // Build key pattern for the metric type
        const keyPattern = this.buildKey(metricType, "*", tenantId);

        try {
            // Get all keys matching the pattern
            const keys = await this.getKeysMatchingPattern(keyPattern);

            if (keys.length === 0) {
                return this.getEmptyMetricData(metricType, timeWindow);
            }

            // Fetch data points from all matching keys
            const allDataPoints: MetricDataPoint[] = [];

            for (const key of keys) {
                // Upstash Redis client may not expose zrangebyscore; retrieve full set and filter in-app
                const members = await this.zrangeAll(key);
                let parseErrors = 0;

                for (const member of members) {
                    try {
                        let dataPoint: MetricDataPoint | null = null;

                        // Upstash may return either raw JSON strings or already-deserialized objects.
                        if (typeof member === "string") {
                            dataPoint = JSON.parse(member) as MetricDataPoint;
                        } else if (member && typeof member === "object") {
                            dataPoint = member as MetricDataPoint;
                        }

                        if (!dataPoint || typeof dataPoint.timestamp !== "number") {
                            throw new Error("Invalid metric data point shape");
                        }

                        if (dataPoint.timestamp >= startTime && dataPoint.timestamp <= now) {
                            allDataPoints.push(dataPoint);
                        }
                    } catch (error) {
                        parseErrors++;
                    }
                }

                if (parseErrors > 0) {
                    console.warn(
                        `Skipped ${parseErrors} malformed metric data points for key ${key}`
                    );
                }
            }

            // Calculate aggregates
            const aggregates = this.calculateAggregates(allDataPoints);

            // Store aggregated TTL to keep longer-term aggregates if Redis is available
            try {
                const aggKey = `metrics:aggregated:${metricType}:${tenantId ?? 'all'}`;
                await this.expireKey(aggKey, this.AGGREGATED_TTL);
            } catch (err) {
                // Non-fatal - continue
            }

            return {
                metricType,
                timeWindow,
                dataPoints: allDataPoints,
                aggregates,
            };
        } catch (error) {
            this.handleBackendError(error);
            console.error("Failed to get metrics:", error);
            return this.getEmptyMetricData(metricType, timeWindow);
        }
    }

    /**
     * Build Redis key for metric storage
     *
     * @param metricType - Type of metric
     * @param identifier - Specific identifier (endpoint, competitorId, etc.)
     * @param tenantId - Optional tenant ID
     * @returns Redis key string
     */
    private buildKey(
        metricType: string,
        identifier: string,
        tenantId?: string
    ): string {
        const parts = ["metrics", metricType];

        if (tenantId) {
            parts.push(tenantId);
        }

        parts.push(identifier);

        return parts.join(":");
    }

    /**
     * Get keys matching a pattern (simplified for Upstash)
     *
     * Note: Upstash Redis doesn't support SCAN, so we use a simplified approach
     * In production, consider maintaining an index of metric keys
     *
     * @param pattern - Key pattern to match
     * @returns Array of matching keys
     */
    private async getKeysMatchingPattern(pattern: string): Promise<string[]> {
        if (!this.backend || this.isDisabled()) return [];

        try {
            // For now, we'll construct the exact key from the pattern
            // In a full implementation, you'd maintain an index of keys
            const key = pattern.replace("*", "all");
            // If the pattern has wildcard, it might fail here unless we use KEYS command (expensive)
            // or maintain a set of known keys.
            // Given the limitations, we might just look for exact matches or assume the user asks specifically?

            // NOTE: The previous implementation just replaced * with all, effectively disabling wildcard search.
            // We should use KEYS if safe, or SCAN. Since this is "PricePilot" with Upstash, KEYS is acceptable for low volume.
            // But Upstash REST API supports 'keys' command.

            if (pattern.includes("*")) {
                return await this.keys(pattern);
            }

            // Check if key exists
            const exists = await this.exists(key);

            return exists ? [key] : [];
        } catch (error) {
            this.handleBackendError(error);
            console.error("Failed to get keys matching pattern:", error);
            return [];
        }
    }

    /**
     * Calculate aggregate statistics from data points
     *
     * @param dataPoints - Array of metric data points
     * @returns Aggregated statistics
     */
    private calculateAggregates(dataPoints: MetricDataPoint[]): MetricAggregates {
        if (dataPoints.length === 0) {
            return {
                count: 0,
                sum: 0,
                avg: 0,
                min: 0,
                max: 0,
                p50: 0,
                p95: 0,
                p99: 0,
            };
        }

        const values = dataPoints.map((dp) => dp.value).sort((a, b) => a - b);
        const sum = values.reduce((acc, val) => acc + val, 0);
        const count = values.length;

        return {
            count,
            sum,
            avg: sum / count,
            min: values[0],
            max: values[count - 1],
            p50: this.calculatePercentile(values, 0.5),
            p95: this.calculatePercentile(values, 0.95),
            p99: this.calculatePercentile(values, 0.99),
        };
    }

    /**
     * Calculate percentile value from sorted array
     *
     * @param sortedValues - Sorted array of values
     * @param percentile - Percentile to calculate (0.0 to 1.0)
     * @returns Percentile value
     */
    private calculatePercentile(sortedValues: number[], percentile: number): number {
        if (sortedValues.length === 0) return 0;

        const index = Math.ceil(sortedValues.length * percentile) - 1;
        return sortedValues[Math.max(0, index)];
    }

    async getEndpointMetrics(
        metricType: string,
        timeWindow: number,
        tenantId?: string
    ): Promise<Record<string, MetricAggregates>> {
        if (!this.backend || this.isDisabled()) return {};

        const now = Date.now();
        const startTime = now - timeWindow * 1000;
        const keyPattern = this.buildKey(metricType, "*", tenantId);

        try {
            const keys = await this.getKeysMatchingPattern(keyPattern);
            const endpointData: Record<string, MetricDataPoint[]> = {};

            for (const key of keys) {
                const members = await this.zrangeAll(key);
                for (const member of members) {
                    try {
                        const dataPoint = JSON.parse(member as string) as MetricDataPoint;
                        if (dataPoint.timestamp >= startTime && dataPoint.timestamp <= now) {
                            const endpoint = dataPoint.labels?.endpoint || 'unknown';
                            if (!endpointData[endpoint]) endpointData[endpoint] = [];
                            endpointData[endpoint].push(dataPoint);
                        }
                    } catch (e) {}
                }
            }

            const result: Record<string, MetricAggregates> = {};
            for (const [endpoint, points] of Object.entries(endpointData)) {
                result[endpoint] = this.calculateAggregates(points);
            }
            return result;
        } catch (error) {
            this.handleBackendError(error);
            console.error("Failed to get endpoint metrics:", error);
            return {};
        }
    }

    async getSyncMetrics(timeWindow: number, _tenantId?: string): Promise<{
        queued: number;
        active: number;
        completed: number;
        failed: number;
        avgDuration: number;
    }> {
        if (!this.backend || this.isDisabled()) return { queued: 0, active: 0, completed: 0, failed: 0, avgDuration: 0 };

        const now = Date.now();
        const startTime = now - timeWindow * 1000;
        // Search for sync_lifecycle keys. We can't filter by tenant easily in key name for syncs if we used siteId
        // But we stored tenantId in labels? No, only siteId.
        // We might need to iterate all sync keys.
        const keyPattern = "metrics:sync_lifecycle:*"; // This is expensive if many sites

        try {
            const keys = await this.getKeysMatchingPattern(keyPattern);
            let queued = 0;
            let active = 0;
            let completed = 0;
            let failed = 0;
            let durations: number[] = [];

            const startTimes = new Map<string, number>();

            for (const key of keys) {
                const members = await this.zrangeAll(key);
                for (const member of members) {
                    try {
                        const dp = JSON.parse(member as string) as MetricDataPoint;
                        if (dp.timestamp < startTime) continue;

                        const stage = dp.labels?.stage;
                        if (!stage) continue;

                        // Simple counters for events in window
                        if (stage === 'QUEUE') queued++;
                        if (stage === 'START') {
                            active++;
                            startTimes.set(dp.labels?.siteId || '', dp.timestamp);
                        }
                        if (stage === 'STOP') {
                            completed++;
                            const start = startTimes.get(dp.labels?.siteId || '');
                            if (start) durations.push(dp.timestamp - start);
                        }
                        if (stage === 'FAIL') failed++;
                    } catch (e) {}
                }
            }

            // Average duration
            const avgDuration = durations.length > 0
                ? durations.reduce((a, b) => a + b, 0) / durations.length
                : 0;

            return { queued, active, completed, failed, avgDuration };
        } catch (error) {
            this.handleBackendError(error);
            console.error("Failed to get sync metrics:", error);
            return { queued: 0, active: 0, completed: 0, failed: 0, avgDuration: 0 };
        }
    }
    /**
     * Get empty metric data structure
     *
     * @param metricType - Type of metric
     * @param timeWindow - Time window in seconds
     * @returns Empty metric data
     */
    private getEmptyMetricData(metricType: string, timeWindow: number): MetricData {
        return {
            metricType,
            timeWindow,
            dataPoints: [],
            aggregates: {
                count: 0,
                sum: 0,
                avg: 0,
                min: 0,
                max: 0,
                p50: 0,
                p95: 0,
                p99: 0,
            },
        };
    }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();
