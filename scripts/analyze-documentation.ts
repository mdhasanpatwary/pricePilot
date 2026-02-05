/**
 * Documentation Analysis Script
 * 
 * Analyzes all existing documentation files and generates a classification report.
 * 
 * Usage:
 *   npx tsx scripts/analyze-documentation.ts
 */

import { documentAnalyzer } from '@/lib/documentation/migration/analyzer';
import fs from 'fs/promises';
import path from 'path';

async function main() {
    console.log('🔍 Analyzing documentation files...\n');

    try {
        // Run analysis
        const report = await documentAnalyzer.analyzeAllDocuments();

        // Generate formatted report
        const reportText = documentAnalyzer.generateReport(report);

        // Save report to file
        const reportPath = path.join(process.cwd(), 'DOCUMENTATION_ANALYSIS_REPORT.md');
        await fs.writeFile(reportPath, reportText, 'utf-8');

        console.log('✅ Analysis complete!');
        console.log('');
        console.log('Summary:');
        console.log(`  Total Documents: ${report.totalDocuments}`);
        console.log(`  Tenant Documents: ${report.tenantDocs}`);
        console.log(`  Admin Documents: ${report.adminDocs}`);
        console.log(`  Both Audiences: ${report.bothDocs}`);
        console.log('');
        console.log(`📄 Full report saved to: ${reportPath}`);
        console.log('');

        // Show high-confidence classifications
        const highConfidence = report.analyses.filter(a => a.confidence >= 80);
        console.log(`High Confidence Classifications (${highConfidence.length} documents with ≥80% confidence):`);

        const tenantHighConf = highConfidence.filter(a => a.classification === 'tenant');
        const adminHighConf = highConfidence.filter(a => a.classification === 'admin');

        console.log(`  Tenant: ${tenantHighConf.length}`);
        console.log(`  Admin: ${adminHighConf.length}`);
        console.log('');

        // Show low-confidence classifications (need manual review)
        const lowConfidence = report.analyses.filter(a => a.confidence < 70);
        if (lowConfidence.length > 0) {
            console.log(`⚠️  Low Confidence Classifications (${lowConfidence.length} documents need manual review):`);
            for (const doc of lowConfidence) {
                console.log(`  - ${doc.fileName} (${doc.confidence}% confidence as ${doc.classification})`);
            }
            console.log('');
        }

        // Show documents classified as "both"
        const bothDocs = report.analyses.filter(a => a.classification === 'both');
        if (bothDocs.length > 0) {
            console.log(`📋 Documents for Both Audiences (${bothDocs.length} documents will be split):`);
            for (const doc of bothDocs) {
                console.log(`  - ${doc.fileName}`);
            }
            console.log('');
        }

        console.log('Next steps:');
        console.log('  1. Review the full report in DOCUMENTATION_ANALYSIS_REPORT.md');
        console.log('  2. Manually review low-confidence classifications');
        console.log('  3. Run migration script to move documents to new structure');

    } catch (error) {
        console.error('❌ Error analyzing documentation:', error);
        process.exit(1);
    }
}

main();
