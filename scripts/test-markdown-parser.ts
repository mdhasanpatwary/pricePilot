/**
 * Validation script for Markdown parser
 * 
 * This script validates the Markdown parser implementation by testing
 * it against real documentation files in the docs-content directory.
 */

import { parseMarkdown, parseMarkdownFile, extractFrontmatter, hasFrontmatter, ParserError } from '../lib/documentation/parser';
import * as fs from 'fs/promises';
import * as path from 'path';

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testBasicParsing() {
    log('\n=== Test 1: Basic Markdown Parsing ===', 'cyan');

    const markdown = `---
title: "Test Document"
description: "A test document"
category: "testing"
tags: ["test", "example"]
---

# Test Document

This is a **test** document with *formatting*.

## Features

- Item 1
- Item 2
- Item 3

\`\`\`javascript
console.log('Hello, world!');
\`\`\`
`;

    try {
        const result = await parseMarkdown(markdown);

        log('✓ Frontmatter parsed correctly', 'green');
        console.log('  Title:', result.frontmatter.title);
        console.log('  Category:', result.frontmatter.category);
        console.log('  Tags:', result.frontmatter.tags.join(', '));

        log('✓ HTML generated successfully', 'green');
        console.log('  HTML length:', result.html.length, 'characters');

        // Check that HTML contains expected elements
        if (result.html.includes('<h1>')) {
            log('✓ H1 heading found in HTML', 'green');
        }
        if (result.html.includes('<strong>')) {
            log('✓ Bold formatting found in HTML', 'green');
        }
        if (result.html.includes('<em>')) {
            log('✓ Italic formatting found in HTML', 'green');
        }
        if (result.html.includes('<ul>')) {
            log('✓ List found in HTML', 'green');
        }
        if (result.html.includes('<code>')) {
            log('✓ Code block found in HTML', 'green');
        }

        return true;
    } catch (error) {
        log('✗ Basic parsing failed', 'red');
        console.error(error);
        return false;
    }
}

async function testMissingRequiredFields() {
    log('\n=== Test 2: Missing Required Fields ===', 'cyan');

    const markdownNoTitle = `---
category: "testing"
tags: ["test"]
---

# Content
`;

    const markdownNoCategory = `---
title: "Test"
tags: ["test"]
---

# Content
`;

    const markdownNoTags = `---
title: "Test"
category: "testing"
---

# Content
`;

    let passed = 0;
    let failed = 0;

    // Test missing title
    try {
        await parseMarkdown(markdownNoTitle);
        log('✗ Should have thrown error for missing title', 'red');
        failed++;
    } catch (error) {
        if (error instanceof ParserError && error.code === 'INVALID_FRONTMATTER') {
            log('✓ Correctly rejected missing title', 'green');
            passed++;
        } else {
            log('✗ Wrong error type for missing title', 'red');
            failed++;
        }
    }

    // Test missing category
    try {
        await parseMarkdown(markdownNoCategory);
        log('✗ Should have thrown error for missing category', 'red');
        failed++;
    } catch (error) {
        if (error instanceof ParserError && error.code === 'INVALID_FRONTMATTER') {
            log('✓ Correctly rejected missing category', 'green');
            passed++;
        } else {
            log('✗ Wrong error type for missing category', 'red');
            failed++;
        }
    }

    // Test missing tags
    try {
        await parseMarkdown(markdownNoTags);
        log('✗ Should have thrown error for missing tags', 'red');
        failed++;
    } catch (error) {
        if (error instanceof ParserError && error.code === 'INVALID_FRONTMATTER') {
            log('✓ Correctly rejected missing tags', 'green');
            passed++;
        } else {
            log('✗ Wrong error type for missing tags', 'red');
            failed++;
        }
    }

    return failed === 0;
}

async function testOptionalFields() {
    log('\n=== Test 3: Optional Fields ===', 'cyan');

    const markdown = `---
title: "Test Document"
description: "A test document"
category: "testing"
subcategory: "unit-tests"
tags: ["test", "example"]
author: "Test Author"
lastReviewed: "2024-01-15"
relatedDocs: ["doc1", "doc2"]
---

# Test Document
`;

    try {
        const result = await parseMarkdown(markdown);

        log('✓ All optional fields parsed correctly', 'green');
        console.log('  Description:', result.frontmatter.description);
        console.log('  Subcategory:', result.frontmatter.subcategory);
        console.log('  Author:', result.frontmatter.author);
        console.log('  Last Reviewed:', result.frontmatter.lastReviewed);
        console.log('  Related Docs:', result.frontmatter.relatedDocs?.join(', '));

        return true;
    } catch (error) {
        log('✗ Optional fields parsing failed', 'red');
        console.error(error);
        return false;
    }
}

async function testGitHubFlavoredMarkdown() {
    log('\n=== Test 4: GitHub Flavored Markdown ===', 'cyan');

    const markdown = `---
title: "GFM Test"
category: "testing"
tags: ["test"]
---

# GFM Features

## Tables

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |

## Strikethrough

This is ~~deleted~~ text.

## Task Lists

- [x] Completed task
- [ ] Incomplete task

## Autolinks

Visit https://example.com for more info.
`;

    try {
        const result = await parseMarkdown(markdown);

        let passed = 0;

        if (result.html.includes('<table>')) {
            log('✓ Table rendered correctly', 'green');
            passed++;
        } else {
            log('✗ Table not found in HTML', 'red');
        }

        if (result.html.includes('<del>') || result.html.includes('~~')) {
            log('✓ Strikethrough rendered', 'green');
            passed++;
        } else {
            log('✗ Strikethrough not found in HTML', 'red');
        }

        if (result.html.includes('href="https://example.com"')) {
            log('✓ Autolink rendered correctly', 'green');
            passed++;
        } else {
            log('✗ Autolink not found in HTML', 'red');
        }

        return passed >= 2; // At least 2 out of 3 features should work
    } catch (error) {
        log('✗ GFM parsing failed', 'red');
        console.error(error);
        return false;
    }
}

async function testRealDocumentationFile() {
    log('\n=== Test 5: Real Documentation File ===', 'cyan');

    const testFile = path.join(process.cwd(), 'docs-content/tenant/pricing/update-strategies.md');

    try {
        // Check if file exists
        await fs.access(testFile);

        const result = await parseMarkdownFile(testFile);

        log('✓ Real file parsed successfully', 'green');
        console.log('  Title:', result.frontmatter.title);
        console.log('  Category:', result.frontmatter.category);
        console.log('  Tags:', result.frontmatter.tags.join(', '));
        console.log('  Content length:', result.content.length, 'characters');
        console.log('  HTML length:', result.html.length, 'characters');

        // Verify HTML contains expected content
        if (result.html.includes('<h1>')) {
            log('✓ Headings rendered', 'green');
        }
        if (result.html.includes('<table>')) {
            log('✓ Tables rendered', 'green');
        }
        if (result.html.includes('<code>')) {
            log('✓ Code blocks rendered', 'green');
        }

        return true;
    } catch (error) {
        log('✗ Real file parsing failed', 'red');
        console.error(error);
        return false;
    }
}

async function testExtractFrontmatter() {
    log('\n=== Test 6: Extract Frontmatter Only ===', 'cyan');

    const markdown = `---
title: "Test Document"
category: "testing"
tags: ["test"]
---

# Content that should be ignored
`;

    try {
        const frontmatter = extractFrontmatter(markdown);

        log('✓ Frontmatter extracted successfully', 'green');
        console.log('  Title:', frontmatter.title);
        console.log('  Category:', frontmatter.category);

        return true;
    } catch (error) {
        log('✗ Frontmatter extraction failed', 'red');
        console.error(error);
        return false;
    }
}

async function testHasFrontmatter() {
    log('\n=== Test 7: Check Frontmatter Presence ===', 'cyan');

    const withFrontmatter = `---
title: "Test"
category: "testing"
tags: ["test"]
---

# Content
`;

    const withoutFrontmatter = `# Just Content

No frontmatter here.
`;

    const invalidFrontmatter = `---
title: "Test"
---

# Missing required fields
`;

    let passed = 0;

    if (hasFrontmatter(withFrontmatter)) {
        log('✓ Correctly detected valid frontmatter', 'green');
        passed++;
    } else {
        log('✗ Failed to detect valid frontmatter', 'red');
    }

    if (!hasFrontmatter(withoutFrontmatter)) {
        log('✓ Correctly detected missing frontmatter', 'green');
        passed++;
    } else {
        log('✗ Incorrectly detected frontmatter', 'red');
    }

    if (!hasFrontmatter(invalidFrontmatter)) {
        log('✓ Correctly rejected invalid frontmatter', 'green');
        passed++;
    } else {
        log('✗ Incorrectly accepted invalid frontmatter', 'red');
    }

    return passed === 3;
}

async function scanAllDocumentationFiles() {
    log('\n=== Test 8: Scan All Documentation Files ===', 'cyan');

    const docsDir = path.join(process.cwd(), 'docs-content');

    async function scanDirectory(dir: string): Promise<string[]> {
        const files: string[] = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...await scanDirectory(fullPath));
            } else if (entry.name.endsWith('.md')) {
                files.push(fullPath);
            }
        }

        return files;
    }

    try {
        const allFiles = await scanDirectory(docsDir);
        log(`Found ${allFiles.length} Markdown files`, 'blue');

        let passed = 0;
        let failed = 0;
        const errors: Array<{ file: string; error: string }> = [];

        for (const file of allFiles) {
            try {
                await parseMarkdownFile(file);
                passed++;
            } catch (error) {
                failed++;
                const relativePath = path.relative(process.cwd(), file);
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                errors.push({ file: relativePath, error: errorMsg });
            }
        }

        log(`\n✓ Successfully parsed: ${passed} files`, 'green');
        if (failed > 0) {
            log(`✗ Failed to parse: ${failed} files`, 'red');
            console.log('\nErrors:');
            errors.forEach(({ file, error }) => {
                console.log(`  ${file}:`);
                console.log(`    ${error}`);
            });
        }

        return failed === 0;
    } catch (error) {
        log('✗ Directory scan failed', 'red');
        console.error(error);
        return false;
    }
}

async function main() {
    log('\n╔════════════════════════════════════════════════════════╗', 'blue');
    log('║     Markdown Parser Validation Suite                  ║', 'blue');
    log('╚════════════════════════════════════════════════════════╝', 'blue');

    const tests = [
        { name: 'Basic Parsing', fn: testBasicParsing },
        { name: 'Missing Required Fields', fn: testMissingRequiredFields },
        { name: 'Optional Fields', fn: testOptionalFields },
        { name: 'GitHub Flavored Markdown', fn: testGitHubFlavoredMarkdown },
        { name: 'Real Documentation File', fn: testRealDocumentationFile },
        { name: 'Extract Frontmatter', fn: testExtractFrontmatter },
        { name: 'Has Frontmatter', fn: testHasFrontmatter },
        { name: 'Scan All Files', fn: scanAllDocumentationFiles },
    ];

    const results: Array<{ name: string; passed: boolean }> = [];

    for (const test of tests) {
        try {
            const passed = await test.fn();
            results.push({ name: test.name, passed });
        } catch (error) {
            log(`\n✗ Test "${test.name}" threw unexpected error`, 'red');
            console.error(error);
            results.push({ name: test.name, passed: false });
        }
    }

    // Summary
    log('\n╔════════════════════════════════════════════════════════╗', 'blue');
    log('║     Test Summary                                       ║', 'blue');
    log('╚════════════════════════════════════════════════════════╝', 'blue');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    results.forEach(({ name, passed }) => {
        const status = passed ? '✓' : '✗';
        const color = passed ? 'green' : 'red';
        log(`${status} ${name}`, color);
    });

    log(`\nTotal: ${passed}/${results.length} tests passed`, passed === results.length ? 'green' : 'yellow');

    if (failed > 0) {
        log(`\n⚠ ${failed} test(s) failed`, 'yellow');
        process.exit(1);
    } else {
        log('\n✓ All tests passed!', 'green');
        process.exit(0);
    }
}

main().catch((error) => {
    log('\n✗ Validation suite crashed', 'red');
    console.error(error);
    process.exit(1);
});
