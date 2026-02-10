#!/usr/bin/env node

/**
 * Script to migrate all admin endpoints to use request-scoped caching
 * This script updates imports and function calls in all admin route files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting admin endpoints migration...\n');

// Find all admin route files that still use getServerSession
let files;
try {
    const output = execSync(
        'find app/api/v1/admin -name "*.ts" -type f -exec grep -l "getServerSession" {} \\; 2>/dev/null || true',
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    files = output.trim().split('\n').filter(f => f && f.length > 0);
} catch (error) {
    console.log('✅ No files to migrate!');
    process.exit(0);
}

if (files.length === 0 || (files.length === 1 && files[0] === '')) {
    console.log('✅ No files to migrate!');
    process.exit(0);
}

console.log(`Found ${files.length} files to migrate\n`);

let migratedCount = 0;

for (const file of files) {
    if (!file || !fs.existsSync(file)) continue;

    console.log(`📝 Migrating: ${file}`);

    // Read file content
    let content = fs.readFileSync(file, 'utf-8');
    const originalContent = content;

    // Step 1: Replace getServerSession calls
    content = content.replace(/await getServerSession\(authOptions\)/g, 'await getCachedSession()');
    content = content.replace(/getServerSession\(authOptions\)/g, 'getCachedSession()');

    // Step 2: Replace withRateLimit with withRequestContextAndRateLimit
    content = content.replace(/withRateLimit\(/g, 'withRequestContextAndRateLimit(');

    // Step 3: Update imports
    // Remove old imports
    content = content.replace(/import \{ getServerSession \} from ["']next-auth["'];?\n?/g, '');
    content = content.replace(/import \{ getServerSession \} from ["']next-auth\/next["'];?\n?/g, '');
    content = content.replace(/import \{ authOptions \} from ["']@\/lib\/auth["'];?\n?/g, '');
    content = content.replace(/import \{ withRateLimit \} from ["']@\/lib\/middleware\/ratelimit["'];?\n?/g, '');

    // Add new imports if not already present
    if (!content.includes('getCachedSession')) {
        // Find the position after the last import
        const importRegex = /^import .* from ['"].*['"];$/gm;
        const imports = content.match(importRegex);

        if (imports && imports.length > 0) {
            const lastImport = imports[imports.length - 1];
            const lastImportIndex = content.lastIndexOf(lastImport);
            const insertPosition = lastImportIndex + lastImport.length;

            const newImports = `\nimport { getCachedSession } from "@/lib/auth/cached-session";\nimport { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";`;

            content = content.slice(0, insertPosition) + newImports + content.slice(insertPosition);
        }
    }

    // Only write if content changed
    if (content !== originalContent) {
        // Create backup
        fs.writeFileSync(file + '.bak', originalContent);

        // Write updated content
        fs.writeFileSync(file, content);
        migratedCount++;
        console.log(`   ✅ Migrated successfully`);
    } else {
        console.log(`   ⏭️  No changes needed`);
    }
}

console.log(`\n✅ Migration complete! Migrated ${migratedCount} files.`);
console.log('📦 Backup files created with .bak extension\n');
console.log('Next steps:');
console.log('1. Review changes: git diff');
console.log('2. Run build: npm run build');
console.log('3. Test endpoints');
console.log('4. Remove backups: find app/api/v1/admin -name "*.bak" -delete');
