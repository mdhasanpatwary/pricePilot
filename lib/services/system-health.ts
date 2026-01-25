/**
 * System Health Monitoring Service
 * Tracks the health of critical system components
 */

import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/lib/queue/connection";
import { BrowserPool } from "./browser-pool";
import { circuitBreakerRegistry, CircuitState } from "@/lib/utils/circuit-breaker";
import { logger } from "../logger";

export interface HealthStatus {
    status: "healthy" | "degraded" | "unhealthy";
    message: string;
    details?: any;
}

export interface SystemHealth {
    overall: HealthStatus;
    database: HealthStatus;
    redis: HealthStatus;
    browserPool: HealthStatus;
    circuitBreakers: HealthStatus;
    timestamp: Date;
}

export class SystemHealthService {
    /**
     * Check database health
     */
    static async checkDatabase(): Promise<HealthStatus> {
        try {
            const start = Date.now();
            await prisma.$queryRaw`SELECT 1`;
            const responseTime = Date.now() - start;

            if (responseTime > 5000) {
                return {
                    status: "degraded",
                    message: `Database responding slowly (${responseTime}ms)`,
                    details: { responseTime },
                };
            }

            return {
                status: "healthy",
                message: `Database healthy (${responseTime}ms)`,
                details: { responseTime },
            };
        } catch (error) {
            return {
                status: "unhealthy",
                message: `Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                details: { error },
            };
        }
    }

    /**
     * Check Redis health
     */
    static async checkRedis(): Promise<HealthStatus> {
        try {
            const redis = getRedisConnection();
            const start = Date.now();
            await redis.ping();
            const responseTime = Date.now() - start;

            if (responseTime > 2000) {
                return {
                    status: "degraded",
                    message: `Redis responding slowly (${responseTime}ms)`,
                    details: { responseTime },
                };
            }

            return {
                status: "healthy",
                message: `Redis healthy (${responseTime}ms)`,
                details: { responseTime },
            };
        } catch (error) {
            return {
                status: "unhealthy",
                message: `Redis connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                details: { error },
            };
        }
    }

    /**
     * Check browser pool health
     */
    static async checkBrowserPool(): Promise<HealthStatus> {
        try {
            const pool = BrowserPool.getInstance();
            const stats = pool.getStats();

            if (stats.inUse / stats.total > 0.9) {
                return {
                    status: "degraded",
                    message: `Browser pool near capacity (${stats.inUse}/${stats.total})`,
                    details: stats,
                };
            }

            return {
                status: "healthy",
                message: `Browser pool healthy (${stats.inUse}/${stats.total} contexts)`,
                details: stats,
            };
        } catch (error) {
            return {
                status: "unhealthy",
                message: `Browser pool error: ${error instanceof Error ? error.message : "Unknown error"}`,
                details: { error },
            };
        }
    }

    /**
     * Check circuit breaker health
     */
    static async checkCircuitBreakers(): Promise<HealthStatus> {
        try {
            const breakers = circuitBreakerRegistry.getAllBreakers();
            const breakerStats = Array.from(breakers.entries()).map(([key, breaker]) => ({
                key,
                ...breaker.getStats(),
            }));

            const openBreakers = breakerStats.filter(b => b.state === CircuitState.OPEN);
            const halfOpenBreakers = breakerStats.filter(b => b.state === CircuitState.HALF_OPEN);

            if (openBreakers.length > 0) {
                return {
                    status: "degraded",
                    message: `${openBreakers.length} circuit breakers are OPEN`,
                    details: { openBreakers, halfOpenBreakers, total: breakerStats.length },
                };
            }

            if (halfOpenBreakers.length > 0) {
                return {
                    status: "degraded",
                    message: `${halfOpenBreakers.length} circuit breakers are HALF_OPEN`,
                    details: { halfOpenBreakers, total: breakerStats.length },
                };
            }

            return {
                status: "healthy",
                message: `All ${breakerStats.length} circuit breakers are CLOSED`,
                details: { total: breakerStats.length },
            };
        } catch (error) {
            return {
                status: "unhealthy",
                message: `Circuit breaker check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                details: { error },
            };
        }
    }

    /**
     * Perform comprehensive system health check
     */
    static async checkSystemHealth(): Promise<SystemHealth> {
        const [database, redis, browserPool, circuitBreakers] = await Promise.all([
            this.checkDatabase(),
            this.checkRedis(),
            this.checkBrowserPool(),
            this.checkCircuitBreakers(),
        ]);

        const components = [database, redis, browserPool, circuitBreakers];
        const unhealthyCount = components.filter(c => c.status === "unhealthy").length;
        const degradedCount = components.filter(c => c.status === "degraded").length;

        let overall: HealthStatus;
        if (unhealthyCount > 0) {
            overall = {
                status: "unhealthy",
                message: `${unhealthyCount} critical components are unhealthy`,
            };
        } else if (degradedCount > 0) {
            overall = {
                status: "degraded",
                message: `${degradedCount} components are degraded`,
            };
        } else {
            overall = {
                status: "healthy",
                message: "All systems operational",
            };
        }

        return {
            overall,
            database,
            redis,
            browserPool,
            circuitBreakers,
            timestamp: new Date(),
        };
    }

    /**
     * Log system health status
     */
    static async logHealthStatus(): Promise<void> {
        try {
            const health = await this.checkSystemHealth();

            if (health.overall.status === "unhealthy") {
                logger.error("[SystemHealth] System unhealthy", { health });
            } else if (health.overall.status === "degraded") {
                logger.warn("[SystemHealth] System degraded", { health });
            } else {
                logger.info("[SystemHealth] System healthy", {
                    message: health.overall.message,
                    timestamp: health.timestamp
                });
            }
        } catch (error) {
            logger.error("[SystemHealth] Health check failed", { error });
        }
    }
}