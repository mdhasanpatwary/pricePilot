import { Redis } from "ioredis";
import { getRedisConnection } from "@/lib/queue/connection";
import { logger } from "@/lib/logger";

/**
 * Redis data structures for admin dashboard real-time features
 * 
 * Data Structures:
 * 1. Active Sessions (Hash): session:{sessionId} -> session data
 * 2. Session Index by Tenant (Set): tenant:{tenantId}:sessions -> set of sessionIds
 * 3. Real-Time Metrics (Hash): metrics:realtime -> metric fields
 */

export interface RedisSessionData {
    tenantId: string;
    status: string;
    currentStage: string;
    proxyUsed: string | null;
    startTime: string;
    metrics: string; // JSON string
}

export interface RedisMetrics {
    activeSessions: number;
    requestsPerMinute: number;
    avgResponseTime: number;
    lastUpdated: string;
}

export class RedisSessionManager {
    private redis: Redis;
    private static instance: RedisSessionManager;

    private constructor() {
        this.redis = getRedisConnection();
    }

    static getInstance(): RedisSessionManager {
        if (!RedisSessionManager.instance) {
            RedisSessionManager.instance = new RedisSessionManager();
        }
        return RedisSessionManager.instance;
    }

    /**
     * Store active session data in Redis
     * TTL: 1 hour
     */
    async setSession(sessionId: string, data: RedisSessionData): Promise<void> {
        try {
            const key = `session:${sessionId}`;
            await this.redis.hmset(key, data as any);
            await this.redis.expire(key, 3600); // 1 hour TTL

            // Add to tenant index
            await this.addToTenantIndex(data.tenantId, sessionId);
        } catch (error) {
            logger.error("[RedisSessionManager] Error setting session", { sessionId, error });
        }
    }

    /**
     * Get session data from Redis
     */
    async getSession(sessionId: string): Promise<RedisSessionData | null> {
        try {
            const key = `session:${sessionId}`;
            const data = await this.redis.hgetall(key);

            if (!data || Object.keys(data).length === 0) {
                return null;
            }

            return data as unknown as RedisSessionData;
        } catch (error) {
            logger.error("[RedisSessionManager] Error getting session", { sessionId, error });
            return null;
        }
    }

    /**
     * Update specific fields of a session
     */
    async updateSession(sessionId: string, updates: Partial<RedisSessionData>): Promise<void> {
        try {
            const key = `session:${sessionId}`;
            if (Object.keys(updates).length > 0) {
                await this.redis.hmset(key, updates as any);
            }
        } catch (error) {
            logger.error("[RedisSessionManager] Error updating session", { sessionId, error });
        }
    }

    /**
     * Delete session from Redis
     */
    async deleteSession(sessionId: string, tenantId: string): Promise<void> {
        try {
            const key = `session:${sessionId}`;
            await this.redis.del(key);

            // Remove from tenant index
            await this.removeFromTenantIndex(tenantId, sessionId);
        } catch (error) {
            logger.error("[RedisSessionManager] Error deleting session", { sessionId, error });
        }
    }

    /**
     * Add session to tenant index
     */
    private async addToTenantIndex(tenantId: string, sessionId: string): Promise<void> {
        try {
            const key = `tenant:${tenantId}:sessions`;
            await this.redis.sadd(key, sessionId);
            await this.redis.expire(key, 3600); // 1 hour TTL
        } catch (error) {
            logger.error("[RedisSessionManager] Error adding to tenant index", { tenantId, sessionId, error });
        }
    }

    /**
     * Remove session from tenant index
     */
    private async removeFromTenantIndex(tenantId: string, sessionId: string): Promise<void> {
        try {
            const key = `tenant:${tenantId}:sessions`;
            await this.redis.srem(key, sessionId);
        } catch (error) {
            logger.error("[RedisSessionManager] Error removing from tenant index", { tenantId, sessionId, error });
        }
    }

    /**
     * Get all session IDs for a tenant
     */
    async getTenantSessions(tenantId: string): Promise<string[]> {
        try {
            const key = `tenant:${tenantId}:sessions`;
            return await this.redis.smembers(key);
        } catch (error) {
            logger.error("[RedisSessionManager] Error getting tenant sessions", { tenantId, error });
            return [];
        }
    }

    /**
     * Get all active session IDs
     */
    async getAllActiveSessions(): Promise<string[]> {
        try {
            const keys = await this.redis.keys("session:*");
            return keys.map(key => key.replace("session:", ""));
        } catch (error) {
            logger.error("[RedisSessionManager] Error getting all active sessions", { error });
            return [];
        }
    }

    /**
     * Set real-time metrics
     * TTL: 5 minutes
     */
    async setMetrics(metrics: RedisMetrics): Promise<void> {
        try {
            const key = "metrics:realtime";
            await this.redis.hmset(key, {
                activeSessions: metrics.activeSessions.toString(),
                requestsPerMinute: metrics.requestsPerMinute.toString(),
                avgResponseTime: metrics.avgResponseTime.toString(),
                lastUpdated: metrics.lastUpdated,
            });
            await this.redis.expire(key, 300); // 5 minutes TTL
        } catch (error) {
            logger.error("[RedisSessionManager] Error setting metrics", { error });
        }
    }

    /**
     * Get real-time metrics
     */
    async getMetrics(): Promise<RedisMetrics | null> {
        try {
            const key = "metrics:realtime";
            const data = await this.redis.hgetall(key);

            if (!data || Object.keys(data).length === 0) {
                return null;
            }

            return {
                activeSessions: parseInt(data.activeSessions || "0"),
                requestsPerMinute: parseFloat(data.requestsPerMinute || "0"),
                avgResponseTime: parseFloat(data.avgResponseTime || "0"),
                lastUpdated: data.lastUpdated || new Date().toISOString(),
            };
        } catch (error) {
            logger.error("[RedisSessionManager] Error getting metrics", { error });
            return null;
        }
    }

    /**
     * Clear all session data (for testing/cleanup)
     */
    async clearAllSessions(): Promise<void> {
        try {
            const sessionKeys = await this.redis.keys("session:*");
            const tenantKeys = await this.redis.keys("tenant:*:sessions");
            const metricsKeys = await this.redis.keys("metrics:realtime");

            const allKeys = [...sessionKeys, ...tenantKeys, ...metricsKeys];

            if (allKeys.length > 0) {
                await this.redis.del(...allKeys);
            }
        } catch (error) {
            logger.error("[RedisSessionManager] Error clearing sessions", { error });
        }
    }
}

// Export singleton instance
export const redisSessionManager = RedisSessionManager.getInstance();
