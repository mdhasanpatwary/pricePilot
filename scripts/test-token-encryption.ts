#!/usr/bin/env ts-node

/**
 * Token Encryption Testing Script
 *
 * This script tests the API token encryption functionality to ensure:
 * 1. Tokens are properly encrypted when saved
 * 2. Tokens are properly decrypted when read
 * 3. Prisma middleware works correctly
 * 4. Encryption/decryption is transparent to application code
 *
 * Usage:
 *   npm run test:encryption
 *   or
 *   ts-node scripts/test-token-encryption.ts
 */

import { PrismaClient } from '@prisma/client';
import { EncryptionService } from '../lib/services/encryption/encryption-service';
import { KeyManager } from '../lib/services/encryption/key-manager';
import { encryptSiteToken, decryptSiteToken } from '../lib/middleware/encryption';

const prisma = new PrismaClient();

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    duration?: number;
}

const results: TestResult[] = [];

/**
 * Run a test and record the result
 */
async function runTest(
    name: string,
    testFn: () => Promise<void>
): Promise<void> {
    const startTime = Date.now();

    try {
        await testFn();
        const duration = Date.now() - startTime;

        results.push({
            name,
            passed: true,
            duration,
        });

        console.log(`✅ ${name} (${duration}ms)`);
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        results.push({
            name,
            passed: false,
            error: errorMessage,
            duration,
        });

        console.error(`❌ ${name} (${duration}ms)`);
        console.error(`   Error: ${errorMessage}`);
    }
}

/**
 * Test 1: Basic encryption/decryption
 */
async function testBasicEncryption(): Promise<void> {
    const keyManager = new KeyManager();
    const encryptionService = new EncryptionService(keyManager);

    const plainToken = 'test-token-12345';
    const encrypted = encryptionService.encrypt(plainToken);

    // Verify encrypted format
    if (!encrypted.includes(':')) {
        throw new Error('Encrypted token does not have expected format');
    }

    // Verify decryption
    const decrypted = encryptionService.decrypt(encrypted);

    if (decrypted !== plainToken) {
        throw new Error(`Decryption failed: expected "${plainToken}", got "${decrypted}"`);
    }
}

/**
 * Test 2: Encryption middleware functions
 */
async function testEncryptionMiddlewareScript(): Promise<void> {
    const plainToken = 'middleware-test-token';

    const siteData = {
        id: 'test-site-1',
        tenantId: 'test-tenant-1',
        type: 'USER' as const,
        platform: 'GENERIC' as const,
        baseUrl: 'https://test.example.com',
        apiToken: plainToken,
    };

    // Test encryption
    const encrypted = await encryptSiteToken(siteData);

    if (encrypted.apiToken === plainToken) {
        throw new Error('Token was not encrypted');
    }

    if (!encrypted.apiToken?.includes(':')) {
        throw new Error('Encrypted token does not have expected format');
    }

    // Test decryption
    const decrypted = await decryptSiteToken(encrypted);

    if (decrypted.apiToken !== plainToken) {
        throw new Error(`Decryption failed: expected "${plainToken}", got "${decrypted.apiToken}"`);
    }
}

/**
 * Test 3: Prisma middleware integration
 */
async function testPrismaMiddleware(): Promise<void> {
    const testToken = 'prisma-test-token-' + Date.now();
    const testSiteId = 'test-site-' + Date.now();

    try {
        // Create a site with plain token
        const created = await prisma.site.create({
            data: {
                id: testSiteId,
                tenantId: 'test-tenant',
                type: 'USER',
                platform: 'GENERIC',
                baseUrl: 'https://prisma-test.example.com',
                apiToken: testToken,
            },
        });

        // Verify token is decrypted in create result
        if (created.apiToken !== testToken) {
            throw new Error('Token not decrypted in create result');
        }

        // Read the site back
        const retrieved = await prisma.site.findUnique({
            where: { id: testSiteId },
        });

        if (!retrieved) {
            throw new Error('Site not found after creation');
        }

        // Verify token is decrypted in read result
        if (retrieved.apiToken !== testToken) {
            throw new Error('Token not decrypted in read result');
        }

        // Verify token is actually encrypted in database
        const raw = await prisma.$queryRaw<Array<{ apiToken: string }>>`
      SELECT "apiToken" FROM "Site" WHERE id = ${testSiteId}
    `;

        if (raw.length === 0) {
            throw new Error('Site not found in raw query');
        }

        const rawToken = raw[0].apiToken;

        if (rawToken === testToken) {
            throw new Error('Token is not encrypted in database');
        }

        if (!rawToken.includes(':')) {
            throw new Error('Token in database does not have encrypted format');
        }

        // Clean up
        await prisma.site.delete({
            where: { id: testSiteId },
        });
    } catch (error) {
        // Clean up on error
        try {
            await prisma.site.delete({
                where: { id: testSiteId },
            });
        } catch {
            // Ignore cleanup errors
        }

        throw error;
    }
}

/**
 * Test 4: Update operation
 */
async function testUpdateOperation(): Promise<void> {
    const testSiteId = 'test-site-update-' + Date.now();
    const originalToken = 'original-token-' + Date.now();
    const updatedToken = 'updated-token-' + Date.now();

    try {
        // Create a site
        await prisma.site.create({
            data: {
                id: testSiteId,
                tenantId: 'test-tenant',
                type: 'USER',
                platform: 'GENERIC',
                baseUrl: 'https://update-test.example.com',
                apiToken: originalToken,
            },
        });

        // Update the token
        const updated = await prisma.site.update({
            where: { id: testSiteId },
            data: { apiToken: updatedToken },
        });

        // Verify updated token is decrypted
        if (updated.apiToken !== updatedToken) {
            throw new Error('Updated token not decrypted');
        }

        // Read back and verify
        const retrieved = await prisma.site.findUnique({
            where: { id: testSiteId },
        });

        if (retrieved?.apiToken !== updatedToken) {
            throw new Error('Updated token not persisted correctly');
        }

        // Clean up
        await prisma.site.delete({
            where: { id: testSiteId },
        });
    } catch (error) {
        // Clean up on error
        try {
            await prisma.site.delete({
                where: { id: testSiteId },
            });
        } catch {
            // Ignore cleanup errors
        }

        throw error;
    }
}

/**
 * Test 5: Batch operations
 */
async function testBatchOperations(): Promise<void> {
    const testSiteIds = [
        'test-site-batch-1-' + Date.now(),
        'test-site-batch-2-' + Date.now(),
        'test-site-batch-3-' + Date.now(),
    ];

    const testTokens = [
        'batch-token-1-' + Date.now(),
        'batch-token-2-' + Date.now(),
        'batch-token-3-' + Date.now(),
    ];

    try {
        // Create multiple sites
        for (let i = 0; i < testSiteIds.length; i++) {
            await prisma.site.create({
                data: {
                    id: testSiteIds[i],
                    tenantId: 'test-tenant',
                    type: 'USER',
                    platform: 'GENERIC',
                    baseUrl: `https://batch-test-${i}.example.com`,
                    apiToken: testTokens[i],
                },
            });
        }

        // Read all sites
        const sites = await prisma.site.findMany({
            where: {
                id: { in: testSiteIds },
            },
        });

        // Verify all tokens are decrypted
        if (sites.length !== testSiteIds.length) {
            throw new Error(`Expected ${testSiteIds.length} sites, got ${sites.length}`);
        }

        for (let i = 0; i < sites.length; i++) {
            const site = sites.find(s => s.id === testSiteIds[i]);
            if (!site) {
                throw new Error(`Site ${testSiteIds[i]} not found`);
            }

            if (site.apiToken !== testTokens[i]) {
                throw new Error(`Token mismatch for site ${testSiteIds[i]}`);
            }
        }

        // Clean up
        await prisma.site.deleteMany({
            where: {
                id: { in: testSiteIds },
            },
        });
    } catch (error) {
        // Clean up on error
        try {
            await prisma.site.deleteMany({
                where: {
                    id: { in: testSiteIds },
                },
            });
        } catch {
            // Ignore cleanup errors
        }

        throw error;
    }
}

/**
 * Test 6: Null token handling
 */
async function testNullTokenHandling(): Promise<void> {
    const testSiteId = 'test-site-null-' + Date.now();

    try {
        // Create a site without token
        const created = await prisma.site.create({
            data: {
                id: testSiteId,
                tenantId: 'test-tenant',
                type: 'USER',
                platform: 'GENERIC',
                baseUrl: 'https://null-test.example.com',
                apiToken: null,
            },
        });

        // Verify token is null
        if (created.apiToken !== null) {
            throw new Error('Expected null token');
        }

        // Read back and verify
        const retrieved = await prisma.site.findUnique({
            where: { id: testSiteId },
        });

        if (retrieved?.apiToken !== null) {
            throw new Error('Expected null token in read result');
        }

        // Clean up
        await prisma.site.delete({
            where: { id: testSiteId },
        });
    } catch (error) {
        // Clean up on error
        try {
            await prisma.site.delete({
                where: { id: testSiteId },
            });
        } catch {
            // Ignore cleanup errors
        }

        throw error;
    }
}

/**
 * Test 7: Already encrypted token handling
 */
async function testAlreadyEncryptedToken(): Promise<void> {
    const keyManager = new KeyManager();
    const encryptionService = new EncryptionService(keyManager);

    const plainToken = 'already-encrypted-test-' + Date.now();
    const encryptedToken = encryptionService.encrypt(plainToken);

    const siteData = {
        id: 'test-site-encrypted',
        tenantId: 'test-tenant',
        type: 'USER' as const,
        platform: 'GENERIC' as const,
        baseUrl: 'https://test.example.com',
        apiToken: encryptedToken,
    };

    // Try to encrypt already encrypted token
    const result = await encryptSiteToken(siteData);

    // Should return the same encrypted token
    if (result.apiToken !== encryptedToken) {
        throw new Error('Already encrypted token was re-encrypted');
    }

    // Decrypt should work
    const decrypted = await decryptSiteToken(result);

    if (decrypted.apiToken !== plainToken) {
        throw new Error('Failed to decrypt already encrypted token');
    }
}

/**
 * Print test summary
 */
function printSummary(): void {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    console.log(`Total tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
        console.log('\n❌ Failed tests:');
        results
            .filter(r => !r.passed)
            .forEach(r => {
                console.log(`   ${r.name}`);
                console.log(`   Error: ${r.error}`);
            });
    }

    console.log('='.repeat(60));
}

/**
 * Main test function
 */
async function main() {
    console.log('🔐 Token Encryption Testing Script');
    console.log('='.repeat(60));

    // Check environment variables
    if (!process.env.ENCRYPTION_KEY) {
        console.error('❌ ENCRYPTION_KEY environment variable not set');
        process.exit(1);
    }

    console.log('\n🧪 Running tests...\n');

    // Run all tests
    await runTest('Basic encryption/decryption', testBasicEncryption);
    await runTest('Encryption middleware functions', testEncryptionMiddlewareScript);
    await runTest('Prisma middleware integration', testPrismaMiddleware);
    await runTest('Update operation', testUpdateOperation);
    await runTest('Batch operations', testBatchOperations);
    await runTest('Null token handling', testNullTokenHandling);
    await runTest('Already encrypted token handling', testAlreadyEncryptedToken);

    // Print summary
    printSummary();

    // Exit with appropriate code
    const failed = results.filter(r => !r.passed).length;

    if (failed > 0) {
        console.error('\n❌ Some tests failed');
        process.exit(1);
    }

    console.log('\n✅ All tests passed');
    process.exit(0);
}

// Run tests
main()
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
