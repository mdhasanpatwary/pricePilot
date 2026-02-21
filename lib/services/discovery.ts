import { ScrapeBlockError } from "./scraper";
import { prisma } from "@/lib/prisma";
import { getSyncQueue } from "@/lib/queue/client";
import { QUEUE_NAMES } from "@/lib/queue/types";
import { withDbRetry } from "@/lib/utils/db-retry";
import { SystemConfigService } from "@/lib/config";
import {
  extractSlugFromUrl,
  normalizeCanonicalUrl,
  normalizeProductSlug,
  normalizeSku,
} from "@/lib/services/product-dedup";
import { ScrapingEngineService } from "@/lib/services/scraping-engine-service";
import { markSiteAsAdvancedProtected } from "@/lib/services/advanced-access";

function sanitizeQueueSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function buildInitialRetryJobId(siteId: string, productId: string): string {
  return `retry-${sanitizeQueueSegment(siteId)}-${sanitizeQueueSegment(productId)}-a0`;
}

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

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        baseUrl: true,
        isAdvancedProtected: true,
        syncProcessed: true,
        syncTotal: true,
      },
    });
    if (!site) throw new Error("Site not found");

    // 1. Get all user products for this tenant
    const userProducts = await prisma.product.findMany({
      where: {
        tenantId,
        Site: { type: "USER" },
      },
      orderBy: { id: "asc" },
    });

    if (userProducts.length === 0) {
      console.log(
        "[DiscoveryService] No user products found. Skipping discovery.",
      );
      return { discoveredCount: 0, aborted: false };
    }

    // FIX: Fetch all existing matches upfront to avoid N+1 queries
    const userProductIds = userProducts.map(p => p.id);
    const existingMatches = await prisma.productMatch.findMany({
      where: {
        userProductId: { in: userProductIds },
        competitorProduct: { siteId: site.id }
      },
      select: { userProductId: true }
    });

    // Create a Set for O(1) lookup
    const matchedProductIds = new Set(existingMatches.map(m => m.userProductId));

    // Initialize progress - only reset if we're starting fresh, otherwise preserve for UI continuity
    const shouldReset = !site.syncProcessed || site.syncProcessed >= site.syncTotal;

    await prisma.site.updateMany({
      where: { id: siteId },
      data: {
        syncTotal: userProducts.length,
        syncProcessed: shouldReset ? 0 : site.syncProcessed,
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

    let discoveredCount = 0;

    // Process in batches for better performance (Parallel Discovery)
    const configuredBatchSize = await SystemConfigService.get("SCRAPER_BATCH_SIZE", 5);
    const normalizedBatchSize =
      Number.isFinite(configuredBatchSize) && configuredBatchSize > 0
        ? Math.floor(configuredBatchSize)
        : 5;
    const devBatchCapRaw = Number(process.env.SCRAPER_BATCH_SIZE_DEV_MAX || 2);
    const devBatchCap =
      Number.isFinite(devBatchCapRaw) && devBatchCapRaw > 0
        ? Math.floor(devBatchCapRaw)
        : 2;
    const BATCH_SIZE =
      process.env.NODE_ENV === "production"
        ? normalizedBatchSize
        : Math.min(normalizedBatchSize, devBatchCap);

    for (let i = shouldReset ? 0 : (site.syncProcessed || 0); i < userProducts.length; i += BATCH_SIZE) {
      const batch = userProducts.slice(i, i + BATCH_SIZE);
      const itemTimeoutMsRaw = Number(process.env.DISCOVERY_ITEM_TIMEOUT_MS || 90000);
      const itemTimeoutMs = Number.isFinite(itemTimeoutMsRaw)
        ? Math.max(15000, itemTimeoutMsRaw)
        : 90000;
      let completedInBatch = 0;
      let lastPersistedProcessed = Math.max(i, site.syncProcessed || 0);

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

        await prisma.site.updateMany({
          where: { id: siteId },
          data: {
            syncProcessed: Math.max(i, site.syncProcessed || 0),
            syncLastAction: `Batch Scanning: ${currentBatchStart}-${currentBatchEnd}...`,
          },
        });

        const persistProgress = async (force = false) => {
          const processedNow = Math.min(userProducts.length, i + completedInBatch);
          if (!force && processedNow % 5 !== 0 && processedNow !== userProducts.length) return;
          if (processedNow <= lastPersistedProcessed) return;

          lastPersistedProcessed = processedNow;
          await prisma.site.updateMany({
            where: { id: siteId },
            data: {
              syncProcessed: processedNow,
              syncLastAction: `Discovery: ${processedNow}/${userProducts.length} scanned...`,
            },
          });
        };

        // Run batch in parallel but skip redundant individual site checks
        const batchResults = await Promise.all(batch.map(async (up, idx) => {
          const localProcessedIdx = i + idx + 1;
          const siteName = new URL(site.baseUrl).hostname.replace("www.", "");

          // FIX: Use the pre-fetched Set instead of querying
          if (matchedProductIds.has(up.id)) {
            return { aborted: false };
          }

          // Clean query: decoding common entities if they leaked from DB
          const cleanTitle = up.title
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

          // Reduced noise: log batch start only or every 10th search if batch is large
          if (localProcessedIdx % 10 === 0 || localProcessedIdx === 1) {
            await prisma.syncLog.create({
              data: {
                siteId,
                message: `🔍 [${localProcessedIdx}/${userProducts.length}] SCANNING: "${up.title.substring(0, 30)}..." on ${siteName}`,
                level: "INFO",
              },
            });
          }

          try {
            const result = await Promise.race([
              ScrapingEngineService.searchAndScrape(site.baseUrl, cleanTitle, {
                siteId,
                tenantId,
                context: "discovery",
              }),
              new Promise<null>((_, reject) => {
                setTimeout(
                  () => reject(new Error(`timeout: discovery item exceeded ${itemTimeoutMs}ms`)),
                  itemTimeoutMs,
                );
              }),
            ]);

            if (result) {

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

              // Atomic creation with duplicate check
              await withDbRetry(() => prisma.$transaction(async (tx) => {
                const canonicalUrl = normalizeCanonicalUrl(result.url);
                const normalizedSku = normalizeSku(result.sku);
                const normalizedSlug = extractSlugFromUrl(result.url) || normalizeProductSlug(result.title);

                // Dedup chain:
                // 1) canonical URL
                // 2) normalized SKU
                // 3) normalized slug fallback
                let compProduct = await tx.product.findFirst({
                  where: {
                    siteId: site.id,
                    OR: [
                      ...(canonicalUrl ? [{ canonicalUrl }] : []),
                      ...(normalizedSku ? [{ sku: normalizedSku }] : []),
                      ...(normalizedSlug ? [{ normalizedSlug }] : []),
                      { url: result.url },
                    ],
                  }
                });

                if (!compProduct) {
                  compProduct = await tx.product.create({
                    data: {
                      tenantId,
                      siteId: site.id,
                      url: result.url,
                      canonicalUrl,
                      normalizedSlug,
                      title: result.title,
                      imageUrl: result.imageUrl,
                      sku: normalizedSku ?? undefined,
                      brand: result.brand ?? undefined,
                      model: result.model ?? undefined,
                      currentPrice: result.price,
                      inStock: result.inStock,
                      currency: result.currency || "BDT",
                      originalPrice: result.price,
                      originalCurrency: result.currency || "BDT",
                      normalizedPrice: result.price,
                      exchangeRateUsed: 1,
                      exchangeRateTimestamp: new Date(),
                      lastCrawledAt: new Date(),
                    }
                  });
                } else {
                  // Keep competitor product records fresh, and backfill missing fields (imageUrl is
                  // critical for match-approval comparison UI).
                  await tx.product.update({
                    where: { id: compProduct.id },
                    data: {
                      title: result.title,
                      canonicalUrl: canonicalUrl || compProduct.canonicalUrl,
                      normalizedSlug: normalizedSlug || compProduct.normalizedSlug,
                      currentPrice: result.price,
                      inStock: result.inStock,
                      currency: result.currency || "BDT",
                      originalPrice: result.price,
                      originalCurrency: result.currency || "BDT",
                      normalizedPrice: result.price,
                      exchangeRateUsed: 1,
                      exchangeRateTimestamp: new Date(),
                      lastCrawledAt: new Date(),
                      ...(result.imageUrl ? { imageUrl: result.imageUrl } : {}),
                      ...(normalizedSku ? { sku: normalizedSku } : {}),
                      ...(result.brand ? { brand: result.brand } : {}),
                      ...(result.model ? { model: result.model } : {}),
                    }
                  });
                }

                // Check if THIS specific match already exists
                const matchExists = await tx.productMatch.findFirst({
                  where: {
                    userProductId: up.id,
                    competitorProductId: compProduct.id
                  }
                });

                if (!matchExists) {
                  await tx.productMatch.create({
                    data: {
                      userProductId: up.id,
                      competitorProductId: compProduct.id,
                      matchType: "AUTO_SKU",
                      confidenceScore: 0.9,
                    }
                  });
                }

                // Only create price history if it doesn't exist for this exact time (prevent duplicates)
                const now = new Date();
                const historyExists = await tx.priceHistory.findFirst({
                  where: { productId: compProduct.id, recordedAt: now }
                });

                if (!historyExists) {
                  await tx.priceHistory.create({
                    data: { productId: compProduct.id, price: result.price, recordedAt: now }
                  });
                }
              }), { operationName: 'DiscoveryMatchTransaction' });
              discoveredCount++;
            } else {
              if (localProcessedIdx % 5 === 0 || localProcessedIdx === userProducts.length) {
                await prisma.syncLog.create({
                  data: {
                    siteId,
                    message: `❌ [${localProcessedIdx}] NO MATCH: "${up.title.substring(0, 30)}..."`,
                    level: "ERROR",
                  },
                });
              }
            }
          } catch (error) {
            if (error instanceof ScrapeBlockError) {
              const retryAfter = 15 + Math.floor(Math.random() * 16); // 15 to 30 minutes
              const nextAttempt = new Date(Date.now() + retryAfter * 60 * 1000);
              const retryJobId = buildInitialRetryJobId(siteId, up.id);

              await prisma.syncLog.create({
                data: {
                  siteId,
                  message: `🛡️ [${localProcessedIdx}] BLOCKED: "${up.title.substring(0, 30)}..." by ${error.provider}. Retrying in ${retryAfter}m.`,
                  level: "WARN",
                },
              });

              // Track in the list
              const existingPendingRetry = await (prisma as any).scrapeRetry.findFirst({
                where: {
                  tenantId,
                  siteId,
                  userProductId: up.id,
                  status: "PENDING",
                },
              });

              if (existingPendingRetry) {
                await (prisma as any).scrapeRetry.update({
                  where: { id: existingPendingRetry.id },
                  data: {
                    nextAttemptAt: nextAttempt,
                    reason: error.provider,
                    updatedAt: new Date(),
                  },
                });
              } else {
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
              }

              // Queue a delayed job (as SINGLE retry might be too much overhead per product,
              // but user asked for individual background retries).
              // We use RETRY type which we'll handle in worker.
              await getSyncQueue().add(QUEUE_NAMES.SYNC, {
                type: "RETRY",
                siteId,
                tenantId,
                productIds: [up.id]
              }, {
                delay: retryAfter * 60 * 1000,
                jobId: retryJobId,
              });

              // NEW: Trigger Golden Rule if advanced block detected during discovery
              if (error instanceof ScrapeBlockError && error.isAdvanced && !(site as any).isAdvancedProtected) {
                await markSiteAsAdvancedProtected({
                  siteId,
                  tenantId,
                  reason: `Advanced block detected during discovery: ${error.provider}`,
                }).catch(async () => {
                  await (prisma.site as any).update({
                    where: { id: siteId },
                    data: {
                      isAdvancedProtected: true,
                      lastSecurityBlockAt: new Date()
                    }
                  });
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
              const errorMessage = error instanceof Error ? error.message : String(error);
              if (errorMessage.includes("timeout: discovery item exceeded")) {
                await prisma.syncLog.create({
                  data: {
                    siteId,
                    message: `⏱️ [${localProcessedIdx}] TIMEOUT: "${up.title.substring(0, 30)}..."`,
                    level: "WARN",
                  }
                });
              }
              await prisma.syncLog.create({
                data: {
                  siteId,
                  message: `⚠️ [${localProcessedIdx}] ERROR: Search failed for "${up.title.substring(0, 30)}..."`,
                  level: "ERROR",
                }
              });
            }
          } finally {
            completedInBatch += 1;
            await persistProgress(false);
          }
          return { aborted: false };
        }));

        await persistProgress(true);

        if (batchResults.some((r: any) => r?.aborted)) {
          return { discoveredCount, aborted: true };
        }
      } catch (error) {
        console.error("[DiscoveryService] Batch error:", error);
      }

      // Small throttle between batches to be nice to CPUs
      await new Promise(r => setTimeout(r, 1000));
    }

    return { discoveredCount, aborted: false };
  }
}
