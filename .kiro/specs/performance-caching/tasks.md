# Implementation Plan: Performance Caching

## Overview

This implementation plan integrates the existing caching infrastructure (CacheService, CacheLayer, API middleware) into PricePilot's critical services to achieve significant performance improvements. The focus is on completing the integration, adding invalidation triggers, implementing cache warming, and ensuring comprehensive monitoring.

## Tasks

- [x] 1. Set up and verify Upstash Redis configuration
  - Verify UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables
  - Test Redis connectivity with existing CacheService
  - Configure Redis memory limit (500MB) and eviction policy (LRU)
  - Document Redis configuration in .env.example
  - _Requirements: 1.6, 10.1, 10.2_

- [x] 2. Create enhanced cache service with application-specific methods
  - [x] 2.1 Create lib/services/cache-enhanced.ts
    - Implement CacheEnhancedService class extending CacheLayer
    - Add product caching methods (cacheProduct, getCachedProduct, invalidateProduct)
    - Add comparison caching methods (cacheComparison, getCachedComparison, invalidateComparisons)
    - Add matching caching methods (cacheMatches, getCachedMatches, invalidateMatches)
    - Add competitor caching methods (cacheCompetitorProducts, getCachedCompetitorProducts, invalidateCompetitorProducts)
    - Add price history caching methods (cachePriceHistory, getCachedPriceHistory, invalidatePriceHistory)
    - Add analytics caching methods (cacheAnalytics, getCachedAnalytics, invalidateAnalytics)
    - Add bulk operations (invalidateAll, warmCache)
    - Add statistics method (getStats)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.2, 5.3_
  
  - [ ]* 2.2 Write property test for tenant isolation in cache keys
    - **Property 1: Tenant Isolation in Cache Keys**
    - **Validates: Requirements 5.1, 5.4**
  
  - [ ]* 2.3 Write property test for tenant data access isolation
    - **Property 2: Tenant Data Access Isolation**
    - **Validates: Requirements 1.5, 5.2**
  
  - [ ]* 2.4 Write property test for tenant-scoped cache operations
    - **Property 3: Tenant-Scoped Cache Operations**
    - **Validates: Requirements 5.3, 5.5**

- [x] 3. Integrate caching into MatchingService
  - [x] 3.1 Update lib/services/matching.ts to use CacheEnhancedService
    - Inject CacheEnhancedService into MatchingService constructor
    - Wrap findMatches method with cache lookup and storage
    - Wrap autoMatchProducts method with cache lookup and storage
    - Configure TTL for matching operations (15 minutes)
    - Add error handling for cache failures (graceful degradation)
    - _Requirements: 1.1, 1.6_
  
  - [ ]* 3.2 Write property test for graceful degradation on cache failure
    - **Property 4: Graceful Degradation on Cache Failure**
    - **Validates: Requirements 1.6, 2.6, 3.5**
  
  - [ ]* 3.3 Write unit tests for MatchingService cache integration
    - Test cache hit scenario returns cached matches
    - Test cache miss scenario queries database and caches result
    - Test Redis failure falls back to database
    - _Requirements: 1.1, 1.6_

- [x] 4. Integrate caching into comparison queries
  - [x] 4.1 Create lib/services/comparison.ts with caching
    - Create ComparisonService class with CacheEnhancedService dependency
    - Implement getComparisonReport method with cache lookup
    - Implement getProductComparison method with cache lookup
    - Configure TTL for comparison queries (5 minutes)
    - Add error handling for cache failures
    - _Requirements: 1.2, 1.6_
  
  - [ ]* 4.2 Write unit tests for ComparisonService cache integration
    - Test cache hit returns cached comparison data
    - Test cache miss queries database and caches result
    - Test TTL expiration triggers database query
    - _Requirements: 1.2_

- [x] 5. Implement cache invalidation service
  - [x] 5.1 Create lib/services/cache-invalidation.ts
    - Create CacheInvalidationService class
    - Implement onPriceUpdate method to invalidate affected caches
    - Implement onProductSync method to invalidate product caches
    - Implement onMatchUpdate method to invalidate matching caches
    - Implement onCompetitorScrape method to invalidate competitor caches
    - Add error handling and logging for invalidation failures
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_
  
  - [ ]* 5.2 Write property test for cache invalidation correctness
    - **Property 5: Cache Invalidation Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  
  - [ ]* 5.3 Write property test for pattern-based invalidation
    - **Property 6: Pattern-Based Invalidation**
    - **Validates: Requirements 2.5**
  
  - [ ]* 5.4 Write unit tests for cache invalidation triggers
    - Test price update invalidates comparison caches
    - Test product sync invalidates product caches
    - Test match update invalidates matching caches
    - Test competitor scrape invalidates competitor caches
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 6. Add cache invalidation triggers to data modification operations
  - [x] 6.1 Integrate CacheInvalidationService into price update workflow
    - Import CacheInvalidationService in price update handler
    - Call onPriceUpdate after successful price updates
    - Pass affected product IDs to invalidation service
    - _Requirements: 2.1_
  
  - [x] 6.2 Integrate CacheInvalidationService into product sync workflow
    - Import CacheInvalidationService in product sync handler
    - Call onProductSync after successful product sync
    - _Requirements: 2.2_
  
  - [x] 6.3 Integrate CacheInvalidationService into match update workflow
    - Import CacheInvalidationService in match update handler
    - Call onMatchUpdate after successful match creation/update
    - _Requirements: 2.3_
  
  - [x] 6.4 Integrate CacheInvalidationService into competitor scrape workflow
    - Import CacheInvalidationService in scraper completion handler
    - Call onCompetitorScrape after successful scrape
    - _Requirements: 2.4_

- [x] 7. Checkpoint - Verify cache integration and invalidation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement cache warming service
  - [x] 8.1 Create lib/services/cache-warming.ts
    - Create CacheWarmingService class
    - Implement warmTenantCache method for warming active products
    - Implement warmOnLogin method for warming essential data on user login
    - Implement warmDashboardData method for warming dashboard analytics
    - Implement scheduledWarming method for off-peak cache warming
    - Add error handling to prevent warming failures from blocking requests
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
  
  - [ ]* 8.2 Write property test for cache warming on comparison request
    - **Property 7: Cache Warming on Comparison Request**
    - **Validates: Requirements 3.2**
  
  - [ ]* 8.3 Write unit tests for cache warming scenarios
    - Test warmOnLogin caches active products
    - Test warmDashboardData caches analytics
    - Test warming failures don't block user requests
    - _Requirements: 3.1, 3.5_

- [x] 9. Integrate cache warming into application workflows
  - [x] 9.1 Add warmOnLogin call to authentication handler
    - Import CacheWarmingService in auth handler
    - Call warmOnLogin after successful login
    - Use fire-and-forget pattern (don't block login)
    - _Requirements: 3.1_
  
  - [x] 9.2 Add cache warming to comparison report generation
    - Import CacheWarmingService in comparison service
    - Warm related competitor products when generating report
    - _Requirements: 3.2_
  
  - [x] 9.3 Set up scheduled cache warming job
    - Create cron job for daily cache warming (off-peak hours)
    - Configure to warm top 100 products per tenant
    - Add error handling and logging
    - _Requirements: 3.3_

- [x] 10. Implement cache monitoring service
  - [x] 10.1 Create lib/services/cache-monitoring.ts
    - Create CacheMonitoringService class
    - Implement getHealthStatus method for Redis health check
    - Implement generateAlerts method for threshold-based alerts
    - Implement logStats method for periodic statistics logging
    - Add monitoring for hit rate, memory usage, and response time
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  
  - [ ]* 10.2 Write property test for statistics tracking accuracy
    - **Property 8: Statistics Tracking Accuracy**
    - **Validates: Requirements 4.1, 4.2, 4.3**
  
  - [ ]* 10.3 Write unit tests for cache monitoring
    - Test health check returns healthy when Redis is connected
    - Test health check returns unhealthy when Redis is down
    - Test alerts generated when hit rate below 60%
    - Test alerts generated when memory usage above 80%
    - _Requirements: 10.1, 10.2, 4.5, 10.4_

- [x] 11. Add cache statistics API endpoint
  - [x] 11.1 Create GET /api/v1/cache/stats endpoint
    - Create API route handler for cache statistics
    - Call CacheMonitoringService.getHealthStatus
    - Return cache health, performance metrics, and alerts
    - Require authentication (admin only)
    - _Requirements: 4.4_
  
  - [ ]* 11.2 Write integration test for cache stats endpoint
    - Test endpoint returns statistics
    - Test endpoint requires authentication
    - Test endpoint includes hit rate, memory usage, and alerts
    - _Requirements: 4.4_

- [-] 12. Integrate API response caching middleware
  - [x] 12.1 Apply apiCache middleware to GET endpoints
    - Apply to GET /api/v1/products (TTL: 2 minutes)
    - Apply to GET /api/v1/comparison/report (TTL: 5 minutes)
    - Apply to GET /api/v1/competitors/:id/products (TTL: 10 minutes)
    - Configure cache key prefixes for each endpoint
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ]* 12.2 Write property test for API mutation request non-caching
    - **Property 9: API Mutation Request Non-Caching**
    - **Validates: Requirements 8.4**
  
  - [ ]* 12.3 Write property test for cache status header presence
    - **Property 10: Cache Status Header Presence**
    - **Validates: Requirements 8.5**
  
  - [ ]* 12.4 Write unit tests for API caching middleware
    - Test GET requests are cached with correct TTL
    - Test POST/PUT/PATCH/DELETE requests are not cached
    - Test X-Cache-Status header is present (HIT or MISS)
    - Test cached responses are under 50ms
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 13. Checkpoint - Verify warming, monitoring, and API caching
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Add distributed caching support
  - [x] 14.1 Implement cache invalidation propagation
    - Use Redis pub/sub for invalidation events
    - Subscribe to invalidation channel on service startup
    - Publish invalidation events when cache is invalidated
    - Handle invalidation events from other instances
    - _Requirements: 7.2_
  
  - [ ]* 14.2 Write property test for distributed cache invalidation propagation
    - **Property 11: Distributed Cache Invalidation Propagation**
    - **Validates: Requirements 7.2**
  
  - [ ]* 14.3 Write property test for concurrent cache operation safety
    - **Property 12: Concurrent Cache Operation Safety**
    - **Validates: Requirements 7.3, 7.4**
  
  - [ ]* 14.4 Write integration tests for distributed caching
    - Test invalidation propagates across instances
    - Test concurrent operations maintain consistency
    - Test race conditions are handled gracefully
    - _Requirements: 7.2, 7.3, 7.4_

- [x] 15. Implement TTL expiration testing
  - [x]* 15.1 Write property test for TTL expiration correctness
    - **Property 13: TTL Expiration Correctness**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
  
  - [x]* 15.2 Write unit tests for TTL configuration
    - Test product comparison queries expire after 5 minutes
    - Test matching results expire after 15 minutes
    - Test competitor products expire after 30 minutes
    - Test price history expires after 1 hour
    - Test analytics expire after 10 minutes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 16. Configure cache memory limits and eviction
  - [x] 16.1 Configure Redis maxmemory and eviction policy
    - Set maxmemory to 500MB in Redis configuration
    - Set maxmemory-policy to allkeys-lru
    - Add monitoring for memory usage approaching limit
    - _Requirements: 6.6, 10.3, 10.4_
  
  - [ ]* 16.2 Write edge case test for memory limit eviction
    - Test LRU eviction occurs when memory limit exceeded
    - Test least recently used items are evicted first
    - _Requirements: 6.6_

- [x] 17. Set up cache monitoring and alerting
  - [x] 17.1 Configure periodic cache statistics logging
    - Set up cron job to log cache stats every 5 minutes
    - Call CacheMonitoringService.logStats
    - Send statistics to monitoring dashboard
    - _Requirements: 4.6_
  
  - [x] 17.2 Configure alerting for cache health issues
    - Set up alert for hit rate below 60%
    - Set up alert for memory usage above 80%
    - Set up alert for cache operations over 100ms
    - Set up alert for Redis connectivity failures
    - _Requirements: 4.5, 10.4, 10.6_

- [x] 18. Performance testing and validation
  - [x]* 18.1 Run performance benchmarks
    - Measure database query load before and after caching
    - Measure API response times (p95) before and after caching
    - Measure cache hit rate after integration
    - Measure Redis memory usage under load
    - Verify 60%+ reduction in database load
    - Verify 40%+ improvement in response times
    - Verify 70%+ cache hit rate
    - Verify memory usage under 500MB
    - _Requirements: All performance targets_
  
  - [x]* 18.2 Run load tests with caching enabled
    - Simulate production traffic patterns
    - Monitor cache performance under load
    - Verify graceful degradation if Redis fails
    - _Requirements: 1.6_

- [x] 19. Final checkpoint - Complete integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Documentation and deployment preparation
  - [x] 20.1 Update documentation
    - Document cache configuration in README
    - Document cache invalidation patterns
    - Document cache warming strategies
    - Document monitoring and alerting setup
    - Add troubleshooting guide for cache issues
  
  - [x] 20.2 Create deployment checklist
    - Verify Upstash Redis is provisioned
    - Verify environment variables are set
    - Verify Redis memory limits are configured
    - Verify monitoring is enabled
    - Verify alerting is configured
    - Plan phased rollout (10% → 50% → 100%)

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Integration tests verify service integration and distributed behavior
- Performance tests validate that caching achieves target improvements
