# Design Document: Price Approval Auto-Approval Rules

## Overview

This design document specifies the technical implementation of an auto-approval rules engine for the PricePilot price approval workflow. The system will allow tenants to configure rules that automatically approve price changes meeting specific criteria, reducing manual review workload while maintaining pricing control.

### Key Design Goals

- **Flexibility**: Support multiple condition types for fine-grained control
- **Safety**: Validate rules to prevent unintended approvals
- **Transparency**: Maintain complete audit trail of auto-approval decisions
- **Performance**: Efficiently evaluate rules without impacting system performance
- **Integration**: Seamlessly integrate with existing approval workflow

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     PricePilot System                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  Price Approval  │────────▶│  Auto-Approval   │          │
│  │     Workflow     │         │  Rules Engine    │          │
│  └──────────────────┘         └──────────────────┘          │
│           │                            │                     │
│           │                            │                     │
│           ▼                            ▼                     │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │ Pending Price    │◀────────│  Rule Evaluator  │          │
│  │    Changes       │         │                  │          │
│  └──────────────────┘         └──────────────────┘          │
│           │                            │                     │
│           │                            │                     │
│           ▼                            ▼                     │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  Price Update    │         │  Audit Logger    │          │
│  │    Service       │         │                  │          │
│  └──────────────────┘         └──────────────────┘          │
│           │                            │                     │
│           │                            │                     │
│           ▼                            ▼                     │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  User Store API  │         │  Email Service   │          │
│  └──────────────────┘         └──────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Rule Creation**: Merchant creates auto-approval rule via UI
2. **Rule Storage**: Rule saved to database with conditions
3. **Cron Trigger**: Scheduled job runs hourly
4. **Rule Evaluation**: System evaluates pending changes against rules
5. **Auto-Approval**: Matching changes are approved automatically
6. **Price Update**: Approved prices are pushed to user's store
7. **Audit Logging**: All actions are logged for transparency
8. **Notification**: Email sent to merchant with summary

## Components and Interfaces

### 1. AutoApprovalRule Model (Prisma Schema)

```prisma
model AutoApprovalRule {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  description String?
  enabled     Boolean  @default(true)
  priority    Int      @default(1)
  conditions  Json     // Stores rule conditions as JSON
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@index([tenantId, enabled, priority])
  @@index([tenantId])
}
```

### 2. Rule Conditions Schema

```typescript
interface RuleConditions {
  maxPriceChange?: number;        // Max change in currency (e.g., 50.00)
  maxPercentageChange?: number;   // Max change in % (e.g., 5.0)
  minConfidenceScore?: number;    // Min match confidence (0-100)
  allowedStrategies?: string[];   // e.g., ["UNDERCUT", "MATCH"]
  productCategories?: string[];   // e.g., ["Electronics", "Computers"]
  priceRange?: {
    min: number;                  // Minimum product price
    max: number;                  // Maximum product price
  };
}
```

### 3. AutoApprovalService

```typescript
// lib/services/auto-approval.ts

export class AutoApprovalService {
  /**
   * Evaluate if a pending price change should be auto-approved
   * @param change - The pending price change to evaluate
   * @param tenantId - The tenant ID for rule lookup
   * @returns Object with approval decision and reason
   */
  static async shouldAutoApprove(
    change: PendingPriceChange,
    tenantId: string
  ): Promise<{ approved: boolean; ruleId?: string; ruleName?: string; reason: string }>;
  
  /**
   * Process all pending changes for auto-approval
   * @param tenantId - The tenant ID to process
   * @returns Number of changes auto-approved
   */
  static async processAutoApprovals(tenantId: string): Promise<number>;
  
  /**
   * Evaluate a single rule against a pending change
   * @param rule - The auto-approval rule
   * @param change - The pending price change
   * @param product - The product with match data
   * @returns True if all conditions are satisfied
   */
  private static async evaluateRule(
    rule: AutoApprovalRule,
    change: PendingPriceChange,
    product: Product
  ): Promise<boolean>;
  
  /**
   * Validate rule conditions before saving
   * @param conditions - The rule conditions to validate
   * @throws ValidationError if conditions are invalid
   */
  static validateRuleConditions(conditions: RuleConditions): void;
}
```

### 4. Cron Job Endpoint

```typescript
// app/api/v1/cron/auto-approval/route.ts

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Verify cron secret
  // Get all tenants with enabled auto-approval rules
  // Process auto-approvals for each tenant
  // Return summary of results
}
```

### 5. API Endpoints

```typescript
// app/api/v1/auto-approval-rules/route.ts

// GET /api/v1/auto-approval-rules
// List all auto-approval rules for tenant
export async function GET(req: NextRequest): Promise<NextResponse>;

// POST /api/v1/auto-approval-rules
// Create new auto-approval rule
export async function POST(req: NextRequest): Promise<NextResponse>;

// app/api/v1/auto-approval-rules/[id]/route.ts

// GET /api/v1/auto-approval-rules/:id
// Get single auto-approval rule
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse>;

// PUT /api/v1/auto-approval-rules/:id
// Update auto-approval rule
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse>;

// DELETE /api/v1/auto-approval-rules/:id
// Delete auto-approval rule
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse>;

// PATCH /api/v1/auto-approval-rules/:id/toggle
// Enable/disable auto-approval rule
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse>;
```

### 6. UI Components

```typescript
// components/dashboard/auto-approval-rules-list.tsx
// Displays list of auto-approval rules with enable/disable toggles

// components/dashboard/auto-approval-rule-form.tsx
// Form for creating/editing auto-approval rules

// components/dashboard/auto-approval-metrics.tsx
// Dashboard widget showing auto-approval statistics

// app/dashboard/auto-approval-rules/page.tsx
// Main page for managing auto-approval rules
```

## Data Models

### AutoApprovalRule

| Field       | Type     | Description                                    |
|-------------|----------|------------------------------------------------|
| id          | String   | Unique identifier (UUID)                       |
| tenantId    | String   | Foreign key to Tenant                          |
| name        | String   | Human-readable rule name                       |
| description | String?  | Optional description of rule purpose           |
| enabled     | Boolean  | Whether rule is active (default: true)         |
| priority    | Int      | Evaluation order (lower = higher priority)     |
| conditions  | Json     | Rule conditions (see RuleConditions schema)    |
| createdAt   | DateTime | Timestamp of rule creation                     |
| updatedAt   | DateTime | Timestamp of last update                       |

### Updated PendingPriceChange

The existing `PendingPriceChange` model will be extended to track auto-approval:

| Field            | Type     | Description                                |
|------------------|----------|--------------------------------------------|
| autoApprovedBy   | String?  | ID of rule that auto-approved (if any)     |
| autoApprovedAt   | DateTime?| Timestamp of auto-approval (if any)        |

**Note**: These fields will be added via Prisma migration.

### Audit Log Entry

Auto-approval actions will be logged to the existing `TenantAuditLog` model:

```typescript
{
  action: "AUTO_APPROVE_PRICE",
  entityId: pendingChangeId,
  details: JSON.stringify({
    ruleId: rule.id,
    ruleName: rule.name,
    productId: change.productId,
    oldPrice: change.currentPrice,
    newPrice: change.recommendedPrice,
    reason: "Auto-approved by rule: [rule name]"
  })
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I've identified the following areas where properties can be consolidated:

**Redundancy Analysis:**

1. **Rule CRUD Operations (1.1-1.5)**: Properties 1.1, 1.2, 1.3 test basic CRUD operations. These can be combined into a single comprehensive property about rule lifecycle management.

2. **Condition Support (2.1-2.6)**: All six properties test that different condition types are supported. These can be combined into one property that validates the conditions schema supports all required fields.

3. **Rule Evaluation Order (3.1-3.2)**: These two properties both test priority-based evaluation. Property 3.2 (short-circuit) is a consequence of 3.1 (priority order), so they can be combined.

4. **Auto-Approval Actions (4.1-4.5)**: These five properties all test different aspects of the auto-approval transaction. They can be combined into one comprehensive property about auto-approval atomicity.

5. **Audit Trail (6.1, 6.3-6.5)**: These properties all test audit logging completeness. They can be combined into one property about complete audit trails.

6. **Email Notifications (7.1-7.3)**: These three properties test email content. They can be combined into one property about notification completeness.

7. **Validation Rules (9.1-9.5)**: These five properties all test input validation. They can be combined into one comprehensive validation property.

**Consolidated Properties:**

After reflection, I've reduced the testable properties from 50+ to 25 unique, non-redundant properties that provide comprehensive validation coverage.

### Correctness Properties

**Property 1: Rule Lifecycle Management**
*For any* auto-approval rule, creating it should result in a stored rule with all required fields (id, tenantId, name, enabled, priority, conditions), updating it should change the updatedAt timestamp, disabling it should set enabled=false without deletion, and deleting it should remove it from the database.
**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

**Property 2: Tenant Isolation for Rules**
*For any* tenant, querying auto-approval rules should return only rules belonging to that tenant, and attempting to access another tenant's rules should fail.
**Validates: Requirements 1.6**

**Property 3: Conditions Schema Completeness**
*For any* auto-approval rule, the conditions JSON should support all required fields: maxPriceChange, maxPercentageChange, minConfidenceScore, allowedStrategies, productCategories, and priceRange with min/max.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

**Property 4: Condition Validation**
*For any* rule conditions, maxPriceChange must be positive, maxPercentageChange must be 0-100, minConfidenceScore must be 0-100, priceRange.min must be less than priceRange.max, and at least one condition must be specified.
**Validates: Requirements 2.7, 9.1, 9.2, 9.3, 9.4, 9.5**

**Property 5: All Conditions Must Match (AND Logic)**
*For any* pending price change and rule with multiple conditions, the change should only be auto-approved if ALL conditions are satisfied, not just some.
**Validates: Requirements 2.8**

**Property 6: Priority-Based Evaluation with Short-Circuit**
*For any* set of enabled rules with different priorities, when evaluating a pending change, rules should be evaluated in ascending priority order (lower numbers first), and evaluation should stop at the first matching rule.
**Validates: Requirements 3.1, 3.2**

**Property 7: Non-Matching Changes Stay Pending**
*For any* pending price change that doesn't match any enabled rule, the change status should remain PENDING after evaluation.
**Validates: Requirements 3.3**

**Property 8: Only PENDING Changes Are Evaluated**
*For any* set of price changes with different statuses (PENDING, APPROVED, REJECTED, EXPIRED), only changes with PENDING status should be evaluated by the auto-approval engine.
**Validates: Requirements 3.4**

**Property 9: Disabled Rules Are Skipped**
*For any* rule with enabled=false, that rule should not be evaluated during auto-approval processing, even if it would match pending changes.
**Validates: Requirements 3.5, 1.4**

**Property 10: Auto-Approval Transaction Atomicity**
*For any* pending price change that matches a rule, auto-approval should atomically: (1) update status to APPROVED, (2) record the rule ID, (3) execute price update to store, (4) create price history record, and (5) create audit log entry. If any step fails, all changes should be rolled back.
**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

**Property 11: Store Update Failure Rollback**
*For any* auto-approved change where the store API update fails, the approval status should be reverted to PENDING and no price history or audit log should be created.
**Validates: Requirements 4.6**

**Property 12: Multi-Tenant Processing**
*For any* set of tenants with enabled auto-approval rules, the cron job should process auto-approvals for all tenants, and failure for one tenant should not prevent processing of other tenants.
**Validates: Requirements 5.2, 5.5**

**Property 13: Complete Pending Change Evaluation**
*For any* tenant with PENDING price changes, the auto-approval process should evaluate all PENDING changes, not just a subset.
**Validates: Requirements 5.3**

**Property 14: Auto-Approval Count Logging**
*For any* auto-approval processing run, the system should log the number of changes auto-approved per tenant.
**Validates: Requirements 5.4**

**Property 15: Complete Audit Trail**
*For any* auto-approved price change, there should exist an audit log entry containing the rule ID, rule name, product ID, old price, new price, and reason, with a timestamp.
**Validates: Requirements 6.1, 6.3, 6.4, 6.5**

**Property 16: Email Notification Completeness**
*For any* tenant with auto-approved changes and users with emailNotifications=true, an email should be sent containing the count of auto-approved changes and the names of rules that triggered approvals.
**Validates: Requirements 7.1, 7.2, 7.3**

**Property 17: Email Notification Batching**
*For any* tenant with multiple auto-approved changes in a single processing run, only one email notification should be sent (batched), not one per change.
**Validates: Requirements 7.4**

**Property 18: Email Notification Preferences**
*For any* user with emailNotifications=false, no auto-approval emails should be sent to that user, regardless of how many changes are auto-approved.
**Validates: Requirements 7.5**

**Property 19: Per-Rule Metrics Tracking**
*For any* auto-approval rule, the system should track how many times that rule has triggered an auto-approval.
**Validates: Requirements 8.1, 8.4**

**Property 20: Non-Matching Changes Metrics**
*For any* pending price change that doesn't match any rule, the system should increment a counter for non-matching changes.
**Validates: Requirements 8.2**

**Property 21: Auto-Approval Percentage Calculation**
*For any* tenant, the auto-approval percentage should be calculated as (auto-approved count / total changes) × 100.
**Validates: Requirements 8.5**

**Property 22: Manual Approval Compatibility**
*For any* tenant with auto-approval rules enabled, manual approval of pending changes should still function correctly and independently.
**Validates: Requirements 10.1**

**Property 23: Manual Approval Takes Precedence**
*For any* pending price change that is manually approved or rejected before auto-approval runs, the auto-approval process should skip that change and not modify its status.
**Validates: Requirements 10.2, 10.3**

**Property 24: Manual Approval Independence**
*For any* tenant with all auto-approval rules disabled or deleted, the manual approval workflow should continue to function without any degradation.
**Validates: Requirements 10.5**

**Property 25: Price Change Amount Condition**
*For any* rule with maxPriceChange condition and pending change, the change should only match if |recommendedPrice - currentPrice| ≤ maxPriceChange.
**Validates: Requirements 2.1**

**Property 26: Percentage Change Condition**
*For any* rule with maxPercentageChange condition and pending change, the change should only match if |(recommendedPrice - currentPrice) / currentPrice × 100| ≤ maxPercentageChange.
**Validates: Requirements 2.2**

**Property 27: Confidence Score Condition**
*For any* rule with minConfidenceScore condition and pending change, the change should only match if the product match confidence score ≥ minConfidenceScore.
**Validates: Requirements 2.3**

**Property 28: Strategy Filtering Condition**
*For any* rule with allowedStrategies condition and pending change, the change should only match if the appliedRule (pricing strategy) is in the allowedStrategies list.
**Validates: Requirements 2.4**

**Property 29: Category Filtering Condition**
*For any* rule with productCategories condition and pending change, the change should only match if the product's category is in the productCategories list.
**Validates: Requirements 2.5**

**Property 30: Price Range Condition**
*For any* rule with priceRange condition and pending change, the change should only match if priceRange.min ≤ recommendedPrice ≤ priceRange.max.
**Validates: Requirements 2.6**

## Error Handling

### Validation Errors

```typescript
class RuleValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'RuleValidationError';
  }
}

// Validation examples:
// - maxPriceChange must be positive
// - maxPercentageChange must be 0-100
// - minConfidenceScore must be 0-100
// - priceRange.min must be < priceRange.max
// - At least one condition must be specified
```

### Processing Errors

```typescript
class AutoApprovalProcessingError extends Error {
  constructor(
    message: string,
    public tenantId: string,
    public changeId?: string
  ) {
    super(message);
    this.name = 'AutoApprovalProcessingError';
  }
}

// Error scenarios:
// - Rule evaluation failure
// - Store API update failure
// - Database transaction failure
// - Email notification failure
```

### Error Recovery

1. **Rule Evaluation Errors**: Log error, skip rule, continue with next rule
2. **Store Update Errors**: Rollback approval, revert to PENDING status
3. **Database Errors**: Rollback transaction, log error, notify admin
4. **Email Errors**: Log error, continue processing (non-critical)
5. **Tenant Processing Errors**: Log error, continue with next tenant

### Error Logging

All errors should be logged with:
- Error type and message
- Tenant ID
- Rule ID (if applicable)
- Change ID (if applicable)
- Stack trace
- Timestamp

## Testing Strategy

### Unit Tests

Focus on specific examples and edge cases:

1. **Rule Validation Tests**
   - Test valid rule creation
   - Test invalid conditions (negative values, out of range)
   - Test empty conditions rejection
   - Test price range validation

2. **Condition Evaluation Tests**
   - Test each condition type individually
   - Test multiple conditions (AND logic)
   - Test edge cases (exact threshold values)

3. **Priority Evaluation Tests**
   - Test rules evaluated in priority order
   - Test short-circuit behavior
   - Test disabled rules are skipped

4. **Error Handling Tests**
   - Test store update failure rollback
   - Test tenant isolation on errors
   - Test email failure doesn't block processing

### Property-Based Tests

Verify universal properties across all inputs (minimum 100 iterations per test):

1. **Property Test: Tenant Isolation**
   - Generate random rules for different tenants
   - Verify no cross-tenant access
   - **Tag**: Feature: price-approval-auto-approval-rules, Property 2: Tenant Isolation for Rules

2. **Property Test: Condition Validation**
   - Generate random invalid conditions
   - Verify all are rejected
   - **Tag**: Feature: price-approval-auto-approval-rules, Property 4: Condition Validation

3. **Property Test: AND Logic**
   - Generate rules with multiple conditions
   - Generate changes that match some but not all
   - Verify no auto-approval
   - **Tag**: Feature: price-approval-auto-approval-rules, Property 5: All Conditions Must Match

4. **Property Test: Priority Order**
   - Generate multiple rules with random priorities
   - Verify evaluation order
   - **Tag**: Feature: price-approval-auto-approval-rules, Property 6: Priority-Based Evaluation

5. **Property Test: Transaction Atomicity**
   - Generate random auto-approvals
   - Verify all steps complete or all rollback
   - **Tag**: Feature: price-approval-auto-approval-rules, Property 10: Auto-Approval Transaction Atomicity

6. **Property Test: Audit Trail Completeness**
   - Generate random auto-approvals
   - Verify audit log exists for each
   - **Tag**: Feature: price-approval-auto-approval-rules, Property 15: Complete Audit Trail

7. **Property Test: Manual Approval Precedence**
   - Generate changes, manually approve some
   - Run auto-approval
   - Verify manual approvals are not modified
   - **Tag**: Feature: price-approval-auto-approval-rules, Property 23: Manual Approval Takes Precedence

### Integration Tests

Test interactions between components:

1. **Cron Job Integration**
   - Test cron endpoint authentication
   - Test multi-tenant processing
   - Test error isolation between tenants

2. **Store API Integration**
   - Test price update to OpenCart
   - Test price update to Laravel
   - Test failure handling and rollback

3. **Email Integration**
   - Test email sending
   - Test batching behavior
   - Test user preference respect

4. **Database Integration**
   - Test transaction rollback
   - Test concurrent rule evaluation
   - Test audit log creation

### End-to-End Tests

Test complete workflows:

1. **Happy Path**: Create rule → Pending change matches → Auto-approved → Store updated → Email sent
2. **No Match Path**: Create rule → Pending change doesn't match → Stays pending
3. **Store Failure Path**: Create rule → Match → Store update fails → Rollback to pending
4. **Manual Override Path**: Create rule → Manual approval → Auto-approval skips
5. **Multi-Rule Path**: Create multiple rules → Change matches first by priority

## Performance Considerations

### Database Query Optimization

```typescript
// Efficient rule loading with single query
const rules = await prisma.autoApprovalRule.findMany({
  where: { tenantId, enabled: true },
  orderBy: { priority: 'asc' }
});

// Efficient pending change loading with includes
const pendingChanges = await prisma.pendingPriceChange.findMany({
  where: { tenantId, status: 'PENDING' },
  include: {
    product: {
      include: {
        matchesAsUser: {
          include: { competitorProduct: true }
        }
      }
    }
  }
});
```

### Batch Processing

```typescript
// Process changes in batches to avoid memory issues
const BATCH_SIZE = 100;

for (let i = 0; i < pendingChanges.length; i += BATCH_SIZE) {
  const batch = pendingChanges.slice(i, i + BATCH_SIZE);
  await processBatch(batch, rules);
}
```

### Caching

```typescript
// Cache rules per tenant to avoid repeated queries
const ruleCache = new Map<string, AutoApprovalRule[]>();

async function getRulesForTenant(tenantId: string): Promise<AutoApprovalRule[]> {
  if (!ruleCache.has(tenantId)) {
    const rules = await loadRules(tenantId);
    ruleCache.set(tenantId, rules);
  }
  return ruleCache.get(tenantId)!;
}
```

### Metrics

Track performance metrics:
- Average rule evaluation time
- Average auto-approval processing time per tenant
- Number of changes processed per minute
- Database query performance

## Security Considerations

### Authentication & Authorization

- All API endpoints require authentication
- Tenant isolation enforced at database level
- Users can only manage rules for their own tenant
- Audit logs track all rule modifications

### Input Validation

- Validate all rule conditions before saving
- Sanitize rule names and descriptions
- Prevent SQL injection via Prisma ORM
- Validate numeric ranges (0-100 for percentages)

### Rate Limiting

- Apply standard API rate limits to rule management endpoints
- Cron job has no rate limit (internal)
- Prevent abuse of rule creation (max 50 rules per tenant)

### Data Privacy

- No sensitive data in rule conditions
- Audit logs contain only necessary information
- Email notifications don't include sensitive pricing data
- Comply with tenant data isolation requirements

## Deployment Considerations

### Database Migration

```prisma
// Migration: Add AutoApprovalRule model
model AutoApprovalRule {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  description String?
  enabled     Boolean  @default(true)
  priority    Int      @default(1)
  conditions  Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@index([tenantId, enabled, priority])
  @@index([tenantId])
}

// Migration: Update PendingPriceChange model
model PendingPriceChange {
  // ... existing fields ...
  autoApprovedBy   String?   // Rule ID that auto-approved
  autoApprovedAt   DateTime? // Timestamp of auto-approval
}
```

### Cron Job Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/v1/cron/auto-approval",
      "schedule": "0 * * * *"  // Every hour
    }
  ]
}
```

### Environment Variables

```bash
# Required for cron authentication
CRON_SECRET=<secure-random-string>

# Email configuration (if not already set)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@pricepilot.com
SMTP_PASS=<secure-password>
SMTP_FROM=noreply@pricepilot.com
```

### Rollback Plan

If issues arise after deployment:

1. **Disable Auto-Approval**: Set all rules to enabled=false via SQL
2. **Stop Cron Job**: Remove cron configuration from vercel.json
3. **Revert Migration**: Run down migration to remove new fields
4. **Monitor**: Check audit logs for any issues
5. **Communicate**: Notify users of temporary manual approval requirement

## Monitoring & Alerting

### Metrics to Track

- Number of auto-approvals per hour
- Auto-approval success rate
- Rule evaluation time (p50, p95, p99)
- Store update failure rate
- Email delivery rate
- Number of active rules per tenant

### Alerts to Configure

- **Critical**: Auto-approval processing failure for >10 minutes
- **Warning**: Store update failure rate >10%
- **Warning**: Email delivery failure rate >20%
- **Info**: New rule created
- **Info**: Rule disabled/enabled

### Logging

Log the following events:
- Rule creation/update/deletion
- Auto-approval processing start/end
- Each auto-approval decision (approved/skipped)
- Store update success/failure
- Email notification success/failure
- Errors with full context

---

**Design Version**: 1.0  
**Last Updated**: January 2025  
**Status**: Ready for Implementation
