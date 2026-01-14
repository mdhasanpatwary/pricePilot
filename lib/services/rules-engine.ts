import { prisma } from "@/lib/prisma";

interface PricingStrategy {
  type: "UNDERCUT" | "MATCH" | "MARGIN_LOCK" | "THRESHOLD" | "PERCENTAGE";
  parameter: number;
  priority: number;
}

interface PriceRecommendation {
  productId: string;
  currentPrice: number;
  recommendedPrice: number;
  reason: string;
  appliedRule?: string;
}

export class RulesEngine {
  // Default pricing strategies (can be configured per tenant in the future)
  private static readonly DEFAULT_STRATEGIES: PricingStrategy[] = [
    { type: "UNDERCUT", parameter: 1, priority: 1 }, // Undercut by $1
    { type: "MARGIN_LOCK", parameter: 20, priority: 2 }, // Maintain 20% margin
  ];

  /**
   * Evaluate all active pricing rules for a tenant
   */
  static async evaluateAllRules(
    tenantId: string,
    strategies: PricingStrategy[] = this.DEFAULT_STRATEGIES
  ): Promise<PriceRecommendation[]> {
    // Sort strategies by priority (lower number = higher priority)
    strategies.sort((a, b) => a.priority - b.priority);

    // Get all user products with their matches
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
    });

    const recommendations: PriceRecommendation[] = [];

    for (const product of products) {
      const recommendation = await this.evaluateProduct(product, strategies);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  /**
   * Evaluate a single product against all rules
   */
  private static async evaluateProduct(
    product: any,
    strategies: PricingStrategy[]
  ): Promise<PriceRecommendation | null> {
    const currentPrice = parseFloat(product.currentPrice.toString());

    // Get best competitor match
    const bestMatch = product.matchesAsUser[0];
    if (!bestMatch) {
      return null; // No competitor data to compare
    }

    const competitorPrice = parseFloat(bestMatch.competitorProduct.currentPrice.toString());

    // Apply strategies in priority order
    for (const strategy of strategies) {
      const result = this.applyStrategy(strategy, currentPrice, competitorPrice);

      if (result) {
        return {
          productId: product.id,
          currentPrice,
          recommendedPrice: result.price,
          reason: result.reason,
          appliedRule: strategy.type,
        };
      }
    }

    return null;
  }

  /**
   * Apply a specific pricing strategy
   */
  private static applyStrategy(
    strategy: PricingStrategy,
    currentPrice: number,
    competitorPrice: number
  ): { price: number; reason: string } | null {
    switch (strategy.type) {
      case "UNDERCUT":
        // Always be cheaper by a fixed amount
        const undercutAmount = strategy.parameter;
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
        const minMargin = strategy.parameter;
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
        const threshold = strategy.parameter;
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
        const percentage = strategy.parameter;
        const targetPrice = competitorPrice * (1 - percentage / 100);

        if (currentPrice > targetPrice) {
          return {
            price: targetPrice,
            reason: `Be ${percentage}% cheaper than competitor`,
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
    recommendations: PriceRecommendation[]
  ): Promise<{ updated: number; failed: number }> {
    let updated = 0;
    let failed = 0;

    for (const rec of recommendations) {
      try {
        await prisma.product.update({
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

        updated++;
      } catch (error) {
        console.error(`Failed to update product ${rec.productId}:`, error);
        failed++;
      }
    }

    return { updated, failed };
  }
}
