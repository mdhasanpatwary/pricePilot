import { ScraperService, ScrapeBlockError } from "./scraper";
import { RulesEngine } from "./rules-engine";
import { SyncService } from "./sync";
import { MatchingService } from "./matching";
import { DiscoveryService } from "./discovery";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "./notification";
import { withRetry } from "@/lib/utils/timeout";
import { SystemConfigService } from "@/lib/config";
import { getSyncQueue } from "@/lib/queue/client";
import { QUEUE_NAMES } from "@/lib/queue/types";
import { logger } from "../logger";
import { circuitBreakerRegistry } from "@/lib/utils/circuit-breaker";

export class SyncOrchestrator {
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
    await (prisma.site as any).update({
      where: { id: siteId },
      data: {
        isAdvancedProtected: true,
        lastSecurityBlockAt: new Date()
      }
    });

    // ETA: 12s average * products
    const etaSeconds = productCount * 12;
    const etaMinutes = Math.ceil(etaSeconds / 60);
    const etaString = etaMinutes > 60
      ? `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m`
      : `${etaMinutes}m`;

    await NotificationService.sendSecurityNotice(tenantId, siteName, etaString);

    await prisma.syncLog.create({
      data: {
        siteId,
        message: `🚨 Golden Rule Activated! Advanced protection detected. Scraper slowing down (ETA: ~${etaString}).`,
        level: "WARN"
      }
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

    await getSyncQueue().add(QUEUE_NAMES.SYNC, {
      type: "FULL",
      tenantId,
    }, { priority: 5 }); // Lowest priority for mass background syncs
    return { success: true, message: "Full sync job queued successfully." };
  }

  /**
   * Dispatch a single site sync job to the queue
   */
  static async dispatchSiteSync(siteId: string) {
    await getSyncQueue().add(QUEUE_NAMES.SYNC, {
      type: "SINGLE",
      siteId,
    }, { priority: 2 }); // Higher priority for user-triggered single site syncs
    return { success: true, message: "Site sync job queued successfully." };
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
        await getSyncQueue().add(QUEUE_NAMES.SYNC, {
          type: "SINGLE",
          siteId: site.id,
          isCron: isCron,
        }, {
          jobId: `sync-${site.id}-${syncSessionStart.getTime()}`,
          priority: isCron ? 4 : 2
        });
      }

      await prisma.syncLog.create({
        data: {
          siteId: competitorSites[0]?.id || "", // Just use first for generic log
          message: `📊 Distributed ${competitorSites.length} site sync jobs to worker cluster.`,
          level: "INFO",
        }
      });

      return { success: true, dispatched: competitorSites.length };

      // 1. Run Matching Discovery
      await MatchingService.runMatching(tenantId);

      const matches = (await (prisma.productMatch as any).findMany({
        where: {
          userProduct: { tenantId },
          status: { in: ["PENDING", "APPROVED"] } as any,
        },
        include: {
          competitorProduct: { include: { site: true } },
        },
      })) as any[];

      if (matches.length === 0) {
        return { success: true, updated: 0, scrapped: 0 };
      }

      // 2. Scrape competitor prices
      const scraper = new ScraperService();
      await scraper.init();

      let scrappedCount = 0;
      const scrapedProductsMap = new Map<string, unknown>();

      for (const match of matches) {
        const cp = match.competitorProduct;
        if (!cp.url || scrapedProductsMap.has(cp.id)) continue;

        // Check if this specific site should still be syncing
        // (Since FULL sync locks all sites at once, we should check individual flags if user wants to stop one)
        const siteStatus = await prisma.site.findUnique({
          where: { id: cp.siteId },
          select: { isSyncing: true }
        });
        if (siteStatus?.isSyncing === false) continue;

        // 20-HOUR FRESHNESS CHECK: Skip if already fetched within the last 20 hours
        const REFRESH_WINDOW_MS = 20 * 60 * 60 * 1000;
        const isFresh = cp.lastCrawledAt && (Date.now() - cp.lastCrawledAt.getTime() < REFRESH_WINDOW_MS);

        if (isFresh || (cp.lastCrawledAt && cp.lastCrawledAt.getTime() >= syncSessionStart.getTime())) {
          scrappedCount++;
          continue;
        }

        // Skip if this product's site is currently being synced by another independent session
        // This prevents double-scraping and progress indicators jumping around.
        // Golden Rule: Skip advanced protected sites if it's a cron and not off-peak
        if (cp.site.isAdvancedProtected && isCron && !this.isOffPeak()) {
          continue;
        }

        try {
          // Golden Rule: Add delay if advanced protected
          if (cp.site.isAdvancedProtected) {
            const delay = 8000 + Math.random() * 7000; // 8-15s
            await new Promise(r => setTimeout(r, delay));
          }

          // Use circuit breaker for site-specific failures
          const siteBreaker = circuitBreakerRegistry.getBreaker(`scraper-${cp.siteId}`, {
            failureThreshold: 3,
            recoveryTimeout: 300000, // 5 minutes
          });

          const result = await siteBreaker.execute(
            () => scraper.scrapeProductPage(cp.url),
            async () => {
              logger.warn(`[SyncOrchestrator] Circuit breaker OPEN for site ${cp.siteId}, skipping scrape`);
              return null;
            }
          );

          if (result?.price) {
            const res = result!;
            // ... (rest of the update logic)
            await prisma.$transaction(async (tx) => {
              await tx.product.update({
                where: { id: cp.id },
                data: {
                  currentPrice: res.price,
                  inStock: res.inStock,
                  imageUrl: res.imageUrl || (cp as any).imageUrl,
                  specifications: res.specifications || (cp as any).specifications, // Save Specs
                  lastCrawledAt: new Date(),
                } as any,
              });

              await tx.priceHistory.create({
                data: {
                  productId: cp.id,
                  price: res.price,
                  recordedAt: new Date(),
                },
              });
            });

            if (res.imageUrl) {
              logger.info(
                `[Sync] Saved image for ${cp.title}: ${res.imageUrl!.substring(0, 50)}...`,
              );
            } else {
              logger.info(`[Sync] No image found for ${cp.title}`);
            }

            scrapedProductsMap.set(cp.id, res);
            scrappedCount++;
          }
        } catch (error) {
          if (error instanceof ScrapeBlockError && (error as ScrapeBlockError).isAdvanced) {
            await this.handleSecurityBlock(cp.siteId, tenantId, cp.site.baseUrl, matches.length - scrappedCount);
          }
          logger.error(`[SyncOrchestrator] Error scraping ${cp.url}:`, { error });
        }
      }

      await scraper.close();

      // 3. Evaluate Pricing Rules
      const recommendations = await RulesEngine.evaluateAllRules(tenantId);
      if (recommendations.length === 0) {
        return { success: true, updated: 0, scrapped: scrappedCount };
      }

      // 4. Execute Price Changes
      const result = await RulesEngine.executePriceChanges(recommendations);

      // 5. Trigger external sync
      const userSites = await prisma.site.findMany({
        where: { tenantId, type: "USER" },
      });

      for (const site of userSites) {
        if (site.platform === "OPENCART" || site.platform === "LARAVEL") {
          await SyncService.syncProductsToStore(site.id);
        }
      }

      const finalResult = {
        success: true,
        scrapped: scrappedCount,
        updated: result.updated,
        failed: result.failed,
      };

      await NotificationService.sendSyncSuccess(
        tenantId,
        `Sync complete! Scrapped ${scrappedCount} products and updated ${result.updated} store prices.`,
      );

      return finalResult;
    } catch (error) {
      logger.error("[SyncOrchestrator] Sync failed fatally:", { error });
      await NotificationService.sendSyncError(
        tenantId,
        `Fatal sync error: ${error instanceof Error ? error.message : "Internal service failure"}`,
      );
      throw error;
    } finally {
      // Reset only sites belonging to this specific session
      await prisma.site.updateMany({
        where: {
          tenantId,
          type: "COMPETITOR",
          syncStartedAt: syncSessionStart,
        },
        data: { isSyncing: false, lastSyncAt: new Date() },
      });
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

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { tenant: true },
    });
    if (!site) throw new Error("Site not found");

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
      await prisma.syncLog.create({
        data: {
          siteId,
          message: "🚀 Initializing quantum price scanner...",
          level: "INFO",
        },
      });
    } else {
      logger.info(
        `[SyncOrchestrator] RESUMING sync for site ${siteId} from session ${syncSessionStart.toISOString()}`,
      );
      await prisma.syncLog.create({
        data: {
          siteId,
          message: "♻️ Resuming interrupted sync session...",
          level: "INFO",
        },
      });

      // Verification: Ensure the session is still marked as active in DB
      const verify = await prisma.site.findUnique({ where: { id: siteId }, select: { isSyncing: true, syncStartedAt: true } });
      if (!verify?.isSyncing || verify.syncStartedAt?.getTime() !== syncSessionStart.getTime()) {
        return { success: true, message: "Resumed session already halted" };
      }
    }
    // ... (logs) ...

    try {
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

      const scraper = new ScraperService();
      await scraper.init();

      // Initialize progress
      await prisma.site.update({
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
        // ... cleanup ...
      }

      // Golden Rule Settings
      let isGoldenRule = (site as any).isAdvancedProtected;
      if (isGoldenRule && isCron && !this.isOffPeak()) {
        await prisma.syncLog.create({
          data: {
            siteId,
            message: "🛡️ Golden Rule: Off-peak hours only. Sync deferred to night.",
            level: "WARN"
          }
        });
        return { success: true, message: "Sync deferred to off-peak" };
      }

      // Process in batches for better performance
      const BATCH_SIZE = await SystemConfigService.get("SCRAPER_BATCH_SIZE", 5);
      const effectiveBatchSize = isGoldenRule ? 1 : BATCH_SIZE;

      for (let i = 0; i < productsToScrape.length; i += effectiveBatchSize) {
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

        const batch = productsToScrape.slice(i, i + BATCH_SIZE);

        // Process batch in parallel with retry logic
        const SCRAPE_TIMEOUT = await SystemConfigService.get(
          "SCRAPER_TIMEOUT",
          45000,
        );
        const MAX_RETRIES = await SystemConfigService.get(
          "SCRAPER_MAX_RETRIES",
          3,
        );

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
            const result = await withRetry(
              () => scraper.scrapeProductPage(product.url || ""),
              MAX_RETRIES,
              SCRAPE_TIMEOUT,
            );
            return { product, result };
          }),
        )) as any[];

        // Process results
        for (const promiseResult of results) {
          processed++;

          if (
            promiseResult.status === "fulfilled" &&
            promiseResult.value.result
          ) {
            const { product, result } = promiseResult.value;

            await prisma.site.update({
              where: { id: siteId },
              data: {
                syncProcessed: processed,
                syncLastAction: `Fetching: ${product.title.substring(0, 30)}...`,
              },
            });

            await prisma.syncLog.create({
              data: {
                siteId,
                message: `📦 [${processed}/${matchedProducts.length}] ${product.title.substring(0, 45)}... → ৳${result.price}`,
                level: "INFO",
              },
            });

            const oldPrice = parseFloat(product.currentPrice.toString());
            const oldStock = product.inStock;

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

            await prisma.priceHistory.create({
              data: {
                productId: product.id,
                price: result.price,
                recordedAt: new Date(),
              },
            });
            count++;
          } else {
            // Log failed scrapes with reason
            const product =
              promiseResult.status === "fulfilled"
                ? promiseResult.value.product
                : batch[results.indexOf(promiseResult)];

            const errorReason =
              promiseResult.status === "rejected"
                ? promiseResult.reason?.message?.includes("BLOCKED")
                  ? `🛡️ Blocked: ${promiseResult.reason.message.replace("BLOCKED: ", "")}`
                  : promiseResult.reason?.message?.includes("timeout")
                    ? "⏱️ Timeout"
                    : "❌ Error"
                : "⚠️ No data";

            // Advanced Block Detection
            if (promiseResult.status === "rejected" && !isGoldenRule) {
              const error = promiseResult.reason;
              if (error instanceof ScrapeBlockError && error.isAdvanced) {
                const urlObj = new URL(site.baseUrl);
                await this.handleSecurityBlock(siteId, site.tenantId, urlObj.hostname, productsToScrape.length - processed);
                isGoldenRule = true;
              }
            }

            await prisma.syncLog.create({
              data: {
                siteId,
                message: `${errorReason} [${processed}/${matchedProducts.length}] ${product?.title?.substring(0, 40) || "Unknown"}`,
                level: "WARN",
              },
            });
          }
        }

        // Small delay between batches to avoid overwhelming the server
        if (i + BATCH_SIZE < matchedProducts.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
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
      await prisma.syncLog.create({
        data: {
          siteId,
          message: `🎯 Price sync complete: ${count}/${matchedProducts.length} products updated successfully.`,
          level: "SUCCESS",
        },
      });

      await prisma.syncLog.create({
        data: {
          siteId,
          message: `⚙️ Activating pricing rules engine...`,
          level: "INFO",
        },
      });

      await RulesEngine.evaluateAllRules(site.tenantId);

      await prisma.syncLog.create({
        data: {
          siteId,
          message: `✅ Rules evaluation complete. Pushing updates to connected stores...`,
          level: "SUCCESS",
        },
      });

      const userSites = await prisma.site.findMany({
        where: { tenantId: site.tenantId, type: "USER" },
      });

      for (const userSite of userSites) {
        // Double check session is still valid before pushing to each store
        const pushCheck = await prisma.site.findUnique({ where: { id: siteId }, select: { isSyncing: true, syncStartedAt: true } });
        if (!pushCheck?.isSyncing || pushCheck.syncStartedAt?.getTime() !== syncSessionStart.getTime()) break;

        await SyncService.syncProductsToStore(userSite.id);
      }

      await prisma.syncLog.create({
        data: {
          siteId,
          message: `🚀 Sync operation completed. All systems nominal.`,
          level: "SUCCESS",
        },
      });

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
        await prisma.syncLog
          .create({
            data: {
              siteId,
              message: `❌ SYNC FAILED: ${errorMessage}`,
              level: "ERROR",
            },
          })
          .catch((err) => logger.error("Failed to log error:", { error: err }));
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
      include: { site: true },
    });

    if (!product || !product.url) throw new Error("Product or URL not found");

    const scraper = new ScraperService();
    await scraper.init();

    const result = await scraper.scrapeProductPage(product.url);
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

      await prisma.priceHistory.create({
        data: {
          productId,
          price: result.price,
          recordedAt: new Date(),
        },
      });
    }

    await RulesEngine.evaluateAllRules(product.site.tenantId);

    return { success: true, price: result?.price };
  }

  /**
   * Run sync for a specific chunk of products
   */
  static async processChunkSync(siteId: string, productIds: string[]) {
    logger.info(
      `[SyncOrchestrator] Processing chunk of ${productIds.length} products for site ${siteId}`,
    );
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const scraper = new ScraperService();
    await scraper.init();

    for (const product of products) {
      if (!product.url) continue;
      const result = await scraper.scrapeProductPage(product.url);
      if (result && result.price) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            currentPrice: result.price,
            inStock: result.inStock,
            lastCrawledAt: new Date(),
          },
        });
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
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site || !site.isSyncing) return;

    logger.info(`[SyncOrchestrator] Starting retry sync for ${productIds.length} products on site ${siteId}`);

    const scraper = new ScraperService();

    for (const productId of productIds) {
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

      // Update status to mark we are trying
      await (prisma as any).scrapeRetry.updateMany({
        where: { userProductId: productId, siteId, status: "PENDING" },
        data: { updatedAt: new Date() }
      });

      try {
        const cleanTitle = userProduct.title.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        const result = await scraper.searchAndScrape(site.baseUrl, cleanTitle, siteId);

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
            const retryAfter = 10 + Math.floor(Math.random() * 10); // Longer delay: 10-20m
            const nextAttempt = new Date(Date.now() + retryAfter * 60 * 1000);

            await (prisma as any).scrapeRetry.update({
              where: { id: retryRecord.id },
              data: {
                retryCount: { increment: 1 },
                nextAttemptAt: nextAttempt,
                reason: error.provider || "BLOCK",
              }
            });

            await getSyncQueue().add(QUEUE_NAMES.SYNC, {
              type: "RETRY",
              siteId,
              tenantId: userProduct.tenantId,
              productIds: [productId]
            }, { delay: retryAfter * 60 * 1000 });

            await prisma.syncLog.create({
              data: {
                siteId,
                message: `🛡️ [RETRY] STILL BLOCKED: "${userProduct.title.substring(0, 30)}...". Attempt ${retryRecord.retryCount + 1} scheduled.`,
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
