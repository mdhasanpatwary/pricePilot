/**
 * CORS Configuration Test Script
 *
 * Tests CORS configuration with different origins to ensure:
 * - Allowed origins work correctly
 * - Disallowed origins are rejected
 * - Preflight requests are handled properly
 * - Headers are set correctly
 */

import { validateCorsConfig } from '../lib/middleware/cors';

interface TestResult {
    test: string;
    passed: boolean;
    message: string;
}

const results: TestResult[] = [];

/**
 * Test CORS configuration validation
 */
async function testCorsValidation() {
    console.log('\n🔍 Testing CORS Configuration Validation...\n');

    // Test 1: Validate configuration
    try {
        validateCorsConfig();
        results.push({
            test: 'CORS Configuration Validation',
            passed: true,
            message: 'Configuration is valid',
        });
        console.log('✅ CORS configuration is valid');
    } catch (error) {
        results.push({
            test: 'CORS Configuration Validation',
            passed: false,
            message: error instanceof Error ? error.message : String(error),
        });
        console.error('❌ CORS configuration validation failed:', error);
    }
}

/**
 * Test CORS headers with different origins
 */
async function testCorsHeaders() {
    console.log('\n🔍 Testing CORS Headers...\n');

    const testOrigins = [
        {
            origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
            shouldAllow: true,
            description: 'Allowed origin (NEXTAUTH_URL)',
        },
        {
            origin: 'http://localhost:3001',
            shouldAllow: process.env.NODE_ENV === 'development',
            description: 'Localhost with different port',
        },
        {
            origin: 'https://malicious-site.com',
            shouldAllow: false,
            description: 'Disallowed origin',
        },
        {
            origin: 'https://example.com',
            shouldAllow: process.env.ALLOWED_ORIGINS?.includes('https://example.com') || false,
            description: 'Custom allowed origin',
        },
    ];

    for (const { origin, shouldAllow, description } of testOrigins) {
        try {
            // Simulate a request to an API endpoint
            const response = await fetch('http://localhost:3000/api/v1/health', {
                method: 'OPTIONS',
                headers: {
                    'Origin': origin,
                    'Access-Control-Request-Method': 'GET',
                    'Access-Control-Request-Headers': 'Content-Type',
                },
            });

            const allowOriginHeader = response.headers.get('Access-Control-Allow-Origin');
            const passed = shouldAllow
                ? allowOriginHeader === origin
                : !allowOriginHeader || allowOriginHeader !== origin;

            results.push({
                test: `CORS Headers - ${description}`,
                passed,
                message: passed
                    ? `Correctly ${shouldAllow ? 'allowed' : 'rejected'} origin: ${origin}`
                    : `Expected ${shouldAllow ? 'allow' : 'reject'}, got: ${allowOriginHeader}`,
            });

            if (passed) {
                console.log(`✅ ${description}: ${shouldAllow ? 'Allowed' : 'Rejected'} correctly`);
            } else {
                console.error(`❌ ${description}: Expected ${shouldAllow ? 'allow' : 'reject'}, got: ${allowOriginHeader}`);
            }
        } catch (error) {
            results.push({
                test: `CORS Headers - ${description}`,
                passed: false,
                message: `Request failed: ${error instanceof Error ? error.message : String(error)}`,
            });
            console.error(`❌ ${description}: Request failed -`, error);
        }
    }
}

/**
 * Test CORS methods restriction
 */
async function testCorsMethodsRestriction() {
    console.log('\n🔍 Testing CORS Methods Restriction...\n');

    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
    const disallowedMethods = ['TRACE', 'CONNECT'];

    const origin = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // Test allowed methods
    for (const method of allowedMethods) {
        try {
            const response = await fetch('http://localhost:3000/api/v1/health', {
                method: 'OPTIONS',
                headers: {
                    'Origin': origin,
                    'Access-Control-Request-Method': method,
                },
            });

            const allowMethodsHeader = response.headers.get('Access-Control-Allow-Methods');
            const passed = allowMethodsHeader?.includes(method) || false;

            results.push({
                test: `CORS Methods - ${method}`,
                passed,
                message: passed
                    ? `Method ${method} is allowed`
                    : `Method ${method} should be allowed but isn't`,
            });

            if (passed) {
                console.log(`✅ Method ${method} is allowed`);
            } else {
                console.error(`❌ Method ${method} should be allowed but isn't`);
            }
        } catch (error) {
            console.error(`❌ Failed to test method ${method}:`, error);
        }
    }

    // Test disallowed methods
    for (const method of disallowedMethods) {
        try {
            const response = await fetch('http://localhost:3000/api/v1/health', {
                method: 'OPTIONS',
                headers: {
                    'Origin': origin,
                    'Access-Control-Request-Method': method,
                },
            });

            const allowMethodsHeader = response.headers.get('Access-Control-Allow-Methods');
            const passed = !allowMethodsHeader?.includes(method);

            results.push({
                test: `CORS Methods - ${method} (disallowed)`,
                passed,
                message: passed
                    ? `Method ${method} is correctly rejected`
                    : `Method ${method} should be rejected but isn't`,
            });

            if (passed) {
                console.log(`✅ Method ${method} is correctly rejected`);
            } else {
                console.error(`❌ Method ${method} should be rejected but isn't`);
            }
        } catch (error) {
            console.error(`❌ Failed to test method ${method}:`, error);
        }
    }
}

/**
 * Print summary
 */
function printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CORS Configuration Test Summary');
    console.log('='.repeat(60) + '\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
        console.log('Failed Tests:');
        results
            .filter(r => !r.passed)
            .forEach(r => {
                console.log(`  ❌ ${r.test}`);
                console.log(`     ${r.message}`);
            });
        console.log('');
    }

    console.log('='.repeat(60) + '\n');
}

/**
 * Main test execution
 */
async function main() {
    console.log('🚀 Starting CORS Configuration Tests...');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL || 'http://localhost:3000');
    console.log('ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS || 'Not set (using NEXTAUTH_URL)');

    await testCorsValidation();

    // Note: The following tests require the server to be running
    console.log('\n⚠️  Note: The following tests require the development server to be running.');
    console.log('   Start the server with: npm run dev\n');

    // Optionally run full integration tests if explicitly enabled
    if (process.env.RUN_FULL_TESTS === 'true') {
        await testCorsHeaders();
        await testCorsMethodsRestriction();
    } else {
        console.log('Skipping full CORS header/method tests. Set RUN_FULL_TESTS=true to run them.');
    }

    printSummary();

    // Exit with error code if any tests failed
    const failed = results.filter(r => !r.passed).length;
    if (failed > 0) {
        process.exit(1);
    }
}

// Run tests
main().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
});
