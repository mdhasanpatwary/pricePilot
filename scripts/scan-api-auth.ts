#!/usr/bin/env tsx
/**
 * API Auth Security Scanner
 *
 * Scans all API routes to ensure they are wrapped with an appropriate
 * security/auth middleware wrapper.
 *
 * Required Wrappers:
 * - withRequestContextAndRateLimit (Standard)
 * - withInternalGate (Internal/Debug)
 * - withRequestContextOnly (Special cases)
 * - withRateLimit (Auth/Public pages)
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const ALLOWED_WRAPPERS = [
    'withRequestContextAndRateLimit',
    'withInternalGate',
    'withRequestContextOnly',
    'withRateLimit',
    'withCronAuth',
    'requireAdmin',
    'requireTenantContext',
    'requireAuth'
];

const ALLOWLIST = [
    'app/api/v1/auth/[...nextauth]/route.ts',
];

async function scanApiAuth() {
    console.log('🔍 Scanning API routes for security wrappers...\n');

    const routeFiles = await glob('app/api/**/route.ts');
    const issues: string[] = [];
    let totalMethods = 0;
    let securedMethods = 0;

    for (const file of routeFiles) {
        // Skip allowlisted files
        if (ALLOWLIST.includes(file.replace(/\\/g, '/'))) {
            continue;
        }

        const content = fs.readFileSync(file, 'utf-8');

        // Find all exported async functions (GET, POST, etc.)
        const methodRegex = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/g;
        let match;

        while ((match = methodRegex.exec(content)) !== null) {
            const method = match[1];
            totalMethods++;

            // Check if the exported function return statement uses an allowed wrapper
            // This is a simplified regex-based check.
            // In a more complex scenario, we'd use better parsing, but this matches the project's patterns.

            // Find the function body for this method
            const methodStartIdx = match.index;
            const savedLastIndex = methodRegex.lastIndex;
            const nextMethodMatch = methodRegex.exec(content);
            // Restore lastIndex so the loop doesn't skip methods
            methodRegex.lastIndex = savedLastIndex;

            const methodEndIdx = nextMethodMatch ? nextMethodMatch.index : content.length;

            const methodBody = content.substring(methodStartIdx, methodEndIdx);

            const hasWrapper = ALLOWED_WRAPPERS.some(wrapper => methodBody.includes(wrapper));

            if (hasWrapper) {
                securedMethods++;
            } else {
                issues.push(`${file} [${method}]`);
            }
        }
    }

    // Print summary
    console.log('📊 Security Wrapper Audit Summary');
    console.log('═'.repeat(60));
    console.log(`Total API methods scanned: ${totalMethods}`);
    console.log(`Methods with security wrappers: ${securedMethods}`);
    console.log(`Methods missing wrappers: ${issues.length}`);
    console.log('');

    if (issues.length > 0) {
        console.log('❌ Security Issues Found:');
        console.log('─'.repeat(60));
        issues.forEach(issue => console.log(`  MISSING WRAPPER: ${issue}`));
        console.log('\n⚠️  Action Required: Wrap these API handlers with withRequestContextAndRateLimit or similar.');
        process.exit(1);
    } else {
        console.log('✅ All API routes are protected with security wrappers!');
        process.exit(0);
    }
}

scanApiAuth().catch(err => {
    console.error('Fatal error during scan:', err);
    process.exit(1);
});
