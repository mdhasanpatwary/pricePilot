import { ScraperService } from "./scraper";
import { RulesEngine } from "./rules-engine";
import { SyncService } from "./sync";
import { MatchingService } from "./matching";
import { prisma } from "@/lib/prisma";

export class SyncOrchestrator {
  /**
   * Run a full sync for a tenant
   * 1. Discover matches for new products
   * 2. Scrape all competitor products
   * 3. Re-evaluate pricing rules
   * 4. Sync changes back to the user's store
   */
  static async runFullSync(tenantId: string) {
    console.log(`[SyncOrchestrator] Starting full sync for tenant: ${tenantId}`);

    try {
      // 1. Run Matching Discovery for new products
      console.log(`[SyncOrchestrator] Discovery new matches...`);
      await MatchingService.runMatching(tenantId);
      // 1. Get all matches for this tenant to identify which competitors to scrape
      const matches = await prisma.productMatch.findMany({
        where: {
          userProduct: { tenantId }
        },
        include: {
          competitorProduct: {
            include: {
              site: true
            }
          }
        }
      });

      if (matches.length === 0) {
        console.log(`[SyncOrchestrator] No matches found for tenant. Skipping sync.`);
        return { success: true, updated: 0, scrapped: 0 };
      }

      // 2. Scrape competitor prices
      const scraper = new ScraperService();
      await scraper.init();

      let scrappedCount = 0;
      const scrapedProductsMap = new Map<string, unknown>();

      for (const match of matches) {
        const cp = match.competitorProduct;

        // Skip if we don't have a URL
        if (!cp.url) continue;

        // Don't scrape the same product twice in one run
        if (scrapedProductsMap.has(cp.id)) continue;

        console.log(`[SyncOrchestrator] Scraping: ${cp.url}`);
        const result = await scraper.scrapeProductPage(cp.url);

        if (result && result.price) {
          // Update competitor product price in DB
          await prisma.product.update({
            where: { id: cp.id },
            data: {
              currentPrice: result.price,
              inStock: result.inStock,
              lastCrawledAt: new Date(),
            }
          });

          // Record price history
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
      console.log(`[SyncOrchestrator] Scrapped ${scrappedCount} competitor products.`);

      // 3. Evaluate Pricing Rules
      console.log(`[SyncOrchestrator] Evaluating pricing rules...`);
      const recommendations = await RulesEngine.evaluateAllRules(tenantId);

      if (recommendations.length === 0) {
        console.log(`[SyncOrchestrator] No price changes recommended.`);
        return { success: true, updated: 0, scrapped: scrappedCount };
      }

      // 4. Execute Price Changes (Internal and External)
      console.log(`[SyncOrchestrator] Executing ${recommendations.length} price changes...`);
      const result = await RulesEngine.executePriceChanges(recommendations);

      // 5. Trigger external sync to OpenCart/Laravel stores
      const userSites = await prisma.site.findMany({
        where: { tenantId, type: "USER" }
      });

      for (const site of userSites) {
        if (site.platform === "OPENCART" || site.platform === "LARAVEL") {
          console.log(`[SyncOrchestrator] Syncing to ${site.platform} at ${site.baseUrl}`);
          await SyncService.syncProductsToStore(site.id);
        }
      }

      console.log(`[SyncOrchestrator] Sync complete! Updated ${result.updated} products.`);
      return {
        success: true,
        scrapped: scrappedCount,
        updated: result.updated,
        failed: result.failed
      };

    } catch (error) {
      console.error("[SyncOrchestrator] Sync failed fatally:", error);
      throw error;
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

    // Get all competitor products for this site that are matched to user products
    const matchedProducts = await prisma.product.findMany({
      where: {
        siteId,
      },
      include: {
        matchesAsCompetitor: true
      }
    });

    const scraper = new ScraperService();
    await scraper.init();

    let count = 0;
    for (const product of matchedProducts) {
      if (!product.url) continue;

      const result = await scraper.scrapeProductPage(product.url);
      if (result && result.price) {
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
      }
    }

    await scraper.close();

    // Trigger rule evaluation for the tenant
    await RulesEngine.evaluateAllRules(site.tenantId);

    // Sync to user stores
    const userSites = await prisma.site.findMany({
      where: { tenantId: site.tenantId, type: "USER" }
    });

    for (const userSite of userSites) {
       await SyncService.syncProductsToStore(userSite.id);
    }

    return { success: true, count };
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

    // Re-evaluate rules for this product's tenant
    await RulesEngine.evaluateAllRules(product.site.tenantId);

    return { success: true, price: result?.price };
  }
}
