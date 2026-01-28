/**
 * Key Rotation Utility for re-encrypting tokens with a new encryption key
 * Supports batch processing, error handling, and comprehensive logging
 */

import { prisma } from '@/lib/prisma';
import { EncryptionService } from './encryption-service';
import { KeyManager } from './key-manager';
import { logger } from '@/lib/logger';
import { KeyNotFoundError } from './errors';

/**
 * Key rotation options
 */
export interface KeyRotationOptions {
    /** Preview changes without making updates */
    dryRun: boolean;
    /** Number of records to process at once */
    batchSize: number;
    /** Continue processing if individual rotations fail */
    continueOnError: boolean;
}

/**
 * Error details for failed key rotations
 */
export interface KeyRotationError {
    websiteId: string;
    tenantId: string;
    error: string;
    timestamp: Date;
}

/**
 * Result of key rotation operation
 */
export interface KeyRotationResult {
    /** Total number of websites checked */
    total: number;
    /** Number of tokens successfully rotated */
    rotated: number;
    /** Number of rotations that failed */
    failed: number;
    /** Number of tokens skipped (plaintext or other issues) */
    skipped: number;
    /** Detailed error information */
    errors: KeyRotationError[];
    /** Duration of rotation in milliseconds */
    durationMs: number;
}

/**
 * Utility for rotating encryption keys by re-encrypting all tokens
 */
export class KeyRotationUtility {
    private oldEncryptionService: EncryptionService;
    private newEncryptionService: EncryptionService;
    private keyManager: KeyManager;

    constructor() {
        this.keyManager = new KeyManager();

        // Create encryption service with old key (master)
        this.oldEncryptionService = new EncryptionService(this.keyManager);

        // Verify new key exists
        try {
            this.keyManager.getKey('new');
        } catch (error) {
            if (error instanceof KeyNotFoundError) {
                throw new KeyNotFoundError(
                    'ENCRYPTION_MASTER_KEY_NEW environment variable is not set. ' +
                    'Key rotation requires both old and new keys to be configured.'
                );
            }
            throw error;
        }

        // Create a custom key manager for the new key
        const newKeyManager = {
            getMasterKey: () => this.keyManager.getKey('new'),
            validateKey: () => this.keyManager.validateKey(),
            getKey: (keyId: string) => this.keyManager.getKey(keyId),
        };

        this.newEncryptionService = new EncryptionService(newKeyManager);
    }

    /**
     * Rotates all encrypted tokens to use the new encryption key
     * @param options - Rotation options (dry run, batch size, etc.)
     * @returns Rotation results with success/failure counts
     */
    async rotateAllTokens(options: KeyRotationOptions): Promise<KeyRotationResult> {
        const startTime = Date.now();

        logger.info('Starting key rotation', {
            dryRun: options.dryRun,
            batchSize: options.batchSize,
            continueOnError: options.continueOnError,
        });

        const result: KeyRotationResult = {
            total: 0,
            rotated: 0,
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
                        const rotated = await this.rotateToken(
                            website.id,
                            website.tenantId,
                            website.apiToken!,
                            options.dryRun
                        );

                        if (rotated) {
                            result.rotated++;
                        } else {
                            result.skipped++;
                        }
                    } catch (error) {
                        result.failed++;

                        const rotationError: KeyRotationError = {
                            websiteId: website.id,
                            tenantId: website.tenantId,
                            error: error instanceof Error ? error.message : 'Unknown error',
                            timestamp: new Date(),
                        };

                        result.errors.push(rotationError);

                        logger.error('Key rotation failed', {
                            websiteId: website.id,
                            tenantId: website.tenantId,
                            error: rotationError.error,
                        });

                        // Stop processing if continueOnError is false
                        if (!options.continueOnError) {
                            logger.error('Stopping key rotation due to error (continueOnError=false)');
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

            logger.info('Key rotation completed', {
                total: result.total,
                rotated: result.rotated,
                failed: result.failed,
                skipped: result.skipped,
                durationMs: result.durationMs,
                dryRun: options.dryRun,
            });

            return result;
        } catch (error) {
            result.durationMs = Date.now() - startTime;

            logger.error('Key rotation failed with critical error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                durationMs: result.durationMs,
            });

            throw error;
        }
    }

    /**
     * Rotates a single website's token to use the new key
     * @param websiteId - Website ID
     * @param tenantId - Tenant ID for audit logging
     * @param currentToken - Current encrypted token value
     * @param dryRun - If true, only check without updating
     * @returns true if rotation was performed, false if skipped
     */
    async rotateToken(
        websiteId: string,
        tenantId: string,
        currentToken: string,
        dryRun: boolean = false
    ): Promise<boolean> {
        // Skip plaintext tokens (should be migrated first)
        if (!this.oldEncryptionService.isEncrypted(currentToken)) {
            logger.debug('Token is plaintext, skipping rotation', { websiteId });
            return false;
        }

        logger.info('Rotating token to new key', { websiteId, dryRun });

        // If dry run, just report what would be done
        if (dryRun) {
            logger.info('DRY RUN: Would rotate token to new key', { websiteId });
            return true;
        }

        // Decrypt with old key
        const plaintext = this.oldEncryptionService.decrypt(currentToken);

        // Re-encrypt with new key
        const newEncryptedToken = this.newEncryptionService.encrypt(plaintext);

        // Update database with re-encrypted token in a transaction
        await prisma.$transaction(async (tx) => {
            await tx.site.update({
                where: { id: websiteId },
                data: { apiToken: newEncryptedToken },
            });

            // Log rotation event
            await tx.tenantAuditLog.create({
                data: {
                    tenantId,
                    userId: 'SYSTEM',
                    userEmail: 'system@pricepilot.ai',
                    action: 'KEY_ROTATED',
                    entityId: websiteId,
                    ipAddress: null,
                    details: JSON.stringify({
                        event: 'key_rotated',
                        success: true,
                        timestamp: new Date().toISOString(),
                    }),
                },
            });
        });

        logger.info('Key rotation successful', { websiteId });

        return true;
    }

    /**
     * Generates a human-readable rotation report
     * @param result - Rotation result to format
     * @returns Formatted report string
     */
    generateReport(result: KeyRotationResult): string {
        const lines: string[] = [];

        lines.push('='.repeat(60));
        lines.push('Encryption Key Rotation Report');
        lines.push('='.repeat(60));
        lines.push('');

        // Summary statistics
        lines.push('Summary:');
        lines.push(`  Total websites checked: ${result.total}`);
        lines.push(`  Successfully rotated:   ${result.rotated}`);
        lines.push(`  Skipped:                ${result.skipped}`);
        lines.push(`  Failed:                 ${result.failed}`);
        lines.push(`  Duration:               ${(result.durationMs / 1000).toFixed(2)}s`);
        lines.push('');

        // Success rate
        const successRate = result.total > 0
            ? ((result.rotated + result.skipped) / result.total * 100).toFixed(1)
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
     * @param result - Rotation result to format
     * @returns JSON string
     */
    generateJsonReport(result: KeyRotationResult): string {
        return JSON.stringify(result, null, 2);
    }
}
