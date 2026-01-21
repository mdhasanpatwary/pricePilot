import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";
import { QUEUE_NAMES } from "./types";

// Use global singleton to prevent creating multiple connections in dev mode HMR
const globalForQueues = global as unknown as {
  syncQueue?: Queue;
  notificationQueue?: Queue;
};

/**
 * Lazy-initialized Sync Queue
 */
export const getSyncQueue = () => {
  if (globalForQueues.syncQueue) return globalForQueues.syncQueue;

  const queue = new Queue(QUEUE_NAMES.SYNC, {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: 100, // Keep last 100 jobs
      removeOnFail: 500, // Keep last 500 failed jobs
    },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForQueues.syncQueue = queue;
  }
  return queue;
};

/**
 * Lazy-initialized Notification Queue
 */
export const getNotificationQueue = () => {
  if (globalForQueues.notificationQueue)
    return globalForQueues.notificationQueue;

  const queue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForQueues.notificationQueue = queue;
  }
  return queue;
};

/**
 * Schedules internal system tasks (maintenance, crons)
 * This should be called once during application/worker startup.
 */
export async function scheduleSystemTasks() {
  console.log("📅 Scheduling system maintenance tasks...");
  const syncQueue = getSyncQueue();
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
  console.log("✅ System maintenance tasks scheduled.");
}

// Deprecated: Exporting constants created side effects during build.
// Use getSyncQueue() and getNotificationQueue() instead.
export const syncQueue = null as any;
export const notificationQueue = null as any;
