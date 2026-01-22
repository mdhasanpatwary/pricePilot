import { ScraperService } from "./scraper";
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

export class SyncOrchestrator {
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
    });
    return { success: true, message: "Full sync job queued successfully." };
  }

  /**
   * Dispatch a single site sync job to the queue
   */
  static async dispatchSiteSync(siteId: string) {
    await getSyncQueue().add(QUEUE_NAMES.SYNC, {
      type: "SINGLE",
      siteId,
    });
    return { success: true, message: "Site sync job queued successfully." };
  }

  /**
   * Run a full sync for a tenant (Executed by Worker)
   */
  static async processFullSync(tenantId: string) {
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

      for (const site of competitorSites) {
        await DiscoveryService.discoverForSite(
          tenantId,
          site.id,
          syncSessionStart,
        );
      }

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

        // Skip if this product's site is currently being synced by another independent session
        // This prevents double-scraping and progress indicators jumping around.
        if (
          cp.site.isSyncing &&
          cp.site.syncStartedAt?.getTime() !== syncSessionStart.getTime()
        ) {
          continue;
        }

        const result = await scraper.scrapeProductPage(cp.url);
        if (result && result.price) {
          await prisma.product.update({
            where: { id: cp.id },
            data: {
              currentPrice: result.price,
              inStock: result.inStock,
              imageUrl: result.imageUrl || (cp as any).imageUrl,
              lastCrawledAt: new Date(),
            } as any,
          });

          if (result.imageUrl) {
            logger.info(
              `[Sync] Saved image for ${cp.title}: ${result.imageUrl.substring(0, 50)}...`,
            );
          } else {
            logger.info(`[Sync] No image found for ${cp.title}`);
          }

          await prisma.priceHistory.create({
            data: {
              productId: cp.id,
              price: result.price,
              recordedAt: new Date(),
            },
          });

          scrapedProductsMap.set(cp.id, result);
          scrappedCount++;
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
  static async processSiteSync(siteId: string, force: boolean = false) {
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

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { tenant: true },
    });
    if (!site) throw new Error("Site not found");

    // Set syncing flag atomically to prevent race conditions
    const syncSessionStart = new Date(); // Unique Session ID for this run

    // ATOMIC LOCK ACQUISITION
    const updateResult = await prisma.site.updateMany({
      where: {
        id: siteId,
        isSyncing: force ? undefined : false, // If forcing, we don't care about current state
      },
      data: {
        isSyncing: true,
        syncLastAction: "Booting high-speed crawler...",
        syncProcessed: 0,
        syncTotal: 0,
        syncStartedAt: syncSessionStart,
      },
    });

    if (updateResult.count === 0 && !force) {
      logger.info(
        `[SyncOrchestrator] Site ${siteId} is already syncing or record missing, skipping duplicate request`,
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
    // ... (logs) ...

    try {
      let matchedProducts = await prisma.product.findMany({
        where: { siteId },
        include: { matchesAsCompetitor: true },
      });

      // Always run discovery to find new matches or retry failed ones
      // Pass the session ID to kill zombies in discovery phase
      await DiscoveryService.discoverForSite(
        site.tenantId,
        siteId,
        syncSessionStart,
      );

      // Refresh the list of products after discovery
      matchedProducts = await prisma.product.findMany({
        where: { siteId },
        include: { matchesAsCompetitor: true },
      });

      const scraper = new ScraperService();
      await scraper.init();

      // Initialize progress
      await prisma.site.update({
        where: { id: siteId },
        data: {
          syncTotal: matchedProducts.length,
          syncProcessed: 0,
          syncLastAction: "Scanning for store matches...",
          // syncStartedAt: new Date() // REMOVED: Do not reset session ID
        },
      });

      // ... (logs) ...

      let count = 0;
      let processed = 0;

      // Process in batches for better performance
      const BATCH_SIZE = await SystemConfigService.get("SCRAPER_BATCH_SIZE", 5);

      for (let i = 0; i < matchedProducts.length; i += BATCH_SIZE) {
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

        const batch = matchedProducts.slice(i, i + BATCH_SIZE);

        // Process batch in parallel with retry logic
        const SCRAPE_TIMEOUT = await SystemConfigService.get(
          "SCRAPER_TIMEOUT",
          45000,
        );
        const MAX_RETRIES = await SystemConfigService.get(
          "SCRAPER_MAX_RETRIES",
          3,
        );

        const results = await Promise.allSettled(
          batch.map(async (product) => {
            const result = await withRetry(
              () => scraper.scrapeProductPage(product.url || ""),
              MAX_RETRIES,
              SCRAPE_TIMEOUT,
            );
            return { product, result };
          }),
        );

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
                ? promiseResult.reason?.message?.includes("timeout")
                  ? "⏱️ Timeout"
                  : "❌ Error"
                : "⚠️ No data";

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

      await scraper.close();

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

    await scraper.close();
    await RulesEngine.evaluateAllRules(product.site.tenantId);

    return { success: true, price: result?.price };
  }
}
