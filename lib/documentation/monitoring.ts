/**
 * Documentation System Monitoring and Logging
 * 
 * Provides comprehensive logging and monitoring for the documentation system.
 * Tracks modifications, suggestions, access control, and error rates.
 */

import { prisma } from '@/lib/prisma';
import { DocumentationType } from '@prisma/client';

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG',
}

export enum LogCategory {
    DOCUMENT_MODIFICATION = 'DOCUMENT_MODIFICATION',
    SUGGESTION_GENERATION = 'SUGGESTION_GENERATION',
    ACCESS_CONTROL = 'ACCESS_CONTROL',
    SEARCH = 'SEARCH',
    ANALYTICS = 'ANALYTICS',
    CACHE = 'CACHE',
    MIGRATION = 'MIGRATION',
    ERROR = 'ERROR',
}

export interface LogEntry {
    level: LogLevel;
    category: LogCategory;
    message: string;
    metadata?: Record<string, any>;
    userId?: string;
    documentId?: string;
    timestamp: Date;
    errorStack?: string;
}

export interface ErrorMetrics {
    category: LogCategory;
    errorCount: number;
    lastError: Date;
    errorRate: number; // errors per hour
}

export class DocumentationMonitor {
    private errorCounts: Map<LogCategory, number> = new Map();
    private lastErrorTime: Map<LogCategory, Date> = new Map();
    private readonly ERROR_RATE_THRESHOLD = 10; // errors per hour
    private readonly ERROR_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

    /**
     * Log a documentation modification
     */
    async logDocumentModification(
        documentId: string,
        action: 'CREATE' | 'UPDATE' | 'DELETE' | 'REVERT',
        userId: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        await this.log({
            level: LogLevel.INFO,
            category: LogCategory.DOCUMENT_MODIFICATION,
            message: `Document ${action.toLowerCase()}: ${documentId}`,
            metadata: {
                action,
                ...metadata,
            },
            userId,
            documentId,
            timestamp: new Date(),
        });
    }

    /**
     * Log a suggestion generation
     */
    async logSuggestionGeneration(
        suggestionId: string,
        documentId: string | null,
        targetType: DocumentationType,
        taskId?: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        await this.log({
            level: LogLevel.INFO,
            category: LogCategory.SUGGESTION_GENERATION,
            message: `Suggestion generated: ${suggestionId}`,
            metadata: {
                suggestionId,
                documentId,
                targetType,
                taskId,
                ...metadata,
            },
            documentId: documentId || undefined,
            timestamp: new Date(),
        });
    }

    /**
     * Log an access control denial
     */
    async logAccessDenial(
        userId: string | null,
        resource: string,
        reason: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        await this.log({
            level: LogLevel.WARN,
            category: LogCategory.ACCESS_CONTROL,
            message: `Access denied: ${resource}`,
            metadata: {
                resource,
                reason,
                ...metadata,
            },
            userId: userId || undefined,
            timestamp: new Date(),
        });
    }

    /**
     * Log a search operation
     */
    async logSearch(
        query: string,
        type: DocumentationType,
        resultsCount: number,
        responseTimeMs: number,
        userId?: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        await this.log({
            level: LogLevel.INFO,
            category: LogCategory.SEARCH,
            message: `Search executed: "${query}"`,
            metadata: {
                query,
                type,
                resultsCount,
                responseTimeMs,
                ...metadata,
            },
            userId,
            timestamp: new Date(),
        });

        // Alert if search is slow
        if (responseTimeMs > 200) {
            await this.log({
                level: LogLevel.WARN,
                category: LogCategory.SEARCH,
                message: `Slow search detected: ${responseTimeMs}ms`,
                metadata: {
                    query,
                    type,
                    responseTimeMs,
                    threshold: 200,
                },
                timestamp: new Date(),
            });
        }
    }

    /**
     * Log an error
     */
    async logError(
        category: LogCategory,
        error: Error,
        metadata?: Record<string, any>
    ): Promise<void> {
        // Track error counts
        const currentCount = this.errorCounts.get(category) || 0;
        this.errorCounts.set(category, currentCount + 1);
        this.lastErrorTime.set(category, new Date());

        await this.log({
            level: LogLevel.ERROR,
            category,
            message: error.message,
            metadata,
            timestamp: new Date(),
            errorStack: error.stack,
        });

        // Check if error rate exceeds threshold
        await this.checkErrorRate(category);
    }

    /**
     * Log cache operations
     */
    async logCacheOperation(
        operation: 'HIT' | 'MISS' | 'SET' | 'INVALIDATE' | 'CLEAR',
        key?: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        await this.log({
            level: LogLevel.DEBUG,
            category: LogCategory.CACHE,
            message: `Cache ${operation.toLowerCase()}: ${key || 'all'}`,
            metadata: {
                operation,
                key,
                ...metadata,
            },
            timestamp: new Date(),
        });
    }

    /**
     * Log migration operations
     */
    async logMigration(
        operation: string,
        status: 'START' | 'PROGRESS' | 'COMPLETE' | 'ERROR',
        metadata?: Record<string, any>
    ): Promise<void> {
        const level = status === 'ERROR' ? LogLevel.ERROR : LogLevel.INFO;

        await this.log({
            level,
            category: LogCategory.MIGRATION,
            message: `Migration ${operation}: ${status}`,
            metadata: {
                operation,
                status,
                ...metadata,
            },
            timestamp: new Date(),
        });
    }

    /**
     * Internal logging method
     */
    private async log(entry: LogEntry): Promise<void> {
        // Log to console
        const logMessage = this.formatLogMessage(entry);

        switch (entry.level) {
            case LogLevel.ERROR:
                console.error(logMessage);
                break;
            case LogLevel.WARN:
                console.warn(logMessage);
                break;
            case LogLevel.DEBUG:
                console.debug(logMessage);
                break;
            default:
                console.log(logMessage);
        }

        // Store in database for analysis (async, don't block)
        this.storeLog(entry).catch(err =>
            console.error('Failed to store log:', err)
        );
    }

    /**
     * Store log entry in database
     */
    private async storeLog(entry: LogEntry): Promise<void> {
        try {
            await prisma.$executeRaw`
        INSERT INTO "DocumentationLog" (
          level, category, message, metadata, "userId", "documentId", 
          "errorStack", "createdAt"
        ) VALUES (
          ${entry.level}, ${entry.category}, ${entry.message}, 
          ${JSON.stringify(entry.metadata || {})}, ${entry.userId || null}, 
          ${entry.documentId || null}, ${entry.errorStack || null}, 
          ${entry.timestamp}
        )
      `;
        } catch (error) {
            // Don't throw - logging should never break the application
            console.error('Failed to store log in database:', error);
        }
    }

    /**
     * Format log message for console output
     */
    private formatLogMessage(entry: LogEntry): string {
        const timestamp = entry.timestamp.toISOString();
        const level = entry.level.padEnd(5);
        const category = entry.category.padEnd(25);
        const metadata = entry.metadata ? JSON.stringify(entry.metadata) : '';

        return `[${timestamp}] ${level} [${category}] ${entry.message} ${metadata}`;
    }

    /**
     * Check error rate and alert if threshold exceeded
     */
    private async checkErrorRate(category: LogCategory): Promise<void> {
        const errorCount = this.errorCounts.get(category) || 0;
        const lastError = this.lastErrorTime.get(category);

        if (!lastError) return;

        const now = new Date();
        const timeDiff = now.getTime() - lastError.getTime();

        // Calculate error rate (errors per hour)
        const errorRate = (errorCount / timeDiff) * this.ERROR_RATE_WINDOW_MS;

        if (errorRate > this.ERROR_RATE_THRESHOLD) {
            await this.log({
                level: LogLevel.ERROR,
                category: LogCategory.ERROR,
                message: `High error rate detected in ${category}`,
                metadata: {
                    category,
                    errorCount,
                    errorRate: errorRate.toFixed(2),
                    threshold: this.ERROR_RATE_THRESHOLD,
                    timeWindowHours: this.ERROR_RATE_WINDOW_MS / (60 * 60 * 1000),
                },
                timestamp: now,
            });

            // Reset counter after alert
            this.errorCounts.set(category, 0);
        }
    }

    /**
     * Get error metrics for a category
     */
    async getErrorMetrics(
        category: LogCategory,
        timeWindowHours: number = 24
    ): Promise<ErrorMetrics> {
        const since = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

        const result = await prisma.$queryRaw<Array<{
            count: bigint;
            lastError: Date;
        }>>`
      SELECT 
        COUNT(*) as count,
        MAX("createdAt") as "lastError"
      FROM "DocumentationLog"
      WHERE 
        category = ${category}
        AND level = ${LogLevel.ERROR}
        AND "createdAt" >= ${since}
    `;

        const errorCount = Number(result[0]?.count || 0);
        const lastError = result[0]?.lastError || new Date();
        const errorRate = errorCount / timeWindowHours;

        return {
            category,
            errorCount,
            lastError,
            errorRate,
        };
    }

    /**
     * Get all error metrics
     */
    async getAllErrorMetrics(timeWindowHours: number = 24): Promise<ErrorMetrics[]> {
        const categories = Object.values(LogCategory);
        const metrics = await Promise.all(
            categories.map(category => this.getErrorMetrics(category, timeWindowHours))
        );

        return metrics.filter(m => m.errorCount > 0);
    }

    /**
     * Get recent logs
     */
    async getRecentLogs(
        limit: number = 100,
        category?: LogCategory,
        level?: LogLevel
    ): Promise<LogEntry[]> {
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (category) {
            conditions.push(`category = $${paramIndex}`);
            params.push(category);
            paramIndex++;
        }

        if (level) {
            conditions.push(`level = $${paramIndex}`);
            params.push(level);
            paramIndex++;
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        const logs = await prisma.$queryRawUnsafe<Array<{
            level: LogLevel;
            category: LogCategory;
            message: string;
            metadata: any;
            userId: string | null;
            documentId: string | null;
            errorStack: string | null;
            createdAt: Date;
        }>>(
            `
      SELECT 
        level, category, message, metadata, "userId", "documentId", 
        "errorStack", "createdAt"
      FROM "DocumentationLog"
      ${whereClause}
      ORDER BY "createdAt" DESC
      LIMIT $${paramIndex}
      `,
            ...params,
            limit
        );

        return logs.map(log => ({
            level: log.level,
            category: log.category,
            message: log.message,
            metadata: log.metadata,
            userId: log.userId || undefined,
            documentId: log.documentId || undefined,
            errorStack: log.errorStack || undefined,
            timestamp: log.createdAt,
        }));
    }

    /**
     * Clear old logs (data retention)
     */
    async clearOldLogs(daysToKeep: number = 90): Promise<number> {
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

        const result = await prisma.$executeRaw`
      DELETE FROM "DocumentationLog"
      WHERE "createdAt" < ${cutoffDate}
    `;

        return result;
    }
}

// Export singleton instance
export const documentationMonitor = new DocumentationMonitor();
