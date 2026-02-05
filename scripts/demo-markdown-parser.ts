/**
 * Demo script for Markdown parser
 * 
 * This script demonstrates the usage of the Markdown parser
 * with various examples.
 */

import { parseMarkdown, parseMarkdownFile, extractFrontmatter, hasFrontmatter } from '../lib/documentation/parser';

async function demo() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     Markdown Parser Demo                               ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    // Example 1: Basic parsing
    console.log('Example 1: Basic Markdown Parsing');
    console.log('─────────────────────────────────\n');

    const basicMarkdown = `---
title: "Getting Started with PricePilot"
description: "Learn how to set up your first product"
category: "getting-started"
tags: ["tutorial", "beginner", "setup"]
author: "PricePilot Team"
lastReviewed: "2024-01-15"
---

# Getting Started with PricePilot

Welcome to **PricePilot**! This guide will help you get started.

## Quick Start

1. Create an account
2. Connect your store
3. Add competitors
4. Start tracking prices

## Features

- Automated price tracking
- Competitor monitoring
- Price update strategies
- Real-time alerts

\`\`\`javascript
// Example API call
const response = await fetch('/api/products');
const products = await response.json();
\`\`\`

Visit our [documentation](https://example.com) for more info.
`;

    const result = await parseMarkdown(basicMarkdown);

    console.log('Frontmatter:');
    console.log('  Title:', result.frontmatter.title);
    console.log('  Category:', result.frontmatter.category);
    console.log('  Tags:', result.frontmatter.tags.join(', '));
    console.log('  Author:', result.frontmatter.author);
    console.log('\nContent Stats:');
    console.log('  Markdown length:', result.content.length, 'characters');
    console.log('  HTML length:', result.html.length, 'characters');
    console.log('\nHTML Preview (first 200 chars):');
    console.log('  ' + result.html.substring(0, 200) + '...\n');

    // Example 2: Extract frontmatter only
    console.log('\nExample 2: Extract Frontmatter Only');
    console.log('────────────────────────────────────\n');

    const frontmatter = extractFrontmatter(basicMarkdown);
    console.log('Extracted metadata:');
    console.log(JSON.stringify(frontmatter, null, 2));

    // Example 3: Check for frontmatter
    console.log('\n\nExample 3: Check Frontmatter Presence');
    console.log('──────────────────────────────────────\n');

    const withFrontmatter = `---
title: "Test"
category: "test"
tags: ["test"]
---
Content`;

    const withoutFrontmatter = `# Just Content\n\nNo frontmatter.`;

    console.log('Has frontmatter (valid):', hasFrontmatter(withFrontmatter));
    console.log('Has frontmatter (invalid):', hasFrontmatter(withoutFrontmatter));

    // Example 4: Parse real file
    console.log('\n\nExample 4: Parse Real Documentation File');
    console.log('─────────────────────────────────────────\n');

    try {
        const fileResult = await parseMarkdownFile('docs-content/tenant/pricing/update-strategies.md');
        console.log('Successfully parsed real file:');
        console.log('  Title:', fileResult.frontmatter.title);
        console.log('  Category:', fileResult.frontmatter.category);
        console.log('  Tags:', fileResult.frontmatter.tags.join(', '));
        console.log('  Content length:', fileResult.content.length, 'characters');
        console.log('  HTML length:', fileResult.html.length, 'characters');

        // Count HTML elements
        const h1Count = (fileResult.html.match(/<h1>/g) || []).length;
        const h2Count = (fileResult.html.match(/<h2>/g) || []).length;
        const h3Count = (fileResult.html.match(/<h3>/g) || []).length;
        const tableCount = (fileResult.html.match(/<table>/g) || []).length;
        const codeCount = (fileResult.html.match(/<code>/g) || []).length;

        console.log('\nHTML Structure:');
        console.log('  H1 headings:', h1Count);
        console.log('  H2 headings:', h2Count);
        console.log('  H3 headings:', h3Count);
        console.log('  Tables:', tableCount);
        console.log('  Code blocks:', codeCount);
    } catch (error) {
        console.log('Error parsing file:', error);
    }

    // Example 5: GitHub Flavored Markdown
    console.log('\n\nExample 5: GitHub Flavored Markdown Features');
    console.log('────────────────────────────────────────────\n');

    const gfmMarkdown = `---
title: "GFM Features"
category: "examples"
tags: ["gfm", "markdown"]
---

# GitHub Flavored Markdown

## Tables

| Feature | Status | Priority |
|---------|--------|----------|
| Tables  | ✅     | High     |
| Strikethrough | ✅ | Medium |
| Task Lists | ✅ | Low |

## Strikethrough

This is ~~incorrect~~ correct text.

## Task Lists

- [x] Implement parser
- [x] Add validation
- [ ] Add syntax highlighting
- [ ] Add Mermaid support

## Autolinks

Visit https://example.com for more information.
`;

    const gfmResult = await parseMarkdown(gfmMarkdown);
    console.log('GFM Features Rendered:');
    console.log('  Tables:', gfmResult.html.includes('<table>') ? '✅' : '❌');
    console.log('  Strikethrough:', gfmResult.html.includes('<del>') ? '✅' : '❌');
    console.log('  Autolinks:', gfmResult.html.includes('href="https://example.com"') ? '✅' : '❌');

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║     Demo Complete                                      ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
}

demo().catch(console.error);
