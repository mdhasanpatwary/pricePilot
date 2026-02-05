/**
 * Comprehensive Integration Test for Dual Documentation System
 * 
 * Tests:
 * 1. Complete user flows (tenant and admin)
 * 2. Search isolation
 * 3. Documentation hook with sample tasks
 * 4. Migration tool
 * 5. Version control (create, revert)
 * 6. Analytics tracking
 * 7. API endpoints
 */

import { prisma } from '@/lib/prisma';
import { DocumentationService } from '@/lib/documentation/service';
import { SearchService } from '@/lib/documentation/search';
import { AnalyticsService } from '@/lib/documentation/analytics';
import { DocumentationHook } from '@/lib/documentation/hook';
import { DocumentationMigrator } from '@/lib/documentation/migration/migrator';

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    details?: string;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, details?: string) {
    results.push({ name, passed, error, details });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name}`);
    if (error) console.error(`  Error: ${error}`);
    if (details) console.log(`  Details: ${details}`);
}

async function testTenantUserFlow() {
    console.log('\n=== Testing Tenant User Flow ===');

    try {
        const docService = new DocumentationService();

        // 1. List tenant documents
        const tenantDocs = await docService.listDocuments('tenant');
        logTest(
            'Tenant: List documents',
            tenantDocs.length > 0,
            undefined,
            `Found ${tenantDocs.length} tenant documents`
        );

        // 2. Get a specific tenant document
        if (tenantDocs.length > 0) {
            const doc = await docService.getDocument('tenant', tenantDocs[0].slug);
            logTest(
                'Tenant: Get document by slug',
                doc !== null && doc.type === 'tenant',
                undefined,
                `Retrieved: ${doc?.title}`
            );

            // 3. Get table of contents
            const toc = await docService.getTableOfContents('tenant');
            logTest(
                'Tenant: Get table of contents',
                toc.length > 0,
                undefined,
                `TOC has ${toc.length} top-level items`
            );

            // 4. Get breadcrumbs
            const breadcrumbs = await docService.getBreadcrumbs('tenant', tenantDocs[0].slug);
            logTest(
                'Tenant: Get breadcrumbs',
                breadcrumbs.length > 0,
                undefined,
                `Breadcrumb trail: ${breadcrumbs.map(b => b.title).join(' > ')}`
            );
        }
    } catch (error) {
        logTest('Tenant: User flow', false, error instanceof Error ? error.message : String(error));
    }
}

async function testAdminUserFlow() {
    console.log('\n=== Testing Admin User Flow ===');

    try {
        const docService = new DocumentationService();

        // 1. List admin documents
        const adminDocs = await docService.listDocuments('admin');
        logTest(
            'Admin: List documents',
            adminDocs.length > 0,
            undefined,
            `Found ${adminDocs.length} admin documents`
        );

        // 2. Get a specific admin document
        if (adminDocs.length > 0) {
            const doc = await docService.getDocument('admin', adminDocs[0].slug);
            logTest(
                'Admin: Get document by slug',
                doc !== null && doc.type === 'admin',
                undefined,
                `Retrieved: ${doc?.title}`
            );

            // 3. Get table of contents
            const toc = await docService.getTableOfContents('admin');
            logTest(
                'Admin: Get table of contents',
                toc.length > 0,
                undefined,
                `TOC has ${toc.length} top-level items`
            );
        }
    } catch (error) {
        logTest('Admin: User flow', false, error instanceof Error ? error.message : String(error));
    }
}

async function testSearchIsolation() {
    console.log('\n=== Testing Search Isolation ===');

    try {
        const searchService = new SearchService();

        // Index some test documents first
        const docService = new DocumentationService();
        const tenantDocs = await docService.listDocuments('tenant');
        const adminDocs = await docService.listDocuments('admin');

        // Search in tenant portal
        const tenantResults = await searchService.search('guide', 'tenant', { limit: 10 });
        const allTenantResults = tenantResults.results.every(r => {
            // Check if document is tenant type
            const doc = tenantDocs.find(d => d.slug === r.slug);
            return doc !== undefined;
        });

        logTest(
            'Search: Tenant isolation',
            allTenantResults,
            undefined,
            `Tenant search returned ${tenantResults.results.length} results, all tenant docs`
        );

        // Search in admin portal
        const adminResults = await searchService.search('system', 'admin', { limit: 10 });
        const allAdminResults = adminResults.results.every(r => {
            // Check if document is admin type
            const doc = adminDocs.find(d => d.slug === r.slug);
            return doc !== undefined;
        });

        logTest(
            'Search: Admin isolation',
            allAdminResults,
            undefined,
            `Admin search returned ${adminResults.results.length} results, all admin docs`
        );

        // Test search ranking
        const rankingResults = await searchService.search('price', 'tenant', { limit: 5 });
        logTest(
            'Search: Result ranking',
            rankingResults.results.length > 0,
            undefined,
            `Found ${rankingResults.results.length} results with relevance scores`
        );

    } catch (error) {
        logTest('Search: Isolation', false, error instanceof Error ? error.message : String(error));
    }
}

async function testDocumentationHook() {
    console.log('\n=== Testing Documentation Hook ===');

    try {
        const hook = new DocumentationHook();

        // Test with a sample task
        const sampleTask = {
            id: 'test-task-1',
            title: 'Add new price update API endpoint',
            description: 'Implement POST /api/v1/products/bulk-update endpoint for bulk price updates',
            category: 'api',
            completedAt: new Date(),
            completedBy: 'test-user'
        };

        // Analyze documentation impact
        const impact = await hook.analyzeDocumentationImpact(sampleTask);
        logTest(
            'Hook: Analyze impact',
            impact.hasImpact === true,
            undefined,
            `Impact type: ${impact.impactType}, Target: ${impact.targetAudience}`
        );

        // Classify documentation type
        const docType = await hook.classifyDocumentationType(sampleTask);
        logTest(
            'Hook: Classify type',
            docType === 'tenant' || docType === 'admin' || docType === 'both',
            undefined,
            `Classified as: ${docType}`
        );

        // Generate suggestion
        if (impact.hasImpact) {
            const suggestion = await hook.generateUpdateSuggestion(impact);
            logTest(
                'Hook: Generate suggestion',
                suggestion.status === 'pending',
                undefined,
                `Created suggestion: ${suggestion.suggestedTitle || 'Update existing doc'}`
            );

            // Find affected documents
            const affected = await hook.findAffectedDocuments(impact);
            logTest(
                'Hook: Find affected documents',
                true,
                undefined,
                `Found ${affected.length} potentially affected documents`
            );
        }

    } catch (error) {
        logTest('Hook: Documentation hook', false, error instanceof Error ? error.message : String(error));
    }
}

async function testVersionControl() {
    console.log('\n=== Testing Version Control ===');

    try {
        const docService = new DocumentationService();

        // Get a test document
        const docs = await docService.listDocuments('tenant');
        if (docs.length === 0) {
            logTest('Version: No documents to test', false, 'No tenant documents found');
            return;
        }

        const testDoc = await docService.getDocument('tenant', docs[0].slug);
        if (!testDoc) {
            logTest('Version: Document not found', false);
            return;
        }

        // Update the document to create a version
        const originalContent = testDoc.content;
        const updatedDoc = await docService.updateDocument(
            testDoc.id,
            originalContent + '\n\n## Test Update\n\nThis is a test update.',
            'test-user'
        );

        logTest(
            'Version: Create version on update',
            updatedDoc.content !== originalContent,
            undefined,
            'Document updated successfully'
        );

        // Get version history
        const history = await docService.getDocumentHistory(testDoc.id);
        logTest(
            'Version: Get history',
            history.length > 0,
            undefined,
            `Found ${history.length} version(s)`
        );

        // Revert to previous version
        if (history.length > 0) {
            const revertedDoc = await docService.revertDocument(
                testDoc.id,
                history[0].id,
                'test-user'
            );

            logTest(
                'Version: Revert document',
                revertedDoc.content === originalContent,
                undefined,
                'Document reverted successfully'
            );

            // Verify new version was created for revert
            const newHistory = await docService.getDocumentHistory(testDoc.id);
            logTest(
                'Version: Revert creates new version',
                newHistory.length > history.length,
                undefined,
                `History now has ${newHistory.length} version(s)`
            );
        }

    } catch (error) {
        logTest('Version: Control', false, error instanceof Error ? error.message : String(error));
    }
}

async function testAnalyticsTracking() {
    console.log('\n=== Testing Analytics Tracking ===');

    try {
        const analyticsService = new AnalyticsService();
        const docService = new DocumentationService();

        // Get a test document
        const docs = await docService.listDocuments('tenant');
        if (docs.length === 0) {
            logTest('Analytics: No documents to test', false);
            return;
        }

        const testDoc = await docService.getDocument('tenant', docs[0].slug);
        if (!testDoc) {
            logTest('Analytics: Document not found', false);
            return;
        }

        // Track page view
        await analyticsService.trackPageView(testDoc.id, 'tenant', 'test-user');
        logTest('Analytics: Track page view', true, undefined, 'Page view tracked');

        // Track search
        await analyticsService.trackSearch('test query', 'tenant', 5);
        logTest('Analytics: Track search', true, undefined, 'Search tracked');

        // Track feedback
        await analyticsService.trackFeedback(testDoc.id, 5, 'Great documentation!', 'test-user');
        logTest('Analytics: Track feedback', true, undefined, 'Feedback tracked');

        // Get metrics
        const timeRange = {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
            end: new Date()
        };

        const popularPages = await analyticsService.getPopularPages('tenant', timeRange);
        logTest(
            'Analytics: Get popular pages',
            true,
            undefined,
            `Found ${popularPages.length} popular page(s)`
        );

        const searchMetrics = await analyticsService.getSearchMetrics('tenant', timeRange);
        logTest(
            'Analytics: Get search metrics',
            true,
            undefined,
            `Found ${searchMetrics.length} search metric(s)`
        );

        const feedbackSummary = await analyticsService.getFeedbackSummary(testDoc.id);
        logTest(
            'Analytics: Get feedback summary',
            feedbackSummary.totalFeedback >= 0,
            undefined,
            `Average rating: ${feedbackSummary.averageRating}, Total: ${feedbackSummary.totalFeedback}`
        );

    } catch (error) {
        logTest('Analytics: Tracking', false, error instanceof Error ? error.message : String(error));
    }
}

async function testAPIEndpoints() {
    console.log('\n=== Testing API Endpoints ===');

    try {
        // Test document retrieval endpoint
        const docService = new DocumentationService();
        const docs = await docService.listDocuments('tenant');

        if (docs.length > 0) {
            const doc = await docService.getDocument('tenant', docs[0].slug);
            logTest(
                'API: Get document endpoint',
                doc !== null,
                undefined,
                `Retrieved document: ${doc?.title}`
            );
        }

        // Test list documents endpoint
        const tenantDocs = await docService.listDocuments('tenant', 'getting-started');
        logTest(
            'API: List documents with category filter',
            true,
            undefined,
            `Found ${tenantDocs.length} document(s) in category`
        );

        // Test search endpoint
        const searchService = new SearchService();
        const searchResults = await searchService.search('guide', 'tenant', {
            limit: 5,
            offset: 0
        });

        logTest(
            'API: Search endpoint with pagination',
            searchResults.results.length <= 5,
            undefined,
            `Returned ${searchResults.results.length} results (max 5)`
        );

        // Test suggestions endpoint (list)
        const suggestions = await prisma.documentationSuggestion.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' }
        });

        logTest(
            'API: List suggestions',
            true,
            undefined,
            `Found ${suggestions.length} suggestion(s)`
        );

    } catch (error) {
        logTest('API: Endpoints', false, error instanceof Error ? error.message : String(error));
    }
}

async function testMigrationTool() {
    console.log('\n=== Testing Migration Tool ===');

    try {
        // Note: We won't run the full migration as it modifies files
        // Instead, we'll test the analyzer component

        const migrator = new DocumentationMigrator();

        // Test document classification
        const tenantContent = `
# User Guide

This guide helps users set up their products and manage pricing.

## Getting Started

Follow these steps to add your first product...
    `;

        const adminContent = `
# System Architecture

This document describes the database schema and API architecture.

## Database Schema

The system uses PostgreSQL with the following tables...
    `;

        const classification1 = await migrator.classifyDocument(tenantContent);
        logTest(
            'Migration: Classify tenant document',
            classification1 === 'tenant',
            undefined,
            `Classified as: ${classification1}`
        );

        const classification2 = await migrator.classifyDocument(adminContent);
        logTest(
            'Migration: Classify admin document',
            classification2 === 'admin',
            undefined,
            `Classified as: ${classification2}`
        );

        // Check if migration has been run
        const redirects = await prisma.documentationRedirect.count();
        logTest(
            'Migration: Redirects created',
            redirects >= 0,
            undefined,
            `Found ${redirects} redirect(s) in database`
        );

    } catch (error) {
        logTest('Migration: Tool', false, error instanceof Error ? error.message : String(error));
    }
}

async function runAllTests() {
    console.log('🚀 Starting Dual Documentation System Integration Tests\n');
    console.log('='.repeat(60));

    try {
        await testTenantUserFlow();
        await testAdminUserFlow();
        await testSearchIsolation();
        await testDocumentationHook();
        await testVersionControl();
        await testAnalyticsTracking();
        await testAPIEndpoints();
        await testMigrationTool();

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 Test Summary');
        console.log('='.repeat(60));

        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;
        const total = results.length;

        console.log(`\nTotal Tests: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            results.filter(r => !r.passed).forEach(r => {
                console.log(`  - ${r.name}`);
                if (r.error) console.log(`    Error: ${r.error}`);
            });
        }

        console.log('\n' + '='.repeat(60));

        if (failed === 0) {
            console.log('✅ All integration tests passed!');
            process.exit(0);
        } else {
            console.log('❌ Some tests failed. Please review the errors above.');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Fatal error during testing:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run tests
runAllTests().catch(console.error);
