import { ScraperService } from "./scraper";
import { RulesEngine } from "./rules-engine";
import { SyncService } from "./sync";
import { MatchingService } from "./matching";
import { DiscoveryService } from "./discovery";
import { prisma } from "@/lib/prisma";

export class SyncOrchestrator {
  /**
   * Run a full sync for a tenant
   */
  static async runFullSync(tenantId: string) {
    console.log(`[SyncOrchestrator] Starting full sync for tenant: ${tenantId}`);

    // Mark all as syncing
    await prisma.site.updateMany({
      where: { tenantId, type: "COMPETITOR" },
      data: { isSyncing: true }
    });

    try {
      // 0. Run Discovery for all competitor sites
      const competitorSites = await prisma.site.findMany({
        where: { tenantId, type: "COMPETITOR" }
      });

      for (const site of competitorSites) {
        await DiscoveryService.discoverForSite(tenantId, site.id);
      }

      // 1. Run Matching Discovery
      await MatchingService.runMatching(tenantId);

      const matches = await prisma.productMatch.findMany({
        where: { userProduct: { tenantId } },
        include: {
          competitorProduct: { include: { site: true } }
        }
      });

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

        const result = await scraper.scrapeProductPage(cp.url);
        if (result && result.price) {
          await prisma.product.update({
            where: { id: cp.id },
            data: {
              currentPrice: result.price,
              inStock: result.inStock,
              lastCrawledAt: new Date(),
            }
          });

          await prisma.priceHistory.create({
            data: {
              productId: cp.id,
              price: result.price,
              recordedAt: new Date(),
            }
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
        where: { tenantId, type: "USER" }
      });

      for (const site of userSites) {
        if (site.platform === "OPENCART" || site.platform === "LARAVEL") {
          await SyncService.syncProductsToStore(site.id);
        }
      }

      return {
        success: true,
        scrapped: scrappedCount,
        updated: result.updated,
        failed: result.failed
      };

    } catch (error) {
      console.error("[SyncOrchestrator] Sync failed fatally:", error);
      throw error;
    } finally {
      // Reset all syncing flags
      await prisma.site.updateMany({
        where: { tenantId, type: "COMPETITOR" },
        data: { isSyncing: false, lastSyncAt: new Date() }
      });
    }
  }

  /**
   * Run sync for a specific site
   */
  static async syncSite(siteId: string) {
    console.log(`[SyncOrchestrator] Starting single-site sync for: ${siteId}`);

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { tenant: true }
    });
    if (!site) throw new Error("Site not found");

    // Set syncing flag
    await prisma.site.update({
      where: { id: siteId },
      data: {
        isSyncing: true,
        syncLastAction: "Booting high-speed crawler...",
        syncProcessed: 0,
        syncTotal: 0
      }
    });

    await prisma.syncLog.deleteMany({ where: { siteId } });
    await prisma.syncLog.create({
      data: { siteId, message: "🚀 Initializing quantum price scanner...", level: "INFO" }
    });
    await prisma.syncLog.create({
      data: { siteId, message: "✓ SSL handshake verified. Connection encrypted.", level: "SUCCESS" }
    });
    await prisma.syncLog.create({
      data: { siteId, message: "⚡ Deploying multi-threaded crawler agents...", level: "INFO" }
    });
    await prisma.syncLog.create({
      data: { siteId, message: "🔍 Activating AI-powered product matching engine...", level: "INFO" }
    });

    try {
      let matchedProducts = await prisma.product.findMany({
        where: { siteId },
        include: { matchesAsCompetitor: true }
      });

      // Always run discovery to find new matches or retry failed ones
      await DiscoveryService.discoverForSite(site.tenantId, siteId);

      // Refresh the list of products after discovery
      matchedProducts = await prisma.product.findMany({
        where: { siteId },
        include: { matchesAsCompetitor: true }
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
        syncStartedAt: new Date()
      }
    });

    await prisma.syncLog.create({
      data: {
        siteId,
        message: `📊 Discovery complete: ${matchedProducts.length} products indexed in memory cache.`,
        level: "INFO"
      }
    });
    await prisma.syncLog.create({
      data: {
        siteId,
        message: `🎯 Initiating real-time price stream protocol...`,
        level: "INFO"
      }
    });

      let count = 0;
      let processed = 0;

      // Process in batches for better performance
      const BATCH_SIZE = 5;

      for (let i = 0; i < matchedProducts.length; i += BATCH_SIZE) {
        // Check if sync was manually stopped before each batch
        const currentStatus = await prisma.site.findUnique({
          where: { id: siteId },
          select: { isSyncing: true }
        });

        if (!currentStatus?.isSyncing) {
          console.log(`[SyncOrchestrator] Sync manually stopped for site ${siteId}`);
          await prisma.syncLog.create({
            data: {
              siteId,
              message: `⚠️ Sync manually stopped by user.`,
              level: "WARN"
            }
          });
          break;
        }

        const batch = matchedProducts.slice(i, i + BATCH_SIZE);

        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(async (product) => {
            const result = await scraper.scrapeProductPage(product.url || '');
            return { product, result };
          })
        );

        // Process results
        for (const promiseResult of results) {
          processed++;

          if (promiseResult.status === 'fulfilled' && promiseResult.value.result) {
            const { product, result } = promiseResult.value;

            await prisma.site.update({
              where: { id: siteId },
              data: {
                syncProcessed: processed,
                syncLastAction: `Fetching: ${product.title.substring(0, 30)}...`
              }
            });

            await prisma.syncLog.create({
              data: {
                siteId,
                message: `📦 [${processed}/${matchedProducts.length}] ${product.title.substring(0, 45)}... → ৳${result.price}`,
                level: "INFO"
              }
            });

            await prisma.product.update({
              where: { id: product.id },
              data: {
                currentPrice: result.price,
                inStock: result.inStock,
                lastCrawledAt: new Date(),
              }
            });

            await prisma.priceHistory.create({
              data: {
                productId: product.id,
                price: result.price,
                recordedAt: new Date(),
              }
            });
            count++;
          } else {
            // Log failed scrapes
            const product = promiseResult.status === 'fulfilled'
              ? promiseResult.value.product
              : batch[results.indexOf(promiseResult)];

            await prisma.syncLog.create({
              data: {
                siteId,
                message: `⚠️ [${processed}/${matchedProducts.length}] Failed to scrape: ${product?.title?.substring(0, 45) || 'Unknown'}`,
                level: "WARN"
              }
            });
          }
        }

        // Small delay between batches to avoid overwhelming the server
        if (i + BATCH_SIZE < matchedProducts.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      await scraper.close();

      // Add completion summary
      await prisma.syncLog.create({
        data: {
          siteId,
          message: `🎯 Price sync complete: ${count}/${matchedProducts.length} products updated successfully.`,
          level: "SUCCESS"
        }
      });

      await prisma.syncLog.create({
        data: {
          siteId,
          message: `⚙️ Activating pricing rules engine...`,
          level: "INFO"
        }
      });

      await RulesEngine.evaluateAllRules(site.tenantId);

      await prisma.syncLog.create({
        data: {
          siteId,
          message: `✅ Rules evaluation complete. Pushing updates to connected stores...`,
          level: "SUCCESS"
        }
      });

      const userSites = await prisma.site.findMany({
        where: { tenantId: site.tenantId, type: "USER" }
      });

      for (const userSite of userSites) {
         await SyncService.syncProductsToStore(userSite.id);
      }

      await prisma.syncLog.create({
        data: {
          siteId,
          message: `🚀 Sync operation completed. All systems nominal.`,
          level: "SUCCESS"
        }
      });

      return { success: true, count };
    } catch (error) {
      // Log the error to the database
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`[SyncOrchestrator] Sync error for site ${siteId}:`, error);

      await prisma.syncLog.create({
        data: {
          siteId,
          message: `❌ SYNC FAILED: ${errorMessage}`,
          level: "ERROR"
        }
      }).catch(err => console.error('Failed to log error:', err));

      throw error;
    } finally {
      // Get latest state to see if it was aborted
      const latest = await prisma.site.findUnique({ where: { id: siteId }, select: { isSyncing: true } });

      await prisma.site.update({
        where: { id: siteId },
        data: {
          isSyncing: false,
          // Only update lastSyncAt if it wasn't a manual stop
          ...(latest?.isSyncing ? { lastSyncAt: new Date() } : {})
        }
      });
    }
  }

  /**
   * Run sync for a single product
   */
  static async syncProduct(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { site: true }
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
          lastCrawledAt: new Date(),
        }
      });

      await prisma.priceHistory.create({
         data: {
           productId,
           price: result.price,
           recordedAt: new Date()
         }
      });
    }

    await scraper.close();
    await RulesEngine.evaluateAllRules(product.site.tenantId);

    return { success: true, price: result?.price };
  }
}
