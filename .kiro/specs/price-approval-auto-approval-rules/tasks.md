# Implementation Plan: Price Approval Auto-Approval Rules

## Overview

This implementation plan breaks down the auto-approval rules feature into discrete, incremental coding tasks. Each task builds on previous work, with testing integrated throughout to catch errors early. The implementation follows a bottom-up approach: database schema → services → API endpoints → UI → cron job integration.

## Tasks

- [x] 1. Database Schema and Models
  - Add `AutoApprovalRule` model to Prisma schema with all required fields (id, tenantId, name, description, enabled, priority, conditions, timestamps)
  - Add indexes for efficient querying: `[tenantId, enabled, priority]` and `[tenantId]`
  - Add optional fields to `PendingPriceChange` model: `autoApprovedBy` (String?) and `autoApprovedAt` (DateTime?)
  - Add foreign key relationship from `AutoApprovalRule` to `Tenant` with cascade delete
  - Create and run Prisma migration
  - _Requirements: 1.1, 1.6_

- [x] 2. Rule Validation Service
  - [x] 2.1 Create `lib/validation/auto-approval-rules.ts` with Zod schemas
    - Define `RuleConditionsSchema` with optional fields: maxPriceChange, maxPercentageChange, minConfidenceScore, allowedStrategies, productCategories, priceRange
    - Define `CreateAutoApprovalRuleSchema` with required fields: name, enabled, priority, conditions
    - Define `UpdateAutoApprovalRuleSchema` with all optional fields
    - Add validation rules: maxPriceChange > 0, percentages 0-100, priceRange.min < priceRange.max, at least one condition required
    - _Requirements: 2.7, 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ]* 2.2 Write property test for rule validation
    - **Property 4: Condition Validation**
    - **Validates: Requirements 2.7, 9.1, 9.2, 9.3, 9.4, 9.5**
    - Generate random invalid conditions (negative values, out-of-range percentages, invalid price ranges, empty conditions)
    - Verify all invalid conditions are rejected by validation schema
    - Run 100 iterations

- [x] 3. Auto-Approval Service Core Logic
  - [x] 3.1 Create `lib/services/auto-approval.ts` with `AutoApprovalService` class
    - Implement `validateRuleConditions(conditions)` method using Zod schemas
    - Implement `evaluateRule(rule, change, product)` private method
    - Add condition evaluation logic for each condition type (maxPriceChange, maxPercentageChange, minConfidenceScore, allowedStrategies, productCategories, priceRange)
    - Implement AND logic: all conditions must be satisfied
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_
  
  - [ ]* 3.2 Write property test for AND logic
    - **Property 5: All Conditions Must Match**
    - **Validates: Requirements 2.8**
    - Generate rules with multiple conditions
    - Generate changes that match some but not all conditions
    - Verify no auto-approval occurs
    - Run 100 iterations
  
  - [ ]* 3.3 Write property tests for individual conditions
    - **Property 25-30: Individual Condition Tests**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
    - Test maxPriceChange condition with random values
    - Test maxPercentageChange condition with random values
    - Test minConfidenceScore condition with random values
    - Test allowedStrategies condition with random strategies
    - Test productCategories condition with random categories
    - Test priceRange condition with random ranges
    - Run 100 iterations per condition type

- [x] 4. Auto-Approval Decision Logic
  - [x] 4.1 Implement `shouldAutoApprove(change, tenantId)` method in `AutoApprovalService`
    - Load enabled rules for tenant, ordered by priority ascending
    - Iterate through rules in priority order
    - For each rule, call `evaluateRule()`
    - Return first matching rule with approval decision
    - If no rules match, return not approved
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
  
  - [ ]* 4.2 Write property test for priority-based evaluation
    - **Property 6: Priority-Based Evaluation with Short-Circuit**
    - **Validates: Requirements 3.1, 3.2**
    - Generate multiple rules with different priorities
    - Generate change that matches multiple rules
    - Verify only the lowest priority rule is applied (short-circuit)
    - Run 100 iterations
  
  - [ ]* 4.3 Write property test for disabled rules
    - **Property 9: Disabled Rules Are Skipped**
    - **Validates: Requirements 3.5, 1.4**
    - Generate rules with enabled=false
    - Generate matching changes
    - Verify disabled rules are never applied
    - Run 100 iterations

- [x] 5. Checkpoint - Core Logic Validation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Auto-Approval Execution Logic
  - [x] 6.1 Implement `processAutoApprovals(tenantId)` method in `AutoApprovalService`
    - Load all PENDING price changes for tenant with product and match data
    - For each pending change, call `shouldAutoApprove()`
    - If approved, execute auto-approval transaction (see 6.2)
    - Track count of auto-approved changes
    - Return count
    - _Requirements: 5.3, 5.4_
  
  - [x] 6.2 Implement auto-approval transaction logic
    - Use Prisma transaction to ensure atomicity
    - Update PendingPriceChange: status=APPROVED, autoApprovedBy=ruleId, autoApprovedAt=now, reviewedBy='system:auto-approval'
    - Call RulesEngine.applyApprovedChanges() to execute price update
    - Create PriceHistory record
    - Create TenantAuditLog entry with action='AUTO_APPROVE_PRICE', details including rule info
    - If any step fails, rollback entire transaction
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [ ]* 6.3 Write property test for transaction atomicity
    - **Property 10: Auto-Approval Transaction Atomicity**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
    - Generate random auto-approvals
    - Verify all steps complete (status updated, history created, audit log created)
    - Simulate failures and verify rollback
    - Run 100 iterations
  
  - [ ]* 6.4 Write property test for store update failure rollback
    - **Property 11: Store Update Failure Rollback**
    - **Validates: Requirements 4.6**
    - Mock store API to fail
    - Attempt auto-approval
    - Verify status reverts to PENDING
    - Verify no history or audit log created
    - Run 100 iterations

- [x] 7. API Endpoints - Rule Management
  - [x] 7.1 Create `app/api/v1/auto-approval-rules/route.ts`
    - Implement GET endpoint: list all rules for authenticated tenant
    - Implement POST endpoint: create new rule with validation
    - Use Zod schemas for request validation
    - Return consistent API response format (success, data, meta)
    - Enforce tenant isolation
    - _Requirements: 1.1, 1.6_
  
  - [x] 7.2 Create `app/api/v1/auto-approval-rules/[id]/route.ts`
    - Implement GET endpoint: get single rule by ID
    - Implement PUT endpoint: update rule with validation
    - Implement DELETE endpoint: delete rule
    - Verify rule belongs to authenticated tenant
    - Return 404 if rule not found or belongs to different tenant
    - _Requirements: 1.2, 1.3, 1.6_
  
  - [x] 7.3 Create `app/api/v1/auto-approval-rules/[id]/toggle/route.ts`
    - Implement PATCH endpoint: toggle enabled status
    - Verify rule belongs to authenticated tenant
    - Update enabled field and updatedAt timestamp
    - Return updated rule
    - _Requirements: 1.4, 1.5_
  
  - [ ]* 7.4 Write unit tests for API endpoints
    - Test successful rule creation
    - Test validation errors return 422
    - Test tenant isolation (403 for other tenant's rules)
    - Test 404 for non-existent rules
    - Test toggle endpoint

- [ ]* 8. Write property test for tenant isolation
  - **Property 2: Tenant Isolation for Rules**
  - **Validates: Requirements 1.6**
  - Generate rules for multiple tenants
  - Attempt to access rules across tenants
  - Verify all cross-tenant access fails
  - Run 100 iterations

- [x] 9. Checkpoint - API and Service Layer Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Cron Job for Auto-Approval Processing
  - [x] 10.1 Create `app/api/v1/cron/auto-approval/route.ts`
    - Implement GET endpoint with cron secret authentication
    - Load all tenants from database
    - For each tenant, call `AutoApprovalService.processAutoApprovals()`
    - Catch and log errors per tenant, continue processing others
    - Return summary: total tenants processed, total changes auto-approved
    - _Requirements: 5.1, 5.2, 5.5_
  
  - [x] 10.2 Add cron configuration to `vercel.json`
    - Add cron job entry: path="/api/v1/cron/auto-approval", schedule="0 * * * *" (hourly)
    - Document CRON_SECRET environment variable requirement
    - _Requirements: 5.1_
  
  - [ ]* 10.3 Write unit test for cron endpoint
    - Test authentication with valid/invalid cron secret
    - Test multi-tenant processing
    - Test error isolation between tenants

- [ ]* 11. Write property tests for multi-tenant processing
  - **Property 12: Multi-Tenant Processing**
  - **Validates: Requirements 5.2, 5.5**
  - Generate multiple tenants with rules and pending changes
  - Simulate failure for one tenant
  - Verify other tenants are still processed
  - Run 100 iterations

- [x] 12. Email Notification Service
  - [x] 12.1 Extend `lib/services/email.ts` with auto-approval notification methods
    - Implement `sendAutoApprovalNotification(tenantId, approvedCount, ruleNames)` method
    - Load users with emailNotifications=true for tenant
    - Send single batched email with count and rule names
    - Handle email failures gracefully (log but don't throw)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 12.2 Integrate email notifications into `processAutoApprovals()`
    - After processing all changes, collect rule names that triggered approvals
    - If count > 0, call `sendAutoApprovalNotification()`
    - _Requirements: 7.1, 7.4_
  
  - [ ]* 12.3 Write property tests for email notifications
    - **Property 16: Email Notification Completeness**
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - Generate auto-approvals with different rules
    - Verify email contains count and rule names
    - Run 100 iterations
    
    - **Property 17: Email Notification Batching**
    - **Validates: Requirements 7.4**
    - Generate multiple auto-approvals in one run
    - Verify only one email is sent
    - Run 100 iterations
    
    - **Property 18: Email Notification Preferences**
    - **Validates: Requirements 7.5**
    - Generate users with emailNotifications=false
    - Verify no emails sent to those users
    - Run 100 iterations

- [x] 13. Audit Trail and Metrics
  - [x] 13.1 Implement audit logging in auto-approval transaction
    - Ensure TenantAuditLog entry includes: action, entityId, userId='system', details with rule info
    - Include old price, new price, product ID, rule ID, rule name in details JSON
    - _Requirements: 6.1, 6.3, 6.4, 6.5_
  
  - [x] 13.2 Add metrics tracking to `AutoApprovalService`
    - Track per-rule trigger count (could use a separate metrics table or increment in-memory)
    - Track non-matching changes count
    - Calculate auto-approval percentage
    - _Requirements: 8.1, 8.2, 8.5_
  
  - [ ]* 13.3 Write property tests for audit trail
    - **Property 15: Complete Audit Trail**
    - **Validates: Requirements 6.1, 6.3, 6.4, 6.5**
    - Generate random auto-approvals
    - Verify audit log exists for each with all required fields
    - Run 100 iterations

- [ ]* 14. Write property tests for metrics
  - **Property 19: Per-Rule Metrics Tracking**
  - **Validates: Requirements 8.1, 8.4**
  - Generate auto-approvals with different rules
  - Verify each rule's trigger count is tracked
  - Run 100 iterations
  
  - **Property 20: Non-Matching Changes Metrics**
  - **Validates: Requirements 8.2**
  - Generate changes that don't match any rules
  - Verify non-matching count increments
  - Run 100 iterations
  
  - **Property 21: Auto-Approval Percentage Calculation**
  - **Validates: Requirements 8.5**
  - Generate mix of auto-approved and manual changes
  - Verify percentage calculation is correct
  - Run 100 iterations

- [x] 15. Checkpoint - Backend Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. UI Components - Rule List
  - [x] 16.1 Create `components/dashboard/auto-approval-rules-list.tsx`
    - Display table of auto-approval rules with columns: name, enabled, priority, conditions summary, actions
    - Add toggle switch for enabled/disabled status
    - Add edit and delete buttons
    - Add "Create New Rule" button
    - Fetch rules from GET /api/v1/auto-approval-rules
    - _Requirements: 1.4, 1.5_
  
  - [x] 16.2 Implement toggle functionality
    - Call PATCH /api/v1/auto-approval-rules/:id/toggle on switch change
    - Update UI optimistically
    - Show success/error toast notifications
    - _Requirements: 1.4, 1.5_

- [x] 17. UI Components - Rule Form
  - [x] 17.1 Create `components/dashboard/auto-approval-rule-form.tsx`
    - Create form with fields: name, description, enabled, priority
    - Add condition inputs: maxPriceChange, maxPercentageChange, minConfidenceScore
    - Add multi-select for allowedStrategies
    - Add multi-select for productCategories
    - Add price range inputs (min, max)
    - Implement client-side validation matching Zod schemas
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [x] 17.2 Implement form submission
    - Call POST /api/v1/auto-approval-rules for create
    - Call PUT /api/v1/auto-approval-rules/:id for update
    - Handle validation errors and display field-level error messages
    - Show success toast and redirect to list on success
    - _Requirements: 1.1, 1.2_

- [x] 18. UI Components - Metrics Dashboard
  - [x] 18.1 Create `components/dashboard/auto-approval-metrics.tsx`
    - Display widget showing: total auto-approvals, auto-approval percentage, top rules by trigger count
    - Fetch metrics from API endpoint (to be created)
    - Use charts/graphs for visualization (optional)
    - _Requirements: 8.3, 8.4, 8.5_
  
  - [x] 18.2 Create API endpoint for metrics
    - Create `app/api/v1/auto-approval-rules/metrics/route.ts`
    - Implement GET endpoint returning: total auto-approvals, percentage, per-rule counts
    - Calculate from TenantAuditLog and PendingPriceChange data
    - _Requirements: 8.1, 8.2, 8.5_

- [x] 19. UI Pages
  - [x] 19.1 Create `app/dashboard/auto-approval-rules/page.tsx`
    - Main page displaying `AutoApprovalRulesList` component
    - Add page title and description
    - Add breadcrumbs
    - _Requirements: 1.1_
  
  - [x] 19.2 Create `app/dashboard/auto-approval-rules/new/page.tsx`
    - Page for creating new rule
    - Display `AutoApprovalRuleForm` component in create mode
    - _Requirements: 1.1_
  
  - [x] 19.3 Create `app/dashboard/auto-approval-rules/[id]/edit/page.tsx`
    - Page for editing existing rule
    - Load rule data and pass to `AutoApprovalRuleForm` component in edit mode
    - _Requirements: 1.2_

- [x] 20. Integration with Existing Approval Workflow
  - [x] 20.1 Update price approval UI to show auto-approval info
    - In `app/dashboard/price-approvals/page.tsx`, display which rule auto-approved each change
    - Show "Auto-approved by: [rule name]" badge for auto-approved changes
    - _Requirements: 6.2_
  
  - [x] 20.2 Ensure manual approval still works with auto-approval enabled
    - Verify manual approval buttons work for PENDING changes
    - Verify manually approved changes are skipped by auto-approval
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [ ]* 20.3 Write property tests for workflow integration
    - **Property 22: Manual Approval Compatibility**
    - **Validates: Requirements 10.1**
    - Enable auto-approval rules
    - Manually approve changes
    - Verify manual approval works correctly
    - Run 100 iterations
    
    - **Property 23: Manual Approval Takes Precedence**
    - **Validates: Requirements 10.2, 10.3**
    - Manually approve/reject changes
    - Run auto-approval
    - Verify manual decisions are not modified
    - Run 100 iterations
    
    - **Property 24: Manual Approval Independence**
    - **Validates: Requirements 10.5**
    - Disable all auto-approval rules
    - Verify manual approval workflow still functions
    - Run 100 iterations

- [x] 21. Documentation
  - [x] 21.1 Update user documentation
    - Add section to DOCUMENTATION.md explaining auto-approval rules
    - Document each condition type with examples
    - Document priority system
    - Add troubleshooting guide
    - _Requirements: All_
  
  - [x] 21.2 Add API documentation
    - Document all auto-approval API endpoints in OpenAPI spec
    - Include request/response examples
    - Document validation rules
    - _Requirements: All_
  
  - [x] 21.3 Create admin guide
    - Document how to configure cron job
    - Document environment variables
    - Document monitoring and alerting
    - _Requirements: 5.1_

- [x] 22. Final Checkpoint - Complete Feature
  - Run full test suite (unit + property + integration tests)
  - Test end-to-end workflow: create rule → pending change → auto-approval → store update → email
  - Verify all acceptance criteria are met
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Checkpoints ensure incremental validation at key milestones
- Implementation follows bottom-up approach: database → services → API → UI
- All code uses TypeScript for type safety
- Prisma ORM prevents SQL injection
- Tenant isolation enforced at all layers
