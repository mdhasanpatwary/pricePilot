import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";
import { QUEUE_NAMES } from "./types";

// Use global singleton to prevent creating multiple connections in dev mode HMR
const globalForQueues = global as unknown as {
  syncFullQueue?: Queue;
  syncDeltaQueue?: Queue;
  notificationQueue?: Queue;
  scrapeHighQueue?: Queue;
  scrapeLowQueue?: Queue;
};

/**
 * Lazy-initialized Full Sync Queue
 */
export const getSyncFullQueue = (): Queue => {
  return (globalForQueues.syncFullQueue ??= new Queue(QUEUE_NAMES.SYNC_FULL, {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 30000 },
      removeOnComplete: { count: 100, age: 24 * 3600 },
      removeOnFail: { count: 500, age: 7 * 24 * 3600 },
    },
  }));
};

/**
 * Lazy-initialized Delta Sync Queue
 */
export const getSyncDeltaQueue = (): Queue => {
  return (globalForQueues.syncDeltaQueue ??= new Queue(QUEUE_NAMES.SYNC_DELTA, {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 1000, age: 3600 },
      removeOnFail: { count: 1000, age: 3 * 24 * 3600 },
    },
  }));
};

/**
 * @deprecated Use getSyncFullQueue or getSyncDeltaQueue
 */
export const getSyncQueue = getSyncFullQueue;

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
 * Lazy-initialized High-Priority Scrape Queue (recent products)
 */
export const getScrapeHighPrioQueue = (): Queue => {
  return (globalForQueues.scrapeHighQueue ??= new Queue(QUEUE_NAMES.SCRAPE_HIGH_PRIO, {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2, // Slight more retry for high-prio
      backoff: { type: "exponential", delay: 10000 },
      removeOnFail: { count: 1000, age: 7 * 24 * 3600 },
    },
  }));
};

/**
 * Lazy-initialized Low-Priority Scrape Queue (background maintenance)
 */
export const getScrapeLowPrioQueue = (): Queue => {
  return (globalForQueues.scrapeLowQueue ??= new Queue(QUEUE_NAMES.SCRAPE_LOW_PRIO, {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 1,
      removeOnFail: { count: 5000, age: 7 * 24 * 3600 },
    },
  }));
};

/**
 * @deprecated Use getScrapeHighPrioQueue or getScrapeLowPrioQueue
 */
export const getScrapeQueue = getScrapeHighPrioQueue;

/**
 * Schedules internal system tasks (maintenance, crons)
 * This should be called once during application/worker startup.
 */
export async function scheduleSystemTasks() {
  console.log("📅 Scheduling system maintenance tasks...");
  const syncQueue = getSyncQueue();
  const scrapeLowQueue = getScrapeLowPrioQueue();

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

  // SEED jobs go to LOW_PRIORITY as they are background tasks
  await scrapeLowQueue.add(
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
