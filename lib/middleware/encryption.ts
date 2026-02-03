/**
 * Encryption Middleware for API Token Encryption/Decryption
 * 
 * This middleware provides transparent encryption/decryption of API tokens
 * when saving to or reading from the database. It uses the EncryptionService
 * to ensure all API tokens are encrypted at rest.
 * 
 * Usage:
 * - Call encryptSiteToken() before saving Site data to database
 * - Call decryptSiteToken() after reading Site data from database
 * 
 * @module lib/middleware/encryption
 */

import { Site } from '@prisma/client';
import { EncryptionService } from '../services/encryption/encryption-service';
import { KeyManager } from '../services/encryption/key-manager';
import {
    DecryptionError,
    AuthenticationError,
    InvalidFormatError,
    getUserFriendlyErrorMessage,
    sanitizeErrorMessage,
} from '../services/encryption/errors';
import { logger } from '../logger';

// Initialize encryption service with key manager
const keyManager = new KeyManager();
const encryptionService = new EncryptionService(keyManager);

/**
 * Site data type for encryption operations
 * Supports both full Site objects and partial updates
 */
type SiteData = Partial<Site> & {
    apiToken?: string | null;
};

/**
 * Encrypts the API token in Site data before saving to database
 * 
 * This function should be called before any database write operation
 * that includes an API token. It will:
 * 1. Check if apiToken exists and is not already encrypted
 * 2. Encrypt the token using AES-256-GCM
 * 3. Return the site data with encrypted token
 * 
 * @param siteData - Site data object that may contain an API token
 * @returns Site data with encrypted API token
 * @throws EncryptionError if encryption fails
 * 
 * @example
 * ```typescript
 * const siteData = {
 *   baseUrl: 'https://example.com',
 *   apiToken: 'plain-text-token-123'
 * };
 * 
 * const encrypted = await encryptSiteToken(siteData);
 * await prisma.site.create({ data: encrypted });
 * ```
 */
export async function encryptSiteToken<T extends SiteData>(
    siteData: T
): Promise<T> {
    try {
        // If no apiToken or it's null, return as-is
        if (!siteData.apiToken) {
            return siteData;
        }

        // Check if token is already encrypted
        if (encryptionService.isEncrypted(siteData.apiToken)) {
            logger.debug('API token is already encrypted, skipping encryption', {
                siteId: siteData.id,
                tenantId: siteData.tenantId,
            });
            return siteData;
        }

        // Encrypt the API token
        const encryptedToken = encryptionService.encrypt(siteData.apiToken);

        logger.info('API token encrypted successfully', {
            siteId: siteData.id,
            tenantId: siteData.tenantId,
            operation: 'encrypt',
        });

        // Return site data with encrypted token
        return {
            ...siteData,
            apiToken: encryptedToken,
        };
    } catch (error) {
        // Log the error with sanitized message (no sensitive data)
        const sanitizedMessage = error instanceof Error
            ? sanitizeErrorMessage(error)
            : 'Unknown encryption error';

        logger.error('Failed to encrypt API token', {
            error: sanitizedMessage,
            siteId: siteData.id,
            tenantId: siteData.tenantId,
            operation: 'encrypt',
        });

        // Re-throw the error for caller to handle
        throw error;
    }
}

/**
 * Decrypts the API token in Site data after reading from database
 * 
 * This function should be called after any database read operation
 * that retrieves a Site with an API token. It will:
 * 1. Check if apiToken exists and is encrypted
 * 2. Decrypt the token using AES-256-GCM
 * 3. Return the site data with decrypted token
 * 
 * @param site - Site object from database with encrypted API token
 * @returns Site object with decrypted API token
 * @throws DecryptionError if decryption fails
 * @throws AuthenticationError if token integrity check fails (tampering detected)
 * @throws InvalidFormatError if token format is invalid
 * 
 * @example
 * ```typescript
 * const site = await prisma.site.findUnique({ where: { id: siteId } });
 * const decrypted = await decryptSiteToken(site);
 * 
 * // Now use the decrypted token for API calls
 * const response = await fetch(decrypted.baseUrl, {
 *   headers: { 'Authorization': `Bearer ${decrypted.apiToken}` }
 * });
 * ```
 */
export async function decryptSiteToken<T extends SiteData>(
    site: T
): Promise<T> {
    try {
        // If no apiToken or it's null, return as-is
        if (!site.apiToken) {
            return site;
        }

        // Check if token is already decrypted (not encrypted format)
        if (!encryptionService.isEncrypted(site.apiToken)) {
            logger.warn('API token is not in encrypted format, returning as-is', {
                siteId: site.id,
                tenantId: site.tenantId,
                operation: 'decrypt',
            });
            return site;
        }

        // Decrypt the API token
        const decryptedToken = encryptionService.decrypt(site.apiToken);

        logger.info('API token decrypted successfully', {
            siteId: site.id,
            tenantId: site.tenantId,
            operation: 'decrypt',
        });

        // Return site with decrypted token
        return {
            ...site,
            apiToken: decryptedToken,
        };
    } catch (error) {
        // Handle specific error types
        if (error instanceof AuthenticationError) {
            // This is a critical security event - token may have been tampered with
            logger.error('API token authentication failed - possible tampering detected', {
                siteId: site.id,
                tenantId: site.tenantId,
                operation: 'decrypt',
                errorType: 'AuthenticationError',
            });

            // For security, we should clear the token and notify the user
            // The caller should handle this by prompting user to re-enter token
            throw error;
        }

        if (error instanceof InvalidFormatError) {
            // Token format is invalid - may be legacy unencrypted token
            logger.warn('API token has invalid format', {
                siteId: site.id,
                tenantId: site.tenantId,
                operation: 'decrypt',
                errorType: 'InvalidFormatError',
            });

            throw error;
        }

        if (error instanceof DecryptionError) {
            // General decryption failure
            logger.error('Failed to decrypt API token', {
                siteId: site.id,
                tenantId: site.tenantId,
                operation: 'decrypt',
                errorType: 'DecryptionError',
            });

            throw error;
        }

        // Unknown error
        const sanitizedMessage = error instanceof Error
            ? sanitizeErrorMessage(error)
            : 'Unknown decryption error';

        logger.error('Unexpected error during API token decryption', {
            error: sanitizedMessage,
            siteId: site.id,
            tenantId: site.tenantId,
            operation: 'decrypt',
        });

        throw error;
    }
}

/**
 * Decrypts API tokens for multiple sites
 * 
 * Convenience function for batch decryption operations.
 * Handles errors gracefully by logging and continuing with other sites.
 * 
 * @param sites - Array of Site objects with encrypted API tokens
 * @returns Array of Site objects with decrypted API tokens
 * 
 * @example
 * ```typescript
 * const sites = await prisma.site.findMany({ where: { tenantId } });
 * const decrypted = await decryptSiteTokens(sites);
 * ```
 */
export async function decryptSiteTokens<T extends SiteData>(
    sites: T[]
): Promise<T[]> {
    const results: T[] = [];

    for (const site of sites) {
        try {
            const decrypted = await decryptSiteToken(site);
            results.push(decrypted);
        } catch (error) {
            // Log error but continue with other sites
            const userMessage = error instanceof Error
                ? getUserFriendlyErrorMessage(error)
                : 'Failed to decrypt API token';

            logger.error('Failed to decrypt site token in batch operation', {
                siteId: site.id,
                tenantId: site.tenantId,
                error: userMessage,
            });

            // Return site with null token to indicate decryption failure
            results.push({
                ...site,
                apiToken: null,
            });
        }
    }

    return results;
}

/**
 * Checks if a token is encrypted
 * 
 * Utility function to check if a token string is in encrypted format.
 * Useful for migration scenarios or conditional encryption logic.
 * 
 * @param token - Token string to check
 * @returns true if token is encrypted, false otherwise
 * 
 * @example
 * ```typescript
 * if (!isTokenEncrypted(site.apiToken)) {
 *   // Migrate legacy token to encrypted format
 *   site = await encryptSiteToken(site);
 *   await prisma.site.update({ where: { id: site.id }, data: site });
 * }
 * ```
 */
export function isTokenEncrypted(token: string | null | undefined): boolean {
    if (!token) {
        return false;
    }

    return encryptionService.isEncrypted(token);
}

/**
 * Safely handles decryption errors and returns user-friendly messages
 * 
 * This function wraps decryption operations and provides graceful error handling
 * with user-friendly error messages. Use this when you need to handle decryption
 * errors in the UI layer.
 * 
 * @param site - Site object to decrypt
 * @returns Object with success status, decrypted site (if successful), and error message
 * 
 * @example
 * ```typescript
 * const result = await safeDecryptSiteToken(site);
 * 
 * if (!result.success) {
 *   // Show error to user
 *   toast.error(result.errorMessage);
 *   // Prompt user to re-enter token
 *   router.push('/dashboard/site-config');
 * } else {
 *   // Use decrypted site
 *   const response = await syncSite(result.site);
 * }
 * ```
 */
export async function safeDecryptSiteToken<T extends SiteData>(
    site: T
): Promise<{
    success: boolean;
    site?: T;
    errorMessage?: string;
    errorType?: string;
}> {
    try {
        const decrypted = await decryptSiteToken(site);
        return {
            success: true,
            site: decrypted,
        };
    } catch (error) {
        const errorMessage = error instanceof Error
            ? getUserFriendlyErrorMessage(error)
            : 'Failed to decrypt API token';

        const errorType = error instanceof Error
            ? error.name
            : 'UnknownError';

        return {
            success: false,
            errorMessage,
            errorType,
        };
    }
}

/**
 * Middleware configuration options
 */
export interface EncryptionMiddlewareOptions {
    /**
     * Whether to automatically encrypt tokens on write
     * @default true
     */
    autoEncrypt?: boolean;

    /**
     * Whether to automatically decrypt tokens on read
     * @default true
     */
    autoDecrypt?: boolean;

    /**
     * Whether to throw errors or return null on decryption failure
     * @default true (throw errors)
     */
    throwOnError?: boolean;
}

/**
 * Default middleware options
 */
export const defaultOptions: EncryptionMiddlewareOptions = {
    autoEncrypt: true,
    autoDecrypt: true,
    throwOnError: true,
};
