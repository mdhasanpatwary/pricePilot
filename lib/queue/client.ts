import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";
import { QUEUE_NAMES } from "./types";

// Use global singleton to prevent creating multiple connections in dev mode HMR
const globalForQueues = global as unknown as {
  syncQueue?: Queue;
  notificationQueue?: Queue;
  scrapeQueue?: Queue;
};

/**
 * Lazy-initialized Sync Queue
 */
export const getSyncQueue = (): Queue => {
  return (globalForQueues.syncQueue ??= new Queue(QUEUE_NAMES.SYNC, {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 3, // Allow retries for transient networking errors
      backoff: {
        type: "exponential",
        delay: 10000, // Start with 10s backoff
      },
      removeOnComplete: {
        count: 500, // Keep more completed jobs for audit
        age: 24 * 3600, // Max 24 hours
      },
      removeOnFail: {
        count: 1000, // Detailed failure history for tech matching
        age: 7 * 24 * 3600, // Keep failures for a week
      },
    },
  }));
};

/**
 * Lazy-initialized Notification Queue
 */
export const getNotificationQueue = (): Queue => {
  return (globalForQueues.notificationQueue ??= new Queue(QUEUE_NAMES.NOTIFICATIONS, {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: { count: 100, age: 24 * 3600 },
      removeOnFail: { count: 500, age: 7 * 24 * 3600 },
    },
  }));
};

/**
 * Lazy-initialized Scrape Queue (product-level scraping)
 */
export const getScrapeQueue = (): Queue => {
  return (globalForQueues.scrapeQueue ??= new Queue(QUEUE_NAMES.SCRAPE, {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 1,
      removeOnFail: {
        count: 2000,
        age: 7 * 24 * 3600,
      },
      // Scrape jobs are long-lived (we reschedule via moveToDelayed),
      // so completion cleanup isn't relied upon.
    },
  }));
};

/**
 * Schedules internal system tasks (maintenance, crons)
 * This should be called once during application/worker startup.
 */
export async function scheduleSystemTasks() {
  console.log("📅 Scheduling system maintenance tasks...");
  const syncQueue = getSyncQueue();
  const scrapeQueue = getScrapeQueue();
  await syncQueue.add(
    "INTERNAL_MAINTENANCE",
    { type: "MAINTENANCE" },
    {
      repeat: {
        pattern: "0 3 * * *", // 3:00 AM every day
      },
      jobId: "system-maintenance", // Unique ID ensures only one instance is scheduled
    },
  );

  // Keep scrape queue hydrated with product jobs (best-effort).
  await scrapeQueue.add(
    "SCRAPE_SEED",
    { type: "SEED" },
    {
      repeat: {
        pattern: "*/10 * * * *", // every 10 minutes
      },
      jobId: "scrape-seed",
    },
  );
  console.log("✅ System maintenance tasks scheduled.");
}

// Deprecated: Exporting constants created side effects during build.
// Use getSyncQueue() and getNotificationQueue() instead.
export const syncQueue = null as any;
export const notificationQueue = null as any;
export const scrapeQueue = null as any;
