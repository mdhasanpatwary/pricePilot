import { CacheLayer } from "./cache-layer";
import { logger } from "@/lib/logger";
import { getRedisConnection } from "@/lib/queue/connection";

/**
 * Cache Monitoring Service
 * 
 * Monitors cache performance and health, generates alerts, and logs statistics.
 * 
 * Features:
 * - Redis health checks
 * - Threshold-based alerting
 * - Performance metrics tracking
 * - Periodic statistics logging
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

export interface CacheHealth {
    status: 'healthy' | 'unhealthy';
    redis?: {
        connected: boolean;
        memoryUsage: number;
        memoryLimit: number;
        memoryUsagePercent: number;
    };
    performance?: {
        hitRate: number;
        avgResponseTime: number;
        totalHits: number;
        totalMisses: number;
        totalKeys: number;
        evictions: number;
    };
    alerts?: Alert[];
    error?: string;
    timestamp: string;
}

export interface Alert {
    level: 'info' | 'warning' | 'error';
    message: string;
    metric?: string;
    value?: number;
    threshold?: number;
}

export interface MonitoringConfig {
    hitRateThreshold: number;      // Default: 0.6 (60%)
    memoryUsageThreshold: number;  // Default: 0.8 (80%)
    responseTimeThreshold: number; // Default: 100ms
    memoryLimit: number;           // Default: 500MB (configurable via env)
}

export class CacheMonitoringService {
    private cacheLayer: CacheLayer;
    private redis: ReturnType<typeof getRedisConnection>;

    private config: MonitoringConfig;

    constructor(config?: Partial<MonitoringConfig>) {
        this.cacheLayer = CacheLayer.getInstance();
        this.redis = getRedisConnection();

        // Build default config with environment variables
        const defaultConfig: MonitoringConfig = {
            hitRateThreshold: 0.6,
            memoryUsageThreshold: this.getMemoryThresholdFromEnv(),
            responseTimeThreshold: 100,
            memoryLimit: this.getMemoryLimitFromEnv(),
        };

        this.config = { ...defaultConfig, ...config };

        // Log configuration on initialization
        logger.info('[CacheMonitoring] Initialized with config', {
            memoryLimit: `${Math.round(this.config.memoryLimit / 1024 / 1024)}MB`,
            memoryThreshold: `${Math.round(this.config.memoryUsageThreshold * 100)}%`,
            hitRateThreshold: `${Math.round(this.config.hitRateThreshold * 100)}%`,
        });
    }

    /**
     * Get memory limit from environment variable or use default
     * Supports REDIS_MEMORY_LIMIT_MB environment variable
     * Default: 250MB (Upstash free tier limit)
     */
    private getMemoryLimitFromEnv(): number {
        const envLimit = process.env.REDIS_MEMORY_LIMIT_MB;
        if (envLimit) {
            const limitMB = parseInt(envLimit);
            if (!isNaN(limitMB) && limitMB > 0) {
                return limitMB * 1024 * 1024; // Convert MB to bytes
            }
        }
        return 250 * 1024 * 1024; // Default: 250MB (free tier)
    }

    /**
     * Get memory usage threshold from environment variable or use default
     * Supports REDIS_MEMORY_ALERT_THRESHOLD environment variable
     */
    private getMemoryThresholdFromEnv(): number {
        const envThreshold = process.env.REDIS_MEMORY_ALERT_THRESHOLD;
        if (envThreshold) {
            const threshold = parseFloat(envThreshold);
            if (!isNaN(threshold) && threshold > 0 && threshold <= 1) {
                return threshold;
            }
        }
        return 0.8; // Default: 80%
    }

    /**
     * Get comprehensive health status of the cache system
     * Requirement 10.1: Redis health check
     * Requirement 10.2: Health check endpoint
     */
    async getHealthStatus(): Promise<CacheHealth> {
        try {
            // Check Redis connectivity
            const isConnected = await this.checkRedisConnection();

            if (!isConnected) {
                return {
                    status: 'unhealthy',
                    error: 'Redis connection failed',
                    timestamp: new Date().toISOString(),
                };
            }

            // Get memory usage
            const memoryUsage = await this.getMemoryUsage();
            const memoryUsagePercent = memoryUsage / this.config.memoryLimit;

            // Get performance stats
            const stats = await this.cacheLayer.getCacheStats();
            const totalHits = stats.hitRate * (stats.hitRate + stats.missRate) || 0;
            const totalMisses = stats.missRate * (stats.hitRate + stats.missRate) || 0;

            // Generate alerts based on thresholds
            const alerts = this.generateAlerts(stats, memoryUsage);

            // Determine overall health status
            const hasErrors = alerts.some(alert => alert.level === 'error');
            const status = hasErrors ? 'unhealthy' : 'healthy';

            return {
                status,
                redis: {
                    connected: isConnected,
                    memoryUsage,
                    memoryLimit: this.config.memoryLimit,
                    memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
                },
                performance: {
                    hitRate: stats.hitRate,
                    avgResponseTime: 0, // TODO: Implement response time tracking
                    totalHits: Math.round(totalHits),
                    totalMisses: Math.round(totalMisses),
                    totalKeys: stats.totalKeys,
                    evictions: stats.evictions,
                },
                alerts,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            logger.error('[CacheMonitoring] Error getting health status', { error });
            return {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            };
        }
    }

    /**
     * Check Redis connection status
     * Requirement 10.1: Redis connectivity check
     */
    private async checkRedisConnection(): Promise<boolean> {
        try {
            // Check if already connected
            if (this.redis.status === 'ready') {
                // Just ping to verify
                const result = await this.redis.ping();
                return result === 'PONG';
            }

            // If not connected, try to connect
            if (this.redis.status === 'end' || this.redis.status === 'close') {
                await this.redis.connect();
            }

            // Ping Redis to verify connectivity
            const result = await this.redis.ping();
            return result === 'PONG';
        } catch (error) {
            logger.error('[CacheMonitoring] Redis connection check failed', { error });
            return false;
        }
    }

    /**
     * Get Redis memory usage
     * Requirement 10.3: Memory usage monitoring
     */
    private async getMemoryUsage(): Promise<number> {
        try {
            const info = await this.redis.info('memory');
            const memoryMatch = info.match(/used_memory:(\d+)/);
            return memoryMatch ? parseInt(memoryMatch[1]) : 0;
        } catch (error) {
            logger.error('[CacheMonitoring] Error getting memory usage', { error });
            return 0;
        }
    }

    /**
     * Generate alerts based on threshold violations
     * Requirement 4.5: Threshold-based alerts
     * Requirement 10.4: Alert generation
     */
    generateAlerts(stats: any, memoryUsage: number): Alert[] {
        const alerts: Alert[] = [];

        // Check hit rate
        if (stats.hitRate < this.config.hitRateThreshold) {
            alerts.push({
                level: 'warning',
                message: `Cache hit rate below threshold: ${(stats.hitRate * 100).toFixed(1)}%`,
                metric: 'hitRate',
                value: stats.hitRate,
                threshold: this.config.hitRateThreshold,
            });
        }

        // Check memory usage
        const memoryUsagePercent = memoryUsage / this.config.memoryLimit;
        if (memoryUsagePercent > this.config.memoryUsageThreshold) {
            const level = memoryUsagePercent > 0.95 ? 'error' : 'warning';
            alerts.push({
                level,
                message: `Cache memory usage high: ${(memoryUsage / 1024 / 1024).toFixed(0)}MB (${(memoryUsagePercent * 100).toFixed(1)}%)`,
                metric: 'memoryUsage',
                value: memoryUsage,
                threshold: this.config.memoryLimit * this.config.memoryUsageThreshold,
            });
        }

        // Check evictions
        if (stats.evictions > 0) {
            alerts.push({
                level: 'info',
                message: `Cache evictions detected: ${stats.evictions} keys evicted`,
                metric: 'evictions',
                value: stats.evictions,
            });
        }

        // Check if cache is empty (might indicate a problem)
        if (stats.totalKeys === 0) {
            alerts.push({
                level: 'warning',
                message: 'Cache is empty - no keys stored',
                metric: 'totalKeys',
                value: 0,
            });
        }

        return alerts;
    }

    /**
     * Log cache statistics
     * Requirement 4.6: Periodic statistics logging
     * Requirement 10.5: Statistics logging
     */
    async logStats(): Promise<void> {
        try {
            const health = await this.getHealthStatus();

            // Log to console/logger
            logger.info('[CacheMonitoring] Cache Statistics', {
                status: health.status,
                redis: health.redis,
                performance: health.performance,
                alertCount: health.alerts?.length || 0,
            });

            // Log alerts separately for visibility
            if (health.alerts && health.alerts.length > 0) {
                for (const alert of health.alerts) {
                    const logLevel = alert.level === 'error' ? 'error' :
                        alert.level === 'warning' ? 'warn' : 'info';
                    logger[logLevel]('[CacheMonitoring] Alert', {
                        message: alert.message,
                        metric: alert.metric,
                        value: alert.value,
                        threshold: alert.threshold,
                    });
                }
            }

            // Send to monitoring dashboard (if configured)
            await this.sendToMonitoring(health);
        } catch (error) {
            logger.error('[CacheMonitoring] Error logging stats', { error });
        }
    }

    /**
     * Send statistics to external monitoring system
     * Requirement 10.6: Monitoring dashboard integration
     */
    private async sendToMonitoring(health: CacheHealth): Promise<void> {
        try {
            // TODO: Integrate with monitoring service (e.g., DataDog, New Relic, Prometheus)
            // For now, just log that we would send to monitoring
            logger.debug('[CacheMonitoring] Would send to monitoring dashboard', {
                status: health.status,
                timestamp: health.timestamp,
            });

            // Example integration points:
            // - await datadogClient.gauge('cache.hit_rate', health.performance?.hitRate);
            // - await prometheusClient.set('cache_memory_usage', health.redis?.memoryUsage);
            // - await newRelicClient.recordMetric('cache/health', health.status === 'healthy' ? 1 : 0);
        } catch (error) {
            logger.error('[CacheMonitoring] Error sending to monitoring', { error });
        }
    }

    /**
     * Get cache statistics for a specific tenant
     * Requirement 4.1: Tenant-specific hit rate tracking
     */
    async getTenantStats(tenantId: string): Promise<any> {
        try {
            // Get all keys for this tenant
            const pattern = `cache:${tenantId}:*`;
            const keys = await this.redis.keys(pattern);

            return {
                tenantId,
                totalKeys: keys.length,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            logger.error('[CacheMonitoring] Error getting tenant stats', { tenantId, error });
            return {
                tenantId,
                totalKeys: 0,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            };
        }
    }

    /**
     * Check if cache operations are performing within acceptable thresholds
     * Requirement 10.5: Cache operation latency monitoring
     */
    async checkPerformance(): Promise<{ healthy: boolean; latency: number }> {
        try {
            const startTime = Date.now();

            // Perform a test operation
            const testKey = 'cache:health:test';
            await this.redis.set(testKey, 'test', 'EX', 10);
            await this.redis.get(testKey);
            await this.redis.del(testKey);

            const latency = Date.now() - startTime;
            const healthy = latency < this.config.responseTimeThreshold;

            if (!healthy) {
                logger.warn('[CacheMonitoring] Cache operations slow', {
                    latency,
                    threshold: this.config.responseTimeThreshold,
                });
            }

            return { healthy, latency };
        } catch (error) {
            logger.error('[CacheMonitoring] Performance check failed', { error });
            return { healthy: false, latency: -1 };
        }
    }

    /**
     * Update monitoring configuration
     */
    updateConfig(config: Partial<MonitoringConfig>): void {
        this.config = { ...this.config, ...config };
        logger.info('[CacheMonitoring] Configuration updated', { config: this.config });
    }

    /**
     * Get current monitoring configuration
     */
    getConfig(): MonitoringConfig {
        return { ...this.config };
    }
}

let cacheMonitoringInstance: CacheMonitoringService | null = null;

export function getCacheMonitoringService(): CacheMonitoringService {
    if (!cacheMonitoringInstance) {
        cacheMonitoringInstance = new CacheMonitoringService();
    }
    return cacheMonitoringInstance;
}

// Lazy proxy avoids import-time Redis work.
export const cacheMonitoringService = new Proxy({} as CacheMonitoringService, {
    get(_target, property) {
        const service = getCacheMonitoringService();
        const value = (service as any)[property];
        return typeof value === "function" ? value.bind(service) : value;
    },
});
