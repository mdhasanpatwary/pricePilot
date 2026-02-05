/**
 * Full Documentation Migration Script
 * 
 * Runs the complete migration process:
 * 1. Analyze documents
 * 2. Migrate files
 * 3. Generate redirects
 * 4. Validate links
 * 5. Generate comprehensive report
 * 
 * Usage:
 *   npx tsx scripts/run-full-migration.ts [--dry-run]
 */

import { documentAnalyzer } from '@/lib/documentation/migration/analyzer';
import { documentMigrator } from '@/lib/documentation/migration/migrator';
import { redirectGenerator } from '@/lib/documentation/migration/redirects';
import { migrationReporter } from '@/lib/documentation/migration/reporter';
import fs from 'fs/promises';
import path from 'path';

async function main() {
    const isDryRun = process.argv.includes('--dry-run');

    console.log('📦 Full Documentation Migration');
    console.log('================================');
    console.log('');

    if (isDryRun) {
        console.log('🔍 DRY RUN MODE - No files will be modified');
        console.log('');
    }

    try {
        // ========================================================================
        // Step 1: Analyze Documents
        // ========================================================================
        console.log('Step 1/5: Analyzing documentation files...');
        console.log('');

        const analysisReport = await documentAnalyzer.analyzeAllDocuments();

        console.log(`✅ Analyzed ${analysisReport.totalDocuments} documents`);
        console.log(`   - Tenant: ${analysisReport.tenantDocs}`);
        console.log(`   - Admin: ${analysisReport.adminDocs}`);
        console.log(`   - Both: ${analysisReport.bothDocs}`);
        console.log('');

        // Save analysis report
        const analysisReportText = documentAnalyzer.generateReport(analysisReport);
        await fs.writeFile(
            path.join(process.cwd(), 'DOCUMENTATION_ANALYSIS_REPORT.md'),
            analysisReportText,
            'utf-8'
        );

        if (isDryRun) {
            console.log('Dry run complete. Analysis report saved.');
            console.log('Run without --dry-run to perform full migration.');
            return;
        }

        // ========================================================================
        // Step 2: Confirm Migration
        // ========================================================================
        console.log('⚠️  WARNING: This will migrate all documentation files!');
        console.log('');
        console.log('This process will:');
        console.log('  - Move 104 documentation files to new structure');
        console.log('  - Split 13 documents into tenant and admin versions');
        console.log('  - Create redirects for all moved files');
        console.log('  - Update internal links');
        console.log('');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('');

        // ========================================================================
        // Step 2: Migrate Documents
        // ========================================================================
        console.log('Step 2/5: Migrating documents...');
        console.log('');

        const migrationReport = await documentMigrator.migrateDocuments(analysisReport.analyses);

        console.log(`✅ Migration complete!`);
        console.log(`   - Successful: ${migrationReport.successfulMigrations}`);
        console.log(`   - Failed: ${migrationReport.failedMigrations}`);
        console.log('');

        // Save migration report
        const migrationReportText = documentMigrator.generateReport(migrationReport);
        await fs.writeFile(
            path.join(process.cwd(), 'DOCUMENTATION_MIGRATION_REPORT.md'),
            migrationReportText,
            'utf-8'
        );

        // ========================================================================
        // Step 3: Generate Redirects
        // ========================================================================
        console.log('Step 3/5: Generating redirects...');
        console.log('');

        const redirectReport = await redirectGenerator.generateRedirects(
            analysisReport.analyses,
            migrationReport.results
        );

        console.log(`✅ Redirects generated!`);
        console.log(`   - Created: ${redirectReport.createdRedirects}`);
        console.log(`   - Skipped: ${redirectReport.skippedRedirects}`);
        console.log('');

        // Save redirect report
        const redirectReportText = redirectGenerator.generateReport(redirectReport);
        await fs.writeFile(
            path.join(process.cwd(), 'DOCUMENTATION_REDIRECT_REPORT.md'),
            redirectReportText,
            'utf-8'
        );

        // ========================================================================
        // Step 4: Generate Comprehensive Report
        // ========================================================================
        console.log('Step 4/5: Validating links and generating comprehensive report...');
        console.log('');

        const comprehensiveReport = await migrationReporter.generateComprehensiveReport(
            analysisReport,
            migrationReport,
            redirectReport
        );

        console.log(`✅ Validation complete!`);
        console.log(`   - Total Links: ${comprehensiveReport.linkValidation.totalLinks}`);
        console.log(`   - Valid Links: ${comprehensiveReport.linkValidation.validLinks}`);
        console.log(`   - Broken Links: ${comprehensiveReport.linkValidation.brokenLinks}`);
        console.log('');

        // Save comprehensive report
        const comprehensiveReportText = migrationReporter.formatReport(comprehensiveReport);
        await fs.writeFile(
            path.join(process.cwd(), 'DOCUMENTATION_MIGRATION_COMPREHENSIVE_REPORT.md'),
            comprehensiveReportText,
            'utf-8'
        );

        // ========================================================================
        // Step 5: Summary
        // ========================================================================
        console.log('Step 5/5: Migration Summary');
        console.log('');
        console.log('================================');
        console.log('📊 MIGRATION COMPLETE');
        console.log('================================');
        console.log('');
        console.log('Summary:');
        console.log(`  ✅ Documents Processed: ${comprehensiveReport.summary.totalDocuments}`);
        console.log(`  ✅ Success Rate: ${comprehensiveReport.summary.successRate.toFixed(1)}%`);
        console.log(`  ✅ Tenant Docs: ${comprehensiveReport.summary.tenantDocsCount}`);
        console.log(`  ✅ Admin Docs: ${comprehensiveReport.summary.adminDocsCount}`);
        console.log(`  ✅ Split Docs: ${comprehensiveReport.summary.splitDocsCount}`);
        console.log(`  ✅ Redirects Created: ${comprehensiveReport.summary.redirectsCreated}`);
        console.log('');

        if (comprehensiveReport.summary.brokenLinksFound > 0) {
            console.log(`  ⚠️  Broken Links: ${comprehensiveReport.summary.brokenLinksFound}`);
            console.log('');
        }

        console.log('Reports Generated:');
        console.log('  📄 DOCUMENTATION_ANALYSIS_REPORT.md');
        console.log('  📄 DOCUMENTATION_MIGRATION_REPORT.md');
        console.log('  📄 DOCUMENTATION_REDIRECT_REPORT.md');
        console.log('  📄 DOCUMENTATION_MIGRATION_COMPREHENSIVE_REPORT.md');
        console.log('');

        console.log('Next Steps:');
        console.log('  1. Review comprehensive report for any issues');
        console.log('  2. Fix broken links if any were found');
        console.log('  3. Test documentation portals in development');
        console.log('  4. Verify redirects are working correctly');
        console.log('  5. Deploy to production');
        console.log('');

        if (migrationReport.failedMigrations > 0) {
            console.log('⚠️  Some migrations failed. Check DOCUMENTATION_MIGRATION_REPORT.md for details.');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Error during migration:', error);
        process.exit(1);
    }
}

main();
