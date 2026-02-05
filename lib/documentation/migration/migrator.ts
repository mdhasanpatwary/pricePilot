/**
 * Documentation Migrator
 * 
 * Migrates existing documentation files to the new dual-portal structure.
 * Handles moving files, splitting documents, and adding frontmatter metadata.
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { DocumentAnalysis } from './analyzer';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MigrationResult {
    success: boolean;
    sourceFile: string;
    targetFiles: string[];
    error?: string;
}

export interface MigrationReport {
    totalDocuments: number;
    successfulMigrations: number;
    failedMigrations: number;
    tenantDocs: number;
    adminDocs: number;
    splitDocs: number;
    results: MigrationResult[];
    errors: string[];
    timestamp: Date;
}

export interface SplitDocumentConfig {
    tenantContent: string;
    adminContent: string;
    tenantTitle: string;
    adminTitle: string;
}

// ============================================================================
// Document Migrator Class
// ============================================================================

export class DocumentMigrator {
    private targetDir: string;

    constructor(_sourceDir: string = 'docs', targetDir: string = 'docs-content') {
        // _sourceDir parameter kept for API compatibility but not used internally
        this.targetDir = targetDir;
    }

    /**
     * Migrate all documents based on analysis
     */
    async migrateDocuments(analyses: DocumentAnalysis[]): Promise<MigrationReport> {
        const results: MigrationResult[] = [];
        const errors: string[] = [];

        // Ensure target directories exist
        await this.ensureDirectories();

        for (const analysis of analyses) {
            try {
                const result = await this.migrateDocument(analysis);
                results.push(result);
            } catch (error) {
                const errorMsg = `Failed to migrate ${analysis.fileName}: ${error}`;
                errors.push(errorMsg);
                results.push({
                    success: false,
                    sourceFile: analysis.fileName,
                    targetFiles: [],
                    error: errorMsg,
                });
            }
        }

        // Calculate statistics
        const successfulMigrations = results.filter(r => r.success).length;
        const failedMigrations = results.filter(r => !r.success).length;
        const tenantDocs = analyses.filter(a => a.classification === 'tenant').length;
        const adminDocs = analyses.filter(a => a.classification === 'admin').length;
        const splitDocs = analyses.filter(a => a.classification === 'both').length;

        return {
            totalDocuments: analyses.length,
            successfulMigrations,
            failedMigrations,
            tenantDocs,
            adminDocs,
            splitDocs,
            results,
            errors,
            timestamp: new Date(),
        };
    }

    /**
     * Migrate a single document
     */
    private async migrateDocument(analysis: DocumentAnalysis): Promise<MigrationResult> {
        const targetFiles: string[] = [];

        try {
            if (analysis.classification === 'both') {
                // Split document into tenant and admin versions
                const splitConfig = await this.splitDocument(analysis);

                // Create tenant version
                const tenantPath = await this.createDocument(
                    'tenant',
                    analysis,
                    splitConfig.tenantContent,
                    splitConfig.tenantTitle
                );
                targetFiles.push(tenantPath);

                // Create admin version
                const adminPath = await this.createDocument(
                    'admin',
                    analysis,
                    splitConfig.adminContent,
                    splitConfig.adminTitle
                );
                targetFiles.push(adminPath);
            } else {
                // Move document to appropriate directory
                const targetPath = await this.createDocument(
                    analysis.classification,
                    analysis,
                    analysis.content,
                    analysis.title
                );
                targetFiles.push(targetPath);
            }

            return {
                success: true,
                sourceFile: analysis.fileName,
                targetFiles,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Create a document in the target directory with frontmatter
     */
    private async createDocument(
        type: 'tenant' | 'admin',
        analysis: DocumentAnalysis,
        content: string,
        title: string
    ): Promise<string> {
        // Parse existing frontmatter
        const parsed = matter(content);
        const existingFrontmatter = parsed.data;
        const markdownContent = parsed.content;

        // Generate slug from filename
        const slug = this.generateSlug(analysis.fileName);

        // Create frontmatter
        const frontmatter = {
            title: existingFrontmatter.title || title,
            description: existingFrontmatter.description || this.generateDescription(markdownContent),
            category: existingFrontmatter.category || analysis.suggestedCategory,
            tags: existingFrontmatter.tags || this.generateTags(title, markdownContent),
            author: existingFrontmatter.author || 'PricePilot Team',
            lastReviewed: existingFrontmatter.lastReviewed || new Date().toISOString().split('T')[0],
            relatedDocs: existingFrontmatter.relatedDocs || [],
            migratedFrom: analysis.fileName,
        };

        // Create document with frontmatter
        const documentContent = matter.stringify(markdownContent, frontmatter);

        // Determine target path
        const category = frontmatter.category;
        const targetDir = path.join(
            process.cwd(),
            this.targetDir,
            type,
            category
        );

        // Ensure category directory exists
        await fs.mkdir(targetDir, { recursive: true });

        // Write document
        const targetPath = path.join(targetDir, `${slug}.md`);
        await fs.writeFile(targetPath, documentContent, 'utf-8');

        return path.relative(process.cwd(), targetPath);
    }

    /**
     * Split a document into tenant and admin versions
     */
    private async splitDocument(analysis: DocumentAnalysis): Promise<SplitDocumentConfig> {
        const parsed = matter(analysis.content);
        const content = parsed.content;

        // For now, we'll create simplified versions
        // In a real implementation, this would use more sophisticated content analysis

        // Extract sections
        const sections = this.extractSections(content);

        // Classify sections
        const tenantSections: string[] = [];
        const adminSections: string[] = [];
        const sharedSections: string[] = [];

        for (const section of sections) {
            const classification = this.classifySection(section);
            if (classification === 'tenant') {
                tenantSections.push(section);
            } else if (classification === 'admin') {
                adminSections.push(section);
            } else {
                sharedSections.push(section);
            }
        }

        // Build tenant content
        const tenantContent = [
            ...sharedSections,
            ...tenantSections,
        ].join('\n\n');

        // Build admin content
        const adminContent = [
            ...sharedSections,
            ...adminSections,
        ].join('\n\n');

        return {
            tenantContent: tenantContent || content, // Fallback to full content
            adminContent: adminContent || content, // Fallback to full content
            tenantTitle: `${analysis.title} (User Guide)`,
            adminTitle: `${analysis.title} (Admin Guide)`,
        };
    }

    /**
     * Extract sections from markdown content
     */
    private extractSections(content: string): string[] {
        const sections: string[] = [];
        const lines = content.split('\n');
        let currentSection: string[] = [];

        for (const line of lines) {
            if (line.startsWith('## ')) {
                // New section starts
                if (currentSection.length > 0) {
                    sections.push(currentSection.join('\n'));
                }
                currentSection = [line];
            } else {
                currentSection.push(line);
            }
        }

        // Add last section
        if (currentSection.length > 0) {
            sections.push(currentSection.join('\n'));
        }

        return sections;
    }

    /**
     * Classify a section as tenant, admin, or shared
     */
    private classifySection(section: string): 'tenant' | 'admin' | 'shared' {
        const lowerSection = section.toLowerCase();

        // Admin indicators
        const adminIndicators = [
            'database', 'schema', 'migration', 'deployment',
            'infrastructure', 'server', 'configuration',
            'technical', 'architecture', 'system',
        ];

        // Tenant indicators
        const tenantIndicators = [
            'user', 'dashboard', 'interface', 'guide',
            'tutorial', 'step', 'click', 'select',
        ];

        let adminScore = 0;
        let tenantScore = 0;

        for (const indicator of adminIndicators) {
            if (lowerSection.includes(indicator)) {
                adminScore++;
            }
        }

        for (const indicator of tenantIndicators) {
            if (lowerSection.includes(indicator)) {
                tenantScore++;
            }
        }

        if (adminScore > tenantScore * 1.5) {
            return 'admin';
        }

        if (tenantScore > adminScore * 1.5) {
            return 'tenant';
        }

        return 'shared';
    }

    /**
     * Generate slug from filename
     */
    private generateSlug(fileName: string): string {
        return fileName
            .replace('.md', '')
            .toLowerCase()
            .replace(/_/g, '-');
    }

    /**
     * Generate description from content
     */
    private generateDescription(content: string): string {
        // Find first paragraph
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('```')) {
                // Limit to 200 characters
                return trimmed.substring(0, 200) + (trimmed.length > 200 ? '...' : '');
            }
        }
        return 'Documentation';
    }

    /**
     * Generate tags from title and content
     */
    private generateTags(title: string, content: string): string[] {
        const tags: Set<string> = new Set();
        const lowerTitle = title.toLowerCase();
        const lowerContent = content.toLowerCase();

        // Common tag keywords
        const tagKeywords = [
            'guide', 'tutorial', 'api', 'security', 'performance',
            'monitoring', 'deployment', 'configuration', 'troubleshooting',
            'integration', 'opencart', 'laravel', 'price', 'product',
            'competitor', 'scraping', 'approval', 'rollback',
        ];

        for (const keyword of tagKeywords) {
            if (lowerTitle.includes(keyword) || lowerContent.includes(keyword)) {
                tags.add(keyword);
            }
        }

        return Array.from(tags).slice(0, 5); // Limit to 5 tags
    }

    /**
     * Ensure target directories exist
     */
    private async ensureDirectories(): Promise<void> {
        const categories = {
            tenant: [
                'getting-started',
                'products',
                'competitors',
                'pricing',
                'integrations',
                'troubleshooting',
                'user-guides',
                'general',
            ],
            admin: [
                'system-monitoring',
                'tenant-management',
                'database',
                'security',
                'performance',
                'alerting',
                'deployment',
                'api-reference',
                'system-administration',
            ],
        };

        for (const [type, cats] of Object.entries(categories)) {
            for (const category of cats) {
                const dir = path.join(process.cwd(), this.targetDir, type, category);
                await fs.mkdir(dir, { recursive: true });
            }
        }
    }

    /**
     * Generate a formatted migration report
     */
    generateReport(report: MigrationReport): string {
        const lines: string[] = [];

        lines.push('# Documentation Migration Report');
        lines.push('');
        lines.push(`Generated: ${report.timestamp.toISOString()}`);
        lines.push('');
        lines.push('## Summary');
        lines.push('');
        lines.push(`- Total Documents: ${report.totalDocuments}`);
        lines.push(`- Successful Migrations: ${report.successfulMigrations}`);
        lines.push(`- Failed Migrations: ${report.failedMigrations}`);
        lines.push(`- Tenant Documents: ${report.tenantDocs}`);
        lines.push(`- Admin Documents: ${report.adminDocs}`);
        lines.push(`- Split Documents: ${report.splitDocs}`);
        lines.push('');

        if (report.errors.length > 0) {
            lines.push('## Errors');
            lines.push('');
            for (const error of report.errors) {
                lines.push(`- ${error}`);
            }
            lines.push('');
        }

        lines.push('## Migration Results');
        lines.push('');

        // Group by success/failure
        const successful = report.results.filter(r => r.success);
        const failed = report.results.filter(r => !r.success);

        if (successful.length > 0) {
            lines.push('### Successful Migrations');
            lines.push('');
            for (const result of successful) {
                lines.push(`#### ${result.sourceFile}`);
                lines.push('');
                lines.push('**Target Files:**');
                for (const target of result.targetFiles) {
                    lines.push(`- \`${target}\``);
                }
                lines.push('');
            }
        }

        if (failed.length > 0) {
            lines.push('### Failed Migrations');
            lines.push('');
            for (const result of failed) {
                lines.push(`#### ${result.sourceFile}`);
                lines.push('');
                lines.push(`**Error:** ${result.error}`);
                lines.push('');
            }
        }

        return lines.join('\n');
    }
}

// Export singleton instance
export const documentMigrator = new DocumentMigrator();
