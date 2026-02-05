/**
 * Documentation Audit Script
 * 
 * Analyzes all existing documentation files in /docs folder and:
 * 1. Catalogs all files
 * 2. Classifies each as tenant, admin, or both
 * 3. Identifies gaps in coverage
 * 4. Maps to new category structure
 */

import fs from 'fs';
import path from 'path';

interface DocumentClassification {
    filename: string;
    path: string;
    classification: 'tenant' | 'admin' | 'both';
    suggestedCategory: string;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
    keywords: string[];
}

interface AuditReport {
    totalDocuments: number;
    tenantDocs: DocumentClassification[];
    adminDocs: DocumentClassification[];
    bothDocs: DocumentClassification[];
    categoryMapping: Record<string, DocumentClassification[]>;
    gaps: string[];
}

// Keywords that indicate admin-facing content
const ADMIN_KEYWORDS = [
    'admin', 'system', 'deployment', 'infrastructure', 'monitoring',
    'database', 'schema', 'migration', 'architecture', 'security',
    'performance', 'optimization', 'cache', 'redis', 'postgresql',
    'server', 'configuration', 'environment', 'logging', 'audit',
    'alert', 'incident', 'troubleshooting', 'maintenance', 'backup',
    'replication', 'scaling', 'load balancing', 'cluster', 'node',
    'worker', 'queue', 'cron', 'scheduler', 'runbook', 'ops',
    'devops', 'sre', 'technical', 'implementation', 'internal'
];

// Keywords that indicate tenant-facing content
const TENANT_KEYWORDS = [
    'user', 'tenant', 'guide', 'tutorial', 'getting started',
    'how to', 'product', 'competitor', 'price', 'pricing',
    'opencart', 'laravel', 'integration', 'setup', 'quick start',
    'faq', 'help', 'support', 'merchant', 'store', 'shop',
    'dashboard', 'report', 'export', 'import', 'bulk',
    'approval', 'workflow', 'notification', 'email', 'feedback'
];

// Keywords that indicate API documentation (often both)
const API_KEYWORDS = [
    'api', 'endpoint', 'request', 'response', 'authentication',
    'authorization', 'token', 'webhook', 'rest', 'graphql'
];

// Category mappings for the new structure
const TENANT_CATEGORIES = {
    'getting-started': ['guide', 'tutorial', 'quick start', 'introduction', 'setup'],
    'products': ['product', 'sku', 'matching', 'catalog'],
    'competitors': ['competitor', 'scraping', 'tracking'],
    'pricing': ['price', 'pricing', 'approval', 'update', 'strategy'],
    'integrations': ['opencart', 'laravel', 'integration', 'plugin', 'module'],
    'troubleshooting': ['troubleshooting', 'faq', 'error', 'issue', 'problem']
};

const ADMIN_CATEGORIES = {
    'system-monitoring': ['monitoring', 'alert', 'metric', 'health', 'uptime', 'performance'],
    'tenant-management': ['tenant', 'user management', 'account', 'subscription'],
    'database': ['database', 'schema', 'migration', 'backup', 'query', 'index'],
    'security': ['security', 'authentication', 'authorization', 'encryption', 'xss', 'sql injection', 'cors'],
    'performance': ['performance', 'optimization', 'cache', 'redis', 'scaling'],
    'alerting': ['alert', 'notification', 'incident', 'threshold']
};

function readFileContent(filePath: string): string {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return '';
    }
}

function classifyDocument(filename: string, content: string): DocumentClassification {
    const lowerContent = content.toLowerCase();
    const lowerFilename = filename.toLowerCase();

    // Count keyword matches
    const adminMatches = ADMIN_KEYWORDS.filter(kw =>
        lowerContent.includes(kw) || lowerFilename.includes(kw)
    );
    const tenantMatches = TENANT_KEYWORDS.filter(kw =>
        lowerContent.includes(kw) || lowerFilename.includes(kw)
    );
    const apiMatches = API_KEYWORDS.filter(kw =>
        lowerContent.includes(kw) || lowerFilename.includes(kw)
    );

    // Determine classification
    let classification: 'tenant' | 'admin' | 'both';
    let confidence: 'high' | 'medium' | 'low';
    let reasoning: string;

    const adminScore = adminMatches.length;
    const tenantScore = tenantMatches.length;
    const apiScore = apiMatches.length;

    // API documentation is often for both audiences
    if (apiScore > 3 && Math.abs(adminScore - tenantScore) < 3) {
        classification = 'both';
        confidence = 'high';
        reasoning = 'API documentation relevant to both tenants and admins';
    }
    // Strong admin indicators
    else if (adminScore > tenantScore * 2 && adminScore > 5) {
        classification = 'admin';
        confidence = 'high';
        reasoning = `Strong admin keywords (${adminScore} matches)`;
    }
    // Strong tenant indicators
    else if (tenantScore > adminScore * 2 && tenantScore > 5) {
        classification = 'tenant';
        confidence = 'high';
        reasoning = `Strong tenant keywords (${tenantScore} matches)`;
    }
    // Moderate admin lean
    else if (adminScore > tenantScore && adminScore > 3) {
        classification = 'admin';
        confidence = 'medium';
        reasoning = `Moderate admin keywords (${adminScore} vs ${tenantScore})`;
    }
    // Moderate tenant lean
    else if (tenantScore > adminScore && tenantScore > 3) {
        classification = 'tenant';
        confidence = 'medium';
        reasoning = `Moderate tenant keywords (${tenantScore} vs ${adminScore})`;
    }
    // Mixed or unclear
    else if (Math.abs(adminScore - tenantScore) < 2) {
        classification = 'both';
        confidence = 'low';
        reasoning = 'Mixed audience indicators - manual review recommended';
    }
    // Default to admin for technical docs
    else {
        classification = 'admin';
        confidence = 'low';
        reasoning = 'Default classification - manual review recommended';
    }

    // Determine suggested category
    const suggestedCategory = determineSuggestedCategory(
        classification,
        filename,
        lowerContent
    );

    return {
        filename,
        path: `docs/${filename}`,
        classification,
        suggestedCategory,
        confidence,
        reasoning,
        keywords: [...new Set([...adminMatches, ...tenantMatches, ...apiMatches])].slice(0, 10)
    };
}

function determineSuggestedCategory(
    classification: 'tenant' | 'admin' | 'both',
    filename: string,
    content: string
): string {
    const categories = classification === 'admin' ? ADMIN_CATEGORIES : TENANT_CATEGORIES;

    let bestCategory = 'general';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(categories)) {
        const score = keywords.filter(kw =>
            content.includes(kw) || filename.toLowerCase().includes(kw)
        ).length;

        if (score > bestScore) {
            bestScore = score;
            bestCategory = category;
        }
    }

    return bestCategory;
}

function identifyGaps(classifications: DocumentClassification[]): string[] {
    const gaps: string[] = [];

    // Check for missing tenant categories
    const tenantDocs = classifications.filter(d => d.classification === 'tenant' || d.classification === 'both');
    const tenantCategories = new Set(tenantDocs.map(d => d.suggestedCategory));

    for (const category of Object.keys(TENANT_CATEGORIES)) {
        if (!tenantCategories.has(category)) {
            gaps.push(`Missing tenant documentation for: ${category}`);
        }
    }

    // Check for missing admin categories
    const adminDocs = classifications.filter(d => d.classification === 'admin' || d.classification === 'both');
    const adminCategories = new Set(adminDocs.map(d => d.suggestedCategory));

    for (const category of Object.keys(ADMIN_CATEGORIES)) {
        if (!adminCategories.has(category)) {
            gaps.push(`Missing admin documentation for: ${category}`);
        }
    }

    // Check for specific important docs
    const filenames = classifications.map(d => d.filename.toLowerCase());

    if (!filenames.some(f => f.includes('getting') && f.includes('start'))) {
        gaps.push('Missing "Getting Started" guide for tenants');
    }

    if (!filenames.some(f => f.includes('quick') && f.includes('start'))) {
        gaps.push('Missing "Quick Start" guide for tenants');
    }

    return gaps;
}

async function auditDocumentation(): Promise<AuditReport> {
    const docsDir = path.join(process.cwd(), 'docs');
    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));

    console.log(`\n📊 Auditing ${files.length} documentation files...\n`);

    const classifications: DocumentClassification[] = [];

    for (const file of files) {
        const filePath = path.join(docsDir, file);
        const content = readFileContent(filePath);
        const classification = classifyDocument(file, content);
        classifications.push(classification);
    }

    // Organize by classification
    const tenantDocs = classifications.filter(d => d.classification === 'tenant');
    const adminDocs = classifications.filter(d => d.classification === 'admin');
    const bothDocs = classifications.filter(d => d.classification === 'both');

    // Organize by category
    const categoryMapping: Record<string, DocumentClassification[]> = {};
    for (const doc of classifications) {
        const key = `${doc.classification}/${doc.suggestedCategory}`;
        if (!categoryMapping[key]) {
            categoryMapping[key] = [];
        }
        categoryMapping[key].push(doc);
    }

    // Identify gaps
    const gaps = identifyGaps(classifications);

    return {
        totalDocuments: files.length,
        tenantDocs,
        adminDocs,
        bothDocs,
        categoryMapping,
        gaps
    };
}

function printReport(report: AuditReport): void {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('           DOCUMENTATION AUDIT REPORT');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`📁 Total Documents: ${report.totalDocuments}\n`);

    console.log(`📘 Tenant Documents: ${report.tenantDocs.length}`);
    console.log(`📕 Admin Documents: ${report.adminDocs.length}`);
    console.log(`📙 Both Audiences: ${report.bothDocs.length}\n`);

    console.log('─────────────────────────────────────────────────────────\n');
    console.log('TENANT DOCUMENTATION\n');

    const tenantByCategory: Record<string, DocumentClassification[]> = {};
    for (const doc of report.tenantDocs) {
        if (!tenantByCategory[doc.suggestedCategory]) {
            tenantByCategory[doc.suggestedCategory] = [];
        }
        tenantByCategory[doc.suggestedCategory].push(doc);
    }

    for (const [category, docs] of Object.entries(tenantByCategory).sort()) {
        console.log(`\n  ${category.toUpperCase()} (${docs.length} docs):`);
        for (const doc of docs) {
            const confidenceIcon = doc.confidence === 'high' ? '✓' : doc.confidence === 'medium' ? '~' : '?';
            console.log(`    ${confidenceIcon} ${doc.filename}`);
        }
    }

    console.log('\n─────────────────────────────────────────────────────────\n');
    console.log('ADMIN DOCUMENTATION\n');

    const adminByCategory: Record<string, DocumentClassification[]> = {};
    for (const doc of report.adminDocs) {
        if (!adminByCategory[doc.suggestedCategory]) {
            adminByCategory[doc.suggestedCategory] = [];
        }
        adminByCategory[doc.suggestedCategory].push(doc);
    }

    for (const [category, docs] of Object.entries(adminByCategory).sort()) {
        console.log(`\n  ${category.toUpperCase()} (${docs.length} docs):`);
        for (const doc of docs) {
            const confidenceIcon = doc.confidence === 'high' ? '✓' : doc.confidence === 'medium' ? '~' : '?';
            console.log(`    ${confidenceIcon} ${doc.filename}`);
        }
    }

    console.log('\n─────────────────────────────────────────────────────────\n');
    console.log('MIXED AUDIENCE DOCUMENTATION\n');

    for (const doc of report.bothDocs) {
        const confidenceIcon = doc.confidence === 'high' ? '✓' : doc.confidence === 'medium' ? '~' : '?';
        console.log(`  ${confidenceIcon} ${doc.filename} → ${doc.suggestedCategory}`);
        console.log(`     ${doc.reasoning}`);
    }

    if (report.gaps.length > 0) {
        console.log('\n─────────────────────────────────────────────────────────\n');
        console.log('IDENTIFIED GAPS\n');
        for (const gap of report.gaps) {
            console.log(`  ⚠️  ${gap}`);
        }
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');
}

function saveReportToFile(report: AuditReport): void {
    const reportPath = path.join(process.cwd(), 'DOCUMENTATION_AUDIT_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}\n`);
}

// Run the audit
auditDocumentation()
    .then(report => {
        printReport(report);
        saveReportToFile(report);
    })
    .catch(error => {
        console.error('Error during audit:', error);
        process.exit(1);
    });
