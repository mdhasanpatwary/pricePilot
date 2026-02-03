#!/usr/bin/env tsx

/**
 * Apply Performance Indexes Migration
 * 
 * This script applies the performance indexes migration to improve
 * query performance across the application.
 * 
 * Task: 8.2 Add database indexes
 * Requirements: 2.9.1
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface IndexInfo {
    schemaname: string;
    tablename: string;
    indexname: string;
    indexdef: string;
}

interface IndexStats {
    schemaname: string;
    tablename: string;
    indexname: string;
    idx_scan: bigint;
    idx_tup_read: bigint;
    idx_tup_fetch: bigint;
}

async function applyMigration() {
    console.log('🚀 Starting performance indexes migration...\n');

    try {
        // Read the migration file
        const migrationPath = join(process.cwd(), 'prisma/migrations/add_performance_indexes.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf-8');

        // Split the SQL into individual statements
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => {
                // Filter out comments and empty statements
                return s.length > 0 &&
                    !s.startsWith('--') &&
                    !s.startsWith('/*') &&
                    s.toLowerCase().includes('create index');
            });

        console.log(`📝 Found ${statements.length} index creation statements\n`);

        // Execute each statement
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i] + ';';

            // Extract index name for logging
            const indexNameMatch = statement.match(/idx_\w+/);
            const indexName = indexNameMatch ? indexNameMatch[0] : `statement ${i + 1}`;

            try {
                console.log(`⏳ Creating index: ${indexName}...`);
                await prisma.$executeRawUnsafe(statement);
                successCount++;
                console.log(`✅ Created: ${indexName}\n`);
            } catch (error: any) {
                if (error.message?.includes('already exists')) {
                    skipCount++;
                    console.log(`⏭️  Skipped (already exists): ${indexName}\n`);
                } else {
                    errorCount++;
                    console.error(`❌ Error creating ${indexName}:`, error.message, '\n');
                }
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Migration Summary:');
        console.log('='.repeat(60));
        console.log(`✅ Successfully created: ${successCount} indexes`);
        console.log(`⏭️  Skipped (existing):  ${skipCount} indexes`);
        console.log(`❌ Errors:              ${errorCount} indexes`);
        console.log('='.repeat(60) + '\n');

        // Verify indexes were created
        await verifyIndexes();

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

async function verifyIndexes() {
    console.log('🔍 Verifying created indexes...\n');

    try {
        // Get all indexes starting with idx_
        const indexes = await prisma.$queryRaw<IndexInfo[]>`
      SELECT schemaname, tablename, indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `;

        console.log(`📋 Found ${indexes.length} performance indexes in the database\n`);

        // Group by table
        const indexesByTable = indexes.reduce((acc, idx) => {
            if (!acc[idx.tablename]) {
                acc[idx.tablename] = [];
            }
            acc[idx.tablename].push(idx);
            return acc;
        }, {} as Record<string, IndexInfo[]>);

        // Display indexes by table
        console.log('📊 Indexes by Table:');
        console.log('='.repeat(60));

        for (const [tableName, tableIndexes] of Object.entries(indexesByTable)) {
            console.log(`\n${tableName} (${tableIndexes.length} indexes):`);
            tableIndexes.forEach(idx => {
                console.log(`  - ${idx.indexname}`);
            });
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Get index usage statistics
        console.log('📈 Index Usage Statistics (Top 10):');
        console.log('='.repeat(60));

        const stats = await prisma.$queryRaw<IndexStats[]>`
      SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%'
      ORDER BY idx_scan DESC
      LIMIT 10
    `;

        if (stats.length > 0) {
            console.log('\nMost Used Indexes:');
            stats.forEach((stat, i) => {
                console.log(`${i + 1}. ${stat.indexname} (${stat.tablename})`);
                console.log(`   Scans: ${stat.idx_scan}, Tuples Read: ${stat.idx_tup_read}, Tuples Fetched: ${stat.idx_tup_fetch}`);
            });
        } else {
            console.log('\n⚠️  No usage statistics available yet (indexes just created)');
        }

        console.log('\n' + '='.repeat(60) + '\n');

    } catch (error) {
        console.error('❌ Verification failed:', error);
        throw error;
    }
}

async function checkIndexSize() {
    console.log('💾 Checking index sizes...\n');

    try {
        interface IndexSize {
            tablename: string;
            indexname: string;
            size: string;
        }

        const sizes = await prisma.$queryRaw<IndexSize[]>`
      SELECT 
        schemaname || '.' || tablename as tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%'
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 20
    `;

        console.log('📊 Largest Indexes:');
        console.log('='.repeat(60));

        sizes.forEach((size, i) => {
            console.log(`${i + 1}. ${size.indexname} (${size.tablename}): ${size.size}`);
        });

        console.log('\n' + '='.repeat(60) + '\n');

    } catch (error) {
        console.error('❌ Size check failed:', error);
    }
}

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('🗄️  Performance Indexes Migration');
    console.log('='.repeat(60) + '\n');

    try {
        await applyMigration();
        await checkIndexSize();

        console.log('✅ Migration completed successfully!\n');
        console.log('💡 Tips:');
        console.log('  - Monitor index usage with: SELECT * FROM pg_stat_user_indexes;');
        console.log('  - Check slow queries with: SELECT * FROM pg_stat_statements;');
        console.log('  - Analyze query plans with: EXPLAIN ANALYZE <query>;');
        console.log('\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
