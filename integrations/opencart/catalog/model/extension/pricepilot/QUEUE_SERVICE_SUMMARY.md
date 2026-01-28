# QueueService Implementation Summary

## Overview

The QueueService has been successfully implemented to handle background job processing for long-running operations in the PricePilot OpenCart plugin. This service enables asynchronous processing of tasks that should not block API requests, such as bulk price updates, webhook batches, and price backups.

## Implementation Details

### File Location
- **Path**: `catalog/model/extension/pricepilot/QueueService.php`
- **Class**: `QueueService extends Service`

### Core Features Implemented

#### 1. Job Enqueueing (`enqueue()`)
- Adds jobs to the queue with priority support
- Generates unique UUID for each job
- Serializes job data as JSON
- Supports priority levels 1-10 (higher = more important)
- Returns job ID for tracking

**Parameters**:
- `$jobType` (string): Job type identifier
- `$jobData` (array): Job-specific data
- `$priority` (int): Job priority (default: 5)

**Returns**: Job ID (UUID string)

#### 2. Job Processing (`processNext()`)
- Retrieves next pending job based on priority and creation time
- Marks job as processing before execution
- Processes job based on type
- Handles success and failure scenarios
- Implements automatic retry logic (max 3 attempts)
- Updates job status and progress

**Returns**: Array with success status, job ID, and error message

#### 3. Job Status Tracking (`getJobStatus()`)
- Retrieves current job status
- Returns progress percentage (0-100)
- Includes result data when completed
- Shows retry count and timestamps
- Provides error information for failed jobs

**Parameters**:
- `$jobId` (string): Job ID to query

**Returns**: Array with status, progress, result, and metadata

#### 4. Job Cancellation (`cancelJob()`)
- Cancels pending or processing jobs
- Updates job status to 'cancelled'
- Records cancellation timestamp
- Prevents cancellation of completed/failed jobs

**Parameters**:
- `$jobId` (string): Job ID to cancel

**Returns**: Boolean success indicator

#### 5. Retry Logic
- Automatically retries failed jobs up to 3 times
- Increments retry counter on each attempt
- Marks job as failed after max retries
- Logs retry attempts for monitoring

### Job Types Supported

#### 1. Bulk Update (`bulk_update`)
- Processes large price update batches in background
- Updates progress as batches complete
- Returns success/failure counts
- Integrates with PriceService

**Job Data Structure**:
```php
[
    'updates' => [
        ['product_id' => 1, 'price' => 99.99],
        ['product_id' => 2, 'price' => 149.99]
    ],
    'store_id' => 0
]
```

#### 2. Webhook Batch (`webhook_batch`)
- Sends multiple webhooks asynchronously
- Tracks success/failure for each webhook
- Updates progress as webhooks are sent
- Integrates with WebhookService

**Job Data Structure**:
```php
[
    'webhooks' => [
        [
            'url' => 'https://example.com/webhook',
            'event' => 'product.updated',
            'data' => ['product_id' => 1]
        ]
    ]
]
```

#### 3. Price Backup (`price_backup`)
- Creates price backups for large product sets
- Returns backup ID for restoration
- Integrates with PriceService

**Job Data Structure**:
```php
[
    'product_ids' => [1, 2, 3, 4, 5]
]
```

### Job Status Constants

```php
const STATUS_PENDING = 'pending';      // Job queued, not yet started
const STATUS_PROCESSING = 'processing'; // Job currently being processed
const STATUS_COMPLETED = 'completed';   // Job finished successfully
const STATUS_FAILED = 'failed';         // Job failed after max retries
const STATUS_CANCELLED = 'cancelled';   // Job cancelled by user
```

### Database Schema

The service uses the `pricepilot_queue` table:

```sql
CREATE TABLE `oc_pricepilot_queue` (
  `job_id` varchar(36) NOT NULL,
  `job_type` varchar(50) NOT NULL,
  `job_data` text NOT NULL,
  `status` enum('pending','processing','completed','failed','cancelled') DEFAULT 'pending',
  `progress` int(3) DEFAULT 0,
  `result` text,
  `retry_count` int(2) DEFAULT 0,
  `priority` int(2) DEFAULT 5,
  `date_added` datetime NOT NULL,
  `date_started` datetime DEFAULT NULL,
  `date_completed` datetime DEFAULT NULL,
  PRIMARY KEY (`job_id`),
  KEY `status` (`status`),
  KEY `priority` (`priority`),
  KEY `date_added` (`date_added`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## Usage Examples

### Example 1: Enqueue a Bulk Update Job

```php
// Load QueueService
$this->load->model('extension/pricepilot/QueueService');
$queueService = $this->model_extension_pricepilot_QueueService;

// Prepare bulk update data
$updates = [
    ['product_id' => 1, 'price' => 99.99],
    ['product_id' => 2, 'price' => 149.99],
    ['product_id' => 3, 'price' => 199.99]
];

// Enqueue job with high priority
$jobId = $queueService->enqueue('bulk_update', [
    'updates' => $updates,
    'store_id' => 0
], 8);

echo "Job enqueued: {$jobId}";
```

### Example 2: Check Job Status

```php
// Get job status
$status = $queueService->getJobStatus($jobId);

echo "Status: " . $status['status'] . "\n";
echo "Progress: " . $status['progress'] . "%\n";

if ($status['status'] === 'completed') {
    echo "Result: " . json_encode($status['result']) . "\n";
}
```

### Example 3: Process Jobs (Worker Script)

```php
// This would typically run in a cron job or background worker
while (true) {
    $result = $queueService->processNext();
    
    if ($result['job_id'] === null) {
        // No pending jobs, wait before checking again
        sleep(5);
        continue;
    }
    
    if ($result['success']) {
        echo "Processed job: " . $result['job_id'] . "\n";
    } else {
        echo "Job failed: " . $result['error'] . "\n";
    }
}
```

### Example 4: Cancel a Job

```php
// Cancel a pending or processing job
$cancelled = $queueService->cancelJob($jobId);

if ($cancelled) {
    echo "Job cancelled successfully\n";
} else {
    echo "Failed to cancel job (may already be completed)\n";
}
```

## Integration Points

### 1. PriceService Integration
- Bulk update jobs use `PriceService::bulkUpdatePrices()`
- Price backup jobs use `PriceService::createPriceBackup()`
- Automatic cache invalidation after updates

### 2. WebhookService Integration
- Webhook batch jobs use `WebhookService::sendWebhook()`
- Asynchronous webhook delivery
- Retry logic for failed webhooks

### 3. API Controller Integration
- Large bulk updates (>100 products) automatically queued
- Returns job ID instead of blocking request
- Client can poll job status for progress

## Key Benefits

1. **Non-Blocking Operations**: Long-running tasks don't block API requests
2. **Priority Management**: Important jobs processed first
3. **Automatic Retry**: Failed jobs automatically retried up to 3 times
4. **Progress Tracking**: Real-time progress updates for long jobs
5. **Scalability**: Can process large batches without timeouts
6. **Reliability**: Jobs persist in database, survive server restarts
7. **Monitoring**: Complete job history and status tracking

## Requirements Satisfied

✅ **Requirement 29.1**: Job enqueueing with priority support  
✅ **Requirement 29.2**: Background job processing with status tracking  
✅ **Requirement 29.3**: Job status retrieval and monitoring  
✅ **Requirement 29.4**: Job cancellation capability  
✅ **Requirement 29.5**: Automatic retry logic (max 3 attempts)

## Testing

A demo script is provided at `queue-service-demo.php` that demonstrates:
- Job enqueueing with different priorities
- Job status checking
- Job processing
- Job cancellation
- Retry logic explanation

Run the demo:
```bash
php integrations/opencart/catalog/model/extension/pricepilot/queue-service-demo.php
```

## Next Steps

1. **Create Cron Job**: Set up a cron job to run `processNext()` periodically
2. **Admin Interface**: Add queue monitoring to admin dashboard
3. **Notifications**: Send admin notifications when jobs fail
4. **Cleanup**: Implement automatic cleanup of old completed jobs
5. **Testing**: Write unit tests for queue operations

## Notes

- Jobs are processed in order of priority (highest first), then by creation time (oldest first)
- The service uses UUID v4 for job IDs to ensure uniqueness
- Job data is stored as JSON in the database
- Progress is tracked as a percentage (0-100)
- Failed jobs include error details in the result field
- The service integrates seamlessly with existing PriceService and WebhookService implementations

## Implementation Status

✅ **Task 14.1 Complete**: QueueService class created with all required methods
- `enqueue()` - Add jobs to queue ✓
- `processNext()` - Process queued jobs ✓
- `getJobStatus()` - Status tracking ✓
- `cancelJob()` - Job cancellation ✓
- Retry logic (max 3 attempts) ✓

All requirements (29.1, 29.2, 29.3, 29.4, 29.5) have been satisfied.
