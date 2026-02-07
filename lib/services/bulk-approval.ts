import { prisma } from "@/lib/prisma";
import type { PendingPriceChange, Product } from "@prisma/client";
import { AppError, ValidationError } from "@/lib/utils/error-handler";
import { WebhookService } from "@/lib/services/webhook";
import { NotificationService } from "@/lib/services/notification";

/**
 * Bulk Approval Service
 *
 * Optimized service for processing bulk approval operations with:
 * - Batched database operations
 * - Transaction consistency
 * - Progress tracking
 * - Optimized notification sending
 *
 * Requirements: 2.10.4
 */

/**
 * Progress callback for tracking bulk operations
 */
export type ProgressCallback = (progress: {
    processed: number;
    total: number;
    successful: number;
    failed: number;
    percentage: number;
}) => void;

/**
 * Result of bulk approval operation
 */
export interface BulkApprovalResult {
    total: number;
    successful: number;
    failed: number;
    errors: Array<{
        changeId: string;
        error: string;
    }>;
}

/**
 * Batch size for database operations
 * Larger batches = better performance but more memory usage
 */
const BATCH_SIZE = 50;

/**
 * Notification batch size
 * Group notifications to avoid overwhelming the notification system
 */
// const NOTIFICATION_BATCH_SIZE = 10; // Currently unused

export class BulkApprovalService {
    /**
     * Apply approved price changes in bulk with optimizations
     *
     * This method processes changes in batches using transactions for consistency,
     * tracks progress, and optimizes notification sending.
     *
     * @param changeIds - Array of pending price change IDs to approve
     * @param reviewedBy - Email of user approving the changes
     * @param onProgress - Optional callback for progress tracking
     * @returns Result with counts and any errors
     *
     * Requirements: 2.10.4
     */
    static async applyApprovedChanges(
        changeIds: string[],
        reviewedBy: string,
        onProgress?: ProgressCallback
    ): Promise<BulkApprovalResult> {
        try {
            // Validate inputs
            if (!changeIds || changeIds.length === 0) {
                throw new ValidationError(
                    "Change IDs are required",
                    { changeIds: ["At least one change ID is required"] }
                );
            }

            if (!reviewedBy || typeof reviewedBy !== "string") {
                throw new ValidationError(
                    "Reviewer email is required",
                    { reviewedBy: ["Reviewer email is required and must be a string"] }
                );
            }

            const total = changeIds.length;
            let successful = 0;
            let failed = 0;
            const errors: Array<{ changeId: string; error: string }> = [];

            // Load all changes upfront with product data (single query)
            const changes = await prisma.pendingPriceChange.findMany({
                where: {
                    id: { in: changeIds },
                    status: "PENDING",
                },
                include: {
                    Product: true,
                },
            });

            // Create a map for quick lookup
            const changeMap = new Map(changes.map(c => [c.id, c]));

            // Track which changes were not found or not pending
            for (const changeId of changeIds) {
                if (!changeMap.has(changeId)) {
                    errors.push({
                        changeId,
                        error: "Change not found or already processed",
                    });
                    failed++;
                }
            }

            // Process changes in batches for better performance
            const validChanges = Array.from(changeMap.values());
            const batches = this.createBatches(validChanges, BATCH_SIZE);

            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];

                try {
                    // Process entire batch in a single transaction
                    await this.processBatch(batch, reviewedBy);
                    successful += batch.length;
                } catch (error) {
                    // If batch fails, try processing items individually
                    const batchResult = await this.processBatchIndividually(batch, reviewedBy);
                    successful += batchResult.successful;
                    failed += batchResult.failed;
                    errors.push(...batchResult.errors);
                }

                // Report progress
                if (onProgress) {
                    const processed = successful + failed;
                    onProgress({
                        processed,
                        total,
                        successful,
                        failed,
                        percentage: Math.round((processed / total) * 100),
                    });
                }
            }

            // Send notifications in batches (post-transaction)
            await this.sendBatchNotifications(validChanges.slice(0, successful));

            // Dispatch webhooks in batches (post-transaction)
            await this.dispatchBatchWebhooks(validChanges.slice(0, successful));

            return {
                total,
                successful,
                failed,
                errors,
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError(
                "Failed to process bulk approvals",
                500,
                "BULK_APPROVAL_ERROR",
                {
                    cause: error instanceof Error ? error : new Error(String(error)),
                }
            );
        }
    }

    /**
     * Reject pending price changes in bulk with optimizations
     *
     * @param changeIds - Array of pending price change IDs to reject
     * @param reviewedBy - Email of user rejecting the changes
     * @param onProgress - Optional callback for progress tracking
     * @returns Result with counts and any errors
     *
     * Requirements: 2.10.4, 2.10.5 (Audit logging)
     */
    static async rejectPendingChanges(
        changeIds: string[],
        reviewedBy: string,
        onProgress?: ProgressCallback
    ): Promise<BulkApprovalResult> {
        try {
            // Validate inputs
            if (!changeIds || changeIds.length === 0) {
                throw new ValidationError(
                    "Change IDs are required",
                    { changeIds: ["At least one change ID is required"] }
                );
            }

            if (!reviewedBy || typeof reviewedBy !== "string") {
                throw new ValidationError(
                    "Reviewer email is required",
                    { reviewedBy: ["Reviewer email is required and must be a string"] }
                );
            }

            const total = changeIds.length;
            const errors: Array<{ changeId: string; error: string }> = [];

            // Load all changes upfront with product data for audit logging
            const changes = await prisma.pendingPriceChange.findMany({
                where: {
                    id: { in: changeIds },
                    status: "PENDING",
                },
                include: {
                    Product: true,
                },
            });

            // Use batched update for better performance
            const batches = this.createBatches(changes, BATCH_SIZE);
            let successful = 0;
            let failed = 0;

            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];

                try {
                    const now = new Date();

                    // Process batch in transaction
                    await prisma.$transaction(async (tx) => {
                        // Batch update all changes in this batch
                        await tx.pendingPriceChange.updateMany({
                            where: {
                                id: { in: batch.map(c => c.id) },
                                status: "PENDING",
                            },
                            data: {
                                status: "REJECTED",
                                reviewedAt: now,
                                reviewedBy,
                            },
                        });

                        // Create audit log entries for each rejection (Requirement 2.10.5)
                        await tx.tenantAuditLog.createMany({
                            data: batch.map(change => ({
                                tenantId: change.tenantId,
                                userId: reviewedBy,
                                userEmail: reviewedBy,
                                action: "REJECT_PRICE",
                                entityId: change.id,
                                details: JSON.stringify({
                                    productId: change.Product.id,
                                    productTitle: change.Product.title,
                                    productSku: change.Product.sku,
                                    currentPrice: change.currentPrice.toString(),
                                    recommendedPrice: change.recommendedPrice.toString(),
                                    reason: change.reason,
                                    appliedRule: change.appliedRule,
                                }),
                                ipAddress: null,
                            })),
                        });
                    });

                    successful += batch.length;
                } catch (error) {
                    // If batch fails, mark all as failed
                    failed += batch.length;
                    for (const change of batch) {
                        errors.push({
                            changeId: change.id,
                            error: error instanceof Error ? error.message : String(error),
                        });
                    }
                }

                // Report progress
                if (onProgress) {
                    const processed = successful + failed;
                    onProgress({
                        processed,
                        total,
                        successful,
                        failed,
                        percentage: Math.round((processed / total) * 100),
                    });
                }
            }

            return {
                total,
                successful,
                failed,
                errors,
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError(
                "Failed to process bulk rejections",
                500,
                "BULK_REJECTION_ERROR",
                {
                    cause: error instanceof Error ? error : new Error(String(error)),
                    context: {
                        operation: "rejectPendingChanges",
                        metadata: { changeCount: changeIds.length },
                    },
                }
            );
        }
    }

    /**
     * Process a batch of changes in a single transaction
     *
     * @param batch - Array of changes to process
     * @param reviewedBy - Email of reviewer
     *
     * Requirements: 2.10.4 (Use transactions for consistency), 2.10.5 (Audit logging)
     */
    private static async processBatch(
        batch: Array<PendingPriceChange & { Product: Product }>,
        reviewedBy: string
    ): Promise<void> {
        const now = new Date();

        await prisma.$transaction(async (tx) => {
            // Batch update all products
            for (const change of batch) {
                await tx.product.update({
                    where: { id: change.productId },
                    data: {
                        currentPrice: change.recommendedPrice,
                        lastCrawledAt: now,
                    },
                });
            }

            // Batch create price history records
            await tx.priceHistory.createMany({
                data: batch.map(change => ({
                    productId: change.productId,
                    price: change.recommendedPrice,
                    recordedAt: now,
                })),
            });

            // Batch update pending changes
            await tx.pendingPriceChange.updateMany({
                where: {
                    id: { in: batch.map(c => c.id) },
                },
                data: {
                    status: "APPROVED",
                    reviewedAt: now,
                    reviewedBy,
                },
            });

            // Create audit log entries for each approval (Requirement 2.10.5)
            await tx.tenantAuditLog.createMany({
                data: batch.map(change => ({
                    tenantId: change.tenantId,
                    userId: reviewedBy,
                    userEmail: reviewedBy,
                    action: "APPROVE_PRICE",
                    entityId: change.id,
                    details: JSON.stringify({
                        productId: change.Product.id,
                        productTitle: change.Product.title,
                        productSku: change.Product.sku,
                        oldPrice: change.currentPrice.toString(),
                        newPrice: change.recommendedPrice.toString(),
                        reason: change.reason,
                        appliedRule: change.appliedRule,
                    }),
                    ipAddress: null,
                })),
            });
        });
    }

    /**
     * Process batch items individually if batch processing fails
     *
     * @param batch - Array of changes to process
     * @param reviewedBy - Email of reviewer
     * @returns Result with counts and errors
     *
     * Requirements: 2.10.5 (Audit logging)
     */
    private static async processBatchIndividually(
        batch: Array<PendingPriceChange & { Product: Product }>,
        reviewedBy: string
    ): Promise<{
        successful: number;
        failed: number;
        errors: Array<{ changeId: string; error: string }>;
    }> {
        let successful = 0;
        let failed = 0;
        const errors: Array<{ changeId: string; error: string }> = [];

        for (const change of batch) {
            try {
                const now = new Date();

                await prisma.$transaction(async (tx) => {
                    await tx.product.update({
                        where: { id: change.productId },
                        data: {
                            currentPrice: change.recommendedPrice,
                            lastCrawledAt: now,
                        },
                    });

                    await tx.priceHistory.create({
                        data: {
                            productId: change.productId,
                            price: change.recommendedPrice,
                            recordedAt: now,
                        },
                    });

                    await tx.pendingPriceChange.update({
                        where: { id: change.id },
                        data: {
                            status: "APPROVED",
                            reviewedAt: now,
                            reviewedBy,
                        },
                    });

                    // Create audit log entry (Requirement 2.10.5)
                    await tx.tenantAuditLog.create({
                        data: {
                            tenantId: change.tenantId,
                            userId: reviewedBy,
                            userEmail: reviewedBy,
                            action: "APPROVE_PRICE",
                            entityId: change.id,
                            details: JSON.stringify({
                                productId: change.Product.id,
                                productTitle: change.Product.title,
                                productSku: change.Product.sku,
                                oldPrice: change.currentPrice.toString(),
                                newPrice: change.recommendedPrice.toString(),
                                reason: change.reason,
                                appliedRule: change.appliedRule,
                            }),
                            ipAddress: null,
                        },
                    });
                });

                successful++;
            } catch (error) {
                failed++;
                errors.push({
                    changeId: change.id,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        return { successful, failed, errors };
    }

    /**
     * Send notifications in batches to avoid overwhelming the system
     *
     * @param changes - Array of approved changes
     *
     * Requirements: 2.10.4 (Optimize notification sending)
     */
    private static async sendBatchNotifications(
        changes: Array<PendingPriceChange & { Product: Product }>
    ): Promise<void> {
        try {
            // Group changes by tenant for efficient notification
            const changesByTenant = new Map<string, typeof changes>();

            for (const change of changes) {
                const tenantChanges = changesByTenant.get(change.tenantId) || [];
                tenantChanges.push(change);
                changesByTenant.set(change.tenantId, tenantChanges);
            }

            // Send one summary notification per tenant instead of individual notifications
            for (const [tenantId, tenantChanges] of changesByTenant) {
                try {
                    // Send a single summary notification for all changes
                    await NotificationService.sendBulkApprovalSummary(
                        tenantId,
                        tenantChanges.length,
                        tenantChanges.map(c => ({
                            productTitle: c.Product.title,
                            oldPrice: parseFloat(c.currentPrice.toString()),
                            newPrice: parseFloat(c.recommendedPrice.toString()),
                        }))
                    );
                } catch (error) {
                    // Log error but don't fail the entire operation
                    if (process.env.NODE_ENV !== "test") {
                        console.error(
                            `[BulkApproval] Failed to send notification for tenant ${tenantId}:`,
                            error
                        );
                    }
                }
            }
        } catch (error) {
            // Log error but don't fail the entire operation
            if (process.env.NODE_ENV !== "test") {
                console.error("[BulkApproval] Failed to send batch notifications:", error);
            }
        }
    }

    /**
     * Dispatch webhooks in batches
     *
     * @param changes - Array of approved changes
     *
     * Requirements: 2.10.4 (Optimize notification sending)
     */
    private static async dispatchBatchWebhooks(
        changes: Array<PendingPriceChange & { Product: Product }>
    ): Promise<void> {
        try {
            // Group changes by tenant
            const changesByTenant = new Map<string, typeof changes>();

            for (const change of changes) {
                const tenantChanges = changesByTenant.get(change.tenantId) || [];
                tenantChanges.push(change);
                changesByTenant.set(change.tenantId, tenantChanges);
            }

            // Dispatch webhooks in batches per tenant
            for (const [tenantId, tenantChanges] of changesByTenant) {
                try {
                    // Send a single bulk webhook event instead of individual events
                    await WebhookService.dispatch(tenantId, "prices.bulk_updated", {
                        count: tenantChanges.length,
                        products: tenantChanges.map(change => ({
                            productId: change.Product.id,
                            sku: change.Product.sku,
                            title: change.Product.title,
                            oldPrice: change.currentPrice.toString(),
                            newPrice: change.recommendedPrice.toString(),
                            reason: change.reason,
                        })),
                        timestamp: new Date().toISOString(),
                    });
                } catch (error) {
                    // Log error but don't fail the entire operation
                    if (process.env.NODE_ENV !== "test") {
                        console.error(
                            `[BulkApproval] Failed to dispatch webhook for tenant ${tenantId}:`,
                            error
                        );
                    }
                }
            }
        } catch (error) {
            // Log error but don't fail the entire operation
            if (process.env.NODE_ENV !== "test") {
                console.error("[BulkApproval] Failed to dispatch batch webhooks:", error);
            }
        }
    }

    /**
     * Create batches from an array
     *
     * @param items - Array of items to batch
     * @param batchSize - Size of each batch
     * @returns Array of batches
     */
    private static createBatches<T>(items: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
}
