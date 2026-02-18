/**
 * Logging Service for Bot Protection Handling
 *
 * Provides structured logging with retention policies and query capabilities
 * for scraping attempts and bot protection detections.
 *
 * Requirements: 8.1, 8.2, 8.4, 8.7
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ScrapeFailureType } from '@prisma/client';

/**
 * Scrape attempt log entry
 */
export interface ScrapeAttemptLog {
    id?: string;
    tenantId: string;
    competitorProductId: string;
    competitorWebsiteId: string;
    url: string;
    strategy: string;
    proxyId?: string;
    userAgent: string;
    success: boolean;
    protectionDetected: boolean;
    protectionType?: string;
    failureType?: ScrapeFailureType;
    statusCode?: number;
    responseTimeMs?: number;
    responseSizeBytes?: number;
    responseSample?: string;
    screenshotUrl?: string;
    errorMessage?: string;
    attemptNumber: number;
    timestamp?: Date;
}

/**
 * Bot protection detection log entry
 */
export interface DetectionLog {
    id?: string;
    scrapeAttemptId: string;
    protectionType: string;
    confidence: number;
    indicators: string[];
    reasoning?: string;
    timestamp?: Date;
}

/**
 * Log query parameters
 */
export interface LogQuery {
    tenantId: string;
    competitorWebsiteId?: string;
    competitorProductId?: string;
    protectionType?: string;
    failureType?: ScrapeFailureType;
    strategy?: string;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
    protectionDetected?: boolean;
    limit?: number;
    offset?: number;
    orderBy?: 'createdAt' | 'responseTimeMs' | 'attemptNumber';
    orderDirection?: 'asc' | 'desc';
}

/**
 * Query result with pagination metadata
 */
export interface LogQueryResult {
    logs: ScrapeAttemptLog[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}

/**
 * Detection query parameters
 */
export interface DetectionQuery {
    tenantId?: string;
    competitorWebsiteId?: string;
    protectionType?: string;
    minConfidence?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}

/**
 * Logging Service
 *
 * Handles all logging operations for scraping attempts and bot protection detections.
 * Implements retention policies and provides query capabilities.
 */
export class LoggingService {
    private readonly MAX_RESPONSE_SAMPLE_SIZE = 1024; // 1KB
    private isMissingColumnError(error: unknown): boolean {
        const msg = error instanceof Error ? error.message : String(error);
        return msg.includes('does not exist in the current database') || msg.includes('The column `(not available)` does not exist');
    }

    private scrapeAttemptSelect(includeFailureType: boolean) {
        return {
            id: true,
            tenantId: true,
            competitorProductId: true,
            competitorWebsiteId: true,
            url: true,
            strategy: true,
            proxyId: true,
            userAgent: true,
            success: true,
            protectionDetected: true,
            protectionType: true,
            ...(includeFailureType ? { failureType: true } : {}),
            statusCode: true,
            responseTimeMs: true,
            responseSizeBytes: true,
            responseSample: true,
            screenshotUrl: true,
            errorMessage: true,
            attemptNumber: true,
            createdAt: true,
        } as const;
    }

    /**
     * Log a scrape attempt
     *
     * Stores complete log in database with response sample truncated to size limit.
     *
     * @param log - Scrape attempt log entry
     * @returns Created log entry with ID
     */
    async logScrapeAttempt(log: ScrapeAttemptLog): Promise<ScrapeAttemptLog> {
        // Truncate response sample if needed
        const truncatedSample = log.responseSample
            ? this.truncateResponseSample(log.responseSample)
            : undefined;

        const created = await prisma.scrapeAttempt.create({
            data: {
                tenantId: log.tenantId,
                competitorProductId: log.competitorProductId,
                competitorWebsiteId: log.competitorWebsiteId,
                url: log.url,
                strategy: log.strategy,
                proxyId: log.proxyId,
                userAgent: log.userAgent,
                success: log.success,
                protectionDetected: log.protectionDetected,
                protectionType: log.protectionType,
                failureType: log.failureType,
                statusCode: log.statusCode,
                responseTimeMs: log.responseTimeMs,
                responseSizeBytes: log.responseSizeBytes,
                responseSample: truncatedSample,
                screenshotUrl: log.screenshotUrl,
                errorMessage: log.errorMessage,
                attemptNumber: log.attemptNumber,
            },
        });

        return {
            ...log,
            id: created.id,
            responseSample: truncatedSample,
            timestamp: created.createdAt,
        };
    }

    /**
     * Log a bot protection detection
     *
     * Stores detection result with confidence score and reasoning.
     *
     * @param log - Detection log entry
     * @returns Created log entry with ID
     */
    async logDetection(log: DetectionLog): Promise<DetectionLog> {
        const created = await prisma.protectionDetection.create({
            data: {
                scrapeAttemptId: log.scrapeAttemptId,
                protectionType: log.protectionType,
                confidence: log.confidence,
                indicators: log.indicators,
                reasoning: log.reasoning,
            },
        });

        return {
            ...log,
            id: created.id,
            timestamp: created.createdAt,
        };
    }

    /**
     * Query scrape attempt logs with enhanced filtering and pagination
     *
     * Supports filtering by:
     * - Competitor site
     * - Competitor product
     * - Date range
     * - Protection type
     * - Strategy
     * - Success status
     * - Protection detection status
     *
     * Implements pagination with total count and hasMore indicator.
     *
     * @param query - Query parameters
     * @returns Query result with logs and pagination metadata
     */
    async queryLogs(query: LogQuery): Promise<LogQueryResult> {
        const where: Prisma.ScrapeAttemptWhereInput = {
            tenantId: query.tenantId,
        };

        // Apply filters
        if (query.competitorWebsiteId) {
            where.competitorWebsiteId = query.competitorWebsiteId;
        }

        if (query.competitorProductId) {
            where.competitorProductId = query.competitorProductId;
        }

        if (query.protectionType) {
            where.protectionType = query.protectionType;
        }

        if (query.failureType) {
            where.failureType = query.failureType;
        }

        if (query.strategy) {
            where.strategy = query.strategy;
        }

        if (query.success !== undefined) {
            where.success = query.success;
        }

        if (query.protectionDetected !== undefined) {
            where.protectionDetected = query.protectionDetected;
        }

        if (query.startDate || query.endDate) {
            where.createdAt = {};
            if (query.startDate) {
                where.createdAt.gte = query.startDate;
            }
            if (query.endDate) {
                where.createdAt.lte = query.endDate;
            }
        }

        // Get total count for pagination
        let total = 0;
        try {
            total = await prisma.scrapeAttempt.count({ where });
        } catch (error) {
            if (!this.isMissingColumnError(error)) throw error;

            // If the caller asked to filter by failureType but the DB isn't migrated yet,
            // fail explicitly rather than silently ignoring the filter.
            if (query.failureType) {
                throw new Error('SCHEMA_OUT_OF_DATE: ScrapeAttempt.failureType column is missing');
            }

            const { failureType: _ft, ...rest } = where as any;
            total = await prisma.scrapeAttempt.count({ where: rest as Prisma.ScrapeAttemptWhereInput });
        }

        // Determine order by
        const orderBy = query.orderBy || 'createdAt';
        const orderDirection = query.orderDirection || 'desc';

        // Query logs with pagination
        const limit = query.limit || 100;
        const offset = query.offset || 0;

        let logs: any[] = [];
        try {
            logs = await prisma.scrapeAttempt.findMany({
                where,
                select: this.scrapeAttemptSelect(true),
                orderBy: {
                    [orderBy]: orderDirection,
                },
                take: limit,
                skip: offset,
            });
        } catch (error) {
            if (!this.isMissingColumnError(error)) throw error;

            if (query.failureType) {
                throw new Error('SCHEMA_OUT_OF_DATE: ScrapeAttempt.failureType column is missing');
            }

            // DB schema not migrated yet (failureType column missing): retry selecting only legacy columns.
            logs = await prisma.scrapeAttempt.findMany({
                where: (() => {
                    // If caller passed failureType but column doesn't exist, avoid Prisma referencing it.
                    const { failureType: _ft, ...rest } = where as any;
                    return rest as Prisma.ScrapeAttemptWhereInput;
                })(),
                select: this.scrapeAttemptSelect(false),
                orderBy: {
                    [orderBy]: orderDirection,
                },
                take: limit,
                skip: offset,
            });
        }

        const mappedLogs = logs.map((log) => ({
            id: log.id,
            tenantId: log.tenantId,
            competitorProductId: log.competitorProductId,
            competitorWebsiteId: log.competitorWebsiteId,
            url: log.url,
            strategy: log.strategy,
            proxyId: log.proxyId || undefined,
            userAgent: log.userAgent,
            success: log.success,
            protectionDetected: log.protectionDetected,
            protectionType: log.protectionType || undefined,
            failureType: log.failureType || undefined,
            statusCode: log.statusCode || undefined,
            responseTimeMs: log.responseTimeMs || undefined,
            responseSizeBytes: log.responseSizeBytes || undefined,
            responseSample: log.responseSample || undefined,
            screenshotUrl: log.screenshotUrl || undefined,
            errorMessage: log.errorMessage || undefined,
            attemptNumber: log.attemptNumber,
            timestamp: log.createdAt,
        }));

        return {
            logs: mappedLogs,
            total,
            limit,
            offset,
            hasMore: offset + logs.length < total,
        };
    }

    /**
     * Query detection logs
     *
     * Supports filtering by protection type, confidence, and date range.
     *
     * @param query - Detection query parameters
     * @returns Array of detection logs
     */
    async queryDetections(query: DetectionQuery): Promise<DetectionLog[]> {
        const where: Prisma.ProtectionDetectionWhereInput = {};

        // Apply filters
        if (query.protectionType) {
            where.protectionType = query.protectionType;
        }

        if (query.minConfidence !== undefined) {
            where.confidence = {
                gte: query.minConfidence,
            };
        }

        if (query.startDate || query.endDate) {
            where.createdAt = {};
            if (query.startDate) {
                where.createdAt.gte = query.startDate;
            }
            if (query.endDate) {
                where.createdAt.lte = query.endDate;
            }
        }

        // Filter by tenant or website if provided
        if (query.tenantId || query.competitorWebsiteId) {
            where.ScrapeAttempt = {};
            if (query.tenantId) {
                (where.ScrapeAttempt as any).tenantId = query.tenantId;
            }
            if (query.competitorWebsiteId) {
                (where.ScrapeAttempt as any).competitorWebsiteId = query.competitorWebsiteId;
            }
        }

        const detections = await prisma.protectionDetection.findMany({
            where,
            orderBy: {
                createdAt: 'desc',
            },
            take: query.limit || 100,
            skip: query.offset || 0,
        });

        return detections.map((detection) => ({
            id: detection.id,
            scrapeAttemptId: detection.scrapeAttemptId,
            protectionType: detection.protectionType,
            confidence: detection.confidence.toNumber(),
            indicators: detection.indicators as string[],
            reasoning: detection.reasoning || undefined,
            timestamp: detection.createdAt,
        }));
    }

    /**
     * Clean up old logs based on retention policy
     *
     * Retention policy:
     * - Successful attempts: 7 days
     * - Failed attempts: 30 days
     * - Detection logs: 90 days (handled via cascade delete)
     * - Screenshots: 7 days (URL cleanup only, actual file deletion handled separately)
     *
     * @returns Number of logs deleted
     */
    async cleanupOldLogs(): Promise<{ scrapeAttempts: number; detections: number }> {
        const now = new Date();

        // Calculate cutoff dates
        const successfulCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days
        const failedCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
        const detectionCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days

        // Delete old successful attempts
        const deletedSuccessful = await prisma.scrapeAttempt.deleteMany({
            where: {
                success: true,
                createdAt: {
                    lt: successfulCutoff,
                },
            },
        });

        // Delete old failed attempts
        const deletedFailed = await prisma.scrapeAttempt.deleteMany({
            where: {
                success: false,
                createdAt: {
                    lt: failedCutoff,
                },
            },
        });

        // Delete old detection logs (orphaned ones, as cascade should handle most)
        const deletedDetections = await prisma.protectionDetection.deleteMany({
            where: {
                createdAt: {
                    lt: detectionCutoff,
                },
            },
        });

        const totalScrapeAttempts = deletedSuccessful.count + deletedFailed.count;

        return {
            scrapeAttempts: totalScrapeAttempts,
            detections: deletedDetections.count,
        };
    }

    /**
     * Truncate response sample to maximum size
     *
     * @param sample - Response sample to truncate
     * @returns Truncated sample with indicator if truncated
     */
    private truncateResponseSample(sample: string): string {
        if (sample.length <= this.MAX_RESPONSE_SAMPLE_SIZE) {
            return sample;
        }

        return sample.substring(0, this.MAX_RESPONSE_SAMPLE_SIZE) + '... [truncated]';
    }

    /**
     * Get scrape attempt by ID
     *
     * @param id - Scrape attempt ID
     * @returns Scrape attempt log or null if not found
     */
    async getScrapeAttemptById(id: string): Promise<ScrapeAttemptLog | null> {
        let log: any | null = null;
        try {
            log = await prisma.scrapeAttempt.findUnique({
                where: { id },
                select: this.scrapeAttemptSelect(true),
            });
        } catch (error) {
            if (!this.isMissingColumnError(error)) throw error;
            log = await prisma.scrapeAttempt.findUnique({
                where: { id },
                select: this.scrapeAttemptSelect(false),
            });
        }

        if (!log) {
            return null;
        }

        return {
            id: log.id,
            tenantId: log.tenantId,
            competitorProductId: log.competitorProductId,
            competitorWebsiteId: log.competitorWebsiteId,
            url: log.url,
            strategy: log.strategy,
            proxyId: log.proxyId || undefined,
            userAgent: log.userAgent,
            success: log.success,
            protectionDetected: log.protectionDetected,
            protectionType: log.protectionType || undefined,
            failureType: log.failureType || undefined,
            statusCode: log.statusCode || undefined,
            responseTimeMs: log.responseTimeMs || undefined,
            responseSizeBytes: log.responseSizeBytes || undefined,
            responseSample: log.responseSample || undefined,
            screenshotUrl: log.screenshotUrl || undefined,
            errorMessage: log.errorMessage || undefined,
            attemptNumber: log.attemptNumber,
            timestamp: log.createdAt,
        };
    }

    /**
     * Get detection logs for a scrape attempt
     *
     * @param scrapeAttemptId - Scrape attempt ID
     * @returns Array of detection logs
     */
    async getDetectionsByScrapeAttempt(scrapeAttemptId: string): Promise<DetectionLog[]> {
        const detections = await prisma.protectionDetection.findMany({
            where: {
                scrapeAttemptId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return detections.map((detection) => ({
            id: detection.id,
            scrapeAttemptId: detection.scrapeAttemptId,
            protectionType: detection.protectionType,
            confidence: detection.confidence.toNumber(),
            indicators: detection.indicators as string[],
            reasoning: detection.reasoning || undefined,
            timestamp: detection.createdAt,
        }));
    }

    /**
     * Get recent scrape attempts for a competitor website
     *
     * @param competitorWebsiteId - Competitor website ID
     * @param limit - Maximum number of logs to return
     * @returns Array of recent scrape attempt logs
     */
    async getRecentAttemptsByWebsite(
        competitorWebsiteId: string,
        limit: number = 50
    ): Promise<ScrapeAttemptLog[]> {
        let logs: any[] = [];
        try {
            logs = await prisma.scrapeAttempt.findMany({
                where: {
                    competitorWebsiteId,
                },
                select: this.scrapeAttemptSelect(true),
                orderBy: {
                    createdAt: 'desc',
                },
                take: limit,
            });
        } catch (error) {
            if (!this.isMissingColumnError(error)) throw error;
            logs = await prisma.scrapeAttempt.findMany({
                where: {
                    competitorWebsiteId,
                },
                select: this.scrapeAttemptSelect(false),
                orderBy: {
                    createdAt: 'desc',
                },
                take: limit,
            });
        }

        return logs.map((log) => ({
            id: log.id,
            tenantId: log.tenantId,
            competitorProductId: log.competitorProductId,
            competitorWebsiteId: log.competitorWebsiteId,
            url: log.url,
            strategy: log.strategy,
            proxyId: log.proxyId || undefined,
            userAgent: log.userAgent,
            success: log.success,
            protectionDetected: log.protectionDetected,
            protectionType: log.protectionType || undefined,
            failureType: log.failureType || undefined,
            statusCode: log.statusCode || undefined,
            responseTimeMs: log.responseTimeMs || undefined,
            responseSizeBytes: log.responseSizeBytes || undefined,
            responseSample: log.responseSample || undefined,
            screenshotUrl: log.screenshotUrl || undefined,
            errorMessage: log.errorMessage || undefined,
            attemptNumber: log.attemptNumber,
            timestamp: log.createdAt,
        }));
    }

    /**
     * Get protection type statistics for a competitor website
     *
     * @param competitorWebsiteId - Competitor website ID
     * @param startDate - Start date for statistics
     * @param endDate - End date for statistics
     * @returns Protection type breakdown
     */
    async getProtectionTypeStats(
        competitorWebsiteId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<Record<string, number>> {
        const where: Prisma.ScrapeAttemptWhereInput = {
            competitorWebsiteId,
            protectionDetected: true,
        };

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = startDate;
            }
            if (endDate) {
                where.createdAt.lte = endDate;
            }
        }

        const attempts = await prisma.scrapeAttempt.findMany({
            where,
            select: {
                protectionType: true,
            },
        });

        const stats: Record<string, number> = {};
        for (const attempt of attempts) {
            if (attempt.protectionType) {
                stats[attempt.protectionType] = (stats[attempt.protectionType] || 0) + 1;
            }
        }

        return stats;
    }
}
