/**
 * Test script for internal link validation functionality
 */

import {
    extractInternalLinks,
    validateInternalLinks,
    generateLinkWarnings,
} from '../lib/documentation/parser';

const testMarkdown = `---
title: "Link Validation Test"
description: "Testing internal link validation"
category: "testing"
tags: ["test", "links"]
---

# Link Validation Test

## Internal Links

Check out our [Getting Started Guide](/docs/getting-started) for more information.

You can also read about [Product Setup](/docs/products/setup) and [Competitor Tracking](/docs/competitors/tracking).

## External Links (should be ignored)

Visit [Google](https://google.com) or [GitHub](https://github.com).

## Anchor Links (should be ignored)

Jump to [section below](#section-below).

## Mixed Links

Read the [API Documentation](/docs/api) and check [external resource](https://example.com).

Also see [another internal page](/docs/troubleshooting/faq).

## Section Below

Some content here.
`;

function testLinkValidation() {
    console.log('Testing internal link validation...\n');

    try {
        // Extract internal links
        const links = extractInternalLinks(testMarkdown);

        console.log('✓ Link extraction successful');
        console.log(`\nFound ${links.length} internal links:`);
        links.forEach((link, index) => {
            console.log(`  ${index + 1}. "${link.text}" -> ${link.href}`);
        });

        // Validate links against a mock list of valid slugs
        const validSlugs = [
            '/docs/getting-started',
            '/docs/products/setup',
            '/docs/api',
            // Note: /docs/competitors/tracking and /docs/troubleshooting/faq are missing
        ];

        const validationResults = validateInternalLinks(links, validSlugs);

        console.log('\n✓ Link validation completed');
        console.log('\nValidation Results:');
        validationResults.forEach((result, index) => {
            const status = result.isValid ? '✓ Valid' : '✗ Broken';
            console.log(`  ${index + 1}. ${status}: "${result.link.text}" -> ${result.link.href}`);
            if (!result.isValid && result.error) {
                console.log(`     Error: ${result.error}`);
            }
        });

        // Generate warnings for broken links
        const warnings = generateLinkWarnings(validationResults);

        if (warnings.length > 0) {
            console.log('\n⚠ Warnings:');
            warnings.forEach((warning) => {
                console.log(`  - ${warning}`);
            });
        } else {
            console.log('\n✓ No broken links found');
        }

        // Verify expected results
        const expectedInternalLinks = 5; // Should find 5 internal links
        const expectedBrokenLinks = 2; // 2 should be broken

        if (links.length !== expectedInternalLinks) {
            throw new Error(`Expected ${expectedInternalLinks} internal links, found ${links.length}`);
        }

        const brokenLinks = validationResults.filter((r) => !r.isValid).length;
        if (brokenLinks !== expectedBrokenLinks) {
            throw new Error(`Expected ${expectedBrokenLinks} broken links, found ${brokenLinks}`);
        }

        console.log('\n✅ All link validation tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
        }
        process.exit(1);
    }
}

testLinkValidation();
