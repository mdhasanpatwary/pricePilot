/**
 * API Detector Component
 * 
 * Discovers and validates hidden API endpoints on competitor websites.
 * Uses headless browser automation to monitor network traffic and identify
 * product data APIs.
 */

import { chromium, type Browser, type Page } from 'playwright';
import type {
    APIPattern,
    APIEndpoint,
    DetectionOptions,
    ValidationResult,
} from '@/lib/types/api-detection';
import { NetworkInterceptor } from './network-interceptor';
import { APIPatternAnalyzer } from './api-pattern-analyzer';
import { RobotsTxtParser } from './robots-txt-parser';
import { randomUUID } from 'crypto';

/**
 * Default detection options
 */
const DEFAULT_OPTIONS: DetectionOptions = {
    timeout: 30000, // 30 seconds
    maxPages: 3,
    minConfidence: 70,
};

/**
 * APIDetector class
 * 
 * Orchestrates the API detection process:
 * 1. Launch headless browser
 * 2. Navigate to competitor pages
 * 3. Capture network traffic
 * 4. Analyze requests for API patterns
 * 5. Validate discovered APIs
 * 6. Rank APIs by quality
 */
export class APIDetector {
    private browser: Browser | null = null;
    private networkInterceptor: NetworkInterceptor;
    private patternAnalyzer: APIPatternAnalyzer;
    private robotsParser: RobotsTxtParser;

    constructor() {
        this.networkInterceptor = new NetworkInterceptor();
        this.patternAnalyzer = new APIPatternAnalyzer();
        this.robotsParser = new RobotsTxtParser();
    }

    /**
     * Detect hidden APIs on a competitor website
     * 
     * Launches a headless browser, navigates to product pages, captures
     * network traffic, and analyzes it to discover API endpoints.
     * 
     * @param url - Competitor website URL (product listing page)
     * @param options - Detection configuration
     * @returns Array of discovered and validated API patterns
     */
    async detectAPIs(
        url: string,
        options: Partial<DetectionOptions> = {}
    ): Promise<Partial<APIPattern>[]> {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const startTime = Date.now();

        try {
            // Launch headless browser
            this.browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                ],
            });

            const context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1920, height: 1080 },
            });

            const page = await context.newPage();

            // Set timeout for detection
            const timeoutPromise = new Promise<Partial<APIPattern>[]>((resolve) => {
                setTimeout(() => {
                    console.log('Detection timeout reached');
                    resolve([]);
                }, opts.timeout);
            });

            // Run detection with timeout
            const detectionPromise = this.runDetection(page, url, opts);

            const patterns = await Promise.race([detectionPromise, timeoutPromise]);

            return patterns;
        } catch (error) {
            console.error('Error during API detection:', error);
            throw error;
        } finally {
            // Cleanup browser
            await this.cleanup();

            const duration = Date.now() - startTime;
            console.log(`Detection completed in ${duration}ms`);
        }
    }

    /**
     * Run the detection process
     * 
     * @param page - Playwright page instance
     * @param url - URL to analyze
     * @param options - Detection options
     * @returns Discovered API patterns
     */
    private async runDetection(
        page: Page,
        url: string,
        options: DetectionOptions
    ): Promise<Partial<APIPattern>[]> {
        try {
            // Check robots.txt compliance before proceeding
            const baseUrl = new URL(url).origin;
            const path = new URL(url).pathname;
            const isAllowed = await this.robotsParser.isPathAllowed(baseUrl, path);

            if (!isAllowed) {
                console.log(`Path ${path} is disallowed by robots.txt for ${baseUrl}`);
                return [];
            }

            // Start network interception
            await this.startNetworkInterception(page);

            // Navigate to the URL
            console.log(`Navigating to ${url}`);
            await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 15000,
            });

            // Wait for additional network requests to complete
            await page.waitForTimeout(3000);

            // Optionally navigate to additional pages
            if (options.maxPages > 1) {
                await this.navigateAdditionalPages(page, options.maxPages - 1);
            }

            // Stop interception and get captured requests
            await this.networkInterceptor.stopInterception();
            const capturedRequests = this.networkInterceptor.getCapturedRequests();

            console.log(`Captured ${capturedRequests.length} network requests`);

            // Analyze requests to find API patterns
            const patterns = this.patternAnalyzer.analyzeRequests(capturedRequests);

            console.log(`Discovered ${patterns.length} potential API patterns`);

            // Validate discovered APIs
            const validatedPatterns: Partial<APIPattern>[] = [];
            for (const pattern of patterns) {
                if (validatedPatterns.length >= 5) {
                    // Limit to top 5 patterns
                    break;
                }

                // Check robots.txt compliance for API endpoint
                const apiUrl = new URL(pattern.url!);
                const apiPath = apiUrl.pathname;
                const apiAllowed = await this.robotsParser.isPathAllowed(baseUrl, apiPath);

                if (!apiAllowed) {
                    console.log(`API endpoint ${apiPath} is disallowed by robots.txt`);
                    continue;
                }

                const endpoint: APIEndpoint = {
                    url: pattern.url!,
                    method: pattern.method!,
                    headers: pattern.headers!,
                    queryParams: pattern.queryParams!,
                    requestBody: pattern.bodyTemplate,
                    responseFormat: pattern.responseFormat!,
                    sampleResponse: null,
                };

                const validationResult = await this.validateAPI(endpoint);

                if (validationResult.isValid) {
                    // Update confidence score based on validation
                    pattern.confidenceScore = validationResult.confidenceScore;
                    validatedPatterns.push(pattern);
                }
            }

            console.log(`Validated ${validatedPatterns.length} API patterns`);

            // Rank APIs by quality
            const rankedPatterns = this.rankAPIs(validatedPatterns);

            // Filter by minimum confidence
            return rankedPatterns.filter(
                (p) => (p.confidenceScore || 0) >= options.minConfidence
            );
        } catch (error) {
            console.error('Error in detection process:', error);
            return [];
        }
    }

    /**
     * Start network interception on the page
     * 
     * @param page - Playwright page instance
     */
    private async startNetworkInterception(page: Page): Promise<void> {
        // Convert Playwright page to Puppeteer-like interface
        // Note: NetworkInterceptor expects Puppeteer Page, but we'll adapt it
        // For now, we'll use Playwright's route interception

        // Intercept all requests
        await page.route('**/*', async (route) => {
            // Continue the request
            await route.continue();
        });

        // Listen for responses
        page.on('response', async (response) => {
            try {
                const request = response.request();
                const url = request.url();
                const resourceType = request.resourceType();

                // Filter by resource type (xhr, fetch)
                if (resourceType !== 'xhr' && resourceType !== 'fetch') {
                    return;
                }

                // Filter by URL patterns
                const productKeywords = ['/api/', '/product', '/item', '/catalog', '/search', '/list'];
                const hasProductKeyword = productKeywords.some((keyword) =>
                    url.toLowerCase().includes(keyword)
                );

                if (!hasProductKeyword) {
                    return;
                }

                // Exclude analytics and tracking
                const excludePatterns = [
                    'google-analytics',
                    'facebook.com',
                    'doubleclick',
                    'analytics',
                    'tracking',
                    'pixel',
                    'beacon',
                ];
                const isExcluded = excludePatterns.some((pattern) =>
                    url.toLowerCase().includes(pattern)
                );

                if (isExcluded) {
                    return;
                }

                // Capture the request
                let responseBody = '';
                try {
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
                }

                const capturedRequest = {
                    id: randomUUID(),
                    url: request.url(),
                    method: request.method(),
                    headers: request.headers(),
                    requestBody: request.postData(),
                    responseStatus: response.status(),
                    responseHeaders: response.headers(),
                    responseBody,
                    responseType: response.headers()['content-type'] || 'unknown',
                    timestamp: Date.now(),
                    duration: 0,
                };

                // Store in network interceptor
                (this.networkInterceptor as any).capturedRequests.push(capturedRequest);
            } catch (error) {
                // Silently ignore errors
            }
        });
    }

    /**
     * Navigate to additional pages to capture more network traffic
     * 
     * @param page - Playwright page instance
     * @param count - Number of additional pages to navigate
     */
    private async navigateAdditionalPages(page: Page, count: number): Promise<void> {
        try {
            // Look for pagination links
            const paginationSelectors = [
                'a[rel="next"]',
                '.pagination a:not(.active):not(.disabled)',
                '[aria-label*="next" i]',
                'a:has-text("Next")',
                'a:has-text(">")',
            ];

            for (let i = 0; i < count; i++) {
                let navigated = false;

                for (const selector of paginationSelectors) {
                    try {
                        const nextLink = await page.$(selector);
                        if (nextLink) {
                            await nextLink.click();
                            await page.waitForLoadState('networkidle', { timeout: 10000 });
                            await page.waitForTimeout(2000);
                            navigated = true;
                            break;
                        }
                    } catch (error) {
                        // Try next selector
                        continue;
                    }
                }

                if (!navigated) {
                    // No more pages to navigate
                    break;
                }
            }
        } catch (error) {
            console.error('Error navigating additional pages:', error);
        }
    }

    /**
     * Validate a discovered API endpoint
     * 
     * Makes test requests to verify the API returns valid product data
     * and assigns a confidence score.
     * 
     * @param endpoint - API endpoint to validate
     * @returns Validation result with confidence score
     */
    async validateAPI(endpoint: APIEndpoint): Promise<ValidationResult> {
        const errors: string[] = [];
        let confidenceScore = 0;
        let sampleData: any = null;

        try {
            // Make test request to the API
            const response = await fetch(endpoint.url, {
                method: endpoint.method,
                headers: endpoint.headers,
                body: endpoint.requestBody,
            });

            // Check response status
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    errors.push('Authentication required');
                    return {
                        isValid: false,
                        confidenceScore: 0,
                        errors,
                    };
                }

                errors.push(`HTTP ${response.status}: ${response.statusText}`);
                return {
                    isValid: false,
                    confidenceScore: 0,
                    errors,
                };
            }

            // Parse response
            const contentType = response.headers.get('content-type') || '';
            let data: any;

            if (contentType.includes('json')) {
                data = await response.json();
            } else if (contentType.includes('xml')) {
                const text = await response.text();
                // For XML, we'll just store the text for now
                data = { xml: text };
            } else {
                errors.push('Unsupported response format');
                return {
                    isValid: false,
                    confidenceScore: 0,
                    errors,
                };
            }

            sampleData = data;

            // Validate required fields (name and price)
            const hasRequiredFields = this.validateRequiredFields(data);
            if (!hasRequiredFields) {
                errors.push('Missing required fields (name or price)');
                return {
                    isValid: false,
                    confidenceScore: 0,
                    errors,
                    sampleData,
                };
            }

            // Calculate confidence score
            confidenceScore = this.calculateValidationScore(data, endpoint);

            // Make a second request to check consistency
            const secondResponse = await fetch(endpoint.url, {
                method: endpoint.method,
                headers: endpoint.headers,
                body: endpoint.requestBody,
            });

            if (secondResponse.ok) {
                const secondData = await secondResponse.json();
                const isConsistent = this.checkResponseConsistency(data, secondData);

                if (!isConsistent) {
                    confidenceScore -= 20; // Penalize inconsistent responses
                    errors.push('Response structure is inconsistent');
                }
            }

            return {
                isValid: true,
                confidenceScore: Math.max(0, Math.min(100, confidenceScore)),
                errors,
                sampleData,
            };
        } catch (error) {
            errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return {
                isValid: false,
                confidenceScore: 0,
                errors,
                sampleData,
            };
        }
    }

    /**
     * Validate that response contains required fields (name and price)
     * 
     * @param data - API response data
     * @returns True if required fields are present
     */
    private validateRequiredFields(data: any): boolean {
        const nameFields = ['name', 'title', 'product_name', 'productname'];
        const priceFields = ['price', 'cost', 'amount', 'value'];

        let hasName = false;
        let hasPrice = false;

        // Find arrays in response
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

        // Check if any array contains products with required fields
        for (const arr of arrays) {
            if (arr.length === 0) continue;

            const firstItem = arr[0];
            if (typeof firstItem !== 'object' || firstItem === null) continue;

            const fields = Object.keys(firstItem).map((k) => k.toLowerCase());

            hasName = nameFields.some((nf) => fields.some((f) => f.includes(nf)));
            hasPrice = priceFields.some((pf) => fields.some((f) => f.includes(pf)));

            if (hasName && hasPrice) {
                return true;
            }
        }

        return false;
    }

    /**
     * Calculate validation confidence score
     * 
     * @param data - API response data
     * @param endpoint - API endpoint
     * @returns Confidence score (0-100)
     */
    private calculateValidationScore(data: any, endpoint: APIEndpoint): number {
        let score = 50; // Base score for valid response

        // Check data completeness (max 30 points)
        const fieldCount = this.countProductFields(data);
        score += Math.min(fieldCount * 3, 30);

        // Check response size (max 10 points)
        const dataSize = JSON.stringify(data).length;
        if (dataSize > 10000) score += 10;
        else if (dataSize > 5000) score += 5;

        // Check URL structure (max 10 points)
        if (endpoint.url.includes('/api/')) score += 5;
        if (endpoint.url.includes('/product') || endpoint.url.includes('/item')) score += 5;

        return Math.min(score, 100);
    }

    /**
     * Count number of product-related fields in response
     * 
     * @param data - API response data
     * @returns Number of product fields found
     */
    private countProductFields(data: any): number {
        const productFields = [
            'name',
            'title',
            'price',
            'cost',
            'sku',
            'brand',
            'model',
            'image',
            'url',
            'stock',
        ];

        let count = 0;

        // Find arrays in response
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

        for (const arr of arrays) {
            if (arr.length === 0) continue;

            const firstItem = arr[0];
            if (typeof firstItem !== 'object' || firstItem === null) continue;

            const fields = Object.keys(firstItem).map((k) => k.toLowerCase());

            productFields.forEach((pf) => {
                if (fields.some((f) => f.includes(pf))) {
                    count++;
                }
            });

            break; // Only check first array
        }

        return count;
    }

    /**
     * Check response structure consistency between two requests
     * 
     * @param data1 - First response data
     * @param data2 - Second response data
     * @returns True if structures are consistent
     */
    private checkResponseConsistency(data1: any, data2: any): boolean {
        try {
            // Get structure signatures
            const sig1 = this.getStructureSignature(data1);
            const sig2 = this.getStructureSignature(data2);

            return sig1 === sig2;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get structure signature of data (field names and types)
     * 
     * @param data - Data to analyze
     * @returns Structure signature string
     */
    private getStructureSignature(data: any): string {
        if (Array.isArray(data)) {
            if (data.length === 0) return '[]';
            return `[${this.getStructureSignature(data[0])}]`;
        }

        if (typeof data === 'object' && data !== null) {
            const keys = Object.keys(data).sort();
            const signature = keys
                .map((key) => `${key}:${typeof data[key]}`)
                .join(',');
            return `{${signature}}`;
        }

        return typeof data;
    }

    /**
     * Rank APIs by quality and completeness
     * 
     * Sorts APIs by confidence score (highest first) and applies
     * additional ranking criteria.
     * 
     * @param apis - List of validated API patterns
     * @returns Ranked list with best API first
     */
    rankAPIs(apis: Partial<APIPattern>[]): Partial<APIPattern>[] {
        return apis.sort((a, b) => {
            // Primary sort: confidence score
            const scoreA = a.confidenceScore || 0;
            const scoreB = b.confidenceScore || 0;

            if (scoreA !== scoreB) {
                return scoreB - scoreA;
            }

            // Secondary sort: field mapping count
            const fieldsA = a.fieldMappings?.length || 0;
            const fieldsB = b.fieldMappings?.length || 0;

            if (fieldsA !== fieldsB) {
                return fieldsB - fieldsA;
            }

            // Tertiary sort: URL structure (prefer /api/ URLs)
            const hasApiA = a.url?.includes('/api/') ? 1 : 0;
            const hasApiB = b.url?.includes('/api/') ? 1 : 0;

            return hasApiB - hasApiA;
        });
    }

    /**
     * Cleanup browser resources
     */
    private async cleanup(): Promise<void> {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
        } catch (error) {
            console.error('Error cleaning up browser:', error);
        }
    }
}
