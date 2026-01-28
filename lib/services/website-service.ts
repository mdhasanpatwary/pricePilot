/**
 * Website Service for managing user website integrations with encrypted API tokens
 */

import { prisma } from '@/lib/prisma';
import { Site, Prisma } from '@prisma/client';
import { EncryptionService } from './encryption/encryption-service';
import { KeyManager } from './encryption/key-manager';
import { EncryptionError, DecryptionError } from './encryption/errors';
import { tokenCache } from './encryption/token-cache';
import { encryptionPerformanceMonitor } from './encryption/performance-monitor';
import { TokenRecoveryService } from './encryption/token-recovery';

// Initialize encryption service with key manager
const keyManager = new KeyManager();
const encryptionService = new EncryptionService(keyManager);

/**
 * Input type for creating a website
 */
export interface CreateWebsiteInput {
    tenantId: string;
    platform: string;
    type: string;
    baseUrl: string;
    apiToken?: string | null;
    searchQueryPattern?: string | null;
}

/**
 * Input type for updating a website
 */
export interface UpdateWebsiteInput {
    platform?: string;
    baseUrl?: string;
    apiToken?: string | null;
    searchQueryPattern?: string | null;
}

/**
 * Website with decrypted token for API usage
 */
export interface SiteWithDecryptedToken extends Site {
    decryptedToken: string | null;
}

/**
 * Website Service for managing user website integrations
 */
export class WebsiteService {
    /**
     * Creates a new user website with encrypted API token
     * @param data - Website data including plaintext apiToken
     * @param userId - User ID for audit logging
     * @returns Created website record with encrypted token
     * @throws EncryptionError if encryption fails
     */
    static async createWebsite(
        data: CreateWebsiteInput,
        _userId?: string
    ): Promise<Site> {
        return await prisma.$transaction(async (tx) => {
            let encryptedToken: string | null = null;

            // Encrypt token if provided
            if (data.apiToken) {
                try {
                    encryptedToken = encryptionService.encrypt(data.apiToken);
                } catch (error) {
                    // Log encryption failure
                    console.error('[WebsiteService] Token encryption failed:', error);

                    // Re-throw encryption error to prevent saving plaintext token
                    throw new EncryptionError(
                        'Failed to encrypt API token. Please try again.',
                        error instanceof Error ? error : undefined
                    );
                }
            }

            // Create website record with encrypted token
            const site = await tx.site.create({
                data: {
                    tenantId: data.tenantId,
                    platform: data.platform as any,
                    type: data.type as any,
                    baseUrl: data.baseUrl,
                    apiToken: encryptedToken,
                    searchQueryPattern: data.searchQueryPattern,
                },
            });

            // Log successful encryption
            if (encryptedToken) {
                console.log(`[WebsiteService] Successfully encrypted token for site ${site.id}`);
            }

            return site;
        });
    }

    /**
     * Updates website data, re-encrypting token if changed
     * @param id - Website ID
     * @param data - Updated data
     * @param tenantId - Tenant ID for authorization
     * @param userId - User ID for audit logging
     * @returns Updated website record
     * @throws EncryptionError if encryption fails
     */
    static async updateWebsite(
        id: string,
        data: UpdateWebsiteInput,
        tenantId: string,
        userId?: string
    ): Promise<Site> {
        return await prisma.$transaction(async (tx) => {
            // Fetch existing site to verify ownership
            const existingSite = await tx.site.findFirst({
                where: {
                    id,
                    tenantId,
                },
            });

            if (!existingSite) {
                throw new Error('Site not found');
            }

            let encryptedToken: string | null | undefined = undefined;

            // Check if apiToken is being updated
            if (data.apiToken !== undefined) {
                if (data.apiToken === null) {
                    // Explicitly setting token to null
                    encryptedToken = null;
                } else {
                    // Encrypt new token value
                    try {
                        encryptedToken = encryptionService.encrypt(data.apiToken);
                    } catch (error) {
                        // Log encryption failure
                        console.error('[WebsiteService] Token re-encryption failed:', error);

                        // Re-throw encryption error
                        throw new EncryptionError(
                            'Failed to encrypt API token. Please try again.',
                            error instanceof Error ? error : undefined
                        );
                    }
                }
            }

            // Build update data
            const updateData: Prisma.SiteUpdateInput = {
                ...(data.platform && { platform: data.platform as any }),
                ...(data.baseUrl && { baseUrl: data.baseUrl }),
                ...(encryptedToken !== undefined && { apiToken: encryptedToken }),
                ...(data.searchQueryPattern !== undefined && { searchQueryPattern: data.searchQueryPattern }),
            };

            // Update website record
            const site = await tx.site.update({
                where: { id },
                data: updateData,
            });

            // Log successful re-encryption if token was updated
            if (encryptedToken !== undefined && encryptedToken !== null) {
                await tx.tenantAuditLog.create({
                    data: {
                        tenantId,
                        userId: userId || '',
                        userEmail: '',
                        action: 'TOKEN_ENCRYPTED',
                        entityId: site.id,
                        ipAddress: null,
                        details: JSON.stringify({
                            event: 'token_encrypted',
                            success: true,
                            timestamp: new Date(),
                        }),
                    },
                });

                console.log(`[WebsiteService] Successfully re-encrypted token for site ${site.id}`);
            }

            return site;
        });
    }

    /**
     * Retrieves website with decrypted token for API calls
     * Automatically migrates plaintext tokens to encrypted format
     * Uses request-scoped caching for performance
     * @param id - Website ID
     * @param tenantId - Tenant ID for authorization
     * @param purpose - Purpose of decryption for audit logging
     * @returns Website with plaintext token
     * @throws DecryptionError if decryption fails
     */
    static async getWebsiteWithToken(
        id: string,
        tenantId: string,
        purpose: string = 'api_call'
    ): Promise<SiteWithDecryptedToken> {
        // Check cache first
        const cachedToken = tokenCache.get(id);
        if (cachedToken) {
            // Fetch website record (without token decryption)
            const site = await prisma.site.findFirst({
                where: {
                    id,
                    tenantId,
                },
            });

            if (!site) {
                throw new Error('Site not found');
            }

            return {
                ...site,
                decryptedToken: cachedToken,
            };
        }

        // Fetch website record from database
        const site = await prisma.site.findFirst({
            where: {
                id,
                tenantId,
            },
        });

        if (!site) {
            throw new Error('Site not found');
        }

        // If no token, return as-is
        if (!site.apiToken) {
            return {
                ...site,
                decryptedToken: null,
            };
        }

        // Check if token is encrypted
        const isEncrypted = encryptionService.isEncrypted(site.apiToken);

        if (!isEncrypted) {
            // Plaintext token detected - migrate to encrypted format
            console.log(`[WebsiteService] Plaintext token detected for site ${site.id}, migrating...`);

            const migrationStartTime = performance.now();
            let migrationSuccess = false;

            try {
                const encryptedToken = encryptionService.encrypt(site.apiToken);

                // Update database with encrypted token
                await prisma.$transaction(async (tx) => {
                    await tx.site.update({
                        where: { id: site.id },
                        data: { apiToken: encryptedToken },
                    });

                    // Log migration event
                    await tx.tenantAuditLog.create({
                        data: {
                            tenantId,
                            userId: '',
                            userEmail: '',
                            action: 'TOKEN_MIGRATED',
                            entityId: site.id,
                            ipAddress: null,
                            details: JSON.stringify({
                                event: 'token_migrated',
                                success: true,
                                timestamp: new Date(),
                            }),
                        },
                    });
                });

                migrationSuccess = true;
                console.log(`[WebsiteService] Successfully migrated token for site ${site.id}`);

                // Cache the decrypted token (original plaintext)
                tokenCache.set(site.id, site.apiToken);

                // Return with decrypted token (original plaintext)
                return {
                    ...site,
                    apiToken: encryptedToken,
                    decryptedToken: site.apiToken, // Original plaintext
                };
            } catch (error) {
                // Log migration failure but continue with plaintext (backward compatibility)
                console.error('[WebsiteService] Token migration failed:', error);

                await prisma.tenantAuditLog.create({
                    data: {
                        tenantId,
                        userId: '',
                        userEmail: '',
                        action: 'TOKEN_MIGRATION_FAILED',
                        entityId: site.id,
                        ipAddress: null,
                        details: JSON.stringify({
                            event: 'token_migrated',
                            success: false,
                            errorMessage: error instanceof Error ? error.message : 'Unknown error',
                        }),
                    },
                });

                // Continue with plaintext token for backward compatibility
                return {
                    ...site,
                    decryptedToken: site.apiToken,
                };
            } finally {
                // Record migration metrics
                const migrationLatency = performance.now() - migrationStartTime;
                encryptionPerformanceMonitor.recordOperation('migration', migrationLatency, migrationSuccess);
                encryptionPerformanceMonitor.recordMigration(migrationSuccess, false);
            }
        }

        // Token is encrypted - decrypt it
        try {
            const decryptedToken = encryptionService.decrypt(site.apiToken);

            // Log decryption event
            await prisma.tenantAuditLog.create({
                data: {
                    tenantId,
                    userId: '',
                    userEmail: '',
                    action: 'TOKEN_DECRYPTED',
                    entityId: site.id,
                    ipAddress: null,
                    details: JSON.stringify({
                        event: 'token_decrypted',
                        purpose,
                        success: true,
                        timestamp: new Date(),
                    }),
                },
            });

            // Cache the decrypted token
            tokenCache.set(site.id, decryptedToken);

            return {
                ...site,
                decryptedToken,
            };
        } catch (error) {
            // Log decryption failure
            console.error('[WebsiteService] Token decryption failed:', error);

            await prisma.tenantAuditLog.create({
                data: {
                    tenantId,
                    userId: '',
                    userEmail: '',
                    action: 'DECRYPTION_FAILED',
                    entityId: site.id,
                    ipAddress: null,
                    details: JSON.stringify({
                        event: 'decryption_failed',
                        success: false,
                        errorMessage: error instanceof Error ? error.message : 'Unknown error',
                    }),
                },
            });

            // Check if this error should trigger token recovery
            if (error instanceof Error && TokenRecoveryService.shouldTriggerRecovery(error)) {
                console.log('[WebsiteService] Triggering token recovery flow...');

                // Execute recovery flow
                const recoveryResult = await TokenRecoveryService.handleCorruptedToken(
                    site.id,
                    tenantId,
                    error
                );

                if (recoveryResult.success) {
                    console.log('[WebsiteService] Token recovery completed successfully');
                } else {
                    console.error('[WebsiteService] Token recovery failed:', recoveryResult.error);
                }
            }

            // Re-throw decryption error with user-friendly message
            throw new DecryptionError(
                'Failed to decrypt API token. The token has been cleared for security. Please re-enter your token in settings.',
                error instanceof Error ? error : undefined
            );
        }
    }
}
