/**
 * Generate Redirects Script
 * 
 * Generates redirects for migrated documentation files.
 * 
 * Usage:
 *   npx tsx scripts/generate-redirects.ts
 */

import { documentAnalyzer } from '@/lib/documentation/migration/analyzer';
import { documentMigrator } from '@/lib/documentation/migration/migrator';
import { redirectGenerator } from '@/lib/documentation/migration/redirects';
import fs from 'fs/promises';
import path from 'path';

async function main() {
    console.log('🔗 Documentation Redirect Generator');
    console.log('');

    try {
        // Step 1: Analyze documents
        console.log('Step 1: Analyzing documentation files...');
        const analysisReport = await documentAnalyzer.analyzeAllDocuments();
        console.log(`✅ Analyzed ${analysisReport.totalDocuments} documents`);
        console.log('');

        // Step 2: Simulate migration to get target paths
        console.log('Step 2: Determining target paths...');
        // Note: In a real scenario, we'd read the actual migration results
        // For now, we'll simulate the migration to get the paths
        const migrationResults = analysisReport.analyses.map(analysis => {
            const slug = analysis.fileName.replace('.md', '').toLowerCase().replace(/_/g, '-');
            const category = analysis.suggestedCategory;

            if (analysis.classification === 'both') {
                return {
                    success: true,
                    sourceFile: analysis.fileName,
                    targetFiles: [
                        `docs-content/tenant/${category}/${slug}.md`,
                        `docs-content/admin/${category}/${slug}.md`,
                    ],
                };
            } else {
                return {
                    success: true,
                    sourceFile: analysis.fileName,
                    targetFiles: [
                        `docs-content/${analysis.classification}/${category}/${slug}.md`,
                    ],
                };
            }
        });
        console.log('✅ Target paths determined');
        console.log('');

        // Step 3: Generate redirects
        console.log('Step 3: Generating redirects...');
        const redirectReport = await redirectGenerator.generateRedirects(
            analysisReport.analyses,
            migrationResults
        );
        console.log(`✅ Generated ${redirectReport.totalRedirects} redirects`);
        console.log('');

        // Show summary
        console.log('Redirect Summary:');
        console.log(`  Total: ${redirectReport.totalRedirects}`);
        console.log(`  Created: ${redirectReport.createdRedirects}`);
        console.log(`  Skipped: ${redirectReport.skippedRedirects}`);
        console.log('');

        // Save redirect report
        const reportText = redirectGenerator.generateReport(redirectReport);
        const reportPath = path.join(process.cwd(), 'DOCUMENTATION_REDIRECT_REPORT.md');
        await fs.writeFile(reportPath, reportText, 'utf-8');
        console.log(`📄 Full report saved to: ${reportPath}`);
        console.log('');

        console.log('Next steps:');
        console.log('  1. Review redirect report');
        console.log('  2. Test redirects in development');
        console.log('  3. Update internal links in documentation');

    } catch (error) {
        console.error('❌ Error generating redirects:', error);
        process.exit(1);
    }
}

main();
