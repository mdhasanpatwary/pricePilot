# Retry Queue System

## Overview

The Retry Queue System provides automatic retry functionality for failed scraping requests with exponential backoff. When immediate retries fail, requests are added to a persistent queue for later processing.

## Architecture

### Components

1. **RetryQueueService** (`lib/services/retry-queue.ts`)
   - Manages retry queue items in the database
   - Implements exponential backoff scheduling
   - Provides queue statistics and cleanup

2. **RetryQueueProcessor** (`lib/services/retry-queue-processor.ts`)
   - Background worker that processes the retry queue
   - Executes retries with fresh browser contexts
   - Updates product data on successful retries

3. **ScraperService Integration**
   - `scrapeProductPageWithRetryQueue()` method adds failed requests to queue
   - Automatic fallback after immediate retries exhausted

## Retry Schedule

The system uses exponential backoff with the following delays:

| Attempt | Delay     |
|---------|-----------|
| 1       | 5 minutes |
| 2       | 15 minutes|
| 3       | 1 hour    |
| 4       | 6 hours   |

After 4 failed attempts, the request is marked as permanently failed.

## Usage

### Basic Usage

```typescript
import { ScraperService } from '@/lib/services/scraper';

const scraper = new ScraperService();

// Scrape with automatic retry queue fallback
const result = await scraper.scrapeProductPageWithRetryQueue(
  'https://example.com/product',
  'tenant-id',
  'site-id',
  'product-id'
);

if (result) {
  console.log('Successfully scraped:', result);
} else {
  console.log('Failed, added to retry queue');
}
```

### Starting the Retry Queue Worker

The retry queue processor should run as a background worker:

```bash
# Start with default interval (60 seconds)
ts-node scripts/start-retry-queue-worker.ts

# Start with custom interval (30 seconds)
ts-node scripts/start-retry-queue-worker.ts 30000
```

### Manual Queue Management

```typescript
import { RetryQueueService } from '@/lib/services/retry-queue';

const queueService = RetryQueueService.getInstance();

// Add item to queue manually
await queueService.addToRetryQueue({
  tenantId: 'tenant-1',
  siteId: 'site-1',
  productId: 'product-1',
  url: 'https://example.com/product',
  error: 'Connection timeout',
  maxRetries: 4,
});

// Get queue statistics
const stats = await queueService.getStats();
console.log('Queue stats:', stats);
// Output: { pending: 5, inProgress: 2, success: 10, failed: 3, total: 20 }

// Get next batch for processing
const items = await queueService.getNextRetryBatch(10);

// Mark item as successful
await queueService.markSuccess('item-id');

// Mark item as failed
await queueService.markFailed('item-id', 'Permanent error');

// Clean up old items (older than 7 days)
const deletedCount = await queueService.cleanupOldItems();
```

### Programmatic Processor Control

```typescript
import { RetryQueueProcessor } from '@/lib/services/retry-queue-processor';

const processor = RetryQueueProcessor.getInstance();

// Start processor
await processor.start(60000); // 60 second interval

// Check status
const status = processor.getStatus();
console.log('Processor running:', status.isRunning);

// Process queue immediately
await processor.processNow();

// Stop processor
await processor.stop();
```

## Database Schema

The retry queue uses the `RetryQueue` table:

```prisma
model RetryQueue {
  id              String   @id @default(uuid())
  tenantId        String
  siteId          String
  productId       String
  url             String
  retryCount      Int      @default(0)
  maxRetries      Int      @default(4)
  nextRetryAt     DateTime
  lastAttemptAt   DateTime?
  lastError       String?
  status          String   @default("PENDING") // PENDING, IN_PROGRESS, SUCCESS, FAILED
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([status, nextRetryAt])
  @@index([tenantId, siteId])
}
```

## Status Flow

```
PENDING → IN_PROGRESS → SUCCESS
                      ↓
                    FAILED (after max retries)
```

## Monitoring

### Queue Statistics

Monitor queue health with statistics:

```typescript
const stats = await queueService.getStats();

// Alert if too many pending items
if (stats.pending > 100) {
  console.warn('High number of pending retries:', stats.pending);
}

// Alert if high failure rate
const failureRate = stats.failed / stats.total;
if (failureRate > 0.3) {
  console.warn('High failure rate:', failureRate);
}
```

### Logging

The retry queue system logs all operations:

- `[RetryQueue]` - Queue service operations
- `[RetryQueueProcessor]` - Processor operations
- `[ScraperService]` - Integration with scraper

Example logs:

```
[RetryQueue] Adding new item to retry queue for product product-123
[RetryQueue] Calculated next retry time for attempt 1: 2024-01-27T10:05:00.000Z (delay: 300000ms)
[RetryQueueProcessor] Processing 5 retry items
[RetryQueueProcessor] ✅ Successfully retried product product-123
[RetryQueueProcessor] ❌ Product product-456 permanently failed after 4 attempts
```

## Best Practices

1. **Run Worker as Separate Process**
   - Don't run the processor in the main application process
   - Use a process manager (PM2, systemd) for reliability

2. **Monitor Queue Size**
   - Set up alerts for queue size thresholds
   - Investigate if queue grows continuously

3. **Regular Cleanup**
   - Schedule periodic cleanup of old items
   - Prevents database bloat

4. **Adjust Intervals**
   - Tune processing interval based on queue size
   - Lower interval for high-volume systems

5. **Error Analysis**
   - Review permanently failed items
   - Identify patterns in failures
   - Adjust scraping strategies accordingly

## Troubleshooting

### Queue Not Processing

1. Check if worker is running:
   ```bash
   ps aux | grep start-retry-queue-worker
   ```

2. Check processor status:
   ```typescript
   const status = processor.getStatus();
   console.log('Running:', status.isRunning);
   ```

3. Check for errors in logs

### High Failure Rate

1. Review error messages:
   ```sql
   SELECT lastError, COUNT(*) as count
   FROM RetryQueue
   WHERE status = 'FAILED'
   GROUP BY lastError
   ORDER BY count DESC;
   ```

2. Check if proxies are healthy
3. Verify site profiles are configured correctly

### Queue Growing Too Large

1. Increase worker processing interval
2. Add more worker instances
3. Review and fix underlying scraping issues

## API Reference

### RetryQueueService

#### `addToRetryQueue(options)`
Adds a failed request to the retry queue.

**Parameters:**
- `tenantId` (string): Tenant ID
- `siteId` (string): Site ID
- `productId` (string): Product ID
- `url` (string): Product URL
- `error` (string): Error message
- `maxRetries` (number, optional): Maximum retry attempts (default: 4)

**Returns:** `Promise<RetryQueueItem>`

#### `getNextRetryBatch(batchSize)`
Gets pending items ready for retry.

**Parameters:**
- `batchSize` (number, optional): Maximum items to return (default: 10)

**Returns:** `Promise<RetryQueueItem[]>`

#### `markSuccess(id)`
Marks an item as successfully processed.

**Parameters:**
- `id` (string): Retry queue item ID

**Returns:** `Promise<void>`

#### `markFailed(id, error)`
Marks an item as permanently failed.

**Parameters:**
- `id` (string): Retry queue item ID
- `error` (string): Error message

**Returns:** `Promise<void>`

#### `getStats()`
Gets queue statistics.

**Returns:** `Promise<{ pending, inProgress, success, failed, total }>`

#### `cleanupOldItems()`
Deletes completed items older than 7 days.

**Returns:** `Promise<number>` - Number of deleted items

### RetryQueueProcessor

#### `start(intervalMs)`
Starts the retry queue processor.

**Parameters:**
- `intervalMs` (number, optional): Processing interval in milliseconds (default: 60000)

**Returns:** `Promise<void>`

#### `stop()`
Stops the retry queue processor.

**Returns:** `Promise<void>`

#### `processNow()`
Processes the queue immediately.

**Returns:** `Promise<void>`

#### `getStatus()`
Gets processor status.

**Returns:** `{ isRunning: boolean, processingInterval: number }`

## Requirements Implemented

This implementation satisfies the following requirements from the design document:

- **Requirement 8.1**: Failed requests are added to retry queue after exhausting immediate retries
- **Requirement 8.2**: Retry queue uses exponential backoff (5min, 15min, 1h, 6h)
- **Requirement 8.3**: Successful retries update product data
- **Requirement 8.4**: Items are marked as permanently failed after 4 attempts
- **Requirement 8.5**: Retry queue is persisted to database

## Related Documentation

- [Retry Strategy](./RETRY_STRATEGY.md) - Immediate retry logic
- [Scraper Service](./SCRAPER_SERVICE.md) - Main scraping service
- [Proxy Manager](./PROXY_MANAGER.md) - Proxy rotation and health
