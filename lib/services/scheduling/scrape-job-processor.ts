import { DelayedError, Job } from "bullmq";
import { ScrapeFailureType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { ScrapeJobData } from "@/lib/queue/types";
import { ScraperAdapter } from "@/lib/services/bot-protection/scraper-adapter";
import { VolatilityService } from "@/lib/services/scheduling/volatility-service";
import { DomainThrottleService } from "@/lib/services/scheduling/domain-throttle-service";
import { DomainRateLimiter } from "@/lib/services/scheduling/domain-rate-limiter";
import { ScrapeSchedulingService } from "@/lib/services/scheduling/scrape-scheduling";
import {
  TenantConcurrencyLimiter,
  TenantConcurrencyPermit,
} from "@/lib/services/scheduling/tenant-concurrency-limiter";
import {
  GlobalScrapeBudgetService,
  GlobalScrapePermit,
} from "@/lib/services/scheduling/global-scrape-budget";
import { enqueueWithBackpressure } from "@/lib/queue/backpressure";
import { shouldBlockSyncForAdvancedAccess } from "@/lib/services/advanced-access";

const adapter = new ScraperAdapter();
const tenantConcurrencyLimiter = new TenantConcurrencyLimiter();
const globalScrapeBudget = GlobalScrapeBudgetService.getInstance();
const logThrottleState = new Map<string, number>();

function shouldLogWithThrottle(key: string, windowMs: number): boolean {
  const now = Date.now();
  const last = logThrottleState.get(key) || 0;
  if (now - last < windowMs) return false;
  logThrottleState.set(key, now);
  return true;
}

function normalizeDomainFromBaseUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return baseUrl.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

export class ScrapeJobProcessor {
  private static async reschedule(job: Job<ScrapeJobData>, whenMs: number): Promise<never> {
    const ts = Math.max(Date.now(), Math.floor(whenMs));
    await job.moveToDelayed(ts, job.token);
    throw new DelayedError();
  }

  static async process(job: Job<ScrapeJobData>): Promise<void> {
    if (job.data.type === "SEED") {
      await this.seedJobs(job);
      return;
    }

    const startedAt = new Date();

    const product = await prisma.product.findUnique({
      where: { id: job.data.productId },
      select: {
        id: true,
        tenantId: true,
        siteId: true,
        url: true,
        inStock: true,
        businessPriority: true,
        consecutiveScrapeFailures: true,
        lastScrapeFailedAt: true,
        Site: { select: { id: true, baseUrl: true } },
        ProductVolatility: { select: { volatilityScore: true } },
      },
    });

    if (!product) {
      logger.warn("[ScrapeJobProcessor] Product not found, delaying", {
        productId: job.data.productId,
      });
      await this.reschedule(job, Date.now() + 6 * 60 * 60 * 1000);
      return;
    }

    if (!product.url || !product.Site?.baseUrl) {
      logger.warn("[ScrapeJobProcessor] Product missing URL/baseUrl, delaying", {
        productId: job.data.productId,
      });
      await this.reschedule(job, Date.now() + 6 * 60 * 60 * 1000);
    }

    const url = product.url!;
    const domain = normalizeDomainFromBaseUrl(product.Site.baseUrl);
    const tenantId = job.data.type === "SCRAPE_PRODUCT" ? job.data.tenantId : product.tenantId;

    if (!tenantId) {
      logger.warn("[ScrapeJobProcessor] Missing tenantId, delaying", {
        productId: job.data.productId,
      });
      await this.reschedule(job, Date.now() + 60_000);
      return;
    }

    const advancedGate = await shouldBlockSyncForAdvancedAccess({
      siteId: product.siteId,
      tenantId,
    });
    if (advancedGate.block) {
      const requeueDelayMs = 30 * 60 * 1000;
      if (shouldLogWithThrottle(`advanced-gate:${tenantId}:${product.siteId}`, 60_000)) {
        logger.info("[ScrapeJobProcessor] Advanced protection gate active, delaying scrape jobs", {
          tenantId,
          productId: product.id,
          siteId: product.siteId,
          missingRequirements: advancedGate.missingRequirements,
          delayMs: requeueDelayMs,
        });
      }
      await this.reschedule(job, Date.now() + requeueDelayMs);
      return;
    }

    const permit = await tenantConcurrencyLimiter.tryAcquire(tenantId);
    if (!permit) {
      const requeueDelayRaw = Number(process.env.SCRAPE_TENANT_CONCURRENCY_REQUEUE_DELAY_MS || "5000");
      const requeueDelayMs =
        Number.isFinite(requeueDelayRaw) && requeueDelayRaw >= 1000
          ? Math.floor(requeueDelayRaw)
          : 5000;

      if (shouldLogWithThrottle(`tenant-saturated:${tenantId}`, 15_000)) {
        logger.info("[ScrapeJobProcessor] Tenant concurrency saturated, delaying job", {
          tenantId,
          productId: product.id,
          maxPerTenant: tenantConcurrencyLimiter.getMaxPerTenant(),
          delayMs: requeueDelayMs,
        });
      }
      await this.reschedule(job, Date.now() + requeueDelayMs);
      return;
    }

    let heartbeatTimer: NodeJS.Timeout | null = null;
    const startPermitHeartbeat = (activePermit: TenantConcurrencyPermit) => {
      const heartbeatEveryMs = Math.max(10_000, Math.floor(tenantConcurrencyLimiter.getLeaseTtlMs() / 3));
      heartbeatTimer = setInterval(() => {
        void tenantConcurrencyLimiter.refresh(activePermit);
      }, heartbeatEveryMs);
    };

    startPermitHeartbeat(permit);

    try {
      // Domain adaptive throttling + per-domain concurrency.
      const throttle = await DomainThrottleService.get(domain);

      if (throttle.cooldownUntilMs && throttle.cooldownUntilMs > Date.now()) {
        await this.reschedule(job, throttle.cooldownUntilMs);
      }

      const acquired = await DomainRateLimiter.tryAcquireConcurrency({
        domain,
        maxConcurrent: throttle.maxConcurrent,
        ttlMs: 120_000,
      });
      if (!acquired) {
        await this.reschedule(job, Date.now() + 1000);
      }

      try {
        const waitMs = await DomainRateLimiter.takeIntervalPermit({
          domain,
          minIntervalMs: throttle.minIntervalMs,
        });
        if (waitMs > 0) {
          await this.reschedule(job, Date.now() + waitMs);
        }

        const qpsBudget = await globalScrapeBudget.consumeQpsToken();
        if (!qpsBudget.allowed) {
          const delayMs = Math.max(
            globalScrapeBudget.getRequeueDelayMs(),
            qpsBudget.retryAfterMs || 0,
          );
          logger.info("[ScrapeJobProcessor] Global scrape QPS budget exceeded, delaying job", {
            productId: product.id,
            tenantId,
            delayMs,
          });
          await this.reschedule(job, Date.now() + delayMs);
        }

        const activeBudget = await globalScrapeBudget.acquire(product.id);
        const globalPermit = activeBudget.permit;
        if (!activeBudget.acquired || !globalPermit) {
          const delayMs = Math.max(
            globalScrapeBudget.getRequeueDelayMs(),
            activeBudget.retryAfterMs || 0,
          );
          logger.info("[ScrapeJobProcessor] Global active scrape budget exhausted, delaying job", {
            productId: product.id,
            tenantId,
            currentActive: activeBudget.currentActive,
            maxActive: globalScrapeBudget.getMaxActive(),
            delayMs,
          });
          await this.reschedule(job, Date.now() + delayMs);
        }
        const activeGlobalPermit = globalPermit as GlobalScrapePermit;
        let globalHeartbeatTimer: NodeJS.Timeout | null = null;
        const globalHeartbeatEveryMs = Math.max(10_000, Math.floor(activeGlobalPermit.leaseTtlMs / 3));
        globalHeartbeatTimer = setInterval(() => {
          void globalScrapeBudget.refresh(activeGlobalPermit);
        }, globalHeartbeatEveryMs);

        try {
          // Execute scrape (this writes ScrapeAttempt + updates Product/PriceHistory).
          await adapter.scrapeCompetitorProduct(product.id, url, product.tenantId);

          const lastAttempt = await prisma.scrapeAttempt.findFirst({
            where: { competitorProductId: product.id },
            orderBy: { createdAt: "desc" },
            select: {
              success: true,
              failureType: true,
              statusCode: true,
            },
          });

          const success = Boolean(lastAttempt?.success);
          const failureType = (lastAttempt?.failureType ?? null) as ScrapeFailureType | null;
          const statusCode = lastAttempt?.statusCode ?? null;

          // Update volatility only after a successful scrape (and DB update).
          const volatility = success
            ? await VolatilityService.upsertForProduct(product.id)
            : { volatilityScore: product.ProductVolatility?.volatilityScore ?? 0, lastPriceChangeAt: null, priceChangeCount30d: 0 };

          // Update product scheduling state.
          const consecutiveFailures = success ? 0 : product.consecutiveScrapeFailures + 1;
          const lastFailedAt = success ? null : startedAt;
          const lastSucceededAt = success ? startedAt : null;

          const next = ScrapeSchedulingService.computeRefreshDecision(
            {
              volatilityScore: volatility.volatilityScore,
              inStock: product.inStock,
              consecutiveFailures,
              lastFailureType: failureType,
              domainPenaltyLevel: throttle.penaltyLevel,
            },
            startedAt,
          );

          const priority = ScrapeSchedulingService.computePriority({
            volatilityScore: volatility.volatilityScore,
            consecutiveFailures,
            lastFailedAt,
            inStock: product.inStock,
            businessPriority: product.businessPriority,
            domainPriorityPenalty: throttle.priorityPenalty,
          });

          await prisma.product.update({
            where: { id: product.id },
            data: {
              nextScrapeAt: next.nextScrapeAt,
              lastScrapeAttemptAt: startedAt,
              lastScrapeSucceededAt: lastSucceededAt ?? undefined,
              lastScrapeFailedAt: lastFailedAt ?? undefined,
              consecutiveScrapeFailures: consecutiveFailures,
            },
            select: { id: true },
          });

          await DomainThrottleService.recordAttempt({
            domain,
            success,
            failureType,
            statusCode,
          });

          await job.updateData({
            ...job.data,
            priorityScore: priority.priorityScore,
            lastScheduledAt: startedAt.toISOString(),
          });
          await job.changePriority({ priority: priority.bullmqPriority });
          await this.reschedule(job, next.nextScrapeAt.getTime());
        } finally {
          if (globalHeartbeatTimer) {
            clearInterval(globalHeartbeatTimer);
          }
          await globalScrapeBudget.release(activeGlobalPermit);
        }
      } finally {
        await DomainRateLimiter.releaseConcurrency(domain);
      }
    } finally {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      try {
        await tenantConcurrencyLimiter.release(permit);
      } catch (error) {
        logger.warn("[ScrapeJobProcessor] Failed to release tenant concurrency permit", {
          tenantId,
          productId: product.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  static async seedJobs(job: Job<ScrapeJobData>): Promise<void> {
    const batchSize = Math.max(50, Number(process.env.SCRAPE_SEED_BATCH_SIZE || 500));
    const now = new Date();

    const whereClause: any = {
      Site: { type: "COMPETITOR" },
      url: { not: null },
    };

    if (job.data.tenantId) {
      whereClause.tenantId = job.data.tenantId;
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      select: {
        id: true,
        tenantId: true,
        siteId: true,
        url: true,
        nextScrapeAt: true,
        inStock: true,
        businessPriority: true,
        consecutiveScrapeFailures: true,
        lastScrapeFailedAt: true,
        Site: { select: { baseUrl: true } },
        ProductVolatility: { select: { volatilityScore: true } },
      },
      orderBy: [{ nextScrapeAt: "asc" }, { updatedAt: "desc" }],
      take: batchSize,
    });

    const { getScrapeHighPrioQueue, getScrapeLowPrioQueue } = await import("@/lib/queue/client");

    let seeded = 0;
    for (const p of products) {
      if (!p.url || !p.Site?.baseUrl) continue;

      // Segregate traffic: High business priority goes to the high-concurrency/low-latency queue.
      const queue = p.businessPriority >= 5 ? getScrapeHighPrioQueue() : getScrapeLowPrioQueue();
      const domain = normalizeDomainFromBaseUrl(p.Site.baseUrl);
      const throttle = await DomainThrottleService.get(domain);

      const volatilityScore = p.ProductVolatility?.volatilityScore ?? 0;
      const priority = ScrapeSchedulingService.computePriority({
        volatilityScore,
        consecutiveFailures: p.consecutiveScrapeFailures,
        lastFailedAt: p.lastScrapeFailedAt,
        inStock: p.inStock,
        businessPriority: p.businessPriority,
        domainPriorityPenalty: throttle.priorityPenalty,
      });

      const nextAt = p.nextScrapeAt && p.nextScrapeAt > now ? p.nextScrapeAt : now;

      await enqueueWithBackpressure(
        queue,
        `SCRAPE:${p.id}`,
        {
          type: "SCRAPE_PRODUCT",
          tenantId: p.tenantId,
          productId: p.id,
          competitorWebsiteId: p.siteId,
          url: p.url,
          priorityScore: priority.priorityScore,
          lastScheduledAt: now.toISOString(),
        },
        {
          jobId: `scrape-${p.id}`,
          priority: priority.bullmqPriority,
          delay: Math.max(0, nextAt.getTime() - now.getTime()),
          removeOnFail: { count: 2000, age: 7 * 24 * 3600 },
        },
        {
          producer: "ScrapeJobProcessor.seedJobs",
          strategy: "delay",
          minDelayMs: 10_000,
          maxDelayMs: 180_000,
        },
      ).then(() => {
        seeded++;
      }).catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        // Duplicate jobId is expected if a job already exists.
        if (msg.includes("Job") && msg.includes("already exists")) return;
        logger.warn("[ScrapeJobProcessor] Failed to seed job", {
          productId: p.id,
          error: msg,
        });
      });
    }

    logger.info("[ScrapeJobProcessor] Seeded scrape jobs", {
      count: seeded,
      triggeredByJobId: job.id,
    });
  }
}
