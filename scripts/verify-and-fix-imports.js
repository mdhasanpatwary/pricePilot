#!/usr/bin/env node

/**
 * Script to verify and fix missing imports in migrated files
 * Ensures all files using getCachedSession have the proper imports
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔍 Verifying imports in migrated files...\n');

// Find all files that use getCachedSession
let files;
try {
    const output = execSync(
        'find app/api/v1 -name "*.ts" -type f -exec grep -l "getCachedSession" {} \\; 2>/dev/null || true',
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    files = output.trim().split('\n').filter(f => f && f.length > 0);
} catch (error) {
    console.log('✅ No files found!');
    process.exit(0);
}

if (files.length === 0 || (files.length === 1 && files[0] === '')) {
    console.log('✅ No files found!');
    process.exit(0);
}

console.log(`Found ${files.length} files using getCachedSession\n`);

let fixedCount = 0;
let alreadyCorrectCount = 0;
let errorCount = 0;

for (const file of files) {
    if (!file || !fs.existsSync(file)) {
        continue;
    }

    try {
        let content = fs.readFileSync(file, 'utf-8');
        const originalContent = content;
        let needsFix = false;

        // Check if file uses getCachedSession but doesn't import it
        if (content.includes('getCachedSession') && !content.includes('from "@/lib/auth/cached-session"')) {
            needsFix = true;
            console.log(`⚠️  Missing import: ${file}`);

            // Find the position after the last import
            const importRegex = /^import .* from ['"].*['"];$/gm;
            const imports = content.match(importRegex);

            if (imports && imports.length > 0) {
                const lastImport = imports[imports.length - 1];
                const lastImportIndex = content.lastIndexOf(lastImport);
                const insertPosition = lastImportIndex + lastImport.length;

                const newImport = `\nimport { getCachedSession } from "@/lib/auth/cached-session";`;
                content = content.slice(0, insertPosition) + newImport + content.slice(insertPosition);
            }
        }

        // Check if file uses withRequestContextAndRateLimit but doesn't import it
        if (content.includes('withRequestContextAndRateLimit') && !content.includes('from "@/lib/middleware/with-request-context"')) {
            needsFix = true;
            console.log(`⚠️  Missing import: ${file}`);

            // Find the position after the last import
            const importRegex = /^import .* from ['"].*['"];$/gm;
            const imports = content.match(importRegex);

            if (imports && imports.length > 0) {
                const lastImport = imports[imports.length - 1];
                const lastImportIndex = content.lastIndexOf(lastImport);
                const insertPosition = lastImportIndex + lastImport.length;

                const newImport = `\nimport { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";`;
                content = content.slice(0, insertPosition) + newImport + content.slice(insertPosition);
            }
        }

        // Check if file uses getCachedTenant but doesn't import it
        if (content.includes('getCachedTenant') && !content.includes('from "@/lib/tenant/cached-tenant"')) {
            needsFix = true;
            console.log(`⚠️  Missing import: ${file}`);

            // Find the position after the last import
            const importRegex = /^import .* from ['"].*['"];$/gm;
            const imports = content.match(importRegex);

            if (imports && imports.length > 0) {
                const lastImport = imports[imports.length - 1];
                const lastImportIndex = content.lastIndexOf(lastImport);
                const insertPosition = lastImportIndex + lastImport.length;

                const newImport = `\nimport { getCachedTenant } from "@/lib/tenant/cached-tenant";`;
                content = content.slice(0, insertPosition) + newImport + content.slice(insertPosition);
            }
        }

        if (needsFix && content !== originalContent) {
            // Create backup
            fs.writeFileSync(file + '.import-fix.bak', originalContent);

            // Write fixed content
            fs.writeFileSync(file, content);
            fixedCount++;
            console.log(`   ✅ Fixed imports`);
        } else if (!needsFix) {
            alreadyCorrectCount++;
        }
    } catch (error) {
        console.error(`   ❌ Error fixing file: ${error.message}`);
        errorCount++;
    }
}

console.log(`\n${'='.repeat(60)}`);
console.log('📊 Import Verification Summary');
console.log(`${'='.repeat(60)}`);
console.log(`✅ Fixed imports: ${fixedCount} files`);
console.log(`✓  Already correct: ${alreadyCorrectCount} files`);
console.log(`❌ Errors: ${errorCount} files`);
console.log(`📦 Total checked: ${files.length} files`);
console.log(`${'='.repeat(60)}\n`);

if (fixedCount > 0) {
    console.log('📦 Backup files created with .import-fix.bak extension\n');
    console.log('Next steps:');
    console.log('1. Run build: npm run build');
    console.log('2. If successful, remove backups: find app/api/v1 -name "*.import-fix.bak" -delete');
}
