import { ScraperService } from "./scraper";
import { prisma } from "@/lib/prisma";
import { MatchType } from "@prisma/client";

export class DiscoveryService {
  /**
   * Discover and match products on a competitor site for a tenant
   */
  static async discoverForSite(tenantId: string, siteId: string) {
    console.log(`[DiscoveryService] Starting discovery for tenant ${tenantId} on site ${siteId}`);

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new Error("Site not found");

    // 1. Get all user products for this tenant
    const userProducts = await prisma.product.findMany({
      where: {
        tenantId,
        site: { type: "USER" },
      },
    });

    if (userProducts.length === 0) {
      console.log("[DiscoveryService] No user products found. Skipping discovery.");
      return 0;
    }

    // Initialize progress
    await prisma.site.update({
      where: { id: siteId },
      data: {
        syncTotal: userProducts.length,
        syncProcessed: 0,
        syncLastAction: "Mapping terminal signals...",
        syncStartedAt: new Date()
      }
    });

    await prisma.syncLog.create({
      data: {
        siteId,
        message: `🔬 DISCOVERY PHASE: Scanning ${userProducts.length} products across competitor catalog...`,
        level: "INFO"
      }
    });
    await prisma.syncLog.create({
      data: {
        siteId,
        message: `🧠 Neural matching algorithm activated. Preparing semantic analysis...`,
        level: "INFO"
      }
    });

    const scraper = new ScraperService();
    let discoveredCount = 0;
    let processedCount = 0;

    for (const up of userProducts) {
      processedCount++;

      // Check for manual stop
      const currentStatus = await prisma.site.findUnique({
        where: { id: siteId },
        select: { isSyncing: true }
      });
      if (!currentStatus?.isSyncing) break;

      // Update progress every product (or every few)
      await prisma.site.update({
        where: { id: siteId },
        data: {
          syncProcessed: processedCount,
          syncLastAction: `Searching: ${up.title.substring(0, 30)}...`
        }
      });

      await prisma.syncLog.create({
        data: {
          siteId,
          message: `🔎 [${processedCount}/${userProducts.length}] Searching: "${up.title.substring(0, 40)}${up.title.length > 40 ? '...' : ''}"`,
          level: "INFO"
        }
      });
      // Skip if we already have a match for this product on this site
      const existingMatch = await prisma.productMatch.findFirst({
        where: {
          userProductId: up.id,
          competitorProduct: { siteId: site.id }
        }
      });

      if (existingMatch) continue;

      // Try to find the product on the competitor site
      const result = await scraper.searchAndScrape(site.baseUrl, up.title);

      if (result) {
        await prisma.syncLog.create({
          data: { siteId, message: `✅ MATCH CONFIRMED: "${up.title.substring(0, 35)}..." → ৳${result.price} (${result.brand || 'Unknown'})`, level: "SUCCESS" }
        });
        // Create the product in our DB for this competitor
        const compProduct = await prisma.product.create({
          data: {
            tenantId,
            siteId: site.id,
            url: result.url,
            title: result.title,
            currentPrice: result.price,
            sku: result.sku || null,
            brand: result.brand || null,
            model: result.model || null,
            inStock: result.inStock,
            currency: result.currency || "USD",
            lastCrawledAt: new Date(),
          }
        });

        // Create the match record
        await prisma.productMatch.create({
          data: {
            userProductId: up.id,
            competitorProductId: compProduct.id,
            matchType: "AUTO_SKU", // Default to SKU-like auto match
            confidenceScore: 0.90, // Initial confidence
          }
        });

        // Record price history
        await prisma.priceHistory.create({
          data: {
            productId: compProduct.id,
            price: result.price,
          }
        });

        discoveredCount++;
      }
    }

    await scraper.close();
    return discoveredCount;
  }
}
