/**
 * Mixed-Audience Documentation Migration Script
 * 
 * Handles documentation that serves both tenants and admins
 * - Splits into separate versions where appropriate
 * - Creates cross-references
 * - Ensures no content loss
 */

import fs from 'fs';
import path from 'path';

interface MixedDoc {
    filename: string;
    tenantCategory: string;
    adminCategory: string;
    title: string;
    description: string;
    splitStrategy: 'duplicate' | 'split' | 'reference';
    tenantTags: string[];
    adminTags: string[];
}

// Mixed-audience documents (34 files from audit)
const MIXED_DOCS: MixedDoc[] = [
    {
        filename: 'ADMIN_API_REFERENCE.md',
        tenantCategory: 'integrations',
        adminCategory: 'system-monitoring',
        title: 'Admin API Reference',
        description: 'API reference for administrative operations',
        splitStrategy: 'split',
        tenantTags: ['api', 'reference', 'integration'],
        adminTags: ['api', 'reference', 'admin']
    },
    {
        filename: 'ADMIN_DASHBOARD_ENHANCEMENT_GUIDE.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'system-monitoring',
        title: 'Admin Dashboard Enhancement Guide',
        description: 'Guide for dashboard enhancements',
        splitStrategy: 'duplicate',
        tenantTags: ['dashboard', 'guide', 'features'],
        adminTags: ['dashboard', 'admin', 'configuration']
    },
    {
        filename: 'ADMIN_GUIDE.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'system-monitoring',
        title: 'Admin Guide',
        description: 'Comprehensive administrative guide',
        splitStrategy: 'split',
        tenantTags: ['guide', 'overview', 'help'],
        adminTags: ['admin', 'guide', 'operations']
    },
    {
        filename: 'ALERT_ACKNOWLEDGMENT_GUIDE.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'alerting',
        title: 'Alert Acknowledgment Guide',
        description: 'Guide for acknowledging alerts',
        splitStrategy: 'duplicate',
        tenantTags: ['alerts', 'guide', 'notifications'],
        adminTags: ['alerts', 'acknowledgment', 'monitoring']
    },
    {
        filename: 'ALERT_NOTIFICATIONS_QUICK_REFERENCE.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'alerting',
        title: 'Alert Notifications Quick Reference',
        description: 'Quick reference for alert notifications',
        splitStrategy: 'duplicate',
        tenantTags: ['alerts', 'notifications', 'quick-reference'],
        adminTags: ['alerts', 'notifications', 'configuration']
    },
    {
        filename: 'API_AUTHENTICATION.md',
        tenantCategory: 'integrations',
        adminCategory: 'security',
        title: 'API Authentication',
        description: 'API authentication methods and setup',
        splitStrategy: 'split',
        tenantTags: ['api', 'authentication', 'setup'],
        adminTags: ['api', 'authentication', 'security']
    },
    {
        filename: 'API_ERROR_CODES.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'system-monitoring',
        title: 'API Error Codes',
        description: 'Complete reference of API error codes',
        splitStrategy: 'duplicate',
        tenantTags: ['api', 'errors', 'troubleshooting'],
        adminTags: ['api', 'errors', 'reference']
    },
    {
        filename: 'API_MONITORING.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'system-monitoring',
        title: 'API Monitoring',
        description: 'Monitoring API usage and performance',
        splitStrategy: 'split',
        tenantTags: ['api', 'monitoring', 'usage'],
        adminTags: ['api', 'monitoring', 'metrics']
    },
    {
        filename: 'AUTHENTICATION_TROUBLESHOOTING_QUICK_REFERENCE.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'security',
        title: 'Authentication Troubleshooting Quick Reference',
        description: 'Quick reference for authentication issues',
        splitStrategy: 'duplicate',
        tenantTags: ['authentication', 'troubleshooting', 'quick-reference'],
        adminTags: ['authentication', 'troubleshooting', 'security']
    },
    {
        filename: 'BOT_PROTECTION_API_REFERENCE.md',
        tenantCategory: 'integrations',
        adminCategory: 'security',
        title: 'Bot Protection API Reference',
        description: 'API reference for bot protection features',
        splitStrategy: 'split',
        tenantTags: ['bot-protection', 'api', 'reference'],
        adminTags: ['bot-protection', 'api', 'security']
    },
    {
        filename: 'BOT_PROTECTION_CONFIGURATION_GUIDE.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'security',
        title: 'Bot Protection Configuration Guide',
        description: 'Configuring bot protection features',
        splitStrategy: 'split',
        tenantTags: ['bot-protection', 'configuration', 'guide'],
        adminTags: ['bot-protection', 'configuration', 'security']
    },
    {
        filename: 'BOT_PROTECTION_TROUBLESHOOTING_GUIDE.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'security',
        title: 'Bot Protection Troubleshooting Guide',
        description: 'Troubleshooting bot protection issues',
        splitStrategy: 'duplicate',
        tenantTags: ['bot-protection', 'troubleshooting', 'guide'],
        adminTags: ['bot-protection', 'troubleshooting', 'security']
    },
    {
        filename: 'CACHE_CONFIGURATION.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'performance',
        title: 'Cache Configuration',
        description: 'Cache configuration and optimization',
        splitStrategy: 'split',
        tenantTags: ['cache', 'configuration', 'performance'],
        adminTags: ['cache', 'configuration', 'optimization']
    },
    {
        filename: 'CACHE_QUICK_REFERENCE.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'performance',
        title: 'Cache Quick Reference',
        description: 'Quick reference for cache operations',
        splitStrategy: 'duplicate',
        tenantTags: ['cache', 'quick-reference', 'guide'],
        adminTags: ['cache', 'quick-reference', 'operations']
    },
    {
        filename: 'CORS_QUICK_REFERENCE.md',
        tenantCategory: 'integrations',
        adminCategory: 'security',
        title: 'CORS Quick Reference',
        description: 'Quick reference for CORS configuration',
        splitStrategy: 'split',
        tenantTags: ['cors', 'api', 'quick-reference'],
        adminTags: ['cors', 'security', 'configuration']
    },
    {
        filename: 'EMAIL_NOTIFICATIONS.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'alerting',
        title: 'Email Notifications',
        description: 'Email notification system overview',
        splitStrategy: 'split',
        tenantTags: ['email', 'notifications', 'guide'],
        adminTags: ['email', 'notifications', 'configuration']
    },
    {
        filename: 'EMAIL_NOTIFICATION_GUIDE.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'alerting',
        title: 'Email Notification Guide',
        description: 'Complete guide to email notifications',
        splitStrategy: 'split',
        tenantTags: ['email', 'notifications', 'guide'],
        adminTags: ['email', 'notifications', 'setup']
    },
    {
        filename: 'EMAIL_NOTIFICATION_INTEGRATION_EXAMPLES.md',
        tenantCategory: 'integrations',
        adminCategory: 'alerting',
        title: 'Email Notification Integration Examples',
        description: 'Examples of email notification integrations',
        splitStrategy: 'duplicate',
        tenantTags: ['email', 'notifications', 'examples'],
        adminTags: ['email', 'notifications', 'integration']
    },
    {
        filename: 'ENCRYPTION_QUICK_REFERENCE.md',
        tenantCategory: 'integrations',
        adminCategory: 'security',
        title: 'Encryption Quick Reference',
        description: 'Quick reference for encryption features',
        splitStrategy: 'split',
        tenantTags: ['encryption', 'security', 'quick-reference'],
        adminTags: ['encryption', 'security', 'configuration']
    },
    {
        filename: 'ENVIRONMENT_VARIABLES.md',
        tenantCategory: 'integrations',
        adminCategory: 'system-monitoring',
        title: 'Environment Variables',
        description: 'Environment variable configuration',
        splitStrategy: 'split',
        tenantTags: ['configuration', 'setup', 'environment'],
        adminTags: ['configuration', 'environment', 'deployment']
    },
    {
        filename: 'ERROR_HANDLING_GUIDE.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'system-monitoring',
        title: 'Error Handling Guide',
        description: 'Guide to error handling and recovery',
        splitStrategy: 'split',
        tenantTags: ['errors', 'troubleshooting', 'guide'],
        adminTags: ['errors', 'handling', 'monitoring']
    },
    {
        filename: 'GDPR_COMPLIANCE_GUIDE.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'security',
        title: 'GDPR Compliance Guide',
        description: 'GDPR compliance features and guidelines',
        splitStrategy: 'split',
        tenantTags: ['gdpr', 'compliance', 'privacy'],
        adminTags: ['gdpr', 'compliance', 'security']
    },
    {
        filename: 'INPUT_SANITIZATION.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'security',
        title: 'Input Sanitization',
        description: 'Input sanitization and validation',
        splitStrategy: 'split',
        tenantTags: ['security', 'validation', 'guide'],
        adminTags: ['security', 'sanitization', 'validation']
    },
    {
        filename: 'MIGRATION_GUIDE_V1.5.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'system-monitoring',
        title: 'Migration Guide v1.5',
        description: 'Migration guide for version 1.5',
        splitStrategy: 'split',
        tenantTags: ['migration', 'upgrade', 'guide'],
        adminTags: ['migration', 'upgrade', 'deployment']
    },
    {
        filename: 'MONITORING_ALERT_CONFIGURATION.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'alerting',
        title: 'Monitoring Alert Configuration',
        description: 'Configuring monitoring alerts',
        splitStrategy: 'split',
        tenantTags: ['monitoring', 'alerts', 'configuration'],
        adminTags: ['monitoring', 'alerts', 'setup']
    },
    {
        filename: 'MONITORING_UI.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'system-monitoring',
        title: 'Monitoring UI',
        description: 'Using the monitoring user interface',
        splitStrategy: 'split',
        tenantTags: ['monitoring', 'ui', 'guide'],
        adminTags: ['monitoring', 'ui', 'dashboard']
    },
    {
        filename: 'RETRY_LOGIC.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'system-monitoring',
        title: 'Retry Logic',
        description: 'Understanding retry logic and behavior',
        splitStrategy: 'duplicate',
        tenantTags: ['retry', 'reliability', 'guide'],
        adminTags: ['retry', 'logic', 'configuration']
    },
    {
        filename: 'ROLLBACK_COMPLETE_SUMMARY.md',
        tenantCategory: 'pricing',
        adminCategory: 'system-monitoring',
        title: 'Rollback Complete Summary',
        description: 'Summary of rollback feature implementation',
        splitStrategy: 'split',
        tenantTags: ['rollback', 'summary', 'features'],
        adminTags: ['rollback', 'implementation', 'technical']
    },
    {
        filename: 'ROLLBACK_IMPLEMENTATION_SUMMARY.md',
        tenantCategory: 'pricing',
        adminCategory: 'system-monitoring',
        title: 'Rollback Implementation Summary',
        description: 'Technical summary of rollback implementation',
        splitStrategy: 'reference',
        tenantTags: ['rollback', 'implementation', 'overview'],
        adminTags: ['rollback', 'implementation', 'technical']
    },
    {
        filename: 'SECURITY_HEADERS.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'security',
        title: 'Security Headers',
        description: 'Security headers configuration and usage',
        splitStrategy: 'split',
        tenantTags: ['security', 'headers', 'guide'],
        adminTags: ['security', 'headers', 'configuration']
    },
    {
        filename: 'SECURITY_HEADERS_QUICK_REFERENCE.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'security',
        title: 'Security Headers Quick Reference',
        description: 'Quick reference for security headers',
        splitStrategy: 'duplicate',
        tenantTags: ['security', 'headers', 'quick-reference'],
        adminTags: ['security', 'headers', 'reference']
    },
    {
        filename: 'SITE_PROFILE_EXAMPLES.md',
        tenantCategory: 'competitors',
        adminCategory: 'system-monitoring',
        title: 'Site Profile Examples',
        description: 'Examples of site profiles for scraping',
        splitStrategy: 'split',
        tenantTags: ['scraping', 'examples', 'guide'],
        adminTags: ['scraping', 'profiles', 'configuration']
    },
    {
        filename: 'TEST_INSTANCE_SETUP_GUIDE.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'system-monitoring',
        title: 'Test Instance Setup Guide',
        description: 'Setting up test instances',
        splitStrategy: 'split',
        tenantTags: ['testing', 'setup', 'guide'],
        adminTags: ['testing', 'deployment', 'configuration']
    },
    {
        filename: 'USER_SATISFACTION_GUIDE.md',
        tenantCategory: 'troubleshooting',
        adminCategory: 'system-monitoring',
        title: 'User Satisfaction Guide',
        description: 'User satisfaction metrics and feedback',
        splitStrategy: 'split',
        tenantTags: ['feedback', 'satisfaction', 'guide'],
        adminTags: ['metrics', 'satisfaction', 'monitoring']
    }
];

function generateFrontmatter(doc: MixedDoc, audience: 'tenant' | 'admin'): string {
    const category = audience === 'tenant' ? doc.tenantCategory : doc.adminCategory;
    const tags = audience === 'tenant' ? doc.tenantTags : doc.adminTags;
    const crossRef = audience === 'tenant'
        ? `/admin-docs/${doc.adminCategory}/${doc.filename.toLowerCase().replace(/_/g, '-')}`
        : `/docs/${doc.tenantCategory}/${doc.filename.toLowerCase().replace(/_/g, '-')}`;

    return `---
title: "${doc.title}"
description: "${doc.description}"
category: "${category}"
tags: [${tags.map(t => `"${t}"`).join(', ')}]
audience: "${audience}"
relatedDocs: ["${crossRef}"]
---

`;
}

function migrateDocument(doc: MixedDoc): void {
    const sourcePath = path.join(process.cwd(), 'docs', doc.filename);

    if (!fs.existsSync(sourcePath)) {
        console.log(`  ⚠️  Source file not found: ${doc.filename}`);
        return;
    }

    let content = fs.readFileSync(sourcePath, 'utf-8');

    // Remove existing frontmatter
    content = content.replace(/^---\n[\s\S]*?\n---\n\n?/, '');

    // Handle based on split strategy
    switch (doc.splitStrategy) {
        case 'duplicate':
            // Create identical copies for both audiences
            createTenantVersion(doc, content);
            createAdminVersion(doc, content);
            console.log(`  ✓ Duplicated: ${doc.filename} → tenant & admin`);
            break;

        case 'split':
            // Create simplified tenant version and full admin version
            createTenantVersion(doc, content, true);
            createAdminVersion(doc, content);
            console.log(`  ✓ Split: ${doc.filename} → tenant (simplified) & admin (full)`);
            break;

        case 'reference':
            // Create reference in tenant, full in admin
            createTenantReference(doc);
            createAdminVersion(doc, content);
            console.log(`  ✓ Referenced: ${doc.filename} → tenant (ref) & admin (full)`);
            break;
    }
}

function createTenantVersion(doc: MixedDoc, content: string, simplified: boolean = false): void {
    const targetDir = path.join(process.cwd(), 'docs-content', 'tenant', doc.tenantCategory);
    const targetFilename = doc.filename.toLowerCase().replace(/_/g, '-');
    const targetPath = path.join(targetDir, targetFilename);

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    let finalContent = content;

    if (simplified) {
        // Add note about admin version
        finalContent = `> **Note:** This is a simplified version for tenants. For technical details, administrators can refer to the [admin documentation](/admin-docs/${doc.adminCategory}/${targetFilename}).\n\n` + content;
    }

    const frontmatter = generateFrontmatter(doc, 'tenant');
    fs.writeFileSync(targetPath, frontmatter + finalContent);
}

function createAdminVersion(doc: MixedDoc, content: string): void {
    const targetDir = path.join(process.cwd(), 'docs-content', 'admin', doc.adminCategory);
    const targetFilename = doc.filename.toLowerCase().replace(/_/g, '-');
    const targetPath = path.join(targetDir, targetFilename);

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const frontmatter = generateFrontmatter(doc, 'admin');
    fs.writeFileSync(targetPath, frontmatter + content);
}

function createTenantReference(doc: MixedDoc): void {
    const targetDir = path.join(process.cwd(), 'docs-content', 'tenant', doc.tenantCategory);
    const targetFilename = doc.filename.toLowerCase().replace(/_/g, '-');
    const targetPath = path.join(targetDir, targetFilename);

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const referenceContent = `# ${doc.title}

This is a technical implementation document. For detailed information, please refer to the [admin documentation](/admin-docs/${doc.adminCategory}/${targetFilename}).

## Overview

${doc.description}

For tenant-specific guidance, see related documentation in this section.
`;

    const frontmatter = generateFrontmatter(doc, 'tenant');
    fs.writeFileSync(targetPath, frontmatter + referenceContent);
}

function migrateMixedDocs(): void {
    console.log('\n📙 Migrating Mixed-Audience Documentation\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    for (const doc of MIXED_DOCS) {
        migrateDocument(doc);
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');
    console.log(`✅ Successfully processed ${MIXED_DOCS.length} mixed-audience documents\n`);
    console.log('Strategy breakdown:');
    console.log(`  - Duplicated: ${MIXED_DOCS.filter(d => d.splitStrategy === 'duplicate').length}`);
    console.log(`  - Split: ${MIXED_DOCS.filter(d => d.splitStrategy === 'split').length}`);
    console.log(`  - Referenced: ${MIXED_DOCS.filter(d => d.splitStrategy === 'reference').length}\n`);
}

// Run migration
migrateMixedDocs();
