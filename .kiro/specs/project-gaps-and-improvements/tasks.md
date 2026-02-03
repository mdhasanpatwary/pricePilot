# Implementation Plan: Project Gaps and Improvements

## Overview

This implementation plan addresses critical gaps, inconsistencies, and missing features identified in the PricePilot project. The plan is organized into 4 phases over 4 weeks, prioritizing critical issues first while maintaining backward compatibility.

**Key Principles:**
- Fix issues without major refactoring
- Maintain existing functionality
- Security first approach
- Incremental deployment with rollback capability

---

## Phase 1: Critical Fixes (Week 1)

### 1. Documentation Consistency Fixes

- [x] 1.1 Update documentation for scraping frequency
  - Search and replace all "15 minutes" references with "24 hours" in DOCUMENTATION.md, README.md, and docs/ARCHITECTURE.md
  - Update UI components showing scraping frequency in dashboard pages
  - Verify cron configuration in vercel.json matches documentation (daily at midnight)
  - Add user-facing help text documenting actual behavior
  - _Requirements: 2.1.1, 2.1.2, 2.1.3, 2.1.4_

- [x] 1.2 Update platform support documentation
  - Update DOCUMENTATION.md to clearly state "Currently Supported: OpenCart, Laravel"
  - Add platform status badges (✅ Supported, 🚧 In Development, ⏳ Planned)
  - List Shopify, WooCommerce, Magento as "In Development"
  - List PrestaShop, BigCommerce as "Planned"
  - _Requirements: 2.2.1, 2.2.2_

- [x] 1.3 Update UI for platform support
  - Create SUPPORTED_PLATFORMS, IN_DEVELOPMENT, and PLANNED constants in integrations page
  - Disable unsupported platform selection in UI
  - Show "Coming Soon" message for planned platforms
  - Add appropriate badges to platform cards
  - _Requirements: 2.2.3_

### 2. Remove Mock Data Fallbacks

- [x] 2.1 Remove production mock data fallbacks
  - Remove all mock data fallback logic from lib/services/sync.ts
  - Add comprehensive error logging with context (siteId, tenantId, error details)
  - Create sync log entries for user visibility when errors occur
  - Throw errors instead of returning mock data
  - _Requirements: 2.4.1, 2.4.2_
  - _Note: Mock data only used when USE_MOCK_DATA=true (development only)_

- [x] 2.2 Implement user notifications for sync failures
  - Create NotificationService.create() calls for sync errors
  - Include link to integrations dashboard in notifications
  - Add notification type "SYNC_ERROR" to notification system
  - _Requirements: 2.4.2_

- [x] 2.3 Move mock data to development fixtures
  - Create lib/fixtures/mock-products.ts for development use
  - Move MOCK_OPENCART_PRODUCTS and MOCK_LARAVEL_PRODUCTS to fixtures
  - Add environment variable ENABLE_MOCK_MODE for development
  - _Requirements: 2.4.3, 2.4.4_

### 3. Complete Price Update APIs

- [x] 3.1 Implement complete OpenCart price update API
  - Complete updateOpenCartPrice() method in lib/services/sync.ts
  - Add price verification in response (compare expected vs actual)
  - Create priceUpdateLog entries for successful updates
  - Add comprehensive error handling and logging
  - Implement retry logic with exponential backoff
  - _Requirements: 2.5.1, 2.5.4_

- [x] 3.2 Update OpenCart extension API endpoint
  - Complete integrations/opencart/catalog/controller/api/pricepilot.php update() method
  - Add API token validation
  - Add product existence verification
  - Add SKU verification (if provided)
  - Return old_price and updated_price in response
  - Add timestamp to response
  - _Requirements: 2.5.1, 2.5.3_

- [x] 3.3 Implement complete Laravel price update API
  - Complete updateLaravelPrice() method in lib/services/sync.ts
  - Add price verification in response
  - Create priceUpdateLog entries for successful updates
  - Add comprehensive error handling and logging
  - Implement retry logic with exponential backoff
  - _Requirements: 2.5.2, 2.5.4_

- [x] 3.4 Verify price update APIs with real instances
  - Set up staging OpenCart instance
  - Set up staging Laravel instance
  - Verify successful price updates
  - Verify error scenarios (invalid token, product not found, network errors)
  - Verify price update logs are created correctly
  - _Requirements: 2.5.3_

### 4. Security - API Token Encryption

- [x] 4.1 Implement encryption utilities
  - Create lib/security.ts with encryptApiToken() and decryptApiToken() functions
  - Use AES-256-GCM encryption algorithm
  - Generate and store ENCRYPTION_KEY in environment variables
  - Add IV and auth tag to encrypted token format
  - _Requirements: 2.7.1_

- [x] 4.2 Create encryption middleware
  - Create lib/middleware/encryption.ts
  - Implement encryptSiteToken() for encrypting before database save
  - Implement decryptSiteToken() for decrypting after database read
  - Add error handling for decryption failures
  - _Requirements: 2.7.1_

- [x] 4.3 Migrate existing API tokens
  - Create database migration to encrypt existing tokens
  - Backup database before migration
  - Test migration on staging environment
  - Update all Site queries to use encryption middleware
  - _Requirements: 2.7.1_

### 5. Security - Rate Limiting Enhancement

- [x] 5.1 Implement enhanced rate limiting
  - Create lib/middleware/ratelimit.ts using @upstash/ratelimit
  - Configure different limits: api (100/hour), scraping (10/min), admin (1000/hour)
  - Add rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
  - Return 429 status with clear error message when limit exceeded
  - _Requirements: 2.7.2, 2.19.1, 2.19.2, 2.19.3, 2.19.4_

- [x] 5.2 Apply rate limiting to API routes
  - Add rate limiting middleware to all public API endpoints
  - Use appropriate limiter type based on endpoint (api, scraping, admin)
  - Verify rate limiting with concurrent requests
  - Document rate limits in API documentation
  - _Requirements: 2.7.2, 2.19.5_

### 6. Checkpoint - Week 1 Review ✅
  - ✅ Ensure all critical fixes are complete
  - ✅ Verify documentation is accurate
  - ✅ Verify price update APIs with real stores
  - ✅ Confirm security measures are in place
  - ✅ Ask user if questions arise

---

## Phase 2: Core Functionality (Week 2)

### 7. Error Handling Enhancement

- [x] 7.1 Create custom error classes
  - Create lib/utils/error-handler.ts with AppError base class
  - Implement ValidationError, NotFoundError, UnauthorizedError, RateLimitError classes
  - Add error code, message, statusCode, and details properties
  - _Requirements: 2.8.4_

- [x] 7.2 Implement global error handler
  - Create lib/middleware/error-handler.ts with handleApiError() function
  - Handle AppError instances with appropriate status codes
  - Log unexpected errors with full context
  - Return standardized error response format
  - _Requirements: 2.8.3, 2.8.4_
  - _Note: Implemented as lib/middleware/global-error-handler.ts_

- [x] 7.3 Add error handling to all services
  - Update SyncService with try-catch blocks and custom errors
  - Update ScraperService with comprehensive error handling
  - Update MatchingService with error handling
  - Update RulesEngine with error handling
  - Add error logging with context to all services
  - _Requirements: 2.8.1, 2.8.2_

- [x] 7.4 Implement retry logic for transient failures
  - Add retry logic to external API calls (OpenCart, Laravel)
  - Implement exponential backoff strategy
  - Add maximum retry attempts configuration
  - Log retry attempts for debugging
  - _Requirements: 2.8.5_

### 8. Performance Optimization

- [x] 8.1 Audit and fix N+1 query problems
  - Review all Prisma queries in services
  - Replace sequential queries with includes
  - Add proper relations to Prisma queries
  - Verify query performance with large datasets
  - _Requirements: 2.9.2_

- [x] 8.2 Add database indexes
  - Create migration file: prisma/migrations/add_performance_indexes.sql
  - Add indexes for Product (tenantId+siteId, externalId, updatedAt)
  - Add indexes for ProductMatch (userProductId+status, competitorProductId, confidence)
  - Add indexes for PriceHistory (productId+recordedAt)
  - Add indexes for Site (tenantId+type, isSyncing+syncStartedAt)
  - Add indexes for Notification (tenantId+isRead+createdAt)
  - Add indexes for TenantAuditLog (tenantId+createdAt)
  - Run migration on staging and verify performance improvement
  - _Requirements: 2.9.1_

- [x] 8.3 Implement Redis caching
  - Create lib/services/cache-enhanced.ts with CacheService class
  - Implement get(), set(), invalidate(), and wrap() methods
  - Add error handling for cache failures (graceful degradation)
  - Configure TTL for different data types
  - _Requirements: 2.9.4_

- [x] 8.4 Add caching to expensive operations
  - Cache competitor products in MatchingService (1 hour TTL)
  - Cache product lists in dashboard (5 minutes TTL)
  - Cache scraping results (24 hours TTL)
  - Add cache invalidation on data updates
  - _Requirements: 2.9.4_

- [x] 8.5 Implement pagination
  - Create lib/utils/pagination.ts with paginate() function
  - Add PaginationParams and PaginatedResponse interfaces
  - Support page, limit, sortBy, sortOrder parameters
  - Return pagination metadata (total, totalPages, hasNext, hasPrev)
  - _Requirements: 2.9.3_

- [x] 8.6 Add pagination to API endpoints
  - Update GET /api/v1/products with pagination
  - Update GET /api/v1/competitors with pagination
  - Update GET /api/v1/price-history with pagination
  - Limit maximum page size to 100 items
  - _Requirements: 2.9.3_

### 9. Rollback Mechanism

- [x] 9.1 Implement single price change rollback
  - Create lib/services/rollback.ts with RollbackService class
  - Implement rollbackPriceChange() method
  - Revert product price in database transaction
  - Create price history record for rollback
  - Create rollback log entry
  - Create audit log entry
  - _Requirements: 2.16.1, 2.16.3_

- [x] 9.2 Implement bulk operation rollback
  - Add BulkOperationSnapshot model to Prisma schema
  - Implement rollbackBulkOperation() method
  - Rollback all products in transaction
  - Mark snapshot as rolled back
  - Create audit log entry
  - _Requirements: 2.16.1, 2.16.3, 2.16.4_

- [x] 9.3 Sync rollback to stores
  - Call SyncService.syncProductsToStore() after rollback
  - Verify price was updated in store
  - Handle sync failures gracefully
  - _Requirements: 2.16.5_

- [x] 9.4 Add rollback notifications
  - Send notification when rollback completes
  - Include product details and price information
  - Add link to product or activity page
  - _Requirements: 2.16.1_

- [x] 9.5 Create rollback API endpoint
  - Create app/api/v1/price-update/rollback/route.ts
  - Support both single and bulk rollback
  - Require authentication
  - Return success/error response
  - _Requirements: 2.16.2_

- [x] 9.6 Add rollback UI
  - Add "Rollback" button to price update logs
  - Add "Rollback" button to bulk operation history
  - Show confirmation dialog before rollback
  - Display success/error message after rollback
  - Refresh data after successful rollback
  - _Requirements: 2.16.2_
  - _Note: Implemented as components/dashboard/rollback-button.tsx_

### 10. Checkpoint - Week 2 Review
  - Ensure all error handling is comprehensive
  - Verify performance improvements with metrics
  - Verify rollback functionality thoroughly
  - Confirm all changes work in staging
  - Ask user if questions arise

---

## Phase 3: Enhancements (Week 3)

### 11. Price Approval Enhancements

- [x] 11.1 Create auto-approval rules schema
  - Add AutoApprovalRule model to Prisma schema
  - Include fields: id, tenantId, name, enabled, priority, conditions, timestamps
  - Add indexes for tenantId and enabled
  - Run migration
  - _Requirements: 2.10.1_

- [x] 11.2 Implement auto-approval service
  - Create lib/services/auto-approval.ts with AutoApprovalService class
  - Implement shouldAutoApprove() method with rule evaluation
  - Check maxPriceChange, maxPercentageChange, minConfidenceScore conditions
  - Check allowedStrategies, productCategories, priceRange conditions
  - Return approval decision with reason
  - _Requirements: 2.10.1_

- [x] 11.3 Implement auto-approval processing
  - Implement processAutoApprovals() method
  - Fetch all pending price changes
  - Evaluate each change against auto-approval rules
  - Auto-approve matching changes
  - Create audit log entries for auto-approvals
  - _Requirements: 2.10.1_

- [x] 11.4 Add auto-approval to workflow
  - Call processAutoApprovals() after price comparison runs
  - Add cron job for periodic auto-approval processing
  - Log auto-approval statistics
  - _Requirements: 2.10.1_

- [x] 11.5 Implement email notification system
  - Create lib/services/email.ts with EmailService class
  - Configure nodemailer with SMTP settings
  - Implement sendPendingApprovalNotification() method
  - Implement sendDailyApprovalSummary() method
  - Add email templates with HTML formatting
  - _Requirements: 2.10.2_

- [x] 11.6 Create email notification cron jobs
  - Create app/api/v1/cron/daily-approval-summary/route.ts
  - Add cron job to vercel.json for daily summary
  - Verify cron secret for security
  - Send summary to all tenants with email notifications enabled
  - _Requirements: 2.10.2_

- [x] 11.7 Implement approval delegation
  - Add ApprovalDelegation model to Prisma schema
  - Create lib/services/approval-delegation.ts with ApprovalDelegationService class
  - Implement canApprove() method to check delegation
  - Implement createDelegation() method
  - Add delegation notification email
  - _Requirements: 2.10.3_

- [x] 11.8 Add delegation to approval workflow
  - Check delegation when user attempts to approve
  - Allow delegated users to approve on behalf of others
  - Log delegation usage in audit logs
  - _Requirements: 2.10.3_

- [x] 11.9 Optimize bulk approval operations
  - Batch database operations for bulk approvals
  - Use transactions for consistency
  - Add progress tracking for large bulk operations
  - Optimize notification sending for bulk approvals
  - _Requirements: 2.10.4_

- [x] 11.10 Add approval history tracking
  - Ensure all approvals are logged in audit logs
  - Add approval history view in UI
  - Include approver, timestamp, and reason
  - Make history searchable and filterable
  - _Requirements: 2.10.5_

### 12. Security - Input Validation & XSS Prevention

- [x] 12.1 Create validation middleware
  - Create lib/validation/middleware.ts with validateRequest() function
  - Use Zod for schema validation
  - Return 422 status with detailed validation errors
  - _Requirements: 2.7.3_

- [x] 12.2 Create validation schemas
  - Create lib/validation/schemas.ts with Zod schemas
  - Add schemas for product creation, site creation, price updates
  - Add schemas for user registration, settings updates
  - Include type checking, length limits, format validation
  - _Requirements: 2.7.3_

- [x] 12.3 Apply validation to API routes
  - Add validation to all POST/PUT/PATCH endpoints
  - Validate request body, query parameters, and URL parameters
  - Verify validation with invalid inputs
  - _Requirements: 2.7.3_

- [x] 12.4 Implement XSS prevention
  - Create lib/utils/sanitize.ts with sanitizeHtml() and escapeHtml() functions
  - Use DOMPurify for HTML sanitization
  - Define allowed tags and attributes
  - _Requirements: 2.7.3_

- [x] 12.5 Apply XSS prevention to user-generated content
  - Sanitize product descriptions before rendering
  - Escape user input in notifications
  - Sanitize competitor product data
  - Verify with XSS payloads
  - _Requirements: 2.7.3_

### 13. Security - Additional Measures

- [x] 13.1 Audit SQL injection risks
  - Review all Prisma queries for raw SQL usage
  - Ensure parameterized queries are used everywhere
  - Remove any unsafe $queryRaw usage
  - Document safe query patterns
  - _Requirements: 2.7.3_

- [x] 13.2 Implement CORS restrictions
  - Configure CORS in next.config.js
  - Whitelist allowed origins (no wildcards in production)
  - Restrict allowed methods and headers
  - Verify CORS with different origins
  - _Requirements: 2.7.4_

- [x] 13.3 Add security headers
  - Add Content-Security-Policy header
  - Add X-Frame-Options header
  - Add X-Content-Type-Options header
  - Add Strict-Transport-Security header
  - Verify headers with security scanner
  - _Requirements: 2.7.4_

- [x] 13.4 Implement password policies
  - Add password strength validation
  - Require minimum length (12 characters)
  - Require mix of uppercase, lowercase, numbers, symbols
  - Add password strength indicator in UI
  - _Requirements: 2.7.6_

- [x] 13.5 Enhance session management
  - Configure secure session cookies (httpOnly, secure, sameSite)
  - Implement session timeout (24 hours)
  - Add session invalidation on password change
  - Implement "remember me" functionality securely
  - _Requirements: 2.7.7_

- [x] 13.6 Prevent sensitive data logging
  - Audit all logger calls for sensitive data
  - Remove API tokens, passwords from logs
  - Mask sensitive fields in error logs
  - Add logging guidelines to documentation
  - _Requirements: 2.7.5_

### 14. Checkpoint - Week 3 Review ✅
  - ✅ Ensure all approval enhancements work correctly
  - ✅ Verify security measures are comprehensive
  - ✅ Verify all validation and sanitization
  - ✅ Confirm email notifications are sent
  - ✅ Ask user if questions arise

---

### 16. API Documentation

- [ ] 16.1 Update OpenAPI specification
  - Review and update all endpoint definitions
  - Add missing endpoints (rollback, auto-approval rules, delegation)
  - Update request/response schemas
  - _Requirements: 2.13.1_

- [ ] 16.2 Add request/response examples
  - Add example requests for all endpoints
  - Add example responses (success and error cases)
  - Include authentication examples
  - _Requirements: 2.13.2_

- [ ] 16.3 Document authentication
  - Document API token authentication flow
  - Document session authentication for web UI
  - Add authentication troubleshooting guide
  - _Requirements: 2.13.3_

- [ ] 16.4 Document error codes
  - Create comprehensive error code reference
  - Document all error codes with descriptions
  - Add examples of error responses
  - _Requirements: 2.13.4_

- [ ] 16.5 Set up interactive API documentation
  - Deploy Swagger UI or similar tool
  - Make documentation accessible at /api/docs
  - Verify all endpoints through interactive docs
  - _Requirements: 2.13.5_

### 17. Monitoring & Alerting

- [ ] 17.1 Configure critical alerts
  - Set up alert for high block rate (>30%)
  - Set up alert for proxy failures
  - Set up alert for high error rate (>1%)
  - Set up alert for slow response times (>500ms)
  - _Requirements: 2.15.1_

- [ ] 17.2 Implement alert notifications
  - Configure email notifications for alerts
  - Configure Slack notifications (if available)
  - Add alert notification preferences to user settings
  - _Requirements: 2.15.2_

- [ ] 17.3 Make alert thresholds configurable
  - Add alert configuration to admin settings
  - Allow per-tenant alert customization
  - Store alert configurations in database
  - _Requirements: 2.15.3_

- [ ] 17.4 Implement alert history tracking
  - Create AlertHistory model in Prisma schema
  - Log all triggered alerts
  - Add alert history view in admin dashboard
  - _Requirements: 2.15.4_

- [ ] 17.5 Implement alert acknowledgment workflow
  - Add "Acknowledge" button to alerts
  - Track who acknowledged each alert
  - Stop sending notifications for acknowledged alerts
  - _Requirements: 2.15.5_

### 18. Data Retention & Cleanup

- [ ] 18.1 Define data retention policies
  - Define retention periods for each data type
  - Document retention policies in DOCUMENTATION.md
  - Get approval for retention periods
  - _Requirements: 2.17.1_

- [ ] 18.2 Implement automated cleanup jobs
  - Create cleanup cron job for old price history (>90 days)
  - Create cleanup cron job for old audit logs (>1 year)
  - Create cleanup cron job for old notifications (>30 days)
  - Add cleanup job to vercel.json
  - _Requirements: 2.17.2_

- [ ] 18.3 Implement archive mechanism
  - Create archive tables for old data
  - Implement archiveOldData() method
  - Move old data to archive tables before deletion
  - _Requirements: 2.17.3_

- [ ] 18.4 Ensure GDPR compliance
  - Implement user data export functionality
  - Implement user data deletion functionality
  - Add privacy policy and terms of service
  - Document GDPR compliance measures
  - _Requirements: 2.17.4, 2.17.5_

### 19. Documentation Updates

- [ ] 19.1 Update user documentation
  - Update DOCUMENTATION.md with all changes
  - Update README.md with new features
  - Update FAQ with common questions
  - Add troubleshooting guides for common issues
  - _Requirements: 2.1.1, 2.2.1_

- [ ] 19.2 Update technical documentation
  - Update ARCHITECTURE.md with new components
  - Document all new services and utilities
  - Add deployment guide with step-by-step instructions
  - Create runbook for common operations
  - _Requirements: 2.13.1_

- [ ] 19.3 Add code documentation
  - Add JSDoc comments to all public functions
  - Document complex algorithms with inline comments
  - Update type definitions
  - Add examples to documentation
  - _Requirements: 2.13.1_

---

## Notes

- All tasks reference specific requirements for traceability
- Tasks are organized into logical phases with checkpoints
- Security and critical fixes are prioritized in early phases
- Documentation is comprehensive in final phase
- Each phase ends with a checkpoint for review and validation
- Deployment is incremental with staging validation before production

## Success Criteria

- [ ] All critical issues resolved (2.1-2.5)
- [ ] All security vulnerabilities addressed (2.7)
- [ ] Documentation accuracy >95% (2.1, 2.2)
- [ ] Price update success rate >99% (2.5)
- [ ] System uptime >99.9% maintained
- [ ] Zero security incidents post-deployment
- [ ] User satisfaction score >4.5/5

---

**Plan Version**: 1.0  
**Last Updated**: January 28, 2026  
**Estimated Duration**: 4 weeks  
**Status**: Ready for Execution
