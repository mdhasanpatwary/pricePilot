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

const adapter = new ScraperAdapter();

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
      await DomainRateLimiter.releaseConcurrency(domain);
    }
  }

  static async seedJobs(job: Job<ScrapeJobData>): Promise<void> {
    const batchSize = Math.max(50, Number(process.env.SCRAPE_SEED_BATCH_SIZE || 500));
    const now = new Date();

    const products = await prisma.product.findMany({
      where: {
        Site: { type: "COMPETITOR" },
        url: { not: null },
      },
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

    const { getScrapeQueue } = await import("@/lib/queue/client");
    const queue = getScrapeQueue();

    let seeded = 0;
    for (const p of products) {
      if (!p.url || !p.Site?.baseUrl) continue;
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

      await queue.add(
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
