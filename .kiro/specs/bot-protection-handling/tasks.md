# Implementation Plan: Bot Protection Handling

## Overview

This implementation plan breaks down the bot protection handling feature into discrete, incremental coding tasks. Each task builds on previous work, with checkpoints to ensure quality and allow for user feedback. The implementation follows a bottom-up approach, starting with core detection and mitigation components, then building up to the orchestration layer, and finally adding monitoring and user-facing features.

## Tasks

- [x] 1. Database schema and migrations
  - Create migration files for all new tables (proxies, proxy_site_health, scraping_configs, scraping_sessions, scrape_attempts, protection_detections, scraping_metrics, scraping_alerts)
  - Add indexes for performance optimization
  - Update Prisma schema with new models
  - Run migrations on development database
  - Check Lint & Build Errors
  - _Requirements: 1.7, 2.4, 5.1, 8.1, 9.2, 12.1, 15.1_

- [x] 2. Core detection engine
  - [x] 2.1 Implement DetectionEngine class with response analysis
    - Create ProtectionType enum and DetectionResult interface
    - Implement analyzeResponse method with indicator extraction
    - Implement classifyProtection method with pattern matching
    - Implement calculateConfidence method
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 2.2 Implement detection logic for each protection type
    - IP block detection (403/429 status codes, specific error messages)
    - CAPTCHA detection (keyword matching in HTML)
    - Fake data detection (suspicious price values)
    - Redirect detection (3xx to different domain)
    - Delayed response detection (timeout threshold)
    - Empty response detection (content length checks)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 2.3 Implement confidence scoring algorithm
    - Calculate confidence based on number of indicators
    - Increase confidence for multiple consecutive failures
    - Store confidence with detection results
    - Check Lint & Build Errors
    - _Requirements: 1.8_

- [x] 3. Proxy management system
  - [x] 3.1 Implement ProxyManager class
    - Create Proxy and ProxyHealth interfaces
    - Implement getProxy method with selection algorithm
    - Implement markProxyFailed and markProxySuccess methods
    - Implement getProxyHealth method
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 3.2 Implement proxy selection algorithm
    - Filter proxies in cooldown
    - Filter globally unavailable proxies
    - Sort by site-specific success rate
    - Add randomization to avoid overuse
    - _Requirements: 2.1, 2.6_

  - [x] 3.3 Implement cooldown logic
    - Calculate cooldown duration based on failure count
    - Store cooldown_until timestamp in database
    - Exclude proxies in cooldown from selection
    - Reset cooldown on success
    - _Requirements: 2.3_

  - [x] 3.4 Implement proxy health tracking
    - Update success/failure counts after each attempt
    - Calculate success rates per proxy per site
    - Mark proxies as globally unavailable when appropriate
    - Trigger alert when all proxies blocked
    - Check Lint & Build Errors
    - _Requirements: 2.4, 2.5, 2.7_

- [x] 4. Rate limiting and backoff
  - [x] 4.1 Implement RateLimiter class
    - Create RateLimitConfig interface
    - Implement acquirePermit method with delay enforcement
    - Implement recordFailure and recordSuccess methods
    - Implement getNextAvailableTime method
    - _Requirements: 4.1, 4.4_

  - [x] 4.2 Implement exponential backoff calculation
    - Implement calculateDelay function with exponential formula
    - Apply backoff multiplier based on consecutive failures
    - Cap delay at maximum configured value
    - Add jitter randomization
    - _Requirements: 4.2, 4.3, 4.6_

  - [x] 4.3 Implement per-site rate limiting
    - Store last request time per competitor site
    - Enforce minimum delay between requests
    - Increase delay after rate limit failures
    - Support configurable rate limits per site
    - Check Lint & Build Errors
    - _Requirements: 4.1, 4.4, 4.5_

- [x] 5. Session and cookie management
  - [x] 5.1 Implement SessionManager class
    - Create Cookie interface
    - Implement getCookies method
    - Implement storeCookies method
    - Implement clearCookies method
    - Implement isSessionValid method
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.2 Implement cookie lifecycle management
    - Parse cookie expiration from headers
    - Store cookies with expiration timestamps
    - Automatically remove expired cookies
    - Maintain separate cookie jars per site
    - _Requirements: 5.3, 5.4, 5.6_

  - [x] 5.3 Implement session error handling
    - Detect session-related errors
    - Clear cookies on session failures
    - Log session clearing events
    - Check Lint & Build Errors
    - _Requirements: 5.5_

- [x] 6. HTTP scraper implementation
  - [x] 6.1 Implement HttpScraper class
    - Create ScrapeConfig and ScrapeResponse interfaces
    - Implement scrape method with axios/fetch
    - Add proxy support
    - Add cookie support
    - Add timeout handling
    - _Requirements: 6.1_

  - [x] 6.2 Implement user agent pool and rotation
    - Create pool of 50+ real browser user agents
    - Implement user agent selection logic
    - Rotate user agents across requests
    - Separate desktop and mobile user agents
    - _Requirements: 3.1, 3.5, 3.6_

  - [x] 6.3 Implement header generation
    - Create generateHeaders function
    - Include all required headers
    - Randomize header order
    - Support desktop and mobile profiles
    - Check Lint & Build Errors
    - _Requirements: 3.2, 3.3, 3.6_

- [x] 7. Headless browser scraper implementation
  - [x] 7.1 Implement HeadlessBrowserScraper class
    - Create BrowserScrapeConfig and BrowserScrapeResponse interfaces
    - Set up Puppeteer with stealth plugin
    - Implement scrape method with browser automation
    - Implement captureScreenshot method
    - _Requirements: 6.1, 6.2, 6.4_

  - [x] 7.2 Implement browser stealth configuration
    - Configure puppeteer-extra-plugin-stealth
    - Randomize viewport dimensions
    - Override navigator properties
    - Disable automation indicators
    - _Requirements: 3.4_

  - [x] 7.3 Implement browser pool management
    - Create browser instance pool
    - Reuse instances to reduce overhead
    - Limit concurrent browsers
    - Restart browsers after threshold
    - Timeout idle browsers
    - _Requirements: 6.2_

  - [x] 7.4 Implement wait conditions and JavaScript execution
    - Support waitForSelector option
    - Support waitForTimeout option
    - Execute custom JavaScript if configured
    - Wait for page load completion
    - Check Lint & Build Errors
    - _Requirements: 6.2, 6.3_

- [x] 8. Data extraction
  - [x] 8.1 Implement DataExtractor class
    - Create SelectorConfig and ExtractionResult interfaces
    - Implement extractPrice method with CSS selector support
    - Implement validatePrice method
    - Support fallback regex extraction
    - _Requirements: 15.5_

  - [x] 8.2 Implement price validation logic
    - Reject $0.00 and obvious fake values
    - Validate price is within reasonable range
    - Check for decimal places
    - Calculate extraction confidence
    - Check Lint & Build Errors
    - _Requirements: 1.6_

- [x] 9. Strategy selection and orchestration
  - [x] 9.1 Implement StrategySelector class
    - Create StrategyContext and FailureContext interfaces
    - Implement selectStrategy method
    - Implement selectRetryStrategy method
    - _Requirements: 7.1_

  - [x] 9.2 Implement strategy selection logic
    - Check site configuration for preferred strategy
    - Select appropriate strategy for first attempt
    - Select retry strategy based on failure type
    - Return null when all strategies exhausted
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.7_

  - [x] 9.3 Implement ScrapeOrchestrator class
    - Create ScrapeRequest and ScrapeResult interfaces
    - Implement executeScrape method
    - Implement retryFailedScrape method
    - Coordinate all components (detection, proxy, rate limiting, scraping)
    - _Requirements: 7.1, 7.2, 7.6_

  - [x] 9.4 Implement retry logic
    - Enforce maximum retry attempts
    - Apply appropriate strategy for each retry
    - Log each attempt
    - Mark as failed when retries exhausted
    - Check Lint & Build Errors
    - _Requirements: 7.2, 7.6_

- [x] 10. Checkpoint - Core scraping functionality complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Logging service
  - [x] 11.1 Implement LoggingService class
    - Create ScrapeAttemptLog and DetectionLog interfaces
    - Implement logScrapeAttempt method
    - Implement logDetection method
    - Implement queryLogs method
    - Implement cleanupOldLogs method
    - _Requirements: 8.1, 8.2, 8.4, 8.7_

  - [x] 11.2 Implement log storage and retention
    - Store complete logs in database
    - Truncate response samples to size limit
    - Store screenshots in S3 or file storage
    - Implement retention policy cleanup job
    - _Requirements: 8.3, 8.5, 8.6_

  - [x] 11.3 Implement log query interface
    - Support filtering by competitor site
    - Support filtering by date range
    - Support filtering by protection type
    - Support pagination
    - Check Lint & Build Errors
    - _Requirements: 8.7_

- [x] 12. Metrics collection and aggregation
  - [x] 12.1 Implement MetricsCollector class
    - Create ScrapeMetric and MetricsSummary interfaces
    - Implement recordAttempt method
    - Implement getSuccessRate method
    - Implement getMetricsSummary method
    - _Requirements: 9.1, 9.6_

  - [x] 12.2 Implement success rate calculation
    - Calculate success rate as (successful / total) × 100
    - Calculate average response time
    - Support different time windows
    - Track per-site and per-method statistics
    - _Requirements: 9.1, 9.2, 9.3, 9.6_

  - [x] 12.3 Implement metric aggregation
    - Create hourly rollup job
    - Store aggregated metrics in database
    - Maintain real-time counters in Redis
    - Generate protection type and strategy breakdowns
    - Check Lint & Build Errors
    - _Requirements: 9.2_

- [x] 13. Alert system
  - [x] 13.1 Implement AlertService class
    - Create Alert interface and AlertType enum
    - Implement checkThresholds method
    - Implement sendAlert method
    - Implement acknowledgeAlert method
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 13.2 Implement threshold monitoring
    - Monitor success rate thresholds
    - Detect CAPTCHA challenges
    - Detect all-proxies-blocked condition
    - Detect recovery conditions
    - _Requirements: 9.4, 12.1, 12.2, 12.3, 12.7_

  - [x] 13.3 Implement alert throttling
    - Track recent alerts per site and type
    - Enforce throttling window
    - Bypass throttling for critical alerts
    - _Requirements: 12.5_

  - [x] 13.4 Implement multi-channel notification
    - Send email notifications
    - Send webhook notifications
    - Create in-app notifications
    - Include context in all alerts
    - Check Lint & Build Errors
    - _Requirements: 12.4, 12.6_

- [x] 14. Configuration management
  - [x] 14.1 Implement configuration API endpoints
    - GET /api/v1/scraping/configs
    - GET /api/v1/scraping/configs/:competitorWebsiteId
    - PUT /api/v1/scraping/configs/:competitorWebsiteId
    - POST /api/v1/scraping/configs/:competitorWebsiteId/test
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 14.2 Implement configuration validation
    - Validate rate limit values are positive
    - Validate strategy names are valid
    - Validate CSS selector syntax
    - Validate timeout values
    - Reject invalid configurations with descriptive errors
    - _Requirements: 15.6_

  - [x] 14.3 Implement configuration audit trail
    - Log configuration changes
    - Store old and new values
    - Track user who made changes
    - Store timestamp
    - Check Lint & Build Errors
    - _Requirements: 15.7_

- [x] 15. Proxy management API
  - [x] 15.1 Implement proxy CRUD endpoints
    - GET /api/v1/scraping/proxies
    - POST /api/v1/scraping/proxies
    - PUT /api/v1/scraping/proxies/:id
    - DELETE /api/v1/scraping/proxies/:id
    - GET /api/v1/scraping/proxies/:id/health
    - _Requirements: 2.1, 2.4_

  - [x] 15.2 Implement proxy health endpoint
    - Return global success rate
    - Return site-specific success rates
    - Return last success/failure timestamps
    - Return blocked status and cooldown info
    - Check Lint & Build Errors
    - _Requirements: 2.4_

- [x] 16. Monitoring and metrics API
  - [x] 16.1 Implement metrics endpoints
    - GET /api/v1/scraping/metrics/summary
    - GET /api/v1/scraping/metrics/sites
    - GET /api/v1/scraping/metrics/sites/:competitorWebsiteId
    - _Requirements: 9.1, 9.2, 9.3, 9.6_

  - [x] 16.2 Implement metrics summary endpoint
    - Return total attempts and success rate
    - Return protection type breakdown
    - Return strategy breakdown
    - Return per-site metrics
    - Check Lint & Build Errors
    - _Requirements: 9.1, 9.6_

- [x] 17. Logging and debugging API
  - [x] 17.1 Implement log query endpoints
    - GET /api/v1/scraping/attempts
    - GET /api/v1/scraping/attempts/:id
    - GET /api/v1/scraping/attempts/:id/screenshot
    - GET /api/v1/scraping/detections
    - _Requirements: 8.7_

  - [x] 17.2 Implement log filtering and pagination
    - Support query parameters for filtering
    - Implement pagination
    - Return response samples
    - Return screenshot URLs
    - Check Lint & Build Errors
    - _Requirements: 8.7_

- [x] 18. Alert management API
  - [x] 18.1 Implement alert endpoints
    - GET /api/v1/scraping/alerts
    - POST /api/v1/scraping/alerts/:id/acknowledge
    - DELETE /api/v1/scraping/alerts/:id
    - _Requirements: 12.1_

  - [x] 18.2 Implement alert filtering
    - Filter by severity
    - Filter by competitor site
    - Filter by acknowledged status
    - Sort by timestamp
    - Check Lint & Build Errors
    - _Requirements: 12.1_

- [x] 19. Checkpoint - Backend APIs complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Monitoring dashboard UI
  - [x] 20.1 Create dashboard page component
    - Display overall success rate
    - Display per-site success rates with status indicators
    - Display recent protection type classifications
    - Display proxy health statistics
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 20.2 Implement site status indicators
    - Calculate status (healthy/degraded/blocked) based on success rate
    - Display color-coded indicators
    - Show last successful scrape timestamp
    - _Requirements: 10.6, 11.1_

  - [x] 20.3 Implement drill-down functionality
    - Click site to view detailed logs
    - Display recent scrape attempts
    - Show protection type history
    - Display response samples
    - _Requirements: 11.6_

  - [x] 20.4 Implement trend visualization
    - Display success rate trends over time
    - Support configurable time ranges
    - Show protection type trends
    - Display response time trends
    - Check Lint & Build Errors
    - _Requirements: 11.7_

- [x] 21. Alert display and management UI
  - [x] 21.1 Create alerts panel component
    - Display recent alerts
    - Show alert severity with color coding
    - Display alert details and context
    - _Requirements: 11.5_

  - [x] 21.2 Implement alert actions
    - Acknowledge alert button
    - Dismiss alert button
    - View related logs link
    - _Requirements: 12.1_

  - [x] 21.3 Implement in-app notifications
    - Show notification badge for new alerts
    - Display toast notifications for critical alerts
    - Link to alerts panel
    - Check Lint & Build Errors
    - _Requirements: 12.4_

- [x] 22. Error messaging and user communication
  - [x] 22.1 Implement error message generation
    - Generate user-friendly messages for each protection type
    - Provide actionable suggestions
    - Display on competitor product pages
    - _Requirements: 10.1, 10.2_

  - [x] 22.2 Implement site health warnings
    - Display warning indicator for low success rate sites
    - Show warning message with explanation
    - Provide link to monitoring dashboard
    - _Requirements: 10.3_

  - [x] 22.3 Implement last successful scrape display
    - Show last successful scrape timestamp
    - Display age indicator (e.g., "2 hours ago")
    - Highlight when data is stale
    - Check Lint & Build Errors
    - _Requirements: 10.4_

- [ ] 23. Manual price entry feature
  - [ ] 23.1 Implement manual price entry API
    - POST /api/v1/competitor-products/:id/manual-price
    - Validate price input
    - Store user and timestamp
    - Mark price as manual
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [ ] 23.2 Implement manual price entry UI
    - Add manual entry button on failed products
    - Create price entry modal
    - Display validation errors
    - Show confirmation on success
    - _Requirements: 13.1_

  - [ ] 23.3 Implement manual price indicators
    - Display distinct indicator for manual prices
    - Show who entered the price
    - Show when it was entered
    - _Requirements: 13.3, 13.4_

  - [ ] 23.4 Implement automated override logic
    - Check for manual prices during scraping
    - Replace manual price with scraped price on success
    - Maintain history of both types
    - Check Lint & Build Errors
    - _Requirements: 13.5, 13.6_

- [ ] 24. Last known good price feature
  - [ ] 24.1 Implement last known good storage
    - Store last successful price with timestamp
    - Update on each successful scrape
    - Maintain in competitor_products table
    - _Requirements: 14.1_

  - [ ] 24.2 Implement fallback display logic
    - Display last known good when current scrape fails
    - Calculate and display age
    - Show age indicator in UI
    - _Requirements: 14.2_

  - [ ] 24.3 Implement staleness detection
    - Compare age against configured threshold
    - Mark as stale when threshold exceeded
    - Display stale indicator in UI
    - Allow configuration of staleness threshold
    - _Requirements: 14.3, 14.4, 14.5_

  - [ ] 24.4 Implement price history maintenance
    - Continue storing price history during failures
    - Display historical trends
    - Show gaps in data collection
    - Check Lint & Build Errors
    - _Requirements: 14.6_

- [ ] 25. Configuration UI
  - [ ] 25.1 Create scraping configuration page
    - Display current configuration per site
    - Show preferred strategy
    - Show rate limits and timeouts
    - Show custom selectors
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ] 25.2 Implement configuration editing
    - Create edit form for each site
    - Validate inputs before submission
    - Display validation errors
    - Show success confirmation
    - _Requirements: 15.6_

  - [ ] 25.3 Implement configuration testing
    - Add "Test Configuration" button
    - Run test scrape with new configuration
    - Display test results
    - Allow saving only if test succeeds
    - _Requirements: 15.1_

  - [ ] 25.4 Implement configuration history
    - Display configuration change history
    - Show who made changes and when
    - Show old and new values
    - Allow reverting to previous configuration
    - Check Lint & Build Errors
    - _Requirements: 15.7_

- [ ] 26. Background jobs and scheduling
  - [ ] 26.1 Implement scraping scheduler
    - Create cron job for scheduled scraping
    - Queue scrape requests for all competitor products
    - Respect rate limits and distribute over time
    - _Requirements: 4.5_

  - [ ] 26.2 Implement metric aggregation job
    - Create hourly rollup job
    - Aggregate scrape attempts into metrics
    - Calculate success rates and averages
    - Store in scraping_metrics table
    - _Requirements: 9.2_

  - [ ] 26.3 Implement log cleanup job
    - Create daily cleanup job
    - Delete logs older than retention period
    - Delete old screenshots
    - Maintain different retention for different log types
    - _Requirements: 8.6_

  - [ ] 26.4 Implement alert monitoring job
    - Create periodic threshold check job
    - Check success rates against thresholds
    - Trigger alerts when thresholds breached
    - Send recovery notifications
    - _Requirements: 9.4, 12.1, 12.7_

  - [ ] 26.5 Implement cookie cleanup job
    - Create periodic session cleanup job
    - Remove expired cookies
    - Clean up stale sessions
    - Check Lint & Build Errors
    - _Requirements: 5.4_

- [ ] 27. Integration with existing scraping system
  - [ ] 27.1 Update existing scraper to use new orchestrator
    - Replace direct scraping calls with ScrapeOrchestrator
    - Pass competitor product info to orchestrator
    - Handle ScrapeResult responses
    - Update database with results
    - _Requirements: 1.7, 8.1_

  - [ ] 27.2 Implement strategy adaptation
    - Track scraping success patterns
    - Update site configuration based on patterns
    - Automatically switch to headless browser when needed
    - _Requirements: 6.6_

  - [ ] 27.3 Update competitor product display
    - Show protection status
    - Display error messages
    - Show last known good prices
    - Add manual entry option
    - Check Lint & Build Errors
    - _Requirements: 10.1, 10.4, 13.1, 14.2_

- [ ] 28. Final checkpoint - Complete system integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 29. Documentation
  - [ ] 29.1 Create API documentation
    - Document all new endpoints with OpenAPI/Swagger
    - Include request/response examples
    - Document error codes
    - Document rate limits
    - _Requirements: All API endpoints_

  - [ ] 29.2 Create configuration guide
    - Document per-site configuration options
    - Explain strategy selection
    - Document selector customization
    - Provide proxy setup instructions
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ] 29.3 Create troubleshooting guide
    - Document common scraping failures
    - Explain protection type meanings
    - Provide resolution steps
    - Document log analysis
    - _Requirements: 10.1, 10.2_

  - [ ] 29.4 Create user guide
    - Explain site status indicators
    - Document manual price entry
    - Explain last known good prices
    - Document monitoring dashboard
    - Check Lint & Build Errors
    - _Requirements: 10.6, 13.1, 14.2, 11.1_

## Notes

- All tasks reference specific requirements for traceability
- Checkpoints ensure incremental validation
- Tasks are ordered to build functionality bottom-up
- Each task is focused on specific, testable functionality
- Integration happens after core components are complete
- Documentation is created last when all features are stable
