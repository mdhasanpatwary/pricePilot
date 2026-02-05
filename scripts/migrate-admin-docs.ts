/**
 * Admin Documentation Migration Script
 * 
 * Migrates admin-facing documentation from /docs to /docs-content/admin/
 * - Organizes by category
 * - Adds frontmatter metadata
 * - Updates internal links
 */

import fs from 'fs';
import path from 'path';

interface AdminDoc {
    filename: string;
    category: string;
    title: string;
    description: string;
    tags: string[];
}

// Admin documents to migrate (from audit - 46 files)
const ADMIN_DOCS: AdminDoc[] = [
    // System Monitoring (34 docs)
    {
        filename: 'ADMIN_TROUBLESHOOTING_GUIDE.md',
        category: 'system-monitoring',
        title: 'Admin Troubleshooting Guide',
        description: 'Comprehensive troubleshooting guide for system administrators',
        tags: ['troubleshooting', 'admin', 'guide']
    },
    {
        filename: 'ALERT_ACKNOWLEDGMENT_QUICK_REFERENCE.md',
        category: 'system-monitoring',
        title: 'Alert Acknowledgment Quick Reference',
        description: 'Quick reference for acknowledging system alerts',
        tags: ['alerts', 'monitoring', 'quick-reference']
    },
    {
        filename: 'ALERT_HISTORY_TRACKING.md',
        category: 'system-monitoring',
        title: 'Alert History Tracking',
        description: 'Tracking and analyzing alert history',
        tags: ['alerts', 'history', 'monitoring']
    },
    {
        filename: 'ALERT_NOTIFICATIONS.md',
        category: 'system-monitoring',
        title: 'Alert Notifications',
        description: 'Configuring and managing alert notifications',
        tags: ['alerts', 'notifications', 'configuration']
    },
    {
        filename: 'ALERT_THRESHOLD_CONFIGURATION.md',
        category: 'system-monitoring',
        title: 'Alert Threshold Configuration',
        description: 'Setting up alert thresholds for system metrics',
        tags: ['alerts', 'thresholds', 'configuration']
    },
    {
        filename: 'API_TOKEN_MIGRATION_GUIDE.md',
        category: 'system-monitoring',
        title: 'API Token Migration Guide',
        description: 'Guide for migrating API tokens to new encryption system',
        tags: ['api', 'tokens', 'migration']
    },
    {
        filename: 'AUTO_APPROVAL_ADMIN_GUIDE.md',
        category: 'system-monitoring',
        title: 'Auto Approval Admin Guide',
        description: 'Administrative guide for auto-approval system configuration',
        tags: ['auto-approval', 'admin', 'configuration']
    },
    {
        filename: 'CACHE_ALERTING.md',
        category: 'system-monitoring',
        title: 'Cache Alerting',
        description: 'Setting up alerts for cache performance and issues',
        tags: ['cache', 'alerts', 'monitoring']
    },
    {
        filename: 'CACHE_DEPLOYMENT_CHECKLIST.md',
        category: 'system-monitoring',
        title: 'Cache Deployment Checklist',
        description: 'Checklist for deploying cache infrastructure',
        tags: ['cache', 'deployment', 'checklist']
    },
    {
        filename: 'CACHE_INVALIDATION_PATTERNS.md',
        category: 'system-monitoring',
        title: 'Cache Invalidation Patterns',
        description: 'Patterns and strategies for cache invalidation',
        tags: ['cache', 'invalidation', 'patterns']
    },
    {
        filename: 'CACHE_MONITORING.md',
        category: 'system-monitoring',
        title: 'Cache Monitoring',
        description: 'Monitoring cache performance and health',
        tags: ['cache', 'monitoring', 'performance']
    },
    {
        filename: 'CACHE_TROUBLESHOOTING.md',
        category: 'system-monitoring',
        title: 'Cache Troubleshooting',
        description: 'Troubleshooting common cache issues',
        tags: ['cache', 'troubleshooting', 'issues']
    },
    {
        filename: 'DATA_CLEANUP_JOBS.md',
        category: 'system-monitoring',
        title: 'Data Cleanup Jobs',
        description: 'Automated data cleanup and retention policies',
        tags: ['data', 'cleanup', 'automation']
    },
    {
        filename: 'DEPLOYMENT_GUIDE.md',
        category: 'system-monitoring',
        title: 'Deployment Guide',
        description: 'Complete guide for deploying PricePilot',
        tags: ['deployment', 'guide', 'operations']
    },
    {
        filename: 'DOCUMENTATION_INDEX.md',
        category: 'system-monitoring',
        title: 'Documentation Index',
        description: 'Complete index of system documentation',
        tags: ['documentation', 'index', 'reference']
    },
    {
        filename: 'MONITORING_ALERT_ACKNOWLEDGMENT.md',
        category: 'system-monitoring',
        title: 'Monitoring Alert Acknowledgment',
        description: 'Acknowledging and managing monitoring alerts',
        tags: ['monitoring', 'alerts', 'acknowledgment']
    },
    {
        filename: 'MONITORING_DEPLOYMENT_CHECKLIST.md',
        category: 'system-monitoring',
        title: 'Monitoring Deployment Checklist',
        description: 'Checklist for deploying monitoring infrastructure',
        tags: ['monitoring', 'deployment', 'checklist']
    },
    {
        filename: 'MONITORING_ENVIRONMENT_VARIABLES.md',
        category: 'system-monitoring',
        title: 'Monitoring Environment Variables',
        description: 'Environment variables for monitoring configuration',
        tags: ['monitoring', 'environment', 'configuration']
    },
    {
        filename: 'MONITORING_INFRASTRUCTURE_SETUP.md',
        category: 'system-monitoring',
        title: 'Monitoring Infrastructure Setup',
        description: 'Setting up monitoring infrastructure',
        tags: ['monitoring', 'infrastructure', 'setup']
    },
    {
        filename: 'MONITORING_README.md',
        category: 'system-monitoring',
        title: 'Monitoring System Overview',
        description: 'Overview of the PricePilot monitoring system',
        tags: ['monitoring', 'overview', 'readme']
    },
    {
        filename: 'MONITORING_SYSTEM.md',
        category: 'system-monitoring',
        title: 'Monitoring System',
        description: 'Complete monitoring system documentation',
        tags: ['monitoring', 'system', 'documentation']
    },
    {
        filename: 'MONITORING_TROUBLESHOOTING.md',
        category: 'system-monitoring',
        title: 'Monitoring Troubleshooting',
        description: 'Troubleshooting monitoring system issues',
        tags: ['monitoring', 'troubleshooting', 'issues']
    },
    {
        filename: 'RATE_LIMITING.md',
        category: 'system-monitoring',
        title: 'Rate Limiting',
        description: 'Rate limiting configuration and monitoring',
        tags: ['rate-limiting', 'security', 'configuration']
    },
    {
        filename: 'REDIS_CONFIGURATION.md',
        category: 'system-monitoring',
        title: 'Redis Configuration',
        description: 'Configuring Redis for PricePilot',
        tags: ['redis', 'configuration', 'cache']
    },
    {
        filename: 'REDIS_FREE_TIER_GUIDE.md',
        category: 'system-monitoring',
        title: 'Redis Free Tier Guide',
        description: 'Using Redis free tier for development',
        tags: ['redis', 'free-tier', 'development']
    },
    {
        filename: 'REDIS_MEMORY_CONFIGURATION.md',
        category: 'system-monitoring',
        title: 'Redis Memory Configuration',
        description: 'Optimizing Redis memory configuration',
        tags: ['redis', 'memory', 'optimization']
    },
    {
        filename: 'RESULT_SELECTION_LOGIC.md',
        category: 'system-monitoring',
        title: 'Result Selection Logic',
        description: 'Logic for selecting and prioritizing results',
        tags: ['logic', 'selection', 'algorithms']
    },
    {
        filename: 'RETRY_QUEUE.md',
        category: 'system-monitoring',
        title: 'Retry Queue',
        description: 'Retry queue system for failed operations',
        tags: ['retry', 'queue', 'reliability']
    },
    {
        filename: 'RUNBOOK.md',
        category: 'system-monitoring',
        title: 'Operations Runbook',
        description: 'Operational procedures and runbook',
        tags: ['operations', 'runbook', 'procedures']
    },
    {
        filename: 'SCRAPING_LOG_MANAGEMENT.md',
        category: 'system-monitoring',
        title: 'Scraping Log Management',
        description: 'Managing and analyzing scraping logs',
        tags: ['scraping', 'logs', 'management']
    },
    {
        filename: 'SECURITY_INCIDENT_PREVENTION.md',
        category: 'system-monitoring',
        title: 'Security Incident Prevention',
        description: 'Preventing and responding to security incidents',
        tags: ['security', 'incidents', 'prevention']
    },
    {
        filename: 'STEALTH_SCRAPING.md',
        category: 'system-monitoring',
        title: 'Stealth Scraping',
        description: 'Stealth scraping techniques and configuration',
        tags: ['scraping', 'stealth', 'techniques']
    },
    {
        filename: 'UPSTASH_DASHBOARD_SETUP.md',
        category: 'system-monitoring',
        title: 'Upstash Dashboard Setup',
        description: 'Setting up Upstash Redis dashboard',
        tags: ['upstash', 'redis', 'setup']
    },
    {
        filename: 'UPTIME_MONITORING.md',
        category: 'system-monitoring',
        title: 'Uptime Monitoring',
        description: 'Monitoring system uptime and availability',
        tags: ['uptime', 'monitoring', 'availability']
    },

    // Security (5 docs)
    {
        filename: 'ARCHITECTURE.md',
        category: 'security',
        title: 'System Architecture',
        description: 'PricePilot system architecture and design',
        tags: ['architecture', 'design', 'system']
    },
    {
        filename: 'AUTHENTICATION_GUIDE.md',
        category: 'security',
        title: 'Authentication Guide',
        description: 'Authentication system configuration and management',
        tags: ['authentication', 'security', 'guide']
    },
    {
        filename: 'CORS_CONFIGURATION.md',
        category: 'security',
        title: 'CORS Configuration',
        description: 'Configuring CORS for API security',
        tags: ['cors', 'security', 'configuration']
    },
    {
        filename: 'ERROR_HANDLING_CLEANUP_SUMMARY.md',
        category: 'security',
        title: 'Error Handling Cleanup Summary',
        description: 'Summary of error handling improvements',
        tags: ['errors', 'cleanup', 'summary']
    },
    {
        filename: 'SECURITY_CHECKLIST.md',
        category: 'security',
        title: 'Security Checklist',
        description: 'Security checklist for deployments',
        tags: ['security', 'checklist', 'deployment']
    },

    // Performance (3 docs)
    {
        filename: 'DEPLOYMENT.md',
        category: 'performance',
        title: 'Deployment',
        description: 'Deployment procedures and best practices',
        tags: ['deployment', 'operations', 'procedures']
    },
    {
        filename: 'DISTRIBUTED_CACHE_INVALIDATION.md',
        category: 'performance',
        title: 'Distributed Cache Invalidation',
        description: 'Invalidating caches across distributed systems',
        tags: ['cache', 'distributed', 'invalidation']
    },
    {
        filename: 'PERFORMANCE_MONITORING.md',
        category: 'performance',
        title: 'Performance Monitoring',
        description: 'Monitoring system performance metrics',
        tags: ['performance', 'monitoring', 'metrics']
    },

    // Database (3 docs)
    {
        filename: 'ADMIN_DASHBOARD_DEPLOYMENT.md',
        category: 'database',
        title: 'Admin Dashboard Deployment',
        description: 'Deploying and configuring the admin dashboard',
        tags: ['admin', 'dashboard', 'deployment']
    },
    {
        filename: 'DATABASE_INDEXES_QUICK_REFERENCE.md',
        category: 'database',
        title: 'Database Indexes Quick Reference',
        description: 'Quick reference for database indexes',
        tags: ['database', 'indexes', 'quick-reference']
    },
    {
        filename: 'SQL_INJECTION_AUDIT_REPORT.md',
        category: 'database',
        title: 'SQL Injection Audit Report',
        description: 'SQL injection vulnerability audit report',
        tags: ['sql-injection', 'security', 'audit']
    },

    // Alerting (1 doc)
    {
        filename: 'MONITORING_NOTIFICATION_SETUP.md',
        category: 'alerting',
        title: 'Monitoring Notification Setup',
        description: 'Setting up monitoring notifications',
        tags: ['monitoring', 'notifications', 'setup']
    }
];

function generateFrontmatter(doc: AdminDoc): string {
    return `---
title: "${doc.title}"
description: "${doc.description}"
category: "${doc.category}"
tags: [${doc.tags.map(t => `"${t}"`).join(', ')}]
audience: "admin"
---

`;
}

function updateInternalLinks(content: string): string {
    // Update links from /docs/FILE.md to /admin-docs/category/file
    let updated = content.replace(
        /\[([^\]]+)\]\((?:\/docs\/)?([A-Z_]+)\.md\)/g,
        (match, text, filename) => {
            // Find the document in our list
            const doc = ADMIN_DOCS.find(d => d.filename === `${filename}.md`);
            if (doc) {
                const slug = filename.toLowerCase().replace(/_/g, '-');
                return `[${text}](/admin-docs/${doc.category}/${slug})`;
            }
            return match; // Keep original if not found
        }
    );

    return updated;
}

function migrateDocument(doc: AdminDoc): void {
    const sourcePath = path.join(process.cwd(), 'docs', doc.filename);
    const targetDir = path.join(process.cwd(), 'docs-content', 'admin', doc.category);
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

function migrateAdminDocs(): void {
    console.log('\n📕 Migrating Admin Documentation\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    const byCategory: Record<string, AdminDoc[]> = {};

    // Group by category
    for (const doc of ADMIN_DOCS) {
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
    console.log(`✅ Successfully migrated ${ADMIN_DOCS.length} admin documents\n`);
}

// Run migration
migrateAdminDocs();
