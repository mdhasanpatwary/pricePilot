#!/usr/bin/env ts-node
/**
 * Manual Cache Warming Script
 * 
 * Warms cache for all active tenants or a specific tenant.
 * Can be run manually or scheduled via cron.
 * 
 * Requirements: 3.3
 * 
 * Usage:
 *   # Warm cache for all tenants
 *   ts-node scripts/warm-cache.ts
 * 
 *   # Warm cache for specific tenant
 *   ts-node scripts/warm-cache.ts --tenant-id=<tenant-id>
 * 
 *   # Dry run (show what would be warmed)
 *   ts-node scripts/warm-cache.ts --dry-run
 */

import { cacheWarmingService } from '@/lib/services/cache-warming';
import { prisma } from '@/lib/prisma';

interface Options {
    tenantId?: string;
    dryRun: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): Options {
    const args = process.argv.slice(2);
    const options: Options = {
        dryRun: false
    };

    for (const arg of args) {
        if (arg.startsWith('--tenant-id=')) {
            options.tenantId = arg.split('=')[1];
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Manual Cache Warming Script

Usage:
  ts-node scripts/warm-cache.ts [options]

Options:
  --tenant-id=<id>    Warm cache for specific tenant only
  --dry-run           Show what would be warmed without actually warming
  --help, -h          Show this help message

Examples:
  # Warm cache for all tenants
  ts-node scripts/warm-cache.ts

  # Warm cache for specific tenant
  ts-node scripts/warm-cache.ts --tenant-id=tenant_123

  # Dry run
  ts-node scripts/warm-cache.ts --dry-run
            `);
            process.exit(0);
        }
    }

    return options;
}

/**
 * Get active tenants for warming
 */
async function getActiveTenants(tenantId?: string): Promise<Array<{ id: string; name: string }>> {
    if (tenantId) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, companyName: true }
        });

        if (!tenant) {
            throw new Error(`Tenant not found: ${tenantId}`);
        }

        return [{ id: tenant.id, name: tenant.companyName }];
    }

    // Get tenants with recent activity (products updated in last 7 days)
    const tenants = await prisma.tenant.findMany({
        where: {
            products: {
                some: {
                    updatedAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            }
        },
        select: {
            id: true,
            companyName: true
        }
    });

    return tenants.map(t => ({ id: t.id, name: t.companyName }));
}

/**
 * Main execution
 */
async function main() {
    const options = parseArgs();

    console.log('='.repeat(80));
    console.log('Cache Warming Script');
    console.log('='.repeat(80));
    console.log();

    if (options.dryRun) {
        console.log('🔍 DRY RUN MODE - No actual warming will occur');
        console.log();
    }

    try {
        // Get tenants to warm
        const tenants = await getActiveTenants(options.tenantId);

        if (tenants.length === 0) {
            console.log('⚠️  No active tenants found');
            return;
        }

        console.log(`📊 Found ${tenants.length} tenant(s) to warm:`);
        for (const tenant of tenants) {
            console.log(`   - ${tenant.name} (${tenant.id})`);
        }
        console.log();

        if (options.dryRun) {
            console.log('✅ Dry run complete - no changes made');
            return;
        }

        // Warm cache for each tenant
        console.log('🔥 Starting cache warming...');
        console.log();

        let successCount = 0;
        let failureCount = 0;

        for (const tenant of tenants) {
            const startTime = Date.now();
            console.log(`[${new Date().toISOString()}] Warming cache for ${tenant.name}...`);

            try {
                await cacheWarmingService.warmTenantCache(tenant.id);
                const duration = Date.now() - startTime;
                console.log(`   ✓ Completed in ${duration}ms`);
                successCount++;
            } catch (error) {
                const duration = Date.now() - startTime;
                console.error(`   ✗ Failed after ${duration}ms:`, error instanceof Error ? error.message : String(error));
                failureCount++;
            }

            console.log();
        }

        // Summary
        console.log('='.repeat(80));
        console.log('Cache Warming Summary');
        console.log('='.repeat(80));
        console.log(`Total tenants: ${tenants.length}`);
        console.log(`Successful: ${successCount}`);
        console.log(`Failed: ${failureCount}`);
        console.log();

        if (failureCount > 0) {
            console.log('⚠️  Some cache warming operations failed. Check logs for details.');
            process.exit(1);
        } else {
            console.log('✅ All cache warming operations completed successfully');
        }
    } catch (error) {
        console.error('❌ Cache warming failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
