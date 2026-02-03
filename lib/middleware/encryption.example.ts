/**
 * Usage Examples for Encryption Middleware
 * 
 * This file demonstrates how to use the encryption middleware
 * for encrypting/decrypting API tokens when working with Site data.
 * 
 * @module lib/middleware/encryption.example
 */

import { prisma } from '@/lib/prisma';
import {
    encryptSiteToken,
    decryptSiteToken,
    decryptSiteTokens,
    isTokenEncrypted,
    safeDecryptSiteToken,
} from './encryption';

/**
 * Example 1: Creating a new site with encrypted API token
 */
export async function createSiteExample() {
    // Prepare site data with plaintext API token
    const siteData = {
        tenantId: 'tenant-123',
        type: 'USER' as const,
        platform: 'OPENCART' as const,
        baseUrl: 'https://example.com',
        apiToken: 'plain-text-api-token-12345',
    };

    // Encrypt the API token before saving
    const encryptedData = await encryptSiteToken(siteData);

    // Save to database with encrypted token
    const site = await prisma.site.create({
        data: encryptedData,
    });

    console.log('Site created with encrypted API token:', site.id);
    return site;
}

/**
 * Example 2: Updating a site's API token
 */
export async function updateSiteTokenExample(siteId: string, newToken: string) {
    // Prepare update data with new plaintext token
    const updateData = {
        apiToken: newToken,
    };

    // Encrypt the new token before updating
    const encryptedData = await encryptSiteToken(updateData);

    // Update in database
    const site = await prisma.site.update({
        where: { id: siteId },
        data: encryptedData,
    });

    console.log('Site API token updated:', site.id);
    return site;
}

/**
 * Example 3: Reading a site and decrypting its API token
 */
export async function getSiteWithDecryptedTokenExample(siteId: string) {
    // Fetch site from database (token is encrypted)
    const site = await prisma.site.findUnique({
        where: { id: siteId },
    });

    if (!site) {
        throw new Error('Site not found');
    }

    // Decrypt the API token for use
    const decryptedSite = await decryptSiteToken(site);

    // Now you can use the decrypted token for API calls
    console.log('Site fetched with decrypted token:', decryptedSite.id);
    console.log('Token is ready for API calls');

    return decryptedSite;
}

/**
 * Example 4: Fetching multiple sites and decrypting tokens
 */
export async function getAllSitesWithDecryptedTokensExample(tenantId: string) {
    // Fetch all sites for tenant
    const sites = await prisma.site.findMany({
        where: { tenantId },
    });

    // Decrypt all tokens in batch
    const decryptedSites = await decryptSiteTokens(sites);

    console.log(`Fetched ${decryptedSites.length} sites with decrypted tokens`);
    return decryptedSites;
}

/**
 * Example 5: Safe decryption with error handling
 */
export async function safeSyncSiteExample(siteId: string) {
    // Fetch site from database
    const site = await prisma.site.findUnique({
        where: { id: siteId },
    });

    if (!site) {
        throw new Error('Site not found');
    }

    // Safely decrypt token with error handling
    const result = await safeDecryptSiteToken(site);

    if (!result.success) {
        // Handle decryption error gracefully
        console.error('Failed to decrypt API token:', result.errorMessage);
        console.error('Error type:', result.errorType);

        // Notify user to re-enter token
        // In a real application, you would:
        // 1. Show error message to user
        // 2. Redirect to settings page
        // 3. Clear the corrupted token
        return {
            success: false,
            error: result.errorMessage,
        };
    }

    // Use decrypted site for sync operation
    console.log('Token decrypted successfully, proceeding with sync');
    // ... perform sync operation with result.site

    return {
        success: true,
        site: result.site,
    };
}

/**
 * Example 6: Checking if a token is encrypted
 */
export async function checkTokenEncryptionExample(siteId: string) {
    const site = await prisma.site.findUnique({
        where: { id: siteId },
    });

    if (!site || !site.apiToken) {
        console.log('Site has no API token');
        return;
    }

    // Check if token is encrypted
    if (isTokenEncrypted(site.apiToken)) {
        console.log('Token is encrypted (secure)');
    } else {
        console.log('Token is NOT encrypted (needs migration)');

        // Migrate to encrypted format
        const encryptedData = await encryptSiteToken({ apiToken: site.apiToken });
        await prisma.site.update({
            where: { id: siteId },
            data: encryptedData,
        });

        console.log('Token migrated to encrypted format');
    }
}

/**
 * Example 7: Using in a service method
 */
export class SiteService {
    /**
     * Sync products from a site
     */
    static async syncProducts(siteId: string) {
        // Fetch site with encrypted token
        const site = await prisma.site.findUnique({
            where: { id: siteId },
        });

        if (!site) {
            throw new Error('Site not found');
        }

        // Decrypt token for API call
        const decryptedSite = await decryptSiteToken(site);

        if (!decryptedSite.apiToken) {
            throw new Error('Site has no API token configured');
        }

        // Use decrypted token for API call
        const response = await fetch(`${decryptedSite.baseUrl}/api/products`, {
            headers: {
                'Authorization': `Bearer ${decryptedSite.apiToken}`,
            },
        });

        const products = await response.json();
        console.log(`Synced ${products.length} products from site ${siteId}`);

        return products;
    }

    /**
     * Update site configuration
     */
    static async updateSiteConfig(
        siteId: string,
        updates: {
            baseUrl?: string;
            apiToken?: string;
        }
    ) {
        // If updating API token, encrypt it first
        const dataToUpdate = updates.apiToken
            ? await encryptSiteToken(updates)
            : updates;

        // Update in database
        const site = await prisma.site.update({
            where: { id: siteId },
            data: dataToUpdate,
        });

        console.log('Site configuration updated:', site.id);
        return site;
    }
}

/**
 * Example 8: Error handling patterns
 */
export async function errorHandlingExample(siteId: string) {
    try {
        const site = await prisma.site.findUnique({
            where: { id: siteId },
        });

        if (!site) {
            throw new Error('Site not found');
        }

        // Attempt to decrypt token
        const decryptedSite = await decryptSiteToken(site);

        return decryptedSite;
    } catch (error) {
        // Handle specific error types
        if (error instanceof Error) {
            switch (error.name) {
                case 'AuthenticationError':
                    // Token was tampered with - critical security event
                    console.error('SECURITY ALERT: Token integrity check failed');
                    // Clear the token and notify user
                    await prisma.site.update({
                        where: { id: siteId },
                        data: { apiToken: null },
                    });
                    throw new Error('Token integrity check failed. Please re-enter your API token.');

                case 'DecryptionError':
                    // Decryption failed - may be due to key rotation
                    console.error('Decryption failed:', error.message);
                    throw new Error('Failed to decrypt API token. Please re-enter your API token.');

                case 'InvalidFormatError':
                    // Token format is invalid - may be legacy unencrypted token
                    console.warn('Invalid token format detected');
                    // Attempt to migrate if it's a legacy token
                    throw new Error('Invalid token format. Please re-enter your API token.');

                default:
                    // Unknown error
                    console.error('Unexpected error:', error);
                    throw error;
            }
        }

        throw error;
    }
}

/**
 * Example 9: Batch operations with error handling
 */
export async function batchSyncExample(tenantId: string) {
    // Fetch all sites for tenant
    const sites = await prisma.site.findMany({
        where: { tenantId },
    });

    const results = [];

    for (const site of sites) {
        try {
            // Safely decrypt token
            const result = await safeDecryptSiteToken(site);

            if (!result.success) {
                // Log error but continue with other sites
                console.error(`Failed to decrypt token for site ${site.id}:`, result.errorMessage);
                results.push({
                    siteId: site.id,
                    success: false,
                    error: result.errorMessage,
                });
                continue;
            }

            // Perform sync operation
            // ... sync logic here

            results.push({
                siteId: site.id,
                success: true,
            });
        } catch (error) {
            console.error(`Error syncing site ${site.id}:`, error);
            results.push({
                siteId: site.id,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    return results;
}

/**
 * Example 10: Migration utility for existing sites
 */
export async function migrateAllSitesToEncryptedTokens(tenantId: string) {
    // Fetch all sites for tenant
    const sites = await prisma.site.findMany({
        where: { tenantId },
    });

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const site of sites) {
        if (!site.apiToken) {
            skipped++;
            continue;
        }

        // Check if already encrypted
        if (isTokenEncrypted(site.apiToken)) {
            skipped++;
            continue;
        }

        try {
            // Encrypt the plaintext token
            const encryptedData = await encryptSiteToken({ apiToken: site.apiToken });

            // Update in database
            await prisma.site.update({
                where: { id: site.id },
                data: encryptedData,
            });

            migrated++;
            console.log(`Migrated site ${site.id} to encrypted token`);
        } catch (error) {
            failed++;
            console.error(`Failed to migrate site ${site.id}:`, error);
        }
    }

    console.log('Migration complete:', {
        total: sites.length,
        migrated,
        skipped,
        failed,
    });

    return { total: sites.length, migrated, skipped, failed };
}
