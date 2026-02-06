/**
 * Simple Documentation Seed Script
 * 
 * Fast seeding without HTML parsing - HTML will be generated on-demand
 */

import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { DocumentationType } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

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

function extractTitle(content: string, filename: string): string {
    // Try to find # Title in content
    const match = content.match(/^#\s+(.+)$/m);
    if (match) {
        return match[1].trim();
    }
    
    // Fallback to filename
    return path.basename(filename, '.md')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

async function seedDocumentation(clean: boolean = false) {
    console.log('📚 Simple Documentation Seeding\n');
    
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    
    try {
        if (clean) {
            console.log('🧹 Cleaning existing documentation...');
            const deleteResult = await prisma.documentationDocument.deleteMany({});
            console.log(`   Deleted ${deleteResult.count} documents\n`);
        }
        
        const docsContentDir = path.join(process.cwd(), 'docs-content');
        console.log(`📂 Scanning ${docsContentDir}...\n`);
        
        const allFiles = await getAllMarkdownFiles(docsContentDir);
        console.log(`Found ${allFiles.length} markdown files\n`);
        console.log('📝 Importing documents (this may take a minute)...\n');
        
        for (const filePath of allFiles) {
            const relativePath = path.relative(process.cwd(), filePath);
            
            try {
                const type = determineDocumentType(filePath);
                
                if (!type) {
                    skipCount++;
                    continue;
                }
                
                const rawContent = await fs.readFile(filePath, 'utf-8');
                const category = extractCategoryFromPath(filePath, type);
                const slug = generateSlugFromPath(filePath, type);
                const title = extractTitle(rawContent, filePath);
                
                // Check if exists
                const existing = await prisma.documentationDocument.findFirst({
                    where: {
                        type: type === 'tenant' ? DocumentationType.TENANT : DocumentationType.ADMIN,
                        slug,
                    },
                });
                
                if (existing) {
                    skipCount++;
                    continue;
                }
                
                // Add frontmatter if missing
                let contentToStore = rawContent;
                if (!rawContent.trim().startsWith('---')) {
                    contentToStore = `---
title: ${title}
category: ${category}
slug: ${slug}
---

${rawContent}`;
                }
                
                // Create document directly in database (skip HTML generation for speed)
                await prisma.documentationDocument.create({
                    data: {
                        type: type === 'tenant' ? DocumentationType.TENANT : DocumentationType.ADMIN,
                        slug,
                        title,
                        content: contentToStore,
                        htmlContent: '', // Will be generated on first access
                        category,
                        metadata: {},
                    },
                });
                
                successCount++;
                
                if (successCount % 10 === 0) {
                    console.log(`   Imported ${successCount} documents...`);
                }
                
            } catch (error) {
                failCount++;
                console.error(`❌ ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 Seeding Summary');
        console.log('='.repeat(60));
        console.log(`Total files:        ${allFiles.length}`);
        console.log(`Successfully imported: ${successCount}`);
        console.log(`Failed:             ${failCount}`);
        console.log(`Skipped:            ${skipCount}`);
        console.log('='.repeat(60));
        
        if (successCount > 0) {
            console.log('\n✨ Documentation seeded successfully!');
            console.log('\nNext steps:');
            console.log('  1. Visit http://localhost:3000/docs');
            console.log('  2. Check the sidebar navigation');
            console.log('  3. HTML will be generated on first page view');
        }
        
    } catch (error) {
        console.error('\n❌ Seeding failed:', error);
        throw error;
    }
}

async function main() {
    const clean = process.argv.includes('--clean');
    
    if (clean) {
        console.log('⚠️  WARNING: This will delete all existing documentation!');
        console.log('Press Ctrl+C to cancel, or wait 3 seconds...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    await seedDocumentation(clean);
}

main()
    .then(() => {
        console.log('\n✅ Done');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Failed:', error);
        process.exit(1);
    });
