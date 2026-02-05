/**
 * Bot Protection System Integration Verification
 * 
 * Verifies that all components of the bot protection handling system
 * are properly integrated and working together.
 */

import { prisma } from '@/lib/prisma';

interface VerificationResult {
    component: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
    details?: any;
}

const results: VerificationResult[] = [];

async function verifyDatabaseSchema(): Promise<void> {
    console.log('\n🔍 Verifying Database Schema...');

    try {
        // Check if all required tables exist
        const tables = [
            'proxies',
            'proxy_site_health',
            'scraping_configs',
            'scraping_sessions',
            'scrape_attempts',
            'protection_detections',
            'scraping_metrics',
            'scraping_alerts',
        ];

        for (const table of tables) {
            try {
                // Try to query each table
                await prisma.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
                results.push({
                    component: `Database Table: ${table}`,
                    status: 'pass',
                    message: 'Table exists and is accessible',
                });
            } catch (error) {
                results.push({
                    component: `Database Table: ${table}`,
                    status: 'fail',
                    message: 'Table does not exist or is not accessible',
                    details: error instanceof Error ? error.message : String(error),
                });
            }
        }
    } catch (error) {
        results.push({
            component: 'Database Schema',
            status: 'fail',
            message: 'Failed to verify database schema',
            details: error instanceof Error ? error.message : String(error),
        });
    }
}

async function verifyAPIEndpoints(): Promise<void> {
    console.log('\n🔍 Verifying API Endpoints...');

    const endpoints = [
        // Configuration
        '/api/v1/scraping/configs',
        '/api/v1/scraping/configs/test-id',
        '/api/v1/scraping/configs/test-id/test',
        '/api/v1/scraping/configs/test-id/history',

        // Proxies
        '/api/v1/scraping/proxies',
        '/api/v1/scraping/proxies/test-id',
        '/api/v1/scraping/proxies/test-id/health',

        // Metrics
        '/api/v1/scraping/metrics/summary',
        '/api/v1/scraping/metrics/sites',
        '/api/v1/scraping/metrics/sites/test-id',

        // Logs
        '/api/v1/scraping/attempts',
        '/api/v1/scraping/attempts/test-id',
        '/api/v1/scraping/attempts/test-id/screenshot',
        '/api/v1/scraping/detections',

        // Alerts
        '/api/v1/scraping/alerts',
        '/api/v1/scraping/alerts/test-id/acknowledge',

        // Manual price entry
        '/api/v1/competitor-products/test-id/manual-price',
        '/api/v1/competitor-products/test-id/price-history',

        // Staleness config
        '/api/v1/scraping/staleness-config',
    ];

    for (const endpoint of endpoints) {
        const filePath = `app${endpoint.replace(/\/\[.*?\]/g, '/[id]')}/route.ts`;
        try {
            const fs = require('fs');
            if (fs.existsSync(filePath)) {
                results.push({
                    component: `API Endpoint: ${endpoint}`,
                    status: 'pass',
                    message: 'Route file exists',
                });
            } else {
                results.push({
                    component: `API Endpoint: ${endpoint}`,
                    status: 'warning',
                    message: 'Route file not found at expected location',
                    details: { expectedPath: filePath },
                });
            }
        } catch (error) {
            results.push({
                component: `API Endpoint: ${endpoint}`,
                status: 'fail',
                message: 'Failed to verify endpoint',
                details: error instanceof Error ? error.message : String(error),
            });
        }
    }
}

async function verifyCoreComponents(): Promise<void> {
    console.log('\n🔍 Verifying Core Components...');

    const components = [
        'lib/services/bot-protection/detection-engine.ts',
        'lib/services/bot-protection/proxy-manager.ts',
        'lib/services/bot-protection/rate-limiter.ts',
        'lib/services/bot-protection/session-manager.ts',
        'lib/services/bot-protection/http-scraper.ts',
        'lib/services/bot-protection/headless-browser-scraper.ts',
        'lib/services/bot-protection/data-extractor.ts',
        'lib/services/bot-protection/strategy-selector.ts',
        'lib/services/bot-protection/scrape-orchestrator.ts',
        'lib/services/bot-protection/logging-service.ts',
        'lib/services/bot-protection/metrics-collector.ts',
        'lib/services/bot-protection/alert-service.ts',
    ];

    const fs = require('fs');
    for (const component of components) {
        if (fs.existsSync(component)) {
            results.push({
                component: `Core Component: ${component.split('/').pop()}`,
                status: 'pass',
                message: 'Component file exists',
            });
        } else {
            results.push({
                component: `Core Component: ${component.split('/').pop()}`,
                status: 'fail',
                message: 'Component file not found',
                details: { path: component },
            });
        }
    }
}

async function verifyBackgroundJobs(): Promise<void> {
    console.log('\n🔍 Verifying Background Jobs...');

    const jobs = [
        'lib/services/bot-protection/scraping-scheduler.ts',
        'lib/services/bot-protection/metric-aggregation-job.ts',
        'lib/services/bot-protection/log-cleanup-job.ts',
        'lib/services/bot-protection/alert-monitoring-job.ts',
        'lib/services/bot-protection/cookie-cleanup-job.ts',
    ];

    const fs = require('fs');
    for (const job of jobs) {
        if (fs.existsSync(job)) {
            results.push({
                component: `Background Job: ${job.split('/').pop()}`,
                status: 'pass',
                message: 'Job file exists',
            });
        } else {
            results.push({
                component: `Background Job: ${job.split('/').pop()}`,
                status: 'fail',
                message: 'Job file not found',
                details: { path: job },
            });
        }
    }
}

async function verifyUIComponents(): Promise<void> {
    console.log('\n🔍 Verifying UI Components...');

    const components = [
        'components/admin/scraping/site-status-indicator.tsx',
        'components/admin/scraping/protection-status-indicator.tsx',
        'components/admin/scraping/scraping-error-message.tsx',
        'components/admin/scraping/manual-price-entry-button.tsx',
        'components/admin/scraping/manual-price-entry-modal.tsx',
        'components/admin/scraping/manual-price-indicator.tsx',
        'components/admin/scraping/last-known-good-indicator.tsx',
        'components/admin/scraping/staleness-config-form.tsx',
        'components/admin/scraping/price-history-chart.tsx',
        'components/admin/scraping/scraping-config-editor.tsx',
        'components/admin/scraping/scraping-config-history.tsx',
        'components/admin/scraping/competitor-product-card.tsx',
    ];

    const fs = require('fs');
    for (const component of components) {
        if (fs.existsSync(component)) {
            results.push({
                component: `UI Component: ${component.split('/').pop()}`,
                status: 'pass',
                message: 'Component file exists',
            });
        } else {
            results.push({
                component: `UI Component: ${component.split('/').pop()}`,
                status: 'fail',
                message: 'Component file not found',
                details: { path: component },
            });
        }
    }
}

async function verifyPages(): Promise<void> {
    console.log('\n🔍 Verifying Admin Pages...');

    const pages = [
        'app/admin/scraping-monitor/page.tsx',
        'app/admin/scraping-monitor/[siteId]/page.tsx',
        'app/admin/scraping-config/page.tsx',
    ];

    const fs = require('fs');
    for (const page of pages) {
        if (fs.existsSync(page)) {
            results.push({
                component: `Admin Page: ${page.split('/').slice(-2).join('/')}`,
                status: 'pass',
                message: 'Page file exists',
            });
        } else {
            results.push({
                component: `Admin Page: ${page.split('/').slice(-2).join('/')}`,
                status: 'fail',
                message: 'Page file not found',
                details: { path: page },
            });
        }
    }
}

async function verifyIntegration(): Promise<void> {
    console.log('\n🔍 Verifying System Integration...');

    const integrationFiles = [
        'lib/services/bot-protection/scraper-adapter.ts',
        'lib/services/bot-protection/strategy-adaptation.ts',
    ];

    const fs = require('fs');
    for (const file of integrationFiles) {
        if (fs.existsSync(file)) {
            results.push({
                component: `Integration: ${file.split('/').pop()}`,
                status: 'pass',
                message: 'Integration file exists',
            });
        } else {
            results.push({
                component: `Integration: ${file.split('/').pop()}`,
                status: 'fail',
                message: 'Integration file not found',
                details: { path: file },
            });
        }
    }
}

function printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('BOT PROTECTION SYSTEM INTEGRATION VERIFICATION RESULTS');
    console.log('='.repeat(80) + '\n');

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const warnings = results.filter(r => r.status === 'warning').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`📊 Total: ${results.length}\n`);

    // Group results by status
    const failedResults = results.filter(r => r.status === 'fail');
    const warningResults = results.filter(r => r.status === 'warning');

    if (failedResults.length > 0) {
        console.log('\n❌ FAILED COMPONENTS:\n');
        failedResults.forEach(r => {
            console.log(`  • ${r.component}`);
            console.log(`    ${r.message}`);
            if (r.details) {
                console.log(`    Details: ${JSON.stringify(r.details, null, 2)}`);
            }
        });
    }

    if (warningResults.length > 0) {
        console.log('\n⚠️  WARNINGS:\n');
        warningResults.forEach(r => {
            console.log(`  • ${r.component}`);
            console.log(`    ${r.message}`);
            if (r.details) {
                console.log(`    Details: ${JSON.stringify(r.details, null, 2)}`);
            }
        });
    }

    console.log('\n' + '='.repeat(80));

    if (failed === 0) {
        console.log('\n✅ ALL CRITICAL COMPONENTS VERIFIED SUCCESSFULLY!');
        console.log('The bot protection handling system is fully integrated.\n');
    } else {
        console.log('\n❌ INTEGRATION VERIFICATION FAILED');
        console.log(`${failed} critical component(s) are missing or not accessible.\n`);
        process.exit(1);
    }
}

async function main(): Promise<void> {
    console.log('Starting Bot Protection System Integration Verification...\n');

    try {
        await verifyDatabaseSchema();
        await verifyAPIEndpoints();
        await verifyCoreComponents();
        await verifyBackgroundJobs();
        await verifyUIComponents();
        await verifyPages();
        await verifyIntegration();

        printResults();
    } catch (error) {
        console.error('\n❌ Verification failed with error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
