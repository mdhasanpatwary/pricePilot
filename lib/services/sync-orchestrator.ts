import { ScrapeBlockError } from "./scraper";
import { detectPriceAnomaly } from "./price-anomaly";
import { RulesEngine } from "./rules-engine";
import { DiscoveryService } from "./discovery";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "./notification";
import { SystemConfigService } from "@/lib/config";
import { getSyncQueue } from "@/lib/queue/client";
import { getRedisConnection } from "@/lib/queue/connection";
import { QUEUE_NAMES } from "@/lib/queue/types";
import { logger } from "../logger";
import { CacheInvalidationService } from "./cache-invalidation";
import { AutoApprovalService } from "./auto-approval";
import { withDbRetry } from "@/lib/utils/db-retry";
import { metricsCollector } from "@/lib/services/monitoring/metrics-collector";
import { scrapeLogger } from "./scrape-logger";
import { enqueueWithBackpressure } from "@/lib/queue/backpressure";
import { ScrapingEngineService } from "@/lib/services/scraping-engine-service";
import {
  markSiteAsAdvancedProtected,
  shouldBlockSyncForAdvancedAccess,
} from "@/lib/services/advanced-access";

export class SyncOrchestrator {
  private static readonly RETRY_SITE_LOCK_TTL_MS = 10 * 60 * 1000;

  private static sanitizeQueueSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  private static buildRetryJobId(siteId: string, productId: string, attempt: number): string {
    return `retry-${this.sanitizeQueueSegment(siteId)}-${this.sanitizeQueueSegment(productId)}-a${attempt}`;
  }

  private static getRetrySiteLockKey(siteId: string): string {
    return `pp:lock:retry-site:${this.sanitizeQueueSegment(siteId)}`;
  }

  private static getRetrySiteLockTtlMs(): number {
    const raw = Number(process.env.SYNC_RETRY_SITE_LOCK_TTL_MS || this.RETRY_SITE_LOCK_TTL_MS);
    return Number.isFinite(raw) && raw >= 30_000 ? Math.floor(raw) : this.RETRY_SITE_LOCK_TTL_MS;
  }

  private static getRetryBackoffMinutes(retryCount: number, isAdvancedBlock: boolean): number {
    const baseMinutes = isAdvancedBlock ? 30 : 20;
    const exponential = baseMinutes * Math.pow(2, retryCount);
    const jitter = Math.floor(Math.random() * 11); // 0-10 minutes
    return Math.min(240, exponential + jitter); // Cap at 4 hours
  }

  /**
   * Check if current time is off-peak (NIGHT: 10 PM to 6 AM)
   */
  private static isOffPeak(): boolean {
    const hour = new Date().getHours();
    return hour >= 22 || hour < 6;
  }

  /**
   * Handle an advanced security block by switching to Golden Rule mode
   */
  private static async handleSecurityBlock(siteId: string, tenantId: string, siteName: string, productCount: number) {
    await markSiteAsAdvancedProtected({
      siteId,
      tenantId,
      reason: "Advanced security block detected during sync",
    }).catch(async () => {
      await (prisma.site as any).update({
        where: { id: siteId },
        data: {
          isAdvancedProtected: true,
          lastSecurityBlockAt: new Date()
        }
      });
    });

    // ETA: 12s average * products
    const etaSeconds = productCount * 12;
    const etaMinutes = Math.ceil(etaSeconds / 60);
    const etaString = etaMinutes > 60
      ? `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m`
      : `${etaMinutes}m`;

    await NotificationService.sendSecurityNotice(tenantId, siteName, etaString);

    await scrapeLogger.log({
      siteId,
      message: `🚨 Advanced protection detected. Sync halted until proxy + captcha solver are configured (estimated prior runtime: ~${etaString}).`,
      level: "WARNING"
    });
  }

  /**
   * Dispatch a full sync job to the queue
   */
  static async dispatchFullSync(tenantId: string) {
    // Check if sync is already running to provide immediate feedback (UX)
    const activeSyncs = await prisma.site.count({
      where: {
        tenantId,
        type: "COMPETITOR",
        isSyncing: true,
      },
    });

    if (activeSyncs > 0) {
      return {
        success: true,
        message: "Full sync already in progress",
        skipped: true,
      };
    }

    await enqueueWithBackpressure(
      getSyncQueue(),
      QUEUE_NAMES.SYNC,
      {
        type: "FULL",
        tenantId,
      },
      { priority: 5 },
      { producer: "SyncOrchestrator.dispatchFullSync", strategy: "reject" },
    ); // Lowest priority for mass background syncs
    return { success: true, message: "Full sync job queued successfully." };
  }

  /**
   * Dispatch a single site sync job to the queue
   */
  static async dispatchSiteSync(siteId: string, force: boolean = false) {
    const { getSyncQueue } = await import("@/lib/queue/client");
    await enqueueWithBackpressure(
      getSyncQueue(),
      QUEUE_NAMES.SYNC,
      {
        type: "SINGLE",
        siteId,
        force,
      },
      { priority: 2 },
      { producer: "SyncOrchestrator.dispatchSiteSync", strategy: "reject" },
    ); // Higher priority for user-triggered single site syncs

    // Record QUEUE event
    metricsCollector.recordSyncLifecycle(siteId, 'QUEUE', { force, source: 'dispatchSiteSync' }).catch(console.error);

    return { success: true, message: "Site sync job queued successfully." };
  }

  /**
   * Dispatch a single product sync job to the queue
   */
  static async dispatchProductSync(productId: string) {
    const { getSyncQueue } = await import("@/lib/queue/client");
    await enqueueWithBackpressure(
      getSyncQueue(),
      QUEUE_NAMES.SYNC,
      {
        type: "PRODUCT",
        productId,
      },
      { priority: 1 },
      { producer: "SyncOrchestrator.dispatchProductSync", strategy: "reject" },
    ); // Highest priority for manual one-off syncs
    return { success: true, message: "Product sync job queued successfully." };
  }

  /**
   * Run a full sync for a tenant (Executed by Worker)
   */
  static async processFullSync(tenantId: string, isCron: boolean = false) {
    const isKilled = await SystemConfigService.get(
      "SYNC_MASTER_KILL_SWITCH",
      false,
    );
    if (isKilled) {
      logger.warn(
        "[SyncOrchestrator] Full sync aborted: Master Kill Switch is ON.",
      );
      return { success: false, message: "Sync globally disabled" };
    }

    logger.info(
      `[SyncOrchestrator] Starting full sync for tenant: ${tenantId}`,
    );

    const syncSessionStart = new Date();
    logger.info(
      `[SyncOrchestrator] Attempting to acquire sync locks for tenant ${tenantId}`,
    );

    // Mark only idle sites as syncing to avoid hijacking active individual crawls
    const lockResult = await prisma.site.updateMany({
      where: {
        tenantId,
        type: "COMPETITOR",
        isSyncing: false,
      },
      data: {
        isSyncing: true,
        syncStartedAt: syncSessionStart,
      },
    });

    if (lockResult.count === 0) {
      // Check if it's because all are syncing or if they just don't exist
      const totalCompetitors = await prisma.site.count({
        where: { tenantId, type: "COMPETITOR" },
      });

      if (totalCompetitors === 0) {
        logger.info(
          `[SyncOrchestrator] No competitor sites found for tenant ${tenantId}.`,
        );
        return {
          success: true,
          message:
            "No competitor sites found. Add some competitors to start syncing.",
          skipped: true,
        };
      }

      logger.info(
        `[SyncOrchestrator] All ${totalCompetitors} competitor sites for tenant ${tenantId} are already syncing.`,
      );
      return {
        success: true,
        message: "Full sync already in progress for all sites",
        skipped: true,
      };
    }

    logger.info(
      `[SyncOrchestrator] Acquired locks for ${lockResult.count} sites.`,
    );

    try {
      // 0. Run Discovery for all competitor sites belonging to this session
      const competitorSites = await prisma.site.findMany({
        where: {
          tenantId,
          type: "COMPETITOR",
          syncStartedAt: syncSessionStart, // Only sites we just starting in this run
        },
      });

      // Clear previous logs for all competitor sites before starting new session
      for (const site of competitorSites) {
        await prisma.syncLog.deleteMany({ where: { siteId: site.id } });
      }

      for (const site of competitorSites) {
        // Optimization: Instead of doing everything here, dispatch individual jobs
        // to the queue so multiple workers can pick them up in parallel.
        await enqueueWithBackpressure(
          getSyncQueue(),
          QUEUE_NAMES.SYNC,
          {
            type: "SINGLE",
            siteId: site.id,
            isCron: isCron,
          },
          {
            jobId: `sync-${site.id}-${syncSessionStart.getTime()}`,
            priority: isCron ? 4 : 2,
          },
          {
            producer: "SyncOrchestrator.processFullSync",
            strategy: "delay",
            minDelayMs: 15_000,
            maxDelayMs: 180_000,
          },
        );

        // Record QUEUE for each site in full sync
        metricsCollector.recordSyncLifecycle(site.id, 'QUEUE', { source: 'fullSync', isCron }).catch(console.error);
      }

      await scrapeLogger.log({
        siteId: competitorSites[0]?.id || "", // Just use first for generic log
        message: `📊 Distributed ${competitorSites.length} site sync jobs to worker cluster.`,
        level: "INFO",
      });

      return { success: true, dispatched: competitorSites.length };
    } catch (error) {
      logger.error("[SyncOrchestrator] Sync failed fatally:", { error });
      await NotificationService.sendSyncError(
        tenantId,
        `Fatal sync error: ${error instanceof Error ? error.message : "Internal service failure"}`,
      );

      // Cleanup: Only reset if we failed BEFORE dispatching individual jobs
      await prisma.site.updateMany({
        where: {
          tenantId,
          type: "COMPETITOR",
          syncStartedAt: syncSessionStart,
          isSyncing: true
        },
        data: { isSyncing: false },
      });
      throw error;
    }
  }

  /**
   * Run sync for a specific site (Executed by Worker)
   */
  static async processSiteSync(siteId: string, force: boolean = false, isCron: boolean = false) {
    const isKilled = await SystemConfigService.get(
      "SYNC_MASTER_KILL_SWITCH",
      false,
    );
    if (isKilled) {
      logger.warn(
        "[SyncOrchestrator] Site sync aborted: Master Kill Switch is ON.",
      );
      return { success: false, message: "Sync globally disabled" };
    }

    logger.info(
      `[SyncOrchestrator] Starting single-site sync for: ${siteId} (Force: ${force})`,
    );

    // Initial delay to let DB pool settle especially on rapid clicks
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Record START event
    metricsCollector.recordSyncLifecycle(siteId, 'START', { force, isCron }).catch(console.error);

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        tenantId: true,
        baseUrl: true,
        isAdvancedProtected: true,
      },
    }) as any;
    if (!site) throw new Error("Site not found");

    const advancedGate = await shouldBlockSyncForAdvancedAccess({
      siteId,
      tenantId: site.tenantId,
    });
    if (advancedGate.block) {
      await prisma.site.updateMany({
        where: { id: siteId },
        data: {
          isSyncing: false,
          syncLastAction:
            "Advanced anti-bot protection detected. Configure proxy + captcha solver to continue.",
        },
      });
      await scrapeLogger.log({
        siteId,
        message:
          "🛑 Sync blocked: advanced anti-bot protection requires proxy + captcha solver setup.",
        level: "WARNING",
      });
      return {
        success: false,
        message: advancedGate.message,
        requiresAdvancedAccess: true,
      };
    }

    // ATOMIC LOCK ACQUISITION / RESUME CHECK
    const currentSite = await prisma.site.findUnique({
      where: { id: siteId },
      select: { isSyncing: true, syncStartedAt: true },
    });
    const isResuming = currentSite?.isSyncing && currentSite?.syncStartedAt;
    const syncSessionStart = isResuming
      ? currentSite.syncStartedAt!
      : new Date();

    if (!isResuming) {
      // Use a more robust atomic operation with explicit WHERE conditions
      const updateResult = await prisma.$transaction(async (tx) => {
        // First, verify the site exists and check its current state
        const currentSite = await tx.site.findUnique({
          where: { id: siteId },
          select: { isSyncing: true, syncStartedAt: true },
        });

        if (!currentSite) {
          throw new Error("Site not found");
        }

        if (currentSite.isSyncing && !force) {
          return { count: 0 }; // Already syncing
        }

        // Atomic update with precise conditions
        return await tx.site.updateMany({
          where: {
            id: siteId,
            isSyncing: force ? undefined : false,
          },
          data: {
            isSyncing: true,
            syncLastAction: "Booting high-speed crawler...",
            syncProcessed: 0,
            syncTotal: 0,
            syncStartedAt: syncSessionStart,
          },
        });
      });

      if (updateResult.count === 0 && !force) {
        logger.info(
          `[SyncOrchestrator] Site ${siteId} is already syncing, skipping duplicate request`,
        );
        return {
          success: true,
          skipped: true,
          message: "Sync already in progress",
        };
      }

      await prisma.syncLog.deleteMany({ where: { siteId } });
      await scrapeLogger.log({
        siteId,
        message: "🚀 Initializing quantum price scanner...",
        level: "INFO",
      });
    } else {
      logger.info(
        `[SyncOrchestrator] RESUMING sync for site ${siteId} from session ${syncSessionStart.toISOString()}`,
      );
      await scrapeLogger.log({
        siteId,
        message: "♻️ Resuming interrupted sync session...",
        level: "INFO",
      });

      // Verification: Ensure the session is still marked as active in DB
      const verify = await prisma.site.findUnique({ where: { id: siteId }, select: { isSyncing: true, syncStartedAt: true } });
      if (!verify?.isSyncing || verify.syncStartedAt?.getTime() !== syncSessionStart.getTime()) {
        return { success: true, message: "Resumed session already halted" };
      }
    }

    try {
      if (!siteId) return { success: false, message: "Missing siteId" };

      let matchedProducts = await prisma.product.findMany({
        where: { siteId },
        include: { matchesAsCompetitor: true },
      });

      // Always run discovery to find new matches or retry failed ones
      // Pass the session ID to kill zombies in discovery phase
      const discoveryRes = await DiscoveryService.discoverForSite(
        site.tenantId,
        siteId,
        syncSessionStart,
      );

      if (discoveryRes.aborted) {
        return { success: true, message: "Sync stopped during discovery" };
      }

      // Refresh the list of products after discovery
      matchedProducts = await prisma.product.findMany({
        where: { siteId },
        include: { matchesAsCompetitor: true },
      });

      // Filtering: Skip if successfully crawled within the last 20 hours
      const REFRESH_WINDOW_MS = 20 * 60 * 60 * 1000;
      const productsToScrape = matchedProducts.filter((p) => {
        const isFresh = p.lastCrawledAt && (Date.now() - p.lastCrawledAt.getTime() < REFRESH_WINDOW_MS);
        const alreadyInSession = p.lastCrawledAt && p.lastCrawledAt.getTime() >= syncSessionStart.getTime();
        return !isFresh && !alreadyInSession;
      });

      const alreadyProcessedCount =
        matchedProducts.length - productsToScrape.length;
      let processed = alreadyProcessedCount;
      let count = 0;

      // Initialize progress
      await prisma.site.updateMany({
        where: { id: siteId },
        data: {
          syncTotal: matchedProducts.length,
          syncProcessed: processed,
          syncLastAction:
            processed > 0
              ? `Resuming: ${processed} already synced`
              : "Scanning for store matches...",
        },
      });

      if (productsToScrape.length === 0 && matchedProducts.length > 0) {
        logger.info(
          `[SyncOrchestrator] All products already synced for site ${siteId}`,
        );

      }

      // Golden Rule Settings
      let isGoldenRule = site.isAdvancedProtected;
      if (isGoldenRule && isCron && !this.isOffPeak()) {
        await scrapeLogger.log({
          siteId,
          message: "🛡️ Golden Rule: Off-peak hours only. Sync deferred to night.",
          level: "WARNING"
        });
        return { success: true, message: "Sync deferred to off-peak" };
      }

      // Process in batches for better performance
      const configuredBatchSize = await SystemConfigService.get(
        "SCRAPER_BATCH_SIZE",
        5,
      );
      const normalizedBatchSize =
        Number.isFinite(configuredBatchSize) && configuredBatchSize > 0
          ? Math.floor(configuredBatchSize)
          : 5;
      const devBatchCapRaw = Number(process.env.SCRAPER_BATCH_SIZE_DEV_MAX || 2);
      const devBatchCap =
        Number.isFinite(devBatchCapRaw) && devBatchCapRaw > 0
          ? Math.floor(devBatchCapRaw)
          : 2;
      const baseBatchSize = process.env.NODE_ENV === "production"
        ? normalizedBatchSize
        : Math.min(normalizedBatchSize, devBatchCap);
      for (let i = 0; i < productsToScrape.length;) {
        const batchSize = isGoldenRule ? 1 : baseBatchSize;

        // Check if sync was manually stopped OR session invalidated
        const currentStatus = await prisma.site.findUnique({
          where: { id: siteId },
          select: { isSyncing: true, syncStartedAt: true },
        });

        if (
          !currentStatus?.isSyncing ||
          currentStatus.syncStartedAt?.getTime() !== syncSessionStart.getTime()
        ) {
          logger.info(
            `[SyncOrchestrator] Sync manually stopped or new session started for site ${siteId}`,
          );
          await prisma.syncLog.create({
            data: {
              siteId,
              message: `⚠️ Sync stopped (Session invalidated).`,
              level: "WARN",
            },
          });
          break;
        }

        const batch = productsToScrape.slice(i, i + batchSize);
        if (batch.length === 0) continue;
        const productsToScrapeBatch = batch;
        const perItemTimeoutMsRaw = Number(process.env.SYNC_SCRAPE_ITEM_TIMEOUT_MS || 90000);
        const perItemTimeoutMs = Number.isFinite(perItemTimeoutMsRaw)
          ? Math.max(15000, perItemTimeoutMsRaw)
          : 90000;

        // Process batch in parallel. Retry ownership lives in ScrapeOrchestrator + retry queue.

        const results = (await Promise.allSettled(
          batch.map(async (product) => {
            // Quick termination check inside the batch
            const batchStatus = await prisma.site.findUnique({
              where: { id: siteId },
              select: { isSyncing: true, syncStartedAt: true },
            });
            if (!batchStatus?.isSyncing || batchStatus.syncStartedAt?.getTime() !== syncSessionStart.getTime()) {
              throw new Error("ABORTED");
            }

            if (isGoldenRule) {
              const delay = 8000 + Math.random() * 7000; // 8-15s
              await new Promise(r => setTimeout(r, delay));
            }
            const result = await Promise.race([
              ScrapingEngineService.scrapeByUrl(product.url || "", {
                context: "worker",
                isAdvancedProtected: isGoldenRule,
                competitorProductId: product.id,
                tenantId: product.tenantId,
                siteId,
              }),
              new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error(`timeout: scrape item exceeded ${perItemTimeoutMs}ms`)), perItemTimeoutMs);
              }),
            ]);
            return { product, result };
          }),
        )) as any[];

        // Process results
        for (const promiseResult of results) {
          processed++;

          // Persist progress regardless of scrape outcome so UI stays live.
          if (processed % 5 === 0 || processed === productsToScrape.length) {
            await withDbRetry(() => prisma.site.updateMany({
              where: { id: siteId },
              data: {
                syncProcessed: processed,
                syncLastAction: `Syncing: ${processed}/${matchedProducts.length} items...`,
              },
            }), { operationName: "UpdateSyncProgress" });

            metricsCollector
              .recordSyncLifecycle(siteId, "PROGRESS", { processed, total: matchedProducts.length })
              .catch(console.error);
          }

          if (
            promiseResult.status === "fulfilled" &&
            promiseResult.value.result &&
            promiseResult.value.result.price > 0 // Issue 3: Validate price > 0
          ) {
            const { product, result } = promiseResult.value;

            // Issue 4: Reduce log noise - log every 5th product success or always log failures
            if (processed % 5 === 0 || processed === productsToScrape.length) {
              await scrapeLogger.log({
                siteId,
                message: `📦 [${processed}/${matchedProducts.length}] ${product.title.substring(0, 45)}... → ৳${result.price}`,
                level: "INFO",
              });
            }

            const oldPrice = parseFloat(product.currentPrice.toString());
            const oldStock = product.inStock;

            const anomaly = detectPriceAnomaly({
              newPrice: result.price,
              oldPrice,
              inStock: result.inStock,
              explicitOos: (result as any).explicitOos,
              currency: (result as any).currency,
            });

            if (anomaly.flagged) {
              await withDbRetry(() => prisma.product.update({
                where: { id: product.id },
                data: {
                  priceAnomalyActive: true,
                  priceAnomalyDetectedAt: new Date(),
                  priceAnomalyData: anomaly,
                  lastCrawledAt: new Date(),
                } as any,
              }), { operationName: 'FlagPriceAnomaly' });

              await scrapeLogger.log({
                siteId,
                message: `🚨 ANOMALY [${processed}/${matchedProducts.length}] ${product.title.substring(0, 40)}... old=৳${oldPrice} new=৳${result.price} reasons=${anomaly.reasons.join(",")}`,
                level: "WARNING",
              });

              continue;
            } else if ((product as any).priceAnomalyActive) {
              // Clear anomaly flag when we see a normal price again.
              await withDbRetry(() => prisma.product.update({
                where: { id: product.id },
                data: {
                  priceAnomalyActive: false,
                  priceAnomalyDetectedAt: null,
                  priceAnomalyData: null,
                } as any,
              }), { operationName: 'ClearPriceAnomaly' });
            }

            await withDbRetry(() => prisma.product.update({
              where: { id: product.id },
              data: {
                currentPrice: result.price,
                inStock: result.inStock,
                imageUrl: result.imageUrl || (product as any).imageUrl,
                specifications: result.specifications || (product as any).specifications, // Save Specs
                lastCrawledAt: new Date(),
              } as any,
            }), { operationName: 'UpdateProductData' });

            // Invalidate cache for updated product
            // Requirement 2.9.4: Cache invalidation on data updates
            try {
              const { cacheEnhancedService } = await import("./cache-enhanced");
              await cacheEnhancedService.invalidateProduct(product.tenantId, product.id);
              await cacheEnhancedService.invalidateComparisons(product.tenantId);
            } catch (cacheError) {
              logger.warn('[SyncOrchestrator] Failed to invalidate cache after product update', {
                productId: product.id,
                error: cacheError
              });
            }

            // Trigger Alert Rules Evaluation
            const { AlertService } = await import("./alert-service");
            await AlertService.evaluateRules(
              product.tenantId,
              product.id,
              oldPrice,
              result.price,
              oldStock,
              result.inStock,
            );

            // Issue 1: Prevent duplicate PriceHistory entry for same timestamp
            const now = new Date();
            const historyExists = await prisma.priceHistory.findFirst({
              where: { productId: product.id, recordedAt: now }
            });
            if (!historyExists) {
              await withDbRetry(() => prisma.priceHistory.create({
                data: {
                  productId: product.id,
                  price: result.price,
                  recordedAt: now,
                }
              }), { operationName: 'CreatePriceHistory' });
            }
            count++;
          } else {
            // Log failed scrapes with reason
            const product =
              promiseResult.status === "fulfilled"
                ? promiseResult.value.product
                : productsToScrapeBatch[results.indexOf(promiseResult)];

            const errorReason =
              promiseResult.status === "rejected"
                ? promiseResult.reason?.message?.includes("ABORTED")
                  ? "ABORTED"
                  : promiseResult.reason?.message?.includes("BLOCKED")
                    ? `🛡️ Blocked: ${promiseResult.reason.message.replace("BLOCKED: ", "")}`
                    : promiseResult.reason?.message?.includes("timeout")
                      ? "⏱️ Timeout"
                      : "❌ Error"
                : promiseResult.value?.result?.price === 0
                  ? "⚠️ Missing Price"
                  : "⚠️ No data";

            if (errorReason === "ABORTED") break;

            await scrapeLogger.log({
              siteId,
              message: `${errorReason} [${processed}/${matchedProducts.length}] ${product?.title?.substring(0, 40) || "Unknown"}`,
              level: "WARNING",
            });

            // Price=0 anomaly unless explicitly OOS: flag on the product record for visibility.
            if (
              promiseResult.status === "fulfilled" &&
              promiseResult.value?.result &&
              promiseResult.value.result.price === 0
            ) {
              const res = promiseResult.value.result;
              const explicitOos = !!(res as any).explicitOos;
              const anomaly = detectPriceAnomaly({
                newPrice: 0,
                oldPrice: product ? parseFloat(product.currentPrice.toString()) : null,
                inStock: !!res.inStock,
                explicitOos,
                currency: (res as any).currency,
              });

              if (anomaly.flagged && product?.id) {
                await withDbRetry(() => prisma.product.update({
                  where: { id: product.id },
                  data: {
                    priceAnomalyActive: true,
                    priceAnomalyDetectedAt: new Date(),
                    priceAnomalyData: anomaly,
                    lastCrawledAt: new Date(),
                  } as any,
                }), { operationName: 'FlagPriceZeroAnomaly' });
              } else if (explicitOos && product?.id) {
                // Explicit OOS with missing price: keep last price, but update stock state.
                await withDbRetry(() => prisma.product.update({
                  where: { id: product.id },
                  data: {
                    inStock: false,
                    lastCrawledAt: new Date(),
                  } as any,
                }), { operationName: 'MarkOosWithMissingPrice' });
              }
            }

            // Advanced Block Detection
            if (promiseResult.status === "rejected" && !isGoldenRule) {
              const error = promiseResult.reason;
              if (error instanceof ScrapeBlockError && error.isAdvanced) {
                const urlObj = new URL(site.baseUrl);
                await this.handleSecurityBlock(siteId, site.tenantId, urlObj.hostname, productsToScrape.length - processed);
                await prisma.site.updateMany({
                  where: { id: siteId },
                  data: {
                    isSyncing: false,
                    syncLastAction:
                      "Advanced anti-bot protection detected. Configure proxy + captcha solver to continue.",
                  },
                });
                return {
                  success: false,
                  message:
                    "Advanced anti-bot protection detected during sync. Configure proxy + captcha solver and retry.",
                  requiresAdvancedAccess: true,
                };
              }
            }
          }
        }

        // Small delay between batches to avoid overwhelming the server
        if (i + batchSize < productsToScrape.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        i += batchSize;
      }

      // Re-check status before proceeding to rules
      const finalStatus = await prisma.site.findUnique({
        where: { id: siteId },
        select: { isSyncing: true, syncStartedAt: true }
      });

      if (!finalStatus?.isSyncing || finalStatus.syncStartedAt?.getTime() !== syncSessionStart.getTime()) {
        return { success: true, message: "Sync aborted before rules engine" };
      }

      // Add completion summary
      await scrapeLogger.log({
        siteId,
        message: `🎯 Price sync complete: ${count}/${matchedProducts.length} products updated successfully.`,
        level: "SUCCESS",
      });

      // Invalidate cache after competitor scrape completes
      // Requirement 2.4: Competitor scrape invalidation
      try {
        const cacheInvalidation = new CacheInvalidationService();
        await cacheInvalidation.onCompetitorScrape(site.tenantId, siteId);
      } catch (cacheError) {
        // Log cache invalidation error but don't fail the operation
        logger.error('[SyncOrchestrator] Cache invalidation failed', { error: cacheError });
      }

      await scrapeLogger.log({
        siteId,
        message: `⚙️ Activating pricing rules engine...`,
        level: "INFO",
      });

      await RulesEngine.evaluateAllRules(site.tenantId);

      await scrapeLogger.log({
        siteId,
        message: `✅ Rules evaluation complete. Price changes queued for your approval.`,
        level: "SUCCESS",
      });

      // Process Auto-Approvals after rules evaluation (Requirement 2.10.1)
      try {
        const autoApprovedCount = await AutoApprovalService.processAutoApprovals(site.tenantId);

        if (autoApprovedCount > 0) {
          logger.info(`[SyncOrchestrator] Auto-approved ${autoApprovedCount} price changes for site ${siteId}`);

          await scrapeLogger.log({
            siteId,
            message: `✅ Auto-approved ${autoApprovedCount} price changes based on configured rules`,
            level: "INFO",
          });
        }
      } catch (error) {
        // Log error but don't fail the sync
        logger.error(`[SyncOrchestrator] Error processing auto-approvals for site ${siteId}:`, { error });

        await scrapeLogger.log({
          siteId,
          message: `⚠️ Auto-approval processing failed: ${error instanceof Error ? error.message : String(error)}`,
          level: "WARNING",
        });
      }

      await scrapeLogger.log({
        siteId,
        message: `🚀 Sync operation completed. Review pending price changes in your dashboard.`,
        level: "SUCCESS",
      });

      // Record STOP event
      metricsCollector.recordSyncLifecycle(siteId, 'STOP', { count, status: 'Completed' }).catch(console.error);

      return { success: true, count };
    } catch (error) {
      // Log the error to the database
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      logger.error(`[SyncOrchestrator] Sync error for site ${siteId}:`, {
        error,
      });

      // Only attempt to log to DB if the site actually exists (avoid FK violation)
      if (errorMessage !== "Site not found") {
        await scrapeLogger.log({
          siteId,
          message: `❌ SYNC FAILED: ${errorMessage}`,
          level: "ERROR",
        });

        // Record FAIL event
        metricsCollector.recordSyncLifecycle(siteId, 'FAIL', { error: errorMessage }).catch(console.error);


        // Send notification to tenant about sync failure
        const site = await prisma.site.findUnique({
          where: { id: siteId },
          select: { tenantId: true, baseUrl: true },
        });
        if (site) {
          await NotificationService.sendSyncError(
            site.tenantId,
            `Failed to sync competitor site ${site.baseUrl}: ${errorMessage}`
          );
        }
      }

      throw error;
    } finally {
      // Use updateMany to safely update state even if record is gone
      // IMPORTANT: Only reset if the site is still associated with OUR session ID
      await prisma.site
        .updateMany({
          where: {
            id: siteId,
            syncStartedAt: syncSessionStart,
          },
          data: {
            isSyncing: false,
            lastSyncAt: new Date(),
          },
        })
        .catch((e) =>
          logger.error("Failed to reset sync state:", { error: e }),
        );
    }
  }

  /**
   * Run sync for a single product
   */
  static async syncProduct(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { Site: true },
    });

    if (!product || !product.url) throw new Error("Product or URL not found");

    {
      const result = await ScrapingEngineService.scrapeByUrl(product.url, {
        context: "worker",
        isAdvancedProtected: Boolean((product as any).Site?.isAdvancedProtected),
        competitorProductId: product.id,
        tenantId: product.tenantId,
        siteId: product.siteId,
      });
      if (result && result.price) {
        await prisma.product.update({
          where: { id: productId },
          data: {
            currentPrice: result.price,
            inStock: result.inStock,
            imageUrl: result.imageUrl || (product as any).imageUrl,
            specifications: result.specifications || (product as any).specifications, // Save Specs
            lastCrawledAt: new Date(),
          } as any,
        });

        // Invalidate cache for updated product
        // Requirement 2.9.4: Cache invalidation on data updates
        try {
          const { cacheEnhancedService } = await import("./cache-enhanced");
          await cacheEnhancedService.invalidateProduct(product.tenantId, product.id);
          await cacheEnhancedService.invalidateComparisons(product.tenantId);
        } catch (cacheError) {
          logger.warn('[SyncOrchestrator] Failed to invalidate cache after product update', {
            productId: product.id,
            error: cacheError
          });
        }

        await prisma.priceHistory.create({
          data: {
            productId,
            price: result.price,
            recordedAt: new Date(),
          },
        });
      }

      await RulesEngine.evaluateAllRules((product as any).Site.tenantId);

      // Process Auto-Approvals after rules evaluation (Requirement 2.10.1)
      try {
        const autoApprovedCount = await AutoApprovalService.processAutoApprovals((product as any).Site.tenantId);

        if (autoApprovedCount > 0) {
          logger.info(`[SyncOrchestrator] Auto-approved ${autoApprovedCount} price changes for product ${productId}`);
        }
      } catch (error) {
        // Log error but don't fail the sync
        logger.error(`[SyncOrchestrator] Error processing auto-approvals for product ${productId}:`, { error });
      }

      return { success: true, price: result?.price };
    }
  }

  /**
   * Run sync for a specific chunk of products
   */
  static async processChunkSync(siteId: string, productIds: string[]) {
    logger.info(
      `[SyncOrchestrator] Processing chunk of ${productIds.length} products for site ${siteId}`,
    );
    if (!productIds || productIds.length === 0) return;

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { isAdvancedProtected: true },
    });
    const isAdvancedProtected = Boolean(site?.isAdvancedProtected);

    for (const product of products) {
      if (!product.url) continue;
      const result = await ScrapingEngineService.scrapeByUrl(product.url, {
        context: "worker",
        isAdvancedProtected,
        competitorProductId: product.id,
        tenantId: product.tenantId,
        siteId,
      });
      if (result && result.price) {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              currentPrice: result.price,
              inStock: result.inStock,
              lastCrawledAt: new Date(),
            },
          });

          // Invalidate cache for updated product
          // Requirement 2.9.4: Cache invalidation on data updates
          try {
            const { cacheEnhancedService } = await import("./cache-enhanced");
            await cacheEnhancedService.invalidateProduct(product.tenantId, product.id);
            await cacheEnhancedService.invalidateComparisons(product.tenantId);
          } catch (cacheError) {
            logger.warn('[SyncOrchestrator] Failed to invalidate cache after product update', {
              productId: product.id,
              error: cacheError
            });
          }

          await prisma.priceHistory.create({
            data: { productId: product.id, price: result.price },
          });
      }
    }
  }

  /**
   * Process a delayed retry for blocked products
   */
  static async processRetrySync(siteId: string, productIds: string[]) {
    const redis = getRedisConnection();
    const lockKey = this.getRetrySiteLockKey(siteId);
    const lockTtlMs = this.getRetrySiteLockTtlMs();
    const lockToken = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const acquired = await redis.set(lockKey, lockToken, "PX", lockTtlMs, "NX");

    if (acquired !== "OK") {
      logger.info(`[SyncOrchestrator] Skipping retry sync; lock already held for site ${siteId}`);
      return;
    }

    const heartbeatEveryMs = Math.max(10_000, Math.floor(lockTtlMs / 3));
    const heartbeat = setInterval(async () => {
      try {
        const renewLua = `
          local key = KEYS[1]
          local token = ARGV[1]
          local ttl = tonumber(ARGV[2])
          if redis.call("GET", key) == token then
            redis.call("PEXPIRE", key, ttl)
            return 1
          end
          return 0
        `;
        await redis.eval(renewLua, 1, lockKey, lockToken, lockTtlMs);
      } catch (error) {
        logger.warn("[SyncOrchestrator] Failed to refresh retry-site lock", {
          siteId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, heartbeatEveryMs);

    try {
      await this.processRetrySyncInternal(siteId, productIds);
    } finally {
      clearInterval(heartbeat);
      const releaseLua = `
        local key = KEYS[1]
        local token = ARGV[1]
        if redis.call("GET", key) == token then
          redis.call("DEL", key)
          return 1
        end
        return 0
      `;
      await redis.eval(releaseLua, 1, lockKey, lockToken).catch((error: Error) => {
        logger.warn("[SyncOrchestrator] Failed to release retry-site lock", {
          siteId,
          error: error.message,
        });
      });
    }
  }

  private static async processRetrySyncInternal(siteId: string, productIds: string[]) {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        baseUrl: true,
        isSyncing: true,
      },
    });
    if (!site || !site.isSyncing) return;

    logger.info(`[SyncOrchestrator] Starting retry sync for ${productIds.length} products on site ${siteId}`);

    for (let index = 0; index < productIds.length; index++) {
        const productId = productIds[index];
        const userProduct = await prisma.product.findUnique({ where: { id: productId } });
        if (!userProduct) continue;

      // Check if we should still be running
      const currentSiteStatus = await prisma.site.findUnique({
        where: { id: siteId },
        select: { isSyncing: true }
      });
      if (currentSiteStatus && !currentSiteStatus.isSyncing) {
        logger.info(`[SyncOrchestrator] Retry aborted for site ${siteId}`);
        break;
      }

      // Status update: heartbeat for ScrapeRetry - only on every 10th product or success/failure
      if (index % 10 === 0) {
        await (prisma as any).scrapeRetry.updateMany({
          where: { userProductId: productId, siteId, status: "PENDING" },
          data: { updatedAt: new Date() }
        });
      }

        try {
          const cleanTitle = userProduct.title.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
          const result = await ScrapingEngineService.searchAndScrape(site.baseUrl, cleanTitle, {
            siteId,
            tenantId: userProduct.tenantId,
            context: "retry",
          });

        if (result && result.price > 0) {
          // Success! Create match
          await prisma.$transaction(async (tx) => {
            const compProduct = await tx.product.create({
              data: {
                tenantId: userProduct.tenantId,
                siteId: site.id,
                url: result.url,
                title: result.title,
                currentPrice: result.price,
                inStock: result.inStock,
                currency: result.currency || "BDT",
                lastCrawledAt: new Date(),
              }
            });

            await tx.productMatch.create({
              data: {
                userProductId: userProduct.id,
                competitorProductId: compProduct.id,
                matchType: "AUTO_SKU",
                confidenceScore: 0.9,
              }
            });

            await tx.priceHistory.create({
              data: { productId: compProduct.id, price: result.price }
            });
          });

          await (prisma as any).scrapeRetry.updateMany({
            where: { userProductId: productId, siteId, status: "PENDING" },
            data: { status: "SUCCESS", updatedAt: new Date() }
          });

          await prisma.syncLog.create({
            data: {
              siteId,
              message: `✅ [RETRY] MATCH: "${userProduct.title.substring(0, 30)}..." → ৳${result.price}`,
              level: "SUCCESS",
            },
          });
        } else {
          await (prisma as any).scrapeRetry.updateMany({
            where: { userProductId: productId, siteId, status: "PENDING" },
            data: { status: "FAILED", reason: "Product not found on retry", updatedAt: new Date() }
          });
        }
        } catch (error: any) {
          // Scraper might throw ScrapeBlockError
          if (error.name === "ScrapeBlockError" || error.message.includes("BLOCKED")) {
          const retryRecord = await (prisma as any).scrapeRetry.findFirst({
            where: { userProductId: productId, siteId, status: "PENDING" }
          });

          if (retryRecord && retryRecord.retryCount < 3) {
            const isAdvancedBlock =
              error instanceof ScrapeBlockError ? error.isAdvanced : false;
            const retryAfter = this.getRetryBackoffMinutes(
              retryRecord.retryCount,
              isAdvancedBlock,
            );
            const nextAttempt = new Date(Date.now() + retryAfter * 60 * 1000);
            const nextAttemptNumber = retryRecord.retryCount + 1;

            await (prisma as any).scrapeRetry.update({
              where: { id: retryRecord.id },
              data: {
                retryCount: { increment: 1 },
                nextAttemptAt: nextAttempt,
                reason: error.provider || "BLOCK",
              }
            });

            await enqueueWithBackpressure(
              getSyncQueue(),
              QUEUE_NAMES.SYNC,
              {
                type: "RETRY",
                siteId,
                tenantId: userProduct.tenantId,
                productIds: [productId],
              },
              {
                delay: retryAfter * 60 * 1000,
                jobId: this.buildRetryJobId(siteId, productId, nextAttemptNumber),
              },
              {
                producer: "SyncOrchestrator.processRetryQueue",
                strategy: "delay",
                minDelayMs: 10_000,
                maxDelayMs: 120_000,
              },
            );

            await prisma.syncLog.create({
              data: {
                siteId,
                message: `🛡️ [RETRY] STILL BLOCKED: "${userProduct.title.substring(0, 30)}...". Attempt ${nextAttemptNumber} scheduled in ~${retryAfter}m.`,
                level: "WARN",
              },
            });
          } else {
            await (prisma as any).scrapeRetry.updateMany({
              where: { userProductId: productId, siteId, status: "PENDING" },
              data: { status: "FAILED", reason: "MAX_RETRIES_EXCEEDED", updatedAt: new Date() }
            });
          }
          } else {
            await (prisma as any).scrapeRetry.updateMany({
              where: { userProductId: productId, siteId, status: "PENDING" },
              data: { status: "FAILED", reason: error.message, updatedAt: new Date() }
            });
          }
        }
      }
  }
}
