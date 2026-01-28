# Implementation Plan: OpenCart Plugin Improvements

## Overview

This implementation plan transforms the PricePilot OpenCart plugin from a basic price synchronization tool into a secure, robust, and feature-rich integration platform. The tasks are organized by priority level (Critical, High, Medium) to ensure security vulnerabilities are addressed first, followed by core functionality and advanced features.

The implementation follows a phased approach:
1. **Phase 1 (Critical)**: Security fixes and foundational architecture
2. **Phase 2 (High)**: Core API enhancements and admin improvements
3. **Phase 3 (Medium)**: Advanced features and multi-store support

Each task builds incrementally on previous work, with regular checkpoints to ensure stability.

## Tasks

### Phase 1: Critical Priority - Security and Foundation

- [x] 1. Create service layer architecture and base classes
  - Create `catalog/model/extension/pricepilot/` directory for service classes
  - Create base `Service` class with common dependencies (database, cache, config)
  - Set up dependency injection pattern for services
  - _Requirements: 26.1, 26.2_

- [x] 2. Implement ValidationService with comprehensive input validation
  - [x] 2.1 Create ValidationService class with validation methods
    - Implement `validateProductId()` method with positive integer check
    - Implement `validatePrice()` method with decimal and range validation
    - Implement `validateTokenFormat()` method with hex format check
    - Implement `validatePayloadSize()` method with 1MB limit check
    - Implement `validateBulkUpdate()` method with array validation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_
  
  - [ ]* 2.2 Write property tests for ValidationService
    - **Property 1: Invalid Product IDs Are Rejected**
    - **Property 2: Invalid Prices Are Rejected**
    - **Property 3: Invalid Token Format Is Rejected**
    - **Property 5: Invalid Data Types Are Rejected**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.6**
  
  - [ ]* 2.3 Write unit tests for edge cases
    - Test boundary values (0, negative, max int)
    - Test null and undefined inputs
    - Test special characters and SQL injection attempts
    - _Requirements: 2.1, 2.2, 2.3_


- [x] 3. Implement AuthenticationService with secure token handling
  - [x] 3.1 Create AuthenticationService class
    - Implement `validateToken()` with constant-time comparison
    - Implement `generateToken()` using random_bytes()
    - Implement `isIpWhitelisted()` with IP range support
    - Implement `logAuthAttempt()` for security monitoring
    - _Requirements: 4.1, 4.2, 4.4, 4.5_
  
  - [ ]* 3.2 Write property tests for authentication
    - **Property 9: Authentication Failures Return HTTP 401**
    - **Validates: Requirements 5.2**
  
  - [ ]* 3.3 Write unit tests for token security
    - Test token generation entropy
    - Test constant-time comparison
    - Test IP whitelist matching
    - _Requirements: 4.1, 4.2, 4.4_

- [x] 4. Refactor API controller to use prepared statements
  - [x] 4.1 Update product update endpoint with prepared statements
    - Replace direct SQL concatenation with prepared statements
    - Use `$this->db->escape()` for all user inputs
    - Add parameter binding for product_id and price
    - _Requirements: 1.1, 1.2, 1.4_
  
  - [ ]* 4.2 Write security tests for SQL injection prevention
    - Test with SQL injection payloads
    - Verify prepared statements are used
    - Test with special characters
    - _Requirements: 1.1, 1.2_


- [x] 5. Implement RateLimitService with request throttling
  - [x] 5.1 Create RateLimitService class
    - Implement `checkLimit()` with sliding window algorithm
    - Implement `recordRequest()` using cache with TTL
    - Implement `resetLimit()` for manual reset
    - Use cache key format: `ratelimit_{ip}_{endpoint}_{window}`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ]* 5.2 Write property tests for rate limiting
    - **Property 6: Rate Limiting Enforces Request Limits**
    - **Property 7: Rate Limit Counters Reset After Window**
    - **Validates: Requirements 3.1, 3.2, 3.4**
  
  - [ ]* 5.3 Write unit tests for rate limiting scenarios
    - Test request counting accuracy
    - Test window expiration
    - Test Retry-After header calculation
    - _Requirements: 3.1, 3.2, 3.4_

- [x] 6. Implement structured error handling with HTTP status codes
  - [x] 6.1 Create error response helper methods
    - Create `sendErrorResponse()` method with status code and error structure
    - Create error code constants (INVALID_PARAMETER, AUTH_FAILED, etc.)
    - Implement JSON error response formatting
    - Add error logging for all error responses
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [ ]* 6.2 Write property tests for HTTP status codes
    - **Property 8: Successful Requests Return HTTP 200**
    - **Property 10: Not Found Resources Return HTTP 404**
    - **Property 11: Validation Failures Return HTTP 400**
    - **Property 12: Internal Errors Return HTTP 500**
    - **Property 13: All Error Responses Include Error Field**
    - **Validates: Requirements 5.1, 5.3, 5.4, 5.5, 5.6**


- [x] 7. Create database schema for custom tables
  - [x] 7.1 Create migration script for pricepilot_activity_log table
    - Add log_id, product_id, product_name, old_price, new_price, changed_by, store_id, date_added columns
    - Add indexes on product_id, date_added, store_id
    - _Requirements: 31.1_
  
  - [x] 7.2 Create migration script for pricepilot_api_logs table
    - Add log_id, endpoint, method, ip_address, request_data, response_code, response_time, date_added columns
    - Add indexes on date_added, ip_address, endpoint
    - _Requirements: 31.2_
  
  - [x] 7.3 Create migration script for pricepilot_product_mapping table
    - Add mapping_id, product_id, competitor_url, competitor_name, date_added, date_modified columns
    - Add index on product_id and unique constraint on product_id + competitor_url
    - _Requirements: 31.3_
  
  - [x] 7.4 Create migration script for pricepilot_webhooks table
    - Add webhook_id, url, events, secret, status, date_added, date_modified columns
    - Add index on status
    - _Requirements: 31.4_
  
  - [x] 7.5 Create migration script for pricepilot_queue table
    - Add job_id, job_type, job_data, status, progress, result, retry_count, priority, date_added, date_started, date_completed columns
    - Add indexes on status, priority, date_added
    - _Requirements: 31.5_
  
  - [x] 7.6 Create migration script for pricepilot_price_backups table
    - Add backup_id, backup_data, product_count, created_by, date_added columns
    - Add index on date_added
    - _Requirements: 31.5_

- [x] 8. Implement LoggingService for activity and API logging
  - [x] 8.1 Create LoggingService class
    - Implement `logPriceChange()` method
    - Implement `logApiRequest()` method with response time tracking
    - Implement `getActivityLog()` with filtering and pagination
    - Implement `getApiStatistics()` for dashboard
    - Implement `cleanOldLogs()` for retention management
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [ ]* 8.2 Write unit tests for logging
    - Test log entry creation
    - Test filtering and pagination
    - Test statistics calculation
    - Test log cleanup
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_


- [x] 9. Checkpoint - Security foundation complete
  - Verify all security services are working
  - Run all property tests for validation, authentication, rate limiting
  - Verify database tables are created with proper indexes
  - Ensure all tests pass, ask the user if questions arise

### Phase 2: High Priority - Core API Enhancements

- [x] 10. Implement ProductService for data retrieval
  - [x] 10.1 Create ProductService class
    - Implement `getProducts()` with filters and pagination
    - Implement `getProduct()` for single product retrieval
    - Implement `searchProducts()` with name search
    - Implement `getProductWithVariants()` for variant data
    - Add caching with 5-minute TTL
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 27.1_
  
  - [ ]* 10.2 Write property tests for product filtering
    - **Property 17: SKU Filter Returns Matching Products**
    - **Property 18: Category Filter Returns Matching Products**
    - **Property 19: Manufacturer Filter Returns Matching Products**
    - **Property 20: Status Filter Returns Matching Products**
    - **Property 21: Name Search Returns Matching Products**
    - **Property 22: Multiple Filters Use AND Logic**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.7**
  
  - [ ]* 10.3 Write unit tests for product service
    - Test pagination logic
    - Test cache hit/miss scenarios
    - Test variant data retrieval
    - _Requirements: 8.1, 8.6_

- [x] 11. Implement PriceService for price operations
  - [x] 11.1 Create PriceService class
    - Implement `updatePrice()` with validation and logging
    - Implement `bulkUpdatePrices()` with batch processing
    - Implement `updateStock()` with out-of-stock handling
    - Implement `updateSpecialPrice()` with date validation
    - Implement `createPriceBackup()` for backup creation
    - Implement `restorePriceBackup()` for restoration
    - _Requirements: 7.1, 7.2, 7.3, 7.6, 10.2, 10.3, 10.4, 19.2, 21.1, 21.3_


  - [ ]* 11.2 Write property tests for price operations
    - **Property 14: Bulk Updates Process All Products**
    - **Property 15: Bulk Updates Continue After Individual Failures**
    - **Property 16: Bulk Updates Invalidate Cache**
    - **Property 24: Stock Updates Modify Quantity**
    - **Property 28: Product Updates Invalidate Cache**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.6, 10.2, 27.3**
  
  - [ ]* 11.3 Write unit tests for price service
    - Test price update with logging
    - Test bulk update summary calculation
    - Test stock update with zero quantity
    - Test special price date validation
    - Test backup creation and restoration
    - _Requirements: 7.1, 7.2, 10.2, 10.3, 19.2, 21.1, 21.3_

- [x] 12. Update API controller with new endpoints
  - [x] 12.1 Refactor existing endpoints to use services
    - Update index() to use ProductService
    - Update update() to use PriceService and ValidationService
    - Add authentication check using AuthenticationService
    - Add rate limiting using RateLimitService
    - Add structured error responses
    - _Requirements: 1.1, 2.1, 2.2, 3.1, 5.1, 5.2, 5.3, 5.4_
  
  - [x] 12.2 Add bulk update endpoint
    - Create bulkUpdate() method
    - Validate bulk update array using ValidationService
    - Process updates using PriceService
    - Return success/failure summary
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [x] 12.3 Add stock update endpoint
    - Create stockUpdate() method
    - Validate stock parameters
    - Update stock using PriceService
    - Handle out-of-stock status
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ]* 12.4 Write integration tests for API endpoints
    - Test complete request/response flow
    - Test authentication integration
    - Test rate limiting integration
    - Test error handling integration
    - _Requirements: 1.1, 2.1, 3.1, 5.1, 7.1, 10.2_


- [x] 13. Implement WebhookService for event notifications
  - [x] 13.1 Create WebhookService class
    - Implement `triggerEvent()` to identify and send webhooks
    - Implement `sendWebhook()` with retry logic and HMAC signature
    - Implement `getWebhooksForEvent()` to retrieve configurations
    - Implement `validateWebhookUrl()` for URL validation
    - Add 5-second timeout and 3 retry attempts with exponential backoff
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 9.7_
  
  - [ ]* 13.2 Write unit tests for webhook service
    - Test webhook payload generation
    - Test HMAC signature generation
    - Test retry logic with failures
    - Test URL validation
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 9.7_

- [x] 14. Implement QueueService for background processing
  - [x] 14.1 Create QueueService class
    - Implement `enqueue()` to add jobs to queue
    - Implement `processNext()` to process queued jobs
    - Implement `getJobStatus()` for status tracking
    - Implement `cancelJob()` for job cancellation
    - Add job retry logic (max 3 attempts)
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5_
  
  - [ ]* 14.2 Write unit tests for queue service
    - Test job enqueueing
    - Test job processing
    - Test status tracking
    - Test retry logic
    - Test job cancellation
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5_

- [x] 15. Create admin dashboard with statistics
  - [x] 15.1 Update admin controller with dashboard view
    - Add dashboard() method to display statistics
    - Show last sync timestamp using LoggingService
    - Show total product count using ProductService
    - Show today's update count using LoggingService
    - Show 10 most recent price changes using LoggingService
    - Show API usage statistics using LoggingService
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  
  - [x] 15.2 Create dashboard view template
    - Create Twig template with statistics display
    - Add charts for API usage trends
    - Add recent activity table
    - Add refresh button
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_


- [x] 16. Create activity log viewer in admin panel
  - [x] 16.1 Add activity log page to admin controller
    - Create activityLog() method with filtering
    - Support date range filtering
    - Support product filtering
    - Implement pagination (50 entries per page)
    - Add CSV export functionality
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  
  - [x] 16.2 Create activity log view template
    - Create Twig template with filter form
    - Add sortable table for log entries
    - Add pagination controls
    - Add export button
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 17. Add API connection testing feature
  - [x] 17.1 Add test connection method to admin controller
    - Create testConnection() method
    - Make test API request to verify endpoint
    - Validate token and check response
    - Return success/failure status with details
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [x] 17.2 Add test button to admin interface
    - Add "Test API Connection" button to configuration page
    - Display success/failure indicator
    - Show API endpoint URL being tested
    - Show detailed error message on failure
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 18. Enhance token management interface
  - [x] 18.1 Update admin controller with token management
    - Add regenerateToken() method using AuthenticationService
    - Add copyToken() JavaScript functionality
    - Display token creation date
    - Add confirmation dialog for regeneration
    - Show warning about old token invalidation
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 4.1, 4.2, 4.3_
  
  - [x] 18.2 Update admin view template for token management
    - Add "Copy Token" button with clipboard functionality
    - Add "Regenerate Token" button with confirmation
    - Display token creation date
    - Add warning message about token security
    - _Requirements: 14.1, 14.2, 14.3, 14.4_


- [x] 19. Add webhook configuration interface
  - [x] 19.1 Create webhook management in admin controller
    - Add webhookList() method to display configured webhooks
    - Add webhookAdd() method to create new webhooks
    - Add webhookEdit() method to modify webhooks
    - Add webhookDelete() method to remove webhooks
    - Validate webhook URLs using WebhookService
    - _Requirements: 9.5, 9.6_
  
  - [x] 19.2 Create webhook management view templates
    - Create webhook list template
    - Create webhook add/edit form template
    - Add event selection checkboxes
    - Add URL validation feedback
    - _Requirements: 9.5, 9.6_

- [x] 20. Checkpoint - Core functionality complete
  - Verify all API endpoints are working with services
  - Run all property tests for filtering, bulk updates, caching
  - Verify admin dashboard displays correct statistics
  - Verify activity log and webhook configuration work
  - Ensure all tests pass, ask the user if questions arise

### Phase 3: Medium Priority - Advanced Features

- [x] 21. Implement product variant handling
  - [x] 21.1 Add variant support to ProductService
    - Update getProductWithVariants() to include all options
    - Include option_id, option_value_id, and price modifiers
    - Return variant-specific pricing
    - _Requirements: 16.1, 16.4_
  
  - [x] 21.2 Add variant price update to PriceService
    - Add updateVariantPrice() method
    - Accept option_id and option_value_id parameters
    - Log variant-specific price changes
    - _Requirements: 16.2, 16.3_
  
  - [ ]* 21.3 Write unit tests for variant handling
    - Test variant data retrieval
    - Test variant price updates
    - Test variant logging
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 22. Implement product image synchronization
  - [x] 22.1 Add image support to ProductService
    - Include main image URL in product list
    - Add include_images parameter for all images
    - Return absolute URLs for all images
    - Handle products with no images
    - _Requirements: 17.1, 17.2, 17.3, 17.4_
  
  - [x] 22.2 Add image update to PriceService
    - Add updateProductImage() method
    - Accept image URL parameter
    - Validate image URL format
    - _Requirements: 17.5_
  
  - [ ]* 22.3 Write unit tests for image synchronization
    - Test image URL generation
    - Test multiple image retrieval
    - Test image update
    - _Requirements: 17.1, 17.2, 17.5_

- [x] 23. Implement category mapping and synchronization
  - [x] 23.1 Add category support to ProductService
    - Include all category IDs and names in product list
    - Add getCategoryTree() method for full hierarchy
    - Include parent-child relationships
    - Handle multiple category assignments
    - _Requirements: 18.1, 18.2, 18.3, 18.5_
  
  - [x] 23.2 Add category update to PriceService
    - Add updateProductCategories() method
    - Accept array of category IDs
    - Validate category existence
    - _Requirements: 18.4_


- [x] 24. Implement advanced pricing with special prices
  - [x] 24.1 Add special price support to ProductService
    - Include special price and date range in product list
    - Return both regular and special price when active
    - Check date range for active special prices
    - _Requirements: 19.1, 19.5_
  
  - [x] 24.2 Enhance updateSpecialPrice in PriceService
    - Validate date_start and date_end parameters
    - Support customer group-specific pricing
    - Handle special price expiration
    - _Requirements: 19.2, 19.3, 19.4_
  
  - [ ]* 24.3 Write property tests for special pricing
    - **Property 25: Special Prices Included When Active**
    - **Validates: Requirements 19.1, 19.5**
  
  - [ ]* 24.4 Write unit tests for special pricing
    - Test date range validation
    - Test special price expiration
    - Test customer group pricing
    - _Requirements: 19.2, 19.3, 19.4_

- [x] 25. Implement admin notification system
  - [x] 25.1 Create NotificationService class
    - Implement sendEmailNotification() method
    - Implement createDashboardNotification() method
    - Add notification configuration settings
    - Support different notification types (failure, security, info)
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_
  
  - [x] 25.2 Integrate notifications with services
    - Add failure notifications to PriceService
    - Add security notifications to AuthenticationService
    - Add webhook failure notifications to WebhookService
    - _Requirements: 20.1, 20.2, 20.5_
  
  - [x] 25.3 Add notification display to admin dashboard
    - Show recent notifications in dashboard
    - Add notification settings page
    - Allow configuration of email recipients
    - Allow enabling/disabling notification types
    - _Requirements: 20.3, 20.4_

- [x] 26. Checkpoint - Advanced features complete
  - Verify variant, image, and category synchronization
  - Verify special pricing and notifications
  - Run all property tests
  - Ensure all tests pass, ask the user if questions arise

## Notes

- All tasks marked with `*` are optional testing tasks that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each phase
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- The implementation follows a phased approach prioritizing security first
- Services use dependency injection for testability
- All database operations use prepared statements
- Caching is implemented throughout for performance
- Background queue system handles long-running operations
- Comprehensive error handling with structured responses
