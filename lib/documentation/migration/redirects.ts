/**
 * Documentation Redirect System
 * 
 * Generates and manages redirects for moved documentation files.
 * Stores redirects in database and provides middleware for handling old URLs.
 */

import { prisma } from '@/lib/prisma';
import { DocumentAnalysis } from './analyzer';
import { MigrationResult } from './migrator';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface RedirectMapping {
    oldPath: string;
    newPath: string;
    documentType: 'tenant' | 'admin';
    created: boolean;
}

export interface RedirectReport {
    totalRedirects: number;
    createdRedirects: number;
    skippedRedirects: number;
    redirects: RedirectMapping[];
    timestamp: Date;
}

// ============================================================================
// Redirect Generator Class
// ============================================================================

export class RedirectGenerator {
    /**
     * Generate redirects for migrated documents
     */
    async generateRedirects(
        analyses: DocumentAnalysis[],
        migrationResults: MigrationResult[]
    ): Promise<RedirectReport> {
        const redirects: RedirectMapping[] = [];

        for (let i = 0; i < analyses.length; i++) {
            const analysis = analyses[i];
            const result = migrationResults[i];

            if (!result.success) {
                continue;
            }

            // Generate redirects for this document
            const docRedirects = await this.generateDocumentRedirects(analysis, result);
            redirects.push(...docRedirects);
        }

        // Create redirects in database
        let createdCount = 0;
        for (const redirect of redirects) {
            try {
                await this.createRedirect(redirect.oldPath, redirect.newPath);
                redirect.created = true;
                createdCount++;
            } catch (error) {
                console.error(`Failed to create redirect ${redirect.oldPath} -> ${redirect.newPath}:`, error);
                redirect.created = false;
            }
        }

        return {
            totalRedirects: redirects.length,
            createdRedirects: createdCount,
            skippedRedirects: redirects.length - createdCount,
            redirects,
            timestamp: new Date(),
        };
    }

    /**
     * Generate redirects for a single document
     */
    private async generateDocumentRedirects(
        analysis: DocumentAnalysis,
        result: MigrationResult
    ): Promise<RedirectMapping[]> {
        const redirects: RedirectMapping[] = [];
        const oldPath = `/docs/${analysis.fileName.replace('.md', '')}`;

        if (analysis.classification === 'both') {
            // Document was split - create redirects to both versions
            for (const targetFile of result.targetFiles) {
                const type = targetFile.includes('/tenant/') ? 'tenant' : 'admin';
                const newPath = this.convertFilePathToUrl(targetFile, type);

                redirects.push({
                    oldPath,
                    newPath,
                    documentType: type,
                    created: false,
                });
            }
        } else {
            // Document was moved - create single redirect
            const targetFile = result.targetFiles[0];
            const type = analysis.classification;
            const newPath = this.convertFilePathToUrl(targetFile, type);

            redirects.push({
                oldPath,
                newPath,
                documentType: type,
                created: false,
            });
        }

        return redirects;
    }

    /**
     * Convert file path to URL path
     * Example: docs-content/tenant/getting-started/introduction.md -> /docs/getting-started/introduction
     */
    private convertFilePathToUrl(filePath: string, type: 'tenant' | 'admin'): string {
        // Remove docs-content prefix and file extension
        const relativePath = filePath
            .replace(/^docs-content\/(tenant|admin)\//, '')
            .replace('.md', '');

        // Build URL based on type
        const baseUrl = type === 'tenant' ? '/docs' : '/admin-docs';
        return `${baseUrl}/${relativePath}`;
    }

    /**
     * Create a redirect in the database
     */
    private async createRedirect(oldPath: string, newPath: string): Promise<void> {
        await prisma.documentationRedirect.create({
            data: {
                oldPath,
                newPath,
            },
        });
    }

    /**
     * Update internal links in a document
     */
    async updateInternalLinks(content: string, redirects: RedirectMapping[]): Promise<string> {
        let updatedContent = content;

        // Find all markdown links
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const matches = Array.from(content.matchAll(linkRegex));

        for (const match of matches) {
            const fullMatch = match[0];
            const linkText = match[1];
            const linkUrl = match[2];

            // Check if this is an internal link to old docs
            if (linkUrl.startsWith('/docs/') || linkUrl.startsWith('../') || linkUrl.startsWith('./')) {
                // Normalize the link
                const normalizedLink = this.normalizeLink(linkUrl);

                // Find matching redirect
                const redirect = redirects.find(r =>
                    normalizedLink === r.oldPath ||
                    normalizedLink.endsWith(r.oldPath)
                );

                if (redirect) {
                    // Update the link
                    const newLink = `[${linkText}](${redirect.newPath})`;
                    updatedContent = updatedContent.replace(fullMatch, newLink);
                }
            }
        }

        return updatedContent;
    }

    /**
     * Normalize a link to match redirect format
     */
    private normalizeLink(link: string): string {
        // Remove relative path indicators
        let normalized = link.replace(/^\.\.\//, '').replace(/^\.\//, '');

        // Ensure it starts with /docs/
        if (!normalized.startsWith('/')) {
            normalized = `/docs/${normalized}`;
        }

        // Remove .md extension
        normalized = normalized.replace('.md', '');

        // Remove anchor links
        normalized = normalized.split('#')[0];

        return normalized;
    }

    /**
     * Handle anchor links and fragments
     */
    async processAnchors(content: string): Promise<string> {
        // Find all links with anchors
        const anchorRegex = /\[([^\]]+)\]\(([^)]+#[^)]+)\)/g;
        const matches = Array.from(content.matchAll(anchorRegex));

        let updatedContent = content;

        for (const match of matches) {
            const fullMatch = match[0];
            const linkText = match[1];
            const linkUrl = match[2];

            // Split URL and anchor
            const [url, anchor] = linkUrl.split('#');

            // Normalize the URL part
            const normalizedUrl = this.normalizeLink(url);

            // Reconstruct the link
            const newLink = `[${linkText}](${normalizedUrl}#${anchor})`;
            updatedContent = updatedContent.replace(fullMatch, newLink);
        }

        return updatedContent;
    }

    /**
     * Generate a formatted redirect report
     */
    generateReport(report: RedirectReport): string {
        const lines: string[] = [];

        lines.push('# Documentation Redirect Report');
        lines.push('');
        lines.push(`Generated: ${report.timestamp.toISOString()}`);
        lines.push('');
        lines.push('## Summary');
        lines.push('');
        lines.push(`- Total Redirects: ${report.totalRedirects}`);
        lines.push(`- Created: ${report.createdRedirects}`);
        lines.push(`- Skipped: ${report.skippedRedirects}`);
        lines.push('');

        // Group by document type
        const tenantRedirects = report.redirects.filter(r => r.documentType === 'tenant');
        const adminRedirects = report.redirects.filter(r => r.documentType === 'admin');

        if (tenantRedirects.length > 0) {
            lines.push('## Tenant Documentation Redirects');
            lines.push('');
            for (const redirect of tenantRedirects) {
                const status = redirect.created ? '✅' : '❌';
                lines.push(`${status} \`${redirect.oldPath}\` → \`${redirect.newPath}\``);
            }
            lines.push('');
        }

        if (adminRedirects.length > 0) {
            lines.push('## Admin Documentation Redirects');
            lines.push('');
            for (const redirect of adminRedirects) {
                const status = redirect.created ? '✅' : '❌';
                lines.push(`${status} \`${redirect.oldPath}\` → \`${redirect.newPath}\``);
            }
            lines.push('');
        }

        return lines.join('\n');
    }
}

// ============================================================================
// Redirect Middleware
// ============================================================================

/**
 * Check if a path has a redirect and return the new path
 */
export async function getRedirect(oldPath: string): Promise<string | null> {
    const redirect = await prisma.documentationRedirect.findUnique({
        where: { oldPath },
    });

    return redirect?.newPath || null;
}

/**
 * Get all redirects (for bulk operations)
 */
export async function getAllRedirects(): Promise<Array<{ oldPath: string; newPath: string }>> {
    const redirects = await prisma.documentationRedirect.findMany({
        select: {
            oldPath: true,
            newPath: true,
        },
    });

    return redirects;
}

// Export singleton instance
export const redirectGenerator = new RedirectGenerator();
