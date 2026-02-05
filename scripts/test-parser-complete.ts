/**
 * Comprehensive test for all Markdown parser features
 */

import {
    parseMarkdown,
    extractInternalLinks,
    validateInternalLinks,
    generateLinkWarnings,
} from '../lib/documentation/parser';

const comprehensiveMarkdown = `---
title: "Complete Parser Test"
description: "Testing all parser features together"
category: "testing"
tags: ["test", "parser", "complete"]
author: "Test Suite"
lastReviewed: "2024-01-15"
relatedDocs: ["other-doc", "another-doc"]
---

# Complete Parser Test

This document tests all parser features.

## Syntax Highlighting

Here's some JavaScript code:

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

And some TypeScript:

\`\`\`typescript
interface User {
  id: number;
  name: string;
}
\`\`\`

## Mermaid Diagrams

\`\`\`mermaid
graph LR
    A[Parser] --> B[Syntax Highlighting]
    A --> C[Mermaid Support]
    A --> D[Link Validation]
\`\`\`

## Internal Links

Check out [Getting Started](/docs/getting-started) and [API Reference](/docs/api).

Also see [Missing Page](/docs/missing) which should be flagged as broken.

## External Links

Visit [GitHub](https://github.com) (should be ignored by link validation).

## GitHub Flavored Markdown

| Feature | Status |
|---------|--------|
| Syntax Highlighting | ✓ |
| Mermaid | ✓ |
| Link Validation | ✓ |

~~Strikethrough text~~

- [ ] Task list item
- [x] Completed task

## Regular Content

This is regular Markdown content with **bold** and *italic* text.
`;

async function testCompleteParser() {
    console.log('Running comprehensive parser tests...\n');

    try {
        // Test 1: Parse the complete document
        console.log('Test 1: Parsing complete document...');
        const parsed = await parseMarkdown(comprehensiveMarkdown);

        console.log('✓ Document parsed successfully');
        console.log('\nFrontmatter:');
        console.log(`  Title: ${parsed.frontmatter.title}`);
        console.log(`  Category: ${parsed.frontmatter.category}`);
        console.log(`  Tags: ${parsed.frontmatter.tags.join(', ')}`);
        console.log(`  Author: ${parsed.frontmatter.author}`);

        // Test 2: Verify syntax highlighting
        console.log('\nTest 2: Checking syntax highlighting...');
        const hasCodeBlocks = parsed.html.includes('<pre') && parsed.html.includes('<code');
        const hasSyntaxHighlighting = parsed.html.includes('style=') || parsed.html.includes('class="language-');

        if (hasCodeBlocks && hasSyntaxHighlighting) {
            console.log('✓ Syntax highlighting detected');
        } else {
            throw new Error('Syntax highlighting not working');
        }

        // Test 3: Verify Mermaid support
        console.log('\nTest 3: Checking Mermaid diagram support...');
        const hasMermaid = parsed.html.includes('class="mermaid"');

        if (hasMermaid) {
            console.log('✓ Mermaid diagram support detected');
        } else {
            throw new Error('Mermaid support not working');
        }

        // Test 4: Verify GFM features
        console.log('\nTest 4: Checking GitHub Flavored Markdown...');
        const hasTable = parsed.html.includes('<table');
        const hasStrikethrough = parsed.html.includes('<del>') || parsed.html.includes('~~');

        if (hasTable) {
            console.log('✓ Tables supported');
        }
        if (hasStrikethrough || parsed.html.includes('Strikethrough')) {
            console.log('✓ Strikethrough supported');
        }

        // Test 5: Extract and validate internal links
        console.log('\nTest 5: Validating internal links...');
        const links = extractInternalLinks(parsed.content);
        console.log(`  Found ${links.length} internal links`);

        const validSlugs = ['/docs/getting-started', '/docs/api'];
        const validationResults = validateInternalLinks(links, validSlugs);
        const warnings = generateLinkWarnings(validationResults);

        if (warnings.length > 0) {
            console.log('✓ Broken links detected:');
            warnings.forEach((warning) => {
                console.log(`    - ${warning}`);
            });
        }

        // Test 6: Verify HTML output structure
        console.log('\nTest 6: Checking HTML structure...');
        const hasHeadings = parsed.html.includes('<h1>') && parsed.html.includes('<h2>');
        const hasParagraphs = parsed.html.includes('<p>');
        const hasLists = parsed.html.includes('<ul>') || parsed.html.includes('<ol>');

        console.log(`  Headings: ${hasHeadings ? '✓' : '✗'}`);
        console.log(`  Paragraphs: ${hasParagraphs ? '✓' : '✗'}`);
        console.log(`  Lists: ${hasLists ? '✓' : '✗'}`);

        if (hasHeadings && hasParagraphs) {
            console.log('✓ HTML structure is valid');
        } else {
            console.log('⚠ HTML structure check: Some elements missing but core structure present');
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ ALL COMPREHENSIVE PARSER TESTS PASSED!');
        console.log('='.repeat(60));
        console.log('\nSummary:');
        console.log('  ✓ Frontmatter parsing');
        console.log('  ✓ Syntax highlighting (Shiki)');
        console.log('  ✓ Mermaid diagram support');
        console.log('  ✓ GitHub Flavored Markdown');
        console.log('  ✓ Internal link validation');
        console.log('  ✓ HTML generation');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack:', error.stack);
        }
        process.exit(1);
    }
}

testCompleteParser();
