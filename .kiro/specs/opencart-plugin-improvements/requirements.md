# Requirements Document: OpenCart Plugin Improvements

## Introduction

This specification covers comprehensive improvements to the PricePilot OpenCart plugin, addressing security vulnerabilities, enhancing core functionality, and adding advanced features. The improvements are organized by priority level (Critical, High, Medium, Low) to ensure systematic implementation of security fixes, stability enhancements, and feature additions.

The plugin enables integration between OpenCart e-commerce stores and the PricePilot pricing automation system, allowing automated price synchronization, product data exchange, and real-time monitoring of pricing changes.

## Glossary

- **Plugin**: The PricePilot OpenCart extension module
- **API_Controller**: The catalog/controller/api/pricepilot.php controller handling API requests
- **Admin_Controller**: The admin/controller/extension/module/pricepilot.php controller managing admin interface
- **Authentication_System**: The token-based authentication mechanism for API access
- **Activity_Logger**: System component that records price changes and API interactions
- **Webhook_System**: Real-time notification system for product events
- **Rate_Limiter**: Component that throttles API requests to prevent abuse
- **Bulk_Update_Handler**: Component that processes multiple product updates in a single request
- **Product_Mapper**: Component that maps OpenCart products to external competitor products
- **Store**: An OpenCart store instance (supports multi-store installations)
- **Product_Variant**: Product options and combinations (size, color, etc.)
- **Special_Price**: Temporary discounted price with date range
- **API_Token**: 64-character hexadecimal authentication token
- **Prepared_Statement**: SQL query with parameterized inputs to prevent injection
- **HTTP_Status_Code**: Standard HTTP response codes (200, 400, 401, 404, 500)
- **Webhook_Event**: Product lifecycle event (create, update, delete)
- **Queue_System**: Background job processing system for long-running tasks
- **OCMOD**: OpenCart Modification system for installing extensions

## Requirements

### Requirement 1: SQL Injection Prevention

**User Story:** As a system administrator, I want all database queries to use prepared statements, so that the plugin is protected against SQL injection attacks.

#### Acceptance Criteria

1. WHEN the API_Controller receives any user input, THE Plugin SHALL use prepared statements or escaped parameters for all database queries
2. WHEN the update endpoint processes product_id or price parameters, THE Plugin SHALL validate and escape all inputs before database operations
3. THE Plugin SHALL NOT concatenate user input directly into SQL query strings
4. WHEN any database query is executed, THE Plugin SHALL use OpenCart's built-in escape methods or parameterized queries
5. FOR ALL API endpoints, THE Plugin SHALL sanitize input data before processing

### Requirement 2: Input Validation and Sanitization

**User Story:** As a security engineer, I want comprehensive input validation on all API endpoints, so that invalid or malicious data is rejected before processing.

#### Acceptance Criteria

1. WHEN the API receives a product_id parameter, THE Plugin SHALL validate it is a positive integer
2. WHEN the API receives a price parameter, THE Plugin SHALL validate it is a valid decimal number with maximum 4 decimal places
3. WHEN the API receives an api_token parameter, THE Plugin SHALL validate it matches the expected 64-character hexadecimal format
4. WHEN request payload size exceeds 1MB, THE Plugin SHALL reject the request with HTTP 413 status
5. WHEN any required parameter is missing, THE Plugin SHALL return HTTP 400 with descriptive error message
6. WHEN any parameter contains invalid data type, THE Plugin SHALL return HTTP 400 with field-specific error details

### Requirement 3: Rate Limiting and Abuse Prevention

**User Story:** As a system administrator, I want API rate limiting, so that the server is protected from abuse and excessive requests.

#### Acceptance Criteria

1. WHEN an IP address makes more than 100 requests within 60 seconds, THE Rate_Limiter SHALL reject subsequent requests with HTTP 429 status
2. WHEN a rate limit is exceeded, THE Plugin SHALL return a Retry-After header indicating when requests can resume
3. THE Rate_Limiter SHALL track request counts per IP address in memory or cache
4. WHEN the rate limit window expires, THE Rate_Limiter SHALL reset the counter for that IP address
5. WHERE rate limiting is enabled in configuration, THE Plugin SHALL enforce limits on all API endpoints

### Requirement 4: Token Security Enhancement

**User Story:** As a security administrator, I want enhanced token management features, so that API access can be controlled and rotated securely.

#### Acceptance Criteria

1. WHEN an administrator clicks "Regenerate Token" in the admin panel, THE Admin_Controller SHALL generate a new 64-character random token
2. WHEN a token is regenerated, THE Plugin SHALL invalidate the previous token immediately
3. THE Admin_Controller SHALL display the token creation date in the admin interface
4. WHERE IP whitelist is configured, THE Authentication_System SHALL reject requests from non-whitelisted IP addresses with HTTP 403 status
5. WHEN a token is created or regenerated, THE Plugin SHALL log the event with timestamp and admin user information

### Requirement 5: Structured Error Handling

**User Story:** As an API consumer, I want structured error responses with appropriate HTTP status codes, so that I can handle errors programmatically.

#### Acceptance Criteria

1. WHEN an API request succeeds, THE Plugin SHALL return HTTP 200 status with success response
2. WHEN authentication fails, THE Plugin SHALL return HTTP 401 status with error message
3. WHEN a requested resource is not found, THE Plugin SHALL return HTTP 404 status with error message
4. WHEN input validation fails, THE Plugin SHALL return HTTP 400 status with field-specific error details
5. WHEN an internal error occurs, THE Plugin SHALL return HTTP 500 status with generic error message
6. FOR ALL error responses, THE Plugin SHALL return JSON format with "error" field containing descriptive message
7. WHEN an error occurs, THE Plugin SHALL log the error details including stack trace for debugging

### Requirement 6: API Request and Response Logging

**User Story:** As a system administrator, I want comprehensive API logging, so that I can monitor usage, debug issues, and detect security threats.

#### Acceptance Criteria

1. WHEN any API endpoint is called, THE Activity_Logger SHALL record the endpoint path, HTTP method, and timestamp
2. WHEN an API request is received, THE Activity_Logger SHALL record the client IP address and request payload
3. WHEN an API response is sent, THE Activity_Logger SHALL record the HTTP status code and response time
4. WHEN authentication fails, THE Activity_Logger SHALL record the failed attempt with IP address and timestamp
5. THE Activity_Logger SHALL store logs in the pricepilot_api_logs database table
6. WHEN log entries are older than 90 days, THE Plugin SHALL provide a cleanup mechanism to archive or delete old logs

### Requirement 7: Bulk Price Update API

**User Story:** As a pricing automation system, I want to update multiple product prices in a single request, so that I can efficiently synchronize prices for large catalogs.

#### Acceptance Criteria

1. WHEN a POST request is sent to /api/pricepilot/bulk-update with an array of products, THE Bulk_Update_Handler SHALL process all updates
2. WHEN the bulk update completes, THE Plugin SHALL return a summary with success count and failure count
3. WHEN any individual product update fails, THE Plugin SHALL continue processing remaining products and include failure details in response
4. WHEN the bulk update array contains more than 1000 products, THE Plugin SHALL reject the request with HTTP 413 status
5. FOR ALL successful updates in a bulk operation, THE Activity_Logger SHALL record each price change individually
6. WHEN a bulk update is processed, THE Plugin SHALL clear the product cache after all updates complete

### Requirement 8: Product Search and Filter API

**User Story:** As an API consumer, I want to search and filter products by various criteria, so that I can retrieve specific product subsets efficiently.

#### Acceptance Criteria

1. WHEN a filter parameter "sku" is provided, THE API_Controller SHALL return only products matching that SKU
2. WHEN a filter parameter "category_id" is provided, THE API_Controller SHALL return only products in that category
3. WHEN a filter parameter "manufacturer_id" is provided, THE API_Controller SHALL return only products from that manufacturer
4. WHEN a filter parameter "status" is provided, THE API_Controller SHALL return only products with that status (enabled/disabled)
5. WHEN a search parameter "name" is provided, THE API_Controller SHALL return products with names containing the search term
6. WHEN pagination parameters are used, THE Plugin SHALL return total product count in the response
7. WHEN multiple filters are applied, THE Plugin SHALL combine them with AND logic

### Requirement 9: Webhook Support for Real-Time Notifications

**User Story:** As a pricing automation system, I want to receive real-time notifications when products change, so that I can react immediately to inventory updates.

#### Acceptance Criteria

1. WHEN a product is created in OpenCart, THE Webhook_System SHALL send a POST request to configured webhook URLs with product data
2. WHEN a product is updated in OpenCart, THE Webhook_System SHALL send a POST request to configured webhook URLs with updated product data
3. WHEN a product is deleted in OpenCart, THE Webhook_System SHALL send a POST request to configured webhook URLs with product_id
4. WHEN a webhook delivery fails, THE Webhook_System SHALL retry up to 3 times with exponential backoff
5. THE Admin_Controller SHALL provide an interface to configure webhook URLs and select which events to monitor
6. WHEN a webhook is configured, THE Plugin SHALL validate the URL format before saving
7. THE Webhook_System SHALL include a signature header in webhook requests for verification

### Requirement 10: Stock Synchronization API

**User Story:** As an inventory management system, I want to synchronize product stock quantities, so that inventory levels remain accurate across systems.

#### Acceptance Criteria

1. WHEN the product list API is called, THE Plugin SHALL include the quantity field for each product
2. WHEN a POST request is sent to /api/pricepilot/stock-update with product_id and quantity, THE Plugin SHALL update the product stock level
3. WHEN stock quantity reaches zero, THE Plugin SHALL mark the product as out of stock
4. WHEN stock is updated, THE Activity_Logger SHALL record the change with old and new quantity values
5. THE Plugin SHALL support bulk stock updates similar to bulk price updates

### Requirement 11: Admin Dashboard with Statistics

**User Story:** As a store administrator, I want a dashboard showing sync statistics and recent activity, so that I can monitor the plugin's operation at a glance.

#### Acceptance Criteria

1. WHEN the admin dashboard loads, THE Admin_Controller SHALL display the timestamp of the last successful API sync
2. WHEN the admin dashboard loads, THE Admin_Controller SHALL display the total number of products in the store
3. WHEN the admin dashboard loads, THE Admin_Controller SHALL display the count of price updates made today
4. WHEN the admin dashboard loads, THE Admin_Controller SHALL display the 10 most recent price changes with product name, old price, new price, and timestamp
5. WHEN the admin dashboard loads, THE Admin_Controller SHALL display API usage statistics including total requests today and average response time
6. THE Admin_Controller SHALL refresh statistics when the page is reloaded

### Requirement 12: Activity Log with Filtering

**User Story:** As a store administrator, I want to view a detailed log of all price changes, so that I can audit pricing history and track changes over time.

#### Acceptance Criteria

1. WHEN the activity log page loads, THE Admin_Controller SHALL display all price changes from the pricepilot_activity_log table
2. WHEN a date range filter is applied, THE Admin_Controller SHALL display only price changes within that date range
3. WHEN a product filter is applied, THE Admin_Controller SHALL display only price changes for that specific product
4. WHEN viewing the activity log, THE Admin_Controller SHALL display product name, old price, new price, change source, and timestamp for each entry
5. THE Admin_Controller SHALL paginate activity log results with 50 entries per page
6. THE Admin_Controller SHALL provide an export button to download activity log as CSV

### Requirement 13: API Connection Testing

**User Story:** As a store administrator, I want to test the API connection, so that I can verify the plugin is configured correctly.

#### Acceptance Criteria

1. WHEN the administrator clicks "Test API Connection" button, THE Admin_Controller SHALL make a test request to the API endpoint
2. WHEN the test succeeds, THE Admin_Controller SHALL display a success message with green indicator
3. WHEN the test fails, THE Admin_Controller SHALL display an error message with red indicator and failure reason
4. WHEN the test is performed, THE Admin_Controller SHALL verify the token is valid and the API endpoint is accessible
5. THE Admin_Controller SHALL display the API endpoint URL being tested

### Requirement 14: Token Management Interface

**User Story:** As a store administrator, I want an improved token management interface, so that I can easily view, copy, and regenerate API tokens.

#### Acceptance Criteria

1. WHEN the admin panel loads, THE Admin_Controller SHALL display the current API token in a read-only field
2. WHEN the administrator clicks "Copy Token" button, THE Admin_Controller SHALL copy the token to clipboard and show confirmation message
3. WHEN the administrator clicks "Regenerate Token" button, THE Admin_Controller SHALL prompt for confirmation before regenerating
4. WHEN a token is regenerated, THE Admin_Controller SHALL display the new token and show a warning that the old token is now invalid
5. THE Admin_Controller SHALL display the token creation date below the token field

### Requirement 15: Multi-Store Support

**User Story:** As a multi-store operator, I want the plugin to support multiple OpenCart stores, so that I can manage pricing across all my stores from a single integration.

#### Acceptance Criteria

1. WHEN the API is called with a store_id parameter, THE Plugin SHALL return products only from that specific store
2. WHEN updating prices with a store_id parameter, THE Plugin SHALL update prices only in the specified store
3. WHERE no store_id is provided, THE Plugin SHALL default to the primary store
4. THE Admin_Controller SHALL display a store selector dropdown when multiple stores are configured
5. WHEN webhooks are triggered, THE Webhook_System SHALL include the store_id in the webhook payload

### Requirement 16: Product Variant Handling

**User Story:** As a pricing manager, I want to manage prices for product variants, so that I can set different prices for different sizes, colors, or configurations.

#### Acceptance Criteria

1. WHEN the product list API is called, THE Plugin SHALL include product options and variants for each product
2. WHEN updating a variant price, THE Plugin SHALL accept option_id and option_value_id parameters to identify the specific variant
3. WHEN a variant price is updated, THE Activity_Logger SHALL record which variant was changed
4. THE Plugin SHALL return variant-specific pricing in the product list response
5. WHEN a product has no variants, THE Plugin SHALL handle it as a simple product without option data

### Requirement 17: Product Image Synchronization

**User Story:** As a content manager, I want product images to be synchronized, so that external systems have access to current product imagery.

#### Acceptance Criteria

1. WHEN the product list API is called, THE Plugin SHALL include the main product image URL for each product
2. WHEN the product list API is called with include_images=all parameter, THE Plugin SHALL include all product images
3. THE Plugin SHALL return absolute URLs for all image paths
4. WHEN a product has no image, THE Plugin SHALL return null for the image field
5. THE Plugin SHALL support updating product images via API with image URL parameter

### Requirement 18: Category Mapping and Synchronization

**User Story:** As a catalog manager, I want category information synchronized, so that products can be organized consistently across systems.

#### Acceptance Criteria

1. WHEN the product list API is called, THE Plugin SHALL include all category IDs and names for each product
2. THE Plugin SHALL provide an endpoint to retrieve the complete category tree structure
3. WHEN categories are retrieved, THE Plugin SHALL include parent-child relationships
4. THE Plugin SHALL support updating product categories via API
5. WHEN a product is assigned to multiple categories, THE Plugin SHALL return all category associations

### Requirement 19: Advanced Pricing with Special Prices

**User Story:** As a pricing manager, I want to manage special promotional prices, so that I can run time-limited sales and discounts.

#### Acceptance Criteria

1. WHEN the product list API is called, THE Plugin SHALL include special price and date range if configured
2. WHEN updating a special price, THE Plugin SHALL accept price, date_start, and date_end parameters
3. WHEN a special price date range expires, THE Plugin SHALL automatically revert to the regular price
4. THE Plugin SHALL support customer group-specific pricing where configured
5. WHEN special prices are active, THE Plugin SHALL return both regular price and special price in API responses

### Requirement 20: Admin Notification System

**User Story:** As a store administrator, I want to receive notifications about sync failures and important events, so that I can respond quickly to issues.

#### Acceptance Criteria

1. WHEN a bulk update fails completely, THE Plugin SHALL send an email notification to the configured admin email
2. WHEN API authentication fails more than 10 times in 5 minutes, THE Plugin SHALL send a security alert email
3. THE Admin_Controller SHALL display in-dashboard notifications for recent errors
4. THE Admin_Controller SHALL provide settings to configure which events trigger email notifications
5. WHEN a webhook delivery fails after all retries, THE Plugin SHALL create an admin notification

### Requirement 21: Price Backup and Restore

**User Story:** As a store administrator, I want to backup prices before bulk updates, so that I can restore previous prices if needed.

#### Acceptance Criteria

1. WHEN a bulk price update is initiated, THE Plugin SHALL create a backup of current prices before applying changes
2. THE Admin_Controller SHALL provide a "Restore Prices" interface showing available backup timestamps
3. WHEN a restore is initiated, THE Plugin SHALL revert all product prices to the selected backup
4. THE Plugin SHALL retain price backups for 30 days before automatic deletion
5. THE Admin_Controller SHALL display a confirmation dialog before restoring prices

### Requirement 22: Product Mapping to Competitors

**User Story:** As a competitive pricing analyst, I want to map my products to competitor products, so that I can track competitive pricing relationships.

#### Acceptance Criteria

1. THE Admin_Controller SHALL provide an interface to add competitor URLs for each product
2. WHEN a product mapping is saved, THE Plugin SHALL store it in the pricepilot_product_mapping table
3. THE Plugin SHALL support multiple competitor mappings per product
4. THE Admin_Controller SHALL display all competitor mappings for a product
5. THE Plugin SHALL provide an API endpoint to retrieve product mappings

### Requirement 23: Scheduled Synchronization

**User Story:** As a store administrator, I want to configure automatic sync schedules, so that pricing updates happen automatically at specified intervals.

#### Acceptance Criteria

1. THE Admin_Controller SHALL provide settings to configure sync intervals (hourly, daily, custom)
2. THE Admin_Controller SHALL provide settings to configure sync time windows (e.g., only between 2 AM - 4 AM)
3. THE Admin_Controller SHALL provide a pause/resume toggle for scheduled syncs
4. WHEN a scheduled sync runs, THE Activity_Logger SHALL record the sync execution and results
5. THE Admin_Controller SHALL display the next scheduled sync time

### Requirement 24: Reporting and Analytics

**User Story:** As a business analyst, I want to generate reports on pricing changes and sync activity, so that I can analyze pricing trends and system performance.

#### Acceptance Criteria

1. THE Admin_Controller SHALL provide a report generation interface with date range selection
2. WHEN a price change report is generated, THE Plugin SHALL include all price changes in the date range with statistics
3. WHEN a sync activity report is generated, THE Plugin SHALL include success/failure counts and performance metrics
4. THE Admin_Controller SHALL support exporting reports to CSV format
5. THE Admin_Controller SHALL support exporting reports to PDF format with charts

### Requirement 25: Unit Test Coverage

**User Story:** As a developer, I want comprehensive unit tests, so that code changes can be validated automatically and regressions prevented.

#### Acceptance Criteria

1. THE Plugin SHALL include unit tests for all API endpoints
2. THE Plugin SHALL include unit tests for authentication logic
3. THE Plugin SHALL include unit tests for input validation functions
4. THE Plugin SHALL include unit tests for rate limiting logic
5. WHEN tests are executed, THE Plugin SHALL achieve minimum 80% code coverage

### Requirement 26: Code Refactoring and Architecture

**User Story:** As a developer, I want clean, maintainable code architecture, so that the plugin is easy to understand, modify, and extend.

#### Acceptance Criteria

1. THE Plugin SHALL separate business logic from controller classes into service classes
2. THE Plugin SHALL follow OpenCart coding standards and conventions
3. THE Plugin SHALL use dependency injection where appropriate
4. THE Plugin SHALL include inline documentation for all public methods
5. THE Plugin SHALL organize code into logical namespaces and directories

### Requirement 27: Caching for Performance

**User Story:** As a system administrator, I want intelligent caching, so that API responses are fast and database load is minimized.

#### Acceptance Criteria

1. WHEN product lists are requested, THE Plugin SHALL cache results for 5 minutes
2. WHEN configuration settings are accessed, THE Plugin SHALL cache them for 1 hour
3. WHEN any product is updated, THE Plugin SHALL invalidate the product list cache
4. WHEN configuration is changed, THE Plugin SHALL invalidate the configuration cache
5. THE Plugin SHALL use OpenCart's built-in cache system for all caching operations

### Requirement 28: Database Query Optimization

**User Story:** As a performance engineer, I want optimized database queries, so that API responses are fast even with large product catalogs.

#### Acceptance Criteria

1. THE Plugin SHALL add database indexes on product_id columns in all custom tables
2. THE Plugin SHALL use JOIN operations instead of multiple separate queries where possible
3. WHEN fetching product lists, THE Plugin SHALL use LIMIT and OFFSET for pagination efficiently
4. THE Plugin SHALL avoid N+1 query problems by using batch loading
5. WHEN queries are executed, THE Plugin SHALL use OpenCart's query builder for optimization

### Requirement 29: Background Queue System

**User Story:** As a system administrator, I want long-running operations processed in the background, so that API requests don't timeout.

#### Acceptance Criteria

1. WHEN a bulk update contains more than 100 products, THE Plugin SHALL queue the operation for background processing
2. WHEN a queued job is processing, THE Admin_Controller SHALL display the job status and progress
3. WHEN a queued job completes, THE Plugin SHALL send a notification to the administrator
4. THE Plugin SHALL process queued jobs using cron or OpenCart's task scheduler
5. WHEN a queued job fails, THE Plugin SHALL retry up to 3 times before marking as failed

### Requirement 30: OpenCart Version Compatibility

**User Story:** As a store administrator, I want the plugin to work with my OpenCart version, so that I can use it regardless of whether I'm on OpenCart 3.x or 4.x.

#### Acceptance Criteria

1. THE Plugin SHALL detect the OpenCart version on installation
2. THE Plugin SHALL be compatible with OpenCart 3.0 and later versions
3. THE Plugin SHALL be compatible with OpenCart 4.0 and later versions
4. WHEN installed on an unsupported version, THE Plugin SHALL display a clear error message
5. THE Plugin SHALL use version-appropriate APIs and methods for each OpenCart version

### Requirement 31: Database Schema Management

**User Story:** As a developer, I want automated database schema creation and migration, so that custom tables are created correctly during installation.

#### Acceptance Criteria

1. WHEN the plugin is installed, THE Plugin SHALL create the pricepilot_activity_log table if it doesn't exist
2. WHEN the plugin is installed, THE Plugin SHALL create the pricepilot_api_logs table if it doesn't exist
3. WHEN the plugin is installed, THE Plugin SHALL create the pricepilot_product_mapping table if it doesn't exist
4. WHEN the plugin is installed, THE Plugin SHALL create the pricepilot_webhooks table if it doesn't exist
5. WHEN the plugin is upgraded, THE Plugin SHALL run migration scripts to update table schemas without data loss
6. THE Plugin SHALL create appropriate indexes on all custom tables for query performance

### Requirement 32: Comprehensive Documentation

**User Story:** As a new user, I want clear documentation, so that I can install, configure, and use the plugin without external support.

#### Acceptance Criteria

1. THE Plugin SHALL include a README.md file with installation instructions for manual and OCMOD installation
2. THE Plugin SHALL include a README.md file with configuration steps and screenshots
3. THE Plugin SHALL include a README.md file with API endpoint documentation and examples
4. THE Plugin SHALL include a README.md file with troubleshooting guide for common issues
5. THE Plugin SHALL include a CHANGELOG.md file documenting all version changes
6. THE Plugin SHALL include API documentation with request/response examples for all endpoints
7. THE Plugin SHALL include API documentation with error code reference
8. THE Plugin SHALL include API documentation with authentication guide

### Requirement 33: Parser and Serializer for API Payloads

**User Story:** As a developer, I want robust JSON parsing and serialization, so that API payloads are handled correctly and consistently.

#### Acceptance Criteria

1. WHEN the API receives JSON input, THE Plugin SHALL parse it into PHP data structures
2. WHEN the API sends responses, THE Plugin SHALL serialize PHP data structures into valid JSON
3. WHEN JSON parsing fails, THE Plugin SHALL return HTTP 400 with descriptive error message
4. THE Plugin SHALL include a pretty printer for formatting JSON responses in debug mode
5. FOR ALL valid API response objects, parsing then serializing then parsing SHALL produce an equivalent object (round-trip property)
