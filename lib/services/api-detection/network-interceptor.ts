/**
 * Network Interceptor Component
 * 
 * Monitors and captures network traffic from competitor websites using Playwright's
 * network interception. Filters requests to capture only XHR and Fetch calls that
 * may contain product data.
 */

import type { Page } from 'playwright';
import type { CapturedRequest, RequestFilter } from '@/lib/types/api-detection';
import { randomUUID } from 'crypto';

/**
 * Default request filter configuration
 */
const DEFAULT_FILTER: RequestFilter = {
    resourceTypes: ['xhr', 'fetch'],
    urlPatterns: [
        /\/api\//i,
        /\/product/i,
        /\/item/i,
        /\/catalog/i,
        /\/search/i,
        /\/list/i,
    ],
    excludePatterns: [
        /google-analytics/i,
        /facebook\.com/i,
        /doubleclick/i,
        /analytics/i,
        /tracking/i,
        /pixel/i,
        /beacon/i,
        /gtm\.js/i,
        /ga\.js/i,
    ],
};

/**
 * Maximum number of requests to buffer in memory
 */
const MAX_BUFFER_SIZE = 100;

/**
 * NetworkInterceptor class
 * 
 * Captures and filters network requests made by a web page to identify
 * potential product data API endpoints.
 */
export class NetworkInterceptor {
    private capturedRequests: CapturedRequest[] = [];
    private filter: RequestFilter;
    private isIntercepting: boolean = false;
    private page: Page | null = null;

    /**
     * Create a new NetworkInterceptor
     * @param filter - Optional custom request filter
     */
    constructor(filter?: Partial<RequestFilter>) {
        this.filter = {
            ...DEFAULT_FILTER,
            ...filter,
        };
    }

    /**
     * Start intercepting network requests on a Playwright page
     * 
     * Hooks into the browser's network layer to monitor XHR and Fetch calls.
     * Implements memory-efficient buffering.
     * 
     * @param page - Playwright page instance
     * @param filter - Optional filter to override constructor filter
     */
    async startInterception(page: Page, filter?: RequestFilter): Promise<void> {
        if (this.isIntercepting) {
            throw new Error('Interception already started');
        }

        this.page = page;
        this.isIntercepting = true;
        this.capturedRequests = [];

        // Use provided filter or fall back to instance filter
        const activeFilter = filter || this.filter;

        // Listen for responses
        page.on('response', async (response) => {
            try {
                const request = response.request();
                const url = request.url();
                const resourceType = request.resourceType();

                // Filter by resource type
                if (!activeFilter.resourceTypes.includes(resourceType)) {
                    return;
                }

                // Filter by URL patterns (include)
                const matchesIncludePattern = activeFilter.urlPatterns.some((pattern) =>
                    pattern.test(url)
                );
                if (!matchesIncludePattern) {
                    return;
                }

                // Filter by URL patterns (exclude)
                const matchesExcludePattern = activeFilter.excludePatterns.some((pattern) =>
                    pattern.test(url)
                );
                if (matchesExcludePattern) {
                    return;
                }

                // Capture the request and response
                const capturedRequest = await this.captureRequest(request, response);

                // Add to buffer with size limit
                this.capturedRequests.push(capturedRequest);

                // Implement memory-efficient buffering
                if (this.capturedRequests.length > MAX_BUFFER_SIZE) {
                    // Remove oldest requests (FIFO)
                    this.capturedRequests.shift();
                }
            } catch (error) {
                // Silently ignore errors to not break page loading
                console.error('Error capturing request:', error);
            }
        });
    }

    /**
     * Capture request and response details
     * 
     * @param request - Playwright request object
     * @param response - Playwright response object
     * @returns Captured request with full metadata
     */
    private async captureRequest(
        request: any,
        response: any
    ): Promise<CapturedRequest> {
        const startTime = Date.now();

        let responseBody = '';
        try {
            // Only capture text responses (JSON, XML, HTML)
            const contentType = response.headers()['content-type'] || '';
            if (
                contentType.includes('json') ||
                contentType.includes('xml') ||
                contentType.includes('text')
            ) {
                responseBody = await response.text();
            }
        } catch (error) {
            // Response body may not be available
            responseBody = '';
        }

        const duration = Date.now() - startTime;

        return {
            id: randomUUID(),
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            requestBody: request.postData() || undefined,
            responseStatus: response.status(),
            responseHeaders: response.headers(),
            responseBody,
            responseType: response.headers()['content-type'] || 'unknown',
            timestamp: Date.now(),
            duration,
        };
    }

    /**
     * Get all captured requests
     * 
     * @returns Array of captured network requests
     */
    getCapturedRequests(): CapturedRequest[] {
        return [...this.capturedRequests];
    }

    /**
     * Get captured requests filtered by criteria
     * 
     * @param predicate - Filter function
     * @returns Filtered array of captured requests
     */
    getFilteredRequests(
        predicate: (request: CapturedRequest) => boolean
    ): CapturedRequest[] {
        return this.capturedRequests.filter(predicate);
    }

    /**
     * Get captured requests that likely contain product data
     * 
     * Uses heuristics to identify product-related API calls:
     * - Response contains JSON arrays
     * - Response size suggests multiple products (>5KB)
     * - URL contains product-related keywords
     * 
     * @returns Array of likely product API requests
     */
    getProductRequests(): CapturedRequest[] {
        return this.capturedRequests.filter((request) => {
            // Check if response is JSON
            if (!request.responseType.includes('json')) {
                return false;
            }

            // Check response size (>5KB suggests multiple products)
            if (request.responseBody.length < 5000) {
                return false;
            }

            // Try to parse JSON and check for arrays
            try {
                const data = JSON.parse(request.responseBody);

                // Check if response contains arrays (likely product lists)
                const hasArrays = this.containsArrays(data);
                if (!hasArrays) {
                    return false;
                }

                // Check if arrays contain product-like objects
                const hasProductData = this.containsProductData(data);
                return hasProductData;
            } catch (error) {
                return false;
            }
        });
    }

    /**
     * Check if data structure contains arrays
     */
    private containsArrays(data: any): boolean {
        if (Array.isArray(data)) {
            return data.length > 0;
        }

        if (typeof data === 'object' && data !== null) {
            return Object.values(data).some((value) => Array.isArray(value) && value.length > 0);
        }

        return false;
    }

    /**
     * Check if data contains product-like objects
     * 
     * Looks for common product fields: name, price, sku, title, etc.
     */
    private containsProductData(data: any): boolean {
        const productFields = ['name', 'price', 'sku', 'title', 'product', 'item'];

        // Find arrays in the data
        const arrays: any[] = [];
        if (Array.isArray(data)) {
            arrays.push(data);
        } else if (typeof data === 'object' && data !== null) {
            Object.values(data).forEach((value) => {
                if (Array.isArray(value)) {
                    arrays.push(value);
                }
            });
        }

        // Check if any array contains product-like objects
        return arrays.some((arr) => {
            if (arr.length === 0) return false;

            const firstItem = arr[0];
            if (typeof firstItem !== 'object' || firstItem === null) {
                return false;
            }

            // Check if object has product-related fields
            const fields = Object.keys(firstItem).map((k) => k.toLowerCase());
            return productFields.some((pf) => fields.some((f) => f.includes(pf)));
        });
    }

    /**
     * Clear captured requests buffer
     */
    clearRequests(): void {
        this.capturedRequests = [];
    }

    /**
     * Stop interception and cleanup
     */
    async stopInterception(): Promise<void> {
        if (!this.isIntercepting || !this.page) {
            return;
        }

        try {
            // Remove all listeners
            this.page.removeAllListeners('response');
        } catch (error) {
            console.error('Error stopping interception:', error);
        }

        this.isIntercepting = false;
        this.page = null;
    }

    /**
     * Check if interception is active
     */
    isActive(): boolean {
        return this.isIntercepting;
    }

    /**
     * Get current buffer size
     */
    getBufferSize(): number {
        return this.capturedRequests.length;
    }
}
