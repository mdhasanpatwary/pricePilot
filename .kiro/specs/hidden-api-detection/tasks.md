# Implementation Plan: Hidden API Detection Strategy

## Overview

This implementation plan breaks down the Hidden API Detection Strategy feature into discrete, incremental coding tasks. The approach follows a layered architecture: first establishing core infrastructure (database, models), then building detection components, followed by extraction logic, and finally integration with the existing scraper system.

## Tasks

- [x] 1. Set up database schema and core data models
  - Create Prisma migration for `api_patterns` table with all required fields
  - Create TypeScript interfaces for APIPattern, CapturedRequest, and related models
  - Add indexes for performance (tenantId, competitorWebsiteId)
  - _Requirements: 1.5, 6.1, 6.2_

- [x] 2. Implement Network Interceptor component
  - [x] 2.1 Create NetworkInterceptor class with Puppeteer integration
    - Implement `startInterception()` to hook into browser network layer using CDP
    - Implement request filtering to capture only XHR/Fetch calls
    - Implement `getCapturedRequests()` to return captured network traffic
    - Add memory-efficient buffering to prevent crashes
    - _Requirements: 1.1, 1.2, 5.4_
  
  - [x] 2.2 Add request filtering logic
    - Filter by resource types (xhr, fetch)
    - Exclude non-product URLs (analytics, ads, tracking)
    - Implement URL pattern matching with RegExp
    - run yarn build if has error, fix them
    - make a short commit 
    - _Requirements: 1.2_

- [x] 3. Implement API Pattern Analyzer component
  - [x] 3.1 Create APIPatternAnalyzer class
    - Implement `analyzeRequests()` to identify product API patterns
    - Use heuristics: URL keywords, response structure, response size
    - Implement JSONPath and XPath parsing for data extraction
    - _Requirements: 1.2, 1.3_
  
  - [x] 3.2 Implement field mapping extraction
    - Implement `extractFieldMappings()` to map API fields to standard Product_Data
    - Detect common field names (sku, name, price, brand, model)
    - Handle nested data structures
    - _Requirements: 3.4, 3.5_
  
  - [x] 3.3 Implement pagination pattern detection
    - Implement `detectPagination()` to identify pagination patterns
    - Support offset, page, and cursor-based pagination
    - Extract pagination parameters from requests
    - run yarn build if has error, fix them
    - make a short commit 
    - _Requirements: 3.3_

- [x] 4. Implement API Detector component
  - [x] 4.1 Create APIDetector class with validation logic
    - Implement `detectAPIs()` to orchestrate detection process
    - Launch headless browser with Puppeteer
    - Navigate to competitor product pages
    - Capture network traffic using NetworkInterceptor
    - Analyze captured requests using APIPatternAnalyzer
    - Implement 30-second timeout for detection
    - _Requirements: 1.1, 1.4, 5.1_
  
  - [x] 4.2 Implement API validation
    - Implement `validateAPI()` to test discovered endpoints
    - Make test requests to verify API responses
    - Validate required fields (name, price) are present
    - Check response structure consistency across multiple requests
    - Handle authentication errors and mark APIs as unusable
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 4.3 Implement API ranking
    - Implement `rankAPIs()` to sort by quality and completeness
    - Assign confidence scores (0-100) based on validation results
    - Rank by data completeness, consistency, and field coverage
    - run yarn build if has error, fix them
    - make a short commit 
    - _Requirements: 1.3, 2.5_

- [x] 5. Checkpoint - Ensure detection components work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement API Cache component
  - [x] 6.1 Create APICache class with database operations
    - Implement `storePattern()` to save API patterns to database
    - Implement `getPattern()` to retrieve cached patterns
    - Implement `invalidatePattern()` to remove failed patterns
    - Implement `updateMetrics()` to track success/failure counts
    - _Requirements: 1.5, 6.1, 6.2, 6.3, 6.5_
  
  - [x] 6.2 Add cache validation and metrics
    - Track success_count and failure_count for each pattern
    - Implement automatic invalidation after N consecutive failures
    - Add last_used_at timestamp tracking
    - run yarn build if has error, fix them
    - make a short commit 
    - _Requirements: 6.5, 7.5_

- [x] 7. Implement API Extractor component
  - [x] 7.1 Create APIExtractor class
    - Implement `extractProducts()` to fetch data using API patterns
    - Make HTTP requests with discovered patterns
    - Apply field mappings to normalize responses
    - Parse JSON and XML responses
    - _Requirements: 3.1, 3.2, 3.5_
  
  - [x] 7.2 Implement pagination handling
    - Implement `extractPaginatedProducts()` for multi-page extraction
    - Follow pagination patterns automatically
    - Support offset, page, and cursor-based pagination
    - Implement max pages limit to prevent infinite loops
    - _Requirements: 3.3_
  
  - [x] 7.3 Add retry logic and error handling
    - Implement exponential backoff for failed requests
    - Handle HTTP errors (4xx, 5xx) with retries
    - Handle network timeouts gracefully
    - Implement rate limiting to avoid overwhelming APIs
    - run yarn build if has error, fix them
    - make a short commit 
    - _Requirements: 7.2, 7.4, 8.3_

- [x] 8. Implement security and compliance features
  - [x] 8.1 Add robots.txt compliance
    - Parse and cache robots.txt rules per website
    - Check disallowed paths before making requests
    - _Requirements: 8.1_
  
  - [x] 8.2 Add User-Agent and authentication handling
    - Include appropriate User-Agent headers in all requests
    - Detect and extract authentication tokens from network traffic
    - Store tokens securely in API patterns
    - _Requirements: 8.2, 8.4_
  
  - [x] 8.3 Implement rate limiting
    - Add configurable rate limits per endpoint
    - Implement request spacing with delays
    - Respect Retry-After headers from APIs
    - run yarn build if has error, fix them
    - make a short commit 
    - _Requirements: 8.3_

- [x] 9. Checkpoint - Ensure extraction and security work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Enhance Scraper Orchestrator with API detection
  - [x] 10.1 Update ScraperOrchestrator to integrate API detection
    - Add cache lookup before detection
    - Run API detection if no cached pattern exists
    - Use API extraction when pattern is available
    - Fallback to HTML scraping when API fails or not found
    - _Requirements: 3.1, 4.1, 4.2, 5.2, 6.3, 6.4_
  
  - [x] 10.2 Implement fallback logic
    - Trigger fallback on detection timeout
    - Trigger fallback when no APIs discovered
    - Trigger fallback when all APIs fail validation
    - Trigger fallback when API extraction fails
    - Mark websites as "API not available" after fallback
    - _Requirements: 4.1, 4.2, 4.5, 7.3, 7.4_
  
  - [x] 10.3 Ensure output format consistency
    - Normalize Product_Data format for both API and HTML extraction
    - Ensure same fields and types regardless of extraction method
    - run yarn build if has error, fix them
    - make a short commit 
    - _Requirements: 4.4_

- [x] 11. Implement logging and monitoring
  - [x] 11.1 Add structured logging
    - Log all detection attempts with success/failure status
    - Log discovered APIs with URL, format, and confidence score
    - Log fallback events with reasons and errors
    - Use structured JSON logging format
    - _Requirements: 4.3, 7.1, 9.1, 9.2, 9.4_
  
  - [x] 11.2 Add metrics tracking
    - Track detection time, extraction time, and product count
    - Track API detection success rates per website
    - Track cache hit rates
    - Store metrics in database for dashboard display
    - _Requirements: 9.3_
  
  - [x] 11.3 Add progress feedback during detection
    - Emit progress events during detection phase
    - Provide status updates to prevent timeout assumptions
    - run yarn build if has error, fix them
    - make a short commit 
    - _Requirements: 5.5_

- [-] 12. Create API endpoints for management
  - [x] 12.1 Create endpoint to trigger manual API detection
    - `POST /api/v1/competitors/:id/detect-api`
    - Force re-detection even if cached pattern exists
    - Return discovered API patterns
    - _Requirements: 1.1_
  
  - [x] 12.2 Create endpoint to view cached API patterns
    - `GET /api/v1/competitors/:id/api-pattern`
    - Return cached pattern with metrics
    - Include success/failure counts
    - _Requirements: 6.3_
  
  - [x] 12.3 Create endpoint to invalidate cached patterns
    - `DELETE /api/v1/competitors/:id/api-pattern`
    - Invalidate cache and force re-detection on next scrape
    - run yarn build if has error, fix them
    - make a short commit 
    - _Requirements: 6.5_

- [~] 13. Add performance optimizations
  - [ ] 13.1 Implement connection pooling for HTTP requests
    - Reuse HTTP connections for API requests
    - Configure pool size and timeout settings
    - _Requirements: 5.3_
  
  - [ ] 13.2 Add in-memory LRU cache for frequently used patterns
    - Cache patterns in memory for faster access
    - Implement LRU eviction policy
    - Sync with database cache
    - _Requirements: 5.2_
  
  - [ ] 13.3 Optimize detection phase
    - Limit pages analyzed to 3 by default
    - Filter requests early to reduce memory usage
    - Implement parallel validation of multiple APIs
    - run yarn build if has error, fix them
    - make a short commit 
    - _Requirements: 1.4, 5.4_

- [~] 14. Final checkpoint - Integration testing
  - Test complete scraping flow with real competitor websites
  - Verify cache hit/miss scenarios work correctly
  - Verify fallback to HTML scraping works
  - Verify API extraction is faster than HTML parsing
  - Ensure all tests pass, ask the user if questions arise.

- [~] 15. Add monitoring dashboard components
  - [ ] 15.1 Create API detection metrics dashboard
    - Display detection success rates per competitor website
    - Show average detection and extraction times
    - Display cache hit rates
    - Show fallback rates and reasons
    - _Requirements: 9.5_
  
  - [ ] 15.2 Add API pattern management UI
    - Display cached API patterns for each competitor
    - Allow manual invalidation of patterns
    - Show pattern confidence scores and metrics
    - Provide button to trigger manual re-detection
    - run yarn build if has error, fix them
    - make a short commit 

## Notes

- All database operations must enforce tenant isolation via tenantId
- All API requests must include appropriate User-Agent headers
- Browser instances must be properly cleaned up to prevent memory leaks
- Detection timeout is critical - must not exceed 30 seconds
- Fallback to HTML scraping ensures backward compatibility
- Cache invalidation prevents using stale or broken API patterns
- Metrics and logging are essential for monitoring feature effectiveness
