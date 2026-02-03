import { prisma } from "@/lib/prisma";
import { LogicType } from "@prisma/client";
import { withRetry } from "@/lib/utils/timeout";
import { CacheInvalidationService } from "./cache-invalidation";

export class UpdateExecutionService {
  /**
   * Executes bulk price updates for selected products
   */
  static async executeBulkUpdate(
    productIds: string[],
    logicType: LogicType,
    value: number,
    minPrice?: number,
  ) {
    const results = [];
    const successfulProductIds: string[] = [];

    // FIX: Fetch all products in a single query instead of N queries
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        site: true,
        matchesAsUser: {
          include: { competitorProduct: true },
          take: 1,
        },
      },
    });

    // Create a map for O(1) lookup
    const productMap = new Map(products.map(p => [p.id, p]));

    for (const pid of productIds) {
      const product = productMap.get(pid);

      if (!product || product.matchesAsUser.length === 0) continue;

      const competitorPrice = Number(
        product.matchesAsUser[0].competitorProduct.currentPrice,
      );
      const oldPrice = Number(product.currentPrice);
      let newPrice = oldPrice;

      // 1. Calculate new price
      if (logicType === "FIXED") {
        newPrice = competitorPrice - value;
      } else if (logicType === "PERCENTAGE") {
        newPrice = competitorPrice * (1 - value / 100);
      }

      // 2. Apply safety valve
      if (minPrice && newPrice < minPrice) {
        newPrice = minPrice;
      }

      try {
        // Wrap everything in a transaction for atomicity
        await withRetry(
          async () => {
            await prisma.$transaction(async (tx) => {
              // 3. Call External API (Mocked - but we keep it inside transaction context)
              // In production: await fetch(`${product.site.baseUrl}/update_price`, { ... })
              console.log(
                `[SAFE-EXEC] Updating ${product.sku} on ${product.site.baseUrl}: ${oldPrice} -> ${newPrice}`,
              );

              // 4. Update local DB
              await tx.product.update({
                where: { id: pid },
                data: { currentPrice: newPrice },
              });

              // 5. Log the update
              await tx.priceUpdateLog.create({
                data: {
                  productId: pid,
                  oldPrice,
                  newPrice,
                  logicType,
                  status: "SUCCESS",
                },
              });

              // 6. Record history (Best practice: atomic with update)
              await tx.priceHistory.create({
                data: {
                  productId: pid,
                  price: newPrice,
                },
              });
            });
          },
          2,
          30000,
          2000,
        );

        results.push({ id: pid, success: true });
        successfulProductIds.push(pid);
      } catch (error) {
        const err = error as Error;
        // Non-transactional logging of failure
        await prisma.priceUpdateLog.create({
          data: {
            productId: pid,
            oldPrice,
            newPrice,
            logicType,
            status: "FAILED",
            errorDetails: err.message,
          },
        });
        results.push({ id: pid, success: false, error: err.message });
      }
    }

    // Invalidate cache for successfully updated products
    // Requirement 2.1: Price update invalidation
    if (successfulProductIds.length > 0) {
      try {
        // Get tenantId from the first product
        const firstProduct = await prisma.product.findUnique({
          where: { id: successfulProductIds[0] },
          select: { tenantId: true },
        });

        if (firstProduct) {
          const cacheInvalidation = new CacheInvalidationService();
          await cacheInvalidation.onPriceUpdate(
            firstProduct.tenantId,
            successfulProductIds
          );
        }
      } catch (cacheError) {
        // Log cache invalidation error but don't fail the operation
        console.error('[UpdateExecutionService] Cache invalidation failed:', cacheError);
      }
    }

    return {
      total: productIds.length,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };
  }
}
