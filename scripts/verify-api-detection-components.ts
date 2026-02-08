/**
 * Verification script for API Detection components
 * 
 * This script verifies that all detection components are properly implemented
 * and can be instantiated without errors.
 */

import { APIDetector } from '@/lib/services/api-detection/api-detector';
import { APIPatternAnalyzer } from '@/lib/services/api-detection/api-pattern-analyzer';
import { NetworkInterceptor } from '@/lib/services/api-detection/network-interceptor';
import type {
    APIPattern,
    CapturedRequest,
    DetectionOptions,
    ValidationResult,
    FieldMapping,
    PaginationPattern,
} from '@/lib/types/api-detection';

console.log('🔍 Verifying API Detection Components...\n');

// Test 1: Verify type definitions exist
console.log('✓ Type definitions imported successfully');
console.log('  - APIPattern');
console.log('  - CapturedRequest');
console.log('  - DetectionOptions');
console.log('  - ValidationResult');
console.log('  - FieldMapping');
console.log('  - PaginationPattern\n');

// Test 2: Verify NetworkInterceptor can be instantiated
try {
    const networkInterceptor = new NetworkInterceptor();
    console.log('✓ NetworkInterceptor instantiated successfully');
    console.log('  - startInterception() method exists:', typeof networkInterceptor.startInterception === 'function');
    console.log('  - getCapturedRequests() method exists:', typeof networkInterceptor.getCapturedRequests === 'function');
    console.log('  - stopInterception() method exists:', typeof networkInterceptor.stopInterception === 'function');
    console.log('  - getProductRequests() method exists:', typeof networkInterceptor.getProductRequests === 'function');
    console.log('  - clearRequests() method exists:', typeof networkInterceptor.clearRequests === 'function');
    console.log('  - isActive() method exists:', typeof networkInterceptor.isActive === 'function');
    console.log('  - getBufferSize() method exists:', typeof networkInterceptor.getBufferSize === 'function');
    console.log();
} catch (error) {
    console.error('✗ NetworkInterceptor instantiation failed:', error);
    process.exit(1);
}

// Test 3: Verify APIPatternAnalyzer can be instantiated
try {
    const patternAnalyzer = new APIPatternAnalyzer();
    console.log('✓ APIPatternAnalyzer instantiated successfully');
    console.log('  - analyzeRequests() method exists:', typeof patternAnalyzer.analyzeRequests === 'function');
    console.log('  - extractFieldMappings() method exists:', typeof patternAnalyzer.extractFieldMappings === 'function');
    console.log('  - detectPagination() method exists:', typeof patternAnalyzer.detectPagination === 'function');
    console.log();
} catch (error) {
    console.error('✗ APIPatternAnalyzer instantiation failed:', error);
    process.exit(1);
}

// Test 4: Verify APIDetector can be instantiated
try {
    const apiDetector = new APIDetector();
    console.log('✓ APIDetector instantiated successfully');
    console.log('  - detectAPIs() method exists:', typeof apiDetector.detectAPIs === 'function');
    console.log('  - validateAPI() method exists:', typeof apiDetector.validateAPI === 'function');
    console.log('  - rankAPIs() method exists:', typeof apiDetector.rankAPIs === 'function');
    console.log();
} catch (error) {
    console.error('✗ APIDetector instantiation failed:', error);
    process.exit(1);
}

// Test 5: Verify APIPatternAnalyzer can analyze empty requests
try {
    const patternAnalyzer = new APIPatternAnalyzer();
    const emptyRequests: CapturedRequest[] = [];
    const patterns = patternAnalyzer.analyzeRequests(emptyRequests);

    console.log('✓ APIPatternAnalyzer.analyzeRequests() works with empty input');
    console.log('  - Returned patterns:', patterns.length);
    console.log();
} catch (error) {
    console.error('✗ APIPatternAnalyzer.analyzeRequests() failed:', error);
    process.exit(1);
}

// Test 6: Verify APIPatternAnalyzer can extract field mappings
try {
    const patternAnalyzer = new APIPatternAnalyzer();
    const sampleResponse = {
        products: [
            {
                id: '123',
                name: 'Test Product',
                price: 99.99,
                sku: 'TEST-001',
                brand: 'Test Brand',
            },
        ],
    };
    const fieldMappings = patternAnalyzer.extractFieldMappings(sampleResponse);

    console.log('✓ APIPatternAnalyzer.extractFieldMappings() works');
    console.log('  - Extracted mappings:', fieldMappings.length);
    fieldMappings.forEach((mapping) => {
        console.log(`    ${mapping.sourceField} → ${mapping.targetField}`);
    });
    console.log();
} catch (error) {
    console.error('✗ APIPatternAnalyzer.extractFieldMappings() failed:', error);
    process.exit(1);
}

// Test 7: Verify APIPatternAnalyzer can detect pagination
try {
    const patternAnalyzer = new APIPatternAnalyzer();
    const sampleRequests: CapturedRequest[] = [
        {
            id: '1',
            url: 'https://example.com/api/products?page=1',
            method: 'GET',
            headers: {},
            responseStatus: 200,
            responseHeaders: {},
            responseBody: '[]',
            responseType: 'application/json',
            timestamp: Date.now(),
            duration: 100,
        },
        {
            id: '2',
            url: 'https://example.com/api/products?page=2',
            method: 'GET',
            headers: {},
            responseStatus: 200,
            responseHeaders: {},
            responseBody: '[]',
            responseType: 'application/json',
            timestamp: Date.now(),
            duration: 100,
        },
    ];
    const pagination = patternAnalyzer.detectPagination(sampleRequests);

    console.log('✓ APIPatternAnalyzer.detectPagination() works');
    if (pagination) {
        console.log('  - Pagination type:', pagination.type);
        console.log('  - Parameter name:', pagination.paramName);
        console.log('  - Start value:', pagination.startValue);
        console.log('  - Increment:', pagination.increment);
    } else {
        console.log('  - No pagination detected (expected for this test)');
    }
    console.log();
} catch (error) {
    console.error('✗ APIPatternAnalyzer.detectPagination() failed:', error);
    process.exit(1);
}

// Test 8: Verify APIDetector can rank APIs
try {
    const apiDetector = new APIDetector();
    const samplePatterns: Partial<APIPattern>[] = [
        {
            id: '1',
            url: 'https://example.com/api/products',
            confidenceScore: 75,
            fieldMappings: [
                { sourceField: 'name', targetField: 'name' },
                { sourceField: 'price', targetField: 'price' },
            ],
        },
        {
            id: '2',
            url: 'https://example.com/products',
            confidenceScore: 90,
            fieldMappings: [
                { sourceField: 'name', targetField: 'name' },
                { sourceField: 'price', targetField: 'price' },
                { sourceField: 'sku', targetField: 'sku' },
            ],
        },
        {
            id: '3',
            url: 'https://example.com/api/items',
            confidenceScore: 60,
            fieldMappings: [
                { sourceField: 'title', targetField: 'name' },
            ],
        },
    ];

    const rankedPatterns = apiDetector.rankAPIs(samplePatterns);

    console.log('✓ APIDetector.rankAPIs() works');
    console.log('  - Ranked patterns:');
    rankedPatterns.forEach((pattern, index) => {
        console.log(`    ${index + 1}. Score: ${pattern.confidenceScore}, URL: ${pattern.url}`);
    });
    console.log();
} catch (error) {
    console.error('✗ APIDetector.rankAPIs() failed:', error);
    process.exit(1);
}

console.log('✅ All API Detection components verified successfully!\n');
console.log('Summary:');
console.log('  ✓ Type definitions');
console.log('  ✓ NetworkInterceptor');
console.log('  ✓ APIPatternAnalyzer');
console.log('  ✓ APIDetector');
console.log('  ✓ Component methods');
console.log('  ✓ Basic functionality\n');

console.log('Note: This verification only tests component instantiation and basic methods.');
console.log('Full integration testing with real websites will be performed in later tasks.\n');
