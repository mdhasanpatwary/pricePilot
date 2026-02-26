import { getSyncFullQueue, getSyncDeltaQueue, getScrapeHighPrioQueue, getScrapeLowPrioQueue, getNotificationQueue } from "@/lib/queue/client";
import { getRedisConnection } from "@/lib/queue/connection";
import { metricsCollector } from "./metrics-collector";
import { logger } from "@/lib/logger";

/**
 * Monitoring Service
 *
 * Coordinates high-level monitoring tasks like starvation detection
 * and automated queue health checks.
 */
export class MonitoringService {
    /**
     * Perform starvation detection across all critical queues.
     * Checks for jobs waiting longer than 1 hour.
     */
    static async detectStarvation(): Promise<void> {
        const queues = [
            { name: 'sync-full', queue: getSyncFullQueue() },
            { name: 'sync-delta', queue: getSyncDeltaQueue() },
            { name: 'scrape-high', queue: getScrapeHighPrioQueue() },
            { name: 'scrape-low', queue: getScrapeLowPrioQueue() },
            { name: 'notifications', queue: getNotificationQueue() },
        ];

        const STARVATION_THRESHOLD_MS = 3600 * 1000; // 1 hour
        const now = Date.now();

        for (const { name, queue } of queues) {
            try {
                // Get waiting jobs (limit to 1000 for sanity)
                const waitingJobs = await queue.getJobs(['waiting'], 0, 999, false);

                // Group by tenant to see if specific tenants are starved
                const tenantStarvations = new Map<string, number>();
                let totalStarved = 0;

                for (const job of waitingJobs) {
                    const age = now - (job.timestamp || now);
                    if (age > STARVATION_THRESHOLD_MS) {
                        const groupId = (job.opts as any).groupId as string | undefined;
                        const tenantId = groupId || job.data?.tenantId || 'system';
                        tenantStarvations.set(tenantId, (tenantStarvations.get(tenantId) || 0) + 1);
                        totalStarved++;
                    }
                }

                if (totalStarved > 0) {
                    logger.warn(`[MonitoringService] Detected ${totalStarved} starved jobs in queue ${name}`);

                    // Record system-wide starvation for this queue
                    await metricsCollector.recordQueueStarvation(name, totalStarved);

                    // Record per-tenant starvation if applicable
                    for (const [tenantId, count] of tenantStarvations.entries()) {
                        await metricsCollector.recordQueueStarvation(name, count, tenantId);
                    }
                }
            } catch (error) {
                logger.error(`[MonitoringService] Failed to detect starvation for queue ${name}`, {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }

    /**
     * Detect and cleanup "zombie" browser nodes from the cluster global semaphore.
     * Prunes nodes that haven't updated their individual heartbeat in the last 60 seconds.
     */
    static async cleanupZombieBrowsers(): Promise<void> {
        try {
            const redis = getRedisConnection();
            const key = "pp:browsers:active_nodes";
            const counts = await redis.hgetall(key);

            for (const instanceId of Object.keys(counts)) {
                const heartbeatKey = `pp:browsers:node_heartbeat:${instanceId}`;
                const exists = await redis.exists(heartbeatKey);

                if (!exists) {
                    logger.warn(`[MonitoringService] Pruning zombie browser node: ${instanceId}`);
                    await redis.hdel(key, instanceId);
                }
            }
        } catch (error) {
            logger.error(`[MonitoringService] Failed to cleanup zombie browsers`, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Record that a tenant is flooding the queue, creating backpressure.
     */
    static recordTenantFlood(queueName: string, tenantId: string, depth: number): void {
        logger.warn(`[MonitoringService] TENANT FLOOD WARNING: Tenant ${tenantId} is dominating ${queueName} with ${depth} jobs.`);
        metricsCollector.recordSyncLifecycle("system", "QUEUE", { reason: "FLOOD_WARNING", queueName, tenantId, depth }).catch(() => {});
    }
}
