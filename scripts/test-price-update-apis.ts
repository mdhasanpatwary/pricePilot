/**
 * Manual Testing Script for Price Update APIs
 *
 * This script provides a manual testing framework for verifying
 * OpenCart and Laravel price update APIs work correctly.
 *
 * Requirements: 2.5.3
 *
 * Usage:
 * 1. Set up test OpenCart/Laravel instances
 * 2. Configure environment variables
 * 3. Run: npx tsx scripts/test-price-update-apis.ts
 */

import { prisma } from "@/lib/prisma";
import { SyncService } from "@/lib/services/sync";

// Test configuration
interface TestConfig {
    platform: 'OPENCART' | 'LARAVEL';
    baseUrl: string;
    apiToken: string;
    testProductId: string;
    testSku?: string;
    testPrice: number;
}

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
    console.log('\n' + '='.repeat(60));
    log(title, 'cyan');
    console.log('='.repeat(60) + '\n');
}

function logTest(testName: string) {
    log(`\n▶ ${testName}`, 'blue');
}

function logSuccess(message: string) {
    log(`  ✓ ${message}`, 'green');
}

function logError(message: string) {
    log(`  ✗ ${message}`, 'red');
}

function logWarning(message: string) {
    log(`  ⚠ ${message}`, 'yellow');
}

/**
 * Test 1: Successful price update
 */
async function testSuccessfulPriceUpdate(config: TestConfig): Promise<boolean> {
    logTest('Test 1: Successful Price Update');

    try {
        // Create a test site in database
        const testSite = await prisma.site.create({
            data: {
                tenantId: 'test-tenant-id', // You'll need to use a real tenant ID
                type: 'USER',
                platform: config.platform,
                baseUrl: config.baseUrl,
                apiToken: config.apiToken,
            }
        });

        // Create a test product
        const testProduct = await prisma.product.create({
            data: {
                tenantId: 'test-tenant-id',
                siteId: testSite.id,
                externalId: config.testProductId,
                sku: config.testSku || 'TEST-SKU-001',
                title: 'Test Product',
                currentPrice: config.testPrice,
                currency: 'USD',
            }
        });

        log(`  Created test site: ${testSite.id}`);
        log(`  Created test product: ${testProduct.id}`);

        // Attempt price update
        log(`  Updating price to ${config.testPrice}...`);

        const result = await SyncService.syncProductsToStore(testSite.id);

        if (result.success && result.updated > 0) {
            logSuccess(`Price updated successfully! Updated ${result.updated} product(s)`);

            // Verify price update log was created
            const updateLog = await prisma.priceUpdateLog.findFirst({
                where: { productId: testProduct.id },
                orderBy: { executedAt: 'desc' }
            });

            if (updateLog && updateLog.status === 'SUCCESS') {
                logSuccess('Price update log created with SUCCESS status');
                log(`    Old Price: ${updateLog.oldPrice}`);
                log(`    New Price: ${updateLog.newPrice}`);
            } else {
                logWarning('Price update log not found or status is not SUCCESS');
            }

            // Cleanup
            await prisma.priceUpdateLog.deleteMany({ where: { productId: testProduct.id } });
            await prisma.product.delete({ where: { id: testProduct.id } });
            await prisma.site.delete({ where: { id: testSite.id } });

            return true;
        } else {
            logError('Price update failed or no products updated');

            // Cleanup
            await prisma.priceUpdateLog.deleteMany({ where: { productId: testProduct.id } });
            await prisma.product.delete({ where: { id: testProduct.id } });
            await prisma.site.delete({ where: { id: testSite.id } });

            return false;
        }
    } catch (err: any) {
        logError(`Test failed with error: ${err instanceof Error ? err.message : String(err)}`);
        return false;
    }
}

/**
 * Test 2: Invalid API token
 */
async function testInvalidToken(config: TestConfig): Promise<boolean> {
    logTest('Test 2: Invalid API Token');

    try {
        const invalidConfig = { ...config, apiToken: 'invalid-token-12345' };

        // Create a test site with invalid token
        const testSite = await prisma.site.create({
            data: {
                tenantId: 'test-tenant-id',
                type: 'USER',
                platform: invalidConfig.platform,
                baseUrl: invalidConfig.baseUrl,
                apiToken: invalidConfig.apiToken,
            }
        });

        // Create a test product
        const testProduct = await prisma.product.create({
            data: {
                tenantId: 'test-tenant-id',
                siteId: testSite.id,
                externalId: config.testProductId,
                sku: config.testSku || 'TEST-SKU-002',
                title: 'Test Product',
                currentPrice: config.testPrice,
                currency: 'USD',
            }
        });

        log(`  Testing with invalid token...`);

        try {
            await SyncService.syncProductsToStore(testSite.id);
            logError('Expected authentication error but update succeeded');

            // Cleanup
            await prisma.priceUpdateLog.deleteMany({ where: { productId: testProduct.id } });
            await prisma.product.delete({ where: { id: testProduct.id } });
            await prisma.site.delete({ where: { id: testSite.id } });

            return false;
        } catch (err: any) {
            if (err instanceof Error && (
                err.message.includes('Invalid API token') ||
                err.message.includes('401') ||
                err.message.includes('403') ||
                err.message.includes('Unauthorized')
            )) {
                logSuccess('Correctly rejected invalid API token');

                // Verify error was logged
                const updateLog = await prisma.priceUpdateLog.findFirst({
                    where: { productId: testProduct.id },
                    orderBy: { executedAt: 'desc' }
                });

                if (updateLog && updateLog.status === 'FAILED') {
                    logSuccess('Price update log created with FAILED status');
                    log(`    Error: ${updateLog.errorDetails}`);
                }

                // Cleanup
                await prisma.priceUpdateLog.deleteMany({ where: { productId: testProduct.id } });
                await prisma.product.delete({ where: { id: testProduct.id } });
                await prisma.site.delete({ where: { id: testSite.id } });

                return true;
            } else {
                logError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);

                // Cleanup
                await prisma.priceUpdateLog.deleteMany({ where: { productId: testProduct.id } });
                await prisma.product.delete({ where: { id: testProduct.id } });
                await prisma.site.delete({ where: { id: testSite.id } });

                return false;
            }
        }
    } catch (error) {
        logError(`Test setup failed: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/**
 * Test 3: Product not found
 */
async function testProductNotFound(config: TestConfig): Promise<boolean> {
    logTest('Test 3: Product Not Found');

    try {
        // Create a test site
        const testSite = await prisma.site.create({
            data: {
                tenantId: 'test-tenant-id',
                type: 'USER',
                platform: config.platform,
                baseUrl: config.baseUrl,
                apiToken: config.apiToken,
            }
        });

        // Create a test product with non-existent external ID
        const testProduct = await prisma.product.create({
            data: {
                tenantId: 'test-tenant-id',
                siteId: testSite.id,
                externalId: '999999999', // Non-existent product ID
                sku: 'NONEXISTENT-SKU',
                title: 'Non-existent Product',
                currentPrice: config.testPrice,
                currency: 'USD',
            }
        });

        log(`  Testing with non-existent product ID...`);

        await SyncService.syncProductsToStore(testSite.id);

        // Check if update failed for this product
        const updateLog = await prisma.priceUpdateLog.findFirst({
            where: { productId: testProduct.id },
            orderBy: { executedAt: 'desc' }
        });

        if (updateLog && updateLog.status === 'FAILED' &&
            updateLog.errorDetails?.includes('not found')) {
            logSuccess('Correctly handled product not found error');
            log(`    Error: ${updateLog.errorDetails}`);

            // Cleanup
            await prisma.priceUpdateLog.deleteMany({ where: { productId: testProduct.id } });
            await prisma.product.delete({ where: { id: testProduct.id } });
            await prisma.site.delete({ where: { id: testSite.id } });

            return true;
        } else {
            logWarning('Product not found error may not have been properly logged');

            // Cleanup
            await prisma.priceUpdateLog.deleteMany({ where: { productId: testProduct.id } });
            await prisma.product.delete({ where: { id: testProduct.id } });
            await prisma.site.delete({ where: { id: testSite.id } });

            return false;
        }
    } catch (err: any) {
        logError(`Test failed with error: ${err instanceof Error ? err.message : String(err)}`);
        return false;
    }
}

/**
 * Test 4: Network error simulation
 */
async function testNetworkError(config: TestConfig): Promise<boolean> {
    logTest('Test 4: Network Error');

    try {
        // Create a test site with invalid URL
        const testSite = await prisma.site.create({
            data: {
                tenantId: 'test-tenant-id',
                type: 'USER',
                platform: config.platform,
                baseUrl: 'http://nonexistent-domain-12345.com',
                apiToken: config.apiToken,
            }
        });

        // Create a test product
        const testProduct = await prisma.product.create({
            data: {
                tenantId: 'test-tenant-id',
                siteId: testSite.id,
                externalId: config.testProductId,
                sku: config.testSku || 'TEST-SKU-004',
                title: 'Test Product',
                currentPrice: config.testPrice,
                currency: 'USD',
            }
        });

        log(`  Testing with unreachable URL...`);

        try {
            await SyncService.syncProductsToStore(testSite.id);

            // Check if error was logged
            const updateLog = await prisma.priceUpdateLog.findFirst({
                where: { productId: testProduct.id },
                orderBy: { executedAt: 'desc' }
            });

            if (updateLog && updateLog.status === 'FAILED') {
                logSuccess('Network error handled correctly');
                log(`    Error: ${updateLog.errorDetails}`);

                // Cleanup
                await prisma.priceUpdateLog.deleteMany({ where: { productId: testProduct.id } });
                await prisma.product.delete({ where: { id: testProduct.id } });
                await prisma.site.delete({ where: { id: testSite.id } });

                return true;
            } else {
                logWarning('Network error may not have been properly logged');

                // Cleanup
                await prisma.priceUpdateLog.deleteMany({ where: { productId: testProduct.id } });
                await prisma.product.delete({ where: { id: testProduct.id } });
                await prisma.site.delete({ where: { id: testSite.id } });

                return false;
            }
        } catch (error) {
            logSuccess('Network error correctly threw exception');

            // Cleanup
            await prisma.priceUpdateLog.deleteMany({ where: { productId: testProduct.id } });
            await prisma.product.delete({ where: { id: testProduct.id } });
            await prisma.site.delete({ where: { id: testSite.id } });

            return true;
        }
    } catch (error) {
        logError(`Test setup failed: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/**
 * Test 5: Verify price update logs
 */
async function testPriceUpdateLogs(config: TestConfig): Promise<boolean> {
    logTest('Test 5: Verify Price Update Logs');

    try {
        // Create a test site
        const testSite = await prisma.site.create({
            data: {
                tenantId: 'test-tenant-id',
                type: 'USER',
                platform: config.platform,
                baseUrl: config.baseUrl,
                apiToken: config.apiToken,
            }
        });

        // Create a test product
        const testProduct = await prisma.product.create({
            data: {
                tenantId: 'test-tenant-id',
                siteId: testSite.id,
                externalId: config.testProductId,
                sku: config.testSku || 'TEST-SKU-005',
                title: 'Test Product',
                currentPrice: config.testPrice,
                currency: 'USD',
            }
        });

        log(`  Updating price and verifying logs...`);

        await SyncService.syncProductsToStore(testSite.id);

        // Verify price update log was created
        const updateLog = await prisma.priceUpdateLog.findFirst({
            where: { productId: testProduct.id },
            orderBy: { executedAt: 'desc' }
        });

        if (!updateLog) {
            logError('No price update log found');

            // Cleanup
            await prisma.product.delete({ where: { id: testProduct.id } });
            await prisma.site.delete({ where: { id: testSite.id } });

            return false;
        }

        // Verify log fields
        let allFieldsValid = true;

        if (updateLog.productId !== testProduct.id) {
            logError('Product ID mismatch in log');
            allFieldsValid = false;
        } else {
            logSuccess('Product ID correct in log');
        }

        if (typeof updateLog.oldPrice !== 'object' || updateLog.oldPrice === null) {
            logError('Old price not recorded');
            allFieldsValid = false;
        } else {
            logSuccess(`Old price recorded: ${updateLog.oldPrice}`);
        }

        if (typeof updateLog.newPrice !== 'object' || updateLog.newPrice === null) {
            logError('New price not recorded');
            allFieldsValid = false;
        } else {
            logSuccess(`New price recorded: ${updateLog.newPrice}`);
        }

        if (!updateLog.executedAt) {
            logError('Execution timestamp not recorded');
            allFieldsValid = false;
        } else {
            logSuccess(`Execution timestamp: ${updateLog.executedAt}`);
        }

        if (!['SUCCESS', 'FAILED'].includes(updateLog.status)) {
            logError(`Invalid status: ${updateLog.status}`);
            allFieldsValid = false;
        } else {
            logSuccess(`Status: ${updateLog.status}`);
        }

        // Cleanup
        await prisma.priceUpdateLog.deleteMany({ where: { productId: testProduct.id } });
        await prisma.product.delete({ where: { id: testProduct.id } });
        await prisma.site.delete({ where: { id: testSite.id } });

        return allFieldsValid;
    } catch (error) {
        logError(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/**
 * Main test runner
 */
async function runTests() {
    logSection('Price Update API Testing Suite');

    log('This script tests the price update APIs for OpenCart and Laravel platforms.');
    log('Before running, ensure you have:');
    log('  1. Test OpenCart instance set up');
    log('  2. Test Laravel instance set up');
    log('  3. Valid API tokens for both platforms');
    log('  4. Test product IDs that exist in your test stores\n');

    // Configuration - Update these with your test instance details
    const openCartConfig: TestConfig = {
        platform: 'OPENCART',
        baseUrl: process.env.TEST_OPENCART_URL || 'http://localhost/opencart',
        apiToken: process.env.TEST_OPENCART_TOKEN || 'your-opencart-token',
        testProductId: process.env.TEST_OPENCART_PRODUCT_ID || '1',
        testSku: 'TEST-SKU-OC',
        testPrice: 99.99,
    };

    const laravelConfig: TestConfig = {
        platform: 'LARAVEL',
        baseUrl: process.env.TEST_LARAVEL_URL || 'http://localhost/laravel',
        apiToken: process.env.TEST_LARAVEL_TOKEN || 'your-laravel-token',
        testProductId: process.env.TEST_LARAVEL_PRODUCT_ID || '1',
        testSku: 'TEST-SKU-LV',
        testPrice: 149.99,
    };

    // Check if configuration is set
    if (openCartConfig.apiToken === 'your-opencart-token' ||
        laravelConfig.apiToken === 'your-laravel-token') {
        logWarning('Please configure test instances in environment variables:');
        log('  TEST_OPENCART_URL, TEST_OPENCART_TOKEN, TEST_OPENCART_PRODUCT_ID');
        log('  TEST_LARAVEL_URL, TEST_LARAVEL_TOKEN, TEST_LARAVEL_PRODUCT_ID');
        log('\nOr update the configuration in this script directly.\n');
        process.exit(1);
    }

    const results: { platform: string; test: string; passed: boolean }[] = [];

    // Test OpenCart
    logSection('Testing OpenCart API');
    results.push({ platform: 'OpenCart', test: 'Successful Update', passed: await testSuccessfulPriceUpdate(openCartConfig) });
    results.push({ platform: 'OpenCart', test: 'Invalid Token', passed: await testInvalidToken(openCartConfig) });
    results.push({ platform: 'OpenCart', test: 'Product Not Found', passed: await testProductNotFound(openCartConfig) });
    results.push({ platform: 'OpenCart', test: 'Network Error', passed: await testNetworkError(openCartConfig) });
    results.push({ platform: 'OpenCart', test: 'Update Logs', passed: await testPriceUpdateLogs(openCartConfig) });

    // Test Laravel
    logSection('Testing Laravel API');
    results.push({ platform: 'Laravel', test: 'Successful Update', passed: await testSuccessfulPriceUpdate(laravelConfig) });
    results.push({ platform: 'Laravel', test: 'Invalid Token', passed: await testInvalidToken(laravelConfig) });
    results.push({ platform: 'Laravel', test: 'Product Not Found', passed: await testProductNotFound(laravelConfig) });
    results.push({ platform: 'Laravel', test: 'Network Error', passed: await testNetworkError(laravelConfig) });
    results.push({ platform: 'Laravel', test: 'Update Logs', passed: await testPriceUpdateLogs(laravelConfig) });

    // Summary
    logSection('Test Results Summary');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    results.forEach(result => {
        const status = result.passed ? '✓' : '✗';
        const color = result.passed ? 'green' : 'red';
        log(`  ${status} ${result.platform} - ${result.test}`, color);
    });

    console.log('\n' + '='.repeat(60));
    log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`, passed === total ? 'green' : 'red');
    console.log('='.repeat(60) + '\n');

    if (passed === total) {
        log('All tests passed! ✓', 'green');
        process.exit(0);
    } else {
        log(`${failed} test(s) failed. Please review the errors above.`, 'red');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    logError(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(error);
    process.exit(1);
});
