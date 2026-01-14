import { prisma } from "@/lib/prisma";
import { LogicType, UpdateStatus } from "@prisma/client";

export class UpdateExecutionService {
  /**
   * Executes bulk price updates for selected products
   */
  static async executeBulkUpdate(
    productIds: string[],
    logicType: LogicType,
    value: number,
    minPrice?: number
  ) {
    const results = [];

    for (const pid of productIds) {
      const product = await prisma.product.findUnique({
        where: { id: pid },
        include: {
          site: true,
          matchesAsUser: {
            include: { competitorProduct: true },
            take: 1
          }
        },
      });

      if (!product || product.matchesAsUser.length === 0) continue;

      const competitorPrice = Number(product.matchesAsUser[0].competitorProduct.currentPrice);
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
        // 3. Call External API (Mocked)
        // In production: await fetch(`${product.site.baseUrl}/update_price`, { method: 'POST', body: JSON.stringify({ sku: product.sku, price: newPrice }) })
        console.log(`Updating ${product.sku} on ${product.site.baseUrl}: ${oldPrice} -> ${newPrice}`);

        // 4. Update local DB
        await prisma.product.update({
          where: { id: pid },
          data: { currentPrice: newPrice },
        });

        // 5. Log the update
        await prisma.priceUpdateLog.create({
          data: {
            productId: pid,
            oldPrice,
            newPrice,
            logicType,
            status: "SUCCESS",
          },
        });

        results.push({ id: pid, success: true });
      } catch (err: any) {
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
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    };
  }
}
