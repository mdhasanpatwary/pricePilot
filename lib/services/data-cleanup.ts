/**
 * Data Cleanup Service
 * 
 * Handles automated cleanup of old data according to retention policies.
 * Implements the retention policies defined in DOCUMENTATION.md.
 * 
 * Archive Strategy:
 * - Data is moved to archive tables before deletion
 * - Archive tables have minimal indexes for storage efficiency
 * - Archived data can be queried for historical analysis
 * - Archive tables are periodically cleaned based on extended retention policies
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export class DataCleanupService {
    /**
     * Archive old data before deletion
     * Moves data from main tables to archive tables for long-term storage
     */
    static async archiveOldData(): Promise<{
        priceHistory: number;
        auditLogs: number;
        notifications: number;
        syncLogs: number;
        priceUpdateLogs: number;
        bulkSnapshots: number;
        errors: string[];
    }> {
        const errors: string[] = [];

        logger.info('Starting data archival process');

        // Archive price history
        const priceHistoryResult = await this.archivePriceHistory();
        if (priceHistoryResult.error) errors.push(`Price History: ${priceHistoryResult.error}`);

        // Archive audit logs
        const auditLogsResult = await this.archiveAuditLogs();
        if (auditLogsResult.error) errors.push(`Audit Logs: ${auditLogsResult.error}`);

        // Archive notifications
        const notificationsResult = await this.archiveNotifications();
        if (notificationsResult.error) errors.push(`Notifications: ${notificationsResult.error}`);

        // Archive sync logs
        const syncLogsResult = await this.archiveSyncLogs();
        if (syncLogsResult.error) errors.push(`Sync Logs: ${syncLogsResult.error}`);

        // Archive price update logs
        const priceUpdateLogsResult = await this.archivePriceUpdateLogs();
        if (priceUpdateLogsResult.error) errors.push(`Price Update Logs: ${priceUpdateLogsResult.error}`);

        // Archive bulk snapshots
        const bulkSnapshotsResult = await this.archiveBulkSnapshots();
        if (bulkSnapshotsResult.error) errors.push(`Bulk Snapshots: ${bulkSnapshotsResult.error}`);

        logger.info('Data archival process completed', {
            priceHistory: priceHistoryResult.archived,
            auditLogs: auditLogsResult.archived,
            notifications: notificationsResult.archived,
            syncLogs: syncLogsResult.archived,
            priceUpdateLogs: priceUpdateLogsResult.archived,
            bulkSnapshots: bulkSnapshotsResult.archived,
            errors,
        });

        return {
            priceHistory: priceHistoryResult.archived,
            auditLogs: auditLogsResult.archived,
            notifications: notificationsResult.archived,
            syncLogs: syncLogsResult.archived,
            priceUpdateLogs: priceUpdateLogsResult.archived,
            bulkSnapshots: bulkSnapshotsResult.archived,
            errors,
        };
    }

    /**
     * Archive price history records older than 90 days
     */
    private static async archivePriceHistory(): Promise<{
        archived: number;
        error?: string;
    }> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);

            logger.info('Archiving old price history', {
                cutoffDate: cutoffDate.toISOString(),
            });

            // Fetch records to archive
            const recordsToArchive = await prisma.priceHistory.findMany({
                where: {
                    recordedAt: {
                        lt: cutoffDate,
                    },
                },
            });

            if (recordsToArchive.length === 0) {
                logger.info('No price history records to archive');
                return { archived: 0 };
            }

            // Archive in transaction
            await prisma.$transaction(async (tx) => {
                // Insert into archive table
                await tx.archivedPriceHistory.createMany({
                    data: recordsToArchive.map((record) => ({
                        id: record.id,
                        productId: record.productId,
                        price: record.price,
                        recordedAt: record.recordedAt,
                    })),
                });

                // Delete from main table
                await tx.priceHistory.deleteMany({
                    where: {
                        id: {
                            in: recordsToArchive.map((r) => r.id),
                        },
                    },
                });
            });

            logger.info('Price history archival completed', {
                archivedCount: recordsToArchive.length,
            });

            return { archived: recordsToArchive.length };
        } catch (error) {
            logger.error('Price history archival failed', { error });
            return {
                archived: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Archive audit logs older than 2 years (non-critical) or 5 years (critical)
     */
    private static async archiveAuditLogs(): Promise<{
        archived: number;
        error?: string;
    }> {
        try {
            const normalCutoffDate = new Date();
            normalCutoffDate.setFullYear(normalCutoffDate.getFullYear() - 2);

            const criticalCutoffDate = new Date();
            criticalCutoffDate.setFullYear(criticalCutoffDate.getFullYear() - 5);

            logger.info('Archiving old audit logs', {
                normalCutoffDate: normalCutoffDate.toISOString(),
                criticalCutoffDate: criticalCutoffDate.toISOString(),
            });

            const criticalActions = [
                'PASSWORD_CHANGE',
                'ROLE_CHANGE',
                'PERMISSION_CHANGE',
                'API_KEY_CREATE',
                'API_KEY_DELETE',
                'USER_CREATE',
                'USER_DELETE',
                'SECURITY_BREACH',
                'UNAUTHORIZED_ACCESS',
            ];

            // Archive non-critical logs older than 2 years
            const normalRecords = await prisma.tenantAuditLog.findMany({
                where: {
                    createdAt: {
                        lt: normalCutoffDate,
                    },
                    action: {
                        notIn: criticalActions,
                    },
                },
            });

            // Archive critical logs older than 5 years
            const criticalRecords = await prisma.tenantAuditLog.findMany({
                where: {
                    createdAt: {
                        lt: criticalCutoffDate,
                    },
                    action: {
                        in: criticalActions,
                    },
                },
            });

            const allRecords = [...normalRecords, ...criticalRecords];

            if (allRecords.length === 0) {
                logger.info('No audit logs to archive');
                return { archived: 0 };
            }

            // Archive in transaction
            await prisma.$transaction(async (tx) => {
                // Insert into archive table
                await tx.archivedTenantAuditLog.createMany({
                    data: allRecords.map((record) => ({
                        id: record.id,
                        tenantId: record.tenantId,
                        userId: record.userId,
                        userEmail: record.userEmail,
                        action: record.action,
                        entityId: record.entityId,
                        details: record.details,
                        ipAddress: record.ipAddress,
                        createdAt: record.createdAt,
                    })),
                });

                // Delete from main table
                await tx.tenantAuditLog.deleteMany({
                    where: {
                        id: {
                            in: allRecords.map((r) => r.id),
                        },
                    },
                });
            });

            logger.info('Audit log archival completed', {
                archivedCount: allRecords.length,
                normalCount: normalRecords.length,
                criticalCount: criticalRecords.length,
            });

            return { archived: allRecords.length };
        } catch (error) {
            logger.error('Audit log archival failed', { error });
            return {
                archived: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Archive notifications based on retention policy
     */
    private static async archiveNotifications(): Promise<{
        archived: number;
        error?: string;
    }> {
        try {
            const readCutoffDate = new Date();
            readCutoffDate.setDate(readCutoffDate.getDate() - 90);

            const unreadCutoffDate = new Date();
            unreadCutoffDate.setDate(unreadCutoffDate.getDate() - 180);

            const criticalCutoffDate = new Date();
            criticalCutoffDate.setDate(criticalCutoffDate.getDate() - 365);

            logger.info('Archiving old notifications');

            const criticalTypes = [
                'SECURITY_ALERT',
                'SYSTEM_CRITICAL',
                'PAYMENT_FAILED',
                'ACCOUNT_SUSPENDED',
            ];

            // Fetch all notifications to archive
            const readRecords = await prisma.notification.findMany({
                where: {
                    isRead: true,
                    createdAt: {
                        lt: readCutoffDate,
                    },
                    type: {
                        notIn: criticalTypes,
                    },
                },
            });

            const unreadRecords = await prisma.notification.findMany({
                where: {
                    isRead: false,
                    createdAt: {
                        lt: unreadCutoffDate,
                    },
                    type: {
                        notIn: criticalTypes,
                    },
                },
            });

            const criticalRecords = await prisma.notification.findMany({
                where: {
                    createdAt: {
                        lt: criticalCutoffDate,
                    },
                    type: {
                        in: criticalTypes,
                    },
                },
            });

            const allRecords = [...readRecords, ...unreadRecords, ...criticalRecords];

            if (allRecords.length === 0) {
                logger.info('No notifications to archive');
                return { archived: 0 };
            }

            // Archive in transaction
            await prisma.$transaction(async (tx) => {
                // Insert into archive table
                await tx.archivedNotification.createMany({
                    data: allRecords.map((record) => ({
                        id: record.id,
                        tenantId: record.tenantId,
                        type: record.type,
                        title: record.title,
                        message: record.message,
                        link: record.link,
                        isRead: record.isRead,
                        createdAt: record.createdAt,
                    })),
                });

                // Delete from main table
                await tx.notification.deleteMany({
                    where: {
                        id: {
                            in: allRecords.map((r) => r.id),
                        },
                    },
                });
            });

            logger.info('Notification archival completed', {
                archivedCount: allRecords.length,
            });

            return { archived: allRecords.length };
        } catch (error) {
            logger.error('Notification archival failed', { error });
            return {
                archived: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Archive sync logs based on retention policy
     */
    private static async archiveSyncLogs(): Promise<{
        archived: number;
        error?: string;
    }> {
        try {
            const successCutoffDate = new Date();
            successCutoffDate.setDate(successCutoffDate.getDate() - 30);

            const errorCutoffDate = new Date();
            errorCutoffDate.setDate(errorCutoffDate.getDate() - 90);

            logger.info('Archiving old sync logs');

            // Fetch records to archive
            const successRecords = await prisma.syncLog.findMany({
                where: {
                    createdAt: {
                        lt: successCutoffDate,
                    },
                    level: {
                        in: ['INFO', 'SUCCESS'],
                    },
                },
            });

            const errorRecords = await prisma.syncLog.findMany({
                where: {
                    createdAt: {
                        lt: errorCutoffDate,
                    },
                    level: {
                        in: ['ERROR', 'WARN'],
                    },
                },
            });

            const allRecords = [...successRecords, ...errorRecords];

            if (allRecords.length === 0) {
                logger.info('No sync logs to archive');
                return { archived: 0 };
            }

            // Archive in transaction
            await prisma.$transaction(async (tx) => {
                // Insert into archive table
                await tx.archivedSyncLog.createMany({
                    data: allRecords.map((record) => ({
                        id: record.id,
                        siteId: record.siteId,
                        message: record.message,
                        level: record.level,
                        createdAt: record.createdAt,
                    })),
                });

                // Delete from main table
                await tx.syncLog.deleteMany({
                    where: {
                        id: {
                            in: allRecords.map((r) => r.id),
                        },
                    },
                });
            });

            logger.info('Sync log archival completed', {
                archivedCount: allRecords.length,
            });

            return { archived: allRecords.length };
        } catch (error) {
            logger.error('Sync log archival failed', { error });
            return {
                archived: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Archive price update logs based on retention policy
     */
    private static async archivePriceUpdateLogs(): Promise<{
        archived: number;
        error?: string;
    }> {
        try {
            const successCutoffDate = new Date();
            successCutoffDate.setDate(successCutoffDate.getDate() - 180);

            const failedCutoffDate = new Date();
            failedCutoffDate.setDate(failedCutoffDate.getDate() - 365);

            logger.info('Archiving old price update logs');

            // Fetch records to archive
            const successRecords = await prisma.priceUpdateLog.findMany({
                where: {
                    executedAt: {
                        lt: successCutoffDate,
                    },
                    status: 'SUCCESS',
                },
            });

            const failedRecords = await prisma.priceUpdateLog.findMany({
                where: {
                    executedAt: {
                        lt: failedCutoffDate,
                    },
                    status: 'FAILED',
                },
            });

            const allRecords = [...successRecords, ...failedRecords];

            if (allRecords.length === 0) {
                logger.info('No price update logs to archive');
                return { archived: 0 };
            }

            // Archive in transaction
            await prisma.$transaction(async (tx) => {
                // Insert into archive table
                await tx.archivedPriceUpdateLog.createMany({
                    data: allRecords.map((record) => ({
                        id: record.id,
                        productId: record.productId,
                        oldPrice: record.oldPrice,
                        newPrice: record.newPrice,
                        logicType: record.logicType,
                        status: record.status,
                        errorDetails: record.errorDetails,
                        executedAt: record.executedAt,
                    })),
                });

                // Delete from main table
                await tx.priceUpdateLog.deleteMany({
                    where: {
                        id: {
                            in: allRecords.map((r) => r.id),
                        },
                    },
                });
            });

            logger.info('Price update log archival completed', {
                archivedCount: allRecords.length,
            });

            return { archived: allRecords.length };
        } catch (error) {
            logger.error('Price update log archival failed', { error });
            return {
                archived: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Archive bulk operation snapshots based on retention policy
     */
    private static async archiveBulkSnapshots(): Promise<{
        archived: number;
        error?: string;
    }> {
        try {
            const normalCutoffDate = new Date();
            normalCutoffDate.setDate(normalCutoffDate.getDate() - 90);

            const rolledBackCutoffDate = new Date();
            rolledBackCutoffDate.setDate(rolledBackCutoffDate.getDate() - 180);

            logger.info('Archiving old bulk snapshots');

            // Fetch records to archive
            const normalRecords = await prisma.bulkOperationSnapshot.findMany({
                where: {
                    createdAt: {
                        lt: normalCutoffDate,
                    },
                    rolledBack: false,
                },
            });

            const rolledBackRecords = await prisma.bulkOperationSnapshot.findMany({
                where: {
                    createdAt: {
                        lt: rolledBackCutoffDate,
                    },
                    rolledBack: true,
                },
            });

            const allRecords = [...normalRecords, ...rolledBackRecords];

            if (allRecords.length === 0) {
                logger.info('No bulk snapshots to archive');
                return { archived: 0 };
            }

            // Archive in transaction
            await prisma.$transaction(async (tx) => {
                // Insert into archive table
                await tx.archivedBulkOperationSnapshot.createMany({
                    data: allRecords.map((record) => ({
                        id: record.id,
                        tenantId: record.tenantId,
                        operation: record.operation,
                        productCount: record.productCount,
                        snapshot: record.snapshot,
                        changes: record.changes,
                        rolledBack: record.rolledBack,
                        idempotencyKey: record.idempotencyKey,
                        createdAt: record.createdAt,
                    })),
                });

                // Delete from main table
                await tx.bulkOperationSnapshot.deleteMany({
                    where: {
                        id: {
                            in: allRecords.map((r) => r.id),
                        },
                    },
                });
            });

            logger.info('Bulk snapshot archival completed', {
                archivedCount: allRecords.length,
            });

            return { archived: allRecords.length };
        } catch (error) {
            logger.error('Bulk snapshot archival failed', { error });
            return {
                archived: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Clean up old price history records (>90 days)
     * Retention: 90 days for hot data, older data should be archived
     */
    static async cleanupOldPriceHistory(): Promise<{
        deleted: number;
        error?: string;
    }> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);

            logger.info('Starting price history cleanup', {
                cutoffDate: cutoffDate.toISOString(),
            });

            const result = await prisma.priceHistory.deleteMany({
                where: {
                    recordedAt: {
                        lt: cutoffDate,
                    },
                },
            });

            logger.info('Price history cleanup completed', {
                deletedCount: result.count,
                cutoffDate: cutoffDate.toISOString(),
            });

            return {
                deleted: result.count,
            };
        } catch (error) {
            logger.error('Price history cleanup failed', { error });
            return {
                deleted: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Clean up old audit logs (>2 years)
     * Retention: 2 years for standard logs, 5 years for critical security events
     */
    static async cleanupOldAuditLogs(): Promise<{
        deleted: number;
        error?: string;
    }> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

            logger.info('Starting audit log cleanup', {
                cutoffDate: cutoffDate.toISOString(),
            });

            // Only delete non-critical audit logs
            // Critical security events (password changes, role changes, etc.) are kept for 5 years
            const criticalActions = [
                'PASSWORD_CHANGE',
                'ROLE_CHANGE',
                'PERMISSION_CHANGE',
                'API_KEY_CREATE',
                'API_KEY_DELETE',
                'USER_CREATE',
                'USER_DELETE',
                'SECURITY_BREACH',
                'UNAUTHORIZED_ACCESS',
            ];

            const result = await prisma.tenantAuditLog.deleteMany({
                where: {
                    createdAt: {
                        lt: cutoffDate,
                    },
                    action: {
                        notIn: criticalActions,
                    },
                },
            });

            logger.info('Audit log cleanup completed', {
                deletedCount: result.count,
                cutoffDate: cutoffDate.toISOString(),
            });

            return {
                deleted: result.count,
            };
        } catch (error) {
            logger.error('Audit log cleanup failed', { error });
            return {
                deleted: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Clean up old critical audit logs (>5 years)
     * Only for critical security events that have exceeded their extended retention
     */
    static async cleanupOldCriticalAuditLogs(): Promise<{
        deleted: number;
        error?: string;
    }> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setFullYear(cutoffDate.getFullYear() - 5);

            logger.info('Starting critical audit log cleanup', {
                cutoffDate: cutoffDate.toISOString(),
            });

            const criticalActions = [
                'PASSWORD_CHANGE',
                'ROLE_CHANGE',
                'PERMISSION_CHANGE',
                'API_KEY_CREATE',
                'API_KEY_DELETE',
                'USER_CREATE',
                'USER_DELETE',
                'SECURITY_BREACH',
                'UNAUTHORIZED_ACCESS',
            ];

            const result = await prisma.tenantAuditLog.deleteMany({
                where: {
                    createdAt: {
                        lt: cutoffDate,
                    },
                    action: {
                        in: criticalActions,
                    },
                },
            });

            logger.info('Critical audit log cleanup completed', {
                deletedCount: result.count,
                cutoffDate: cutoffDate.toISOString(),
            });

            return {
                deleted: result.count,
            };
        } catch (error) {
            logger.error('Critical audit log cleanup failed', { error });
            return {
                deleted: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Clean up old notifications
     * Retention: 90 days for read, 180 days for unread, 365 days for critical
     */
    static async cleanupOldNotifications(): Promise<{
        deleted: number;
        error?: string;
    }> {
        try {
            const readCutoffDate = new Date();
            readCutoffDate.setDate(readCutoffDate.getDate() - 90);

            const unreadCutoffDate = new Date();
            unreadCutoffDate.setDate(unreadCutoffDate.getDate() - 180);

            const criticalCutoffDate = new Date();
            criticalCutoffDate.setDate(criticalCutoffDate.getDate() - 365);

            logger.info('Starting notification cleanup', {
                readCutoffDate: readCutoffDate.toISOString(),
                unreadCutoffDate: unreadCutoffDate.toISOString(),
                criticalCutoffDate: criticalCutoffDate.toISOString(),
            });

            const criticalTypes = [
                'SECURITY_ALERT',
                'SYSTEM_CRITICAL',
                'PAYMENT_FAILED',
                'ACCOUNT_SUSPENDED',
            ];

            // Delete read notifications older than 90 days (non-critical)
            const readResult = await prisma.notification.deleteMany({
                where: {
                    isRead: true,
                    createdAt: {
                        lt: readCutoffDate,
                    },
                    type: {
                        notIn: criticalTypes,
                    },
                },
            });

            // Delete unread notifications older than 180 days (non-critical)
            const unreadResult = await prisma.notification.deleteMany({
                where: {
                    isRead: false,
                    createdAt: {
                        lt: unreadCutoffDate,
                    },
                    type: {
                        notIn: criticalTypes,
                    },
                },
            });

            // Delete critical notifications older than 365 days
            const criticalResult = await prisma.notification.deleteMany({
                where: {
                    createdAt: {
                        lt: criticalCutoffDate,
                    },
                    type: {
                        in: criticalTypes,
                    },
                },
            });

            const totalDeleted =
                readResult.count + unreadResult.count + criticalResult.count;

            logger.info('Notification cleanup completed', {
                readDeleted: readResult.count,
                unreadDeleted: unreadResult.count,
                criticalDeleted: criticalResult.count,
                totalDeleted,
            });

            return {
                deleted: totalDeleted,
            };
        } catch (error) {
            logger.error('Notification cleanup failed', { error });
            return {
                deleted: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Clean up old sync logs (>30 days)
     * Retention: 30 days for successful syncs, 90 days for failed syncs
     */
    static async cleanupOldSyncLogs(): Promise<{
        deleted: number;
        error?: string;
    }> {
        try {
            const successCutoffDate = new Date();
            successCutoffDate.setDate(successCutoffDate.getDate() - 30);

            const errorCutoffDate = new Date();
            errorCutoffDate.setDate(errorCutoffDate.getDate() - 90);

            logger.info('Starting sync log cleanup', {
                successCutoffDate: successCutoffDate.toISOString(),
                errorCutoffDate: errorCutoffDate.toISOString(),
            });

            // Delete successful sync logs older than 30 days
            const successResult = await prisma.syncLog.deleteMany({
                where: {
                    createdAt: {
                        lt: successCutoffDate,
                    },
                    level: {
                        in: ['INFO', 'SUCCESS'],
                    },
                },
            });

            // Delete error sync logs older than 90 days
            const errorResult = await prisma.syncLog.deleteMany({
                where: {
                    createdAt: {
                        lt: errorCutoffDate,
                    },
                    level: {
                        in: ['ERROR', 'WARN'],
                    },
                },
            });

            const totalDeleted = successResult.count + errorResult.count;

            logger.info('Sync log cleanup completed', {
                successDeleted: successResult.count,
                errorDeleted: errorResult.count,
                totalDeleted,
            });

            return {
                deleted: totalDeleted,
            };
        } catch (error) {
            logger.error('Sync log cleanup failed', { error });
            return {
                deleted: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Clean up old price update logs (>180 days for successful, >365 days for failed)
     */
    static async cleanupOldPriceUpdateLogs(): Promise<{
        deleted: number;
        error?: string;
    }> {
        try {
            const successCutoffDate = new Date();
            successCutoffDate.setDate(successCutoffDate.getDate() - 180);

            const failedCutoffDate = new Date();
            failedCutoffDate.setDate(failedCutoffDate.getDate() - 365);

            logger.info('Starting price update log cleanup', {
                successCutoffDate: successCutoffDate.toISOString(),
                failedCutoffDate: failedCutoffDate.toISOString(),
            });

            // Delete successful update logs older than 180 days
            const successResult = await prisma.priceUpdateLog.deleteMany({
                where: {
                    executedAt: {
                        lt: successCutoffDate,
                    },
                    status: 'SUCCESS',
                },
            });

            // Delete failed update logs older than 365 days
            const failedResult = await prisma.priceUpdateLog.deleteMany({
                where: {
                    executedAt: {
                        lt: failedCutoffDate,
                    },
                    status: 'FAILED',
                },
            });

            const totalDeleted = successResult.count + failedResult.count;

            logger.info('Price update log cleanup completed', {
                successDeleted: successResult.count,
                failedDeleted: failedResult.count,
                totalDeleted,
            });

            return {
                deleted: totalDeleted,
            };
        } catch (error) {
            logger.error('Price update log cleanup failed', { error });
            return {
                deleted: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Clean up old scraping metrics (>7 days for raw data)
     */
    static async cleanupOldScrapingMetrics(): Promise<{
        deleted: number;
        error?: string;
    }> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 7);

            logger.info('Starting scraping metrics cleanup', {
                cutoffDate: cutoffDate.toISOString(),
            });

            const result = await prisma.scrapingMetrics.deleteMany({
                where: {
                    timestamp: {
                        lt: cutoffDate,
                    },
                },
            });

            logger.info('Scraping metrics cleanup completed', {
                deletedCount: result.count,
                cutoffDate: cutoffDate.toISOString(),
            });

            return {
                deleted: result.count,
            };
        } catch (error) {
            logger.error('Scraping metrics cleanup failed', { error });
            return {
                deleted: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Clean up old bulk operation snapshots (>90 days, >180 days for rolled back)
     */
    static async cleanupOldBulkSnapshots(): Promise<{
        deleted: number;
        error?: string;
    }> {
        try {
            const normalCutoffDate = new Date();
            normalCutoffDate.setDate(normalCutoffDate.getDate() - 90);

            const rolledBackCutoffDate = new Date();
            rolledBackCutoffDate.setDate(rolledBackCutoffDate.getDate() - 180);

            logger.info('Starting bulk snapshot cleanup', {
                normalCutoffDate: normalCutoffDate.toISOString(),
                rolledBackCutoffDate: rolledBackCutoffDate.toISOString(),
            });

            // Delete normal snapshots older than 90 days
            const normalResult = await prisma.bulkOperationSnapshot.deleteMany({
                where: {
                    createdAt: {
                        lt: normalCutoffDate,
                    },
                    rolledBack: false,
                },
            });

            // Delete rolled back snapshots older than 180 days
            const rolledBackResult = await prisma.bulkOperationSnapshot.deleteMany({
                where: {
                    createdAt: {
                        lt: rolledBackCutoffDate,
                    },
                    rolledBack: true,
                },
            });

            const totalDeleted = normalResult.count + rolledBackResult.count;

            logger.info('Bulk snapshot cleanup completed', {
                normalDeleted: normalResult.count,
                rolledBackDeleted: rolledBackResult.count,
                totalDeleted,
            });

            return {
                deleted: totalDeleted,
            };
        } catch (error) {
            logger.error('Bulk snapshot cleanup failed', { error });
            return {
                deleted: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Clean up expired sessions (>7 days past expiration)
     */
    static async cleanupExpiredSessions(): Promise<{
        deleted: number;
        error?: string;
    }> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 7);

            logger.info('Starting expired session cleanup', {
                cutoffDate: cutoffDate.toISOString(),
            });

            const result = await prisma.session.deleteMany({
                where: {
                    expires: {
                        lt: cutoffDate,
                    },
                },
            });

            logger.info('Expired session cleanup completed', {
                deletedCount: result.count,
                cutoffDate: cutoffDate.toISOString(),
            });

            return {
                deleted: result.count,
            };
        } catch (error) {
            logger.error('Expired session cleanup failed', { error });
            return {
                deleted: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Run all cleanup jobs
     * This is useful for manual cleanup or testing
     */
    static async runAllCleanupJobs(): Promise<{
        priceHistory: number;
        auditLogs: number;
        notifications: number;
        syncLogs: number;
        priceUpdateLogs: number;
        scrapingMetrics: number;
        bulkSnapshots: number;
        sessions: number;
        errors: string[];
    }> {
        const errors: string[] = [];

        const priceHistoryResult = await this.cleanupOldPriceHistory();
        if (priceHistoryResult.error) errors.push(`Price History: ${priceHistoryResult.error}`);

        const auditLogsResult = await this.cleanupOldAuditLogs();
        if (auditLogsResult.error) errors.push(`Audit Logs: ${auditLogsResult.error}`);

        const notificationsResult = await this.cleanupOldNotifications();
        if (notificationsResult.error) errors.push(`Notifications: ${notificationsResult.error}`);

        const syncLogsResult = await this.cleanupOldSyncLogs();
        if (syncLogsResult.error) errors.push(`Sync Logs: ${syncLogsResult.error}`);

        const priceUpdateLogsResult = await this.cleanupOldPriceUpdateLogs();
        if (priceUpdateLogsResult.error) errors.push(`Price Update Logs: ${priceUpdateLogsResult.error}`);

        const scrapingMetricsResult = await this.cleanupOldScrapingMetrics();
        if (scrapingMetricsResult.error) errors.push(`Scraping Metrics: ${scrapingMetricsResult.error}`);

        const bulkSnapshotsResult = await this.cleanupOldBulkSnapshots();
        if (bulkSnapshotsResult.error) errors.push(`Bulk Snapshots: ${bulkSnapshotsResult.error}`);

        const sessionsResult = await this.cleanupExpiredSessions();
        if (sessionsResult.error) errors.push(`Sessions: ${sessionsResult.error}`);

        return {
            priceHistory: priceHistoryResult.deleted,
            auditLogs: auditLogsResult.deleted,
            notifications: notificationsResult.deleted,
            syncLogs: syncLogsResult.deleted,
            priceUpdateLogs: priceUpdateLogsResult.deleted,
            scrapingMetrics: scrapingMetricsResult.deleted,
            bulkSnapshots: bulkSnapshotsResult.deleted,
            sessions: sessionsResult.deleted,
            errors,
        };
    }
}
