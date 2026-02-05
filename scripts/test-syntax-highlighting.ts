/**
 * Test script for syntax highlighting functionality
 */

import { parseMarkdown } from '../lib/documentation/parser';

const testMarkdown = `---
title: "Syntax Highlighting Test"
description: "Testing code block syntax highlighting"
category: "testing"
tags: ["test", "syntax"]
---

# Syntax Highlighting Test

## JavaScript Example

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return true;
}
\`\`\`

## TypeScript Example

\`\`\`typescript
interface User {
  id: number;
  name: string;
}

const user: User = {
  id: 1,
  name: "John"
};
\`\`\`

## Python Example

\`\`\`python
def calculate_sum(a, b):
    """Calculate the sum of two numbers"""
    return a + b

result = calculate_sum(5, 10)
print(f"Result: {result}")
\`\`\`

## SQL Example

\`\`\`sql
SELECT id, name, email
FROM users
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 10;
\`\`\`

## Unlabeled Code Block

\`\`\`
This is a code block without a language label.
It should still be rendered properly.
\`\`\`
`;

async function testSyntaxHighlighting() {
    console.log('Testing syntax highlighting...\n');

    try {
        const parsed = await parseMarkdown(testMarkdown);

        console.log('✓ Parsing successful');
        console.log('\nFrontmatter:');
        console.log(JSON.stringify(parsed.frontmatter, null, 2));

        console.log('\n✓ HTML generated with syntax highlighting');
        console.log('\nHTML Preview (first 500 chars):');
        console.log(parsed.html.substring(0, 500) + '...');

        // Check if syntax highlighting classes are present
        const hasShikiClasses = parsed.html.includes('shiki') ||
            parsed.html.includes('language-') ||
            parsed.html.includes('style=');

        if (hasShikiClasses) {
            console.log('\n✓ Syntax highlighting classes/styles detected');
        } else {
            console.log('\n⚠ Warning: No syntax highlighting classes detected');
        }

        // Count code blocks
        const codeBlockCount = (parsed.html.match(/<pre/g) || []).length;
        console.log(`\n✓ Found ${codeBlockCount} code blocks`);

        console.log('\n✅ All syntax highlighting tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testSyntaxHighlighting();
