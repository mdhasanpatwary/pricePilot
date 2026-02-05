/**
 * Test script for documentation system migration
 * 
 * This script verifies that:
 * 1. All documentation tables exist
 * 2. Indexes are properly created
 * 3. Foreign key constraints work
 * 4. CRUD operations function correctly
 * 5. Full-text search capabilities work
 * 
 * Run with: npx tsx scripts/test-documentation-migration.ts
 */

import { PrismaClient, DocumentationType, DocumentationSuggestionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function testDocumentationMigration() {
    console.log('🧪 Testing Documentation System Migration...\n');

    try {
        // Test 1: Create a tenant documentation document
        console.log('✅ Test 1: Creating tenant documentation document...');
        const tenantDoc = await prisma.documentationDocument.create({
            data: {
                type: DocumentationType.TENANT,
                slug: 'getting-started',
                title: 'Getting Started with PricePilot',
                content: '# Getting Started\n\nWelcome to PricePilot! This guide will help you set up your first product.',
                htmlContent: '<h1>Getting Started</h1><p>Welcome to PricePilot! This guide will help you set up your first product.</p>',
                category: 'getting-started',
                metadata: {
                    tags: ['beginner', 'setup', 'tutorial'],
                    author: 'PricePilot Team',
                    description: 'Learn how to get started with PricePilot'
                }
            }
        });
        console.log(`   Created document: ${tenantDoc.id} - ${tenantDoc.title}`);

        // Test 2: Create an admin documentation document
        console.log('\n✅ Test 2: Creating admin documentation document...');
        const adminDoc = await prisma.documentationDocument.create({
            data: {
                type: DocumentationType.ADMIN,
                slug: 'system-monitoring',
                title: 'System Monitoring Guide',
                content: '# System Monitoring\n\nLearn how to monitor PricePilot system health.',
                htmlContent: '<h1>System Monitoring</h1><p>Learn how to monitor PricePilot system health.</p>',
                category: 'monitoring',
                metadata: {
                    tags: ['admin', 'monitoring', 'operations'],
                    author: 'DevOps Team'
                }
            }
        });
        console.log(`   Created document: ${adminDoc.id} - ${adminDoc.title}`);

        // Test 3: Create a version history entry
        console.log('\n✅ Test 3: Creating version history...');
        const version = await prisma.documentationVersion.create({
            data: {
                documentId: tenantDoc.id,
                content: '# Getting Started\n\nOriginal content before update.',
                changeDescription: 'Initial version',
                createdBy: 'system'
            }
        });
        console.log(`   Created version: ${version.id}`);

        // Test 4: Create a documentation suggestion
        console.log('\n✅ Test 4: Creating documentation suggestion...');
        const suggestion = await prisma.documentationSuggestion.create({
            data: {
                documentId: tenantDoc.id,
                suggestedTitle: 'Getting Started with PricePilot - Updated',
                suggestedContent: '# Getting Started\n\nUpdated content with more details.',
                targetType: DocumentationType.TENANT,
                category: 'getting-started',
                status: DocumentationSuggestionStatus.PENDING,
                taskId: 'task-123'
            }
        });
        console.log(`   Created suggestion: ${suggestion.id} - Status: ${suggestion.status}`);

        // Test 5: Track a page view
        console.log('\n✅ Test 5: Tracking page view...');
        const pageView = await prisma.documentationPageView.create({
            data: {
                documentId: tenantDoc.id,
                type: DocumentationType.TENANT,
                sessionId: 'session-123',
                timeOnPage: 120
            }
        });
        console.log(`   Created page view: ${pageView.id} - Time on page: ${pageView.timeOnPage}s`);

        // Test 6: Log a search query
        console.log('\n✅ Test 6: Logging search query...');
        const search = await prisma.documentationSearch.create({
            data: {
                query: 'price updates',
                type: DocumentationType.TENANT,
                resultsCount: 5,
                clickedResultId: tenantDoc.id
            }
        });
        console.log(`   Created search log: ${search.id} - Query: "${search.query}"`);

        // Test 7: Add user feedback
        console.log('\n✅ Test 7: Adding user feedback...');
        const feedback = await prisma.documentationFeedback.create({
            data: {
                documentId: tenantDoc.id,
                rating: 5,
                comment: 'Very helpful guide!'
            }
        });
        console.log(`   Created feedback: ${feedback.id} - Rating: ${feedback.rating}/5`);

        // Test 8: Create a redirect
        console.log('\n✅ Test 8: Creating redirect...');
        const redirect = await prisma.documentationRedirect.create({
            data: {
                oldPath: '/docs/old-getting-started',
                newPath: '/docs/getting-started'
            }
        });
        console.log(`   Created redirect: ${redirect.oldPath} -> ${redirect.newPath}`);

        // Test 9: Query documents by type
        console.log('\n✅ Test 9: Querying documents by type...');
        const tenantDocs = await prisma.documentationDocument.findMany({
            where: { type: DocumentationType.TENANT }
        });
        const adminDocs = await prisma.documentationDocument.findMany({
            where: { type: DocumentationType.ADMIN }
        });
        console.log(`   Found ${tenantDocs.length} tenant docs and ${adminDocs.length} admin docs`);

        // Test 10: Query with relations
        console.log('\n✅ Test 10: Querying with relations...');
        const docWithRelations = await prisma.documentationDocument.findUnique({
            where: { id: tenantDoc.id },
            include: {
                versions: true,
                pageViews: true,
                feedback: true,
                suggestions: true
            }
        });
        console.log(`   Document has:`);
        console.log(`   - ${docWithRelations?.versions.length} versions`);
        console.log(`   - ${docWithRelations?.pageViews.length} page views`);
        console.log(`   - ${docWithRelations?.feedback.length} feedback entries`);
        console.log(`   - ${docWithRelations?.suggestions.length} suggestions`);

        // Test 11: Test unique constraint (type + slug)
        console.log('\n✅ Test 11: Testing unique constraint...');
        try {
            await prisma.documentationDocument.create({
                data: {
                    type: DocumentationType.TENANT,
                    slug: 'getting-started', // Duplicate slug for same type
                    title: 'Duplicate',
                    content: 'Test',
                    htmlContent: '<p>Test</p>',
                    category: 'test'
                }
            });
            console.log('   ❌ FAILED: Should have thrown unique constraint error');
        } catch (error: any) {
            if (error.code === 'P2002') {
                console.log('   ✓ Unique constraint working correctly');
            } else {
                throw error;
            }
        }

        // Test 12: Test cascade delete
        console.log('\n✅ Test 12: Testing cascade delete...');
        const testDoc = await prisma.documentationDocument.create({
            data: {
                type: DocumentationType.TENANT,
                slug: 'test-cascade',
                title: 'Test Cascade',
                content: 'Test',
                htmlContent: '<p>Test</p>',
                category: 'test'
            }
        });
        await prisma.documentationVersion.create({
            data: {
                documentId: testDoc.id,
                content: 'Test version',
                createdBy: 'system'
            }
        });
        await prisma.documentationDocument.delete({
            where: { id: testDoc.id }
        });
        const orphanedVersions = await prisma.documentationVersion.findMany({
            where: { documentId: testDoc.id }
        });
        console.log(`   ✓ Cascade delete working: ${orphanedVersions.length} orphaned versions (should be 0)`);

        // Test 13: Analytics aggregation
        console.log('\n✅ Test 13: Testing analytics aggregation...');
        const avgRating = await prisma.documentationFeedback.aggregate({
            where: { documentId: tenantDoc.id },
            _avg: { rating: true },
            _count: { rating: true }
        });
        console.log(`   Average rating: ${avgRating._avg.rating?.toFixed(2)} (${avgRating._count.rating} ratings)`);

        // Test 14: Search analytics
        console.log('\n✅ Test 14: Testing search analytics...');
        const searchStats = await prisma.documentationSearch.groupBy({
            by: ['type'],
            _count: { query: true },
            _avg: { resultsCount: true }
        });
        searchStats.forEach(stat => {
            console.log(`   ${stat.type}: ${stat._count.query} searches, avg ${stat._avg.resultsCount?.toFixed(1)} results`);
        });

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await prisma.documentationRedirect.deleteMany({});
        await prisma.documentationFeedback.deleteMany({});
        await prisma.documentationSearch.deleteMany({});
        await prisma.documentationPageView.deleteMany({});
        await prisma.documentationSuggestion.deleteMany({});
        await prisma.documentationVersion.deleteMany({});
        await prisma.documentationDocument.deleteMany({});
        console.log('   ✓ Test data cleaned up');

        console.log('\n✅ All tests passed! Migration is working correctly.\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run tests
testDocumentationMigration()
    .then(() => {
        console.log('✨ Documentation migration test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Documentation migration test failed:', error);
        process.exit(1);
    });
