#!/usr/bin/env ts-node

/**
 * Documentation Structure Validator
 * 
 * Validates that the documentation file system structure follows
 * the required format defined in the dual-documentation-system spec.
 * 
 * Usage: npx ts-node scripts/validate-docs-structure.ts
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    stats: {
        totalFiles: number;
        tenantFiles: number;
        adminFiles: number;
        categories: {
            tenant: string[];
            admin: string[];
        };
    };
}

interface FrontmatterData {
    title?: string;
    description?: string;
    category?: string;
    subcategory?: string | null;
    tags?: string[];
    author?: string;
    lastReviewed?: string;
    relatedDocs?: string[];
}

const DOCS_ROOT = path.join(process.cwd(), 'docs-content');

const REQUIRED_CATEGORIES = {
    tenant: [
        'getting-started',
        'products',
        'competitors',
        'pricing',
        'integrations',
        'troubleshooting',
    ],
    admin: [
        'system-monitoring',
        'tenant-management',
        'database',
        'security',
        'performance',
        'alerting',
    ],
};

const REQUIRED_FRONTMATTER_FIELDS = [
    'title',
    'description',
    'category',
    'tags',
    'author',
    'lastReviewed',
];

/**
 * Validate directory structure exists
 */
function validateDirectoryStructure(result: ValidationResult): void {
    // Check root directories exist
    const tenantDir = path.join(DOCS_ROOT, 'tenant');
    const adminDir = path.join(DOCS_ROOT, 'admin');

    if (!fs.existsSync(tenantDir)) {
        result.errors.push('Missing /docs-content/tenant/ directory');
        result.valid = false;
    }

    if (!fs.existsSync(adminDir)) {
        result.errors.push('Missing /docs-content/admin/ directory');
        result.valid = false;
    }

    // Check required categories exist
    for (const category of REQUIRED_CATEGORIES.tenant) {
        const categoryDir = path.join(tenantDir, category);
        if (!fs.existsSync(categoryDir)) {
            result.warnings.push(`Missing tenant category directory: ${category}`);
        } else {
            result.stats.categories.tenant.push(category);
        }
    }

    for (const category of REQUIRED_CATEGORIES.admin) {
        const categoryDir = path.join(adminDir, category);
        if (!fs.existsSync(categoryDir)) {
            result.warnings.push(`Missing admin category directory: ${category}`);
        } else {
            result.stats.categories.admin.push(category);
        }
    }
}

/**
 * Validate a single markdown file
 */
function validateMarkdownFile(
    filePath: string,
    type: 'tenant' | 'admin',
    result: ValidationResult
): void {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { data, content: markdownContent } = matter(content);
        const frontmatter = data as FrontmatterData;

        // Check required frontmatter fields
        for (const field of REQUIRED_FRONTMATTER_FIELDS) {
            if (!(field in frontmatter)) {
                result.errors.push(
                    `${filePath}: Missing required frontmatter field: ${field}`
                );
                result.valid = false;
            }
        }

        // Validate frontmatter types
        if (frontmatter.title && typeof frontmatter.title !== 'string') {
            result.errors.push(`${filePath}: 'title' must be a string`);
            result.valid = false;
        }

        if (frontmatter.description && typeof frontmatter.description !== 'string') {
            result.errors.push(`${filePath}: 'description' must be a string`);
            result.valid = false;
        }

        if (frontmatter.category && typeof frontmatter.category !== 'string') {
            result.errors.push(`${filePath}: 'category' must be a string`);
            result.valid = false;
        }

        if (frontmatter.tags && !Array.isArray(frontmatter.tags)) {
            result.errors.push(`${filePath}: 'tags' must be an array`);
            result.valid = false;
        }

        if (frontmatter.relatedDocs && !Array.isArray(frontmatter.relatedDocs)) {
            result.errors.push(`${filePath}: 'relatedDocs' must be an array`);
            result.valid = false;
        }

        // Validate category matches directory
        const relativePath = path.relative(DOCS_ROOT, filePath);
        const pathParts = relativePath.split(path.sep);
        const fileCategory = pathParts[1]; // tenant/[category]/file.md

        if (frontmatter.category && frontmatter.category !== fileCategory) {
            result.warnings.push(
                `${filePath}: Category '${frontmatter.category}' doesn't match directory '${fileCategory}'`
            );
        }

        // Check for empty content
        if (!markdownContent.trim()) {
            result.warnings.push(`${filePath}: File has no content`);
        }

        // Update stats
        result.stats.totalFiles++;
        if (type === 'tenant') {
            result.stats.tenantFiles++;
        } else {
            result.stats.adminFiles++;
        }
    } catch (error) {
        result.errors.push(
            `${filePath}: Failed to parse file - ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        result.valid = false;
    }
}

/**
 * Recursively scan directory for markdown files
 */
function scanDirectory(
    dir: string,
    type: 'tenant' | 'admin',
    result: ValidationResult
): void {
    if (!fs.existsSync(dir)) {
        return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            scanDirectory(fullPath, type, result);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            validateMarkdownFile(fullPath, type, result);
        }
    }
}

/**
 * Main validation function
 */
function validateDocumentation(): ValidationResult {
    const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
        stats: {
            totalFiles: 0,
            tenantFiles: 0,
            adminFiles: 0,
            categories: {
                tenant: [],
                admin: [],
            },
        },
    };

    console.log('🔍 Validating documentation structure...\n');

    // Validate directory structure
    validateDirectoryStructure(result);

    // Scan and validate all markdown files
    const tenantDir = path.join(DOCS_ROOT, 'tenant');
    const adminDir = path.join(DOCS_ROOT, 'admin');

    if (fs.existsSync(tenantDir)) {
        scanDirectory(tenantDir, 'tenant', result);
    }

    if (fs.existsSync(adminDir)) {
        scanDirectory(adminDir, 'admin', result);
    }

    return result;
}

/**
 * Print validation results
 */
function printResults(result: ValidationResult): void {
    console.log('📊 Validation Results\n');
    console.log('Statistics:');
    console.log(`  Total files: ${result.stats.totalFiles}`);
    console.log(`  Tenant files: ${result.stats.tenantFiles}`);
    console.log(`  Admin files: ${result.stats.adminFiles}`);
    console.log(
        `  Tenant categories: ${result.stats.categories.tenant.length}/${REQUIRED_CATEGORIES.tenant.length}`
    );
    console.log(
        `  Admin categories: ${result.stats.categories.admin.length}/${REQUIRED_CATEGORIES.admin.length}`
    );
    console.log();

    if (result.errors.length > 0) {
        console.log('❌ Errors:');
        result.errors.forEach((error) => console.log(`  - ${error}`));
        console.log();
    }

    if (result.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        result.warnings.forEach((warning) => console.log(`  - ${warning}`));
        console.log();
    }

    if (result.valid && result.errors.length === 0) {
        console.log('✅ Documentation structure is valid!');
    } else {
        console.log('❌ Documentation structure has errors.');
    }

    console.log();
    console.log('Categories found:');
    console.log('  Tenant:', result.stats.categories.tenant.join(', '));
    console.log('  Admin:', result.stats.categories.admin.join(', '));
}

// Run validation
if (require.main === module) {
    const result = validateDocumentation();
    printResults(result);

    // Exit with error code if validation failed
    process.exit(result.valid && result.errors.length === 0 ? 0 : 1);
}

export { validateDocumentation };
export type { ValidationResult };

