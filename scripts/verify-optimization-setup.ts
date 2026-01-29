/**
 * Verify Database Optimization Setup
 * 
 * This script verifies that all components of the database optimization
 * infrastructure are properly set up and configured.
 * 
 * Usage: npx tsx scripts/verify-optimization-setup.ts
 */

import { prisma } from '@/lib/prisma';

interface VerificationResult {
    component: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
}

const results: VerificationResult[] = [];

async function verifyExtensions() {
    console.log('1. Checking PostgreSQL extensions...');

    try {
        const extensions = await prisma.$queryRaw<Array<{ extname: string; extversion: string }>>`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname IN ('pg_stat_statements', 'pgstattuple')
    `;

        const extensionNames = extensions.map(e => e.extname);

        if (extensionNames.includes('pg_stat_statements')) {
            results.push({
                component: 'pg_stat_statements',
                status: 'pass',
                message: `Installed (version ${extensions.find(e => e.extname === 'pg_stat_statements')?.extversion})`,
            });
        } else {
            results.push({
                component: 'pg_stat_statements',
                status: 'fail',
                message: 'Not installed - required for query monitoring',
            });
        }

        if (extensionNames.includes('pgstattuple')) {
            results.push({
                component: 'pgstattuple',
                status: 'pass',
                message: `Installed (version ${extensions.find(e => e.extname === 'pgstattuple')?.extversion})`,
            });
        } else {
            results.push({
                component: 'pgstattuple',
                status: 'fail',
                message: 'Not installed - required for bloat analysis',
            });
        }
    } catch (error) {
        results.push({
            component: 'Extensions',
            status: 'fail',
            message: `Error checking extensions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
    }
}

async function verifyTables() {
    console.log('2. Checking optimization tables...');

    const requiredTables = ['SlowQuery', 'QueryPerformanceMetric', 'IndexRecommendation'];

    try {
        const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN ('SlowQuery', 'QueryPerformanceMetric', 'IndexRecommendation')
    `;

        const tableNames = tables.map(t => t.tablename);

        for (const tableName of requiredTables) {
            if (tableNames.includes(tableName)) {
                results.push({
                    component: `Table: ${tableName}`,
                    status: 'pass',
                    message: 'Table exists',
                });
            } else {
                results.push({
                    component: `Table: ${tableName}`,
                    status: 'fail',
                    message: 'Table not found - run migrations',
                });
            }
        }
    } catch (error) {
        results.push({
            component: 'Tables',
            status: 'fail',
            message: `Error checking tables: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
    }
}

async function verifyIndexes() {
    console.log('3. Checking table indexes...');

    try {
        const indexes = await prisma.$queryRaw<Array<{ tablename: string; indexname: string }>>`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename IN ('SlowQuery', 'QueryPerformanceMetric', 'IndexRecommendation')
      ORDER BY tablename, indexname
    `;

        const indexCount = indexes.length;

        if (indexCount > 0) {
            results.push({
                component: 'Indexes',
                status: 'pass',
                message: `${indexCount} indexes found on optimization tables`,
            });
        } else {
            results.push({
                component: 'Indexes',
                status: 'warning',
                message: 'No indexes found - may impact performance',
            });
        }
    } catch (error) {
        results.push({
            component: 'Indexes',
            status: 'fail',
            message: `Error checking indexes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
    }
}

async function verifyConnectionPool() {
    console.log('4. Checking connection pool configuration...');

    try {
        // Check environment variables
        const dbUrl = process.env.DATABASE_URL;
        const poolMin = process.env.DB_POOL_MIN || '10';
        const poolMax = process.env.DB_POOL_MAX || '50';

        if (dbUrl) {
            results.push({
                component: 'DATABASE_URL',
                status: 'pass',
                message: 'Environment variable set',
            });
        } else {
            results.push({
                component: 'DATABASE_URL',
                status: 'fail',
                message: 'Environment variable not set',
            });
        }

        results.push({
            component: 'Connection Pool',
            status: 'pass',
            message: `Configured: min=${poolMin}, max=${poolMax}`,
        });

        // Test connection
        await prisma.$queryRaw`SELECT 1`;
        results.push({
            component: 'Database Connection',
            status: 'pass',
            message: 'Successfully connected to database',
        });
    } catch (error) {
        results.push({
            component: 'Database Connection',
            status: 'fail',
            message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
    }
}

async function verifyPgStatStatements() {
    console.log('5. Checking pg_stat_statements configuration...');

    try {
        const config = await prisma.$queryRaw<Array<{ name: string; setting: string }>>`
      SELECT name, setting 
      FROM pg_settings 
      WHERE name LIKE 'pg_stat_statements%'
    `;

        if (config.length > 0) {
            const maxSetting = config.find(c => c.name === 'pg_stat_statements.max');
            const trackSetting = config.find(c => c.name === 'pg_stat_statements.track');

            results.push({
                component: 'pg_stat_statements.max',
                status: maxSetting ? 'pass' : 'warning',
                message: maxSetting ? `Set to ${maxSetting.setting}` : 'Not configured',
            });

            results.push({
                component: 'pg_stat_statements.track',
                status: trackSetting ? 'pass' : 'warning',
                message: trackSetting ? `Set to ${trackSetting.setting}` : 'Not configured',
            });
        } else {
            results.push({
                component: 'pg_stat_statements config',
                status: 'warning',
                message: 'Configuration not found - may need superuser access',
            });
        }
    } catch (error) {
        results.push({
            component: 'pg_stat_statements config',
            status: 'warning',
            message: 'Could not check configuration',
        });
    }
}

function printResults() {
    console.log('\n' + '='.repeat(80));
    console.log('DATABASE OPTIMIZATION SETUP VERIFICATION RESULTS');
    console.log('='.repeat(80) + '\n');

    const passCount = results.filter(r => r.status === 'pass').length;
    const failCount = results.filter(r => r.status === 'fail').length;
    const warningCount = results.filter(r => r.status === 'warning').length;

    results.forEach(result => {
        const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
        const color = result.status === 'pass' ? '\x1b[32m' : result.status === 'fail' ? '\x1b[31m' : '\x1b[33m';
        const reset = '\x1b[0m';

        console.log(`${color}${icon}${reset} ${result.component.padEnd(35)} ${result.message}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log(`Summary: ${passCount} passed, ${failCount} failed, ${warningCount} warnings`);
    console.log('='.repeat(80) + '\n');

    if (failCount > 0) {
        console.log('❌ Setup incomplete. Please address the failed checks above.');
        console.log('   See lib/database/README.md for setup instructions.\n');
        process.exit(1);
    } else if (warningCount > 0) {
        console.log('⚠️  Setup complete with warnings. Some optional features may not be available.');
        console.log('   See lib/database/README.md for optimization tips.\n');
    } else {
        console.log('✅ All checks passed! Database optimization infrastructure is ready.\n');
    }
}

async function main() {
    console.log('Verifying database optimization setup...\n');

    try {
        await verifyExtensions();
        await verifyTables();
        await verifyIndexes();
        await verifyConnectionPool();
        await verifyPgStatStatements();
    } catch (error) {
        console.error('\n❌ Verification failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }

    printResults();
}

main();
