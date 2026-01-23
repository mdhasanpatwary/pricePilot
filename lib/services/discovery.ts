import { ScraperService, ScrapeBlockError } from "./scraper";
import { prisma } from "@/lib/prisma";
import { getSyncQueue } from "@/lib/queue/client";
import { QUEUE_NAMES } from "@/lib/queue/types";

export class DiscoveryService {
  /**
   * Discover and match products on a competitor site for a tenant
   */
  static async discoverForSite(
    tenantId: string,
    siteId: string,
    syncSessionStart: Date,
  ) {
    console.log(
      `[DiscoveryService] Starting discovery for tenant ${tenantId} on site ${siteId}`,
    );

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
      console.log(
        "[DiscoveryService] No user products found. Skipping discovery.",
      );
      return { discoveredCount: 0, aborted: false };
    }

    // Initialize progress (Do NOT reset syncStartedAt here, preserve the session ID)
    await prisma.site.update({
      where: { id: siteId },
      data: {
        syncTotal: userProducts.length,
        syncProcessed: 0,
        syncLastAction: "Mapping terminal signals...",
      },
    });

    await prisma.syncLog.create({
      data: {
        siteId,
        message: `🔬 DISCOVERY PHASE: Scanning ${userProducts.length} products ...`,
        level: "INFO",
      },
    });

    const scraper = new ScraperService();
    let discoveredCount = 0;

    // Process in batches for better performance (Parallel Discovery)
    const BATCH_SIZE = 5;
    for (let i = 0; i < userProducts.length; i += BATCH_SIZE) {
      const batch = userProducts.slice(i, i + BATCH_SIZE);
      
      // Update progress for the entire batch
      const currentBatchStart = i + 1;
      const currentBatchEnd = Math.min(i + BATCH_SIZE, userProducts.length);
      
      try {
        const currentStatus = await prisma.site.findUnique({
          where: { id: siteId },
          select: { isSyncing: true, syncStartedAt: true },
        });

        if (!currentStatus?.isSyncing || currentStatus.syncStartedAt?.getTime() !== syncSessionStart.getTime()) {
           console.log(`[DiscoveryService] Aborting discovery (Session invalidated).`);
           return { discoveredCount, aborted: true };
        }

        await prisma.site.update({
          where: { id: siteId },
          data: {
            syncProcessed: i,
            syncLastAction: `Batch Scanning: ${currentBatchStart}-${currentBatchEnd}...`,
          },
        });
      } catch (e) {}

      // Run batch in parallel
      const batchResults = await Promise.all(batch.map(async (up, idx) => {
        // Quick check before starting this product
        const check = await prisma.site.findUnique({
          where: { id: siteId },
          select: { isSyncing: true, syncStartedAt: true }
        });
        if (!check?.isSyncing || check.syncStartedAt?.getTime() !== syncSessionStart.getTime()) {
          return { aborted: true }; 
        }
        const localProcessedIdx = i + idx + 1;
        const siteName = new URL(site.baseUrl).hostname.replace("www.", "");

        // Skip if match exists
        const existingMatch = await prisma.productMatch.findFirst({
           where: { userProductId: up.id, competitorProduct: { siteId: site.id } }
        });
        if (existingMatch) return { aborted: false };

        // Clean query: decoding common entities if they leaked from DB
        const cleanTitle = up.title
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");

        // Log: Starting search
        await prisma.syncLog.create({
          data: {
            siteId,
            message: `🔍 [${localProcessedIdx}] SEARCHING: "${up.title.substring(0, 30)}..." on ${siteName}`,
            level: "INFO",
          },
        });

        try {
          const result = await scraper.searchAndScrape(site.baseUrl, cleanTitle, siteId);

          if (result) {
            // ... (successful scrape logic)
            if (result.price === 0) {
              await prisma.syncLog.create({
                data: {
                  siteId,
                  message: `⚠️ [${localProcessedIdx}] PRICE MISSING: "${up.title.substring(0, 30)}..." (৳0)`,
                  level: "WARN",
                },
              });
              return { aborted: false };
            }

            await prisma.syncLog.create({
              data: {
                siteId,
                message: `✅ [${localProcessedIdx}] MATCH: "${up.title.substring(0, 30)}..." → ৳${result.price}`,
                level: "SUCCESS",
              },
            });

            // Atomic creation
            await prisma.$transaction(async (tx) => {
               const compProduct = await tx.product.create({
                  data: {
                    tenantId,
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
                    userProductId: up.id,
                    competitorProductId: compProduct.id,
                    matchType: "AUTO_SKU",
                    confidenceScore: 0.9,
                  }
               });

               await tx.priceHistory.create({
                  data: { productId: compProduct.id, price: result.price }
               });
            });
            discoveredCount++;
          } else {
            await prisma.syncLog.create({
              data: {
                siteId,
                message: `❌ [${localProcessedIdx}] FAILED: "${up.title.substring(0, 30)}..." - No match found on ${siteName}`,
                level: "ERROR",
              },
            });
          }
        } catch (error) {
           if (error instanceof ScrapeBlockError) {
              const retryAfter = 5 + Math.floor(Math.random() * 6); // 5 to 10 minutes
              const nextAttempt = new Date(Date.now() + retryAfter * 60 * 1000);

              await prisma.syncLog.create({
                data: {
                  siteId,
                  message: `🛡️ [${localProcessedIdx}] BLOCKED: "${up.title.substring(0, 30)}..." by ${error.provider}. Retrying in ${retryAfter}m.`,
                  level: "WARN",
                },
              });

              // Track in the list
              await (prisma as any).scrapeRetry.create({
                data: {
                  tenantId,
                  siteId,
                  userProductId: up.id,
                  reason: error.provider,
                  nextAttemptAt: nextAttempt,
                  status: "PENDING",
                }
              });

              // Queue a delayed job (as SINGLE retry might be too much overhead per product, 
              // but user asked for individual background retries).
              // We use RETRY type which we'll handle in worker.
              await getSyncQueue().add(QUEUE_NAMES.SYNC, {
                type: "RETRY",
                siteId,
                tenantId,
                productIds: [up.id]
              }, { delay: retryAfter * 60 * 1000 });

              // NEW: Trigger Golden Rule if advanced block detected during discovery
              if (error instanceof ScrapeBlockError && error.isAdvanced && !(site as any).isAdvancedProtected) {
                  await (prisma.site as any).update({
                      where: { id: siteId },
                      data: {
                          isAdvancedProtected: true,
                          lastSecurityBlockAt: new Date()
                      }
                  });
                  const { NotificationService } = await import("./notification");
                  // Simple ETA for discovery (approx 15s per remaining item)
                  const remaining = userProducts.length - localProcessedIdx;
                  const etaMins = Math.ceil((remaining * 15) / 60);
                  await NotificationService.sendSecurityNotice(tenantId, siteName, `${etaMins}m`);
                  
                  // Abort the entire discovery for this session - prevent spamming 700+ failures
                  // We return a specific value that will be checked outside Promise.all
                  return { aborted: true };
              }

           } else {
              console.error(`[DiscoveryService] Error searching "${up.title}":`, error);
              await prisma.syncLog.create({
                 data: {
                    siteId,
                    message: `⚠️ [${localProcessedIdx}] ERROR: Search failed for "${up.title.substring(0, 30)}..."`,
                    level: "ERROR",
                 }
              });
           }
        }
        return { aborted: false };
      }));

      if (batchResults.some((r: any) => r?.aborted)) {
         return { discoveredCount, aborted: true };
      }

      // Small throttle between batches to be nice to CPUs
      await new Promise(r => setTimeout(r, 1000));
    }

    // DO NOT call scraper.close() here as it shuts down the global BrowserPool singleton
    return { discoveredCount, aborted: false };
  }
}
