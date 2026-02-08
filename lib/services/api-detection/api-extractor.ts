/**
 * API Extractor Component
 * 
 * Extracts product data using discovered API patterns.
 * Handles HTTP requests, field mapping, response parsing, and data normalization.
 */

import type {
    APIPattern,
    Product,
    ExtractionOptions,
    FieldMapping,
} from '@/lib/types/api-detection';
import { XMLParser } from 'fast-xml-parser';
import { RobotsTxtParser } from './robots-txt-parser';

/**
 * Configuration for retry logic
 */
interface RetryConfig {
    /** Maximum number of retry attempts */
    maxRetries: number;
    /** Initial delay in milliseconds */
    initialDelay: number;
    /** Maximum delay in milliseconds */
    maxDelay: number;
    /** Backoff multiplier */
    backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
};

/**
 * Rate limiter for API requests
 */
class RateLimiter {
    private lastRequestTime: Map<string, number> = new Map();
    private minInterval: number;
    private endpointLimits: Map<string, number> = new Map();

    constructor(minIntervalMs: number = 1000) {
        this.minInterval = minIntervalMs;
    }

    /**
     * Wait if necessary to respect rate limits
     * 
     * @param key - Rate limit key (e.g., domain)
     * @param customInterval - Optional custom interval for this specific request
     */
    async wait(key: string, customInterval?: number): Promise<void> {
        const interval = customInterval || this.endpointLimits.get(key) || this.minInterval;
        const lastTime = this.lastRequestTime.get(key) || 0;
        const now = Date.now();
        const timeSinceLastRequest = now - lastTime;

        if (timeSinceLastRequest < interval) {
            const waitTime = interval - timeSinceLastRequest;
            await new Promise((resolve) => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime.set(key, Date.now());
    }

    /**
     * Set minimum interval between requests
     * 
     * @param intervalMs - Minimum interval in milliseconds
     */
    setMinInterval(intervalMs: number): void {
        this.minInterval = intervalMs;
    }

    /**
     * Set rate limit for a specific endpoint
     * 
     * @param endpoint - Endpoint URL or domain
     * @param intervalMs - Minimum interval in milliseconds
     */
    setEndpointLimit(endpoint: string, intervalMs: number): void {
        this.endpointLimits.set(endpoint, intervalMs);
    }

    /**
     * Get rate limit for an endpoint
     * 
     * @param endpoint - Endpoint URL or domain
     * @returns Rate limit interval in milliseconds
     */
    getEndpointLimit(endpoint: string): number {
        return this.endpointLimits.get(endpoint) || this.minInterval;
    }

    /**
     * Clear rate limit for an endpoint
     * 
     * @param endpoint - Endpoint URL or domain
     */
    clearEndpointLimit(endpoint: string): void {
        this.endpointLimits.delete(endpoint);
        this.lastRequestTime.delete(endpoint);
    }

    /**
     * Clear all rate limits
     */
    clearAll(): void {
        this.endpointLimits.clear();
        this.lastRequestTime.clear();
    }
}

/**
 * APIExtractor class
 * 
 * Fetches product data from discovered API endpoints and normalizes it
 * to the standard Product format using field mappings.
 */
export class APIExtractor {
    private xmlParser: XMLParser;
    private retryConfig: RetryConfig;
    private rateLimiter: RateLimiter;
    private robotsParser: RobotsTxtParser;

    constructor(retryConfig?: Partial<RetryConfig>, rateLimitMs: number = 1000) {
        // Initialize XML parser for XML responses
        this.xmlParser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
        });

        // Initialize retry configuration
        this.retryConfig = {
            ...DEFAULT_RETRY_CONFIG,
            ...retryConfig,
        };

        // Initialize rate limiter
        this.rateLimiter = new RateLimiter(rateLimitMs);

        // Initialize robots.txt parser
        this.robotsParser = new RobotsTxtParser();
    }

    /**
     * Extract products using API pattern
     * 
     * Makes HTTP requests with discovered patterns, applies field mappings,
     * and normalizes responses to standard Product format.
     * 
     * @param pattern - Validated API pattern
     * @param options - Extraction options
     * @returns Array of extracted products
     * @throws Error if extraction fails
     */
    async extractProducts(
        pattern: APIPattern,
        options: ExtractionOptions = {}
    ): Promise<Product[]> {
        const {
            maxProducts,
            timeout = 60000,
        } = options;

        try {
            // Check robots.txt compliance before making requests
            const baseUrl = new URL(pattern.url).origin;
            const path = new URL(pattern.url).pathname;
            const isAllowed = await this.robotsParser.isPathAllowed(baseUrl, path);

            if (!isAllowed) {
                throw new Error(`Path ${path} is disallowed by robots.txt for ${baseUrl}`);
            }

            // If pattern has pagination, use paginated extraction
            if (pattern.paginationPattern) {
                return await this.extractPaginatedProducts(pattern, options);
            }

            // Build request URL with query parameters
            const url = this.buildRequestUrl(pattern.url, pattern.queryParams);

            // Make HTTP request
            const response = await this.makeRequest(
                url,
                pattern.method,
                pattern.headers,
                pattern.bodyTemplate,
                timeout
            );

            // Parse response based on format
            const data = this.parseResponse(response, pattern.responseFormat);

            // Extract products from response using data path
            const rawProducts = this.extractDataFromPath(data, pattern.dataPath);

            if (!Array.isArray(rawProducts)) {
                throw new Error('Data path did not resolve to an array');
            }

            // Apply field mappings to normalize products
            let products = rawProducts.map((rawProduct) =>
                this.applyFieldMappings(rawProduct, pattern.fieldMappings)
            );

            // Filter out invalid products (missing required fields)
            products = products.filter((p) => p.name && p.price > 0);

            // Limit number of products if specified
            if (maxProducts && products.length > maxProducts) {
                products = products.slice(0, maxProducts);
            }

            return products;
        } catch (error) {
            throw new Error(
                `Failed to extract products: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Handle paginated API responses
     * 
     * Automatically follows pagination patterns to extract products from
     * multiple pages. Supports offset, page, and cursor-based pagination.
     * Implements graceful error handling to continue extraction even if
     * individual pages fail.
     * 
     * @param pattern - API pattern with pagination
     * @param options - Extraction options
     * @returns All products across pages
     * @throws Error if extraction fails completely
     */
    async extractPaginatedProducts(
        pattern: APIPattern,
        options: ExtractionOptions = {}
    ): Promise<Product[]> {
        const {
            maxProducts,
            maxPages = 10,
            timeout = 60000,
        } = options;

        if (!pattern.paginationPattern) {
            throw new Error('Pattern does not have pagination information');
        }

        const allProducts: Product[] = [];
        let currentPage = 0;
        let hasMore = true;
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 3;

        const paginationPattern = pattern.paginationPattern;

        while (hasMore && currentPage < maxPages && consecutiveErrors < maxConsecutiveErrors) {
            try {
                // Build query parameters for current page
                const queryParams = { ...pattern.queryParams };

                // Add pagination parameter based on type
                switch (paginationPattern.type) {
                    case 'page':
                        queryParams[paginationPattern.paramName] = String(
                            Number(paginationPattern.startValue) + currentPage
                        );
                        break;

                    case 'offset':
                        queryParams[paginationPattern.paramName] = String(
                            Number(paginationPattern.startValue) +
                            currentPage * (paginationPattern.increment || 20)
                        );
                        break;

                    case 'cursor':
                        if (currentPage === 0) {
                            queryParams[paginationPattern.paramName] = String(
                                paginationPattern.startValue
                            );
                        }
                        // For cursor pagination, we'll update the cursor from response
                        break;
                }

                // Build request URL
                const url = this.buildRequestUrl(pattern.url, queryParams);

                // Make HTTP request
                const response = await this.makeRequest(
                    url,
                    pattern.method,
                    pattern.headers,
                    pattern.bodyTemplate,
                    timeout
                );

                // Parse response
                const data = this.parseResponse(response, pattern.responseFormat);

                // Extract products from response
                const rawProducts = this.extractDataFromPath(data, pattern.dataPath);

                if (!Array.isArray(rawProducts)) {
                    throw new Error('Data path did not resolve to an array');
                }

                // Apply field mappings
                const products = rawProducts
                    .map((rawProduct) =>
                        this.applyFieldMappings(rawProduct, pattern.fieldMappings)
                    )
                    .filter((p) => p.name && p.price > 0);

                // Add products to result
                allProducts.push(...products);

                // Reset consecutive errors on success
                consecutiveErrors = 0;

                // Check if we've reached max products
                if (maxProducts && allProducts.length >= maxProducts) {
                    hasMore = false;
                    break;
                }

                // Check if there are more pages
                if (products.length === 0) {
                    // No products on this page, assume no more pages
                    hasMore = false;
                } else if (paginationPattern.hasMorePath) {
                    // Check hasMore flag in response
                    try {
                        const hasMoreValue = this.extractDataFromPath(
                            data,
                            paginationPattern.hasMorePath
                        );
                        hasMore = this.parseBoolean(hasMoreValue);
                    } catch {
                        // If hasMore path not found, assume no more pages
                        hasMore = false;
                    }
                } else if (paginationPattern.totalPagesPath) {
                    // Check total pages in response
                    try {
                        const totalPages = this.extractDataFromPath(
                            data,
                            paginationPattern.totalPagesPath
                        );
                        hasMore = currentPage + 1 < Number(totalPages);
                    } catch {
                        // If total pages not found, continue to next page
                        hasMore = true;
                    }
                } else if (paginationPattern.type === 'cursor') {
                    // For cursor pagination, look for next cursor in response
                    try {
                        // Common cursor field names
                        const cursorFields = ['nextCursor', 'next_cursor', 'cursor', 'next'];
                        let nextCursor: string | null = null;

                        for (const field of cursorFields) {
                            try {
                                nextCursor = this.extractDataFromPath(data, `$.${field}`);
                                if (nextCursor) break;
                            } catch {
                                continue;
                            }
                        }

                        if (nextCursor) {
                            queryParams[paginationPattern.paramName] = nextCursor;
                            hasMore = true;
                        } else {
                            hasMore = false;
                        }
                    } catch {
                        hasMore = false;
                    }
                }

                currentPage++;
            } catch (error) {
                consecutiveErrors++;

                // Log error but continue if we have products and haven't hit max consecutive errors
                console.error(
                    `Error extracting page ${currentPage + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
                );

                // If we have no products yet and hit an error, throw
                if (allProducts.length === 0 && consecutiveErrors >= maxConsecutiveErrors) {
                    throw new Error(
                        `Failed to extract any products after ${consecutiveErrors} consecutive errors`
                    );
                }

                // Otherwise, stop pagination but return what we have
                hasMore = false;
            }
        }

        // If we stopped due to consecutive errors, log warning
        if (consecutiveErrors >= maxConsecutiveErrors) {
            console.warn(
                `Stopped pagination after ${maxConsecutiveErrors} consecutive errors. Returning ${allProducts.length} products.`
            );
        }

        // Limit total products if specified
        if (maxProducts && allProducts.length > maxProducts) {
            return allProducts.slice(0, maxProducts);
        }

        return allProducts;
    }

    /**
     * Build request URL with query parameters
     * 
     * @param baseUrl - Base URL
     * @param queryParams - Query parameters
     * @returns Complete URL with query string
     */
    private buildRequestUrl(baseUrl: string, queryParams: Record<string, string>): string {
        const url = new URL(baseUrl);

        // Add query parameters
        Object.entries(queryParams).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });

        return url.toString();
    }

    /**
     * Make HTTP request to API endpoint with retry logic
     * 
     * Implements exponential backoff for failed requests and handles
     * various HTTP errors (4xx, 5xx) with appropriate retry strategies.
     * Respects Retry-After headers from APIs.
     * 
     * @param url - Request URL
     * @param method - HTTP method
     * @param headers - Request headers
     * @param body - Request body (for POST requests)
     * @param timeout - Request timeout in milliseconds
     * @returns Response body as string
     * @throws Error if request fails after all retries
     */
    private async makeRequest(
        url: string,
        method: string,
        headers: Record<string, string>,
        body?: string,
        timeout: number = 60000
    ): Promise<string> {
        // Extract domain for rate limiting
        const domain = new URL(url).hostname;

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                // Apply rate limiting
                await this.rateLimiter.wait(domain);

                // Make the request
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                try {
                    const response = await fetch(url, {
                        method,
                        headers: {
                            ...headers,
                            'User-Agent': headers['User-Agent'] || 'PricePilot/1.0 (API Extractor)',
                        },
                        body: body && method !== 'GET' ? body : undefined,
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    // Handle HTTP errors
                    if (!response.ok) {
                        // Check for rate limiting (429)
                        if (response.status === 429) {
                            const retryAfter = response.headers.get('Retry-After');
                            if (retryAfter) {
                                // Retry-After can be in seconds or HTTP date
                                let retryAfterMs: number;

                                // Try parsing as seconds
                                const seconds = parseInt(retryAfter, 10);
                                if (!isNaN(seconds)) {
                                    retryAfterMs = seconds * 1000;
                                } else {
                                    // Try parsing as HTTP date
                                    const retryDate = new Date(retryAfter);
                                    if (!isNaN(retryDate.getTime())) {
                                        retryAfterMs = retryDate.getTime() - Date.now();
                                    } else {
                                        // Default to exponential backoff
                                        retryAfterMs = this.calculateBackoffDelay(attempt);
                                    }
                                }

                                // Cap at max delay
                                retryAfterMs = Math.min(retryAfterMs, this.retryConfig.maxDelay);

                                // Update rate limit for this endpoint
                                this.rateLimiter.setEndpointLimit(domain, retryAfterMs);

                                console.log(`Rate limited. Waiting ${retryAfterMs}ms before retry.`);
                                await this.sleep(retryAfterMs);
                                continue; // Retry after waiting
                            }
                        }

                        // 4xx errors (except 429) are not retryable
                        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText} (not retryable)`);
                        }

                        // 5xx errors are retryable
                        if (response.status >= 500) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }

                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    // Success - return response body
                    return await response.text();
                } catch (error) {
                    clearTimeout(timeoutId);

                    if (error instanceof Error && error.name === 'AbortError') {
                        throw new Error('Request timeout');
                    }

                    throw error;
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');

                // Check if error is retryable
                const isRetryable = this.isRetryableError(lastError);

                // If not retryable or last attempt, throw error
                if (!isRetryable || attempt === this.retryConfig.maxRetries) {
                    throw new Error(
                        `Request failed after ${attempt + 1} attempts: ${lastError.message}`
                    );
                }

                // Calculate exponential backoff delay
                const delay = this.calculateBackoffDelay(attempt);

                console.log(`Request failed (attempt ${attempt + 1}). Retrying in ${delay}ms...`);

                // Wait before retrying
                await this.sleep(delay);
            }
        }

        // Should never reach here, but just in case
        throw lastError || new Error('Request failed');
    }

    /**
     * Check if error is retryable
     * 
     * @param error - Error to check
     * @returns True if error is retryable
     */
    private isRetryableError(error: Error): boolean {
        const message = error.message.toLowerCase();

        // Network errors are retryable
        if (
            message.includes('timeout') ||
            message.includes('network') ||
            message.includes('econnreset') ||
            message.includes('econnrefused') ||
            message.includes('etimedout')
        ) {
            return true;
        }

        // 5xx errors are retryable
        if (message.includes('http 5')) {
            return true;
        }

        // Rate limit errors are retryable
        if (message.includes('429')) {
            return true;
        }

        // 4xx errors (except 429) are not retryable
        if (message.includes('not retryable')) {
            return false;
        }

        // Default to not retryable
        return false;
    }

    /**
     * Calculate exponential backoff delay
     * 
     * @param attempt - Current attempt number (0-indexed)
     * @returns Delay in milliseconds
     */
    private calculateBackoffDelay(attempt: number): number {
        const delay = this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
        return Math.min(delay, this.retryConfig.maxDelay);
    }

    /**
     * Sleep for specified duration
     * 
     * @param ms - Duration in milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Set rate limit for a specific endpoint
     * 
     * Allows configuring custom rate limits per endpoint to avoid
     * overwhelming APIs or getting blocked.
     * 
     * @param endpoint - Endpoint URL or domain
     * @param intervalMs - Minimum interval between requests in milliseconds
     */
    setEndpointRateLimit(endpoint: string, intervalMs: number): void {
        this.rateLimiter.setEndpointLimit(endpoint, intervalMs);
    }

    /**
     * Get current rate limit for an endpoint
     * 
     * @param endpoint - Endpoint URL or domain
     * @returns Rate limit interval in milliseconds
     */
    getEndpointRateLimit(endpoint: string): number {
        return this.rateLimiter.getEndpointLimit(endpoint);
    }

    /**
     * Clear rate limit for an endpoint
     * 
     * @param endpoint - Endpoint URL or domain
     */
    clearEndpointRateLimit(endpoint: string): void {
        this.rateLimiter.clearEndpointLimit(endpoint);
    }

    /**
     * Parse response based on format
     * 
     * @param responseBody - Response body as string
     * @param format - Response format (json or xml)
     * @returns Parsed data
     * @throws Error if parsing fails
     */
    private parseResponse(responseBody: string, format: 'json' | 'xml'): any {
        try {
            if (format === 'json') {
                return JSON.parse(responseBody);
            } else if (format === 'xml') {
                return this.xmlParser.parse(responseBody);
            } else {
                throw new Error(`Unsupported response format: ${format}`);
            }
        } catch (error) {
            throw new Error(
                `Failed to parse ${format} response: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Extract data from response using JSONPath or XPath
     * 
     * Supports simple JSONPath expressions like:
     * - $ (root)
     * - $.data
     * - $.data.products
     * 
     * @param data - Parsed response data
     * @param path - JSONPath or XPath expression
     * @returns Extracted data
     */
    private extractDataFromPath(data: any, path: string): any {
        // Handle root path
        if (path === '$') {
            return data;
        }

        // Remove leading $. if present
        const cleanPath = path.replace(/^\$\./, '');

        // Split path into segments
        const segments = cleanPath.split('.');

        // Traverse data using path segments
        let current = data;
        for (const segment of segments) {
            if (current === null || current === undefined) {
                throw new Error(`Path segment "${segment}" not found in data`);
            }

            if (typeof current !== 'object') {
                throw new Error(`Cannot traverse non-object at segment "${segment}"`);
            }

            current = current[segment];
        }

        return current;
    }

    /**
     * Apply field mappings to normalize raw product data
     * 
     * Maps API response fields to standard Product fields using
     * the field mappings discovered during detection.
     * 
     * @param rawProduct - Raw product data from API
     * @param fieldMappings - Field mappings
     * @returns Normalized Product object
     */
    private applyFieldMappings(
        rawProduct: any,
        fieldMappings: FieldMapping[]
    ): Product {
        const product: Product = {
            name: '',
            price: 0,
        };

        for (const mapping of fieldMappings) {
            const sourceValue = rawProduct[mapping.sourceField];

            if (sourceValue === undefined || sourceValue === null) {
                continue;
            }

            // Apply transformation if specified
            const transformedValue = mapping.transform
                ? this.applyTransform(sourceValue, mapping.transform)
                : sourceValue;

            // Map to target field
            switch (mapping.targetField) {
                case 'name':
                    product.name = String(transformedValue);
                    break;
                case 'price':
                    product.price = this.parsePrice(transformedValue);
                    break;
                case 'sku':
                    product.sku = String(transformedValue);
                    break;
                case 'brand':
                    product.brand = String(transformedValue);
                    break;
                case 'model':
                    product.model = String(transformedValue);
                    break;
                case 'currency':
                    product.currency = String(transformedValue);
                    break;
                case 'url':
                    product.url = String(transformedValue);
                    break;
                case 'imageUrl':
                    product.imageUrl = String(transformedValue);
                    break;
                case 'inStock':
                    product.inStock = this.parseBoolean(transformedValue);
                    break;
                default:
                    // Store unmapped fields in metadata
                    if (!product.metadata) {
                        product.metadata = {};
                    }
                    product.metadata[mapping.targetField] = transformedValue;
            }
        }

        return product;
    }

    /**
     * Apply transformation function to value
     * 
     * @param value - Source value
     * @param transform - Transformation function name
     * @returns Transformed value
     */
    private applyTransform(value: any, transform: string): any {
        switch (transform) {
            case 'toLowerCase':
                return String(value).toLowerCase();
            case 'toUpperCase':
                return String(value).toUpperCase();
            case 'trim':
                return String(value).trim();
            case 'parseFloat':
                return parseFloat(String(value));
            case 'parseInt':
                return parseInt(String(value), 10);
            default:
                return value;
        }
    }

    /**
     * Parse price value from various formats
     * 
     * Handles:
     * - Numbers: 99.99
     * - Strings: "99.99", "$99.99", "99,99"
     * 
     * @param value - Price value
     * @returns Parsed price as number
     */
    private parsePrice(value: any): number {
        if (typeof value === 'number') {
            return value;
        }

        if (typeof value === 'string') {
            // Remove currency symbols and whitespace
            const cleaned = value.replace(/[$€£¥,\s]/g, '');

            // Parse as float
            const parsed = parseFloat(cleaned);

            return isNaN(parsed) ? 0 : parsed;
        }

        return 0;
    }

    /**
     * Parse boolean value from various formats
     * 
     * @param value - Boolean value
     * @returns Parsed boolean
     */
    private parseBoolean(value: any): boolean {
        if (typeof value === 'boolean') {
            return value;
        }

        if (typeof value === 'string') {
            const lower = value.toLowerCase();
            return lower === 'true' || lower === 'yes' || lower === '1';
        }

        if (typeof value === 'number') {
            return value !== 0;
        }

        return false;
    }
}
