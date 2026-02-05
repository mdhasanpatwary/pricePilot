/**
 * Migration Reporter
 * 
 * Generates comprehensive migration reports with statistics, validation, and summaries.
 */

import { DocumentAnalysis, AnalysisReport } from './analyzer';
import { MigrationReport } from './migrator';
import { RedirectReport } from './redirects';
import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface LinkValidationResult {
    totalLinks: number;
    validLinks: number;
    brokenLinks: number;
    brokenLinkDetails: Array<{
        file: string;
        link: string;
        reason: string;
    }>;
}

export interface ComprehensiveMigrationReport {
    analysis: AnalysisReport;
    migration: MigrationReport;
    redirects: RedirectReport;
    linkValidation: LinkValidationResult;
    summary: {
        totalDocuments: number;
        successRate: number;
        tenantDocsCount: number;
        adminDocsCount: number;
        splitDocsCount: number;
        redirectsCreated: number;
        brokenLinksFound: number;
    };
    timestamp: Date;
}

// ============================================================================
// Migration Reporter Class
// ============================================================================

export class MigrationReporter {
    /**
     * Generate comprehensive migration report
     */
    async generateComprehensiveReport(
        analysis: AnalysisReport,
        migration: MigrationReport,
        redirects: RedirectReport
    ): Promise<ComprehensiveMigrationReport> {
        // Validate links
        const linkValidation = await this.validateLinks(migration);

        // Calculate summary statistics
        const summary = {
            totalDocuments: analysis.totalDocuments,
            successRate: (migration.successfulMigrations / migration.totalDocuments) * 100,
            tenantDocsCount: analysis.tenantDocs,
            adminDocsCount: analysis.adminDocs,
            splitDocsCount: analysis.bothDocs,
            redirectsCreated: redirects.createdRedirects,
            brokenLinksFound: linkValidation.brokenLinks,
        };

        return {
            analysis,
            migration,
            redirects,
            linkValidation,
            summary,
            timestamp: new Date(),
        };
    }

    /**
     * Validate internal links in migrated documents
     */
    private async validateLinks(migration: MigrationReport): Promise<LinkValidationResult> {
        const brokenLinkDetails: Array<{
            file: string;
            link: string;
            reason: string;
        }> = [];

        let totalLinks = 0;
        let validLinks = 0;

        // For each successful migration, check links
        for (const result of migration.results) {
            if (!result.success) continue;

            for (const targetFile of result.targetFiles) {
                try {
                    const fullPath = path.join(process.cwd(), targetFile);
                    const content = await fs.readFile(fullPath, 'utf-8');

                    // Find all markdown links
                    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                    const matches = Array.from(content.matchAll(linkRegex));

                    for (const match of matches) {
                        const linkUrl = match[2];
                        totalLinks++;

                        // Check if it's an internal link
                        if (this.isInternalLink(linkUrl)) {
                            const isValid = await this.validateInternalLink(linkUrl, targetFile);
                            if (isValid) {
                                validLinks++;
                            } else {
                                brokenLinkDetails.push({
                                    file: targetFile,
                                    link: linkUrl,
                                    reason: 'Target document not found',
                                });
                            }
                        } else {
                            // External links are assumed valid
                            validLinks++;
                        }
                    }
                } catch (error) {
                    console.error(`Error validating links in ${targetFile}:`, error);
                }
            }
        }

        return {
            totalLinks,
            validLinks,
            brokenLinks: brokenLinkDetails.length,
            brokenLinkDetails,
        };
    }

    /**
     * Check if a link is internal
     */
    private isInternalLink(link: string): boolean {
        return (
            link.startsWith('/docs/') ||
            link.startsWith('/admin-docs/') ||
            link.startsWith('../') ||
            link.startsWith('./')
        );
    }

    /**
     * Validate an internal link
     */
    private async validateInternalLink(link: string, sourceFile: string): Promise<boolean> {
        // Remove anchor
        const linkWithoutAnchor = link.split('#')[0];

        // Resolve relative links
        let targetPath: string;
        if (linkWithoutAnchor.startsWith('/')) {
            // Absolute link
            targetPath = linkWithoutAnchor;
        } else {
            // Relative link
            const sourceDir = path.dirname(sourceFile);
            targetPath = path.join(sourceDir, linkWithoutAnchor);
        }

        // Check if file exists
        try {
            await fs.access(path.join(process.cwd(), targetPath));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Format comprehensive report as markdown
     */
    formatReport(report: ComprehensiveMigrationReport): string {
        const lines: string[] = [];

        lines.push('# Comprehensive Documentation Migration Report');
        lines.push('');
        lines.push(`Generated: ${report.timestamp.toISOString()}`);
        lines.push('');

        // Executive Summary
        lines.push('## Executive Summary');
        lines.push('');
        lines.push(`- **Total Documents Processed**: ${report.summary.totalDocuments}`);
        lines.push(`- **Migration Success Rate**: ${report.summary.successRate.toFixed(1)}%`);
        lines.push(`- **Tenant Documents**: ${report.summary.tenantDocsCount}`);
        lines.push(`- **Admin Documents**: ${report.summary.adminDocsCount}`);
        lines.push(`- **Split Documents**: ${report.summary.splitDocsCount}`);
        lines.push(`- **Redirects Created**: ${report.summary.redirectsCreated}`);
        lines.push(`- **Broken Links Found**: ${report.summary.brokenLinksFound}`);
        lines.push('');

        // Analysis Summary
        lines.push('## Analysis Summary');
        lines.push('');
        lines.push('### Classification Breakdown');
        lines.push('');
        lines.push(`- Tenant Documents: ${report.analysis.tenantDocs} (${Math.round(report.analysis.tenantDocs / report.analysis.totalDocuments * 100)}%)`);
        lines.push(`- Admin Documents: ${report.analysis.adminDocs} (${Math.round(report.analysis.adminDocs / report.analysis.totalDocuments * 100)}%)`);
        lines.push(`- Both Audiences: ${report.analysis.bothDocs} (${Math.round(report.analysis.bothDocs / report.analysis.totalDocuments * 100)}%)`);
        lines.push('');

        // High confidence classifications
        const highConfidence = report.analysis.analyses.filter(a => a.confidence >= 80);
        lines.push('### High Confidence Classifications');
        lines.push('');
        lines.push(`${highConfidence.length} documents classified with ≥80% confidence`);
        lines.push('');

        // Low confidence classifications
        const lowConfidence = report.analysis.analyses.filter(a => a.confidence < 70);
        if (lowConfidence.length > 0) {
            lines.push('### Low Confidence Classifications (Manual Review Recommended)');
            lines.push('');
            for (const doc of lowConfidence) {
                lines.push(`- **${doc.fileName}**: ${doc.confidence}% confidence as ${doc.classification}`);
            }
            lines.push('');
        }

        // Migration Summary
        lines.push('## Migration Summary');
        lines.push('');
        lines.push(`- Total Documents: ${report.migration.totalDocuments}`);
        lines.push(`- Successful Migrations: ${report.migration.successfulMigrations}`);
        lines.push(`- Failed Migrations: ${report.migration.failedMigrations}`);
        lines.push('');

        if (report.migration.errors.length > 0) {
            lines.push('### Migration Errors');
            lines.push('');
            for (const error of report.migration.errors) {
                lines.push(`- ${error}`);
            }
            lines.push('');
        }

        // Redirect Summary
        lines.push('## Redirect Summary');
        lines.push('');
        lines.push(`- Total Redirects: ${report.redirects.totalRedirects}`);
        lines.push(`- Created: ${report.redirects.createdRedirects}`);
        lines.push(`- Skipped: ${report.redirects.skippedRedirects}`);
        lines.push('');

        // Link Validation
        lines.push('## Link Validation');
        lines.push('');
        lines.push(`- Total Links: ${report.linkValidation.totalLinks}`);
        lines.push(`- Valid Links: ${report.linkValidation.validLinks}`);
        lines.push(`- Broken Links: ${report.linkValidation.brokenLinks}`);
        lines.push('');

        if (report.linkValidation.brokenLinks > 0) {
            lines.push('### Broken Links');
            lines.push('');
            for (const broken of report.linkValidation.brokenLinkDetails) {
                lines.push(`- **File**: \`${broken.file}\``);
                lines.push(`  - **Link**: \`${broken.link}\``);
                lines.push(`  - **Reason**: ${broken.reason}`);
                lines.push('');
            }
        }

        // Coverage Analysis
        lines.push('## Coverage Analysis');
        lines.push('');
        lines.push('### Tenant Documentation Categories');
        lines.push('');
        const tenantCategories = this.getCategoryBreakdown(
            report.analysis.analyses.filter(a => a.classification === 'tenant')
        );
        for (const [category, count] of Object.entries(tenantCategories)) {
            lines.push(`- ${category}: ${count} documents`);
        }
        lines.push('');

        lines.push('### Admin Documentation Categories');
        lines.push('');
        const adminCategories = this.getCategoryBreakdown(
            report.analysis.analyses.filter(a => a.classification === 'admin')
        );
        for (const [category, count] of Object.entries(adminCategories)) {
            lines.push(`- ${category}: ${count} documents`);
        }
        lines.push('');

        // Gaps and Issues
        lines.push('## Gaps and Issues');
        lines.push('');

        if (lowConfidence.length > 0) {
            lines.push(`- ${lowConfidence.length} documents need manual review due to low confidence`);
        }

        if (report.linkValidation.brokenLinks > 0) {
            lines.push(`- ${report.linkValidation.brokenLinks} broken links need to be fixed`);
        }

        if (report.migration.failedMigrations > 0) {
            lines.push(`- ${report.migration.failedMigrations} documents failed to migrate`);
        }

        if (lowConfidence.length === 0 && report.linkValidation.brokenLinks === 0 && report.migration.failedMigrations === 0) {
            lines.push('✅ No significant issues found!');
        }
        lines.push('');

        // Next Steps
        lines.push('## Next Steps');
        lines.push('');
        lines.push('1. Review low-confidence classifications and adjust if needed');
        lines.push('2. Fix broken internal links');
        lines.push('3. Test redirects in development environment');
        lines.push('4. Verify frontmatter metadata is complete');
        lines.push('5. Update any external references to documentation');
        lines.push('6. Deploy changes to production');
        lines.push('');

        return lines.join('\n');
    }

    /**
     * Get category breakdown
     */
    private getCategoryBreakdown(analyses: DocumentAnalysis[]): Record<string, number> {
        const categories: Record<string, number> = {};

        for (const analysis of analyses) {
            const category = analysis.suggestedCategory;
            categories[category] = (categories[category] || 0) + 1;
        }

        // Sort by count descending
        return Object.fromEntries(
            Object.entries(categories).sort((a, b) => b[1] - a[1])
        );
    }
}

// Export singleton instance
export const migrationReporter = new MigrationReporter();
