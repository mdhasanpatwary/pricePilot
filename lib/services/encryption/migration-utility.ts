/**
 * Migration Utility for batch encryption of plaintext API tokens
 * Supports dry-run mode, configurable batch size, and error handling
 */

import { prisma } from '@/lib/prisma';
import { EncryptionService } from './encryption-service';
import { KeyManager } from './key-manager';
import { logger } from '@/lib/logger';

/**
 * Migration options for batch token encryption
 */
export interface MigrationOptions {
    /** Preview changes without making updates */
    dryRun: boolean;
    /** Number of records to process at once */
    batchSize: number;
    /** Continue processing if individual migrations fail */
    continueOnError: boolean;
}

/**
 * Error details for failed migrations
 */
export interface MigrationError {
    websiteId: string;
    tenantId: string;
    error: string;
    timestamp: Date;
}

/**
 * Result of migration operation
 */
export interface MigrationResult {
    /** Total number of websites checked */
    total: number;
    /** Number of tokens successfully migrated */
    migrated: number;
    /** Number of migrations that failed */
    failed: number;
    /** Number of tokens already encrypted (skipped) */
    skipped: number;
    /** Detailed error information */
    errors: MigrationError[];
    /** Duration of migration in milliseconds */
    durationMs: number;
}

/**
 * Utility for batch migration of plaintext tokens to encrypted format
 */
export class MigrationUtility {
    private encryptionService: EncryptionService;

    constructor() {
        const keyManager = new KeyManager();
        this.encryptionService = new EncryptionService(keyManager);
    }

    /**
     * Migrates all plaintext tokens to encrypted format
     * @param options - Migration options (dry run, batch size, etc.)
     * @returns Migration results with success/failure counts
     */
    async migrateAllTokens(options: MigrationOptions): Promise<MigrationResult> {
        const startTime = Date.now();

        logger.info('Starting token migration', {
            dryRun: options.dryRun,
            batchSize: options.batchSize,
            continueOnError: options.continueOnError,
        });

        const result: MigrationResult = {
            total: 0,
            migrated: 0,
            failed: 0,
            skipped: 0,
            errors: [],
            durationMs: 0,
        };

        try {
            // Fetch all websites with API tokens
            const websites = await prisma.site.findMany({
                where: {
                    apiToken: {
                        not: null,
                    },
                },
                select: {
                    id: true,
                    tenantId: true,
                    apiToken: true,
                },
            });

            result.total = websites.length;

            logger.info(`Found ${websites.length} websites with API tokens`);

            // Process in batches
            for (let i = 0; i < websites.length; i += options.batchSize) {
                const batch = websites.slice(i, i + options.batchSize);

                logger.info(`Processing batch ${Math.floor(i / options.batchSize) + 1}/${Math.ceil(websites.length / options.batchSize)}`);

                for (const website of batch) {
                    try {
                        const migrated = await this.migrateToken(
                            website.id,
                            website.tenantId,
                            website.apiToken!,
                            options.dryRun
                        );

                        if (migrated) {
                            result.migrated++;
                        } else {
                            result.skipped++;
                        }
                    } catch (error) {
                        result.failed++;

                        const migrationError: MigrationError = {
                            websiteId: website.id,
                            tenantId: website.tenantId,
                            error: error instanceof Error ? error.message : 'Unknown error',
                            timestamp: new Date(),
                        };

                        result.errors.push(migrationError);

                        logger.error('Token migration failed', {
                            websiteId: website.id,
                            tenantId: website.tenantId,
                            error: migrationError.error,
                        });

                        // Stop processing if continueOnError is false
                        if (!options.continueOnError) {
                            logger.error('Stopping migration due to error (continueOnError=false)');
                            break;
                        }
                    }
                }

                // Stop processing batches if we encountered an error and continueOnError is false
                if (result.failed > 0 && !options.continueOnError) {
                    break;
                }
            }

            result.durationMs = Date.now() - startTime;

            logger.info('Token migration completed', {
                total: result.total,
                migrated: result.migrated,
                failed: result.failed,
                skipped: result.skipped,
                durationMs: result.durationMs,
                dryRun: options.dryRun,
            });

            return result;
        } catch (error) {
            result.durationMs = Date.now() - startTime;

            logger.error('Token migration failed with critical error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                durationMs: result.durationMs,
            });

            throw error;
        }
    }

    /**
     * Migrates a single website's token
     * @param websiteId - Website ID
     * @param tenantId - Tenant ID for audit logging
     * @param currentToken - Current token value
     * @param dryRun - If true, only check without updating
     * @returns true if migration was performed, false if already encrypted
     */
    async migrateToken(
        websiteId: string,
        tenantId: string,
        currentToken: string,
        dryRun: boolean = false
    ): Promise<boolean> {
        // Check if token is already encrypted
        if (this.encryptionService.isEncrypted(currentToken)) {
            logger.debug('Token already encrypted, skipping', { websiteId });
            return false;
        }

        logger.info('Migrating plaintext token', { websiteId, dryRun });

        // If dry run, just report what would be done
        if (dryRun) {
            logger.info('DRY RUN: Would encrypt token', { websiteId });
            return true;
        }

        // Encrypt the plaintext token
        const encryptedToken = this.encryptionService.encrypt(currentToken);

        // Update database with encrypted token in a transaction
        await prisma.$transaction(async (tx) => {
            await tx.site.update({
                where: { id: websiteId },
                data: { apiToken: encryptedToken },
            });

            // Log migration event
            await tx.tenantAuditLog.create({
                data: {
                    tenantId,
                    userId: 'SYSTEM',
                    userEmail: 'system@pricepilot.ai',
                    action: 'TOKEN_MIGRATED',
                    entityId: websiteId,
                    ipAddress: null,
                    details: JSON.stringify({
                        event: 'token_migrated',
                        success: true,
                        timestamp: new Date().toISOString(),
                        migrationType: 'batch',
                    }),
                },
            });
        });

        logger.info('Token migration successful', { websiteId });

        return true;
    }

    /**
     * Generates a human-readable migration report
     * @param result - Migration result to format
     * @returns Formatted report string
     */
    generateReport(result: MigrationResult): string {
        const lines: string[] = [];

        lines.push('='.repeat(60));
        lines.push('API Token Migration Report');
        lines.push('='.repeat(60));
        lines.push('');

        // Summary statistics
        lines.push('Summary:');
        lines.push(`  Total websites checked: ${result.total}`);
        lines.push(`  Successfully migrated:  ${result.migrated}`);
        lines.push(`  Already encrypted:      ${result.skipped}`);
        lines.push(`  Failed:                 ${result.failed}`);
        lines.push(`  Duration:               ${(result.durationMs / 1000).toFixed(2)}s`);
        lines.push('');

        // Success rate
        const successRate = result.total > 0
            ? ((result.migrated + result.skipped) / result.total * 100).toFixed(1)
            : '0.0';
        lines.push(`Success Rate: ${successRate}%`);
        lines.push('');

        // Error details if any
        if (result.errors.length > 0) {
            lines.push('Errors:');
            lines.push('-'.repeat(60));

            result.errors.forEach((error, index) => {
                lines.push(`${index + 1}. Website ID: ${error.websiteId}`);
                lines.push(`   Tenant ID:   ${error.tenantId}`);
                lines.push(`   Error:       ${error.error}`);
                lines.push(`   Timestamp:   ${error.timestamp.toISOString()}`);
                lines.push('');
            });
        } else {
            lines.push('No errors encountered.');
            lines.push('');
        }

        lines.push('='.repeat(60));

        return lines.join('\n');
    }

    /**
     * Generates a JSON report for programmatic consumption
     * @param result - Migration result to format
     * @returns JSON string
     */
    generateJsonReport(result: MigrationResult): string {
        return JSON.stringify(result, null, 2);
    }
}
