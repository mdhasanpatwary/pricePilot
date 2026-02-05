/**
 * Integration Setup Verification Script
 * 
 * Verifies that all components of the dual documentation system are properly set up
 * without requiring database connection.
 */

import fs from 'fs';
import path from 'path';

interface VerificationResult {
    category: string;
    checks: Array<{
        name: string;
        passed: boolean;
        details?: string;
    }>;
}

const results: VerificationResult[] = [];

function checkFileExists(filePath: string): boolean {
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}

function checkDirectoryExists(dirPath: string): boolean {
    try {
        return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    } catch {
        return false;
    }
}

function countFiles(dirPath: string, extension?: string): number {
    try {
        if (!fs.existsSync(dirPath)) return 0;
        const files = fs.readdirSync(dirPath, { recursive: true });
        if (extension) {
            return files.filter(f => String(f).endsWith(extension)).length;
        }
        return files.filter(f => {
            const fullPath = path.join(dirPath, String(f));
            return fs.statSync(fullPath).isFile();
        }).length;
    } catch {
        return 0;
    }
}

function verifyFileStructure() {
    const category = 'File Structure';
    const checks = [];

    // Check documentation content directories
    checks.push({
        name: 'Tenant documentation directory exists',
        passed: checkDirectoryExists('docs-content/tenant'),
        details: 'docs-content/tenant/'
    });

    checks.push({
        name: 'Admin documentation directory exists',
        passed: checkDirectoryExists('docs-content/admin'),
        details: 'docs-content/admin/'
    });

    // Count documentation files
    const tenantFiles = countFiles('docs-content/tenant', '.md');
    checks.push({
        name: 'Tenant documentation files exist',
        passed: tenantFiles > 0,
        details: `Found ${tenantFiles} tenant documentation files`
    });

    const adminFiles = countFiles('docs-content/admin', '.md');
    checks.push({
        name: 'Admin documentation files exist',
        passed: adminFiles > 0,
        details: `Found ${adminFiles} admin documentation files`
    });

    results.push({ category, checks });
}

function verifyServiceFiles() {
    const category = 'Service Layer';
    const checks = [];

    const services = [
        { name: 'Documentation Service', path: 'lib/documentation/service.ts' },
        { name: 'Search Service', path: 'lib/documentation/search.ts' },
        { name: 'Analytics Service', path: 'lib/documentation/analytics.ts' },
        { name: 'Documentation Hook', path: 'lib/documentation/hook.ts' },
        { name: 'Markdown Parser', path: 'lib/documentation/parser.ts' },
    ];

    services.forEach(service => {
        checks.push({
            name: service.name,
            passed: checkFileExists(service.path),
            details: service.path
        });
    });

    results.push({ category, checks });
}

function verifyMigrationTools() {
    const category = 'Migration Tools';
    const checks = [];

    const migrationFiles = [
        { name: 'Document Analyzer', path: 'lib/documentation/migration/analyzer.ts' },
        { name: 'Document Migrator', path: 'lib/documentation/migration/migrator.ts' },
        { name: 'Redirect System', path: 'lib/documentation/migration/redirects.ts' },
        { name: 'Migration Reporter', path: 'lib/documentation/migration/reporter.ts' },
    ];

    migrationFiles.forEach(file => {
        checks.push({
            name: file.name,
            passed: checkFileExists(file.path),
            details: file.path
        });
    });

    results.push({ category, checks });
}

function verifyUIComponents() {
    const category = 'UI Components';
    const checks = [];

    // Check app routes
    checks.push({
        name: 'Tenant portal route',
        passed: checkFileExists('app/docs/page.tsx'),
        details: 'app/docs/page.tsx'
    });

    checks.push({
        name: 'Admin portal route',
        passed: checkFileExists('app/admin-docs/page.tsx'),
        details: 'app/admin-docs/page.tsx'
    });

    // Check documentation components
    const components = [
        { name: 'Code Block Component', path: 'components/docs/code-block.tsx' },
        { name: 'Feedback Widget', path: 'components/docs/feedback-widget.tsx' },
        { name: 'Version History', path: 'components/docs/version-history.tsx' },
        { name: 'Documentation Layout', path: 'components/docs/documentation-layout.tsx' },
        { name: 'Table of Contents', path: 'components/docs/table-of-contents.tsx' },
    ];

    components.forEach(comp => {
        checks.push({
            name: comp.name,
            passed: checkFileExists(comp.path),
            details: comp.path
        });
    });

    results.push({ category, checks });
}

function verifyAPIEndpoints() {
    const category = 'API Endpoints';
    const checks = [];

    const endpoints = [
        { name: 'Document retrieval API', path: 'app/api/v1/documentation/[type]/[...slug]/route.ts' },
        { name: 'Document list API', path: 'app/api/v1/documentation/[type]/route.ts' },
        { name: 'Search API', path: 'app/api/v1/documentation/search/route.ts' },
        { name: 'Analytics view tracking', path: 'app/api/v1/documentation/analytics/view/route.ts' },
        { name: 'Analytics search tracking', path: 'app/api/v1/documentation/analytics/search/route.ts' },
        { name: 'Analytics feedback', path: 'app/api/v1/documentation/analytics/feedback/route.ts' },
    ];

    endpoints.forEach(endpoint => {
        checks.push({
            name: endpoint.name,
            passed: checkFileExists(endpoint.path),
            details: endpoint.path
        });
    });

    results.push({ category, checks });
}

function verifyErrorHandling() {
    const category = 'Error Handling';
    const checks = [];

    const errorFiles = [
        { name: 'Error definitions', path: 'lib/documentation/errors.ts' },
        { name: 'Validation utilities', path: 'lib/documentation/validation.ts' },
        { name: 'Tenant docs error page', path: 'app/docs/error.tsx' },
        { name: 'Admin docs error page', path: 'app/admin-docs/error.tsx' },
        { name: 'Tenant docs not-found page', path: 'app/docs/not-found.tsx' },
        { name: 'Admin docs not-found page', path: 'app/admin-docs/not-found.tsx' },
    ];

    errorFiles.forEach(file => {
        checks.push({
            name: file.name,
            passed: checkFileExists(file.path),
            details: file.path
        });
    });

    results.push({ category, checks });
}

function verifySecurity() {
    const category = 'Security & Rate Limiting';
    const checks = [];

    const securityFiles = [
        { name: 'Rate limiting', path: 'lib/documentation/rate-limit.ts' },
        { name: 'Security utilities', path: 'lib/documentation/security.ts' },
        { name: 'Redirect middleware', path: 'lib/middleware/documentation-redirect.ts' },
    ];

    securityFiles.forEach(file => {
        checks.push({
            name: file.name,
            passed: checkFileExists(file.path),
            details: file.path
        });
    });

    results.push({ category, checks });
}

function verifyDocumentation() {
    const category = 'Documentation';
    const checks = [];

    const docs = [
        { name: 'Integration Guide', path: 'lib/documentation/INTEGRATION_GUIDE.md' },
        { name: 'Hook System README', path: 'lib/documentation/HOOK_SYSTEM_README.md' },
        { name: 'Migration Quick Start', path: 'MIGRATION_TOOL_QUICK_START.md' },
    ];

    docs.forEach(doc => {
        checks.push({
            name: doc.name,
            passed: checkFileExists(doc.path),
            details: doc.path
        });
    });

    results.push({ category, checks });
}

function printResults() {
    console.log('\n' + '='.repeat(70));
    console.log('📋 Dual Documentation System - Integration Setup Verification');
    console.log('='.repeat(70) + '\n');

    let totalChecks = 0;
    let passedChecks = 0;

    results.forEach(result => {
        console.log(`\n${result.category}`);
        console.log('-'.repeat(70));

        result.checks.forEach(check => {
            totalChecks++;
            if (check.passed) passedChecks++;

            const status = check.passed ? '✅' : '❌';
            console.log(`${status} ${check.name}`);
            if (check.details) {
                console.log(`   ${check.details}`);
            }
        });
    });

    console.log('\n' + '='.repeat(70));
    console.log('📊 Summary');
    console.log('='.repeat(70));
    console.log(`Total Checks: ${totalChecks}`);
    console.log(`✅ Passed: ${passedChecks}`);
    console.log(`❌ Failed: ${totalChecks - passedChecks}`);
    console.log(`Success Rate: ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);
    console.log('='.repeat(70) + '\n');

    if (passedChecks === totalChecks) {
        console.log('✅ All components are properly set up!');
        console.log('\nNext steps:');
        console.log('1. Ensure database is running');
        console.log('2. Run database migrations: npx prisma migrate deploy');
        console.log('3. Start development server: npm run dev');
        console.log('4. Follow manual testing checklist: TASK_17_INTEGRATION_TESTING_CHECKLIST.md');
    } else {
        console.log('❌ Some components are missing. Please review the failed checks above.');
    }
}

// Run all verifications
console.log('🔍 Verifying dual documentation system setup...\n');

verifyFileStructure();
verifyServiceFiles();
verifyMigrationTools();
verifyUIComponents();
verifyAPIEndpoints();
verifyErrorHandling();
verifySecurity();
verifyDocumentation();

printResults();
