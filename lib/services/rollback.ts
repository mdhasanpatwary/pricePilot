/**
 * Rollback Service for PricePilot
 *
 * Provides functionality to rollback price changes and bulk operations.
 * Ensures data integrity and maintains audit trails for all rollback operations.
 *
 * Features:
 * - Single price change rollback
 * - Bulk operation rollback
 * - Audit trail maintenance
 * - Notification system integration
 * - Store synchronization
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { NotFoundError, ValidationError, AppError } from "@/lib/utils/error-handler";
import { NotificationService } from "./notification";
import { SyncService } from "./sync";

/**
 * Rollback Service
 * Handles rollback operations for price changes and bulk operations
 */
export class RollbackService {
    /**
     * Rollback a single price change
     *
     * This method:
     * 1. Retrieves the price update log
     * 2. Reverts the product price to the old price
     * 3. Records the rollback in price history
     * 4. Creates a new price update log for the rollback
     * 5. Creates an audit log entry
     * 6. Syncs the change to the store
     * 7. Sends a notification to the tenant
     *
     * @param updateLogId - ID of the price update log to rollback
     * @param userId - ID of the user performing the rollback
     * @throws NotFoundError if the update log is not found
     * @throws ValidationError if the update log is invalid
     * @throws AppError if the rollback fails
     */
    static async rollbackPriceChange(updateLogId: string, userId: string): Promise<void> {
        try {
            logger.info('[RollbackService] Starting price change rollback', {
                updateLogId,
                userId,
            });

            // Retrieve the price update log with product and site information
            const updateLog = await prisma.priceUpdateLog.findUnique({
                where: { id: updateLogId },
                include: {
                    product: {
                        include: {
                            site: true,
                        },
                    },
                },
            });

            if (!updateLog) {
                throw new NotFoundError('PriceUpdateLog', updateLogId, {
                    context: {
                        operation: 'rollbackPriceChange',
                        userId,
                    },
                });
            }

            // Validate that the update was successful (can only rollback successful updates)
            if (updateLog.status !== 'SUCCESS') {
                throw new ValidationError(
                    'Can only rollback successful price updates',
                    {
                        status: ['Update status must be SUCCESS to rollback'],
                    },
                    {
                        context: {
                            operation: 'rollbackPriceChange',
                            userId,
                            metadata: { updateLogId, status: updateLog.status },
                        },
                    }
                );
            }

            const product = updateLog.product;
            const oldPrice = updateLog.oldPrice;
            const currentPrice = updateLog.newPrice;
            const tenantId = product.tenantId;

            logger.info('[RollbackService] Rolling back price change', {
                productId: product.id,
                productTitle: product.title,
                currentPrice: currentPrice.toString(),
                rollbackToPrice: oldPrice.toString(),
                tenantId,
            });

            // Perform rollback in a transaction to ensure atomicity
            await prisma.$transaction(async (tx) => {
                // 1. Revert product price to old price
                await tx.product.update({
                    where: { id: product.id },
                    data: {
                        currentPrice: oldPrice,
                        updatedAt: new Date(),
                    },
                });

                // 2. Record price history
                await tx.priceHistory.create({
                    data: {
                        productId: product.id,
                        price: oldPrice,
                        recordedAt: new Date(),
                    },
                });

                // 3. Create rollback log entry
                await tx.priceUpdateLog.create({
                    data: {
                        productId: product.id,
                        oldPrice: currentPrice,
                        newPrice: oldPrice,
                        logicType: 'FIXED',
                        status: 'SUCCESS',
                        executedAt: new Date(),
                    },
                });

                // 4. Create audit log entry
                await tx.tenantAuditLog.create({
                    data: {
                        tenantId,
                        userId,
                        userEmail: 'system', // Will be updated with actual user email in API handler
                        action: 'ROLLBACK_PRICE',
                        entityId: updateLogId,
                        details: JSON.stringify({
                            productId: product.id,
                            productTitle: product.title,
                            oldPrice: currentPrice.toString(),
                            newPrice: oldPrice.toString(),
                            originalUpdateLogId: updateLogId,
                        }),
                    },
                });
            });

            // 5. Sync the rollback to the store
            try {
                await SyncService.syncProductsToStore(product.siteId);
                logger.info('[RollbackService] Successfully synced rollback to store', {
                    productId: product.id,
                    siteId: product.siteId,
                });
            } catch (syncError) {
                // Log sync error but don't fail the rollback
                logger.error('[RollbackService] Failed to sync rollback to store', {
                    error: syncError,
                    productId: product.id,
                    siteId: product.siteId,
                });

                // Create notification about sync failure
                await NotificationService.create({
                    tenantId,
                    type: 'SYNC_ERROR',
                    title: 'Rollback Sync Failed',
                    message: `Price was rolled back in database but failed to sync to store for "${product.title}". Please sync manually.`,
                    link: `/dashboard/products/${product.id}`,
                });
            }

            // 6. Send success notification
            await NotificationService.create({
                tenantId,
                type: 'PRICE_ALERT',
                title: 'Price Rolled Back',
                message: `Price for "${product.title}" was successfully rolled back from ${currentPrice} to ${oldPrice}`,
                link: `/dashboard/products/${product.id}`,
            });

            logger.info('[RollbackService] Price change rollback completed successfully', {
                updateLogId,
                productId: product.id,
                tenantId,
            });
        } catch (error) {
            logger.error('[RollbackService] Price change rollback failed', {
                error,
                updateLogId,
                userId,
            });
            throw error;
        }
    }

    /**
     * Rollback a bulk operation
     *
     * This method:
     * 1. Retrieves the bulk operation snapshot
     * 2. Validates that it hasn't been rolled back already
     * 3. Reverts all product prices from the snapshot
     * 4. Records price history for each product
     * 5. Marks the snapshot as rolled back
     * 6. Creates an audit log entry
     * 7. Syncs the rollback to all affected stores
     * 8. Sends a notification to the tenant
     *
     * @param snapshotId - ID of the bulk operation snapshot to rollback
     * @param userId - ID of the user performing the rollback
     * @throws NotFoundError if the snapshot is not found
     * @throws ValidationError if the snapshot has already been rolled back
     * @throws AppError if the rollback fails
     */
    static async rollbackBulkOperation(snapshotId: string, userId: string): Promise<void> {
        try {
            logger.info('[RollbackService] Starting bulk operation rollback', {
                snapshotId,
                userId,
            });

            // Retrieve the bulk operation snapshot
            const snapshot = await prisma.bulkOperationSnapshot.findUnique({
                where: { id: snapshotId },
            });

            if (!snapshot) {
                throw new NotFoundError('BulkOperationSnapshot', snapshotId, {
                    context: {
                        operation: 'rollbackBulkOperation',
                        userId,
                    },
                });
            }

            // Validate that the operation hasn't been rolled back already
            if (snapshot.rolledBack) {
                throw new ValidationError(
                    'Bulk operation has already been rolled back',
                    {
                        rolledBack: ['This operation was already rolled back'],
                    },
                    {
                        context: {
                            operation: 'rollbackBulkOperation',
                            userId,
                            metadata: { snapshotId },
                        },
                    }
                );
            }

            const tenantId = snapshot.tenantId;
            const changes = JSON.parse(snapshot.changes) as Array<{
                productId: string;
                oldPrice: string;
                newPrice: string;
            }>;

            logger.info('[RollbackService] Rolling back bulk operation', {
                snapshotId,
                operation: snapshot.operation,
                productCount: snapshot.productCount,
                tenantId,
            });

            // Collect unique site IDs for syncing
            const productIds = changes.map(c => c.productId);
            const products = await prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { siteId: true },
            });
            const uniqueSiteIds = [...new Set(products.map(p => p.siteId))];

            // Perform rollback in a transaction to ensure atomicity
            await prisma.$transaction(async (tx) => {
                // 1. Rollback each product price
                for (const change of changes) {
                    // Update product price
                    await tx.product.update({
                        where: { id: change.productId },
                        data: {
                            currentPrice: change.oldPrice,
                            updatedAt: new Date(),
                        },
                    });

                    // Record price history
                    await tx.priceHistory.create({
                        data: {
                            productId: change.productId,
                            price: change.oldPrice,
                            recordedAt: new Date(),
                        },
                    });

                    // Create rollback log entry
                    await tx.priceUpdateLog.create({
                        data: {
                            productId: change.productId,
                            oldPrice: change.newPrice,
                            newPrice: change.oldPrice,
                            logicType: 'FIXED',
                            status: 'SUCCESS',
                            executedAt: new Date(),
                        },
                    });
                }

                // 2. Mark snapshot as rolled back
                await tx.bulkOperationSnapshot.update({
                    where: { id: snapshotId },
                    data: {
                        rolledBack: true,
                    },
                });

                // 3. Create audit log entry
                await tx.tenantAuditLog.create({
                    data: {
                        tenantId,
                        userId,
                        userEmail: 'system', // Will be updated with actual user email in API handler
                        action: 'ROLLBACK_BULK_OPERATION',
                        entityId: snapshotId,
                        details: JSON.stringify({
                            operation: snapshot.operation,
                            productCount: snapshot.productCount,
                            snapshotId,
                        }),
                    },
                });
            });

            // 4. Sync rollback to stores
            const syncResults: Array<{ siteId: string; success: boolean; error?: string }> = [];

            for (const siteId of uniqueSiteIds) {
                try {
                    await SyncService.syncProductsToStore(siteId);
                    syncResults.push({ siteId, success: true });
                    logger.info('[RollbackService] Successfully synced bulk rollback to store', {
                        siteId,
                        snapshotId,
                    });
                } catch (syncError) {
                    const errorMessage = syncError instanceof Error ? syncError.message : String(syncError);
                    syncResults.push({ siteId, success: false, error: errorMessage });

                    // Log sync error but don't fail the rollback
                    logger.error('[RollbackService] Failed to sync bulk rollback to store', {
                        error: syncError,
                        siteId,
                        snapshotId,
                    });
                }
            }

            // 5. Check if any syncs failed and create notification if needed
            const failedSyncs = syncResults.filter(r => !r.success);
            if (failedSyncs.length > 0) {
                await NotificationService.create({
                    tenantId,
                    type: 'SYNC_ERROR',
                    title: 'Bulk Rollback Sync Failed',
                    message: `Prices were rolled back in database but failed to sync to ${failedSyncs.length} store(s). Please sync manually.`,
                    link: `/dashboard/integrations`,
                });
            }

            // 6. Send success notification
            await NotificationService.create({
                tenantId,
                type: 'SYSTEM',
                title: 'Bulk Operation Rolled Back',
                message: `Successfully rolled back ${snapshot.productCount} product price changes from bulk operation`,
                link: `/dashboard/activity`,
            });

            logger.info('[RollbackService] Bulk operation rollback completed successfully', {
                snapshotId,
                productCount: snapshot.productCount,
                tenantId,
            });
        } catch (error) {
            logger.error('[RollbackService] Bulk operation rollback failed', {
                error,
                snapshotId,
                userId,
            });
            throw error;
        }
    }

    /**
     * Get rollback history for a tenant
     *
     * Retrieves all rollback operations (both single and bulk) for a tenant
     *
     * @param tenantId - ID of the tenant
     * @param limit - Maximum number of records to return (default: 50)
     * @returns Array of rollback history entries
     */
    static async getRollbackHistory(
        tenantId: string,
        limit: number = 50
    ): Promise<Array<{
        id: string;
        type: 'SINGLE' | 'BULK';
        timestamp: Date;
        userId: string;
        userEmail: string;
        details: any;
    }>> {
        try {
            const auditLogs = await prisma.tenantAuditLog.findMany({
                where: {
                    tenantId,
                    action: {
                        in: ['ROLLBACK_PRICE', 'ROLLBACK_BULK_OPERATION'],
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: limit,
            });

            return auditLogs.map((log) => ({
                id: log.id,
                type: log.action === 'ROLLBACK_PRICE' ? 'SINGLE' : 'BULK',
                timestamp: log.createdAt,
                userId: log.userId,
                userEmail: log.userEmail,
                details: JSON.parse(log.details || '{}'),
            }));
        } catch (error) {
            logger.error('[RollbackService] Failed to get rollback history', {
                error,
                tenantId,
            });
            throw new AppError(
                'Failed to retrieve rollback history',
                500,
                'ROLLBACK_HISTORY_ERROR',
                {
                    context: {
                        operation: 'getRollbackHistory',
                        tenantId,
                    },
                    cause: error instanceof Error ? error : undefined,
                }
            );
        }
    }

    /**
     * Check if a price update can be rolled back
     *
     * @param updateLogId - ID of the price update log
     * @returns Object indicating if rollback is possible and reason if not
     */
    static async canRollback(
        updateLogId: string
    ): Promise<{ canRollback: boolean; reason?: string }> {
        try {
            const updateLog = await prisma.priceUpdateLog.findUnique({
                where: { id: updateLogId },
                include: {
                    product: true,
                },
            });

            if (!updateLog) {
                return {
                    canRollback: false,
                    reason: 'Price update log not found',
                };
            }

            if (updateLog.status !== 'SUCCESS') {
                return {
                    canRollback: false,
                    reason: 'Can only rollback successful price updates',
                };
            }

            // Check if there have been subsequent price changes
            const laterUpdates = await prisma.priceUpdateLog.findMany({
                where: {
                    productId: updateLog.productId,
                    executedAt: {
                        gt: updateLog.executedAt,
                    },
                    status: 'SUCCESS',
                },
                take: 1,
            });

            if (laterUpdates.length > 0) {
                return {
                    canRollback: false,
                    reason: 'Cannot rollback: there have been subsequent price changes',
                };
            }

            return {
                canRollback: true,
            };
        } catch (error) {
            logger.error('[RollbackService] Failed to check rollback eligibility', {
                error,
                updateLogId,
            });
            return {
                canRollback: false,
                reason: 'Error checking rollback eligibility',
            };
        }
    }

    /**
     * Check if a bulk operation can be rolled back
     *
     * @param snapshotId - ID of the bulk operation snapshot
     * @returns Object indicating if rollback is possible and reason if not
     */
    static async canRollbackBulkOperation(
        snapshotId: string
    ): Promise<{ canRollback: boolean; reason?: string }> {
        try {
            const snapshot = await prisma.bulkOperationSnapshot.findUnique({
                where: { id: snapshotId },
            });

            if (!snapshot) {
                return {
                    canRollback: false,
                    reason: 'Bulk operation snapshot not found',
                };
            }

            if (snapshot.rolledBack) {
                return {
                    canRollback: false,
                    reason: 'This operation has already been rolled back',
                };
            }

            return {
                canRollback: true,
            };
        } catch (error) {
            logger.error('[RollbackService] Failed to check bulk rollback eligibility', {
                error,
                snapshotId,
            });
            return {
                canRollback: false,
                reason: 'Error checking rollback eligibility',
            };
        }
    }
}
