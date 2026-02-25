import { getSyncFullQueue, getSyncDeltaQueue, getScrapeHighPrioQueue, getScrapeLowPrioQueue, getNotificationQueue } from "@/lib/queue/client";
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
                        const tenantId = job.opts.groupId || job.data?.tenantId || 'system';
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
}
