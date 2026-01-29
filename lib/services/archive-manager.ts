/**
 * Archive Manager
 * 
 * Manages data lifecycle and archival of historical records.
 * Archives old price history and audit logs to separate partitioned tables
 * to maintain optimal performance on active tables.
 * 
 * Features:
 * - Age-based archival (90 days for price history, 365 days for audit logs)
 * - Batch processing (10,000 records per transaction)
 * - Referential integrity preservation
 * - Compressed storage for archived data
 * - Read-only API access to archived data
 * - Scheduled archival during maintenance windows (2-4 AM UTC)
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

export interface ArchiveResult {
    recordsArchived: number;
    recordsDeleted: number;
    durationMs: number;
    spaceFreedBytes: number;
}

export interface ArchiveStats {
    priceHistoryArchived: number;
    auditLogsArchived: number;
    totalArchiveSizeBytes: number;
    oldestArchivedRecord: Date | null;
}

export interface ArchivalConfig {
    table: string;
    retentionDays: number;
    scheduleTime: string; // Cron expression
    compressionEnabled: boolean;
}

export interface ArchiveQueryFilters {
    tenantId?: string;
    productId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}

const BATCH_SIZE = 10000; // Process 10,000 records per transaction
const DEFAULT_PRICE_HISTORY_RETENTION_DAYS = 90;
const DEFAULT_AUDIT_LOG_RETENTION_DAYS = 365;

export class ArchiveManager {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    /**
     * Archive old price history records
     * Moves records older than specified days to archive table
     * 
     * @param olderThanDays - Archive records older than this many days (default: 90)
     * @returns Archive operation result
     */
    async archivePriceHistory(
        olderThanDays: number = DEFAULT_PRICE_HISTORY_RETENTION_DAYS
    ): Promise<ArchiveResult> {
        const startTime = Date.now();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        logger.info('Starting price history archival', {
            olderThanDays,
            cutoffDate: cutoffDate.toISOString(),
        });

        let totalArchived = 0;
        let totalDeleted = 0;
        let spaceFreed = 0;

        try {
            // Process in batches to avoid transaction timeouts
            let hasMoreRecords = true;

            while (hasMoreRecords) {
                const result = await this.prisma.$transaction(async (tx) => {
                    // Get batch of old records
                    const oldRecords = await tx.$queryRaw<any[]>`
            SELECT 
              ph.id,
              ph."productId" as product_id,
              ph.price,
              ph."recordedAt" as recorded_at,
              ph."recordedAt" as created_at,
              p."tenantId" as tenant_id
            FROM "PriceHistory" ph
            JOIN "Product" p ON p.id = ph."productId"
            WHERE ph."recordedAt" < ${cutoffDate}
            ORDER BY ph."recordedAt" ASC
            LIMIT ${BATCH_SIZE}
          `;

                    if (oldRecords.length === 0) {
                        return { archived: 0, deleted: 0 };
                    }

                    // Insert into archive table
                    const insertQuery = `
            INSERT INTO price_history_archive (
              id, product_id, price, recorded_at, created_at, tenant_id, archived_at
            )
            SELECT * FROM UNNEST(
              $1::text[], $2::text[], $3::decimal[], $4::timestamp[], 
              $5::timestamp[], $6::text[], $7::timestamp[]
            )
            ON CONFLICT (id) DO NOTHING
          `;

                    const ids = oldRecords.map(r => r.id);
                    const productIds = oldRecords.map(r => r.product_id);
                    const prices = oldRecords.map(r => r.price);
                    const recordedAts = oldRecords.map(r => r.recorded_at);
                    const createdAts = oldRecords.map(r => r.created_at);
                    const tenantIds = oldRecords.map(r => r.tenant_id);
                    const archivedAts = oldRecords.map(() => new Date());

                    await tx.$executeRawUnsafe(
                        insertQuery,
                        ids,
                        productIds,
                        prices,
                        recordedAts,
                        createdAts,
                        tenantIds,
                        archivedAts
                    );

                    // Delete from main table
                    const deleteResult = await tx.$executeRaw`
            DELETE FROM "PriceHistory"
            WHERE id = ANY(${ids}::text[])
          `;

                    return {
                        archived: oldRecords.length,
                        deleted: Number(deleteResult),
                    };
                });

                totalArchived += result.archived;
                totalDeleted += result.deleted;

                // Estimate space freed (rough estimate: 100 bytes per record)
                spaceFreed += result.deleted * 100;

                hasMoreRecords = result.archived === BATCH_SIZE;

                logger.info('Price history batch archived', {
                    batchArchived: result.archived,
                    batchDeleted: result.deleted,
                    totalArchived,
                    totalDeleted,
                });
            }

            const durationMs = Date.now() - startTime;

            logger.info('Price history archival completed', {
                totalArchived,
                totalDeleted,
                durationMs,
                spaceFreedBytes: spaceFreed,
            });

            return {
                recordsArchived: totalArchived,
                recordsDeleted: totalDeleted,
                durationMs,
                spaceFreedBytes: spaceFreed,
            };
        } catch (error) {
            logger.error('Price history archival failed', { error });
            throw error;
        }
    }

    /**
     * Archive old audit log records
     * Moves records older than specified days to archive table
     * 
     * @param olderThanDays - Archive records older than this many days (default: 365)
     * @returns Archive operation result
     */
    async archiveAuditLogs(
        olderThanDays: number = DEFAULT_AUDIT_LOG_RETENTION_DAYS
    ): Promise<ArchiveResult> {
        const startTime = Date.now();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        logger.info('Starting audit logs archival', {
            olderThanDays,
            cutoffDate: cutoffDate.toISOString(),
        });

        let totalArchived = 0;
        let totalDeleted = 0;
        let spaceFreed = 0;

        try {
            // Process in batches to avoid transaction timeouts
            let hasMoreRecords = true;

            while (hasMoreRecords) {
                const result = await this.prisma.$transaction(async (tx) => {
                    // Get batch of old records
                    const oldRecords = await tx.$queryRaw<any[]>`
            SELECT 
              id,
              "tenantId" as tenant_id,
              "userId" as user_id,
              "userEmail" as user_email,
              action,
              "entityId" as entity_id,
              details,
              "ipAddress" as ip_address,
              "createdAt" as created_at
            FROM "TenantAuditLog"
            WHERE "createdAt" < ${cutoffDate}
            ORDER BY "createdAt" ASC
            LIMIT ${BATCH_SIZE}
          `;

                    if (oldRecords.length === 0) {
                        return { archived: 0, deleted: 0 };
                    }

                    // Insert into archive table
                    const insertQuery = `
            INSERT INTO audit_logs_archive (
              id, tenant_id, user_id, user_email, action, entity_id, 
              details, ip_address, created_at, archived_at
            )
            SELECT * FROM UNNEST(
              $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], 
              $6::text[], $7::text[], $8::text[], $9::timestamp[], $10::timestamp[]
            )
            ON CONFLICT (id) DO NOTHING
          `;

                    const ids = oldRecords.map(r => r.id);
                    const tenantIds = oldRecords.map(r => r.tenant_id);
                    const userIds = oldRecords.map(r => r.user_id);
                    const userEmails = oldRecords.map(r => r.user_email);
                    const actions = oldRecords.map(r => r.action);
                    const entityIds = oldRecords.map(r => r.entity_id);
                    const details = oldRecords.map(r => r.details);
                    const ipAddresses = oldRecords.map(r => r.ip_address);
                    const createdAts = oldRecords.map(r => r.created_at);
                    const archivedAts = oldRecords.map(() => new Date());

                    await tx.$executeRawUnsafe(
                        insertQuery,
                        ids,
                        tenantIds,
                        userIds,
                        userEmails,
                        actions,
                        entityIds,
                        details,
                        ipAddresses,
                        createdAts,
                        archivedAts
                    );

                    // Delete from main table
                    const deleteResult = await tx.$executeRaw`
            DELETE FROM "TenantAuditLog"
            WHERE id = ANY(${ids}::text[])
          `;

                    return {
                        archived: oldRecords.length,
                        deleted: Number(deleteResult),
                    };
                });

                totalArchived += result.archived;
                totalDeleted += result.deleted;

                // Estimate space freed (rough estimate: 200 bytes per record)
                spaceFreed += result.deleted * 200;

                hasMoreRecords = result.archived === BATCH_SIZE;

                logger.info('Audit logs batch archived', {
                    batchArchived: result.archived,
                    batchDeleted: result.deleted,
                    totalArchived,
                    totalDeleted,
                });
            }

            const durationMs = Date.now() - startTime;

            logger.info('Audit logs archival completed', {
                totalArchived,
                totalDeleted,
                durationMs,
                spaceFreedBytes: spaceFreed,
            });

            return {
                recordsArchived: totalArchived,
                recordsDeleted: totalDeleted,
                durationMs,
                spaceFreedBytes: spaceFreed,
            };
        } catch (error) {
            logger.error('Audit logs archival failed', { error });
            throw error;
        }
    }

    /**
     * Query archived price history data
     * Provides read-only access to archived records
     * 
     * @param filters - Query filters
     * @returns Array of archived price history records
     */
    async queryPriceHistoryArchive(
        filters: ArchiveQueryFilters
    ): Promise<any[]> {
        try {
            const conditions: string[] = [];
            const params: any[] = [];
            let paramIndex = 1;

            if (filters.tenantId) {
                conditions.push(`tenant_id = $${paramIndex++}`);
                params.push(filters.tenantId);
            }

            if (filters.productId) {
                conditions.push(`product_id = $${paramIndex++}`);
                params.push(filters.productId);
            }

            if (filters.startDate) {
                conditions.push(`recorded_at >= $${paramIndex++}`);
                params.push(filters.startDate);
            }

            if (filters.endDate) {
                conditions.push(`recorded_at <= $${paramIndex++}`);
                params.push(filters.endDate);
            }

            const whereClause = conditions.length > 0
                ? `WHERE ${conditions.join(' AND ')}`
                : '';

            const limit = filters.limit || 100;
            const offset = filters.offset || 0;

            const query = `
        SELECT 
          id,
          product_id,
          price,
          recorded_at,
          created_at,
          archived_at,
          tenant_id
        FROM price_history_archive
        ${whereClause}
        ORDER BY recorded_at DESC
        LIMIT $${paramIndex++}
        OFFSET $${paramIndex++}
      `;

            params.push(limit, offset);

            const results = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);

            logger.info('Price history archive queried', {
                filters,
                resultCount: results.length,
            });

            return results;
        } catch (error) {
            logger.error('Price history archive query failed', { error, filters });
            throw error;
        }
    }

    /**
     * Query archived audit logs
     * Provides read-only access to archived audit logs
     * 
     * @param filters - Query filters
     * @returns Array of archived audit log records
     */
    async queryAuditLogsArchive(
        filters: ArchiveQueryFilters
    ): Promise<any[]> {
        try {
            const conditions: string[] = [];
            const params: any[] = [];
            let paramIndex = 1;

            if (filters.tenantId) {
                conditions.push(`tenant_id = $${paramIndex++}`);
                params.push(filters.tenantId);
            }

            if (filters.startDate) {
                conditions.push(`created_at >= $${paramIndex++}`);
                params.push(filters.startDate);
            }

            if (filters.endDate) {
                conditions.push(`created_at <= $${paramIndex++}`);
                params.push(filters.endDate);
            }

            const whereClause = conditions.length > 0
                ? `WHERE ${conditions.join(' AND ')}`
                : '';

            const limit = filters.limit || 100;
            const offset = filters.offset || 0;

            const query = `
        SELECT 
          id,
          tenant_id,
          user_id,
          user_email,
          action,
          entity_id,
          details,
          ip_address,
          created_at,
          archived_at
        FROM audit_logs_archive
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++}
        OFFSET $${paramIndex++}
      `;

            params.push(limit, offset);

            const results = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);

            logger.info('Audit logs archive queried', {
                filters,
                resultCount: results.length,
            });

            return results;
        } catch (error) {
            logger.error('Audit logs archive query failed', { error, filters });
            throw error;
        }
    }

    /**
     * Get archive statistics
     * Returns metrics about archived data
     * 
     * @returns Archive statistics
     */
    async getArchiveStats(): Promise<ArchiveStats> {
        try {
            // Get price history archive stats
            const priceHistoryStats = await this.prisma.$queryRaw<any[]>`
        SELECT 
          COUNT(*) as count,
          MIN(recorded_at) as oldest_record,
          pg_total_relation_size('price_history_archive') as size_bytes
        FROM price_history_archive
      `;

            // Get audit logs archive stats
            const auditLogsStats = await this.prisma.$queryRaw<any[]>`
        SELECT 
          COUNT(*) as count,
          MIN(created_at) as oldest_record,
          pg_total_relation_size('audit_logs_archive') as size_bytes
        FROM audit_logs_archive
      `;

            const priceHistoryCount = Number(priceHistoryStats[0]?.count || 0);
            const auditLogsCount = Number(auditLogsStats[0]?.count || 0);
            const priceHistorySize = Number(priceHistoryStats[0]?.size_bytes || 0);
            const auditLogsSize = Number(auditLogsStats[0]?.size_bytes || 0);
            const oldestPriceRecord = priceHistoryStats[0]?.oldest_record || null;
            const oldestAuditRecord = auditLogsStats[0]?.oldest_record || null;

            // Get the oldest record overall
            let oldestRecord: Date | null = null;
            if (oldestPriceRecord && oldestAuditRecord) {
                oldestRecord = new Date(
                    Math.min(
                        new Date(oldestPriceRecord).getTime(),
                        new Date(oldestAuditRecord).getTime()
                    )
                );
            } else if (oldestPriceRecord) {
                oldestRecord = new Date(oldestPriceRecord);
            } else if (oldestAuditRecord) {
                oldestRecord = new Date(oldestAuditRecord);
            }

            const stats: ArchiveStats = {
                priceHistoryArchived: priceHistoryCount,
                auditLogsArchived: auditLogsCount,
                totalArchiveSizeBytes: priceHistorySize + auditLogsSize,
                oldestArchivedRecord: oldestRecord,
            };

            logger.info('Archive stats retrieved', stats);

            return stats;
        } catch (error) {
            logger.error('Failed to get archive stats', { error });
            throw error;
        }
    }

    /**
     * Check if current time is within maintenance window
     * Maintenance window: 2-4 AM UTC
     * 
     * @returns True if within maintenance window
     */
    isMaintenanceWindow(): boolean {
        const now = new Date();
        const hour = now.getUTCHours();
        return hour >= 2 && hour < 4;
    }

    /**
     * Run scheduled archival
     * Archives both price history and audit logs if within maintenance window
     * 
     * @returns Combined archive results
     */
    async runScheduledArchival(): Promise<{
        priceHistory: ArchiveResult;
        auditLogs: ArchiveResult;
    }> {
        if (!this.isMaintenanceWindow()) {
            logger.warn('Attempted archival outside maintenance window', {
                currentHour: new Date().getUTCHours(),
            });
            throw new Error('Archival can only run during maintenance window (2-4 AM UTC)');
        }

        logger.info('Starting scheduled archival');

        const priceHistoryResult = await this.archivePriceHistory();
        const auditLogsResult = await this.archiveAuditLogs();

        logger.info('Scheduled archival completed', {
            priceHistory: priceHistoryResult,
            auditLogs: auditLogsResult,
        });

        return {
            priceHistory: priceHistoryResult,
            auditLogs: auditLogsResult,
        };
    }
}
