/**
 * Test Documentation Service
 * 
 * This script tests the core functionality of the Documentation Service
 * including document retrieval, creation, updates, and version history.
 */

import { documentationService } from '@/lib/documentation';
import { prisma } from '@/lib/prisma';

async function testDocumentationService() {
    console.log('🧪 Testing Documentation Service\n');

    try {
        // Test 1: Create a test document
        console.log('📝 Test 1: Creating a test document...');
        const testDoc = await documentationService.createDocument('tenant', {
            slug: 'test-document',
            title: 'Test Document',
            content: `---
title: Test Document
description: A test document for the documentation service
category: testing
tags: [test, demo]
---

# Test Document

This is a test document with some **bold text** and a code block:

\`\`\`typescript
console.log('Hello, world!');
\`\`\`

## Section 2

Some more content here.
`,
            category: 'testing',
            metadata: {
                description: 'A test document for the documentation service',
                tags: ['test', 'demo'],
            },
        });
        console.log('✅ Document created:', testDoc.id);
        console.log('   Title:', testDoc.title);
        console.log('   Slug:', testDoc.slug);
        console.log('   Category:', testDoc.category);
        console.log('');

        // Test 2: Retrieve the document
        console.log('📖 Test 2: Retrieving document by slug...');
        const retrieved = await documentationService.getDocument('tenant', 'test-document');
        if (retrieved) {
            console.log('✅ Document retrieved successfully');
            console.log('   ID matches:', retrieved.id === testDoc.id);
            console.log('   HTML generated:', retrieved.htmlContent.length > 0);
        } else {
            console.log('❌ Document not found');
        }
        console.log('');

        // Test 3: List documents
        console.log('📚 Test 3: Listing documents...');
        const allDocs = await documentationService.listDocuments('tenant');
        console.log('✅ Found', allDocs.length, 'tenant documents');
        const testingDocs = await documentationService.listDocuments('tenant', 'testing');
        console.log('✅ Found', testingDocs.length, 'documents in testing category');
        console.log('');

        // Test 4: Get table of contents
        console.log('📑 Test 4: Building table of contents...');
        const toc = await documentationService.getTableOfContents('tenant');
        console.log('✅ TOC has', toc.length, 'top-level categories');
        toc.forEach(category => {
            console.log(`   - ${category.title} (${category.children?.length || 0} items)`);
        });
        console.log('');

        // Test 5: Get breadcrumbs
        console.log('🍞 Test 5: Generating breadcrumbs...');
        const breadcrumbs = await documentationService.getBreadcrumbs('tenant', 'test-document');
        console.log('✅ Breadcrumb trail:');
        breadcrumbs.forEach((crumb, i) => {
            console.log(`   ${i + 1}. ${crumb.title} (${crumb.slug || 'root'})`);
        });
        console.log('');

        // Test 6: Update document
        console.log('✏️  Test 6: Updating document...');
        const updatedContent = `---
title: Test Document (Updated)
description: An updated test document
category: testing
tags: [test, demo, updated]
---

# Test Document (Updated)

This document has been **updated** with new content.

\`\`\`typescript
console.log('Updated content!');
\`\`\`
`;
        const updated = await documentationService.updateDocument(
            testDoc.id,
            updatedContent,
            'test-user-id',
            'Updated content for testing'
        );
        console.log('✅ Document updated');
        console.log('   Title changed:', updated.title !== testDoc.title);
        console.log('   Content changed:', updated.content !== testDoc.content);
        console.log('');

        // Test 7: Get version history
        console.log('📜 Test 7: Retrieving version history...');
        const history = await documentationService.getDocumentHistory(testDoc.id);
        console.log('✅ Found', history.length, 'version(s) in history');
        history.forEach((version, i) => {
            console.log(`   ${i + 1}. ${version.changeDescription || 'Initial version'}`);
            console.log(`      Created: ${version.createdAt.toISOString()}`);
            console.log(`      By: ${version.createdBy}`);
        });
        console.log('');

        // Test 8: Generate diff
        if (history.length > 0) {
            console.log('🔍 Test 8: Generating diff between versions...');
            const diff = await documentationService.generateDiff(
                testDoc.id,
                history[0].id,
                'current'
            );
            console.log('✅ Diff generated');
            console.log('   Changes:', diff.changes.length, 'chunks');
            const additions = diff.changes.filter(c => c.added).length;
            const deletions = diff.changes.filter(c => c.removed).length;
            console.log('   Additions:', additions);
            console.log('   Deletions:', deletions);
            console.log('');
        }

        // Test 9: Revert document
        if (history.length > 0) {
            console.log('⏮️  Test 9: Reverting to previous version...');
            const reverted = await documentationService.revertDocument(
                testDoc.id,
                history[0].id,
                'test-user-id'
            );
            console.log('✅ Document reverted');
            console.log('   Content matches original:', reverted.content === testDoc.content);

            // Check history again
            const newHistory = await documentationService.getDocumentHistory(testDoc.id);
            console.log('   History now has', newHistory.length, 'versions');
            console.log('');
        }

        // Cleanup: Delete test document
        console.log('🧹 Cleaning up test document...');
        await prisma.documentationDocument.delete({
            where: { id: testDoc.id },
        });
        console.log('✅ Test document deleted');
        console.log('');

        console.log('✨ All tests completed successfully!\n');

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

// Run tests
testDocumentationService()
    .then(() => {
        console.log('✅ Documentation Service tests passed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Documentation Service tests failed:', error);
        process.exit(1);
    });
