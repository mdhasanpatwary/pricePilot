#!/usr/bin/env node
/**
 * CLI script for batch migration of plaintext API tokens to encrypted format
 * 
 * Usage:
 *   npm run migrate-tokens                    # Run migration
 *   npm run migrate-tokens -- --dry-run       # Preview without changes
 *   npm run migrate-tokens -- --batch-size=50 # Custom batch size
 *   npm run migrate-tokens -- --help          # Show help
 */

import { MigrationUtility } from '../lib/services/encryption/migration-utility';
import { logger } from '../lib/logger';

/**
 * Parse command line arguments
 */
function parseArgs(): {
    dryRun: boolean;
    batchSize: number;
    continueOnError: boolean;
    help: boolean;
} {
    const args = process.argv.slice(2);

    const options = {
        dryRun: false,
        batchSize: 100,
        continueOnError: true,
        help: false,
    };

    for (const arg of args) {
        if (arg === '--dry-run' || arg === '-d') {
            options.dryRun = true;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--stop-on-error') {
            options.continueOnError = false;
        } else if (arg.startsWith('--batch-size=')) {
            const value = parseInt(arg.split('=')[1], 10);
            if (!isNaN(value) && value > 0) {
                options.batchSize = value;
            } else {
                console.error('Invalid batch size. Using default: 100');
            }
        }
    }

    return options;
}

/**
 * Display help message
 */
function showHelp(): void {
    console.log(`
API Token Migration Utility
============================

Migrates plaintext API tokens to encrypted format using AES-256-GCM.

Usage:
  npm run migrate-tokens [options]

Options:
  --dry-run, -d           Preview changes without making updates
  --batch-size=N          Number of records to process at once (default: 100)
  --stop-on-error         Stop migration if any error occurs (default: continue)
  --help, -h              Show this help message

Examples:
  npm run migrate-tokens
    Run migration with default settings

  npm run migrate-tokens -- --dry-run
    Preview what would be migrated without making changes

  npm run migrate-tokens -- --batch-size=50
    Process 50 records at a time

  npm run migrate-tokens -- --dry-run --batch-size=10
    Preview with smaller batch size

Environment Variables:
  ENCRYPTION_MASTER_KEY   Required. 256-bit encryption key (base64-encoded)

Generate a key:
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
`);
}

/**
 * Main migration function
 */
async function main(): Promise<void> {
    const options = parseArgs();

    // Show help if requested
    if (options.help) {
        showHelp();
        process.exit(0);
    }

    console.log('API Token Migration Utility');
    console.log('============================\n');

    // Verify encryption key is configured
    if (!process.env.ENCRYPTION_MASTER_KEY) {
        console.error('ERROR: ENCRYPTION_MASTER_KEY environment variable is not set.');
        console.error('\nGenerate a key using:');
        console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
        console.error('\nThen set it in your environment:');
        console.error('  export ENCRYPTION_MASTER_KEY="your-generated-key"');
        process.exit(1);
    }

    // Display configuration
    console.log('Configuration:');
    console.log(`  Dry Run:          ${options.dryRun ? 'YES (no changes will be made)' : 'NO'}`);
    console.log(`  Batch Size:       ${options.batchSize}`);
    console.log(`  Continue on Error: ${options.continueOnError ? 'YES' : 'NO'}`);
    console.log('');

    if (options.dryRun) {
        console.log('⚠️  DRY RUN MODE: No changes will be made to the database.\n');
    } else {
        console.log('⚠️  LIVE MODE: Tokens will be encrypted and updated in the database.\n');
    }

    // Confirm before proceeding in live mode
    if (!options.dryRun) {
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('');
    }

    try {
        console.log('Starting migration...\n');

        const migrationUtility = new MigrationUtility();
        const result = await migrationUtility.migrateAllTokens({
            dryRun: options.dryRun,
            batchSize: options.batchSize,
            continueOnError: options.continueOnError,
        });

        console.log('\n'); // New line after progress

        // Display report
        const report = migrationUtility.generateReport(result);
        console.log(report);

        // Exit with appropriate code
        if (result.failed > 0) {
            console.log('⚠️  Migration completed with errors.');
            process.exit(1);
        } else {
            console.log('✅ Migration completed successfully!');
            process.exit(0);
        }
    } catch (error) {
        console.error('\n❌ Migration failed with critical error:');
        console.error(error instanceof Error ? error.message : 'Unknown error');

        logger.error('Migration script failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });

        process.exit(1);
    }
}

// Run the migration
main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
