import { prisma } from "@/lib/prisma";
import { PricingRule } from "@prisma/client";
import { WebhookService } from "./webhook";
import { NotificationService } from "./notification";

interface PriceRecommendation {
  productId: string;
  currentPrice: number;
  recommendedPrice: number;
  reason: string;
  appliedRule?: string;
}

export class RulesEngine {
  /**
   * Evaluate all active pricing rules for a tenant
   */
  static async evaluateAllRules(
    tenantId: string,
  ): Promise<PriceRecommendation[]> {
    // Get all active pricing rules from database
    const rules = await prisma.pricingRule.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: {
        priority: "asc", // Lower number = higher priority
      },
    });

    // Batched processing to handle large datasets (Memory Optimization)
    let processedCount = 0;
    const BATCH_SIZE = 100;

    const recommendations: PriceRecommendation[] = [];

    while (true) {
      // Get batch of user products with their matches
      const products = await prisma.product.findMany({
        where: {
          tenantId,
          site: { type: "USER" },
        },
        include: {
          matchesAsUser: {
            include: {
              competitorProduct: true,
            },
          },
        },
        take: BATCH_SIZE,
        skip: processedCount,
      });

      if (products.length === 0) {
        break; // No more products to process
      }

      for (const product of products) {
        const recommendation = await this.evaluateProduct(product, rules);
        if (recommendation) {
          recommendations.push(recommendation);
        }
      }

      processedCount += products.length;

      // Safety break for extremely large datasets during dev/testing
      // In production, this might be handled by a queue worker instead
      if (processedCount > 50000) {
        console.warn(`[RulesEngine] Processed 50k products, stopping safely.`);
        break;
      }
    }

    return recommendations;
  }

  /**
   * Evaluate a single product against all rules
   */
  private static async evaluateProduct(
    product: {
      id: string;
      currentPrice: any; // Decimal type from Prisma
      matchesAsUser: any[];
      sku: string | null;
      title: string;
    },
    rules: PricingRule[],
  ): Promise<PriceRecommendation | null> {
    const currentPrice = parseFloat(product.currentPrice.toString());

    // Get best competitor match
    const bestMatch = product.matchesAsUser[0];
    if (!bestMatch) {
      return null; // No competitor data to compare
    }

    const competitorPrice = parseFloat(
      bestMatch.competitorProduct.currentPrice.toString(),
    );
    const competitorIsOutOfStock = !bestMatch.competitorProduct.inStock;

    // Apply rules in priority order
    for (const rule of rules) {
      const result = this.applyRule(
        rule,
        currentPrice,
        competitorPrice,
        competitorIsOutOfStock,
      );

      if (result) {
        return {
          productId: product.id,
          currentPrice,
          recommendedPrice: result.price,
          reason: result.reason,
          appliedRule: rule.strategy,
        };
      }
    }

    return null;
  }

  /**
   * Apply a specific pricing rule
   */
  private static applyRule(
    rule: PricingRule,
    currentPrice: number,
    competitorPrice: number,
    competitorIsOutOfStock: boolean = false,
  ): { price: number; reason: string } | null {
    switch (rule.strategy as any) {
      case "UNDERCUT":
        // Always be cheaper by a fixed amount
        const undercutAmount = parseFloat(rule.parameter.toString());
        const undercutPrice = competitorPrice - undercutAmount;

        if (currentPrice > undercutPrice) {
          return {
            price: Math.max(undercutPrice, 0),
            reason: `Undercut competitor by $${undercutAmount}`,
          };
        }
        break;

      case "MATCH":
        // Match competitor price exactly
        if (Math.abs(currentPrice - competitorPrice) > 0.01) {
          return {
            price: competitorPrice,
            reason: "Match competitor price",
          };
        }
        break;

      case "MARGIN_LOCK":
        // Maintain a minimum margin percentage
        const minMargin = parseFloat(rule.parameter.toString());
        const cost = currentPrice * (1 - minMargin / 100); // Reverse calculate cost
        const minPrice = cost / (1 - minMargin / 100);

        if (competitorPrice < minPrice) {
          return {
            price: minPrice,
            reason: `Maintain ${minMargin}% margin`,
          };
        } else if (currentPrice > competitorPrice) {
          return {
            price: competitorPrice,
            reason: "Match competitor while maintaining margin",
          };
        }
        break;

      case "THRESHOLD":
        // Only adjust if difference exceeds threshold
        const threshold = parseFloat(rule.parameter.toString());
        const difference = Math.abs(currentPrice - competitorPrice);

        if (difference > threshold && currentPrice > competitorPrice) {
          return {
            price: competitorPrice,
            reason: `Price difference ($${difference.toFixed(2)}) exceeds threshold`,
          };
        }
        break;

      case "PERCENTAGE":
        // Be X% cheaper than competitor
        const percentage = parseFloat(rule.parameter.toString());
        const targetPrice = competitorPrice * (1 - percentage / 100);

        if (currentPrice > targetPrice) {
          return {
            price: targetPrice,
            reason: `Be ${percentage}% cheaper than competitor`,
          };
        }
        break;

      case "INVENTORY_HIKE":
        // Increase price if competitor is out of stock
        if (competitorIsOutOfStock) {
          const hike = parseFloat(rule.parameter.toString());
          const hikedPrice = currentPrice * (1 + hike / 100);
          return {
            price: hikedPrice,
            reason: `Competitor is Out of Stock. Increasing price by ${hike}%`,
          };
        }
        break;
    }

    return null;
  }

  /**
   * Execute price changes for approved recommendations
   */
  static async executePriceChanges(
    recommendations: PriceRecommendation[],
  ): Promise<{ updated: number; failed: number }> {
    let updated = 0;
    let failed = 0;

    for (const rec of recommendations) {
      try {
        const product = await prisma.product.update({
          where: { id: rec.productId },
          data: {
            currentPrice: rec.recommendedPrice,
            lastCrawledAt: new Date(),
          },
        });

        // Record price history
        await prisma.priceHistory.create({
          data: {
            productId: rec.productId,
            price: rec.recommendedPrice,
          },
        });

        // Dispatch webhook
        await WebhookService.dispatch(product.tenantId, "price.updated", {
          productId: product.id,
          sku: product.sku,
          title: product.title,
          oldPrice: rec.currentPrice,
          newPrice: rec.recommendedPrice,
          reason: rec.reason,
          timestamp: new Date().toISOString(),
        });

        // Send Notification
        await NotificationService.sendPriceAlert(
          product.tenantId,
          product.title,
          rec.currentPrice,
          rec.recommendedPrice,
        );

        updated++;
      } catch (error) {
        if (process.env.NODE_ENV !== "test") {
          console.error(`Failed to update product ${rec.productId}:`, error);
        }
        failed++;
      }
    }

    return { updated, failed };
  }
}
