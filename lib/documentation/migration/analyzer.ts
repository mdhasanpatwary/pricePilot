/**
 * Documentation Analyzer
 * 
 * Analyzes existing documentation files to classify them as tenant, admin, or both.
 * Uses keyword matching, audience indicators, and technical depth analysis.
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface DocumentAnalysis {
    filePath: string;
    fileName: string;
    classification: 'tenant' | 'admin' | 'both';
    confidence: number; // 0-100
    reasons: string[];
    suggestedCategory: string;
    title: string;
    content: string;
    frontmatter?: Record<string, any>;
}

export interface AnalysisReport {
    totalDocuments: number;
    tenantDocs: number;
    adminDocs: number;
    bothDocs: number;
    analyses: DocumentAnalysis[];
    timestamp: Date;
}

// ============================================================================
// Classification Keywords
// ============================================================================

const ADMIN_KEYWORDS = [
    // System administration
    'admin', 'administrator', 'system', 'deployment', 'infrastructure',
    'database', 'schema', 'migration', 'backup', 'restore',

    // Technical operations
    'architecture', 'monitoring', 'alerting', 'performance', 'optimization',
    'caching', 'redis', 'postgresql', 'prisma', 'server',

    // Security and configuration
    'security', 'authentication', 'authorization', 'encryption', 'token',
    'cors', 'headers', 'sql injection', 'xss', 'csrf',

    // Development and maintenance
    'api reference', 'technical', 'runbook', 'troubleshooting guide',
    'configuration', 'environment variables', 'logging', 'audit',

    // Advanced features
    'rate limiting', 'queue', 'worker', 'cron', 'scheduler',
    'replication', 'indexes', 'query optimization', 'materialized views',
];

const TENANT_KEYWORDS = [
    // User-facing features
    'user', 'tenant', 'merchant', 'customer', 'guide', 'tutorial',
    'getting started', 'quick start', 'how to', 'setup',

    // Product features
    'product', 'competitor', 'price', 'pricing', 'approval',
    'scraping', 'matching', 'update', 'rollback',

    // Integrations
    'opencart', 'laravel', 'integration', 'plugin', 'module',
    'installation', 'configuration guide',

    // User operations
    'dashboard', 'report', 'export', 'notification', 'email',
    'feedback', 'satisfaction', 'usage',
];

const BOTH_KEYWORDS = [
    // API documentation (both audiences)
    'api', 'endpoint', 'request', 'response', 'authentication guide',

    // General documentation
    'documentation', 'overview', 'index', 'readme',
];

// ============================================================================
// Category Mapping
// ============================================================================

const CATEGORY_PATTERNS: Record<string, { pattern: RegExp; category: string }[]> = {
    tenant: [
        { pattern: /getting.?started|quick.?start|introduction/i, category: 'getting-started' },
        { pattern: /product|matching|sku/i, category: 'products' },
        { pattern: /competitor|scraping/i, category: 'competitors' },
        { pattern: /price|pricing|approval|update/i, category: 'pricing' },
        { pattern: /opencart|laravel|integration|plugin/i, category: 'integrations' },
        { pattern: /troubleshoot|faq|common.?issue/i, category: 'troubleshooting' },
        { pattern: /rollback|ui|guide/i, category: 'user-guides' },
    ],
    admin: [
        { pattern: /monitor|alert|metric|uptime/i, category: 'system-monitoring' },
        { pattern: /tenant.?management|admin.?guide/i, category: 'tenant-management' },
        { pattern: /database|schema|migration|backup|index/i, category: 'database' },
        { pattern: /security|encryption|cors|xss|sql.?injection/i, category: 'security' },
        { pattern: /performance|cache|optimization|redis/i, category: 'performance' },
        { pattern: /alert|notification.?setup/i, category: 'alerting' },
        { pattern: /deploy|architecture|infrastructure|runbook/i, category: 'deployment' },
        { pattern: /api.?reference|technical/i, category: 'api-reference' },
    ],
};

// ============================================================================
// Document Analyzer Class
// ============================================================================

export class DocumentAnalyzer {
    private docsPath: string;

    constructor(docsPath: string = 'docs') {
        this.docsPath = docsPath;
    }

    /**
     * Scan and analyze all documentation files
     */
    async analyzeAllDocuments(): Promise<AnalysisReport> {
        const files = await this.scanDocumentationFiles();
        const analyses: DocumentAnalysis[] = [];

        for (const file of files) {
            try {
                const analysis = await this.analyzeDocument(file);
                analyses.push(analysis);
            } catch (error) {
                console.error(`Error analyzing ${file}:`, error);
            }
        }

        // Calculate statistics
        const tenantDocs = analyses.filter(a => a.classification === 'tenant').length;
        const adminDocs = analyses.filter(a => a.classification === 'admin').length;
        const bothDocs = analyses.filter(a => a.classification === 'both').length;

        return {
            totalDocuments: analyses.length,
            tenantDocs,
            adminDocs,
            bothDocs,
            analyses,
            timestamp: new Date(),
        };
    }

    /**
     * Analyze a single document
     */
    async analyzeDocument(filePath: string): Promise<DocumentAnalysis> {
        const fullPath = path.join(process.cwd(), this.docsPath, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');

        // Parse frontmatter if exists
        const parsed = matter(content);
        const frontmatter = parsed.data;
        const markdownContent = parsed.content;

        // Extract title
        const title = this.extractTitle(frontmatter, markdownContent, filePath);

        // Analyze content
        const classification = this.classifyDocument(title, markdownContent, filePath);
        const confidence = this.calculateConfidence(title, markdownContent, filePath, classification);
        const reasons = this.generateReasons(title, markdownContent, filePath, classification);
        const suggestedCategory = this.suggestCategory(title, markdownContent, filePath, classification);

        return {
            filePath,
            fileName: path.basename(filePath),
            classification,
            confidence,
            reasons,
            suggestedCategory,
            title,
            content,
            frontmatter,
        };
    }

    /**
     * Scan documentation directory for all markdown files
     */
    private async scanDocumentationFiles(): Promise<string[]> {
        const docsDir = path.join(process.cwd(), this.docsPath);
        const files = await fs.readdir(docsDir);

        // Filter for markdown files only
        return files.filter(file => file.endsWith('.md'));
    }

    /**
     * Extract title from frontmatter, content, or filename
     */
    private extractTitle(
        frontmatter: Record<string, any>,
        content: string,
        filePath: string
    ): string {
        // Try frontmatter first
        if (frontmatter.title) {
            return frontmatter.title;
        }

        // Try first H1 heading
        const h1Match = content.match(/^#\s+(.+)$/m);
        if (h1Match) {
            return h1Match[1].trim();
        }

        // Fall back to filename
        const fileName = path.basename(filePath, '.md');
        return fileName
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    /**
     * Classify document as tenant, admin, or both
     */
    private classifyDocument(
        title: string,
        content: string,
        filePath: string
    ): 'tenant' | 'admin' | 'both' {
        const lowerTitle = title.toLowerCase();
        const lowerContent = content.toLowerCase();
        const lowerFileName = filePath.toLowerCase();

        // Count keyword matches
        let adminScore = 0;
        let tenantScore = 0;
        let bothScore = 0;

        // Check admin keywords
        for (const keyword of ADMIN_KEYWORDS) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const titleMatches = (lowerTitle.match(regex) || []).length * 3; // Title matches worth more
            const contentMatches = (lowerContent.match(regex) || []).length;
            const fileNameMatches = (lowerFileName.match(regex) || []).length * 2;
            adminScore += titleMatches + contentMatches + fileNameMatches;
        }

        // Check tenant keywords
        for (const keyword of TENANT_KEYWORDS) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const titleMatches = (lowerTitle.match(regex) || []).length * 3;
            const contentMatches = (lowerContent.match(regex) || []).length;
            const fileNameMatches = (lowerFileName.match(regex) || []).length * 2;
            tenantScore += titleMatches + contentMatches + fileNameMatches;
        }

        // Check both keywords
        for (const keyword of BOTH_KEYWORDS) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const titleMatches = (lowerTitle.match(regex) || []).length * 3;
            const contentMatches = (lowerContent.match(regex) || []).length;
            bothScore += titleMatches + contentMatches;
        }

        // Analyze technical depth
        const technicalDepth = this.analyzeTechnicalDepth(content);
        if (technicalDepth > 0.7) {
            adminScore += 10;
        } else if (technicalDepth < 0.3) {
            tenantScore += 10;
        }

        // Determine classification
        if (bothScore > 5 && Math.abs(adminScore - tenantScore) < 10) {
            return 'both';
        }

        if (adminScore > tenantScore * 1.5) {
            return 'admin';
        }

        if (tenantScore > adminScore * 1.5) {
            return 'tenant';
        }

        // If scores are close, check for specific patterns
        if (lowerFileName.includes('admin') || lowerTitle.includes('admin')) {
            return 'admin';
        }

        if (lowerFileName.includes('user') || lowerFileName.includes('tenant') || lowerTitle.includes('guide')) {
            return 'tenant';
        }

        // Default to admin if technical, tenant if user-facing
        return adminScore > tenantScore ? 'admin' : 'tenant';
    }

    /**
     * Analyze technical depth of content
     * Returns a score from 0 (user-friendly) to 1 (highly technical)
     */
    private analyzeTechnicalDepth(content: string): number {
        const lowerContent = content.toLowerCase();
        let technicalScore = 0;
        let totalIndicators = 0;

        // Technical indicators
        const technicalIndicators = [
            /```(sql|typescript|javascript|bash|shell)/gi,
            /database|schema|migration|query/gi,
            /api endpoint|rest api|graphql/gi,
            /server|deployment|infrastructure/gi,
            /authentication|authorization|security/gi,
            /performance|optimization|caching/gi,
        ];

        // User-friendly indicators
        const userFriendlyIndicators = [
            /step \d+|first|next|then|finally/gi,
            /click|select|choose|enter/gi,
            /dashboard|interface|screen|page/gi,
            /tutorial|guide|how to|getting started/gi,
        ];

        for (const indicator of technicalIndicators) {
            const matches = (lowerContent.match(indicator) || []).length;
            if (matches > 0) {
                technicalScore += matches;
                totalIndicators += matches;
            }
        }

        for (const indicator of userFriendlyIndicators) {
            const matches = (lowerContent.match(indicator) || []).length;
            if (matches > 0) {
                totalIndicators += matches;
            }
        }

        return totalIndicators > 0 ? technicalScore / totalIndicators : 0.5;
    }

    /**
     * Calculate confidence score for classification
     */
    private calculateConfidence(
        title: string,
        content: string,
        filePath: string,
        classification: 'tenant' | 'admin' | 'both'
    ): number {
        const lowerTitle = title.toLowerCase();
        const lowerFileName = filePath.toLowerCase();

        let confidence = 50; // Base confidence

        // Strong indicators in filename
        if (classification === 'admin' && lowerFileName.includes('admin')) {
            confidence += 30;
        }
        if (classification === 'tenant' && (lowerFileName.includes('user') || lowerFileName.includes('tenant') || lowerFileName.includes('guide'))) {
            confidence += 30;
        }

        // Strong indicators in title
        if (classification === 'admin' && (lowerTitle.includes('admin') || lowerTitle.includes('system') || lowerTitle.includes('technical'))) {
            confidence += 20;
        }
        if (classification === 'tenant' && (lowerTitle.includes('user') || lowerTitle.includes('guide') || lowerTitle.includes('tutorial'))) {
            confidence += 20;
        }

        // Technical depth alignment
        const technicalDepth = this.analyzeTechnicalDepth(content);
        if (classification === 'admin' && technicalDepth > 0.6) {
            confidence += 15;
        }
        if (classification === 'tenant' && technicalDepth < 0.4) {
            confidence += 15;
        }

        // Both classification gets lower confidence
        if (classification === 'both') {
            confidence = Math.min(confidence, 70);
        }

        return Math.min(confidence, 100);
    }

    /**
     * Generate reasons for classification
     */
    private generateReasons(
        title: string,
        content: string,
        filePath: string,
        classification: 'tenant' | 'admin' | 'both'
    ): string[] {
        const reasons: string[] = [];
        const lowerTitle = title.toLowerCase();
        const lowerContent = content.toLowerCase();
        const lowerFileName = filePath.toLowerCase();

        // Filename indicators
        if (lowerFileName.includes('admin')) {
            reasons.push('Filename contains "admin"');
        }
        if (lowerFileName.includes('user') || lowerFileName.includes('tenant')) {
            reasons.push('Filename indicates user/tenant audience');
        }

        // Title indicators
        if (lowerTitle.includes('admin')) {
            reasons.push('Title contains "admin"');
        }
        if (lowerTitle.includes('guide') || lowerTitle.includes('tutorial')) {
            reasons.push('Title indicates user guide/tutorial');
        }

        // Content analysis
        const technicalDepth = this.analyzeTechnicalDepth(content);
        if (technicalDepth > 0.7) {
            reasons.push('High technical depth (database, API, infrastructure)');
        } else if (technicalDepth < 0.3) {
            reasons.push('User-friendly content (step-by-step, UI-focused)');
        }

        // Keyword presence
        const hasAdminKeywords = ADMIN_KEYWORDS.some(kw =>
            lowerContent.includes(kw) || lowerTitle.includes(kw)
        );
        const hasTenantKeywords = TENANT_KEYWORDS.some(kw =>
            lowerContent.includes(kw) || lowerTitle.includes(kw)
        );

        if (hasAdminKeywords && classification === 'admin') {
            reasons.push('Contains admin-specific keywords (monitoring, deployment, security)');
        }
        if (hasTenantKeywords && classification === 'tenant') {
            reasons.push('Contains tenant-specific keywords (product, pricing, integration)');
        }
        if (hasAdminKeywords && hasTenantKeywords && classification === 'both') {
            reasons.push('Contains keywords for both audiences');
        }

        return reasons;
    }

    /**
     * Suggest category for document
     */
    private suggestCategory(
        title: string,
        content: string,
        filePath: string,
        classification: 'tenant' | 'admin' | 'both'
    ): string {
        const lowerTitle = title.toLowerCase();
        const lowerContent = content.toLowerCase();
        const lowerFileName = filePath.toLowerCase();
        const combinedText = `${lowerTitle} ${lowerContent} ${lowerFileName}`;

        const patterns = CATEGORY_PATTERNS[classification === 'both' ? 'tenant' : classification];

        for (const { pattern, category } of patterns) {
            if (pattern.test(combinedText)) {
                return category;
            }
        }

        // Default categories
        if (classification === 'admin') {
            return 'system-administration';
        }
        return 'general';
    }

    /**
     * Generate a formatted report
     */
    generateReport(report: AnalysisReport): string {
        const lines: string[] = [];

        lines.push('# Documentation Analysis Report');
        lines.push('');
        lines.push(`Generated: ${report.timestamp.toISOString()}`);
        lines.push('');
        lines.push('## Summary');
        lines.push('');
        lines.push(`- Total Documents: ${report.totalDocuments}`);
        lines.push(`- Tenant Documents: ${report.tenantDocs} (${Math.round(report.tenantDocs / report.totalDocuments * 100)}%)`);
        lines.push(`- Admin Documents: ${report.adminDocs} (${Math.round(report.adminDocs / report.totalDocuments * 100)}%)`);
        lines.push(`- Both Audiences: ${report.bothDocs} (${Math.round(report.bothDocs / report.totalDocuments * 100)}%)`);
        lines.push('');
        lines.push('## Document Classifications');
        lines.push('');

        // Group by classification
        const byClassification = {
            tenant: report.analyses.filter(a => a.classification === 'tenant'),
            admin: report.analyses.filter(a => a.classification === 'admin'),
            both: report.analyses.filter(a => a.classification === 'both'),
        };

        for (const [classification, docs] of Object.entries(byClassification)) {
            if (docs.length === 0) continue;

            lines.push(`### ${classification.toUpperCase()} (${docs.length} documents)`);
            lines.push('');

            // Sort by confidence (descending)
            docs.sort((a, b) => b.confidence - a.confidence);

            for (const doc of docs) {
                lines.push(`#### ${doc.title}`);
                lines.push(`- **File**: \`${doc.fileName}\``);
                lines.push(`- **Confidence**: ${doc.confidence}%`);
                lines.push(`- **Suggested Category**: ${doc.suggestedCategory}`);
                lines.push(`- **Reasons**:`);
                for (const reason of doc.reasons) {
                    lines.push(`  - ${reason}`);
                }
                lines.push('');
            }
        }

        return lines.join('\n');
    }
}

// Export singleton instance
export const documentAnalyzer = new DocumentAnalyzer();
