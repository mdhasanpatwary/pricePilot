import { prisma } from "@/lib/prisma";
import { PricingRule } from "@prisma/client";
import { WebhookService } from "./webhook";
import { NotificationService } from "./notification";
import { ValidationError, NotFoundError, AppError } from "@/lib/utils/error-handler";

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
    try {
      // Validate input
      if (!tenantId || typeof tenantId !== 'string') {
        throw new ValidationError(
          'Invalid tenant ID',
          { tenantId: ['Tenant ID is required and must be a string'] },
          { context: { tenantId, operation: 'evaluateAllRules' } }
        );
      }

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
          const recommendation = await this.evaluateProduct(product, rules, tenantId);
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
    } catch (error) {
      // If already an AppError, re-throw with additional context
      if (error instanceof AppError) {
        throw error;
      }

      // Wrap unexpected errors
      throw new AppError(
        'Failed to evaluate pricing rules',
        500,
        'RULES_EVALUATION_ERROR',
        {
          cause: error instanceof Error ? error : new Error(String(error)),
          context: { tenantId, operation: 'evaluateAllRules' }
        }
      );
    }
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
    tenantId: string,
  ): Promise<PriceRecommendation | null> {
    try {
      // Validate product exists
      if (!product || !product.id) {
        throw new NotFoundError(
          'Product',
          'unknown',
          { context: { tenantId, operation: 'evaluateProduct' } }
        );
      }

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
          tenantId,
          product.id,
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
    } catch (error) {
      // If already an AppError, re-throw
      if (error instanceof AppError) {
        throw error;
      }

      // Wrap unexpected errors
      throw new AppError(
        'Failed to evaluate product against rules',
        500,
        'PRODUCT_EVALUATION_ERROR',
        {
          cause: error instanceof Error ? error : new Error(String(error)),
          context: {
            tenantId,
            operation: 'evaluateProduct',
            metadata: { productId: product.id }
          }
        }
      );
    }
  }

  /**
   * Apply a specific pricing rule
   */
  private static applyRule(
    rule: PricingRule,
    currentPrice: number,
    competitorPrice: number,
    competitorIsOutOfStock: boolean,
    tenantId: string,
    productId: string,
  ): { price: number; reason: string } | null {
    try {
      // Validate rule configuration
      if (!rule || !rule.strategy) {
        throw new ValidationError(
          'Invalid rule configuration',
          { rule: ['Rule must have a strategy'] },
          {
            context: {
              tenantId,
              operation: 'applyRule',
              metadata: { ruleId: rule?.id, productId }
            }
          }
        );
      }

      // Validate rule parameter
      if (rule.parameter === null || rule.parameter === undefined) {
        throw new ValidationError(
          'Invalid rule configuration',
          { parameter: ['Rule parameter is required'] },
          {
            context: {
              tenantId,
              operation: 'applyRule',
              metadata: { ruleId: rule.id, strategy: rule.strategy, productId }
            }
          }
        );
      }

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
              reason: `Price difference (${difference.toFixed(2)}) exceeds threshold`,
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
    } catch (error) {
      // If already an AppError, re-throw
      if (error instanceof AppError) {
        throw error;
      }

      // Wrap unexpected errors
      throw new AppError(
        'Failed to apply pricing rule',
        500,
        'RULE_APPLICATION_ERROR',
        {
          cause: error instanceof Error ? error : new Error(String(error)),
          context: {
            tenantId,
            operation: 'applyRule',
            metadata: { ruleId: rule.id, strategy: rule.strategy, productId }
          }
        }
      );
    }
  }

  /**
   * Execute price changes for approved recommendations
   * Now queues changes for manual approval instead of auto-applying
   */
  static async executePriceChanges(
    recommendations: PriceRecommendation[],
  ): Promise<{ updated: number; failed: number; queued: number }> {
    let queued = 0;
    let failed = 0;

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    for (const rec of recommendations) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: rec.productId },
          select: { id: true, tenantId: true, title: true, sku: true },
        });

        if (!product) {
          failed++;
          continue;
        }

        // Check if there's already a pending change for this product
        const existingPending = await prisma.pendingPriceChange.findFirst({
          where: {
            productId: rec.productId,
            status: "PENDING",
          },
        });

        if (existingPending) {
          // Update existing pending change
          await prisma.pendingPriceChange.update({
            where: { id: existingPending.id },
            data: {
              currentPrice: rec.currentPrice,
              recommendedPrice: rec.recommendedPrice,
              reason: rec.reason,
              appliedRule: rec.appliedRule,
              expiresAt,
            },
          });
        } else {
          // Create new pending change
          await prisma.pendingPriceChange.create({
            data: {
              productId: rec.productId,
              tenantId: product.tenantId,
              currentPrice: rec.currentPrice,
              recommendedPrice: rec.recommendedPrice,
              reason: rec.reason,
              appliedRule: rec.appliedRule,
              expiresAt,
            },
          });
        }

        queued++;
      } catch (error) {
        if (process.env.NODE_ENV !== "test") {
          console.error(
            `[SAFE-RULES] Failed to queue price change for product ${rec.productId}:`,
            error,
          );
        }
        failed++;
      }
    }

    return { updated: 0, failed, queued };
  }

  /**
   * Apply approved price changes to products and push to stores
   */
  static async applyApprovedChanges(
    changeIds: string[],
    reviewedBy: string,
  ): Promise<{ updated: number; failed: number }> {
    let updated = 0;
    let failed = 0;

    for (const changeId of changeIds) {
      try {
        const change = await prisma.pendingPriceChange.findUnique({
          where: { id: changeId },
          include: { product: true },
        });

        if (!change || change.status !== "PENDING") {
          failed++;
          continue;
        }

        // Atomic Database Operations
        await prisma.$transaction(async (tx) => {
          // Update product price
          await tx.product.update({
            where: { id: change.productId },
            data: {
              currentPrice: change.recommendedPrice,
              lastCrawledAt: new Date(),
            },
          });

          // Record price history
          await tx.priceHistory.create({
            data: {
              productId: change.productId,
              price: change.recommendedPrice,
            },
          });

          // Mark change as approved
          await tx.pendingPriceChange.update({
            where: { id: changeId },
            data: {
              status: "APPROVED",
              reviewedAt: new Date(),
              reviewedBy,
            },
          });
        });

        // External Side Effects (Post-Transaction)
        const product = change.product;

        // Dispatch webhook
        await WebhookService.dispatch(product.tenantId, "price.updated", {
          productId: product.id,
          sku: product.sku,
          title: product.title,
          oldPrice: change.currentPrice.toString(),
          newPrice: change.recommendedPrice.toString(),
          reason: change.reason,
          timestamp: new Date().toISOString(),
        });

        // Send Notification
        await NotificationService.sendPriceAlert(
          product.tenantId,
          product.title,
          parseFloat(change.currentPrice.toString()),
          parseFloat(change.recommendedPrice.toString()),
        );

        updated++;
      } catch (error) {
        if (process.env.NODE_ENV !== "test") {
          console.error(
            `[SAFE-RULES] Failed to apply approved change ${changeId}:`,
            error,
          );
        }
        failed++;
      }
    }

    return { updated, failed };
  }

  /**
   * Reject pending price changes
   */
  static async rejectPendingChanges(
    changeIds: string[],
    reviewedBy: string,
  ): Promise<{ rejected: number; failed: number }> {
    let rejected = 0;
    let failed = 0;

    for (const changeId of changeIds) {
      try {
        await prisma.pendingPriceChange.update({
          where: { id: changeId, status: "PENDING" },
          data: {
            status: "REJECTED",
            reviewedAt: new Date(),
            reviewedBy,
          },
        });
        rejected++;
      } catch (error) {
        failed++;
      }
    }

    return { rejected, failed };
  }

  /**
   * Clean up expired pending changes
   */
  static async cleanupExpiredChanges(): Promise<number> {
    const result = await prisma.pendingPriceChange.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      data: {
        status: "EXPIRED",
      },
    });

    return result.count;
  }
}
