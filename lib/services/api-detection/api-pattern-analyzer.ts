/**
 * API Pattern Analyzer Component
 * 
 * Analyzes captured network requests to identify product data API patterns.
 * Uses heuristics to detect API endpoints, extract field mappings, and
 * identify pagination patterns.
 */

import type {
    CapturedRequest,
    APIPattern,
    FieldMapping,
    PaginationPattern,
} from '@/lib/types/api-detection';
import { randomUUID } from 'crypto';
import { AuthTokenDetector } from './auth-token-detector';

/**
 * Keywords that suggest product-related API endpoints
 */
const PRODUCT_KEYWORDS = [
    'product',
    'item',
    'catalog',
    'search',
    'list',
    'inventory',
    'goods',
    'merchandise',
];

/**
 * Common product field names to look for in API responses
 */
const PRODUCT_FIELDS = {
    name: ['name', 'title', 'product_name', 'productname', 'item_name'],
    price: ['price', 'cost', 'amount', 'value', 'product_price'],
    sku: ['sku', 'product_id', 'productid', 'item_id', 'code'],
    brand: ['brand', 'manufacturer', 'vendor', 'make'],
    model: ['model', 'model_number', 'modelnumber', 'variant'],
    currency: ['currency', 'currency_code', 'currencycode'],
    inStock: ['in_stock', 'instock', 'available', 'availability', 'stock'],
    imageUrl: ['image', 'image_url', 'imageurl', 'picture', 'photo', 'thumbnail'],
    url: ['url', 'link', 'product_url', 'producturl', 'href'],
};

/**
 * Minimum response size to consider (5KB)
 */
const MIN_RESPONSE_SIZE = 5000;

/**
 * APIPatternAnalyzer class
 * 
 * Analyzes captured network requests to discover product API patterns
 */
export class APIPatternAnalyzer {
    private authTokenDetector: AuthTokenDetector;

    constructor() {
        this.authTokenDetector = new AuthTokenDetector();
    }

    /**
     * Analyze captured requests to find product API patterns
     * 
     * Uses heuristics to identify product-related endpoints:
     * - URL contains product keywords
     * - Response contains arrays of objects with price/name fields
     * - Response size suggests multiple products (>5KB)
     * 
     * @param requests - Captured network requests
     * @returns Array of discovered API patterns
     */
    analyzeRequests(requests: CapturedRequest[]): Partial<APIPattern>[] {
        const patterns: Partial<APIPattern>[] = [];

        // Detect authentication tokens from all requests
        const authTokens = this.authTokenDetector.detectAuthTokens(requests);

        for (const request of requests) {
            // Skip non-JSON responses
            if (!request.responseType.includes('json')) {
                continue;
            }

            // Skip small responses
            if (request.responseBody.length < MIN_RESPONSE_SIZE) {
                continue;
            }

            // Check if URL contains product keywords
            const hasProductKeyword = PRODUCT_KEYWORDS.some((keyword) =>
                request.url.toLowerCase().includes(keyword)
            );

            if (!hasProductKeyword) {
                continue;
            }

            // Try to parse response
            let responseData: any;
            try {
                responseData = JSON.parse(request.responseBody);
            } catch (error) {
                continue;
            }

            // Find arrays in response
            const dataPath = this.findDataPath(responseData);
            if (!dataPath) {
                continue;
            }

            // Extract field mappings
            const fieldMappings = this.extractFieldMappings(responseData);
            if (fieldMappings.length === 0) {
                continue;
            }

            // Check if required fields are present (name and price)
            const hasName = fieldMappings.some((m) => m.targetField === 'name');
            const hasPrice = fieldMappings.some((m) => m.targetField === 'price');
            if (!hasName || !hasPrice) {
                continue;
            }

            // Calculate confidence score
            const confidenceScore = this.calculateConfidenceScore(
                request,
                responseData,
                fieldMappings
            );

            // Parse URL to extract query params
            const url = new URL(request.url);
            const queryParams: Record<string, string> = {};
            url.searchParams.forEach((value, key) => {
                queryParams[key] = value;
            });

            // Apply authentication tokens to headers and query params
            let headers = { ...request.headers };
            let updatedQueryParams = { ...queryParams };

            if (authTokens.length > 0) {
                headers = this.authTokenDetector.applyAuthTokens(headers, authTokens);
                updatedQueryParams = this.authTokenDetector.applyAuthQueryParams(
                    updatedQueryParams,
                    authTokens
                );
            }

            // Ensure User-Agent is set
            if (!headers['User-Agent'] && !headers['user-agent']) {
                headers['User-Agent'] = 'PricePilot/1.0 (API Detector)';
            }

            // Create API pattern
            const pattern: Partial<APIPattern> = {
                id: randomUUID(),
                url: url.origin + url.pathname,
                method: request.method,
                headers,
                queryParams: updatedQueryParams,
                bodyTemplate: request.requestBody,
                responseFormat: 'json',
                dataPath,
                fieldMappings,
                confidenceScore,
            };

            patterns.push(pattern);
        }

        // Sort by confidence score (highest first)
        return patterns.sort((a, b) => (b.confidenceScore || 0) - (a.confidenceScore || 0));
    }

    /**
     * Find the JSONPath to product data array in response
     * 
     * @param data - Parsed JSON response
     * @returns JSONPath string or null
     */
    private findDataPath(data: any): string | null {
        // Check if root is an array
        if (Array.isArray(data) && data.length > 0) {
            return '$';
        }

        // Check if root has a property that is an array
        if (typeof data === 'object' && data !== null) {
            for (const [key, value] of Object.entries(data)) {
                if (Array.isArray(value) && value.length > 0) {
                    // Check if array contains objects with product-like fields
                    const firstItem = value[0];
                    if (typeof firstItem === 'object' && firstItem !== null) {
                        const fields = Object.keys(firstItem).map((k) => k.toLowerCase());
                        const hasProductFields = Object.values(PRODUCT_FIELDS)
                            .flat()
                            .some((pf) => fields.includes(pf));

                        if (hasProductFields) {
                            return `$.${key}`;
                        }
                    }
                }

                // Check nested objects (one level deep)
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    for (const [nestedKey, nestedValue] of Object.entries(value)) {
                        if (Array.isArray(nestedValue) && nestedValue.length > 0) {
                            const firstItem = nestedValue[0];
                            if (typeof firstItem === 'object' && firstItem !== null) {
                                const fields = Object.keys(firstItem).map((k) => k.toLowerCase());
                                const hasProductFields = Object.values(PRODUCT_FIELDS)
                                    .flat()
                                    .some((pf) => fields.includes(pf));

                                if (hasProductFields) {
                                    return `$.${key}.${nestedKey}`;
                                }
                            }
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * Extract field mappings from API response
     * 
     * Maps API response fields to standard Product_Data fields
     * 
     * @param response - Parsed API response
     * @returns Array of field mappings
     */
    extractFieldMappings(response: any): FieldMapping[] {
        const mappings: FieldMapping[] = [];

        // Find the product array
        let productArray: any[] = [];
        if (Array.isArray(response)) {
            productArray = response;
        } else if (typeof response === 'object' && response !== null) {
            // Find first array in response
            for (const value of Object.values(response)) {
                if (Array.isArray(value) && value.length > 0) {
                    productArray = value;
                    break;
                }

                // Check nested objects
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    for (const nestedValue of Object.values(value)) {
                        if (Array.isArray(nestedValue) && nestedValue.length > 0) {
                            productArray = nestedValue;
                            break;
                        }
                    }
                    if (productArray.length > 0) break;
                }
            }
        }

        if (productArray.length === 0) {
            return mappings;
        }

        // Get first item to analyze fields
        const firstItem = productArray[0];
        if (typeof firstItem !== 'object' || firstItem === null) {
            return mappings;
        }

        // Map fields
        const itemFields = Object.keys(firstItem);

        for (const [targetField, sourceFieldVariants] of Object.entries(PRODUCT_FIELDS)) {
            for (const sourceField of itemFields) {
                const lowerSourceField = sourceField.toLowerCase();

                // Check if source field matches any variant
                if (sourceFieldVariants.some((variant) => lowerSourceField.includes(variant))) {
                    mappings.push({
                        sourceField,
                        targetField,
                    });
                    break; // Only map once per target field
                }
            }
        }

        return mappings;
    }

    /**
     * Detect pagination pattern in API requests
     * 
     * Analyzes a series of related requests to identify pagination patterns
     * 
     * @param requests - Series of related requests
     * @returns Pagination pattern or null
     */
    detectPagination(requests: CapturedRequest[]): PaginationPattern | null {
        if (requests.length < 2) {
            return null;
        }

        // Group requests by base URL
        const baseUrl = requests[0].url.split('?')[0];
        const relatedRequests = requests.filter((r) => r.url.startsWith(baseUrl));

        if (relatedRequests.length < 2) {
            return null;
        }

        // Extract query parameters from each request
        const queryParamsList = relatedRequests.map((r) => {
            const url = new URL(r.url);
            const params: Record<string, string> = {};
            url.searchParams.forEach((value, key) => {
                params[key] = value;
            });
            return params;
        });

        // Look for common pagination parameters
        const paginationParams = ['page', 'offset', 'cursor', 'skip', 'start', 'from'];

        for (const paramName of paginationParams) {
            const values = queryParamsList
                .map((params) => params[paramName])
                .filter((v) => v !== undefined);

            if (values.length < 2) {
                continue;
            }

            // Check if values are numeric (page or offset pagination)
            const numericValues = values.map((v) => parseInt(v, 10)).filter((v) => !isNaN(v));

            if (numericValues.length === values.length) {
                // Detect pagination type
                const sorted = [...numericValues].sort((a, b) => a - b);
                const increment = sorted[1] - sorted[0];

                if (increment > 0) {
                    // Determine type based on increment
                    const type = increment === 1 ? 'page' : 'offset';

                    return {
                        type,
                        paramName,
                        startValue: sorted[0],
                        increment,
                    };
                }
            } else {
                // Cursor-based pagination
                return {
                    type: 'cursor',
                    paramName,
                    startValue: values[0],
                };
            }
        }

        return null;
    }

    /**
     * Calculate confidence score for an API pattern
     * 
     * Factors:
     * - Number of mapped fields (more is better)
     * - Response size (larger suggests more data)
     * - URL structure (clean URLs are better)
     * - Response consistency
     * 
     * @param request - Captured request
     * @param responseData - Parsed response data
     * @param fieldMappings - Extracted field mappings
     * @returns Confidence score (0-100)
     */
    private calculateConfidenceScore(
        request: CapturedRequest,
        responseData: any,
        fieldMappings: FieldMapping[]
    ): number {
        let score = 0;

        // Field coverage (max 40 points)
        const fieldCoverage = (fieldMappings.length / Object.keys(PRODUCT_FIELDS).length) * 40;
        score += fieldCoverage;

        // Response size (max 20 points)
        const sizeScore = Math.min((request.responseBody.length / 50000) * 20, 20);
        score += sizeScore;

        // URL structure (max 20 points)
        const url = request.url.toLowerCase();
        let urlScore = 0;
        if (url.includes('/api/')) urlScore += 10;
        if (url.includes('/product') || url.includes('/item')) urlScore += 10;
        score += urlScore;

        // Response structure (max 20 points)
        let structureScore = 0;
        if (Array.isArray(responseData) || this.hasArrayProperty(responseData)) {
            structureScore += 10;
        }
        if (this.hasConsistentStructure(responseData)) {
            structureScore += 10;
        }
        score += structureScore;

        return Math.min(Math.round(score), 100);
    }

    /**
     * Check if object has array property
     */
    private hasArrayProperty(data: any): boolean {
        if (typeof data !== 'object' || data === null) {
            return false;
        }

        return Object.values(data).some((value) => Array.isArray(value));
    }

    /**
     * Check if response has consistent structure
     * 
     * Verifies that all items in arrays have the same fields
     */
    private hasConsistentStructure(data: any): boolean {
        let productArray: any[] = [];

        if (Array.isArray(data)) {
            productArray = data;
        } else if (typeof data === 'object' && data !== null) {
            for (const value of Object.values(data)) {
                if (Array.isArray(value)) {
                    productArray = value;
                    break;
                }
            }
        }

        if (productArray.length < 2) {
            return true; // Can't determine consistency with less than 2 items
        }

        // Get fields from first item
        const firstItem = productArray[0];
        if (typeof firstItem !== 'object' || firstItem === null) {
            return false;
        }

        const firstFields = Object.keys(firstItem).sort();

        // Check if all items have the same fields
        return productArray.every((item) => {
            if (typeof item !== 'object' || item === null) {
                return false;
            }

            const itemFields = Object.keys(item).sort();
            return JSON.stringify(itemFields) === JSON.stringify(firstFields);
        });
    }
}
