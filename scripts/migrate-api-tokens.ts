#!/usr/bin/env ts-node

/**
 * API Token Migration Script
 * 
 * This script migrates existing plain-text API tokens to encrypted format.
 * It performs the following steps:
 * 1. Backs up the database before migration
 * 2. Identifies all sites with unencrypted API tokens
 * 3. Encrypts each token using the encryption service
 * 4. Updates the database with encrypted tokens
 * 5. Verifies the migration by decrypting and comparing
 * 
 * Usage:
 *   npm run migrate:tokens
 *   or
 *   ts-node scripts/migrate-api-tokens.ts
 * 
 * Options:
 *   --dry-run: Preview changes without applying them
 *   --backup-only: Only create backup, don't migrate
 *   --verify-only: Only verify existing encrypted tokens
 */

import { PrismaClient } from '@prisma/client';
import { EncryptionService } from '../lib/services/encryption/encryption-service';
import { KeyManager } from '../lib/services/encryption/key-manager';
import { logger } from '../lib/logger';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isBackupOnly = args.includes('--backup-only');
const isVerifyOnly = args.includes('--verify-only');

interface MigrationStats {
    totalSites: number;
    sitesWithTokens: number;
    alreadyEncrypted: number;
    needsMigration: number;
    migrated: number;
    failed: number;
    verified: number;
    errors: Array<{ siteId: string; error: string }>;
}

/**
 * Create a database backup before migration
 */
async function createBackup(): Promise<string> {
    console.log('\n📦 Creating database backup...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups');
    const backupFile = path.join(backupDir, `pre-token-migration-${timestamp}.sql`);

    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    try {
        // Get database URL from environment
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            throw new Error('DATABASE_URL environment variable not set');
        }

        // Parse database URL
        const url = new URL(databaseUrl);
        const dbName = url.pathname.slice(1);
        const host = url.hostname;
        const port = url.port || '5432';
        const user = url.username;
        const password = url.password;

        // Create pg_dump command
        const pgDumpCmd = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${user} -d ${dbName} -F p -f "${backupFile}"`;

        console.log(`   Database: ${dbName}`);
        console.log(`   Host: ${host}:${port}`);
        console.log(`   Backup file: ${backupFile}`);

        // Execute backup
        execSync(pgDumpCmd, { stdio: 'inherit' });

        // Verify backup file exists and has content
        const stats = fs.statSync(backupFile);
        if (stats.size === 0) {
            throw new Error('Backup file is empty');
        }

        console.log(`   ✅ Backup created successfully (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`   📁 Location: ${backupFile}`);

        return backupFile;
    } catch (error) {
        console.error('   ❌ Backup failed:', error);
        throw new Error(`Database backup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Analyze sites and identify which need migration
 */
async function analyzeSites(encryptionService: EncryptionService): Promise<MigrationStats> {
    console.log('\n🔍 Analyzing sites...');

    const stats: MigrationStats = {
        totalSites: 0,
        sitesWithTokens: 0,
        alreadyEncrypted: 0,
        needsMigration: 0,
        migrated: 0,
        failed: 0,
        verified: 0,
        errors: [],
    };

    // Fetch all sites
    const sites = await prisma.site.findMany({
        select: {
            id: true,
            tenantId: true,
            type: true,
            platform: true,
            baseUrl: true,
            apiToken: true,
        },
    });

    stats.totalSites = sites.length;
    console.log(`   Total sites: ${stats.totalSites}`);

    // Analyze each site
    for (const site of sites) {
        if (site.apiToken) {
            stats.sitesWithTokens++;

            // Check if already encrypted
            if (encryptionService.isEncrypted(site.apiToken)) {
                stats.alreadyEncrypted++;
            } else {
                stats.needsMigration++;
            }
        }
    }

    console.log(`   Sites with API tokens: ${stats.sitesWithTokens}`);
    console.log(`   Already encrypted: ${stats.alreadyEncrypted}`);
    console.log(`   Need migration: ${stats.needsMigration}`);

    return stats;
}

/**
 * Migrate a single site's API token
 */
async function migrateSiteToken(
    siteId: string,
    plainToken: string,
    encryptionService: EncryptionService,
    dryRun: boolean
): Promise<{ success: boolean; error?: string }> {
    try {
        // Encrypt the token
        const encryptedToken = encryptionService.encrypt(plainToken);

        if (dryRun) {
            console.log(`   [DRY RUN] Would encrypt token for site ${siteId}`);
            return { success: true };
        }

        // Update the database
        await prisma.site.update({
            where: { id: siteId },
            data: { apiToken: encryptedToken },
        });

        // Verify the encryption by decrypting
        const decryptedToken = encryptionService.decrypt(encryptedToken);

        if (decryptedToken !== plainToken) {
            throw new Error('Decrypted token does not match original');
        }

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
}

/**
 * Perform the migration
 */
async function performMigration(
    encryptionService: EncryptionService,
    dryRun: boolean
): Promise<MigrationStats> {
    console.log(`\n🔄 ${dryRun ? 'Simulating' : 'Performing'} migration...`);

    const stats: MigrationStats = {
        totalSites: 0,
        sitesWithTokens: 0,
        alreadyEncrypted: 0,
        needsMigration: 0,
        migrated: 0,
        failed: 0,
        verified: 0,
        errors: [],
    };

    // Fetch all sites with unencrypted tokens
    const sites = await prisma.site.findMany({
        where: {
            apiToken: { not: null },
        },
        select: {
            id: true,
            tenantId: true,
            type: true,
            platform: true,
            baseUrl: true,
            apiToken: true,
        },
    });

    stats.totalSites = sites.length;

    for (const site of sites) {
        if (!site.apiToken) continue;

        stats.sitesWithTokens++;

        // Check if already encrypted
        if (encryptionService.isEncrypted(site.apiToken)) {
            stats.alreadyEncrypted++;
            console.log(`   ✓ Site ${site.id} (${site.baseUrl}) - Already encrypted`);
            continue;
        }

        stats.needsMigration++;

        // Migrate the token
        const result = await migrateSiteToken(
            site.id,
            site.apiToken,
            encryptionService,
            dryRun
        );

        if (result.success) {
            stats.migrated++;
            console.log(`   ✅ Site ${site.id} (${site.baseUrl}) - ${dryRun ? 'Would be migrated' : 'Migrated'}`);
        } else {
            stats.failed++;
            stats.errors.push({ siteId: site.id, error: result.error || 'Unknown error' });
            console.error(`   ❌ Site ${site.id} (${site.baseUrl}) - Failed: ${result.error}`);
        }
    }

    return stats;
}

/**
 * Verify all encrypted tokens can be decrypted
 */
async function verifyEncryption(encryptionService: EncryptionService): Promise<MigrationStats> {
    console.log('\n🔐 Verifying encrypted tokens...');

    const stats: MigrationStats = {
        totalSites: 0,
        sitesWithTokens: 0,
        alreadyEncrypted: 0,
        needsMigration: 0,
        migrated: 0,
        failed: 0,
        verified: 0,
        errors: [],
    };

    // Fetch all sites with tokens
    const sites = await prisma.site.findMany({
        where: {
            apiToken: { not: null },
        },
        select: {
            id: true,
            tenantId: true,
            baseUrl: true,
            apiToken: true,
        },
    });

    stats.totalSites = sites.length;
    stats.sitesWithTokens = sites.length;

    for (const site of sites) {
        if (!site.apiToken) continue;

        try {
            // Check if encrypted
            if (!encryptionService.isEncrypted(site.apiToken)) {
                stats.needsMigration++;
                console.log(`   ⚠️  Site ${site.id} (${site.baseUrl}) - Not encrypted`);
                continue;
            }

            stats.alreadyEncrypted++;

            // Try to decrypt
            const decrypted = encryptionService.decrypt(site.apiToken);

            if (decrypted && decrypted.length > 0) {
                stats.verified++;
                console.log(`   ✅ Site ${site.id} (${site.baseUrl}) - Verified`);
            } else {
                throw new Error('Decrypted token is empty');
            }
        } catch (error) {
            stats.failed++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            stats.errors.push({ siteId: site.id, error: errorMessage });
            console.error(`   ❌ Site ${site.id} (${site.baseUrl}) - Verification failed: ${errorMessage}`);
        }
    }

    return stats;
}

/**
 * Print migration summary
 */
function printSummary(stats: MigrationStats, mode: string) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 ${mode} Summary`);
    console.log('='.repeat(60));
    console.log(`Total sites: ${stats.totalSites}`);
    console.log(`Sites with API tokens: ${stats.sitesWithTokens}`);
    console.log(`Already encrypted: ${stats.alreadyEncrypted}`);
    console.log(`Need migration: ${stats.needsMigration}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`Verified: ${stats.verified}`);
    console.log(`Failed: ${stats.failed}`);

    if (stats.errors.length > 0) {
        console.log('\n❌ Errors:');
        stats.errors.forEach(({ siteId, error }) => {
            console.log(`   Site ${siteId}: ${error}`);
        });
    }

    console.log('='.repeat(60));
}

/**
 * Main migration function
 */
async function main() {
    console.log('🔐 API Token Migration Script');
    console.log('='.repeat(60));

    // Check environment variables
    if (!process.env.ENCRYPTION_KEY) {
        console.error('❌ ENCRYPTION_KEY environment variable not set');
        console.error('   Please set ENCRYPTION_KEY in your .env file');
        process.exit(1);
    }

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL environment variable not set');
        process.exit(1);
    }

    // Initialize encryption service
    const keyManager = new KeyManager();
    const encryptionService = new EncryptionService(keyManager);

    try {
        // Verify-only mode
        if (isVerifyOnly) {
            const stats = await verifyEncryption(encryptionService);
            printSummary(stats, 'Verification');

            if (stats.failed > 0) {
                console.error('\n❌ Some tokens failed verification');
                process.exit(1);
            }

            console.log('\n✅ All tokens verified successfully');
            process.exit(0);
        }

        // Analyze current state
        const analysisStats = await analyzeSites(encryptionService);

        if (analysisStats.needsMigration === 0) {
            console.log('\n✅ No migration needed - all tokens are already encrypted');
            process.exit(0);
        }

        // Create backup (unless dry-run)
        let backupFile: string | null = null;
        if (!isDryRun) {
            backupFile = await createBackup();

            if (isBackupOnly) {
                console.log('\n✅ Backup completed successfully');
                console.log('   Run without --backup-only to perform migration');
                process.exit(0);
            }
        }

        // Confirm migration (unless dry-run)
        if (!isDryRun) {
            console.log('\n⚠️  WARNING: This will modify the database');
            console.log(`   ${analysisStats.needsMigration} tokens will be encrypted`);
            console.log(`   Backup created: ${backupFile}`);
            console.log('\n   Press Ctrl+C to cancel, or wait 5 seconds to continue...');

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Perform migration
        const migrationStats = await performMigration(encryptionService, isDryRun);
        printSummary(migrationStats, isDryRun ? 'Dry Run' : 'Migration');

        if (migrationStats.failed > 0) {
            console.error('\n❌ Migration completed with errors');
            process.exit(1);
        }

        // Verify migration (unless dry-run)
        if (!isDryRun) {
            console.log('\n🔍 Verifying migration...');
            const verifyStats = await verifyEncryption(encryptionService);

            if (verifyStats.failed > 0) {
                console.error('\n❌ Verification failed - some tokens could not be decrypted');
                console.error('   Database backup available at:', backupFile);
                process.exit(1);
            }

            console.log('\n✅ Migration completed and verified successfully');
            console.log(`   ${migrationStats.migrated} tokens encrypted`);
            console.log(`   ${verifyStats.verified} tokens verified`);
        } else {
            console.log('\n✅ Dry run completed - no changes made');
            console.log('   Run without --dry-run to perform actual migration');
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        logger.error('Token migration failed', { error });
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run migration
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
