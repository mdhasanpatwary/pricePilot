#!/usr/bin/env node
/**
 * CLI script for rotating encryption keys by re-encrypting all API tokens
 * 
 * Usage:
 *   npm run rotate-keys                    # Run key rotation
 *   npm run rotate-keys -- --dry-run       # Preview without changes
 *   npm run rotate-keys -- --batch-size=50 # Custom batch size
 *   npm run rotate-keys -- --help          # Show help
 */

import { KeyRotationUtility } from '../lib/services/encryption/key-rotation-utility';
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
Encryption Key Rotation Utility
================================

Rotates encryption keys by decrypting tokens with the old key and 
re-encrypting them with the new key.

Usage:
  npm run rotate-keys [options]

Options:
  --dry-run, -d           Preview changes without making updates
  --batch-size=N          Number of records to process at once (default: 100)
  --stop-on-error         Stop rotation if any error occurs (default: continue)
  --help, -h              Show this help message

Examples:
  npm run rotate-keys
    Run key rotation with default settings

  npm run rotate-keys -- --dry-run
    Preview what would be rotated without making changes

  npm run rotate-keys -- --batch-size=50
    Process 50 records at a time

  npm run rotate-keys -- --dry-run --batch-size=10
    Preview with smaller batch size

Environment Variables:
  ENCRYPTION_MASTER_KEY       Required. Current 256-bit encryption key (base64-encoded)
  ENCRYPTION_MASTER_KEY_NEW   Required. New 256-bit encryption key (base64-encoded)

Generate a new key:
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

Key Rotation Process:
  1. Set ENCRYPTION_MASTER_KEY_NEW with the new key
  2. Run this script to re-encrypt all tokens
  3. Update ENCRYPTION_MASTER_KEY to the new key value
  4. Remove ENCRYPTION_MASTER_KEY_NEW
  5. Restart the application
`);
}

/**
 * Main rotation function
 */
async function main(): Promise<void> {
    const options = parseArgs();

    // Show help if requested
    if (options.help) {
        showHelp();
        process.exit(0);
    }

    console.log('Encryption Key Rotation Utility');
    console.log('================================\n');

    // Verify both keys are configured
    if (!process.env.ENCRYPTION_MASTER_KEY) {
        console.error('ERROR: ENCRYPTION_MASTER_KEY environment variable is not set.');
        console.error('\nThis is the current encryption key used to decrypt existing tokens.');
        process.exit(1);
    }

    if (!process.env.ENCRYPTION_MASTER_KEY_NEW) {
        console.error('ERROR: ENCRYPTION_MASTER_KEY_NEW environment variable is not set.');
        console.error('\nThis is the new encryption key that will be used to re-encrypt tokens.');
        console.error('\nGenerate a new key using:');
        console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
        console.error('\nThen set it in your environment:');
        console.error('  export ENCRYPTION_MASTER_KEY_NEW="your-generated-key"');
        process.exit(1);
    }

    // Display configuration
    console.log('Configuration:');
    console.log(`  Dry Run:           ${options.dryRun ? 'YES (no changes will be made)' : 'NO'}`);
    console.log(`  Batch Size:        ${options.batchSize}`);
    console.log(`  Continue on Error: ${options.continueOnError ? 'YES' : 'NO'}`);
    console.log('');

    if (options.dryRun) {
        console.log('⚠️  DRY RUN MODE: No changes will be made to the database.\n');
    } else {
        console.log('⚠️  LIVE MODE: Tokens will be re-encrypted with the new key.\n');
        console.log('⚠️  WARNING: This operation cannot be easily reversed!');
        console.log('   Make sure you have a database backup before proceeding.\n');
    }

    // Confirm before proceeding in live mode
    if (!options.dryRun) {
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('');
    }

    try {
        console.log('Starting key rotation...\n');

        const rotationUtility = new KeyRotationUtility();
        const result = await rotationUtility.rotateAllTokens({
            dryRun: options.dryRun,
            batchSize: options.batchSize,
            continueOnError: options.continueOnError,
        });

        console.log('\n'); // New line after progress

        // Display report
        const report = rotationUtility.generateReport(result);
        console.log(report);

        // Display next steps if successful
        if (result.failed === 0 && !options.dryRun) {
            console.log('Next Steps:');
            console.log('===========');
            console.log('1. Update ENCRYPTION_MASTER_KEY to the new key value:');
            console.log('   export ENCRYPTION_MASTER_KEY="$ENCRYPTION_MASTER_KEY_NEW"');
            console.log('');
            console.log('2. Remove ENCRYPTION_MASTER_KEY_NEW:');
            console.log('   unset ENCRYPTION_MASTER_KEY_NEW');
            console.log('');
            console.log('3. Restart the application to use the new key.');
            console.log('');
        }

        // Exit with appropriate code
        if (result.failed > 0) {
            console.log('⚠️  Key rotation completed with errors.');
            process.exit(1);
        } else {
            console.log('✅ Key rotation completed successfully!');
            process.exit(0);
        }
    } catch (error) {
        console.error('\n❌ Key rotation failed with critical error:');
        console.error(error instanceof Error ? error.message : 'Unknown error');

        logger.error('Key rotation script failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });

        process.exit(1);
    }
}

// Run the key rotation
main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
