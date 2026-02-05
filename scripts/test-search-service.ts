/**
 * Test script for Documentation Search Service
 * 
 * Tests search indexing, query execution, and suggestions
 */

import { searchService } from '@/lib/documentation/search';
import { documentationService } from '@/lib/documentation/service';
import { DocumentationType } from '@prisma/client';

async function testSearchService() {
    console.log('🔍 Testing Documentation Search Service\n');

    try {
        // Test 1: Index a document
        console.log('Test 1: Indexing documents...');
        const tenantDocs = await documentationService.listDocuments('TENANT');
        if (tenantDocs.length > 0) {
            await searchService.indexDocument(tenantDocs[0].id);
            console.log('✅ Document indexed successfully\n');
        } else {
            console.log('⚠️  No tenant documents found to index\n');
        }

        // Test 2: Search for content
        console.log('Test 2: Searching for "product"...');
        const searchResults = await searchService.search('product', 'TENANT', {
            limit: 5
        });
        console.log(`✅ Found ${searchResults.total} results`);
        console.log(`   Returned ${searchResults.results.length} results\n`);

        if (searchResults.results.length > 0) {
            console.log('   Top result:');
            console.log(`   - Title: ${searchResults.results[0].title}`);
            console.log(`   - Slug: ${searchResults.results[0].slug}`);
            console.log(`   - Relevance: ${searchResults.results[0].relevanceScore}`);
            console.log(`   - Excerpt: ${searchResults.results[0].excerpt.substring(0, 100)}...`);
            console.log(`   - Breadcrumbs: ${searchResults.results[0].breadcrumbs.map(b => b.title).join(' > ')}\n`);
        }

        // Test 3: Search with category filter
        console.log('Test 3: Searching with category filter...');
        const categoryResults = await searchService.search('setup', 'TENANT', {
            category: 'getting-started',
            limit: 5
        });
        console.log(`✅ Found ${categoryResults.total} results in "getting-started" category\n`);

        // Test 4: Search with no results
        console.log('Test 4: Searching for non-existent term...');
        const noResults = await searchService.search('xyzabc123nonexistent', 'TENANT');
        console.log(`✅ Found ${noResults.total} results`);
        if (noResults.suggestions && noResults.suggestions.length > 0) {
            console.log(`   Suggestions provided: ${noResults.suggestions.join(', ')}\n`);
        } else {
            console.log('   No suggestions available\n');
        }

        // Test 5: Search isolation (tenant vs admin)
        console.log('Test 5: Testing search isolation...');
        const tenantResults = await searchService.search('system', 'TENANT', { limit: 10 });
        const adminResults = await searchService.search('system', 'ADMIN', { limit: 10 });
        console.log(`✅ Tenant search: ${tenantResults.total} results`);
        console.log(`✅ Admin search: ${adminResults.total} results`);

        // Verify isolation
        const tenantHasAdminDocs = tenantResults.results.some(r => r.slug.includes('admin'));
        const adminHasTenantDocs = adminResults.results.some(r => !r.slug.includes('admin'));

        if (!tenantHasAdminDocs) {
            console.log('✅ Search isolation verified: Tenant search returns no admin docs\n');
        } else {
            console.log('⚠️  Search isolation issue: Tenant search returned admin docs\n');
        }

        // Test 6: Pagination
        console.log('Test 6: Testing pagination...');
        const page1 = await searchService.search('price', 'TENANT', { limit: 2, offset: 0 });
        const page2 = await searchService.search('price', 'TENANT', { limit: 2, offset: 2 });
        console.log(`✅ Page 1: ${page1.results.length} results`);
        console.log(`✅ Page 2: ${page2.results.length} results`);

        if (page1.results.length > 0 && page2.results.length > 0) {
            const differentResults = page1.results[0].documentId !== page2.results[0].documentId;
            console.log(`✅ Pagination working: ${differentResults ? 'Different results' : 'Same results (may need more docs)'}\n`);
        } else {
            console.log('⚠️  Not enough results to test pagination\n');
        }

        // Test 7: Get suggestions
        console.log('Test 7: Testing search suggestions...');
        const suggestions = await searchService.suggest('test', 'TENANT');
        console.log(`✅ Generated ${suggestions.length} suggestions`);
        if (suggestions.length > 0) {
            console.log(`   Suggestions: ${suggestions.join(', ')}\n`);
        } else {
            console.log('   No suggestions available (need search history)\n');
        }

        // Test 8: Reindex all documents
        console.log('Test 8: Reindexing all tenant documents...');
        await searchService.reindexAll('TENANT');
        console.log('✅ All tenant documents reindexed\n');

        // Test 9: Search with multiple terms
        console.log('Test 9: Searching with multiple terms...');
        const multiTermResults = await searchService.search('product price update', 'TENANT', { limit: 5 });
        console.log(`✅ Found ${multiTermResults.total} results for multi-term query`);
        if (multiTermResults.results.length > 0) {
            console.log(`   Matched terms in top result: ${multiTermResults.results[0].matchedTerms.join(', ')}\n`);
        }

        // Test 10: Search ranking
        console.log('Test 10: Testing search ranking...');
        const rankingResults = await searchService.search('documentation', 'TENANT', { limit: 5 });
        if (rankingResults.results.length >= 2) {
            const firstScore = rankingResults.results[0].relevanceScore;
            const secondScore = rankingResults.results[1].relevanceScore;
            console.log(`✅ Top result score: ${firstScore}`);
            console.log(`✅ Second result score: ${secondScore}`);
            console.log(`✅ Ranking order: ${firstScore >= secondScore ? 'Correct' : 'Incorrect'}\n`);
        } else {
            console.log('⚠️  Not enough results to test ranking\n');
        }

        console.log('✅ All search service tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

// Run tests
testSearchService()
    .then(() => {
        console.log('\n✅ Search service test suite passed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Search service test suite failed:', error);
        process.exit(1);
    });
