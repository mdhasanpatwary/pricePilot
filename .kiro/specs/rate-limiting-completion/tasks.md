# Implementation Plan: Rate Limiting Completion

## Overview

This implementation plan completes the rate limiting security infrastructure for PricePilot by adding tenant-based limits, comprehensive monitoring, admin management tools, and thorough testing. The plan builds incrementally on the existing Upstash Redis-based rate limiting infrastructure.

## Tasks

- [ ] 1. Add database schema for rate limit tracking
  - Create Prisma migration for RateLimitMetric, RateLimitBypass, and RateLimitCustomMultiplier tables
  - Add indexes for performance (tenantId, timestamp, limiterType)
  - Add relations to Tenant model
  - Run migration and verify schema
  - _Requirements: 3.6, 4.3, 4.4_

- [ ] 2. Implement rate limit configuration service
  - [ ] 2.1 Create `lib/services/rate-limit-config.ts`
    - Define plan multipliers (BASIC: 1.0, PREMIUM: 2.0, PRO: 5.0)
    - Define endpoint limits configuration
    - Define alert thresholds
    - Export configuration constants
    - _Requirements: 2.3, 2.4, 3.5_
  
  - [ ]* 2.2 Write property test for plan multipliers
    - **Property 2: Plan-Based Multipliers Adjust Limits**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [ ] 3. Implement rate limit metrics service
  - [ ] 3.1 Create `lib/services/rate-limit-metrics.ts`
    - Implement `recordHit()` function for successful requests
    - Implement `recordViolation()` function for 429 responses
    - Implement `getTenantMetrics()` for aggregated metrics
    - Implement `checkThresholds()` for alert generation
    - Handle database write failures gracefully
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_
  
  - [ ]* 3.2 Write property test for violation logging
    - **Property 3: Rate Limit Violations Are Logged**
    - **Validates: Requirements 3.1, 3.6**
  
  - [ ]* 3.3 Write property test for metrics tracking
    - **Property 4: Metrics Track Hits and Violations**
    - **Validates: Requirements 3.2, 3.3**
  
  - [ ]* 3.4 Write unit tests for metrics service
    - Test metric recording with valid data
    - Test metric aggregation
    - Test threshold checking
    - Test database failure handling
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

- [ ] 4. Implement admin rate limit management service
  - [ ] 4.1 Create `lib/services/rate-limit-admin.ts`
    - Implement `setBypass()` for temporary bypasses
    - Implement `setCustomMultiplier()` for custom limits
    - Implement `getAllTenantsStatus()` for admin dashboard
    - Implement `getTenantStatus()` for detailed view
    - Implement bypass expiration checking
    - Create audit logs for all admin actions
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [ ]* 4.2 Write property test for admin bypasses
    - **Property 5: Admin Bypasses Disable Rate Limiting**
    - **Validates: Requirements 4.3**
  
  - [ ]* 4.3 Write property test for custom multipliers
    - **Property 6: Custom Multipliers Override Plan Multipliers**
    - **Validates: Requirements 4.4**
  
  - [ ]* 4.4 Write property test for admin action auditing
    - **Property 7: Admin Actions Are Audited**
    - **Validates: Requirements 4.5**
  
  - [ ]* 4.5 Write unit tests for admin service
    - Test bypass creation and expiration
    - Test custom multiplier validation
    - Test permission checks
    - Test audit log creation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Enhance rate limiting middleware
  - [ ] 6.1 Update `lib/middleware/ratelimit.ts`
    - Add tenant plan extraction from session
    - Implement `getPlanMultiplier()` function
    - Implement `checkBypass()` function
    - Implement `getCustomMultiplier()` function
    - Apply multipliers to base limits
    - Integrate metrics recording (async, non-blocking)
    - Add limiter type to error responses
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 3.1, 3.2, 3.3, 4.3, 4.4, 8.7_
  
  - [ ]* 6.2 Write property test for rate limit responses
    - **Property 8: Rate Limit Responses Include 429 Status**
    - **Validates: Requirements 8.1**
  
  - [ ]* 6.3 Write property test for rate limit headers
    - **Property 9: Rate Limit Headers Are Present**
    - **Validates: Requirements 8.2, 8.3, 8.4**
  
  - [ ]* 6.4 Write property test for retry-after header
    - **Property 10: Rate Limit Errors Include Retry-After**
    - **Validates: Requirements 8.5**
  
  - [ ]* 6.5 Write property test for error response format
    - **Property 11: Rate Limit Errors Have JSON Body**
    - **Validates: Requirements 8.6, 8.7**
  
  - [ ]* 6.6 Write unit tests for middleware enhancements
    - Test plan multiplier application
    - Test bypass checking
    - Test custom multiplier override
    - Test identifier construction with plan info
    - Test error response format
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 4.3, 4.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 7. Audit and protect unprotected API routes
  - [ ] 7.1 Create `scripts/audit-rate-limits.ts`
    - Scan all API route files in `app/api/`
    - Check for `withRateLimit` usage
    - Generate coverage report
    - Suggest appropriate rate limiters
    - _Requirements: 1.1, 1.8_
  
  - [ ] 7.2 Add rate limiting to debug endpoints
    - Add `withRateLimit(req, 'auth', handler)` to debug routes
    - Use strict auth limiter (5 requests per 15 minutes)
    - _Requirements: 1.2_
  
  - [ ] 7.3 Add rate limiting to export endpoints
    - Add `withRateLimit(req, 'importExport', handler)` to export routes
    - _Requirements: 1.3_
  
  - [ ] 7.4 Add rate limiting to import endpoints
    - Add `withRateLimit(req, 'importExport', handler)` to import routes
    - _Requirements: 1.4_
  
  - [ ] 7.5 Add rate limiting to alert endpoints
    - Add `withRateLimit(req, 'read', handler)` to alert routes
    - _Requirements: 1.5_
  
  - [ ] 7.6 Add rate limiting to remaining analytics endpoints
    - Verify all analytics endpoints use `withRateLimit(req, 'read', handler)`
    - _Requirements: 1.6_
  
  - [ ]* 7.7 Write property test for API route coverage
    - **Property 1: All API Routes Have Rate Limiting**
    - **Validates: Requirements 1.1**

- [ ] 8. Checkpoint - Verify rate limiting coverage
  - Run audit script and verify 100% coverage
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement admin API endpoints
  - [ ] 9.1 Create `app/api/v1/admin/rate-limits/route.ts`
    - GET: Return rate limit status for all tenants
    - Require super admin authentication
    - Use `withRateLimit(req, 'read', handler)`
    - _Requirements: 4.1_
  
  - [ ] 9.2 Create `app/api/v1/admin/rate-limits/[tenantId]/route.ts`
    - GET: Return detailed status for specific tenant
    - Require super admin authentication
    - Use `withRateLimit(req, 'read', handler)`
    - _Requirements: 4.2_
  
  - [ ] 9.3 Create `app/api/v1/admin/rate-limits/[tenantId]/bypass/route.ts`
    - POST: Set temporary bypass for tenant
    - Validate duration parameter
    - Create audit log
    - Require super admin authentication
    - Use `withRateLimit(req, 'write', handler)`
    - _Requirements: 4.3, 4.5_
  
  - [ ] 9.4 Create `app/api/v1/admin/rate-limits/[tenantId]/multiplier/route.ts`
    - POST: Set custom multiplier for tenant
    - Validate multiplier range (0.1 to 100)
    - Create audit log
    - Require super admin authentication
    - Use `withRateLimit(req, 'write', handler)`
    - _Requirements: 4.4, 4.5_
  
  - [ ]* 9.5 Write integration tests for admin endpoints
    - Test bypass creation and enforcement
    - Test custom multiplier application
    - Test permission checks
    - Test audit log creation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 10. Implement dashboard API endpoints
  - [ ] 10.1 Create `app/api/v1/admin/rate-limits/metrics/route.ts`
    - GET: Return aggregated metrics with filtering
    - Support query params: tenantId, limiterType, startDate, endDate
    - Return metrics grouped by tenant and limiter type
    - Require super admin authentication
    - Use `withRateLimit(req, 'read', handler)`
    - _Requirements: 3.4, 6.1, 6.2, 6.3, 6.4_
  
  - [ ] 10.2 Create `app/api/v1/admin/rate-limits/violations/route.ts`
    - GET: Return recent violations with details
    - Support filtering by tenant, endpoint, time range
    - Include tenant name, endpoint, timestamp, identifier
    - Require super admin authentication
    - Use `withRateLimit(req, 'read', handler)`
    - _Requirements: 6.2, 6.4_
  
  - [ ]* 10.3 Write property test for dashboard filtering
    - **Property 12: Dashboard Filters Work Correctly**
    - **Validates: Requirements 6.4**
  
  - [ ]* 10.4 Write integration tests for dashboard endpoints
    - Test metrics aggregation
    - Test filtering by tenant, type, time range
    - Test violation details
    - _Requirements: 3.4, 6.1, 6.2, 6.3, 6.4_

- [ ] 11. Checkpoint - Ensure all API tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Build rate limit dashboard UI
  - [ ] 12.1 Create `app/admin/rate-limits/page.tsx`
    - Display overview of all tenants' rate limit status
    - Show current usage, violations, and bypass status
    - Add filters for tenant, plan type, violation status
    - Add actions to manage bypasses and multipliers
    - Require super admin authentication
    - _Requirements: 6.1, 6.5_
  
  - [ ] 12.2 Create `app/admin/rate-limits/[tenantId]/page.tsx`
    - Display detailed metrics for specific tenant
    - Show usage by limiter type
    - Show recent violations with details
    - Show rate limit trends over time
    - Add actions to set bypass or custom multiplier
    - _Requirements: 6.2, 6.3, 6.5_
  
  - [ ] 12.3 Add auto-refresh to dashboard
    - Implement polling every 30 seconds
    - Show last updated timestamp
    - Add manual refresh button
    - _Requirements: 6.6_

- [ ] 13. Create rate limiting documentation
  - [ ] 13.1 Create `docs/rate-limiting.md`
    - Document all rate limiter types and their limits
    - Document plan-based multipliers
    - Document which endpoints use which limiters
    - Document rate limit headers
    - Document how to handle 429 errors in client code
    - Document admin management capabilities
    - Include code examples
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [ ] 13.2 Add JSDoc comments to all rate limiting functions
    - Document parameters, return types, and behavior
    - Include usage examples
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 14. Final integration testing
  - [ ]* 14.1 Write end-to-end rate limiting flow test
    - Create test tenant with BASIC plan
    - Make requests until rate limited
    - Verify 429 response and headers
    - Verify metrics are recorded
    - Upgrade tenant to PREMIUM plan
    - Verify higher limits apply immediately
    - _Requirements: 1.1, 2.1, 2.2, 2.5, 3.1, 3.2, 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ]* 14.2 Write admin bypass flow test
    - Create test tenant
    - Exceed rate limit
    - Super admin sets bypass
    - Verify requests are allowed
    - Verify audit log created
    - Wait for bypass expiration
    - Verify rate limiting resumes
    - _Requirements: 4.3, 4.5, 4.6_
  
  - [ ]* 14.3 Write custom multiplier flow test
    - Create test tenant
    - Super admin sets custom multiplier
    - Verify new limits apply
    - Verify audit log created
    - _Requirements: 4.4, 4.5_

- [ ] 15. Final checkpoint - Complete testing and verification
  - Run full test suite
  - Verify 100% API route coverage
  - Verify all 12 correctness properties pass
  - Verify documentation is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end flows
- All rate limiting enhancements are backward compatible with existing infrastructure
- Metrics recording is asynchronous and non-blocking
- Admin endpoints require super admin authentication
- Dashboard provides real-time visibility into rate limit status
