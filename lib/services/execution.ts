import { prisma } from "@/lib/prisma";
import { LogicType } from "@prisma/client";
import { withRetry } from "@/lib/utils/timeout";

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

    for (const pid of productIds) {
      const product = await prisma.product.findUnique({
        where: { id: pid },
        include: {
          site: true,
          matchesAsUser: {
            include: { competitorProduct: true },
            take: 1,
          },
        },
      });

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

    return {
      total: productIds.length,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };
  }
}
