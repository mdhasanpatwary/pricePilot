/**
 * Documentation Migration Script
 * 
 * Migrates all existing documentation files to the new dual-portal structure.
 * 
 * Usage:
 *   npx tsx scripts/migrate-documentation.ts [--dry-run]
 */

import { documentAnalyzer } from '@/lib/documentation/migration/analyzer';
import { documentMigrator } from '@/lib/documentation/migration/migrator';
import fs from 'fs/promises';
import path from 'path';

async function main() {
    const isDryRun = process.argv.includes('--dry-run');

    console.log('📦 Documentation Migration Tool');
    console.log('');

    if (isDryRun) {
        console.log('🔍 DRY RUN MODE - No files will be modified');
        console.log('');
    }

    try {
        // Step 1: Analyze documents
        console.log('Step 1: Analyzing documentation files...');
        const analysisReport = await documentAnalyzer.analyzeAllDocuments();
        console.log(`✅ Analyzed ${analysisReport.totalDocuments} documents`);
        console.log('');

        // Show summary
        console.log('Classification Summary:');
        console.log(`  Tenant: ${analysisReport.tenantDocs}`);
        console.log(`  Admin: ${analysisReport.adminDocs}`);
        console.log(`  Both: ${analysisReport.bothDocs}`);
        console.log('');

        if (isDryRun) {
            console.log('Dry run complete. Run without --dry-run to perform migration.');
            return;
        }

        // Step 2: Confirm migration
        console.log('⚠️  This will migrate all documentation files to the new structure.');
        console.log('');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('');

        // Step 3: Migrate documents
        console.log('Step 2: Migrating documents...');
        const migrationReport = await documentMigrator.migrateDocuments(analysisReport.analyses);
        console.log(`✅ Migration complete!`);
        console.log('');

        // Show migration summary
        console.log('Migration Summary:');
        console.log(`  Total Documents: ${migrationReport.totalDocuments}`);
        console.log(`  Successful: ${migrationReport.successfulMigrations}`);
        console.log(`  Failed: ${migrationReport.failedMigrations}`);
        console.log(`  Tenant Docs: ${migrationReport.tenantDocs}`);
        console.log(`  Admin Docs: ${migrationReport.adminDocs}`);
        console.log(`  Split Docs: ${migrationReport.splitDocs}`);
        console.log('');

        // Save migration report
        const reportText = documentMigrator.generateReport(migrationReport);
        const reportPath = path.join(process.cwd(), 'DOCUMENTATION_MIGRATION_REPORT.md');
        await fs.writeFile(reportPath, reportText, 'utf-8');
        console.log(`📄 Full report saved to: ${reportPath}`);
        console.log('');

        if (migrationReport.errors.length > 0) {
            console.log('⚠️  Errors encountered:');
            for (const error of migrationReport.errors) {
                console.log(`  - ${error}`);
            }
            console.log('');
        }

        console.log('Next steps:');
        console.log('  1. Review migrated files in docs-content/tenant/ and docs-content/admin/');
        console.log('  2. Verify frontmatter metadata is correct');
        console.log('  3. Run redirect generation script');
        console.log('  4. Update internal links');

    } catch (error) {
        console.error('❌ Error during migration:', error);
        process.exit(1);
    }
}

main();
