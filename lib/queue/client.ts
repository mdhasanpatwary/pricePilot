import { Queue } from "bullmq";
import { redisConnection } from "./connection";
import { QUEUE_NAMES } from "./types";

// Use global singleton to prevent creating multiple connections in dev mode HMR
const globalForQueues = global as unknown as {
  syncQueue?: Queue;
  notificationQueue?: Queue;
};

export const syncQueue =
  globalForQueues.syncQueue ||
  new Queue(QUEUE_NAMES.SYNC, {
    connection: redisConnection as any,
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

export const notificationQueue =
  globalForQueues.notificationQueue ||
  new Queue(QUEUE_NAMES.NOTIFICATIONS, {
    connection: redisConnection as any,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForQueues.syncQueue = syncQueue;
  globalForQueues.notificationQueue = notificationQueue;
}

/**
 * Schedules internal system tasks (maintenance, crons)
 * This should be called once during application/worker startup.
 */
export async function scheduleSystemTasks() {
  console.log("📅 Scheduling system maintenance tasks...");
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
