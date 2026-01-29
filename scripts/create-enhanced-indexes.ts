#!/usr/bin/env tsx

/**
 * Script to create enhanced indexes for database optimization
 * Task 15: Create enhanced indexes for existing tables
 * 
 * This script creates indexes using CREATE INDEX CONCURRENTLY to avoid
 * blocking table access during index creation.
 * 
 * Requirements: 2.1
 */

import { prisma } from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

interface IndexCreationResult {
    indexName: string;
    success: boolean;
    error?: string;
    duration?: number;
}

async function createIndexConcurrently(
    indexName: string,
    createStatement: string
): Promise<IndexCreationResult> {
    const startTime = Date.now();

    try {
        console.log(`Creating index: ${indexName}...`);

        // Execute the CREATE INDEX CONCURRENTLY statement
        // Note: This must be run outside of a transaction
        await prisma.$executeRawUnsafe(createStatement);

        const duration = Date.now() - startTime;
        console.log(`✓ Created ${indexName} in ${duration}ms`);

        return {
            indexName,
            success: true,
            duration,
        };
    } catch (error: any) {
        const duration = Date.now() - startTime;

        // Check if index already exists
        if (error.message?.includes('already exists')) {
            console.log(`⚠ Index ${indexName} already exists, skipping...`);
            return {
                indexName,
                success: true,
                duration,
            };
        }

        console.error(`✗ Failed to create ${indexName}:`, error.message);
        return {
            indexName,
            success: false,
            error: error.message,
            duration,
        };
    }
}

async function checkIndexExists(indexName: string): Promise<boolean> {
    try {
        const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = ${indexName}
      ) as exists
    `;

        return result[0]?.exists || false;
    } catch (error) {
        console.error(`Error checking index ${indexName}:`, error);
        return false;
    }
}

async function getIndexSize(indexName: string): Promise<string> {
    try {
        const result = await prisma.$queryRaw<Array<{ size: string }>>`
      SELECT pg_size_pretty(pg_relation_size(${indexName}::regclass)) as size
    `;

        return result[0]?.size || 'unknown';
    } catch (error) {
        return 'unknown';
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('Enhanced Index Creation Script');
    console.log('Task 15: Create enhanced indexes for existing tables');
    console.log('='.repeat(60));
    console.log();

    // Read the SQL migration file
    const migrationPath = path.join(
        process.cwd(),
        'prisma',
        'migrations',
        'create_enhanced_indexes.sql'
    );

    if (!fs.existsSync(migrationPath)) {
        console.error('Migration file not found:', migrationPath);
        process.exit(1);
    }

    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

    // Parse SQL statements - split by CREATE INDEX and filter
    const statements: string[] = [];
    const lines = sqlContent.split('\n');
    let currentStatement = '';

    for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip comments and empty lines
        if (trimmedLine.startsWith('--') || trimmedLine.length === 0) {
            continue;
        }

        // Start of a new CREATE INDEX statement
        if (trimmedLine.toUpperCase().includes('CREATE INDEX')) {
            if (currentStatement) {
                statements.push(currentStatement.trim());
            }
            currentStatement = line;
        } else if (currentStatement) {
            // Continue building current statement
            currentStatement += '\n' + line;
        }

        // End of statement
        if (trimmedLine.endsWith(';')) {
            if (currentStatement) {
                statements.push(currentStatement.trim());
                currentStatement = '';
            }
        }
    }

    // Add last statement if exists
    if (currentStatement) {
        statements.push(currentStatement.trim());
    }

    console.log(`Found ${statements.length} index creation statements\n`);

    const results: IndexCreationResult[] = [];
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    // Create indexes one by one
    for (const statement of statements) {
        // Extract index name from statement
        const match = statement.match(/idx_[\w_]+/);
        const indexName = match ? match[0] : 'unknown';

        // Check if index already exists
        const exists = await checkIndexExists(indexName);
        if (exists) {
            console.log(`⚠ Index ${indexName} already exists, skipping...`);
            skipCount++;
            results.push({
                indexName,
                success: true,
            });
            continue;
        }

        const result = await createIndexConcurrently(indexName, statement + ';');
        results.push(result);

        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }

        // Small delay between index creations to avoid overwhelming the database
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log();
    console.log('='.repeat(60));
    console.log('Index Creation Summary');
    console.log('='.repeat(60));
    console.log(`Total indexes: ${statements.length}`);
    console.log(`Successfully created: ${successCount}`);
    console.log(`Already existed: ${skipCount}`);
    console.log(`Failed: ${failCount}`);
    console.log();

    if (failCount > 0) {
        console.log('Failed indexes:');
        results
            .filter((r) => !r.success)
            .forEach((r) => {
                console.log(`  - ${r.indexName}: ${r.error}`);
            });
        console.log();
    }

    // Display index sizes
    console.log('Checking index sizes...');
    console.log();

    for (const result of results.filter((r) => r.success)) {
        const size = await getIndexSize(result.indexName);
        console.log(`  ${result.indexName}: ${size}`);
    }

    console.log();
    console.log('='.repeat(60));
    console.log('Index creation complete!');
    console.log('='.repeat(60));

    if (failCount > 0) {
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
