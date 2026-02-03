#!/usr/bin/env tsx

/**
 * Security Headers Test Script
 *
 * Tests that all required security headers are properly configured
 * and meet security best practices.
 */

import http from 'http';
import https from 'https';

interface SecurityHeader {
    name: string;
    required: boolean;
    expectedValue?: string;
    expectedPattern?: RegExp;
    description: string;
}

const SECURITY_HEADERS: SecurityHeader[] = [
    {
        name: 'Content-Security-Policy',
        required: true,
        expectedPattern: /default-src/i,
        description: 'Prevents XSS and injection attacks',
    },
    {
        name: 'X-Frame-Options',
        required: true,
        expectedValue: 'DENY',
        description: 'Prevents clickjacking attacks',
    },
    {
        name: 'X-Content-Type-Options',
        required: true,
        expectedValue: 'nosniff',
        description: 'Prevents MIME type sniffing',
    },
    {
        name: 'Strict-Transport-Security',
        required: true,
        expectedPattern: /max-age=\d+/i,
        description: 'Forces HTTPS connections',
    },
    {
        name: 'Referrer-Policy',
        required: false,
        expectedPattern: /origin-when-cross-origin|strict-origin-when-cross-origin|no-referrer/i,
        description: 'Controls referrer information',
    },
];

interface TestResult {
    header: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    message: string;
    value?: string;
}

async function fetchHeaders(url: string): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const req = protocol.get(url, (res) => {
            const headers: Record<string, string> = {};

            // Convert headers to lowercase keys for case-insensitive comparison
            Object.entries(res.headers).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    headers[key.toLowerCase()] = value;
                } else if (Array.isArray(value)) {
                    headers[key.toLowerCase()] = value.join(', ');
                }
            });

            resolve(headers);
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

function testHeader(
    _headerName: string,
    headerValue: string | undefined,
    expected: SecurityHeader
): TestResult {
    // Check if header exists
    if (!headerValue) {
        return {
            header: expected.name,
            status: expected.required ? 'FAIL' : 'WARN',
            message: expected.required
                ? `Missing required header: ${expected.name}`
                : `Optional header not found: ${expected.name}`,
        };
    }

    // Check expected value
    if (expected.expectedValue) {
        if (headerValue.toLowerCase() === expected.expectedValue.toLowerCase()) {
            return {
                header: expected.name,
                status: 'PASS',
                message: `Header correctly set to: ${expected.expectedValue}`,
                value: headerValue,
            };
        } else {
            return {
                header: expected.name,
                status: 'FAIL',
                message: `Expected "${expected.expectedValue}", got "${headerValue}"`,
                value: headerValue,
            };
        }
    }

    // Check expected pattern
    if (expected.expectedPattern) {
        if (expected.expectedPattern.test(headerValue)) {
            return {
                header: expected.name,
                status: 'PASS',
                message: `Header matches expected pattern`,
                value: headerValue,
            };
        } else {
            return {
                header: expected.name,
                status: 'FAIL',
                message: `Header does not match expected pattern`,
                value: headerValue,
            };
        }
    }

    // Header exists but no specific validation
    return {
        header: expected.name,
        status: 'PASS',
        message: `Header present`,
        value: headerValue,
    };
}

function analyzeCSP(csp: string): void {
    console.log('\n📋 Content-Security-Policy Analysis:');
    console.log('─'.repeat(60));

    const directives = csp.split(';').map(d => d.trim()).filter(Boolean);

    const criticalDirectives = [
        'default-src',
        'script-src',
        'style-src',
        'img-src',
        'connect-src',
        'frame-ancestors',
        'object-src',
    ];

    criticalDirectives.forEach(directive => {
        const found = directives.find(d => d.startsWith(directive));
        if (found) {
            console.log(`  ✅ ${found}`);
        } else {
            console.log(`  ❌ Missing: ${directive}`);
        }
    });

    // Check for unsafe directives
    const unsafeDirectives = directives.filter(d =>
        d.includes("'unsafe-inline'") || d.includes("'unsafe-eval'")
    );

    if (unsafeDirectives.length > 0) {
        console.log('\n  ⚠️  Unsafe directives detected (may be required for Next.js):');
        unsafeDirectives.forEach(d => console.log(`     ${d}`));
    }
}

function analyzeHSTS(hsts: string): void {
    console.log('\n🔒 Strict-Transport-Security Analysis:');
    console.log('─'.repeat(60));

    const maxAgeMatch = hsts.match(/max-age=(\d+)/i);
    const includesSubDomains = /includeSubDomains/i.test(hsts);
    const preload = /preload/i.test(hsts);

    if (maxAgeMatch) {
        const maxAge = parseInt(maxAgeMatch[1]);
        const days = Math.floor(maxAge / 86400);
        console.log(`  ✅ max-age: ${maxAge} seconds (${days} days)`);

        if (maxAge < 31536000) {
            console.log(`  ⚠️  Recommended: max-age >= 31536000 (1 year)`);
        }
    } else {
        console.log(`  ❌ max-age directive missing`);
    }

    console.log(`  ${includesSubDomains ? '✅' : '❌'} includeSubDomains: ${includesSubDomains}`);
    console.log(`  ${preload ? '✅' : '⚠️ '} preload: ${preload}`);

    if (preload) {
        console.log(`  ℹ️  Site is eligible for HSTS preload list`);
    }
}

async function testSecurityHeaders(url: string): Promise<void> {
    console.log('🔍 Testing Security Headers');
    console.log('═'.repeat(60));
    console.log(`URL: ${url}\n`);

    try {
        // Fetch headers
        console.log('Fetching headers...');
        const headers = await fetchHeaders(url);

        // Test each security header
        const results: TestResult[] = [];

        for (const expected of SECURITY_HEADERS) {
            const headerValue = headers[expected.name.toLowerCase()];
            const result = testHeader(expected.name, headerValue, expected);
            results.push(result);
        }

        // Display results
        console.log('\n📊 Test Results:');
        console.log('─'.repeat(60));

        let passCount = 0;
        let failCount = 0;
        let warnCount = 0;

        results.forEach(result => {
            const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️ ';
            console.log(`${icon} ${result.header}`);
            console.log(`   ${result.message}`);
            if (result.value && result.value.length < 100) {
                console.log(`   Value: ${result.value}`);
            }
            console.log();

            if (result.status === 'PASS') passCount++;
            else if (result.status === 'FAIL') failCount++;
            else warnCount++;
        });

        // Detailed analysis for specific headers
        const csp = headers['content-security-policy'];
        if (csp) {
            analyzeCSP(csp);
        }

        const hsts = headers['strict-transport-security'];
        if (hsts) {
            analyzeHSTS(hsts);
        }

        // Summary
        console.log('\n📈 Summary:');
        console.log('─'.repeat(60));
        console.log(`  ✅ Passed: ${passCount}`);
        console.log(`  ❌ Failed: ${failCount}`);
        console.log(`  ⚠️  Warnings: ${warnCount}`);
        console.log(`  📊 Total: ${results.length}`);

        // Overall status
        console.log('\n🎯 Overall Status:');
        console.log('─'.repeat(60));

        if (failCount === 0 && warnCount === 0) {
            console.log('  🎉 EXCELLENT - All security headers properly configured!');
        } else if (failCount === 0) {
            console.log('  ✅ GOOD - All required headers present, some optional headers missing');
        } else if (failCount <= 2) {
            console.log('  ⚠️  NEEDS IMPROVEMENT - Some required headers missing or misconfigured');
        } else {
            console.log('  ❌ CRITICAL - Multiple security headers missing or misconfigured');
        }

        // Recommendations
        console.log('\n💡 Recommendations:');
        console.log('─'.repeat(60));

        const failedHeaders = results.filter(r => r.status === 'FAIL');
        if (failedHeaders.length > 0) {
            console.log('  Fix the following issues:');
            failedHeaders.forEach(r => {
                console.log(`  • ${r.header}: ${r.message}`);
            });
        } else {
            console.log('  • Test with online security scanners:');
            console.log('    - https://securityheaders.com/');
            console.log('    - https://observatory.mozilla.org/');
            console.log('  • Monitor CSP violations in production');
            console.log('  • Review and update headers quarterly');
        }

        console.log('\n' + '═'.repeat(60));

        // Exit with appropriate code
        process.exit(failCount > 0 ? 1 : 0);

    } catch (error) {
        console.error('\n❌ Error testing security headers:');
        console.error(error instanceof Error ? error.message : String(error));
        console.error('\nMake sure the application is running and accessible.');
        process.exit(1);
    }
}

// Main execution
const url = process.env.TEST_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

console.log('🛡️  Security Headers Test Suite');
console.log('═'.repeat(60));
console.log(`Testing URL: ${url}`);
console.log('═'.repeat(60));
console.log();

testSecurityHeaders(url);
