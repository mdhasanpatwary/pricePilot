import { ScrapeBlockError } from "./scraper";
import { detectPriceAnomaly } from "./price-anomaly";
import { RulesEngine } from "./rules-engine";
import { DiscoveryService } from "./discovery";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "./notification";
import { SystemConfigService } from "@/lib/config";
import { getSyncFullQueue, getSyncDeltaQueue } from "@/lib/queue/client";
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
import { shouldBlockSyncForAdvancedAccess } from "@/lib/services/advanced-access";
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
      getSyncFullQueue(),
      QUEUE_NAMES.SYNC_FULL,
      {
        type: "FULL",
        tenantId,
      },
      { priority: 50 }, // Lower priority for mass background syncs
      { producer: "SyncOrchestrator.dispatchFullSync", strategy: "delay" },
    );
    return { success: true, message: "Full sync job queued successfully." };
  }

  /**
   * Dispatch a single site sync job to the queue
   */
  static async dispatchSiteSync(siteId: string, force: boolean = false) {
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { tenantId: true } });
    if (!site) throw new Error("Site not found");

    await enqueueWithBackpressure(
      getSyncDeltaQueue(),
      QUEUE_NAMES.SYNC_DELTA,
      {
        type: "SINGLE",
        siteId,
        tenantId: site.tenantId,
        force,
      },
      { priority: 10 }, // Higher priority for user-triggered single site syncs
      { producer: "SyncOrchestrator.dispatchSiteSync", strategy: "delay" },
    );

    // Record QUEUE event
    metricsCollector.recordSyncLifecycle(siteId, 'QUEUE', { force, source: 'dispatchSiteSync' }).catch(console.error);

    return { success: true, message: "Site sync job queued successfully." };
  }

  /**
   * Dispatch a single product sync job to the queue
   */
  static async dispatchProductSync(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { Site: { select: { tenantId: true } } }
    });
    if (!product) throw new Error("Product not found");

    await enqueueWithBackpressure(
      getSyncDeltaQueue(),
      QUEUE_NAMES.SYNC_DELTA,
      {
        type: "PRODUCT",
        productId,
        tenantId: product.Site.tenantId,
      },
      { priority: 1 }, // Highest priority for manual one-off syncs
      { producer: "SyncOrchestrator.dispatchProductSync", strategy: "delay" },
    );
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

    const lockResult = await prisma.site.updateMany({
      where: {
        tenantId,
        type: "COMPETITOR",
        syncState: { in: ["IDLE", "STOPPED"] },
      },
      data: {
        isSyncing: true,
        syncState: "STARTING",
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
        // to the delta queue so multiple workers can pick them up in parallel.
        await enqueueWithBackpressure(
          getSyncDeltaQueue(),
          QUEUE_NAMES.SYNC_DELTA,
          {
            type: "SINGLE",
            siteId: site.id,
            tenantId: site.tenantId,
            isCron: isCron,
          },
          {
            jobId: `sync-${site.id}-${syncSessionStart.getTime()}`,
            priority: isCron ? 20 : 10,
          },
          {
            producer: "SyncOrchestrator.processFullSync",
            strategy: "delay",
            minDelayMs: 5000,
            maxDelayMs: 60000,
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
          syncState: "STARTING"
        },
        data: { isSyncing: false, syncState: "IDLE" },
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
      const updateResult = await prisma.$transaction(async (tx) => {
        // First, verify the site exists and check its current state with a row lock
        const sites = await tx.$queryRaw<Array<{isSyncing: boolean, syncStartedAt: Date | null}>>`
          SELECT "isSyncing", "syncStartedAt"
          FROM "Site"
          WHERE id = ${siteId}
          FOR UPDATE
        `;
        const currentSite = sites[0];

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
            syncState: force ? undefined : { in: ["IDLE", "STOPPED"] },
          },
          data: {
            isSyncing: true,
            syncState: "STARTING",
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
      const verify = await prisma.site.findUnique({ where: { id: siteId }, select: { isSyncing: true, syncState: true, syncStartedAt: true } });
      if (!verify?.isSyncing || verify?.syncState === "STOPPING" || verify?.syncState === "STOPPED" || verify.syncStartedAt?.getTime() !== syncSessionStart.getTime()) {
        return { success: true, message: "Resumed session already halted" };
      }
    }

    let deferStateResetToChunks = false;
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

        await prisma.site.updateMany({
           where: { id: siteId },
           data: { isSyncing: false, syncState: "STOPPED", syncLastAction: "Deferred to off-peak" }
        });
        return { success: true, message: "Sync deferred to off-peak" };
      }

      if (productsToScrape.length > 0) {
        // Dispatch to Queue as CHUNKS
        const configuredBatchSize = await SystemConfigService.get("SCRAPER_BATCH_SIZE", 5);
        const normalizedBatchSize = Number.isFinite(configuredBatchSize) && configuredBatchSize > 0 ? Math.floor(configuredBatchSize) : 5;
        const devBatchCapRaw = Number(process.env.SCRAPER_BATCH_SIZE_DEV_MAX || 2);
        const devBatchCap = Number.isFinite(devBatchCapRaw) && devBatchCapRaw > 0 ? Math.floor(devBatchCapRaw) : 2;
        const baseBatchSize = process.env.NODE_ENV === "production" ? normalizedBatchSize : Math.min(normalizedBatchSize, devBatchCap);

        const batchSize = isGoldenRule ? 1 : baseBatchSize;
        let dispatchedChunks = 0;

        // Weighted Priority: Add 1 per 50 products, cap at 30. Base is 5.
        // Golden Rule gets lower priority (35). Cron gets lower priority (25).
        const priority = isGoldenRule ? 35 : (isCron ? 25 : Math.max(5, Math.min(30, 5 + Math.floor(matchedProducts.length / 50))));

        for (let i = 0; i < productsToScrape.length; i += batchSize) {
          const chunk = productsToScrape.slice(i, i + batchSize);
          if (chunk.length === 0) continue;

          await enqueueWithBackpressure(
            getSyncDeltaQueue(),
            QUEUE_NAMES.SYNC_DELTA,
            {
              type: "CHUNK",
              siteId,
              tenantId: site.tenantId,
              productIds: chunk.map(p => p.id),
              syncSessionStart: syncSessionStart.getTime(),
              isGoldenRule,
            },
            { priority },
            { producer: "SyncOrchestrator.dispatchChunks", strategy: "delay" }
          );
          dispatchedChunks++;
        }

        await scrapeLogger.log({
          siteId,
          message: `📊 Distributed ${productsToScrape.length} products across ${dispatchedChunks} automated worker chunks.`,
          level: "INFO",
        });

        deferStateResetToChunks = true;
        return { success: true, dispatchedChunks, isAsync: true };
      } else {
        // No products to scrape, finalize immediately
        deferStateResetToChunks = true;
        await this.finalizeSiteSync(siteId, site.tenantId, syncSessionStart);
        return { success: true, count: 0 };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      logger.error(`[SyncOrchestrator] Sync error for site ${siteId}:`, { error });

      if (errorMessage !== "Site not found") {
        await scrapeLogger.log({
          siteId,
          message: `❌ SYNC FAILED: ${errorMessage}`,
          level: "ERROR",
        });

        metricsCollector.recordSyncLifecycle(siteId, 'FAIL', { error: errorMessage }).catch(console.error);

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
      if (!deferStateResetToChunks) {
        try {
          const siteStatus = await prisma.site.findUnique({
            where: { id: siteId },
            select: { syncState: true, syncStartedAt: true },
          });

          if (siteStatus?.syncStartedAt?.getTime() === syncSessionStart.getTime()) {
            const finalState = siteStatus.syncState === "STOPPING" ? "STOPPED" : "IDLE";
            await prisma.site.updateMany({
              where: { id: siteId, syncStartedAt: syncSessionStart },
              data: { isSyncing: false, syncState: finalState, lastSyncAt: new Date() },
            });
          }
        } catch (e) {
          logger.error("Failed to reset sync state:", { error: e });
        }
      }
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
          where: { id: product.id },
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

  static async processChunkSync(siteId: string, productIds: string[], syncSessionStartTimestamp?: number, isAdvancedProtected?: boolean) {
    logger.info(`[SyncOrchestrator] Processing chunk of ${productIds.length} products for site ${siteId}`);
    if (!productIds || productIds.length === 0) return;

    const syncSessionStart = syncSessionStartTimestamp ? new Date(syncSessionStartTimestamp) : undefined;

    // Check global status to allow aborting inflight chunks
    if (syncSessionStart) {
        const finalStatus = await prisma.site.findUnique({
          where: { id: siteId },
          select: { isSyncing: true, syncState: true, syncStartedAt: true }
        });

        if (!finalStatus?.isSyncing || finalStatus.syncState === "STOPPING" || finalStatus.syncState === "STOPPED" || finalStatus.syncStartedAt?.getTime() !== syncSessionStart.getTime()) {
           logger.info(`[SyncOrchestrator] Chunk skipped because sync session is stopped or overridden for site ${siteId}`);
           return;
        }
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const isGoldenRule = Boolean(isAdvancedProtected);
    const perItemTimeoutMsRaw = Number(process.env.SYNC_SCRAPE_ITEM_TIMEOUT_MS || 90000);
    const perItemTimeoutMs = Number.isFinite(perItemTimeoutMsRaw) ? Math.max(15000, perItemTimeoutMsRaw) : 90000;

    let successCount = 0;

    // Process chunk sequentially to avoid hammering proxy, but chunks run concurrently
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      if (!product.url) continue;

      try {
          if (isGoldenRule) {
             const delay = 8000 + Math.random() * 7000; // 8-15s
             await new Promise(r => setTimeout(r, delay));
          }

          const result = await Promise.race([
            ScrapingEngineService.scrapeByUrl(product.url, {
              context: "worker",
              isAdvancedProtected: isGoldenRule,
              competitorProductId: product.id,
              tenantId: product.tenantId,
              siteId,
            }),
            new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error(`timeout: scrape item exceeded ${perItemTimeoutMs}ms`)), perItemTimeoutMs);
            })
          ]) as any; // Cast for explicit type inference in race

          if (result && result.price > 0) {
            successCount++;

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
              }), { operationName: 'FlagPriceAnomaly(Chunk)' });

              await scrapeLogger.log({
                siteId,
                message: `🚨 ANOMALY [Chunk] ${product.title.substring(0, 40)}... old=৳${oldPrice} new=৳${result.price} reasons=${anomaly.reasons.join(",")}`,
                level: "WARNING",
              });
              continue;
            } else if ((product as any).priceAnomalyActive) {
                await withDbRetry(() => prisma.product.update({
                where: { id: product.id },
                data: {
                  priceAnomalyActive: false,
                  priceAnomalyDetectedAt: null,
                  priceAnomalyData: null,
                } as any,
              }), { operationName: 'ClearPriceAnomaly(Chunk)' });
            }

            await withDbRetry(() => prisma.product.update({
              where: { id: product.id },
              data: {
                currentPrice: result.price,
                inStock: result.inStock,
                imageUrl: result.imageUrl || (product as any).imageUrl,
                specifications: result.specifications || (product as any).specifications,
                lastCrawledAt: new Date(),
              } as any,
            }), { operationName: 'UpdateProductData(Chunk)' });

            // Invalidate cache
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

            // Alert Service
            const { AlertService } = await import("./alert-service");
            await AlertService.evaluateRules(product.tenantId, product.id, oldPrice, result.price, oldStock, result.inStock);

            const now = new Date();
            const historyExists = await prisma.priceHistory.findFirst({
              where: { productId: product.id, recordedAt: now }
            });
            if (!historyExists) {
              await withDbRetry(() => prisma.priceHistory.create({
                data: { productId: product.id, price: result.price, recordedAt: now }
              }), { operationName: 'CreatePriceHistory(Chunk)' });
            }
          } else {
             // Handle Price 0 / OOS logic similar to sync process
             if (result && result.price === 0) {
               const explicitOos = !!(result as any).explicitOos;
               const anomaly = detectPriceAnomaly({
                 newPrice: 0,
                 oldPrice: parseFloat(product.currentPrice.toString()),
                 inStock: !!result.inStock,
                 explicitOos,
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
                 }), { operationName: 'FlagPriceZeroAnomaly(Chunk)' });
                } else if (explicitOos) {
                   await withDbRetry(() => prisma.product.update({
                     where: { id: product.id },
                     data: { inStock: false, lastCrawledAt: new Date() } as any,
                  }), { operationName: 'MarkOosWithMissingPrice(Chunk)' });
                }
             }
          }
      } catch (error: any) {
          const isTimeout = error.message?.includes("timeout");
          const isAdvancedBlock = error instanceof ScrapeBlockError && error.isAdvanced;

          await scrapeLogger.log({
              siteId,
              message: `⚠️ [Chunk: ${product.title.substring(0, 30)}] Failed: ${isAdvancedBlock ? 'Advanced Block' : isTimeout ? 'Timeout' : error.message}`,
              level: "WARNING",
          });
      }
    } // End product loop

    // Update global progress for the site
    try {
        const siteData = await prisma.site.findUnique({
            where: { id: siteId },
            select: { syncTotal: true, syncProcessed: true, tenantId: true }
        });

        if (siteData) {
            const newProcessed = (siteData.syncProcessed || 0) + products.length;
            const isFinalChunk = newProcessed >= (siteData.syncTotal || 1);

            await withDbRetry(() => prisma.site.updateMany({
                where: { id: siteId },
                data: {
                    syncProcessed: newProcessed,
                    syncLastAction: `Syncing: ${newProcessed}/${siteData.syncTotal} items (Chunked)...`
                }
            }), { operationName: "UpdateSyncProgress(Chunk)" });

            metricsCollector.recordSyncLifecycle(siteId, "PROGRESS", { processed: newProcessed, total: siteData.syncTotal || 1 }).catch(console.error);

            if (isFinalChunk && syncSessionStart) {
                logger.info(`[SyncOrchestrator] All chunks completed for site ${siteId}, finalizing sync.`);
                await this.finalizeSiteSync(siteId, siteData.tenantId, syncSessionStart);
            }
        }
    } catch(e) {
        logger.error(`[SyncOrchestrator] Failed to update progress for chunk completion on site ${siteId}`, { error: e instanceof Error ? e.message : String(e) });
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
              getSyncDeltaQueue(), // Corrected queue
              QUEUE_NAMES.SYNC_DELTA, // Corrected queue name
              {
                type: "RETRY", // Corrected type
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

  private static async finalizeSiteSync(siteId: string, tenantId: string, syncSessionStart: Date) {
    // Re-check status before proceeding
    const finalStatus = await prisma.site.findUnique({
      where: { id: siteId },
      select: { isSyncing: true, syncState: true, syncStartedAt: true }
    });

    if (!finalStatus?.isSyncing || finalStatus.syncState === "STOPPING" || finalStatus.syncState === "STOPPED" || finalStatus.syncStartedAt?.getTime() !== syncSessionStart.getTime()) {
      return { success: true, message: "Sync aborted before rules engine" };
    }

    await scrapeLogger.log({
      siteId,
      message: `🎯 Price sync complete.`,
      level: "SUCCESS",
    });

    try {
      const cacheInvalidation = new CacheInvalidationService();
      await cacheInvalidation.onCompetitorScrape(tenantId, siteId);
    } catch (cacheError) {
      logger.error('[SyncOrchestrator] Cache invalidation failed', { error: cacheError });
    }

    await scrapeLogger.log({
      siteId,
      message: `⚙️ Activating pricing rules engine...`,
      level: "INFO",
    });

    await RulesEngine.evaluateAllRules(tenantId);

    await scrapeLogger.log({
      siteId,
      message: `✅ Rules evaluation complete. Price changes queued for your approval.`,
      level: "SUCCESS",
    });

    try {
      const autoApprovedCount = await AutoApprovalService.processAutoApprovals(tenantId);
      if (autoApprovedCount > 0) {
        logger.info(`[SyncOrchestrator] Auto-approved ${autoApprovedCount} price changes for site ${siteId}`);
        await scrapeLogger.log({
          siteId,
          message: `✅ Auto-approved ${autoApprovedCount} price changes based on configured rules`,
          level: "INFO",
        });
      }
    } catch (error) {
      logger.error(`[SyncOrchestrator] Error processing auto-approvals for site ${siteId}:`, { error });
      await scrapeLogger.log({
        siteId,
        message: `⚠️ Auto-approval processing failed`,
        level: "WARNING",
      });
    }

    await scrapeLogger.log({
      siteId,
      message: `🚀 Sync operation completed. Review pending price changes in your dashboard.`,
      level: "SUCCESS",
    });

    metricsCollector.recordSyncLifecycle(siteId, 'STOP', { status: 'Completed' }).catch(console.error);

    await prisma.site.updateMany({
      where: { id: siteId, syncStartedAt: syncSessionStart },
      data: { isSyncing: false, syncState: "IDLE", lastSyncAt: new Date(), syncLastAction: "Idle" },
    });

    return { success: true };
  }
} // End of SyncOrchestrator
