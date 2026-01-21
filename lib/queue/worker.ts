import { Worker, Job } from "bullmq";
import { redisConnection } from "./connection";
import { QUEUE_NAMES, SyncJobData, NotificationJobData } from "./types";
import { SyncOrchestrator } from "@/lib/services/sync-orchestrator";

// Processor for Sync Jobs
const syncProcessor = async (job: Job<SyncJobData>) => {
  console.log(
    `[Worker] Processing Sync Job ${job.id} (Type: ${job.data.type})`,
  );

  try {
    if (job.data.type === "FULL") {
      if (!job.data.tenantId)
        throw new Error("TenantID required for full sync");
      // We assume SyncOrchestrator.runFullSync handles logic.
      // Note: You might need to adjust SyncOrchestrator to accept siteId vs tenantId specifically
      // But based on previous context, runFullSync usually takes a tenantId.
      await SyncOrchestrator.processFullSync(job.data.tenantId);
    } else if (job.data.type === "SINGLE") {
      if (!job.data.siteId) throw new Error("SiteID required for single sync");
      await SyncOrchestrator.processSiteSync(job.data.siteId);
    }
  } catch (error) {
    console.error(`[Worker] Job ${job.id} failed:`, error);
    throw error;
  }
};

// Processor for Notification Jobs (Placeholder)
const notificationProcessor = async (job: Job<NotificationJobData>) => {
  console.log(`[Worker] Processing Notification ${job.id}`);
  // Implementation for Email/Slack sending goes here
};

// Factory to create workers
export const createWorkers = () => {
  const syncWorker = new Worker(QUEUE_NAMES.SYNC, syncProcessor, {
    connection: redisConnection as any,
    concurrency: 2, // Process 2 syncs at a time per worker instance
  });

  const notificationWorker = new Worker(
    QUEUE_NAMES.NOTIFICATIONS,
    notificationProcessor,
    {
      connection: redisConnection as any,
      concurrency: 5,
    },
  );

  syncWorker.on("completed", (job) => {
    console.log(`[Worker] Sync Job ${job.id} completed!`);
  });

  syncWorker.on("failed", (job, err) => {
    console.error(`[Worker] Sync Job ${job?.id} failed: ${err.message}`);
  });

  return { syncWorker, notificationWorker };
};
