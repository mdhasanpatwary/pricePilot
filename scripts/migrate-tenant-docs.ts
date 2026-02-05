/**
 * Tenant Documentation Migration Script
 * 
 * Migrates tenant-facing documentation from /docs to /docs-content/tenant/
 * - Organizes by category
 * - Adds frontmatter metadata
 * - Updates internal links
 */

import fs from 'fs';
import path from 'path';

interface TenantDoc {
    filename: string;
    category: string;
    title: string;
    description: string;
    tags: string[];
}

// Tenant documents to migrate (from audit)
const TENANT_DOCS: TenantDoc[] = [
    // Getting Started
    {
        filename: 'XSS_PREVENTION_QUICK_REFERENCE.md',
        category: 'getting-started',
        title: 'XSS Prevention Quick Reference',
        description: 'Quick reference guide for preventing cross-site scripting attacks',
        tags: ['security', 'xss', 'quick-reference']
    },

    // Pricing
    {
        filename: 'API_DOCUMENTATION_INDEX.md',
        category: 'pricing',
        title: 'API Documentation Index',
        description: 'Complete index of PricePilot API documentation',
        tags: ['api', 'reference', 'index']
    },
    {
        filename: 'API_REQUEST_RESPONSE_EXAMPLES.md',
        category: 'pricing',
        title: 'API Request and Response Examples',
        description: 'Examples of API requests and responses for common operations',
        tags: ['api', 'examples', 'tutorial']
    },
    {
        filename: 'API_USAGE_EXAMPLES.md',
        category: 'pricing',
        title: 'API Usage Examples',
        description: 'Practical examples of using the PricePilot API',
        tags: ['api', 'examples', 'tutorial']
    },
    {
        filename: 'BOT_PROTECTION_USER_GUIDE.md',
        category: 'pricing',
        title: 'Bot Protection User Guide',
        description: 'Guide for understanding and working with bot protection features',
        tags: ['bot-protection', 'security', 'guide']
    },
    {
        filename: 'BULK_APPROVAL_OPTIMIZATION.md',
        category: 'pricing',
        title: 'Bulk Approval Optimization',
        description: 'Optimize bulk price approval workflows for efficiency',
        tags: ['bulk-operations', 'approval', 'optimization']
    },
    {
        filename: 'INPUT_VALIDATION_GUIDE.md',
        category: 'pricing',
        title: 'Input Validation Guide',
        description: 'Best practices for input validation in price updates',
        tags: ['validation', 'security', 'best-practices']
    },
    {
        filename: 'LOGGING_GUIDELINES.md',
        category: 'pricing',
        title: 'Logging Guidelines',
        description: 'Guidelines for understanding system logs and audit trails',
        tags: ['logging', 'audit', 'troubleshooting']
    },
    {
        filename: 'PRICE_APPROVAL_GUIDE.md',
        category: 'pricing',
        title: 'Price Approval Guide',
        description: 'Complete guide to the price approval workflow',
        tags: ['pricing', 'approval', 'workflow']
    },
    {
        filename: 'ROLLBACK_PROCEDURES.md',
        category: 'pricing',
        title: 'Rollback Procedures',
        description: 'How to rollback price changes when needed',
        tags: ['rollback', 'pricing', 'procedures']
    },
    {
        filename: 'ROLLBACK_UI_GUIDE.md',
        category: 'pricing',
        title: 'Rollback UI Guide',
        description: 'Using the rollback interface to revert price changes',
        tags: ['rollback', 'ui', 'guide']
    },
    {
        filename: 'SAFE_QUERY_PATTERNS.md',
        category: 'pricing',
        title: 'Safe Query Patterns',
        description: 'Patterns for safely querying and filtering price data',
        tags: ['queries', 'best-practices', 'safety']
    },

    // Products
    {
        filename: 'FEEDBACK_QUICK_REFERENCE.md',
        category: 'products',
        title: 'Feedback Quick Reference',
        description: 'Quick reference for providing feedback on product matching',
        tags: ['feedback', 'products', 'quick-reference']
    },
    {
        filename: 'ROLLBACK_TESTING_GUIDE.md',
        category: 'products',
        title: 'Rollback Testing Guide',
        description: 'Testing rollback functionality for product changes',
        tags: ['rollback', 'testing', 'products']
    },
    {
        filename: 'SERVICE_ERROR_HANDLING.md',
        category: 'products',
        title: 'Service Error Handling',
        description: 'Understanding and handling service errors',
        tags: ['errors', 'troubleshooting', 'services']
    },
    {
        filename: 'SKU_GENERATION_STRATEGY.md',
        category: 'products',
        title: 'SKU Generation Strategy',
        description: 'Strategies for generating and managing product SKUs',
        tags: ['sku', 'products', 'strategy']
    },
    {
        filename: 'SQL_INJECTION_QUICK_REFERENCE.md',
        category: 'products',
        title: 'SQL Injection Prevention Quick Reference',
        description: 'Quick reference for preventing SQL injection in product queries',
        tags: ['security', 'sql-injection', 'quick-reference']
    },

    // Troubleshooting
    {
        filename: 'ACCESSIBILITY_GUIDE.md',
        category: 'troubleshooting',
        title: 'Accessibility Guide',
        description: 'Accessibility features and guidelines for PricePilot',
        tags: ['accessibility', 'wcag', 'guide']
    },
    {
        filename: 'API_DOCUMENTATION_SETUP.md',
        category: 'troubleshooting',
        title: 'API Documentation Setup',
        description: 'Setting up and accessing API documentation',
        tags: ['api', 'setup', 'documentation']
    },
    {
        filename: 'API_VALIDATION_GUIDE.md',
        category: 'troubleshooting',
        title: 'API Validation Guide',
        description: 'Understanding API validation errors and how to fix them',
        tags: ['api', 'validation', 'troubleshooting']
    },
    {
        filename: 'CACHE_WARMING_STRATEGIES.md',
        category: 'troubleshooting',
        title: 'Cache Warming Strategies',
        description: 'Strategies for warming caches to improve performance',
        tags: ['cache', 'performance', 'optimization']
    },
    {
        filename: 'TENANT_GUIDE.md',
        category: 'troubleshooting',
        title: 'Tenant Guide',
        description: 'Complete guide for PricePilot tenants',
        tags: ['tenant', 'guide', 'overview']
    },

    // Competitors
    {
        filename: 'XSS_PREVENTION_GUIDE.md',
        category: 'competitors',
        title: 'XSS Prevention Guide',
        description: 'Comprehensive guide to preventing cross-site scripting attacks',
        tags: ['security', 'xss', 'guide']
    },

    // Integrations
    {
        filename: 'PRICE_UPDATE_API_TESTING_GUIDE.md',
        category: 'integrations',
        title: 'Price Update API Testing Guide',
        description: 'Testing price update API integrations',
        tags: ['api', 'testing', 'integration']
    }
];

function generateFrontmatter(doc: TenantDoc): string {
    return `---
title: "${doc.title}"
description: "${doc.description}"
category: "${doc.category}"
tags: [${doc.tags.map(t => `"${t}"`).join(', ')}]
audience: "tenant"
---

`;
}

function updateInternalLinks(content: string): string {
    // Update links from /docs/FILE.md to /docs/category/file
    // This is a simplified version - full implementation would need more sophisticated parsing

    // Pattern: [text](FILE.md) or [text](/docs/FILE.md)
    let updated = content.replace(
        /\[([^\]]+)\]\((?:\/docs\/)?([A-Z_]+)\.md\)/g,
        (match, text, filename) => {
            // Find the document in our list
            const doc = TENANT_DOCS.find(d => d.filename === `${filename}.md`);
            if (doc) {
                const slug = filename.toLowerCase().replace(/_/g, '-');
                return `[${text}](/docs/${doc.category}/${slug})`;
            }
            return match; // Keep original if not found
        }
    );

    return updated;
}

function migrateDocument(doc: TenantDoc): void {
    const sourcePath = path.join(process.cwd(), 'docs', doc.filename);
    const targetDir = path.join(process.cwd(), 'docs-content', 'tenant', doc.category);
    const targetFilename = doc.filename.toLowerCase().replace(/_/g, '-');
    const targetPath = path.join(targetDir, targetFilename);

    // Read source content
    if (!fs.existsSync(sourcePath)) {
        console.log(`  ⚠️  Source file not found: ${doc.filename}`);
        return;
    }

    let content = fs.readFileSync(sourcePath, 'utf-8');

    // Remove existing frontmatter if present
    content = content.replace(/^---\n[\s\S]*?\n---\n\n?/, '');

    // Update internal links
    content = updateInternalLinks(content);

    // Add new frontmatter
    const frontmatter = generateFrontmatter(doc);
    const newContent = frontmatter + content;

    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Write to target
    fs.writeFileSync(targetPath, newContent);

    console.log(`  ✓ Migrated: ${doc.filename} → ${doc.category}/${targetFilename}`);
}

function migrateTenantDocs(): void {
    console.log('\n📘 Migrating Tenant Documentation\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    const byCategory: Record<string, TenantDoc[]> = {};

    // Group by category
    for (const doc of TENANT_DOCS) {
        if (!byCategory[doc.category]) {
            byCategory[doc.category] = [];
        }
        byCategory[doc.category].push(doc);
    }

    // Migrate by category
    for (const [category, docs] of Object.entries(byCategory).sort()) {
        console.log(`\n${category.toUpperCase()} (${docs.length} documents):\n`);

        for (const doc of docs) {
            migrateDocument(doc);
        }
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');
    console.log(`✅ Successfully migrated ${TENANT_DOCS.length} tenant documents\n`);
}

// Run migration
migrateTenantDocs();
