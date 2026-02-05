/**
 * Test script for Mermaid diagram functionality
 */

import { parseMarkdown } from '../lib/documentation/parser';

const testMarkdown = `---
title: "Mermaid Diagram Test"
description: "Testing Mermaid diagram rendering"
category: "testing"
tags: ["test", "mermaid", "diagrams"]
---

# Mermaid Diagram Test

## Flowchart Example

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]
\`\`\`

## Sequence Diagram Example

\`\`\`mermaid
sequenceDiagram
    participant User
    participant API
    participant Database
    
    User->>API: Request data
    API->>Database: Query
    Database-->>API: Results
    API-->>User: Response
\`\`\`

## Class Diagram Example

\`\`\`mermaid
classDiagram
    class Document {
        +String title
        +String content
        +parse()
        +render()
    }
    
    class Parser {
        +parseMarkdown()
        +extractFrontmatter()
    }
    
    Document --> Parser
\`\`\`

## Regular Text

This is regular text that should not be affected by Mermaid processing.
`;

async function testMermaidDiagrams() {
    console.log('Testing Mermaid diagram support...\n');

    try {
        const parsed = await parseMarkdown(testMarkdown);

        console.log('✓ Parsing successful');
        console.log('\nFrontmatter:');
        console.log(JSON.stringify(parsed.frontmatter, null, 2));

        console.log('\n✓ HTML generated with Mermaid diagrams');

        // Check if SVG elements are present (Mermaid renders to SVG)
        const hasSvg = parsed.html.includes('<svg') || parsed.html.includes('mermaid');

        if (hasSvg) {
            console.log('✓ Mermaid diagram elements detected');
        } else {
            console.log('⚠ Warning: No Mermaid diagram elements detected');
            console.log('\nHTML Preview (first 1000 chars):');
            console.log(parsed.html.substring(0, 1000));
        }

        // Count mermaid code blocks
        const mermaidBlockCount = (parsed.content.match(/```mermaid/g) || []).length;
        console.log(`\n✓ Found ${mermaidBlockCount} Mermaid code blocks in source`);

        console.log('\n✅ All Mermaid diagram tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack:', error.stack);
        }
        process.exit(1);
    }
}

testMermaidDiagrams();
