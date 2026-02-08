# Design Document: Hidden API Detection Strategy

## Overview

The Hidden API Detection Strategy enhances PricePilot's scraping capabilities by intelligently detecting and utilizing hidden API endpoints on competitor websites before falling back to traditional HTML parsing. This feature operates as a two-phase system: a detection phase that discovers and validates API endpoints, and an extraction phase that retrieves product data using the most efficient method available.

The system uses a headless browser with network interception to monitor XHR and Fetch calls made by competitor websites. When product-related API endpoints are discovered, they are validated, ranked by quality, and cached for future use. This approach significantly improves scraping speed, reliability, and data quality while maintaining backward compatibility with existing HTML parsing strategies.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Scraper Orchestrator                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Cache Lookup   │
                    └─────────────────┘
                         │         │
                    API Found   No Cache
                         │         │
                         │         ▼
                         │  ┌──────────────────┐
                         │  │ Detection Phase  │
                         │  │                  │
                         │  │ • Browser Launch │
                         │  │ • Network Monitor│
                         │  │ • API Discovery  │
                         │  │ • Validation     │
                         │  └──────────────────┘
                         │         │
                         │    API Found / Not Found
                         │         │
                         ▼         ▼
                    ┌──────────────────┐
                    │ Extraction Phase │
                    │                  │
                    │ • API Extraction │
                    │ • HTML Fallback  │
                    └──────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Normalized Data │
                    └─────────────────┘
```

### Component Interaction Flow

1. **Scraper Orchestrator** receives a competitor website URL
2. **Cache Lookup** checks if API patterns exist for this website
3. If cached patterns exist → proceed to **Extraction Phase**
4. If no cache → enter **Detection Phase**:
   - Launch headless browser with network interception
   - Navigate to product listing pages
   - Monitor and capture network requests
   - Analyze captured requests for product data APIs
   - Validate discovered APIs
   - Cache successful patterns
5. **Extraction Phase** uses discovered API or falls back to HTML parsing
6. Output normalized product data

## Components and Interfaces

### 1. API Detector Component

**Responsibility:** Discover and validate hidden API endpoints on competitor websites.

**Interface:**
```typescript
interface APIDetector {
  /**
   * Detect hidden APIs on a competitor website
   * @param url - Competitor website URL
   * @param options - Detection configuration
   * @returns Discovered and validated API patterns
   */
  detectAPIs(url: string, options: DetectionOptions): Promise<APIPattern[]>;
  
  /**
   * Validate a discovered API endpoint
   * @param endpoint - API endpoint to validate
   * @returns Validation result with confidence score
   */
  validateAPI(endpoint: APIEndpoint): Promise<ValidationResult>;
  
  /**
   * Rank discovered APIs by quality
   * @param apis - List of discovered APIs
   * @returns Ranked list with best API first
   */
  rankAPIs(apis: APIPattern[]): APIPattern[];
}

interface DetectionOptions {
  timeout: number;           // Maximum detection time in milliseconds
  maxPages: number;          // Number of pages to analyze
  minConfidence: number;     // Minimum confidence score (0-100)
}

interface APIPattern {
  id: string;
  url: string;
  method: string;            // GET, POST, etc.
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  bodyTemplate?: string;     // For POST requests
  responseFormat: 'json' | 'xml';
  dataPath: string;          // JSONPath or XPath to product data
  fieldMappings: FieldMapping[];
  confidenceScore: number;   // 0-100
  paginationPattern?: PaginationPattern;
}

interface FieldMapping {
  sourceField: string;       // Field name in API response
  targetField: string;       // Standard field (sku, name, price, etc.)
  transform?: string;        // Optional transformation function
}

interface ValidationResult {
  isValid: boolean;
  confidenceScore: number;
  errors: string[];
  sampleData?: any;
}
```

**Implementation Details:**
- Uses Puppeteer or Playwright for browser automation
- Implements network request interception via CDP (Chrome DevTools Protocol)
- Filters requests by content-type (application/json, application/xml)
- Analyzes response structure to identify product data patterns
- Validates APIs by making test requests and verifying data structure

### 2. Network Interceptor Component

**Responsibility:** Monitor and capture network traffic from competitor websites.

**Interface:**
```typescript
interface NetworkInterceptor {
  /**
   * Start intercepting network requests
   * @param page - Browser page instance
   * @param filter - Request filter criteria
   */
  startInterception(page: Page, filter: RequestFilter): void;
  
  /**
   * Get captured requests
   * @returns List of captured network requests
   */
  getCapturedRequests(): CapturedRequest[];
  
  /**
   * Stop interception and cleanup
   */
  stopInterception(): void;
}

interface RequestFilter {
  resourceTypes: string[];   // xhr, fetch, document, etc.
  urlPatterns: RegExp[];     // URL patterns to capture
  excludePatterns: RegExp[]; // URLs to ignore (analytics, ads, etc.)
}

interface CapturedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  requestBody?: string;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  responseType: string;
  timestamp: number;
  duration: number;
}
```

**Implementation Details:**
- Hooks into browser's network layer using CDP
- Filters out non-product-related requests (analytics, ads, tracking)
- Captures both request and response data
- Implements memory-efficient buffering to prevent crashes
- Provides real-time request streaming for analysis

### 3. API Pattern Analyzer Component

**Responsibility:** Analyze captured network requests to identify product data APIs.

**Interface:**
```typescript
interface APIPatternAnalyzer {
  /**
   * Analyze captured requests to find product APIs
   * @param requests - Captured network requests
   * @returns Potential API patterns
   */
  analyzeRequests(requests: CapturedRequest[]): APIPattern[];
  
  /**
   * Extract field mappings from API response
   * @param response - API response data
   * @returns Field mappings to standard product fields
   */
  extractFieldMappings(response: any): FieldMapping[];
  
  /**
   * Detect pagination patterns in API
   * @param requests - Series of related requests
   * @returns Pagination pattern if detected
   */
  detectPagination(requests: CapturedRequest[]): PaginationPattern | null;
}

interface PaginationPattern {
  type: 'offset' | 'page' | 'cursor';
  paramName: string;         // e.g., 'page', 'offset', 'cursor'
  startValue: number | string;
  increment?: number;        // For offset/page pagination
  totalPagesPath?: string;   // JSONPath to total pages in response
  hasMorePath?: string;      // JSONPath to hasMore boolean
}
```

**Implementation Details:**
- Uses heuristics to identify product-related endpoints:
  - URL contains keywords: product, item, catalog, search, list
  - Response contains arrays of objects with price/name fields
  - Response size suggests multiple products (>5KB)
- Implements JSONPath and XPath parsing for data extraction
- Detects common pagination patterns automatically
- Scores APIs based on data completeness and structure quality

### 4. API Extractor Component

**Responsibility:** Extract product data using discovered API patterns.

**Interface:**
```typescript
interface APIExtractor {
  /**
   * Extract products using API pattern
   * @param pattern - Validated API pattern
   * @param options - Extraction options
   * @returns Extracted product data
   */
  extractProducts(pattern: APIPattern, options: ExtractionOptions): Promise<Product[]>;
  
  /**
   * Handle paginated API responses
   * @param pattern - API pattern with pagination
   * @returns All products across pages
   */
  extractPaginatedProducts(pattern: APIPattern): Promise<Product[]>;
}

interface ExtractionOptions {
  maxProducts?: number;      // Limit number of products
  maxPages?: number;         // Limit pagination depth
  timeout?: number;          // Request timeout
}

interface Product {
  externalId?: string;
  sku?: string;
  name: string;
  brand?: string;
  model?: string;
  price: number;
  currency?: string;
  url?: string;
  imageUrl?: string;
  inStock?: boolean;
  metadata?: Record<string, any>;
}
```

**Implementation Details:**
- Makes HTTP requests using discovered API patterns
- Applies field mappings to normalize data
- Handles pagination automatically
- Implements retry logic with exponential backoff
- Respects rate limits to avoid blocking

### 5. API Cache Component

**Responsibility:** Store and retrieve discovered API patterns for reuse.

**Interface:**
```typescript
interface APICache {
  /**
   * Store API pattern for a competitor website
   * @param websiteId - Competitor website ID
   * @param pattern - Validated API pattern
   */
  storePattern(websiteId: string, pattern: APIPattern): Promise<void>;
  
  /**
   * Retrieve cached API pattern
   * @param websiteId - Competitor website ID
   * @returns Cached pattern or null
   */
  getPattern(websiteId: string): Promise<APIPattern | null>;
  
  /**
   * Invalidate cached pattern
   * @param websiteId - Competitor website ID
   */
  invalidatePattern(websiteId: string): Promise<void>;
  
  /**
   * Update pattern success metrics
   * @param websiteId - Competitor website ID
   * @param success - Whether extraction succeeded
   */
  updateMetrics(websiteId: string, success: boolean): Promise<void>;
}
```

**Database Schema:**
```sql
CREATE TABLE api_patterns (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  competitor_website_id UUID NOT NULL,
  pattern JSONB NOT NULL,
  confidence_score INTEGER NOT NULL,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (competitor_website_id) REFERENCES competitor_websites(id)
);

CREATE INDEX idx_api_patterns_website ON api_patterns(competitor_website_id);
CREATE INDEX idx_api_patterns_tenant ON api_patterns(tenant_id);
```

### 6. Scraper Orchestrator (Enhanced)

**Responsibility:** Coordinate API detection and extraction with fallback to HTML parsing.

**Interface:**
```typescript
interface ScraperOrchestrator {
  /**
   * Scrape competitor website with API detection
   * @param websiteId - Competitor website ID
   * @param options - Scraping options
   * @returns Extracted products
   */
  scrapeWebsite(websiteId: string, options: ScrapeOptions): Promise<ScrapeResult>;
}

interface ScrapeOptions {
  forceDetection?: boolean;  // Skip cache and re-detect
  useAPIOnly?: boolean;      // Fail if API not available
  maxProducts?: number;
}

interface ScrapeResult {
  products: Product[];
  method: 'api' | 'html';
  apiPattern?: APIPattern;
  detectionTime?: number;
  extractionTime: number;
  errors: string[];
}
```

**Orchestration Logic:**
```typescript
async function scrapeWebsite(websiteId: string, options: ScrapeOptions): Promise<ScrapeResult> {
  const startTime = Date.now();
  
  // Step 1: Check cache unless forced detection
  let apiPattern: APIPattern | null = null;
  if (!options.forceDetection) {
    apiPattern = await apiCache.getPattern(websiteId);
  }
  
  // Step 2: Run detection if no cached pattern
  let detectionTime = 0;
  if (!apiPattern) {
    const detectionStart = Date.now();
    const website = await getCompetitorWebsite(websiteId);
    const patterns = await apiDetector.detectAPIs(website.baseUrl, {
      timeout: 30000,
      maxPages: 3,
      minConfidence: 70
    });
    
    if (patterns.length > 0) {
      apiPattern = patterns[0]; // Use highest ranked
      await apiCache.storePattern(websiteId, apiPattern);
    }
    detectionTime = Date.now() - detectionStart;
  }
  
  // Step 3: Extract using API or fallback
  let products: Product[] = [];
  let method: 'api' | 'html' = 'html';
  const errors: string[] = [];
  
  if (apiPattern) {
    try {
      products = await apiExtractor.extractProducts(apiPattern, {
        maxProducts: options.maxProducts,
        timeout: 60000
      });
      method = 'api';
      await apiCache.updateMetrics(websiteId, true);
    } catch (error) {
      errors.push(`API extraction failed: ${error.message}`);
      await apiCache.updateMetrics(websiteId, false);
      
      // Invalidate if failure rate is high
      const pattern = await apiCache.getPattern(websiteId);
      if (pattern && pattern.failure_count > 3) {
        await apiCache.invalidatePattern(websiteId);
      }
      
      // Fallback to HTML if not API-only mode
      if (!options.useAPIOnly) {
        products = await htmlScraper.scrape(websiteId);
        method = 'html';
      }
    }
  } else {
    // No API found, use HTML scraping
    if (options.useAPIOnly) {
      throw new Error('API-only mode enabled but no API detected');
    }
    products = await htmlScraper.scrape(websiteId);
    method = 'html';
  }
  
  const extractionTime = Date.now() - startTime - detectionTime;
  
  return {
    products,
    method,
    apiPattern: apiPattern || undefined,
    detectionTime: detectionTime > 0 ? detectionTime : undefined,
    extractionTime,
    errors
  };
}
```

## Data Models

### APIPattern Model
```typescript
interface APIPattern {
  id: string;
  tenantId: string;
  competitorWebsiteId: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  bodyTemplate?: string;
  responseFormat: 'json' | 'xml';
  dataPath: string;
  fieldMappings: FieldMapping[];
  confidenceScore: number;
  paginationPattern?: PaginationPattern;
  successCount: number;
  failureCount: number;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### CapturedRequest Model
```typescript
interface CapturedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  requestBody?: string;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  responseType: string;
  timestamp: number;
  duration: number;
}
```

### DetectionMetrics Model
```typescript
interface DetectionMetrics {
  competitorWebsiteId: string;
  detectionAttempts: number;
  successfulDetections: number;
  averageDetectionTime: number;
  apiExtractionSuccessRate: number;
  fallbackRate: number;
  lastDetectionAt: Date;
}
```

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API Detection Invocation
*For any* competitor website, when the scraper starts processing it without a cached pattern, the API_Detector should be invoked and analyze network traffic for potential product data endpoints.
**Validates: Requirements 1.1**

### Property 2: XHR and Fetch Call Identification
*For any* network traffic containing XHR or Fetch calls with structured product data, the API_Detector should identify and capture these calls.
**Validates: Requirements 1.2**

### Property 3: API Ranking by Quality
*For any* set of discovered API endpoints, the API_Detector should rank them such that APIs with higher data quality and completeness appear first in the ranked list.
**Validates: Requirements 1.3**

### Property 4: Detection Timeout Compliance
*For any* competitor website, the API_Detector should complete detection within 30 seconds or timeout and proceed to fallback.
**Validates: Requirements 1.4, 5.1**

### Property 5: API Pattern Persistence Round-Trip
*For any* successfully validated API pattern, storing it in the database and then retrieving it should produce an equivalent pattern with all required fields (URL, parameters, response structure).
**Validates: Requirements 1.5, 6.1, 6.2**

### Property 6: Required Field Validation
*For any* discovered API endpoint, validation should verify that responses contain at least product name and price fields, and mark the API as invalid if these fields are missing.
**Validates: Requirements 2.2**

### Property 7: Error Response Handling
*For any* API endpoint that requires authentication or returns error status codes (4xx, 5xx), the API_Detector should mark it as unusable.
**Validates: Requirements 2.3**

### Property 8: Response Consistency Validation
*For any* API endpoint, making multiple requests should return data with consistent structure, and inconsistent APIs should receive lower confidence scores.
**Validates: Requirements 2.4**

### Property 9: Confidence Score Assignment
*For any* validated API endpoint, a confidence score between 0 and 100 should be assigned based on validation results, with higher scores for APIs with complete data and consistent structure.
**Validates: Requirements 2.5**

### Property 10: API Preference Over HTML
*For any* competitor website with a valid cached API pattern, the scraper should use API extraction and not invoke HTML parsing.
**Validates: Requirements 3.1**

### Property 11: Response Format Normalization
*For any* API response in JSON or XML format, parsing and normalization should produce Product_Data objects with standard fields (sku, name, brand, model, price).
**Validates: Requirements 3.2, 3.5**

### Property 12: Pagination Completeness
*For any* paginated API endpoint, the scraper should follow pagination links until all pages are retrieved or the maximum page limit is reached.
**Validates: Requirements 3.3**

### Property 13: Nested Data Traversal
*For any* API response with nested data structures, the scraper should successfully traverse and extract product fields regardless of nesting depth (up to reasonable limits).
**Validates: Requirements 3.4**

### Property 14: Fallback Trigger Conditions
*For any* scraping operation where no valid API is discovered within timeout, or all discovered APIs fail validation, or API extraction fails, the scraper should automatically use the Fallback_Strategy.
**Validates: Requirements 4.1, 4.2, 7.3, 7.4**

### Property 15: Output Format Consistency
*For any* competitor website, extracting products via API and extracting via HTML parsing should produce Product_Data objects with the same structure and field types.
**Validates: Requirements 4.4**

### Property 16: API Unavailability Marking
*For any* competitor website where fallback occurs, the website should be marked as "API not available" to skip detection on subsequent scraping runs.
**Validates: Requirements 4.5**

### Property 17: Cache Reuse Without Re-detection
*For any* competitor website with a cached API pattern, subsequent scraping operations should reuse the cached pattern without running the detection phase.
**Validates: Requirements 5.2, 6.3, 6.4**

### Property 18: API Extraction Performance
*For any* competitor website where both API and HTML extraction are possible, API extraction should complete at least 50% faster than HTML parsing for the same product set.
**Validates: Requirements 5.3**

### Property 19: Memory Usage Limits
*For any* detection operation, the Network_Interceptor should limit memory usage to prevent exceeding system thresholds that could cause browser crashes.
**Validates: Requirements 5.4**

### Property 20: Cache Invalidation on Failure
*For any* cached API pattern that fails during extraction, the cache should be invalidated and detection should re-run on the next scraping attempt.
**Validates: Requirements 6.5**

### Property 21: API Retry Before Fallback
*For any* scraping operation with multiple discovered APIs, if the first API fails validation, the scraper should attempt the next API before falling back to HTML parsing.
**Validates: Requirements 7.2**

### Property 22: Error Statistics Tracking
*For any* competitor website, the scraper should maintain cumulative error statistics (success count, failure count) across multiple scraping operations.
**Validates: Requirements 7.5**

### Property 23: Robots.txt Compliance
*For any* competitor website with robots.txt rules, the API_Detector should respect disallowed paths and not analyze or request those endpoints.
**Validates: Requirements 8.1**

### Property 24: User-Agent Header Inclusion
*For any* API request made by the scraper, the request should include an appropriate User-Agent header identifying the scraper.
**Validates: Requirements 8.2**

### Property 25: Rate Limiting Enforcement
*For any* sequence of API requests to the same endpoint, the scraper should enforce rate limits such that requests are spaced according to configured intervals.
**Validates: Requirements 8.3**

### Property 26: Authentication Token Detection
*For any* network traffic containing authentication tokens (in headers, cookies, or request bodies), the API_Detector should detect and extract these tokens for use in API patterns.
**Validates: Requirements 8.4**

### Property 27: Detection Attempt Logging
*For any* API detection attempt, the scraper should create a log entry with timestamp, competitor website, success/failure status, and discovered API count.
**Validates: Requirements 9.1**

### Property 28: API Discovery Logging
*For any* discovered API endpoint, the scraper should log the endpoint URL, HTTP method, response format, and confidence score.
**Validates: Requirements 9.2**

### Property 29: Scraping Metrics Tracking
*For any* scraping operation, the scraper should track and store metrics including detection time, extraction time, product count, and data quality indicators.
**Validates: Requirements 9.3**

### Property 30: Fallback Reason Logging
*For any* fallback to HTML parsing, the scraper should log the specific reason (timeout, no API found, API failed, etc.) and any associated error messages.
**Validates: Requirements 4.3, 7.1, 9.4**

## Error Handling

### Detection Phase Errors

**Network Interception Failures:**
- Browser fails to launch → Log error, use fallback immediately
- Network interception setup fails → Log error, use fallback
- Page navigation timeout → Log error, mark as detection failed, use fallback

**API Discovery Errors:**
- No product-related requests found → Mark as "no API available", use fallback
- All discovered APIs fail validation → Log validation errors, use fallback
- Detection timeout exceeded → Abort detection, use fallback

### Extraction Phase Errors

**API Request Failures:**
- HTTP errors (4xx, 5xx) → Retry with exponential backoff (max 3 attempts)
- Network timeout → Retry, then fallback if all retries fail
- Rate limit exceeded → Wait and retry, or fallback if persistent

**Data Parsing Errors:**
- Invalid JSON/XML → Log error, try next API or fallback
- Missing required fields → Log error, mark API as low quality
- Data type mismatches → Attempt type coercion, log warning

**Pagination Errors:**
- Pagination pattern detection fails → Extract first page only, log warning
- Pagination loop detected → Break loop after max iterations, log error
- Inconsistent pagination responses → Use available data, log warning

### Cache Errors

**Cache Read Failures:**
- Database connection error → Log error, proceed with detection
- Corrupted cache data → Invalidate cache, run detection
- Cache miss → Proceed with detection normally

**Cache Write Failures:**
- Database write error → Log error, continue with extraction (cache update is non-critical)
- Serialization error → Log error, skip caching for this pattern

### Error Recovery Strategy

1. **Graceful Degradation:** Always fallback to HTML parsing when API methods fail
2. **Retry Logic:** Implement exponential backoff for transient failures
3. **Circuit Breaker:** After N consecutive failures for a website, skip API detection temporarily
4. **Error Aggregation:** Collect all errors during a scraping run and report them together
5. **User Notification:** Alert users when API detection consistently fails for important competitors

## Testing Strategy

### Unit Testing

**Component-Level Tests:**
- **APIDetector:** Test API discovery logic with mock network traffic
- **NetworkInterceptor:** Test request capture and filtering
- **APIPatternAnalyzer:** Test pattern recognition with sample responses
- **APIExtractor:** Test data extraction with various API formats
- **APICache:** Test cache storage and retrieval operations

**Edge Cases:**
- Empty network traffic (no requests captured)
- Malformed API responses (invalid JSON/XML)
- APIs with unusual pagination patterns
- APIs requiring complex authentication
- Very large API responses (memory handling)

**Error Conditions:**
- Network timeouts during detection
- Database connection failures
- Invalid cached patterns
- Rate limit violations
- Browser crashes during interception

### Property-Based Testing

**Test Configuration:**
- Minimum 100 iterations per property test
- Use property-based testing library (fast-check for TypeScript)
- Each test references its design document property

**Property Test Examples:**

**Property 5: API Pattern Persistence Round-Trip**
```typescript
// Feature: hidden-api-detection, Property 5: API Pattern Persistence Round-Trip
test('stored API patterns can be retrieved with all fields intact', async () => {
  await fc.assert(
    fc.asyncProperty(
      apiPatternGenerator(),
      async (pattern) => {
        await apiCache.storePattern(pattern.competitorWebsiteId, pattern);
        const retrieved = await apiCache.getPattern(pattern.competitorWebsiteId);
        
        expect(retrieved).toBeDefined();
        expect(retrieved.url).toBe(pattern.url);
        expect(retrieved.method).toBe(pattern.method);
        expect(retrieved.headers).toEqual(pattern.headers);
        expect(retrieved.queryParams).toEqual(pattern.queryParams);
        expect(retrieved.responseFormat).toBe(pattern.responseFormat);
        expect(retrieved.dataPath).toBe(pattern.dataPath);
        expect(retrieved.fieldMappings).toEqual(pattern.fieldMappings);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property 11: Response Format Normalization**
```typescript
// Feature: hidden-api-detection, Property 11: Response Format Normalization
test('API responses are normalized to standard Product_Data format', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.oneof(jsonProductResponseGenerator(), xmlProductResponseGenerator()),
      async (response) => {
        const products = await apiExtractor.parseResponse(response);
        
        products.forEach(product => {
          expect(product).toHaveProperty('name');
          expect(product).toHaveProperty('price');
          expect(typeof product.name).toBe('string');
          expect(typeof product.price).toBe('number');
          expect(product.price).toBeGreaterThan(0);
        });
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property 14: Fallback Trigger Conditions**
```typescript
// Feature: hidden-api-detection, Property 14: Fallback Trigger Conditions
test('scraper falls back to HTML when API methods fail', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        websiteId: fc.uuid(),
        apiAvailable: fc.boolean(),
        apiSucceeds: fc.boolean()
      }),
      async ({ websiteId, apiAvailable, apiSucceeds }) => {
        // Mock API detection and extraction
        if (!apiAvailable) {
          mockAPIDetector.detectAPIs.mockResolvedValue([]);
        } else if (!apiSucceeds) {
          mockAPIExtractor.extractProducts.mockRejectedValue(new Error('API failed'));
        }
        
        const result = await scraper.scrapeWebsite(websiteId);
        
        if (!apiAvailable || !apiSucceeds) {
          expect(result.method).toBe('html');
          expect(mockHTMLScraper.scrape).toHaveBeenCalled();
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

**End-to-End Workflows:**
- Complete scraping flow with API detection and extraction
- Cache hit scenario (reusing cached patterns)
- Cache miss scenario (running detection)
- Fallback scenario (API fails, HTML succeeds)
- Multi-page pagination extraction

**External Dependencies:**
- Test with real competitor websites (in staging environment)
- Test with mock HTTP servers simulating various API patterns
- Test database operations with test database
- Test browser automation with headless Chrome

### Performance Testing

**Benchmarks:**
- Detection time for various website complexities
- Extraction time comparison (API vs HTML)
- Memory usage during network interception
- Cache lookup performance
- Concurrent scraping operations

**Load Testing:**
- Multiple concurrent detection operations
- High-frequency API requests (rate limiting)
- Large API responses (memory handling)
- Database connection pool under load

### Manual Testing

**Real-World Validation:**
- Test with actual competitor websites from PricePilot users
- Verify API detection accuracy on popular e-commerce platforms
- Validate data quality from extracted products
- Test fallback behavior with problematic websites
- Verify dashboard metrics and logging

**User Acceptance:**
- Verify scraping speed improvements
- Confirm data accuracy matches HTML scraping
- Test error messages and notifications
- Validate cache invalidation behavior

## Implementation Notes

### Technology Choices

**Browser Automation:**
- Use Puppeteer for headless Chrome automation
- Puppeteer provides robust CDP (Chrome DevTools Protocol) access
- Alternative: Playwright for cross-browser support if needed

**Network Interception:**
- Use Puppeteer's `page.on('request')` and `page.on('response')` events
- Implement request filtering to reduce memory usage
- Buffer responses in memory-efficient manner

**Data Parsing:**
- Use JSONPath library (jsonpath-plus) for JSON traversal
- Use XPath library (xpath) for XML traversal
- Implement custom field mapping engine

**Caching:**
- Store API patterns as JSONB in PostgreSQL
- Use database indexes for fast lookups
- Implement TTL (time-to-live) for cache entries

### Security Considerations

**Credential Handling:**
- Never store competitor website credentials
- Extract authentication tokens from network traffic only
- Encrypt stored API patterns containing sensitive data

**Rate Limiting:**
- Implement per-website rate limits
- Use exponential backoff for retries
- Respect Retry-After headers from APIs

**Robots.txt Compliance:**
- Parse and respect robots.txt before detection
- Cache robots.txt rules per website
- Provide override option for authorized scraping

### Performance Optimizations

**Detection Phase:**
- Limit number of pages analyzed (default: 3)
- Filter out non-product-related requests early
- Use request URL patterns to identify likely product APIs
- Implement timeout for each page navigation

**Extraction Phase:**
- Parallelize API requests when possible
- Implement connection pooling for HTTP requests
- Cache parsed responses to avoid re-parsing
- Use streaming for large API responses

**Caching Strategy:**
- Cache API patterns indefinitely until failure
- Implement LRU cache for in-memory pattern storage
- Preload frequently used patterns on startup
- Background refresh of cached patterns

### Monitoring and Observability

**Metrics to Track:**
- API detection success rate per website
- Average detection time
- API extraction success rate
- Fallback rate
- Cache hit rate
- Average extraction time (API vs HTML)
- Error rates by error type

**Logging Strategy:**
- Structured logging with JSON format
- Include correlation IDs for request tracing
- Log levels: DEBUG (detection details), INFO (success/failure), ERROR (exceptions)
- Separate log streams for detection and extraction

**Alerting:**
- Alert when detection success rate drops below threshold
- Alert when API extraction failure rate exceeds threshold
- Alert when cache invalidation rate is high
- Alert on repeated browser crashes

### Deployment Considerations

**Resource Requirements:**
- Headless browser requires significant memory (512MB-1GB per instance)
- Limit concurrent detection operations (max 5 concurrent)
- Use worker queue for detection jobs
- Implement graceful shutdown for browser cleanup

**Rollout Strategy:**
- Phase 1: Deploy with feature flag disabled
- Phase 2: Enable for small subset of competitor websites
- Phase 3: Monitor metrics and adjust thresholds
- Phase 4: Gradual rollout to all websites
- Phase 5: Make API detection default behavior

**Rollback Plan:**
- Feature flag to disable API detection
- Fallback to HTML scraping for all websites
- Preserve existing HTML scraping code
- Monitor for regressions after rollback
