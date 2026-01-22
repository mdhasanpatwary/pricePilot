import { prisma } from "@/lib/prisma";
import { NotificationService } from "./notification";
import { logger } from "../logger";

export class AlertService {
  /**
   * Evaluate all active alert rules for a tenant after a product update
   */
  static async evaluateRules(
    tenantId: string,
    productId: string,
    oldPrice: number,
    newPrice: number,
    oldStock: boolean,
    newStock: boolean,
  ) {
    try {
      const activeRules = await (prisma as any).alertRule.findMany({
        where: {
          tenantId,
          isActive: true,
        },
      });

      if (activeRules.length === 0) return;

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { title: true, category: true },
      });

      if (!product) return;

      for (const rule of activeRules) {
        // 1. Check Scope
        if (rule.target === "SINGLE_PRODUCT" && rule.targetId !== productId)
          continue;
        if (rule.target === "CATEGORY" && product.category !== rule.targetId)
          continue;

        let triggered = false;
        let message = "";

        // 2. Evaluate price-based rules
        if (rule.type === "PRICE_CHANGE") {
          const threshold = parseFloat(rule.value.toString());

          if (rule.condition === "LESS_THAN" && newPrice < threshold) {
            triggered = true;
            message = `Price dropped below $${threshold} (Current: $${newPrice})`;
          } else if (
            rule.condition === "GREATER_THAN" &&
            newPrice > threshold
          ) {
            triggered = true;
            message = `Price rose above $${threshold} (Current: $${newPrice})`;
          } else if (rule.condition === "DECREASED_BY" && oldPrice > 0) {
            const dropPercent = ((oldPrice - newPrice) / oldPrice) * 100;
            if (dropPercent >= threshold) {
              triggered = true;
              message = `Price dropped by ${dropPercent.toFixed(1)}% (Threshold: ${threshold}%)`;
            }
          } else if (rule.condition === "INCREASED_BY" && oldPrice > 0) {
            const risePercent = ((newPrice - oldPrice) / oldPrice) * 100;
            if (risePercent >= threshold) {
              triggered = true;
              message = `Price increased by ${risePercent.toFixed(1)}% (Threshold: ${threshold}%)`;
            }
          }
        }
        // 3. Evaluate stock-based rules
        else if (rule.type === "STOCK_STATUS") {
          if (rule.condition === "OUT_OF_STOCK" && oldStock && !newStock) {
            triggered = true;
            message = `Product went out of stock.`;
          } else if (
            rule.condition === "BACK_IN_STOCK" &&
            !oldStock &&
            newStock
          ) {
            triggered = true;
            message = `Product is back in stock.`;
          }
        }

        if (triggered) {
          logger.info(
            `[AlertService] Rule ${rule.name} triggered for ${productId}`,
          );
          await NotificationService.create({
            tenantId,
            type: "PRICE_ALERT",
            title: `[Sentinel] ${rule.name}: ${product.title}`,
            message,
            link: `/dashboard/products`,
          });
        }
      }
    } catch (error) {
      logger.error("[AlertService] Evaluation failed:", {
        error,
        productId,
        tenantId,
      });
    }
  }
}
