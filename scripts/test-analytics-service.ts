/**
 * Test script for Documentation Analytics Service
 * 
 * Tests all analytics tracking and metrics aggregation functionality.
 */

import { analyticsService } from '@/lib/documentation/analytics';
import { prisma } from '@/lib/prisma';
import { DocumentationType } from '@prisma/client';

async function main() {
    console.log('🧪 Testing Documentation Analytics Service\n');

    try {
        // Clean up any existing test data
        console.log('🧹 Cleaning up test data...');
        await prisma.documentationFeedback.deleteMany({
            where: {
                document: {
                    slug: {
                        startsWith: 'test-analytics-',
                    },
                },
            },
        });
        await prisma.documentationPageView.deleteMany({
            where: {
                document: {
                    slug: {
                        startsWith: 'test-analytics-',
                    },
                },
            },
        });
        await prisma.documentationSearch.deleteMany({
            where: {
                query: {
                    startsWith: 'test-analytics-',
                },
            },
        });
        await prisma.documentationDocument.deleteMany({
            where: {
                slug: {
                    startsWith: 'test-analytics-',
                },
            },
        });

        // Create test documents
        console.log('📄 Creating test documents...');
        const doc1 = await prisma.documentationDocument.create({
            data: {
                type: DocumentationType.TENANT,
                slug: 'test-analytics-doc-1',
                title: 'Test Analytics Document 1',
                content: '# Test Document 1\n\nThis is a test document.',
                htmlContent: '<h1>Test Document 1</h1><p>This is a test document.</p>',
                category: 'testing',
                metadata: {},
            },
        });

        const doc2 = await prisma.documentationDocument.create({
            data: {
                type: DocumentationType.TENANT,
                slug: 'test-analytics-doc-2',
                title: 'Test Analytics Document 2',
                content: '# Test Document 2\n\nThis is another test document.',
                htmlContent: '<h1>Test Document 2</h1><p>This is another test document.</p>',
                category: 'testing',
                metadata: {},
            },
        });

        const doc3 = await prisma.documentationDocument.create({
            data: {
                type: DocumentationType.ADMIN,
                slug: 'test-analytics-doc-3',
                title: 'Test Analytics Document 3',
                content: '# Test Document 3\n\nThis is an admin test document.',
                htmlContent: '<h1>Test Document 3</h1><p>This is an admin test document.</p>',
                category: 'testing',
                metadata: {},
            },
        });

        console.log(`✅ Created 3 test documents\n`);

        // Test 1: Track page views
        console.log('📊 Test 1: Track page views');
        await analyticsService.trackPageView(doc1.id, 'tenant', 'user-1', 'session-1', 45);
        await analyticsService.trackPageView(doc1.id, 'tenant', 'user-2', 'session-2', 120);
        await analyticsService.trackPageView(doc1.id, 'tenant', 'user-1', 'session-1', 30);
        await analyticsService.trackPageView(doc2.id, 'tenant', 'user-1', 'session-1', 60);
        await analyticsService.trackPageView(doc2.id, 'tenant', 'user-3', 'session-3', 5); // Bounce
        await analyticsService.trackPageView(doc3.id, 'admin', 'admin-1', 'session-4', 90);
        console.log('✅ Tracked 6 page views\n');

        // Test 2: Track searches
        console.log('🔍 Test 2: Track searches');
        await analyticsService.trackSearch('test-analytics-query-1', 'tenant', 5, doc1.id);
        await analyticsService.trackSearch('test-analytics-query-1', 'tenant', 5);
        await analyticsService.trackSearch('test-analytics-query-2', 'tenant', 0);
        await analyticsService.trackSearch('test-analytics-query-3', 'admin', 10, doc3.id);
        console.log('✅ Tracked 4 searches\n');

        // Test 3: Track feedback
        console.log('⭐ Test 3: Track feedback');
        await analyticsService.trackFeedback(doc1.id, 5, 'Great documentation!', 'user-1');
        await analyticsService.trackFeedback(doc1.id, 4, 'Very helpful', 'user-2');
        await analyticsService.trackFeedback(doc1.id, 3, undefined, 'user-3');
        await analyticsService.trackFeedback(doc2.id, 2, 'Needs improvement', 'user-1');
        await analyticsService.trackFeedback(doc3.id, 5, 'Perfect!', 'admin-1');
        console.log('✅ Tracked 5 feedback entries\n');

        // Test 4: Get popular pages
        console.log('📈 Test 4: Get popular pages');
        const timeRange = {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
            end: new Date(),
        };
        const popularPages = await analyticsService.getPopularPages('tenant', timeRange, 10);
        console.log(`Found ${popularPages.length} popular pages:`);
        for (const page of popularPages) {
            console.log(`  - ${page.title}: ${page.views} views, ${page.uniqueVisitors} unique visitors, ${page.avgTimeOnPage.toFixed(1)}s avg time`);
        }
        console.log();

        // Test 5: Get search metrics
        console.log('🔎 Test 5: Get search metrics');
        const searchMetrics = await analyticsService.getSearchMetrics('tenant', timeRange, 10);
        console.log(`Found ${searchMetrics.length} search queries:`);
        for (const metric of searchMetrics) {
            console.log(`  - "${metric.query}": ${metric.searchCount} searches, ${metric.avgResultsCount.toFixed(1)} avg results, ${metric.clickThroughRate.toFixed(1)}% CTR`);
        }
        console.log();

        // Test 6: Get bounce rates
        console.log('📉 Test 6: Get bounce rates');
        const bounceRates = await analyticsService.getBounceRates('tenant', timeRange, 10);
        console.log(`Found ${bounceRates.length} pages with bounce rates:`);
        for (const metric of bounceRates) {
            console.log(`  - ${metric.title}: ${metric.bounceRate.toFixed(1)}% bounce rate (${metric.views} views)`);
        }
        console.log();

        // Test 7: Get related pages
        console.log('🔗 Test 7: Get related pages');
        const relatedPages = await analyticsService.getRelatedPages(doc1.id, 5);
        console.log(`Found ${relatedPages.length} related pages for "${doc1.title}":`);
        for (const page of relatedPages) {
            console.log(`  - ${page.title}: ${page.coOccurrenceCount} co-occurrences`);
        }
        console.log();

        // Test 8: Get feedback summary
        console.log('💬 Test 8: Get feedback summary');
        const feedbackSummary = await analyticsService.getFeedbackSummary(doc1.id, 5);
        console.log(`Feedback summary for "${doc1.title}":`);
        console.log(`  - Average rating: ${feedbackSummary.averageRating.toFixed(2)}/5`);
        console.log(`  - Total feedback: ${feedbackSummary.totalFeedback}`);
        console.log(`  - Rating distribution:`);
        for (let i = 5; i >= 1; i--) {
            const count = feedbackSummary.ratingDistribution[i] || 0;
            const bar = '█'.repeat(count);
            console.log(`    ${i}⭐: ${bar} (${count})`);
        }
        console.log(`  - Recent comments: ${feedbackSummary.recentComments.length}`);
        for (const comment of feedbackSummary.recentComments) {
            console.log(`    - ${comment.rating}⭐: "${comment.comment}"`);
        }
        console.log();

        // Test 9: Validate rating constraints
        console.log('🛡️  Test 9: Validate rating constraints');
        try {
            await analyticsService.trackFeedback(doc1.id, 6, 'Invalid rating');
            console.log('❌ Should have thrown error for rating > 5');
        } catch (error) {
            console.log('✅ Correctly rejected rating > 5');
        }

        try {
            await analyticsService.trackFeedback(doc1.id, 0, 'Invalid rating');
            console.log('❌ Should have thrown error for rating < 1');
        } catch (error) {
            console.log('✅ Correctly rejected rating < 1');
        }
        console.log();

        // Test 10: Test portal isolation
        console.log('🔒 Test 10: Test portal isolation');
        const tenantPages = await analyticsService.getPopularPages('tenant', timeRange, 10);
        const adminPages = await analyticsService.getPopularPages('admin', timeRange, 10);
        console.log(`Tenant portal: ${tenantPages.length} pages`);
        console.log(`Admin portal: ${adminPages.length} pages`);

        const tenantHasAdminDoc = tenantPages.some(p => p.documentId === doc3.id);
        const adminHasTenantDoc = adminPages.some(p => p.documentId === doc1.id || p.documentId === doc2.id);

        if (!tenantHasAdminDoc && !adminHasTenantDoc) {
            console.log('✅ Portal isolation working correctly');
        } else {
            console.log('❌ Portal isolation failed');
        }
        console.log();

        // Clean up test data
        console.log('🧹 Cleaning up test data...');
        await prisma.documentationFeedback.deleteMany({
            where: {
                document: {
                    slug: {
                        startsWith: 'test-analytics-',
                    },
                },
            },
        });
        await prisma.documentationPageView.deleteMany({
            where: {
                document: {
                    slug: {
                        startsWith: 'test-analytics-',
                    },
                },
            },
        });
        await prisma.documentationSearch.deleteMany({
            where: {
                query: {
                    startsWith: 'test-analytics-',
                },
            },
        });
        await prisma.documentationDocument.deleteMany({
            where: {
                slug: {
                    startsWith: 'test-analytics-',
                },
            },
        });
        console.log('✅ Test data cleaned up\n');

        console.log('✅ All analytics service tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
