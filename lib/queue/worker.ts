import { Worker, Job } from "bullmq";
import { getRedisConnection } from "./connection";
import { QUEUE_NAMES, SyncJobData, NotificationJobData, ScrapeJobData } from "./types";
import { SyncOrchestrator } from "@/lib/services/sync-orchestrator";
import { ScrapeJobProcessor } from "@/lib/services/scheduling/scrape-job-processor";
import { OperationalMetricsService } from "@/lib/services/observability/operational-metrics";

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
      await SyncOrchestrator.processFullSync(job.data.tenantId, job.data.isCron);
    } else if (job.data.type === "SINGLE") {
      if (!job.data.siteId) throw new Error("SiteID required for single sync");
      await SyncOrchestrator.processSiteSync(job.data.siteId, job.data.force, job.data.isCron);
    } else if (job.data.type === "CHUNK") {
      if (!job.data.siteId || !job.data.productIds)
        throw new Error("Missing data for chunk sync");
      await SyncOrchestrator.processChunkSync(
        job.data.siteId,
        job.data.productIds,
      );
    } else if (job.data.type === "SOURCE_SYNC") {
      if (!job.data.siteId) throw new Error("SiteID required for source sync");
      const { SyncService } = await import("@/lib/services/sync");
      await SyncService.syncSite(job.data.siteId);
    } else if (job.data.type === "RETRY") {
       if (!job.data.siteId || !job.data.productIds) throw new Error("Missing data for retry sync");
       await SyncOrchestrator.processRetrySync(job.data.siteId, job.data.productIds);
    } else if (job.data.type === "PRODUCT") {
      if (!job.data.productId) throw new Error("ProductID required for product sync");
      await SyncOrchestrator.syncProduct(job.data.productId);
    } else if (job.data.type === "MAINTENANCE") {
      const { MaintenanceService } = await import("@/lib/services/maintenance");
      await MaintenanceService.runDataRetention();
    }
  } catch (error) {
    console.error(`[Worker] Job ${job.id} failed:`, error);
    throw error;
  }
};

// Processor for Notification Jobs
const notificationProcessor = async (job: Job<NotificationJobData>) => {
  const { type, payload, recipient } = job.data;
  console.log(`[Worker] Processing Notification ${job.id} (Type: ${type})`);

  const { NotificationSender } =
    await import("@/lib/services/notification-sender");

  try {
    if (type === "EMAIL") {
      const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const fullLink = payload.link ? `${appUrl}${payload.link}` : appUrl;

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #0070f3; margin-top: 0;">${payload.title}</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.5;">${payload.message}</p>
          ${
            payload.link
              ? `<a href="${fullLink}" style="display: inline-block; background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">View in Dashboard</a>`
              : ""
          }
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">This is an automated message from PricePilot. Please do not reply.</p>
        </div>
      `;
      await NotificationSender.sendEmail(recipient, payload.title, html);
    } else if (type === "WEBHOOK") {
      const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const fullLink = payload.link ? `${appUrl}${payload.link}` : "";

      const slackText = `🔔 *${payload.title}*\n${payload.message}${fullLink ? `\n<${fullLink}|Open Dashboard>` : ""}`;
      await NotificationSender.sendSlack(slackText, payload.tenantId);
    } else if (type === "CUSTOM_WEBHOOK") {
      await NotificationSender.sendCustomWebhook(recipient, payload);
    }
  } catch (error) {
    console.error(`[Worker] Notification ${job.id} failed:`, error);
    throw error;
  }
};

import os from "os";

// Factory to create workers
export const createWorkers = () => {
  const cpus = os.cpus().length;
  const totalMemMb = Math.floor(os.totalmem() / 1024 / 1024);

  // CONCURRENCY STRATEGY:
  // 1. Sync Worker: Scraping is CPU and RAM intensive.
  //    - Rule: 1 task per 512MB RAM, or 1 per CPU core, whichever is lower.
  //    - Min: 1, Max: total CPUs.
  //    - Safe Default: 0.5 * CPUs
  const memBasedSync = Math.floor(totalMemMb / 512);
  const computedSyncConcurrency = Math.max(
    1,
    Math.min(cpus, Math.floor(cpus * 0.5), memBasedSync),
  );
  const configuredSyncConcurrency = Number(process.env.SYNC_CONCURRENCY || 0);
  const configuredDevCap = Number(process.env.SYNC_CONCURRENCY_DEV_MAX || 1);
  const safeDevSyncCap =
    Number.isFinite(configuredDevCap) && configuredDevCap > 0
      ? Math.floor(configuredDevCap)
      : 1;
  const syncConcurrency = configuredSyncConcurrency > 0
    ? configuredSyncConcurrency
    : process.env.NODE_ENV === "production"
      ? computedSyncConcurrency
      : Math.min(computedSyncConcurrency, safeDevSyncCap);

  // Global cap for scraping workers. This applies to the scrape worker directly,
  // and also caps sync worker concurrency to avoid oversubscription on small hosts.
  const maxGlobalWorkers = Number(process.env.MAX_GLOBAL_WORKERS || 0);
  const globalCap =
    Number.isFinite(maxGlobalWorkers) && maxGlobalWorkers > 0
      ? Math.floor(maxGlobalWorkers)
      : null;

  const cappedSyncConcurrency = globalCap ? Math.min(syncConcurrency, globalCap) : syncConcurrency;

  // 2. Notification Worker: I/O intensive, lightweight.
  //    - Rule: 5 tasks per CPU core.
  const notificationConcurrency = Number(
    process.env.NOTIFICATION_CONCURRENCY || Math.max(5, cpus * 5),
  );

  const syncWorker = new Worker(QUEUE_NAMES.SYNC, syncProcessor, {
    connection: getRedisConnection() as any,
    concurrency: cappedSyncConcurrency,
    lockDuration: 3600000, // 1 hour - ensures long-running discovery of 200+ products doesn't trigger a stall retry
  });

  const computedScrapeConcurrency = Math.max(1, Math.min(cpus, Math.floor(cpus * 0.75)));
  const configuredScrapeConcurrency = Number(process.env.SCRAPE_CONCURRENCY || 0);
  const scrapeConcurrencyUncapped =
    configuredScrapeConcurrency > 0 ? configuredScrapeConcurrency : computedScrapeConcurrency;
  const scrapeConcurrency = globalCap ? Math.min(scrapeConcurrencyUncapped, globalCap) : scrapeConcurrencyUncapped;

  const scrapeProcessor = async (job: Job<ScrapeJobData>) => {
    await ScrapeJobProcessor.process(job);
  };

  const scrapeWorker = new Worker(QUEUE_NAMES.SCRAPE, scrapeProcessor, {
    connection: getRedisConnection() as any,
    concurrency: scrapeConcurrency,
    lockDuration: 10 * 60 * 1000,
  });

  const notificationWorker = new Worker(
    QUEUE_NAMES.NOTIFICATIONS,
    notificationProcessor,
    {
      connection: getRedisConnection() as any,
      concurrency: notificationConcurrency,
    },
  );

  // Attach concurrency for logging purposes in scripts
  (syncWorker as any).concurrencyValue = cappedSyncConcurrency;
  (scrapeWorker as any).concurrencyValue = scrapeConcurrency;
  (notificationWorker as any).concurrencyValue = notificationConcurrency;

  syncWorker.on("completed", (job) => {
    console.log(`[Worker] Sync Job ${job.id} completed!`);
    void OperationalMetricsService.recordQueueLifecycle(QUEUE_NAMES.SYNC, "completed", job.data.tenantId);
  });

  syncWorker.on("failed", (job, err) => {
    console.error(`[Worker] Sync Job ${job?.id} failed: ${err.message}`);
    void OperationalMetricsService.recordQueueLifecycle(QUEUE_NAMES.SYNC, "failed", job?.data?.tenantId);
  });

  syncWorker.on("active", (job) => {
    const latencyMs = Math.max(0, Date.now() - (job.timestamp || Date.now()));
    void OperationalMetricsService.recordQueueLifecycle(
      QUEUE_NAMES.SYNC,
      "active",
      job.data.tenantId,
      latencyMs,
    );
  });

  scrapeWorker.on("completed", (job) => {
    console.log(`[Worker] Scrape Job ${job.id} completed!`);
    void OperationalMetricsService.recordQueueLifecycle(QUEUE_NAMES.SCRAPE, "completed", job.data.type === "SCRAPE_PRODUCT" ? job.data.tenantId : undefined);
  });

  scrapeWorker.on("failed", (job, err) => {
    console.error(`[Worker] Scrape Job ${job?.id} failed: ${err.message}`);
    void OperationalMetricsService.recordQueueLifecycle(
      QUEUE_NAMES.SCRAPE,
      "failed",
      job?.data?.type === "SCRAPE_PRODUCT" ? job.data.tenantId : undefined,
    );
  });

  scrapeWorker.on("active", (job) => {
    const latencyMs = Math.max(0, Date.now() - (job.timestamp || Date.now()));
    void OperationalMetricsService.recordQueueLifecycle(
      QUEUE_NAMES.SCRAPE,
      "active",
      job.data.type === "SCRAPE_PRODUCT" ? job.data.tenantId : undefined,
      latencyMs,
    );
  });

  notificationWorker.on("completed", () => {
    void OperationalMetricsService.recordQueueLifecycle(QUEUE_NAMES.NOTIFICATIONS, "completed");
  });

  notificationWorker.on("failed", () => {
    void OperationalMetricsService.recordQueueLifecycle(QUEUE_NAMES.NOTIFICATIONS, "failed");
  });

  notificationWorker.on("active", (job) => {
    const latencyMs = Math.max(0, Date.now() - (job.timestamp || Date.now()));
    void OperationalMetricsService.recordQueueLifecycle(
      QUEUE_NAMES.NOTIFICATIONS,
      "active",
      undefined,
      latencyMs,
    );
  });

  return { syncWorker, scrapeWorker, notificationWorker };
};
