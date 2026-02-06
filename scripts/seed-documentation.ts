/**
 * Seed Documentation Script
 * 
 * Populates the database with documentation from markdown files in docs-content/
 * 
 * Usage:
 *   npx tsx scripts/seed-documentation.ts [--clean]
 * 
 * Options:
 *   --clean  Delete all existing documentation before seeding
 */

import 'dotenv/config';
import { documentationService } from '@/lib/documentation/service';
import { prisma } from '@/lib/prisma';
import { parseMarkdownFile } from '@/lib/documentation/parser';
import fs from 'fs/promises';
import path from 'path';

interface SeedStats {
    totalFiles: number;
    successfulImports: number;
    failedImports: number;
    skippedFiles: number;
    errors: Array<{ file: string; error: string }>;
}

async function getAllMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                const subFiles = await getAllMarkdownFiles(fullPath);
                files.push(...subFiles);
            } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
                files.push(fullPath);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
    }
    
    return files;
}

function determineDocumentType(filePath: string): 'tenant' | 'admin' | null {
    if (filePath.includes('/docs-content/tenant/')) {
        return 'tenant';
    } else if (filePath.includes('/docs-content/admin/')) {
        return 'admin';
    }
    return null;
}

function extractCategoryFromPath(filePath: string, type: 'tenant' | 'admin'): string {
    const parts = filePath.split(path.sep);
    const typeIndex = parts.findIndex(p => p === type);
    
    if (typeIndex !== -1 && typeIndex + 1 < parts.length) {
        return parts[typeIndex + 1];
    }
    
    return 'general';
}

function generateSlugFromPath(filePath: string, type: 'tenant' | 'admin'): string {
    const parts = filePath.split(path.sep);
    const typeIndex = parts.findIndex(p => p === type);
    
    if (typeIndex !== -1) {
        const relevantParts = parts.slice(typeIndex + 1);
        const slug = relevantParts
            .join('/')
            .replace(/\.md$/, '')
            .toLowerCase();
        return slug;
    }
    
    return path.basename(filePath, '.md').toLowerCase();
}

async function seedDocumentation(clean: boolean = false): Promise<void> {
    console.log('📚 Documentation Seeding Tool\n');
    
    const stats: SeedStats = {
        totalFiles: 0,
        successfulImports: 0,
        failedImports: 0,
        skippedFiles: 0,
        errors: [],
    };
    
    try {
        // Clean existing documentation if requested
        if (clean) {
            console.log('🧹 Cleaning existing documentation...');
            const deleteResult = await prisma.documentationDocument.deleteMany({});
            console.log(`   Deleted ${deleteResult.count} existing documents\n`);
        }
        
        // Get all markdown files
        const docsContentDir = path.join(process.cwd(), 'docs-content');
        console.log(`📂 Scanning ${docsContentDir}...\n`);
        
        const allFiles = await getAllMarkdownFiles(docsContentDir);
        stats.totalFiles = allFiles.length;
        
        console.log(`Found ${allFiles.length} markdown files\n`);
        console.log('📝 Importing documents...\n');
        
        // Process each file
        for (const filePath of allFiles) {
            const relativePath = path.relative(process.cwd(), filePath);
            
            try {
                // Determine document type
                const type = determineDocumentType(filePath);
                
                if (!type) {
                    console.log(`⏭️  Skipping ${relativePath} (not in tenant/ or admin/)`);
                    stats.skippedFiles++;
                    continue;
                }
                
                // Read raw file content
                const rawContent = await fs.readFile(filePath, 'utf-8');
                
                // Try to parse, but handle errors gracefully
                let parsed: any = null;
                let parseError: string | null = null;
                
                try {
                    parsed = await parseMarkdownFile(filePath);
                } catch (error) {
                    parseError = error instanceof Error ? error.message : String(error);
                    // Continue with fallback values
                }
                
                // Extract metadata with fallbacks
                const category = parsed?.frontmatter?.category || extractCategoryFromPath(filePath, type);
                const slug = parsed?.frontmatter?.slug || generateSlugFromPath(filePath, type);
                const title = parsed?.frontmatter?.title || 
                             path.basename(filePath, '.md')
                                 .replace(/-/g, ' ')
                                 .replace(/\b\w/g, l => l.toUpperCase());
                
                // Check if document already exists
                const existing = await documentationService.getDocument(type, slug);
                
                if (existing) {
                    console.log(`⚠️  ${relativePath} already exists (slug: ${slug}), skipping`);
                    stats.skippedFiles++;
                    continue;
                }
                
                // Create markdown content with frontmatter if it doesn't exist
                let contentToStore = rawContent;
                
                if (!rawContent.trim().startsWith('---')) {
                    // Add frontmatter to the content
                    const frontmatter = `---
title: ${title}
category: ${category}
slug: ${slug}
description: ${title}
tags: []
---

`;
                    contentToStore = frontmatter + rawContent;
                }
                
                // Create document
                await documentationService.createDocument(type, {
                    slug,
                    title,
                    content: contentToStore,
                    category,
                    subcategory: parsed?.frontmatter?.subcategory,
                    metadata: {
                        description: parsed?.frontmatter?.description || title,
                        tags: parsed?.frontmatter?.tags || [],
                        author: parsed?.frontmatter?.author,
                        relatedDocs: parsed?.frontmatter?.relatedDocs || [],
                    },
                });
                
                if (parseError) {
                    console.log(`⚠️  ${relativePath} → ${type}/${slug} (with warnings: ${parseError.substring(0, 50)}...)`);
                } else {
                    console.log(`✅ ${relativePath} → ${type}/${slug}`);
                }
                stats.successfulImports++;
                
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`❌ Failed to import ${relativePath}: ${errorMessage}`);
                stats.failedImports++;
                stats.errors.push({
                    file: relativePath,
                    error: errorMessage,
                });
            }
        }
        
        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 Seeding Summary');
        console.log('='.repeat(60));
        console.log(`Total files found:      ${stats.totalFiles}`);
        console.log(`Successfully imported:  ${stats.successfulImports}`);
        console.log(`Failed imports:         ${stats.failedImports}`);
        console.log(`Skipped files:          ${stats.skippedFiles}`);
        console.log('='.repeat(60));
        
        if (stats.errors.length > 0) {
            console.log('\n❌ Errors:');
            for (const error of stats.errors) {
                console.log(`   ${error.file}`);
                console.log(`   → ${error.error}\n`);
            }
        }
        
        if (stats.successfulImports > 0) {
            console.log('\n✨ Documentation seeded successfully!');
            console.log('\nNext steps:');
            console.log('  1. Visit /docs to see tenant documentation');
            console.log('  2. Visit /admin-docs to see admin documentation');
            console.log('  3. Check the sidebar navigation');
        }
        
    } catch (error) {
        console.error('\n❌ Seeding failed:', error);
        throw error;
    }
}

// Main execution
async function main() {
    const clean = process.argv.includes('--clean');
    
    if (clean) {
        console.log('⚠️  WARNING: This will delete all existing documentation!');
        console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    await seedDocumentation(clean);
}

main()
    .then(() => {
        console.log('\n✅ Seeding complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Seeding failed:', error);
        process.exit(1);
    });
