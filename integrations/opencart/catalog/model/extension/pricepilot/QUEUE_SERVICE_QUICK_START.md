# QueueService Quick Start Guide

## Overview

The QueueService handles background job processing for long-running operations that should not block API requests.

## Basic Usage

### 1. Load the Service

```php
$this->load->model('extension/pricepilot/QueueService');
$queueService = $this->model_extension_pricepilot_QueueService;
```

### 2. Enqueue a Job

```php
// Prepare job data
$jobData = [
    'updates' => [
        ['product_id' => 1, 'price' => 99.99],
        ['product_id' => 2, 'price' => 149.99]
    ],
    'store_id' => 0
];

// Enqueue with priority (1-10, higher = more important)
$jobId = $queueService->enqueue('bulk_update', $jobData, 8);

// Return job ID to client
echo json_encode(['job_id' => $jobId]);
```

### 3. Check Job Status

```php
// Get job status
$status = $queueService->getJobStatus($jobId);

// Return status to client
echo json_encode([
    'status' => $status['status'],
    'progress' => $status['progress'],
    'result' => $status['result']
]);
```

### 4. Process Jobs (Worker Script)

```php
// Run this in a cron job or background worker
$result = $queueService->processNext();

if ($result['success'] && $result['job_id']) {
    echo "Processed job: " . $result['job_id'] . "\n";
}
```

### 5. Cancel a Job

```php
// Cancel a pending or processing job
$cancelled = $queueService->cancelJob($jobId);

if ($cancelled) {
    echo "Job cancelled successfully";
}
```

## Job Types

### Bulk Update
```php
$queueService->enqueue('bulk_update', [
    'updates' => [
        ['product_id' => 1, 'price' => 99.99],
        ['product_id' => 2, 'price' => 149.99]
    ],
    'store_id' => 0
], 8);
```

### Webhook Batch
```php
$queueService->enqueue('webhook_batch', [
    'webhooks' => [
        [
            'url' => 'https://example.com/webhook',
            'event' => 'product.updated',
            'data' => ['product_id' => 1, 'price' => 99.99]
        ]
    ]
], 5);
```

### Price Backup
```php
$queueService->enqueue('price_backup', [
    'product_ids' => [1, 2, 3, 4, 5]
], 3);
```

## Job Statuses

- `pending` - Job queued, waiting to be processed
- `processing` - Job currently being executed
- `completed` - Job finished successfully
- `failed` - Job failed after 3 retry attempts
- `cancelled` - Job cancelled by user

## Priority Levels

- **1-3**: Low priority (background tasks)
- **4-6**: Normal priority (default: 5)
- **7-10**: High priority (urgent operations)

## Automatic Features

- **Retry Logic**: Failed jobs automatically retry up to 3 times
- **Progress Tracking**: Long-running jobs update progress percentage
- **Priority Processing**: Higher priority jobs processed first
- **Error Logging**: All errors logged for debugging

## Worker Script Example

Create a cron job that runs every minute:

```bash
* * * * * php /path/to/opencart/process-queue.php
```

**process-queue.php**:
```php
<?php
// Load OpenCart framework
require_once('system/startup.php');

// Initialize registry
$registry = new Registry();
// ... initialize database, cache, etc.

// Load QueueService
$registry->get('load')->model('extension/pricepilot/QueueService');
$queueService = $registry->get('model_extension_pricepilot_QueueService');

// Process up to 10 jobs per run
for ($i = 0; $i < 10; $i++) {
    $result = $queueService->processNext();
    
    if ($result['job_id'] === null) {
        // No more pending jobs
        break;
    }
}
```

## API Integration Example

When bulk updates exceed threshold, automatically queue them:

```php
// In API controller
if (count($updates) > 100) {
    // Queue for background processing
    $jobId = $queueService->enqueue('bulk_update', [
        'updates' => $updates,
        'store_id' => $storeId
    ], 8);
    
    // Return job ID to client
    $this->response->setOutput(json_encode([
        'queued' => true,
        'job_id' => $jobId,
        'message' => 'Large update queued for background processing'
    ]));
} else {
    // Process immediately
    $result = $priceService->bulkUpdatePrices($updates, $storeId);
    
    $this->response->setOutput(json_encode($result));
}
```

## Monitoring Jobs

Check all pending jobs:

```php
$sql = "SELECT job_id, job_type, status, progress, date_added 
        FROM " . DB_PREFIX . "pricepilot_queue 
        WHERE status IN ('pending', 'processing') 
        ORDER BY priority DESC, date_added ASC";

$result = $db->query($sql);

foreach ($result->rows as $job) {
    echo "Job {$job['job_id']}: {$job['job_type']} - {$job['status']} ({$job['progress']}%)\n";
}
```

## Best Practices

1. **Use appropriate priorities**: Reserve high priorities (7-10) for urgent operations
2. **Monitor queue size**: Alert if queue grows too large
3. **Clean old jobs**: Periodically delete completed jobs older than 30 days
4. **Handle failures**: Send notifications when jobs fail after max retries
5. **Test job types**: Ensure all job types process correctly before production
6. **Scale workers**: Run multiple worker processes for high-volume queues

## Troubleshooting

### Jobs stuck in processing
- Check if worker script is running
- Look for errors in OpenCart error log
- Manually reset stuck jobs to pending

### Jobs failing repeatedly
- Check job data format
- Verify required services are available
- Review error logs for specific failure reasons

### Queue growing too large
- Increase worker frequency
- Run multiple worker processes
- Optimize job processing code

## Additional Resources

- Full documentation: `QUEUE_SERVICE_SUMMARY.md`
- Demo script: `queue-service-demo.php`
- Verification: `QUEUE_SERVICE_VERIFICATION.md`
