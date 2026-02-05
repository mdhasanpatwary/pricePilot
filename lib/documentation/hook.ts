/**
 * Documentation Hook System
 * 
 * Monitors task completion events and generates documentation update suggestions.
 * Implements automated documentation maintenance through:
 * - Task completion event listening
 * - Documentation impact analysis
 * - Suggestion generation with classification
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { prisma } from '@/lib/prisma';
import { DocumentationType, DocumentationSuggestionStatus } from '@prisma/client';
import { documentationMonitor } from './monitoring';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Task completion event data
 */
export interface Task {
    id: string;
    title: string;
    description: string;
    category: string;
    completedAt: Date;
    completedBy: string;
}

/**
 * Code change information
 */
export interface CodeChange {
    file: string;
    type: 'added' | 'modified' | 'deleted';
    diff: string;
}

/**
 * Documentation impact analysis result
 */
export interface DocumentationImpact {
    hasImpact: boolean;
    impactType: 'feature' | 'bugfix' | 'configuration' | 'api' | 'ui';
    affectedAreas: string[];
    suggestedUpdates: string[];
    targetAudience: 'tenant' | 'admin' | 'both';
}

/**
 * Documentation suggestion
 */
export interface DocumentationSuggestion {
    id: string;
    documentId?: string; // null if new document needed
    suggestedTitle?: string;
    suggestedContent: string;
    targetType: 'tenant' | 'admin';
    category: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: Date;
    reviewedBy?: string;
    reviewedAt?: Date;
}

// ============================================================================
// Documentation Hook Class
// ============================================================================

export class DocumentationHook {
    constructor() {
        // Constructor for future use
    }

    // ==========================================================================
    // Event Handling (Task 11.1)
    // ==========================================================================

    /**
     * Handle task completion event
     * Requirement 5.1: Monitor task completion events
     * 
     * @param task - Completed task information
     */
    async onTaskCompleted(task: Task): Promise<void> {
        try {
            // Analyze documentation impact
            const impact = await this.analyzeDocumentationImpact(task);

            // If task has documentation impact, generate suggestion
            if (impact.hasImpact) {
                await this.generateUpdateSuggestion(impact, task);
            }
        } catch (error) {
            console.error('[DocumentationHook] Error handling task completion:', error);
            throw error;
        }
    }

    /**
     * Handle code change events
     * 
     * @param changes - Array of code changes
     */
    async onCodeChanged(changes: CodeChange[]): Promise<void> {
        try {
            // Analyze changes for documentation impact
            for (const change of changes) {
                // Determine if change affects documentation
                const affectsDocumentation = this.doesChangeAffectDocumentation(change);

                if (affectsDocumentation) {
                    // Create a synthetic task from code change
                    const syntheticTask: Task = {
                        id: `code-change-${Date.now()}`,
                        title: `Code change in ${change.file}`,
                        description: `${change.type} ${change.file}`,
                        category: this.inferCategoryFromFile(change.file),
                        completedAt: new Date(),
                        completedBy: 'system',
                    };

                    await this.onTaskCompleted(syntheticTask);
                }
            }
        } catch (error) {
            console.error('[DocumentationHook] Error handling code changes:', error);
            throw error;
        }
    }

    // ==========================================================================
    // Impact Analysis (Task 11.2)
    // ==========================================================================

    /**
     * Analyze task for documentation impact
     * Requirements 5.2, 5.3: Identify impact type and determine affected areas
     * 
     * @param task - Task to analyze
     * @returns Documentation impact analysis
     */
    async analyzeDocumentationImpact(task: Task): Promise<DocumentationImpact> {
        const title = task.title.toLowerCase();
        const description = task.description.toLowerCase();
        const combined = `${title} ${description}`;

        // Determine if task has documentation impact
        const hasImpact = this.hasDocumentationImpact(combined);

        if (!hasImpact) {
            return {
                hasImpact: false,
                impactType: 'bugfix',
                affectedAreas: [],
                suggestedUpdates: [],
                targetAudience: 'tenant',
            };
        }

        // Identify impact type
        const impactType = this.identifyImpactType(combined);

        // Determine affected documentation areas
        const affectedAreas = this.identifyAffectedAreas(combined, impactType);

        // Generate suggested updates
        const suggestedUpdates = this.generateSuggestedUpdates(task, impactType, affectedAreas);

        // Classify target audience
        const targetAudience = await this.classifyDocumentationType(combined);

        return {
            hasImpact: true,
            impactType,
            affectedAreas,
            suggestedUpdates,
            targetAudience,
        };
    }

    /**
     * Classify whether documentation is tenant-facing, admin-facing, or both
     * Requirement 5.3: Classify target audience
     * 
     * @param task - Task to classify
     * @returns Target audience classification
     */
    async classifyDocumentationType(content: string): Promise<'tenant' | 'admin' | 'both'> {
        // Admin-specific keywords
        const adminKeywords = [
            'admin', 'system', 'deployment', 'infrastructure', 'monitoring',
            'database', 'migration', 'security', 'performance', 'alerting',
            'tenant management', 'user management', 'configuration', 'backup',
            'restore', 'scaling', 'optimization', 'architecture', 'devops',
        ];

        // Tenant-specific keywords
        const tenantKeywords = [
            'user', 'product', 'competitor', 'price', 'update', 'matching',
            'integration', 'opencart', 'laravel', 'dashboard', 'report',
            'notification', 'webhook', 'api token', 'getting started',
            'tutorial', 'guide', 'how to', 'troubleshooting', 'faq',
        ];

        // Both keywords (features that affect both audiences)
        const bothKeywords = [
            'api', 'authentication', 'authorization', 'rate limiting',
            'error handling', 'logging', 'audit', 'compliance',
        ];

        const lowerContent = content.toLowerCase();

        // Check for "both" keywords first
        const hasBothKeywords = bothKeywords.some(keyword => lowerContent.includes(keyword));
        if (hasBothKeywords) {
            return 'both';
        }

        // Count admin and tenant keyword matches
        const adminMatches = adminKeywords.filter(keyword => lowerContent.includes(keyword)).length;
        const tenantMatches = tenantKeywords.filter(keyword => lowerContent.includes(keyword)).length;

        // If both have matches, it's for both audiences
        if (adminMatches > 0 && tenantMatches > 0) {
            return 'both';
        }

        // If only admin matches, it's admin documentation
        if (adminMatches > tenantMatches) {
            return 'admin';
        }

        // Default to tenant documentation
        return 'tenant';
    }

    // ==========================================================================
    // Suggestion Generation (Task 11.3)
    // ==========================================================================

    /**
     * Generate documentation update suggestion
     * Requirements 5.4, 5.5, 5.6, 5.7: Create suggestions, identify affected docs, maintain audit log
     * 
     * @param impact - Documentation impact analysis
     * @param task - Original task
     * @returns Created suggestion
     */
    async generateUpdateSuggestion(
        impact: DocumentationImpact,
        task: Task
    ): Promise<DocumentationSuggestion> {
        try {
            // Find affected documents
            const affectedDocuments = await this.findAffectedDocuments(impact);

            // Generate suggestion content
            const suggestedContent = this.generateSuggestionContent(task, impact);

            // Determine if we need a new document or update existing
            const needsNewDocument = affectedDocuments.length === 0;

            // Create suggestion for each target type
            const suggestions: DocumentationSuggestion[] = [];

            if (impact.targetAudience === 'both') {
                // Create suggestions for both tenant and admin
                const tenantSuggestion = await this.createSuggestion({
                    documentId: affectedDocuments.find(d => d.type === 'tenant')?.id,
                    suggestedTitle: needsNewDocument ? this.generateDocumentTitle(task, 'tenant') : undefined,
                    suggestedContent,
                    targetType: 'tenant',
                    category: this.inferCategory(task, 'tenant'),
                    taskId: task.id,
                });
                suggestions.push(tenantSuggestion);

                const adminSuggestion = await this.createSuggestion({
                    documentId: affectedDocuments.find(d => d.type === 'admin')?.id,
                    suggestedTitle: needsNewDocument ? this.generateDocumentTitle(task, 'admin') : undefined,
                    suggestedContent,
                    targetType: 'admin',
                    category: this.inferCategory(task, 'admin'),
                    taskId: task.id,
                });
                suggestions.push(adminSuggestion);
            } else {
                // Create suggestion for single audience
                const suggestion = await this.createSuggestion({
                    documentId: affectedDocuments[0]?.id,
                    suggestedTitle: needsNewDocument ? this.generateDocumentTitle(task, impact.targetAudience) : undefined,
                    suggestedContent,
                    targetType: impact.targetAudience,
                    category: this.inferCategory(task, impact.targetAudience),
                    taskId: task.id,
                });
                suggestions.push(suggestion);
            }

            // Return first suggestion (or could return all)
            return suggestions[0];
        } catch (error) {
            console.error('[DocumentationHook] Error generating suggestion:', error);
            throw error;
        }
    }

    /**
     * Find affected documents based on impact analysis
     * Requirement 5.5: Identify which existing documentation pages are affected
     * 
     * @param impact - Documentation impact analysis
     * @returns Array of affected documents
     */
    async findAffectedDocuments(impact: DocumentationImpact): Promise<Array<{ id: string; type: 'tenant' | 'admin' }>> {
        const affectedDocs: Array<{ id: string; type: 'tenant' | 'admin' }> = [];

        try {
            // Search for documents in affected areas
            for (const area of impact.affectedAreas) {
                // Search tenant docs
                if (impact.targetAudience === 'tenant' || impact.targetAudience === 'both') {
                    const tenantDocs = await prisma.documentationDocument.findMany({
                        where: {
                            type: DocumentationType.TENANT,
                            OR: [
                                { category: { contains: area, mode: 'insensitive' } },
                                { title: { contains: area, mode: 'insensitive' } },
                                { content: { contains: area, mode: 'insensitive' } },
                            ],
                        },
                        select: { id: true },
                        take: 5, // Limit results
                    });

                    affectedDocs.push(...tenantDocs.map(d => ({ id: d.id, type: 'tenant' as const })));
                }

                // Search admin docs
                if (impact.targetAudience === 'admin' || impact.targetAudience === 'both') {
                    const adminDocs = await prisma.documentationDocument.findMany({
                        where: {
                            type: DocumentationType.ADMIN,
                            OR: [
                                { category: { contains: area, mode: 'insensitive' } },
                                { title: { contains: area, mode: 'insensitive' } },
                                { content: { contains: area, mode: 'insensitive' } },
                            ],
                        },
                        select: { id: true },
                        take: 5, // Limit results
                    });

                    affectedDocs.push(...adminDocs.map(d => ({ id: d.id, type: 'admin' as const })));
                }
            }

            // Remove duplicates
            const uniqueDocs = Array.from(
                new Map(affectedDocs.map(d => [d.id, d])).values()
            );

            return uniqueDocs;
        } catch (error) {
            console.error('[DocumentationHook] Error finding affected documents:', error);
            return [];
        }
    }

    // ==========================================================================
    // Private Helper Methods
    // ==========================================================================

    /**
     * Determine if task has documentation impact
     */
    private hasDocumentationImpact(content: string): boolean {
        // Keywords that indicate documentation impact
        const impactKeywords = [
            'feature', 'api', 'endpoint', 'ui', 'interface', 'configuration',
            'setting', 'option', 'integration', 'workflow', 'process',
            'authentication', 'authorization', 'security', 'performance',
            'monitoring', 'alert', 'notification', 'report', 'dashboard',
            'user', 'admin', 'tenant', 'product', 'price', 'competitor',
        ];

        // Keywords that indicate no documentation impact
        const noImpactKeywords = [
            'refactor', 'cleanup', 'test', 'lint', 'format', 'comment',
            'typo', 'whitespace', 'internal', 'private', 'debug',
        ];

        // Check for no-impact keywords first
        const hasNoImpact = noImpactKeywords.some(keyword => content.includes(keyword));
        if (hasNoImpact) {
            return false;
        }

        // Check for impact keywords
        return impactKeywords.some(keyword => content.includes(keyword));
    }

    /**
     * Identify the type of impact
     */
    private identifyImpactType(content: string): DocumentationImpact['impactType'] {
        if (content.includes('feature') || content.includes('new') || content.includes('add')) {
            return 'feature';
        }
        if (content.includes('fix') || content.includes('bug') || content.includes('issue')) {
            return 'bugfix';
        }
        if (content.includes('config') || content.includes('setting') || content.includes('environment')) {
            return 'configuration';
        }
        if (content.includes('api') || content.includes('endpoint') || content.includes('route')) {
            return 'api';
        }
        if (content.includes('ui') || content.includes('interface') || content.includes('dashboard')) {
            return 'ui';
        }
        return 'feature'; // Default
    }

    /**
     * Identify affected documentation areas
     */
    private identifyAffectedAreas(content: string, impactType: DocumentationImpact['impactType']): string[] {
        const areas: string[] = [];

        // Area keywords mapping
        const areaKeywords: Record<string, string[]> = {
            'authentication': ['auth', 'login', 'password', 'session', 'token'],
            'products': ['product', 'sku', 'inventory', 'catalog'],
            'competitors': ['competitor', 'scraping', 'crawl', 'scrape'],
            'pricing': ['price', 'pricing', 'update', 'strategy'],
            'integrations': ['integration', 'opencart', 'laravel', 'plugin', 'module'],
            'monitoring': ['monitor', 'alert', 'notification', 'metric'],
            'security': ['security', 'encryption', 'permission', 'role'],
            'performance': ['performance', 'cache', 'optimization', 'speed'],
            'api': ['api', 'endpoint', 'rest', 'webhook'],
            'dashboard': ['dashboard', 'ui', 'interface', 'report'],
        };

        // Check each area
        for (const [area, keywords] of Object.entries(areaKeywords)) {
            if (keywords.some(keyword => content.includes(keyword))) {
                areas.push(area);
            }
        }

        // If no specific areas found, use impact type as area
        if (areas.length === 0) {
            areas.push(impactType);
        }

        return areas;
    }

    /**
     * Generate suggested update content
     */
    private generateSuggestedUpdates(
        task: Task,
        impactType: DocumentationImpact['impactType'],
        affectedAreas: string[]
    ): string[] {
        const updates: string[] = [];

        // Generate update suggestions based on impact type
        switch (impactType) {
            case 'feature':
                updates.push(`Document new feature: ${task.title}`);
                updates.push(`Add usage examples for ${task.title}`);
                updates.push(`Update getting started guide if applicable`);
                break;
            case 'api':
                updates.push(`Document new API endpoint or changes`);
                updates.push(`Update API reference documentation`);
                updates.push(`Add request/response examples`);
                break;
            case 'ui':
                updates.push(`Update UI screenshots if applicable`);
                updates.push(`Document new UI elements or workflows`);
                updates.push(`Update user guide with new interface`);
                break;
            case 'configuration':
                updates.push(`Document new configuration options`);
                updates.push(`Update environment variables guide`);
                updates.push(`Add configuration examples`);
                break;
            case 'bugfix':
                updates.push(`Update troubleshooting guide if applicable`);
                updates.push(`Document workaround or fix`);
                break;
        }

        // Add area-specific updates
        for (const area of affectedAreas) {
            updates.push(`Review and update ${area} documentation`);
        }

        return updates;
    }

    /**
     * Generate suggestion content
     */
    private generateSuggestionContent(task: Task, impact: DocumentationImpact): string {
        let content = `# Documentation Update Suggestion\n\n`;
        content += `**Task:** ${task.title}\n\n`;
        content += `**Description:** ${task.description}\n\n`;
        content += `**Impact Type:** ${impact.impactType}\n\n`;
        content += `**Affected Areas:** ${impact.affectedAreas.join(', ')}\n\n`;
        content += `## Suggested Updates\n\n`;

        for (const update of impact.suggestedUpdates) {
            content += `- ${update}\n`;
        }

        content += `\n## Notes\n\n`;
        content += `This suggestion was automatically generated based on task completion. `;
        content += `Please review and update the relevant documentation sections.\n`;

        return content;
    }

    /**
     * Generate document title for new documents
     */
    private generateDocumentTitle(task: Task, type: 'tenant' | 'admin'): string {
        const prefix = type === 'admin' ? 'Admin Guide:' : 'User Guide:';
        return `${prefix} ${task.title}`;
    }

    /**
     * Infer category from task
     */
    private inferCategory(task: Task, type: 'tenant' | 'admin'): string {
        const content = `${task.title} ${task.description}`.toLowerCase();

        if (type === 'tenant') {
            if (content.includes('product')) return 'products';
            if (content.includes('competitor')) return 'competitors';
            if (content.includes('price') || content.includes('pricing')) return 'pricing';
            if (content.includes('integration') || content.includes('opencart') || content.includes('laravel')) return 'integrations';
            if (content.includes('troubleshoot') || content.includes('error')) return 'troubleshooting';
            return 'getting-started';
        } else {
            if (content.includes('monitor') || content.includes('alert')) return 'system-monitoring';
            if (content.includes('tenant') || content.includes('user')) return 'tenant-management';
            if (content.includes('database') || content.includes('migration')) return 'database';
            if (content.includes('security') || content.includes('auth')) return 'security';
            if (content.includes('performance') || content.includes('cache')) return 'performance';
            if (content.includes('alert') || content.includes('notification')) return 'alerting';
            return 'system-monitoring';
        }
    }

    /**
     * Create suggestion in database
     * Requirement 5.7: Maintain audit log of all suggestions
     */
    private async createSuggestion(data: {
        documentId?: string;
        suggestedTitle?: string;
        suggestedContent: string;
        targetType: 'tenant' | 'admin';
        category: string;
        taskId: string;
    }): Promise<DocumentationSuggestion> {
        const docType = data.targetType === 'tenant' ? DocumentationType.TENANT : DocumentationType.ADMIN;

        const suggestion = await prisma.documentationSuggestion.create({
            data: {
                documentId: data.documentId,
                suggestedTitle: data.suggestedTitle,
                suggestedContent: data.suggestedContent,
                targetType: docType,
                category: data.category,
                status: DocumentationSuggestionStatus.PENDING,
                taskId: data.taskId,
            },
        });

        // Log suggestion generation
        await documentationMonitor.logSuggestionGeneration(
            suggestion.id,
            data.documentId || null,
            docType,
            data.taskId,
            {
                category: data.category,
                hasTitle: !!data.suggestedTitle,
                contentLength: data.suggestedContent.length,
            }
        );

        return {
            id: suggestion.id,
            documentId: suggestion.documentId || undefined,
            suggestedTitle: suggestion.suggestedTitle || undefined,
            suggestedContent: suggestion.suggestedContent,
            targetType: data.targetType,
            category: suggestion.category,
            status: 'pending',
            createdAt: suggestion.createdAt,
            reviewedBy: suggestion.reviewedBy || undefined,
            reviewedAt: suggestion.reviewedAt || undefined,
        };
    }

    /**
     * Check if code change affects documentation
     */
    private doesChangeAffectDocumentation(change: CodeChange): boolean {
        // Files that typically affect documentation
        const documentationFiles = [
            '/api/', '/app/api/', '/routes/',
            '/components/', '/app/',
            '/lib/services/', '/lib/utils/',
            'schema.prisma', 'package.json',
        ];

        return documentationFiles.some(pattern => change.file.includes(pattern));
    }

    /**
     * Infer category from file path
     */
    private inferCategoryFromFile(file: string): string {
        if (file.includes('/api/')) return 'api';
        if (file.includes('/components/')) return 'ui';
        if (file.includes('/services/')) return 'backend';
        if (file.includes('schema.prisma')) return 'database';
        return 'general';
    }
}

// Export singleton instance
export const documentationHook = new DocumentationHook();
