import { prisma } from "@/lib/prisma";
import { PricingRule, StrategyType } from "@prisma/client";

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
    tenantId: string
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
      const recommendation = await this.evaluateProduct(product, rules);
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
    rules: PricingRule[]
  ): Promise<PriceRecommendation | null> {
    const currentPrice = parseFloat(product.currentPrice.toString());

    // Get best competitor match
    const bestMatch = product.matchesAsUser[0];
    if (!bestMatch) {
      return null; // No competitor data to compare
    }

    const competitorPrice = parseFloat(bestMatch.competitorProduct.currentPrice.toString());

    // Apply rules in priority order
    for (const rule of rules) {
      const result = this.applyRule(rule, currentPrice, competitorPrice);

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
    competitorPrice: number
  ): { price: number; reason: string } | null {
    switch (rule.strategy) {
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
