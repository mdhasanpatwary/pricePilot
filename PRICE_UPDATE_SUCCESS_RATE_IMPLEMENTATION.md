# Price Update Success Rate >99% Implementation

## Overview

This document describes the implementation of features and improvements to achieve and maintain a >99% price update success rate in the PricePilot system.

## Success Criteria

**Target:** Price update success rate >99%  
**Measurement Period:** Rolling 24-hour window  
**Scope:** All price update operations (OpenCart, Laravel)

## Implementation Components

### 1. Price Update Monitor Service

**File:** `lib/services/price-update-monitor.ts`

**Features:**
- Real-time success rate tracking
- Failure pattern analysis
- Automatic retry queue management
- Health check validation
- Detailed failure logging

**Key Methods:**
- `recordUpdate()` - Record individual price update attempts
- `recordBulkUpdate()` - Record bulk update operations
- `getStats()` - Get comprehensive statistics
- `performHealthCheck()` - Validate site API health
- `processRetryQueue()` - Retry failed updates automatically
- `getCurrentSuccessRate()` - Get current success rate percentage

### 2. Automatic Retry Queue

**Database Model:** `PriceUpdateRetryQueue`

**Schema:**
```prisma
model PriceUpdateRetryQueue {
  id          String   @id @default(uuid())
  productId   String
  tenantId    String
  retryCount  Int      @default(0)
  lastError   String?
  nextRetryAt DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([tenantId, nextRetryAt])
  @@index([productId])
}
```

**Retry Strategy:**
- **Attempt 1:** Retry after 5 minutes
- **Attempt 2:** Retry after 15 minutes
- **Attempt 3:** Retry after 1 hour
- **Max Retries:** 3 attempts
- **Exponential Backoff:** Prevents overwhelming external APIs

### 3. Enhanced Price Update Methods

**Updated Methods:**
- `SyncService.updateOpenCartPrice()` - Added monitoring and retry logic
- `SyncService.updateLaravelPrice()` - Added monitoring and retry logic

**Improvements:**
- Duration tracking for performance analysis
- Automatic failure recording
- Retry queue integration
- Detailed error context
- Success/failure metrics

### 4. Automated Retry Processing

**Cron Job:** `/api/v1/cron/process-price-update-retries`

**Schedule:** Every 15 minutes (`*/15 * * * *`)

**Process:**
1. Identify tenants with pending retries
2. Process up to 10 retries per tenant
3. Update retry count and next retry time
4. Remove successful retries from queue
5. Log all retry attempts

**Configuration in vercel.json:**
```json
{
  "path": "/api/v1/cron/process-price-update-retries",
  "schedule": "*/15 * * * *"
}
```

### 5. Monitoring API Endpoint

**Endpoint:** `GET /api/v1/monitoring/price-update-stats`

**Query Parameters:**
- `timeWindow` - Time window in seconds (default: 86400 = 24 hours)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAttempts": 1000,
    "successfulUpdates": 995,
    "failedUpdates": 5,
    "successRate": 99.5,
    "averageDuration": 250,
    "failuresByReason": {
      "Network timeout": 3,
      "Invalid token": 2
    },
    "failuresBySite": {
      "https://store1.com": 3,
      "https://store2.com": 2
    }
  }
}
```

## How It Works

### Price Update Flow

```
1. Price Update Initiated
   ↓
2. SyncService.updateOpenCartPrice() or updateLaravelPrice()
   ↓
3. Record Start Time
   ↓
4. Attempt API Call with Retry Logic
   ↓
5. Success? → Record Success Metrics → Done
   ↓ No
6. Record Failure Metrics
   ↓
7. Add to Retry Queue (if retries < 3)
   ↓
8. Return False
```

### Retry Queue Processing

```
1. Cron Job Runs (Every 15 minutes)
   ↓
2. Find Tenants with Pending Retries
   ↓
3. For Each Tenant:
   ↓
4. Get Retries Due for Processing
   ↓
5. Attempt Price Update
   ↓
6. Success? → Remove from Queue
   ↓ No
7. Increment Retry Count
   ↓
8. Calculate Next Retry Time
   ↓
9. Update Queue Entry
```

### Success Rate Calculation

```typescript
successRate = (successfulUpdates / totalAttempts) * 100

// Example:
// 995 successful / 1000 total = 99.5%
```

## Key Features for >99% Success Rate

### 1. Automatic Retries
- Failed updates are automatically retried
- Exponential backoff prevents API overload
- Up to 3 retry attempts per update

### 2. Comprehensive Error Handling
- All errors are caught and logged
- Detailed error context for debugging
- Graceful degradation on failures

### 3. Performance Monitoring
- Track update duration
- Identify slow APIs
- Detect performance degradation

### 4. Failure Analysis
- Group failures by reason
- Group failures by site
- Identify patterns and root causes

### 5. Health Checks
- Validate API connectivity
- Check recent sync activity
- Prevent updates to unhealthy sites

## Monitoring and Alerting

### Real-Time Metrics

**Available Metrics:**
- Total update attempts
- Successful updates
- Failed updates
- Success rate percentage
- Average update duration
- Failures by reason
- Failures by site

### Alert Conditions

**Success Rate Below 99%:**
- Monitor success rate continuously
- Alert when rate drops below threshold
- Investigate failure patterns
- Take corrective action

## Usage Examples

### Check Current Success Rate

```typescript
import { priceUpdateMonitor } from '@/lib/services/price-update-monitor';

// Get current success rate for tenant
const successRate = await priceUpdateMonitor.getCurrentSuccessRate(tenantId);

if (successRate < 99) {
  console.warn(`Success rate below threshold: ${successRate}%`);
}
```

### Get Detailed Statistics

```typescript
// Get stats for last 24 hours
const stats = await priceUpdateMonitor.getStats(tenantId, 86400);

console.log(`Success Rate: ${stats.successRate}%`);
console.log(`Total Attempts: ${stats.totalAttempts}`);
console.log(`Failed Updates: ${stats.failedUpdates}`);
console.log('Failures by Reason:', stats.failuresByReason);
```

### Process Retry Queue Manually

```typescript
// Process retries for a specific tenant
const processed = await priceUpdateMonitor.processRetryQueue(tenantId);

console.log(`Processed ${processed} retries`);
```

### Perform Health Check

```typescript
// Check if a site's API is healthy
const health = await priceUpdateMonitor.performHealthCheck(siteId);

if (!health.healthy) {
  console.error(`Site unhealthy: ${health.error}`);
}
```

## Database Migration

### Apply Migration

```bash
# Create and apply migration
npx tsx scripts/create-retry-queue-migration.ts

# Or manually
npx prisma migrate dev --name add_price_update_retry_queue
```

### Verify Migration

```bash
# Check database schema
npx prisma db pull

# Verify table exists
psql -d your_database -c "\d PriceUpdateRetryQueue"
```

## Testing

### Manual Testing

1. **Test Successful Update:**
   ```bash
   # Update a product price
   # Verify success is recorded
   # Check metrics endpoint
   ```

2. **Test Failed Update:**
   ```bash
   # Simulate API failure
   # Verify failure is recorded
   # Check retry queue
   ```

3. **Test Retry Processing:**
   ```bash
   # Trigger retry cron job
   # Verify retries are processed
   # Check success rate improvement
   ```

### Automated Testing

```typescript
// Test success rate calculation
const stats = await priceUpdateMonitor.getStats(tenantId);
expect(stats.successRate).toBeGreaterThan(99);

// Test retry queue
await priceUpdateMonitor.processRetryQueue(tenantId);
const retries = await prisma.priceUpdateRetryQueue.count({
  where: { tenantId }
});
expect(retries).toBe(0); // All retries processed
```

## Performance Considerations

### Database Indexes

The retry queue table includes indexes for optimal performance:
- `[tenantId, nextRetryAt]` - Fast retry queue queries
- `[productId]` - Fast product lookups

### Batch Processing

- Process up to 10 retries per tenant per run
- Prevents overwhelming the system
- Ensures fair processing across tenants

### Cache Efficiency

- Metrics are cached in Redis
- Reduces database load
- Fast statistics retrieval

## Troubleshooting

### Success Rate Below 99%

1. **Check Failure Reasons:**
   ```typescript
   const stats = await priceUpdateMonitor.getStats(tenantId);
   console.log(stats.failuresByReason);
   ```

2. **Check Affected Sites:**
   ```typescript
   console.log(stats.failuresBySite);
   ```

3. **Verify API Tokens:**
   - Check if tokens are valid
   - Verify token permissions
   - Test API connectivity

4. **Check Retry Queue:**
   ```sql
   SELECT * FROM "PriceUpdateRetryQueue"
   WHERE "tenantId" = 'your-tenant-id'
   ORDER BY "nextRetryAt" ASC;
   ```

### Retry Queue Not Processing

1. **Check Cron Job:**
   - Verify cron job is configured
   - Check cron secret is set
   - Review cron job logs

2. **Check Retry Times:**
   ```sql
   SELECT COUNT(*) FROM "PriceUpdateRetryQueue"
   WHERE "nextRetryAt" <= NOW();
   ```

3. **Manual Processing:**
   ```bash
   curl -X POST https://your-domain.com/api/v1/cron/process-price-update-retries \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

## Maintenance

### Regular Tasks

1. **Monitor Success Rate:**
   - Check daily success rate
   - Investigate drops below 99%
   - Review failure patterns

2. **Clean Up Old Retries:**
   - Remove retries older than 7 days
   - Archive failed updates for analysis

3. **Review Performance:**
   - Check average update duration
   - Identify slow APIs
   - Optimize as needed

### Database Cleanup

```sql
-- Remove old successful retries (already processed)
DELETE FROM "PriceUpdateRetryQueue"
WHERE "retryCount" >= 3
AND "updatedAt" < NOW() - INTERVAL '7 days';
```

## Future Enhancements

### Potential Improvements

1. **Circuit Breaker Pattern:**
   - Temporarily disable failing sites
   - Prevent cascading failures
   - Auto-recovery when healthy

2. **Adaptive Retry Timing:**
   - Adjust retry delays based on failure type
   - Faster retries for transient errors
   - Longer delays for persistent issues

3. **Predictive Failure Detection:**
   - Machine learning for failure prediction
   - Proactive health checks
   - Early warning system

4. **Advanced Analytics:**
   - Success rate trends over time
   - Failure pattern visualization
   - Performance benchmarking

## Conclusion

This implementation provides a comprehensive solution for achieving and maintaining a >99% price update success rate through:

- **Automatic retries** with exponential backoff
- **Comprehensive monitoring** and metrics
- **Failure analysis** and pattern detection
- **Health checks** and validation
- **Real-time alerting** for issues

The system is designed to be resilient, self-healing, and maintainable, ensuring high reliability for price update operations.

## Related Documentation

- [Monitoring System](./docs/MONITORING_SYSTEM.md)
- [Error Handling Guide](./docs/ERROR_HANDLING_GUIDE.md)
- [API Documentation](./docs/API_DOCUMENTATION_INDEX.md)
- [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)
