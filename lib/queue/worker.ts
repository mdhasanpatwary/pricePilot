import { Worker, Job } from "bullmq";
import { getRedisConnection } from "./connection";
import { QUEUE_NAMES } from "@/lib/queue/types";
import { SyncJobData, NotificationJobData, ScrapeJobData } from "./types";
import { SyncOrchestrator } from "@/lib/services/sync-orchestrator";
import { ScrapeJobProcessor } from "@/lib/services/scheduling/scrape-job-processor";
import { OperationalMetricsService } from "@/lib/services/observability/operational-metrics";
import { decrementTenantQueueDepth } from "./backpressure";

const TENANT_ACTIVE_JOBS_PREFIX = "pp:queue:tenant:active:";

const TIER_CONCURRENCY_LIMITS: Record<string, number> = {
  PRO: 15,    // Tier Pro
  PREMIUM: 8, // Tier Premium
  BASIC: 3,   // Tier Basic
  system: 50, // System tasks
};

async function getTenantConcurrencyLimit(tenantId: string): Promise<number> {
  if (tenantId === "system") return TIER_CONCURRENCY_LIMITS.system;

  const redis = getRedisConnection();
  const cacheKey = `pp:tier:limit:${tenantId}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) return parseInt(cached);

  try {
    // Fetch from DB
    const { getCachedTenantPlan } = await import("@/lib/tenant/cached-tenant");
    const plan = await getCachedTenantPlan(tenantId);

    const limit = TIER_CONCURRENCY_LIMITS[plan || "BASIC"] || TIER_CONCURRENCY_LIMITS.BASIC;

    // Cache for 10 mins
    await redis.set(cacheKey, limit, "EX", 600);
    return limit;
  } catch (err) {
    console.error(`[Worker] Failed to fetch tier for tenant ${tenantId}, falling back to BASIC limit`, err);
    return TIER_CONCURRENCY_LIMITS.BASIC;
  }
}

async function tryAcquireTenantSlot(queueName: string, tenantId: string): Promise<boolean> {
  const redis = getRedisConnection();
  const key = `${TENANT_ACTIVE_JOBS_PREFIX}${queueName}:${tenantId}`;

  const limit = await getTenantConcurrencyLimit(tenantId);

  // Atomic increment and check
  const current = await redis.incr(key);
  await redis.expire(key, 3600); // 1h safety expiry

  if (current > limit) {
    // Exceeded, rollback the increment
    await redis.decr(key);
    return false;
  }
  return true;
}

async function decrementTenantActive(queueName: string, tenantId: string): Promise<void> {
  const redis = getRedisConnection();
  const key = `${TENANT_ACTIVE_JOBS_PREFIX}${queueName}:${tenantId}`;
  const val = await redis.decr(key);
  if (val < 0) await redis.set(key, 0);
}

// Processor for Sync Jobs
const syncProcessor = async (job: Job<SyncJobData>) => {
  const { data } = job;
  const tenantId = data.tenantId || "system";
  console.log(
    `[Worker] Processing Sync Job ${job.id} (Tenant: ${tenantId}, Type: ${job.data.type})`,
  );

  // 1. Enforce Per-Tenant Concurrency (Atomic)
  if (!(await tryAcquireTenantSlot(job.queueName, tenantId))) {
     console.warn(`[Worker] Tenant ${tenantId} reached concurrency limit on ${job.queueName}. Deferring job.`);
     throw new Error("TENANT_CONCURRENCY_LIMIT_REACHED");
  }

  try {
    if (job.data.type === "FULL") {
      await SyncOrchestrator.processFullSync(job.data.tenantId, job.data.isCron);
    } else if (job.data.type === "SINGLE") {
      if (!job.data.siteId) throw new Error("SiteID required for single sync");
      await SyncOrchestrator.processSiteSync(job.data.siteId, job.data.force, job.data.isCron);
    } else if (job.data.type === "CHUNK") {
      if (!job.data.siteId || !job.data.productIds)
        throw new Error("Missing data for chunk sync");
      await SyncOrchestrator.processChunkSync(job.data.siteId, job.data.productIds);
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
  } finally {
    // Always decrement active count on exit
    await decrementTenantActive(job.queueName, tenantId);
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
          ${payload.link
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

  // 1. Sync Strategy:
  // - Sync FULL: High memory, lower concurrency (reserved for big discovery)
  // - Sync DELTA: Lightweight, high concurrency
  const syncFullConcurrency = Math.max(1, Math.floor(cpus * 0.25));
  const syncDeltaConcurrency = Math.max(2, Math.floor(cpus * 0.5));

  const syncFullWorker = new Worker(QUEUE_NAMES.SYNC_FULL, syncProcessor, {
    connection: getRedisConnection() as any,
    concurrency: syncFullConcurrency,
    lockDuration: 30 * 60 * 1000,
    maxStalledCount: 2,
  });

  const syncDeltaWorker = new Worker(QUEUE_NAMES.SYNC_DELTA, syncProcessor, {
    connection: getRedisConnection() as any,
    concurrency: syncDeltaConcurrency,
    lockDuration: 60 * 1000,
    maxStalledCount: 2,
  });

  // 2. Scrape Strategy
  const maxGlobalWorkers = Number(process.env.MAX_GLOBAL_WORKERS || 0);
  const globalCap = Number.isFinite(maxGlobalWorkers) && maxGlobalWorkers > 0 ? Math.floor(maxGlobalWorkers) : null;
  const computedScrapeConcurrency = Math.max(1, Math.min(cpus, Math.floor(cpus * 0.75)));
  const configuredScrapeConcurrency = Number(process.env.SCRAPE_CONCURRENCY || 0);
  const scrapeConcurrencyUncapped = configuredScrapeConcurrency > 0 ? configuredScrapeConcurrency : computedScrapeConcurrency;
  const scrapeConcurrency = globalCap ? Math.min(scrapeConcurrencyUncapped, globalCap) : scrapeConcurrencyUncapped;

  const scrapeProcessor = async (job: Job<ScrapeJobData>) => {
    // Also enforce concurrency here if needed, but ScrapeJobProcessor handles its own lock logic usually.
    // However, for consistency with our fair-share goals:
    const tenantId = job.data.type === "SCRAPE_PRODUCT" ? job.data.tenantId : "system";
    if (!(await tryAcquireTenantSlot(job.queueName, tenantId))) {
       throw new Error("TENANT_CONCURRENCY_LIMIT_REACHED");
    }

    try {
      await ScrapeJobProcessor.process(job);
    } finally {
      await decrementTenantActive(job.queueName, tenantId);
    }
  };

  const scrapeHighWorker = new Worker(QUEUE_NAMES.SCRAPE_HIGH_PRIO, scrapeProcessor, {
    connection: getRedisConnection() as any,
    concurrency: Math.max(1, Math.floor(scrapeConcurrency * 0.7)),
    lockDuration: 30 * 60 * 1000,
    maxStalledCount: 2,
  });

  const scrapeLowWorker = new Worker(QUEUE_NAMES.SCRAPE_LOW_PRIO, scrapeProcessor, {
    connection: getRedisConnection() as any,
    concurrency: Math.max(1, Math.floor(scrapeConcurrency * 0.3)),
    lockDuration: 60 * 60 * 1000, // Background tasks can take longer
    maxStalledCount: 1,
  });

  // 3. Notification Strategy
  const notificationConcurrency = Number(process.env.NOTIFICATION_CONCURRENCY || Math.max(5, cpus * 5));
  const notificationWorker = new Worker(QUEUE_NAMES.NOTIFICATIONS, notificationProcessor, {
    connection: getRedisConnection() as any,
    concurrency: notificationConcurrency,
  });

  // Attach concurrency for logging
  (syncFullWorker as any).concurrencyValue = syncFullConcurrency;
  (syncDeltaWorker as any).concurrencyValue = syncDeltaConcurrency;
  (scrapeHighWorker as any).concurrencyValue = Math.max(1, Math.floor(scrapeConcurrency * 0.7));
  (scrapeLowWorker as any).concurrencyValue = Math.max(1, Math.floor(scrapeConcurrency * 0.3));
  (notificationWorker as any).concurrencyValue = notificationConcurrency;

  const registerEvents = (worker: Worker, queueName: string) => {
    worker.on("completed", async (job) => {
      console.log(`[Worker] ${queueName} Job ${job.id} completed!`);
      const tenantId = job.data.tenantId || (job.data.type === "SCRAPE_PRODUCT" ? job.data.tenantId : undefined);
      if (tenantId) await decrementTenantQueueDepth(queueName, tenantId);
      void OperationalMetricsService.recordQueueLifecycle(queueName, "completed", tenantId);
    });

    worker.on("failed", async (job, err) => {
      console.error(`[Worker] ${queueName} Job ${job?.id} failed: ${err.message}`);
      const tenantId = job?.data?.tenantId || (job?.data?.type === "SCRAPE_PRODUCT" ? job.data.tenantId : undefined);
      if (tenantId) await decrementTenantQueueDepth(queueName, tenantId);
      void OperationalMetricsService.recordQueueLifecycle(queueName, "failed", tenantId);
    });

    worker.on("active", (job) => {
      const tenantId = job.data.tenantId || (job.data.type === "SCRAPE_PRODUCT" ? job.data.tenantId : undefined);
      const latencyMs = Math.max(0, Date.now() - (job.timestamp || Date.now()));
      void OperationalMetricsService.recordQueueLifecycle(queueName, "active", tenantId, latencyMs);
    });
  };

  registerEvents(syncFullWorker, QUEUE_NAMES.SYNC_FULL);
  registerEvents(syncDeltaWorker, QUEUE_NAMES.SYNC_DELTA);
  registerEvents(scrapeHighWorker, QUEUE_NAMES.SCRAPE_HIGH_PRIO);
  registerEvents(scrapeLowWorker, QUEUE_NAMES.SCRAPE_LOW_PRIO);
  registerEvents(notificationWorker, QUEUE_NAMES.NOTIFICATIONS);

  return {
    syncFullWorker,
    syncDeltaWorker,
    scrapeHighWorker,
    scrapeLowWorker,
    notificationWorker
  };
};
