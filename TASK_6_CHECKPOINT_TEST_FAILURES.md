# Task 6 Checkpoint: Test Failure Analysis

## Summary

Task 6 checkpoint revealed test failures in two test suites:
- **error-capture.test.ts**: 7 failures
- **alert-deduplication.test.ts**: 10 failures

## Test Results

### Passing Tests
- ✅ alert-rules-evaluator.test.ts (all tests passing)
- ✅ metrics-collector.test.ts (all tests passing)

### Failing Tests

#### 1. Error Capture Service (7 failures)

**Issue**: The `logLocally` method is not being called when Sentry is unavailable.

**Root Cause**: The implementation only calls `logLocally` as a fallback when `sendToSentry` fails, but when `sentryAvailable` is `false`, it should call `logLocally` directly instead of attempting to send to Sentry.

**Current Flow**:
```typescript
if (this.sentryAvailable) {
    await this.sendToSentry(sanitizedError, sanitizedContext);
} else {
    // This branch is never reached in tests because sentryAvailable is checked
    this.logLocally(sanitizedError, sanitizedContext);
}
```

**Expected Flow**: When `sentryAvailable` is `false`, should immediately call `logLocally`.

**Failed Tests**:
1. Should capture error and log locally when Sentry is unavailable
2. Should sanitize credit card numbers in error message
3. Should sanitize SSN in error message
4. Should sanitize sensitive fields in additional data
5. Should track error frequency for grouping
6. Should convert non-Error exceptions to Error
7. Should handle Error exceptions directly

#### 2. Alert Deduplication Manager (10 failures)

**Issue**: Redis mock is not properly configured, causing the service to think Redis is unavailable.

**Root Cause**: The `AlertDeduplicationManager` constructor checks for environment variables to initialize Redis:
```typescript
this.redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ ... })
    : null;
```

In tests, these environment variables are not set, so `this.redis` is `null`, causing the service to skip Redis operations.

**Failed Tests**:
1. Should suppress alert when recently sent (within 15 minutes)
2. Should store alert state with correct TTL
3. Should include all required fields in state record
4. Should update existing alert state to resolved
5. Should include resolvedAt timestamp
6. Should not update if no existing state
7. Should handle system-wide alerts (no tenantId)
8. Should generate consistent fingerprints for same alert (timeout)
9. Should generate different fingerprints for different tenants (timeout)
10. Should generate different fingerprints for different metric types (timeout)

**Additional Issue**: The `isInMaintenanceWindow` method references `prisma.monitoringMaintenanceWindow` which doesn't exist in the Prisma schema yet.

## Required Fixes

### Fix 1: Error Capture Service
Update the `captureError` method to call `logLocally` directly when Sentry is unavailable:

```typescript
// In captureError method
if (this.sentryAvailable) {
    await this.sendToSentry(sanitizedError, sanitizedContext);
} else {
    // Call logLocally directly when Sentry is unavailable
    this.logLocally(sanitizedError, sanitizedContext);
}
```

### Fix 2: Alert Deduplication Manager
The test setup needs to:
1. Mock the Redis instance properly by injecting it via constructor
2. Add the `monitoringMaintenanceWindow` table to the Prisma schema
3. Update the constructor to accept an optional Redis instance for testing

**Recommended Constructor Change**:
```typescript
constructor(redis?: Redis | null) {
    this.redis = redis !== undefined
        ? redis
        : (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
            ? new Redis({ ... })
            : null);
}
```

### Fix 3: Prisma Schema
Add the `monitoringMaintenanceWindow` table:
```prisma
model MonitoringMaintenanceWindow {
  id          String   @id @default(uuid())
  name        String
  description String?
  startTime   DateTime
  endTime     DateTime
  isActive    Boolean  @default(true)
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("monitoring_maintenance_windows")
}
```

## Next Steps

The user needs to decide:
1. **Fix the implementations** to match test expectations
2. **Update the tests** to match current implementation behavior
3. **Combination**: Fix critical issues and adjust tests where appropriate

## Recommendation

I recommend fixing the implementations because:
1. The test expectations align with the requirements
2. The current implementation has logical gaps (not calling logLocally when Sentry is unavailable)
3. The Redis injection pattern is a better design for testability
4. The Prisma schema is incomplete and needs the maintenance window table

Would you like me to proceed with fixing these issues?
