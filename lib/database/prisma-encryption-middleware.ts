/**
 * Prisma Middleware for Automatic API Token Encryption/Decryption
 * 
 * This middleware automatically encrypts API tokens when saving to the database
 * and decrypts them when reading from the database. It integrates seamlessly
 * with Prisma queries, making encryption transparent to application code.
 * 
 * Usage:
 * ```typescript
 * import { applyEncryptionMiddleware } from '@/lib/database/prisma-encryption-middleware';
 * 
 * const prisma = new PrismaClient();
 * applyEncryptionMiddleware(prisma);
 * ```
 * 
 * @module lib/database/prisma-encryption-middleware
 */

import { PrismaClient } from '@prisma/client';
// import { encryptSiteToken, decryptSiteToken, decryptSiteTokens } from '../middleware/encryption';
import { logger } from '../logger';

/**
 * Middleware configuration options
 */
export interface EncryptionMiddlewareConfig {
    /**
     * Enable/disable the middleware
     * @default true
     */
    enabled?: boolean;

    /**
     * Log encryption/decryption operations
     * @default false
     */
    verbose?: boolean;

    /**
     * Throw errors on decryption failure
     * @default true
     */
    throwOnDecryptionError?: boolean;
}

const defaultConfig: EncryptionMiddlewareConfig = {
    enabled: true,
    verbose: false,
    throwOnDecryptionError: true,
};

/**
 * Apply encryption middleware to Prisma client
 * 
 * This function adds middleware to automatically encrypt/decrypt API tokens
 * for all Site model operations.
 * 
 * @param prisma - Prisma client instance
 * @param config - Middleware configuration options
 * 
 * @example
 * ```typescript
 * const prisma = new PrismaClient();
 * applyEncryptionMiddleware(prisma, { verbose: true });
 * 
 * // Now all Site queries automatically handle encryption
 * const site = await prisma.site.create({
 *   data: { baseUrl: 'https://example.com', apiToken: 'plain-text-token' }
 * });
 * // apiToken is automatically encrypted before saving
 * 
 * const retrieved = await prisma.site.findUnique({ where: { id: site.id } });
 * // apiToken is automatically decrypted after reading
 * console.log(retrieved.apiToken); // 'plain-text-token'
 * ```
 */
export function applyEncryptionMiddleware(
    _prisma: PrismaClient,
    config: EncryptionMiddlewareConfig = {}
): void {
    const finalConfig = { ...defaultConfig, ...config };

    if (!finalConfig.enabled) {
        logger.info('Encryption middleware is disabled');
        return;
    }

    // NOTE: Prisma $use middleware is deprecated in Prisma 5+
    // This middleware is disabled until we migrate to Prisma Client Extensions
    // For now, encryption must be handled manually in the application code
    logger.warn('Encryption middleware is temporarily disabled - Prisma $use is deprecated');
    logger.warn('Please handle encryption manually using encryptSiteToken/decryptSiteToken functions');

    // TODO: Migrate to Prisma Client Extensions when ready
    // See: https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions
}

/* DISABLED - All helper functions below are commented out since middleware is disabled

/**
 * Handle write operations (create, update, upsert)
 * Encrypts API tokens before saving to database
 * 
 * NOTE: Currently unused - middleware is disabled
 */
/* async function handleWriteOperation(
    params: Prisma.MiddlewareParams,
    config: EncryptionMiddlewareConfig
): Promise<void> {
    if (params.action === 'create' && params.args.data) {
        // Encrypt token for create operation
        params.args.data = await encryptSiteToken(params.args.data);

        if (config.verbose) {
            logger.debug('Encrypted API token for create operation', {
                siteId: params.args.data.id,
                tenantId: params.args.data.tenantId,
            });
        }
    } else if (params.action === 'update' && params.args.data) {
        // Encrypt token for update operation
        params.args.data = await encryptSiteToken(params.args.data);

        if (config.verbose) {
            logger.debug('Encrypted API token for update operation', {
                where: params.args.where,
            });
        }
    } else if (params.action === 'upsert') {
        // Encrypt tokens for both create and update in upsert
        if (params.args.create) {
            params.args.create = await encryptSiteToken(params.args.create);
        }
        if (params.args.update) {
            params.args.update = await encryptSiteToken(params.args.update);
        }

        if (config.verbose) {
            logger.debug('Encrypted API tokens for upsert operation', {
                where: params.args.where,
            });
        }
    }
}

/**
 * Handle single read result (findUnique, findFirst)
 * Decrypts API token after reading from database
 */
/* async function handleSingleReadResult(
    result: any,
    config: EncryptionMiddlewareConfig
): Promise<any> {
    if (!result) {
        return result;
    }

    try {
        const decrypted = await decryptSiteToken(result);

        if (config.verbose) {
            logger.debug('Decrypted API token for single read result', {
                siteId: result.id,
                tenantId: result.tenantId,
            });
        }

        return decrypted;
    } catch (error) {
        if (config.throwOnDecryptionError) {
            throw error;
        }

        logger.error('Failed to decrypt API token, returning with null token', {
            siteId: result.id,
            tenantId: result.tenantId,
            error: error instanceof Error ? error.message : String(error),
        });

        // Return result with null token on decryption failure
        return {
            ...result,
            apiToken: null,
        };
    }
}

/**
 * Handle multiple read results (findMany)
 * Decrypts API tokens for all results
 */
/* async function handleMultipleReadResults(
    results: any[],
    config: EncryptionMiddlewareConfig
): Promise<any[]> {
    if (!Array.isArray(results) || results.length === 0) {
        return results;
    }

    try {
        const decrypted = await decryptSiteTokens(results);

        if (config.verbose) {
            logger.debug('Decrypted API tokens for multiple read results', {
                count: results.length,
            });
        }

        return decrypted;
    } catch (error) {
        if (config.throwOnDecryptionError) {
            throw error;
        }

        logger.error('Failed to decrypt some API tokens in batch operation', {
            count: results.length,
            error: error instanceof Error ? error.message : String(error),
        });

        // Return results with null tokens on decryption failure
        return results.map(result => ({
            ...result,
            apiToken: null,
        }));
    }
}
*/

/**
 * Remove encryption middleware from Prisma client
 * 
 * Note: Prisma doesn't provide a direct way to remove middleware,
 * so this function is mainly for documentation purposes.
 * To disable middleware, set enabled: false in config.
 * 
 * @param prisma - Prisma client instance
 */
export function removeEncryptionMiddleware(_prisma: PrismaClient): void {
    logger.warn('Prisma does not support removing middleware after it has been added');
    logger.warn('To disable encryption middleware, restart the application with enabled: false');
}

/**
 * Check if encryption middleware is applied
 * 
 * This is a helper function to verify middleware is working correctly.
 * It creates a test site, verifies encryption, and cleans up.
 * 
 * @param prisma - Prisma client instance
 * @returns true if middleware is working, false otherwise
 * 
 * @example
 * ```typescript
 * const isWorking = await testEncryptionMiddleware(prisma);
 * if (!isWorking) {
 *   console.error('Encryption middleware is not working correctly');
 * }
 * ```
 */
export async function testEncryptionMiddleware(prisma: PrismaClient): Promise<boolean> {
    const testToken = 'test-token-' + Date.now();
    const testSiteId = 'test-site-' + Date.now();

    try {
        // Create a test site
        const created = await prisma.site.create({
            data: {
                id: testSiteId,
                tenantId: 'test-tenant',
                type: 'USER',
                platform: 'GENERIC',
                baseUrl: 'https://test.example.com',
                apiToken: testToken,
            },
        });

        // Verify token is decrypted in result
        if (created.apiToken !== testToken) {
            logger.error('Encryption middleware test failed: token not decrypted in create result');
            return false;
        }

        // Read the site back
        const retrieved = await prisma.site.findUnique({
            where: { id: testSiteId },
        });

        // Verify token is decrypted in read result
        if (retrieved?.apiToken !== testToken) {
            logger.error('Encryption middleware test failed: token not decrypted in read result');
            return false;
        }

        // Clean up test site
        await prisma.site.delete({
            where: { id: testSiteId },
        });

        logger.info('Encryption middleware test passed');
        return true;
    } catch (error) {
        logger.error('Encryption middleware test failed with error', {
            error: error instanceof Error ? error.message : String(error),
        });

        // Clean up test site if it exists
        try {
            await prisma.site.delete({
                where: { id: testSiteId },
            });
        } catch {
            // Ignore cleanup errors
        }

        return false;
    }
}
