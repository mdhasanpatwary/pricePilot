/**
 * Test script for Documentation API endpoints
 * 
 * Tests all documentation API endpoints:
 * - GET /api/v1/documentation/:type - list documents
 * - GET /api/v1/documentation/:type/:slug - get single document
 * - GET /api/v1/documentation/search - search documents
 * - POST /api/v1/documentation/analytics/view - track page view
 * - POST /api/v1/documentation/analytics/search - track search
 * - POST /api/v1/documentation/analytics/feedback - submit feedback
 * - GET /api/v1/documentation/analytics/metrics - get metrics (admin only)
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface TestResult {
    endpoint: string;
    method: string;
    status: number;
    success: boolean;
    error?: string;
    data?: any;
}

const results: TestResult[] = [];

async function testEndpoint(
    endpoint: string,
    method: string,
    options: RequestInit = {}
): Promise<TestResult> {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        const data = await response.json();

        return {
            endpoint,
            method,
            status: response.status,
            success: data.success || false,
            data,
        };
    } catch (error) {
        return {
            endpoint,
            method,
            status: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

async function runTests() {
    console.log('🧪 Testing Documentation API Endpoints\n');
    console.log('='.repeat(60));

    // Test 1: List tenant documents
    console.log('\n📋 Test 1: List tenant documents');
    const test1 = await testEndpoint('/api/v1/documentation/tenant', 'GET');
    results.push(test1);
    console.log(`Status: ${test1.status}`);
    console.log(`Success: ${test1.success}`);
    if (test1.data?.data?.documents) {
        console.log(`Documents found: ${test1.data.data.documents.length}`);
    }

    // Test 2: List tenant documents with category filter
    console.log('\n📋 Test 2: List tenant documents (filtered by category)');
    const test2 = await testEndpoint(
        '/api/v1/documentation/tenant?category=getting-started',
        'GET'
    );
    results.push(test2);
    console.log(`Status: ${test2.status}`);
    console.log(`Success: ${test2.success}`);
    if (test2.data?.data?.documents) {
        console.log(`Documents found: ${test2.data.data.documents.length}`);
    }

    // Test 3: Get single tenant document
    console.log('\n📄 Test 3: Get single tenant document');
    const test3 = await testEndpoint(
        '/api/v1/documentation/tenant/getting-started/introduction',
        'GET'
    );
    results.push(test3);
    console.log(`Status: ${test3.status}`);
    console.log(`Success: ${test3.success}`);
    if (test3.data?.data) {
        console.log(`Document: ${test3.data.data.title}`);
        console.log(`Has Markdown: ${!!test3.data.data.content}`);
        console.log(`Has HTML: ${!!test3.data.data.htmlContent}`);
    }

    // Test 4: Get document with format=markdown
    console.log('\n📄 Test 4: Get document (markdown only)');
    const test4 = await testEndpoint(
        '/api/v1/documentation/tenant/getting-started/introduction?format=markdown',
        'GET'
    );
    results.push(test4);
    console.log(`Status: ${test4.status}`);
    console.log(`Success: ${test4.success}`);
    if (test4.data?.data) {
        console.log(`Has Markdown: ${!!test4.data.data.content}`);
        console.log(`Has HTML: ${!!test4.data.data.htmlContent}`);
    }

    // Test 5: Get document with format=html
    console.log('\n📄 Test 5: Get document (html only)');
    const test5 = await testEndpoint(
        '/api/v1/documentation/tenant/getting-started/introduction?format=html',
        'GET'
    );
    results.push(test5);
    console.log(`Status: ${test5.status}`);
    console.log(`Success: ${test5.success}`);
    if (test5.data?.data) {
        console.log(`Has Markdown: ${!!test5.data.data.content}`);
        console.log(`Has HTML: ${!!test5.data.data.htmlContent}`);
    }

    // Test 6: Search tenant documents
    console.log('\n🔍 Test 6: Search tenant documents');
    const test6 = await testEndpoint(
        '/api/v1/documentation/search?q=product&type=tenant',
        'GET'
    );
    results.push(test6);
    console.log(`Status: ${test6.status}`);
    console.log(`Success: ${test6.success}`);
    if (test6.data?.results) {
        console.log(`Results found: ${test6.data.results.length}`);
    }

    // Test 7: Search with pagination
    console.log('\n🔍 Test 7: Search with pagination');
    const test7 = await testEndpoint(
        '/api/v1/documentation/search?q=price&type=tenant&limit=5&offset=0',
        'GET'
    );
    results.push(test7);
    console.log(`Status: ${test7.status}`);
    console.log(`Success: ${test7.success}`);
    if (test7.data?.results) {
        console.log(`Results found: ${test7.data.results.length}`);
    }

    // Test 8: Track page view
    console.log('\n📊 Test 8: Track page view');
    const test8 = await testEndpoint('/api/v1/documentation/analytics/view', 'POST', {
        body: JSON.stringify({
            documentId: 'test-doc-id',
            type: 'tenant',
        }),
    });
    results.push(test8);
    console.log(`Status: ${test8.status}`);
    console.log(`Success: ${test8.success}`);

    // Test 9: Track search
    console.log('\n📊 Test 9: Track search');
    const test9 = await testEndpoint('/api/v1/documentation/analytics/search', 'POST', {
        body: JSON.stringify({
            query: 'test search',
            type: 'tenant',
            resultsCount: 5,
        }),
    });
    results.push(test9);
    console.log(`Status: ${test9.status}`);
    console.log(`Success: ${test9.success}`);

    // Test 10: Submit feedback
    console.log('\n📊 Test 10: Submit feedback');
    const test10 = await testEndpoint('/api/v1/documentation/analytics/feedback', 'POST', {
        body: JSON.stringify({
            documentId: 'test-doc-id',
            rating: 5,
            comment: 'Great documentation!',
        }),
    });
    results.push(test10);
    console.log(`Status: ${test10.status}`);
    console.log(`Success: ${test10.success}`);

    // Test 11: Get metrics (without auth - should fail)
    console.log('\n📊 Test 11: Get metrics (no auth - should fail)');
    const test11 = await testEndpoint('/api/v1/documentation/analytics/metrics', 'GET');
    results.push(test11);
    console.log(`Status: ${test11.status}`);
    console.log(`Success: ${test11.success}`);
    console.log(`Expected: 401 Unauthorized`);

    // Test 12: Invalid type
    console.log('\n❌ Test 12: Invalid type (should fail)');
    const test12 = await testEndpoint('/api/v1/documentation/invalid', 'GET');
    results.push(test12);
    console.log(`Status: ${test12.status}`);
    console.log(`Success: ${test12.success}`);
    console.log(`Expected: 400 Bad Request`);

    // Test 13: Missing search query
    console.log('\n❌ Test 13: Missing search query (should fail)');
    const test13 = await testEndpoint('/api/v1/documentation/search?type=tenant', 'GET');
    results.push(test13);
    console.log(`Status: ${test13.status}`);
    console.log(`Success: ${test13.success}`);
    console.log(`Expected: 400 Bad Request`);

    // Test 14: Document not found
    console.log('\n❌ Test 14: Document not found (should fail)');
    const test14 = await testEndpoint(
        '/api/v1/documentation/tenant/nonexistent/document',
        'GET'
    );
    results.push(test14);
    console.log(`Status: ${test14.status}`);
    console.log(`Success: ${test14.success}`);
    console.log(`Expected: 404 Not Found`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary\n');

    const passed = results.filter((r) => {
        // Success tests should have success=true and status 200
        // Error tests should have success=false and appropriate error status
        if (r.endpoint.includes('invalid') || r.endpoint.includes('nonexistent')) {
            return r.status >= 400 && !r.success;
        }
        if (r.endpoint.includes('metrics') && r.method === 'GET') {
            return r.status === 401 && !r.success; // Should be unauthorized
        }
        if (r.endpoint.includes('search') && !r.endpoint.includes('analytics')) {
            if (!r.endpoint.includes('q=')) {
                return r.status === 400 && !r.success; // Missing query
            }
        }
        return r.status === 200 && r.success;
    }).length;

    console.log(`Total tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${results.length - passed}`);
    console.log(`Success rate: ${((passed / results.length) * 100).toFixed(1)}%`);

    // Show failed tests
    const failed = results.filter((r) => {
        if (r.endpoint.includes('invalid') || r.endpoint.includes('nonexistent')) {
            return !(r.status >= 400 && !r.success);
        }
        if (r.endpoint.includes('metrics') && r.method === 'GET') {
            return !(r.status === 401 && !r.success);
        }
        if (r.endpoint.includes('search') && !r.endpoint.includes('analytics')) {
            if (!r.endpoint.includes('q=')) {
                return !(r.status === 400 && !r.success);
            }
        }
        return !(r.status === 200 && r.success);
    });

    if (failed.length > 0) {
        console.log('\n❌ Failed Tests:');
        failed.forEach((r) => {
            console.log(`  - ${r.method} ${r.endpoint}`);
            console.log(`    Status: ${r.status}, Success: ${r.success}`);
            if (r.error) {
                console.log(`    Error: ${r.error}`);
            }
        });
    }

    console.log('\n✅ Documentation API testing complete!');
}

// Run tests
runTests().catch(console.error);
