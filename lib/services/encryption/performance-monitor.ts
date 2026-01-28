/**
 * Performance monitoring for encryption operations
 * Tracks latency, success/failure rates, and migration statistics
 * 
 * Requirements: 4.5, 7.4
 */

import { logger } from '@/lib/logger';

/**
 * Operation types for tracking
 */
export type OperationType = 'encrypt' | 'decrypt' | 'migration';

/**
 * Performance metrics for an operation
 */
interface OperationMetrics {
    count: number;
    totalLatency: number;
    minLatency: number;
    maxLatency: number;
    successCount: number;
    failureCount: number;
}

/**
 * Migration-specific metrics
 */
interface MigrationMetrics {
    totalAttempts: number;
    successfulMigrations: number;
    failedMigrations: number;
    skippedMigrations: number; // Already encrypted
}

/**
 * Performance monitor for encryption operations
 */
export class EncryptionPerformanceMonitor {
    private metrics: Map<OperationType, OperationMetrics> = new Map();
    private migrationMetrics: MigrationMetrics = {
        totalAttempts: 0,
        successfulMigrations: 0,
        failedMigrations: 0,
        skippedMigrations: 0,
    };

    constructor() {
        // Initialize metrics for each operation type
        this.metrics.set('encrypt', this.createEmptyMetrics());
        this.metrics.set('decrypt', this.createEmptyMetrics());
        this.metrics.set('migration', this.createEmptyMetrics());
    }

    /**
     * Create empty metrics object
     */
    private createEmptyMetrics(): OperationMetrics {
        return {
            count: 0,
            totalLatency: 0,
            minLatency: Infinity,
            maxLatency: 0,
            successCount: 0,
            failureCount: 0,
        };
    }

    /**
     * Record an operation with its latency and success status
     * @param operation - Type of operation
     * @param latency - Operation latency in milliseconds
     * @param success - Whether the operation succeeded
     */
    recordOperation(operation: OperationType, latency: number, success: boolean): void {
        const metrics = this.metrics.get(operation);

        if (!metrics) {
            logger.error('Unknown operation type', { operation });
            return;
        }

        metrics.count++;
        metrics.totalLatency += latency;
        metrics.minLatency = Math.min(metrics.minLatency, latency);
        metrics.maxLatency = Math.max(metrics.maxLatency, latency);

        if (success) {
            metrics.successCount++;
        } else {
            metrics.failureCount++;
        }

        // Log warning if operation is slow (> 10ms as per requirement 4.5)
        if (latency > 10) {
            logger.warn('Slow encryption operation detected', {
                operation,
                latency: `${latency.toFixed(2)}ms`,
                threshold: '10ms',
            });
        }
    }

    /**
     * Record a migration attempt
     * @param success - Whether the migration succeeded
     * @param skipped - Whether the migration was skipped (already encrypted)
     */
    recordMigration(success: boolean, skipped: boolean = false): void {
        this.migrationMetrics.totalAttempts++;

        if (skipped) {
            this.migrationMetrics.skippedMigrations++;
        } else if (success) {
            this.migrationMetrics.successfulMigrations++;
        } else {
            this.migrationMetrics.failedMigrations++;
        }
    }

    /**
     * Get metrics for a specific operation type
     * @param operation - Type of operation
     * @returns Operation metrics with calculated averages and rates
     */
    getMetrics(operation: OperationType): {
        count: number;
        avgLatency: number;
        minLatency: number;
        maxLatency: number;
        successRate: number;
        failureRate: number;
    } {
        const metrics = this.metrics.get(operation);

        if (!metrics || metrics.count === 0) {
            return {
                count: 0,
                avgLatency: 0,
                minLatency: 0,
                maxLatency: 0,
                successRate: 0,
                failureRate: 0,
            };
        }

        return {
            count: metrics.count,
            avgLatency: metrics.totalLatency / metrics.count,
            minLatency: metrics.minLatency === Infinity ? 0 : metrics.minLatency,
            maxLatency: metrics.maxLatency,
            successRate: metrics.successCount / metrics.count,
            failureRate: metrics.failureCount / metrics.count,
        };
    }

    /**
     * Get migration metrics
     * @returns Migration statistics
     */
    getMigrationMetrics(): {
        totalAttempts: number;
        successfulMigrations: number;
        failedMigrations: number;
        skippedMigrations: number;
        successRate: number;
        failureRate: number;
    } {
        const { totalAttempts, successfulMigrations, failedMigrations, skippedMigrations } = this.migrationMetrics;

        // Calculate rates excluding skipped migrations
        const actualAttempts = totalAttempts - skippedMigrations;
        const successRate = actualAttempts > 0 ? successfulMigrations / actualAttempts : 0;
        const failureRate = actualAttempts > 0 ? failedMigrations / actualAttempts : 0;

        return {
            totalAttempts,
            successfulMigrations,
            failedMigrations,
            skippedMigrations,
            successRate,
            failureRate,
        };
    }

    /**
     * Get all metrics for monitoring dashboard
     * @returns Complete metrics summary
     */
    getAllMetrics(): {
        encryption: ReturnType<EncryptionPerformanceMonitor['getMetrics']>;
        decryption: ReturnType<EncryptionPerformanceMonitor['getMetrics']>;
        migration: ReturnType<EncryptionPerformanceMonitor['getMigrationMetrics']>;
    } {
        return {
            encryption: this.getMetrics('encrypt'),
            decryption: this.getMetrics('decrypt'),
            migration: this.getMigrationMetrics(),
        };
    }

    /**
     * Reset all metrics
     * Useful for testing or periodic resets
     */
    reset(): void {
        this.metrics.set('encrypt', this.createEmptyMetrics());
        this.metrics.set('decrypt', this.createEmptyMetrics());
        this.metrics.set('migration', this.createEmptyMetrics());

        this.migrationMetrics = {
            totalAttempts: 0,
            successfulMigrations: 0,
            failedMigrations: 0,
            skippedMigrations: 0,
        };
    }

    /**
     * Log current metrics summary
     * Useful for debugging and monitoring
     */
    logMetricsSummary(): void {
        const allMetrics = this.getAllMetrics();

        logger.info('Encryption performance metrics', {
            encryption: {
                count: allMetrics.encryption.count,
                avgLatency: `${allMetrics.encryption.avgLatency.toFixed(2)}ms`,
                successRate: `${(allMetrics.encryption.successRate * 100).toFixed(1)}%`,
            },
            decryption: {
                count: allMetrics.decryption.count,
                avgLatency: `${allMetrics.decryption.avgLatency.toFixed(2)}ms`,
                successRate: `${(allMetrics.decryption.successRate * 100).toFixed(1)}%`,
            },
            migration: {
                totalAttempts: allMetrics.migration.totalAttempts,
                successful: allMetrics.migration.successfulMigrations,
                failed: allMetrics.migration.failedMigrations,
                skipped: allMetrics.migration.skippedMigrations,
                successRate: `${(allMetrics.migration.successRate * 100).toFixed(1)}%`,
            },
        });
    }
}

/**
 * Global performance monitor instance
 */
export const encryptionPerformanceMonitor = new EncryptionPerformanceMonitor();

/**
 * Log metrics summary every 5 minutes
 */
setInterval(() => {
    const allMetrics = encryptionPerformanceMonitor.getAllMetrics();

    // Only log if there's activity
    if (allMetrics.encryption.count > 0 || allMetrics.decryption.count > 0 || allMetrics.migration.totalAttempts > 0) {
        encryptionPerformanceMonitor.logMetricsSummary();
    }
}, 300000); // 5 minutes
