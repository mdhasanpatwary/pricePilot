#!/usr/bin/env tsx

/**
 * Script to verify enhanced indexes were created successfully
 * Task 15: Create enhanced indexes for existing tables
 */

import { prisma } from '@/lib/prisma';

interface IndexInfo {
    schemaname: string;
    tablename: string;
    indexname: string;
    indexdef: string;
}

interface IndexStats {
    indexname: string;
    tablename: string;
    index_size: string;
    idx_scan: bigint;
    idx_tup_read: bigint;
    idx_tup_fetch: bigint;
}

const EXPECTED_INDEXES = [
    'idx_product_tenant_status_price',
    'idx_product_last_crawled',
    'idx_product_competitor_scraped',
    'idx_product_competitor_sku',
    'idx_product_match_user_status',
    'idx_product_match_competitor_status',
    'idx_product_match_active',
    'idx_price_history_product_recorded',
    'idx_price_history_tenant_recorded',
    'idx_audit_log_tenant_created',
    'idx_audit_log_entity',
    'idx_audit_log_user_created',
    'idx_price_update_product_executed',
    'idx_price_update_status_executed',
    'idx_site_tenant_type_sync',
    'idx_product_brand_model_tenant',
    'idx_product_category_price_tenant',
    'idx_notification_tenant_read_created',
    'idx_session_expires',
];

async function getIndexInfo(indexName: string): Promise<IndexInfo | null> {
    try {
        const result = await prisma.$queryRaw<IndexInfo[]>`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE indexname = ${indexName}
    `;

        return result[0] || null;
    } catch (error) {
        console.error(`Error getting info for ${indexName}:`, error);
        return null;
    }
}

async function getIndexStats(indexName: string): Promise<IndexStats | null> {
    try {
        const result = await prisma.$queryRaw<IndexStats[]>`
      SELECT 
        indexrelname as indexname,
        relname as tablename,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE indexrelname = ${indexName}
    `;

        return result[0] || null;
    } catch (error) {
        console.error(`Error getting stats for ${indexName}:`, error);
        return null;
    }
}

async function checkIndexConcurrency(indexName: string): Promise<boolean> {
    try {
        const result = await prisma.$queryRaw<Array<{ is_valid: boolean }>>`
      SELECT 
        indisvalid as is_valid
      FROM pg_index
      WHERE indexrelid = ${indexName}::regclass
    `;

        return result[0]?.is_valid || false;
    } catch (error) {
        return false;
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('Enhanced Index Verification');
    console.log('Task 15: Create enhanced indexes for existing tables');
    console.log('='.repeat(70));
    console.log();

    let foundCount = 0;
    let missingCount = 0;
    let invalidCount = 0;

    console.log('Checking indexes...\n');

    for (const indexName of EXPECTED_INDEXES) {
        const info = await getIndexInfo(indexName);

        if (!info) {
            console.log(`✗ ${indexName}: NOT FOUND`);
            missingCount++;
            continue;
        }

        const stats = await getIndexStats(indexName);
        const isValid = await checkIndexConcurrency(indexName);

        if (!isValid) {
            console.log(`⚠ ${indexName}: INVALID (may still be building)`);
            invalidCount++;
            continue;
        }

        foundCount++;
        console.log(`✓ ${indexName}`);
        console.log(`  Table: ${info.tablename}`);
        console.log(`  Size: ${stats?.index_size || 'unknown'}`);
        console.log(`  Scans: ${stats?.idx_scan || 0}`);
        console.log();
    }

    console.log('='.repeat(70));
    console.log('Verification Summary');
    console.log('='.repeat(70));
    console.log(`Total expected: ${EXPECTED_INDEXES.length}`);
    console.log(`Found and valid: ${foundCount}`);
    console.log(`Missing: ${missingCount}`);
    console.log(`Invalid/Building: ${invalidCount}`);
    console.log();

    if (missingCount > 0) {
        console.log('⚠ Some indexes are missing. Run create-enhanced-indexes.ts');
    }

    if (invalidCount > 0) {
        console.log('⚠ Some indexes are still building. Check again later.');
    }

    if (foundCount === EXPECTED_INDEXES.length) {
        console.log('✓ All enhanced indexes are present and valid!');
    }

    console.log();

    // Get overall index statistics
    console.log('='.repeat(70));
    console.log('Overall Index Statistics');
    console.log('='.repeat(70));

    const totalStats = await prisma.$queryRaw<
        Array<{
            total_indexes: bigint;
            total_size: string;
            avg_scans: number;
        }>
    >`
    SELECT 
      COUNT(*) as total_indexes,
      pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_size,
      AVG(idx_scan)::int as avg_scans
    FROM pg_stat_user_indexes
    WHERE indexrelname LIKE 'idx_%'
  `;

    if (totalStats[0]) {
        console.log(`Total indexes: ${totalStats[0].total_indexes}`);
        console.log(`Total size: ${totalStats[0].total_size}`);
        console.log(`Average scans: ${totalStats[0].avg_scans}`);
    }

    console.log();
    console.log('='.repeat(70));

    if (missingCount > 0 || invalidCount > 0) {
        process.exit(1);
    }
}

main()
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
