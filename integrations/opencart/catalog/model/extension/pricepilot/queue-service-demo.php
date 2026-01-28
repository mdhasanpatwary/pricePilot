<?php
/**
 * QueueService Demo Script
 * 
 * Demonstrates the usage of QueueService for background job processing.
 * This script shows how to enqueue jobs, check status, and process jobs.
 * 
 * Usage: php queue-service-demo.php
 */

// Mock OpenCart environment for testing
class MockRegistry {
    private $data = [];
    
    public function get($key) {
        return isset($this->data[$key]) ? $this->data[$key] : null;
    }
    
    public function set($key, $value) {
        $this->data[$key] = $value;
    }
}

class MockDB {
    public function query($sql) {
        $result = new stdClass();
        $result->num_rows = 0;
        $result->row = [];
        $result->rows = [];
        return $result;
    }
    
    public function escape($value) {
        return addslashes($value);
    }
}

class MockCache {
    private $data = [];
    
    public function get($key) {
        return isset($this->data[$key]) ? $this->data[$key] : null;
    }
    
    public function set($key, $value, $ttl = 300) {
        $this->data[$key] = $value;
    }
    
    public function delete($key) {
        unset($this->data[$key]);
    }
}

class MockConfig {
    private $data = [
        'config_language_id' => 1,
        'config_customer_group_id' => 1,
        'config_url' => 'https://example.com/'
    ];
    
    public function get($key) {
        return isset($this->data[$key]) ? $this->data[$key] : null;
    }
}

class MockLoader {
    public function model($path) {
        // Mock model loading
    }
}

class MockLog {
    public function write($message) {
        echo "[LOG] " . $message . "\n";
    }
}

class MockRequest {
    public $get = [];
    public $post = [];
    public $server = [];
}

class MockResponse {
    public function addHeader($header) {
        // Mock header
    }
    
    public function setOutput($output) {
        echo $output;
    }
}

// Define DB_PREFIX constant
if (!defined('DB_PREFIX')) {
    define('DB_PREFIX', 'oc_');
}

// Setup mock registry
$registry = new MockRegistry();
$registry->set('db', new MockDB());
$registry->set('cache', new MockCache());
$registry->set('config', new MockConfig());
$registry->set('load', new MockLoader());
$registry->set('log', new MockLog());
$registry->set('request', new MockRequest());
$registry->set('response', new MockResponse());

// Load QueueService
require_once __DIR__ . '/QueueService.php';

echo "=== QueueService Demo ===\n\n";

// Create QueueService instance
$queueService = new QueueService($registry);

echo "1. Testing enqueue() - Adding jobs to queue\n";
echo "-------------------------------------------\n";

// Enqueue a bulk update job
$bulkUpdateData = [
    'updates' => [
        ['product_id' => 1, 'price' => 99.99],
        ['product_id' => 2, 'price' => 149.99],
        ['product_id' => 3, 'price' => 199.99]
    ],
    'store_id' => 0
];

$jobId1 = $queueService->enqueue('bulk_update', $bulkUpdateData, 8);
echo "Enqueued bulk_update job: {$jobId1}\n";

// Enqueue a webhook batch job
$webhookData = [
    'webhooks' => [
        [
            'url' => 'https://example.com/webhook1',
            'event' => 'product.updated',
            'data' => ['product_id' => 1, 'price' => 99.99]
        ],
        [
            'url' => 'https://example.com/webhook2',
            'event' => 'product.updated',
            'data' => ['product_id' => 2, 'price' => 149.99]
        ]
    ]
];

$jobId2 = $queueService->enqueue('webhook_batch', $webhookData, 5);
echo "Enqueued webhook_batch job: {$jobId2}\n";

// Enqueue a price backup job
$backupData = [
    'product_ids' => [1, 2, 3, 4, 5]
];

$jobId3 = $queueService->enqueue('price_backup', $backupData, 3);
echo "Enqueued price_backup job: {$jobId3}\n\n";

echo "2. Testing getJobStatus() - Checking job status\n";
echo "------------------------------------------------\n";

$status1 = $queueService->getJobStatus($jobId1);
echo "Job {$jobId1} status:\n";
echo "  Status: " . ($status1['status'] ?? 'unknown') . "\n";
echo "  Progress: " . $status1['progress'] . "%\n";
echo "  Error: " . ($status1['error'] ?? 'none') . "\n\n";

$status2 = $queueService->getJobStatus($jobId2);
echo "Job {$jobId2} status:\n";
echo "  Status: " . ($status2['status'] ?? 'unknown') . "\n";
echo "  Progress: " . $status2['progress'] . "%\n";
echo "  Error: " . ($status2['error'] ?? 'none') . "\n\n";

echo "3. Testing processNext() - Processing queued jobs\n";
echo "--------------------------------------------------\n";

// Note: In a real environment, this would be called by a cron job or worker process
echo "Processing next job in queue...\n";
$processResult = $queueService->processNext();
echo "Process result:\n";
echo "  Success: " . ($processResult['success'] ? 'true' : 'false') . "\n";
echo "  Job ID: " . ($processResult['job_id'] ?? 'none') . "\n";
echo "  Error: " . ($processResult['error'] ?? 'none') . "\n\n";

echo "4. Testing cancelJob() - Cancelling a job\n";
echo "------------------------------------------\n";

$cancelled = $queueService->cancelJob($jobId3);
echo "Cancel job {$jobId3}: " . ($cancelled ? 'success' : 'failed') . "\n";

// Check status after cancellation
$status3 = $queueService->getJobStatus($jobId3);
echo "Job {$jobId3} status after cancellation:\n";
echo "  Status: " . ($status3['status'] ?? 'unknown') . "\n";
echo "  Progress: " . $status3['progress'] . "%\n\n";

echo "5. Testing retry logic\n";
echo "----------------------\n";
echo "Retry logic is automatically handled by processNext():\n";
echo "  - Jobs that fail are automatically retried up to 3 times\n";
echo "  - After 3 failed attempts, job is marked as 'failed'\n";
echo "  - Retry count is tracked in the database\n\n";

echo "6. Job Types Supported\n";
echo "----------------------\n";
echo "  - bulk_update: Process bulk price updates in background\n";
echo "  - webhook_batch: Send multiple webhooks asynchronously\n";
echo "  - price_backup: Create price backups for large product sets\n\n";

echo "7. Key Features\n";
echo "---------------\n";
echo "  ✓ Priority-based job processing (1-10, higher = more important)\n";
echo "  ✓ Automatic retry logic (max 3 attempts)\n";
echo "  ✓ Progress tracking for long-running jobs\n";
echo "  ✓ Job status monitoring (pending, processing, completed, failed, cancelled)\n";
echo "  ✓ Job cancellation support\n";
echo "  ✓ Batch processing for bulk operations\n";
echo "  ✓ UUID-based job identification\n\n";

echo "=== Demo Complete ===\n";
