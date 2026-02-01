import { prisma } from "@/lib/prisma";
import type { PendingPriceChange, Product } from "@prisma/client";
import {
    RuleConditionsSchema,
    type RuleConditions,
} from "@/lib/validation/auto-approval-rules";
import { ValidationError, AppError } from "@/lib/utils/error-handler";
import { mailService } from "@/lib/mail";

/**
 * Auto-Approval Service
 * 
 * This service evaluates pending price changes against auto-approval rules
 * and automatically approves changes that meet all configured conditions.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.5, 8.1, 8.2, 8.5
 */

/**
 * Extended Product type with match data for evaluation
 */
type ProductWithMatches = Product & {
    matchesAsUser: Array<{
        confidenceScore: any; // Decimal type from Prisma
        competitorProduct: Product;
    }>;
};

/**
 * Result of auto-approval evaluation
 */
interface AutoApprovalDecision {
    approved: boolean;
    ruleId?: string;
    ruleName?: string;
    reason: string;
}

/**
 * Metrics tracking for auto-approval processing
 */
interface MetricsTracker {
    ruleMetrics: Map<string, { ruleId: string; ruleName: string; count: number }>;
    nonMatchingCount: number;
    totalEvaluated: number;
}

export class AutoApprovalService {
    /**
     * Process all pending price changes for auto-approval
     * 
     * This method loads all PENDING price changes for a tenant, evaluates them
     * against auto-approval rules, and executes auto-approval transactions for
     * matching changes.
     * 
     * @param tenantId - The tenant ID to process
     * @returns Number of changes auto-approved
     * 
     * Requirements: 5.3, 5.4, 7.1, 7.4, 8.1, 8.2, 8.5
     */
    static async processAutoApprovals(tenantId: string): Promise<number> {
        try {
            // Validate input
            if (!tenantId || typeof tenantId !== "string") {
                throw new ValidationError(
                    "Invalid tenant ID",
                    { tenantId: ["Tenant ID is required and must be a string"] },
                    {
                        context: {
                            operation: "processAutoApprovals",
                        },
                    }
                );
            }

            // Load all PENDING price changes for tenant with product and match data
            const pendingChanges = await prisma.pendingPriceChange.findMany({
                where: {
                    tenantId,
                    status: "PENDING",
                },
                include: {
                    product: {
                        include: {
                            matchesAsUser: {
                                include: {
                                    competitorProduct: true,
                                },
                            },
                        },
                    },
                },
            });

            let autoApprovedCount = 0;
            const triggeredRuleNames: string[] = [];

            // Initialize metrics tracker (Requirements 8.1, 8.2, 8.5)
            const metricsTracker: MetricsTracker = {
                ruleMetrics: new Map(),
                nonMatchingCount: 0,
                totalEvaluated: 0,
            };

            // Process each pending change
            for (const change of pendingChanges) {
                try {
                    metricsTracker.totalEvaluated++;

                    // Evaluate if change should be auto-approved
                    const decision = await this.shouldAutoApprove(change, tenantId);

                    // If approved, execute auto-approval transaction
                    if (decision.approved && decision.ruleId && decision.ruleName) {
                        await this.executeAutoApprovalTransaction(
                            change,
                            decision.ruleId,
                            decision.ruleName
                        );
                        autoApprovedCount++;

                        // Collect rule names that triggered approvals (Requirement 7.1)
                        triggeredRuleNames.push(decision.ruleName);

                        // Track per-rule metrics (Requirement 8.1)
                        const existing = metricsTracker.ruleMetrics.get(decision.ruleId);
                        if (existing) {
                            existing.count++;
                        } else {
                            metricsTracker.ruleMetrics.set(decision.ruleId, {
                                ruleId: decision.ruleId,
                                ruleName: decision.ruleName,
                                count: 1,
                            });
                        }
                    } else {
                        // Track non-matching changes (Requirement 8.2)
                        metricsTracker.nonMatchingCount++;
                    }
                } catch (error) {
                    // Log error but continue processing other changes
                    if (process.env.NODE_ENV !== "test") {
                        console.error(
                            `[AutoApproval] Failed to process change ${change.id}:`,
                            error
                        );
                    }
                }
            }

            // Record metrics to database (Requirements 8.1, 8.2, 8.5)
            await this.recordMetrics(tenantId, metricsTracker);

            // Send email notification if any changes were auto-approved (Requirements 7.1, 7.4)
            if (autoApprovedCount > 0) {
                await mailService.sendAutoApprovalNotification(
                    tenantId,
                    autoApprovedCount,
                    triggeredRuleNames
                );
            }

            return autoApprovedCount;
        } catch (error) {
            // If already an AppError, re-throw
            if (error instanceof AppError) {
                throw error;
            }

            // Wrap unexpected errors
            throw new AppError(
                "Failed to process auto-approvals",
                500,
                "AUTO_APPROVAL_PROCESSING_ERROR",
                {
                    cause: error instanceof Error ? error : new Error(String(error)),
                    context: {
                        tenantId,
                        operation: "processAutoApprovals",
                    },
                }
            );
        }
    }

    /**
     * Execute auto-approval transaction
     * 
     * This method performs an atomic transaction to:
     * 1. Update PendingPriceChange status to APPROVED
     * 2. Record the rule that triggered approval
     * 3. Execute price update to store via RulesEngine
     * 4. Create price history record
     * 5. Create audit log entry
     * 
     * If any step fails, the entire transaction is rolled back.
     * 
     * @param change - The pending price change to approve
     * @param ruleId - The ID of the rule that triggered approval
     * @param ruleName - The name of the rule that triggered approval
     * 
     * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
     */
    private static async executeAutoApprovalTransaction(
        change: PendingPriceChange & {
            product: Product & {
                matchesAsUser: Array<{
                    confidenceScore: any;
                    competitorProduct: Product;
                }>;
            };
        },
        ruleId: string,
        ruleName: string
    ): Promise<void> {
        try {
            const now = new Date();

            // Use Prisma transaction to ensure atomicity (Requirement 4.6)
            await prisma.$transaction(async (tx) => {
                // 1. Update PendingPriceChange status (Requirements 4.1, 4.2)
                await tx.pendingPriceChange.update({
                    where: { id: change.id },
                    data: {
                        status: "APPROVED",
                        autoApprovedBy: ruleId,
                        autoApprovedAt: now,
                        reviewedBy: "system:auto-approval",
                        reviewedAt: now,
                    },
                });

                // 2. Execute price update to store (Requirement 4.3)
                // Update product price in database
                await tx.product.update({
                    where: { id: change.productId },
                    data: {
                        currentPrice: change.recommendedPrice,
                        lastCrawledAt: now,
                    },
                });

                // 3. Create price history record (Requirement 4.4)
                await tx.priceHistory.create({
                    data: {
                        productId: change.productId,
                        price: change.recommendedPrice,
                        recordedAt: now,
                    },
                });

                // 4. Create audit log entry (Requirement 4.5)
                await tx.tenantAuditLog.create({
                    data: {
                        tenantId: change.tenantId,
                        userId: "system",
                        userEmail: "system:auto-approval",
                        action: "AUTO_APPROVE_PRICE",
                        entityId: change.id,
                        details: JSON.stringify({
                            ruleId,
                            ruleName,
                            productId: change.productId,
                            productTitle: change.product.title,
                            productSku: change.product.sku,
                            oldPrice: change.currentPrice.toString(),
                            newPrice: change.recommendedPrice.toString(),
                            reason: `Auto-approved by rule: ${ruleName}`,
                            appliedRule: change.appliedRule,
                        }),
                        ipAddress: null,
                    },
                });
            });

            // Transaction completed successfully
            // Note: External side effects (webhooks, notifications) would be handled
            // by the RulesEngine.applyApprovedChanges method if needed, but for
            // auto-approval we keep it simple and just update the database
        } catch (error) {
            // If transaction fails, all changes are automatically rolled back by Prisma
            // Re-throw the error to be handled by the caller
            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError(
                "Failed to execute auto-approval transaction",
                500,
                "AUTO_APPROVAL_TRANSACTION_ERROR",
                {
                    cause: error instanceof Error ? error : new Error(String(error)),
                    context: {
                        operation: "executeAutoApprovalTransaction",
                        metadata: {
                            changeId: change.id,
                            productId: change.productId,
                            ruleId,
                            ruleName,
                        },
                    },
                }
            );
        }
    }

    /**
     * Validate rule conditions using Zod schema
     * 
     * @param conditions - The rule conditions to validate
     * @throws ValidationError if conditions are invalid
     * 
     * Requirements: 2.7, 9.1, 9.2, 9.3, 9.4, 9.5
     */
    static validateRuleConditions(conditions: unknown): void {
        try {
            RuleConditionsSchema.parse(conditions);
        } catch (error: any) {
            throw new ValidationError(
                "Invalid rule conditions",
                error.errors?.reduce((acc: any, err: any) => {
                    const path = err.path.join(".");
                    acc[path] = [err.message];
                    return acc;
                }, {}) || { conditions: ["Validation failed"] },
                {
                    context: {
                        operation: "validateRuleConditions",
                        metadata: { conditions },
                    },
                }
            );
        }
    }

    /**
     * Record metrics to database
     * 
     * This method stores auto-approval metrics for tracking and reporting.
     * Metrics are stored per-tenant and per-rule on a daily basis.
     * 
     * @param tenantId - The tenant ID
     * @param metricsTracker - The metrics tracker with collected data
     * 
     * Requirements: 8.1, 8.2, 8.5
     */
    private static async recordMetrics(
        tenantId: string,
        metricsTracker: MetricsTracker
    ): Promise<void> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize to start of day

            // Record per-rule metrics (Requirement 8.1)
            for (const [ruleId, ruleData] of metricsTracker.ruleMetrics) {
                await prisma.autoApprovalMetric.upsert({
                    where: {
                        tenantId_ruleId_date: {
                            tenantId,
                            ruleId,
                            date: today,
                        },
                    },
                    update: {
                        triggerCount: {
                            increment: ruleData.count,
                        },
                        totalEvaluated: {
                            increment: metricsTracker.totalEvaluated,
                        },
                        updatedAt: new Date(),
                    },
                    create: {
                        tenantId,
                        ruleId,
                        ruleName: ruleData.ruleName,
                        triggerCount: ruleData.count,
                        nonMatchingCount: 0,
                        totalEvaluated: metricsTracker.totalEvaluated,
                        date: today,
                    },
                });
            }

            // Record non-matching count (Requirement 8.2)
            if (metricsTracker.nonMatchingCount > 0) {
                await prisma.autoApprovalMetric.upsert({
                    where: {
                        tenantId_ruleId_date: {
                            tenantId,
                            ruleId: '__NO_RULE__',
                            date: today,
                        },
                    },
                    update: {
                        nonMatchingCount: {
                            increment: metricsTracker.nonMatchingCount,
                        },
                        totalEvaluated: {
                            increment: metricsTracker.totalEvaluated,
                        },
                        updatedAt: new Date(),
                    },
                    create: {
                        tenantId,
                        ruleId: '__NO_RULE__',
                        ruleName: 'No Matching Rule',
                        triggerCount: 0,
                        nonMatchingCount: metricsTracker.nonMatchingCount,
                        totalEvaluated: metricsTracker.totalEvaluated,
                        date: today,
                    },
                });
            }
        } catch (error) {
            // Log error but don't throw - metrics recording should not fail the main process
            if (process.env.NODE_ENV !== "test") {
                console.error("[AutoApproval] Failed to record metrics:", error);
            }
        }
    }

    /**
     * Get auto-approval metrics for a tenant
     * 
     * This method retrieves metrics for a given date range and calculates
     * the auto-approval percentage.
     * 
     * @param tenantId - The tenant ID
     * @param startDate - Start date for metrics (optional, defaults to 30 days ago)
     * @param endDate - End date for metrics (optional, defaults to today)
     * @returns Metrics summary with per-rule counts and auto-approval percentage
     * 
     * Requirements: 8.1, 8.2, 8.5
     */
    static async getMetrics(
        tenantId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<{
        totalAutoApproved: number;
        totalNonMatching: number;
        totalEvaluated: number;
        autoApprovalPercentage: number;
        perRuleMetrics: Array<{
            ruleId: string;
            ruleName: string;
            triggerCount: number;
        }>;
    }> {
        try {
            // Default to last 30 days if not specified
            const end = endDate || new Date();
            const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            // Normalize dates to start of day
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);

            // Load metrics for date range
            const metrics = await prisma.autoApprovalMetric.findMany({
                where: {
                    tenantId,
                    date: {
                        gte: start,
                        lte: end,
                    },
                },
            });

            // Aggregate metrics
            let totalAutoApproved = 0;
            let totalNonMatching = 0;
            let totalEvaluated = 0;
            const ruleMetricsMap = new Map<
                string,
                { ruleId: string; ruleName: string; triggerCount: number }
            >();

            for (const metric of metrics) {
                if (metric.ruleId) {
                    // Per-rule metrics (Requirement 8.1)
                    const existing = ruleMetricsMap.get(metric.ruleId);
                    if (existing) {
                        existing.triggerCount += metric.triggerCount;
                    } else {
                        ruleMetricsMap.set(metric.ruleId, {
                            ruleId: metric.ruleId,
                            ruleName: metric.ruleName || "Unknown",
                            triggerCount: metric.triggerCount,
                        });
                    }
                    totalAutoApproved += metric.triggerCount;
                } else {
                    // Non-matching metrics (Requirement 8.2)
                    totalNonMatching += metric.nonMatchingCount;
                }
                totalEvaluated += metric.totalEvaluated;
            }

            // Calculate auto-approval percentage (Requirement 8.5)
            const autoApprovalPercentage =
                totalEvaluated > 0
                    ? Math.round((totalAutoApproved / totalEvaluated) * 100 * 100) / 100
                    : 0;

            return {
                totalAutoApproved,
                totalNonMatching,
                totalEvaluated,
                autoApprovalPercentage,
                perRuleMetrics: Array.from(ruleMetricsMap.values()),
            };
        } catch (error) {
            // If already an AppError, re-throw
            if (error instanceof AppError) {
                throw error;
            }

            // Wrap unexpected errors
            throw new AppError(
                "Failed to get auto-approval metrics",
                500,
                "AUTO_APPROVAL_METRICS_ERROR",
                {
                    cause: error instanceof Error ? error : new Error(String(error)),
                    context: {
                        tenantId,
                        operation: "getMetrics",
                    },
                }
            );
        }
    }

    /**
     * Evaluate if a pending price change should be auto-approved
     * 
     * This method loads all enabled rules for the tenant, evaluates them in
     * priority order, and returns the first matching rule (short-circuit).
     * 
     * @param change - The pending price change to evaluate
     * @param tenantId - The tenant ID for rule lookup
     * @returns Object with approval decision and reason
     * 
     * Requirements: 3.1, 3.2, 3.3, 3.5
     */
    static async shouldAutoApprove(
        change: PendingPriceChange,
        tenantId: string
    ): Promise<AutoApprovalDecision> {
        try {
            // Validate inputs
            if (!change || !change.id) {
                throw new ValidationError(
                    "Invalid pending price change",
                    { change: ["Pending price change is required"] },
                    {
                        context: {
                            operation: "shouldAutoApprove",
                            metadata: { tenantId },
                        },
                    }
                );
            }

            if (!tenantId || typeof tenantId !== "string") {
                throw new ValidationError(
                    "Invalid tenant ID",
                    { tenantId: ["Tenant ID is required and must be a string"] },
                    {
                        context: {
                            operation: "shouldAutoApprove",
                            metadata: { changeId: change.id },
                        },
                    }
                );
            }

            // Only evaluate PENDING changes (Requirement 3.4)
            if (change.status !== "PENDING") {
                return {
                    approved: false,
                    reason: `Change status is ${change.status}, not PENDING`,
                };
            }

            // Load enabled rules for tenant, ordered by priority ascending
            // Lower priority numbers are evaluated first (Requirement 3.1)
            const rules = await prisma.autoApprovalRule.findMany({
                where: {
                    tenantId,
                    enabled: true, // Skip disabled rules (Requirement 3.5)
                },
                orderBy: {
                    priority: "asc",
                },
            });

            // If no rules, return not approved (Requirement 3.3)
            if (rules.length === 0) {
                return {
                    approved: false,
                    reason: "No enabled auto-approval rules found",
                };
            }

            // Load product with match data
            const product = await prisma.product.findUnique({
                where: { id: change.productId },
                include: {
                    matchesAsUser: {
                        include: {
                            competitorProduct: true,
                        },
                    },
                },
            });

            if (!product) {
                return {
                    approved: false,
                    reason: "Product not found",
                };
            }

            // Evaluate rules in priority order with short-circuit (Requirement 3.2)
            for (const rule of rules) {
                const matches = await this.evaluateRule(rule, change, product);

                if (matches) {
                    // First matching rule triggers approval (short-circuit)
                    return {
                        approved: true,
                        ruleId: rule.id,
                        ruleName: rule.name,
                        reason: `Auto-approved by rule: ${rule.name}`,
                    };
                }
            }

            // No rules matched (Requirement 3.3)
            return {
                approved: false,
                reason: "No auto-approval rules matched",
            };
        } catch (error) {
            // If already an AppError, re-throw
            if (error instanceof AppError) {
                throw error;
            }

            // Wrap unexpected errors
            throw new AppError(
                "Failed to evaluate auto-approval",
                500,
                "AUTO_APPROVAL_EVALUATION_ERROR",
                {
                    cause: error instanceof Error ? error : new Error(String(error)),
                    context: {
                        tenantId,
                        operation: "shouldAutoApprove",
                        metadata: { changeId: change.id },
                    },
                }
            );
        }
    }

    /**
     * Evaluate a single rule against a pending change
     * 
     * All conditions in the rule must be satisfied (AND logic) for the rule to match.
     * 
     * @param rule - The auto-approval rule
     * @param change - The pending price change
     * @param product - The product with match data
     * @returns True if all conditions are satisfied
     * 
     * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8
     */
    private static async evaluateRule(
        rule: {
            id: string;
            name: string;
            conditions: any;
        },
        change: PendingPriceChange,
        product: ProductWithMatches
    ): Promise<boolean> {
        try {
            // Parse conditions from JSON
            const conditions = rule.conditions as RuleConditions;

            // Validate conditions structure
            this.validateRuleConditions(conditions);

            // Calculate price change metrics
            const currentPrice = parseFloat(change.currentPrice.toString());
            const recommendedPrice = parseFloat(change.recommendedPrice.toString());
            const priceChange = Math.abs(recommendedPrice - currentPrice);
            const percentageChange =
                currentPrice > 0
                    ? Math.abs(((recommendedPrice - currentPrice) / currentPrice) * 100)
                    : 0;

            // Get best match for confidence score
            const bestMatch = product.matchesAsUser[0];
            const confidenceScore = bestMatch
                ? parseFloat(bestMatch.confidenceScore.toString())
                : 0;

            // Evaluate each condition (AND logic - all must be satisfied)
            // Requirement 2.8: All conditions must be satisfied

            // Condition 1: Maximum price change (Requirement 2.1)
            if (conditions.maxPriceChange !== undefined) {
                if (priceChange > conditions.maxPriceChange) {
                    return false;
                }
            }

            // Condition 2: Maximum percentage change (Requirement 2.2)
            if (conditions.maxPercentageChange !== undefined) {
                if (percentageChange > conditions.maxPercentageChange) {
                    return false;
                }
            }

            // Condition 3: Minimum confidence score (Requirement 2.3)
            if (conditions.minConfidenceScore !== undefined) {
                if (confidenceScore < conditions.minConfidenceScore) {
                    return false;
                }
            }

            // Condition 4: Allowed strategies (Requirement 2.4)
            if (conditions.allowedStrategies !== undefined) {
                if (!change.appliedRule) {
                    return false;
                }
                if (!conditions.allowedStrategies.includes(change.appliedRule as any)) {
                    return false;
                }
            }

            // Condition 5: Product categories (Requirement 2.5)
            if (conditions.productCategories !== undefined) {
                if (!product.category) {
                    return false;
                }
                if (!conditions.productCategories.includes(product.category)) {
                    return false;
                }
            }

            // Condition 6: Price range (Requirement 2.6)
            if (conditions.priceRange !== undefined) {
                const { min, max } = conditions.priceRange;
                if (recommendedPrice < min || recommendedPrice > max) {
                    return false;
                }
            }

            // All conditions satisfied
            return true;
        } catch (error) {
            // If already an AppError, re-throw
            if (error instanceof AppError) {
                throw error;
            }

            // Wrap unexpected errors
            throw new AppError(
                "Failed to evaluate rule",
                500,
                "RULE_EVALUATION_ERROR",
                {
                    cause: error instanceof Error ? error : new Error(String(error)),
                    context: {
                        operation: "evaluateRule",
                        metadata: {
                            ruleId: rule.id,
                            changeId: change.id,
                            productId: product.id,
                        },
                    },
                }
            );
        }
    }
}
