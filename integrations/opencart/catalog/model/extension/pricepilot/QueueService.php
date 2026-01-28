<?php
/**
 * PricePilot Queue Service
 * Path: catalog/model/extension/pricepilot/QueueService.php
 * 
 * Background job processing service for long-running operations.
 * Handles job queuing, processing, status tracking, and retry logic
 * for operations that should not block API requests.
 * 
 * Features:
 * - Job enqueueing with priority support
 * - Background job processing with status tracking
 * - Job status retrieval and monitoring
 * - Job cancellation capability
 * - Automatic retry logic (max 3 attempts)
 * - Progress tracking for long-running jobs
 * 
 * Requirements: 29.1, 29.2, 29.3, 29.4, 29.5
 * 
 * @package PricePilot
 * @subpackage Services
 */

require_once __DIR__ . '/Service.php';

class QueueService extends Service {
    
    /**
     * Job status constants
     */
    const STATUS_PENDING = 'pending';
    const STATUS_PROCESSING = 'processing';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';
    const STATUS_CANCELLED = 'cancelled';
    
    /**
     * Maximum retry attempts for failed jobs
     */
    const MAX_RETRY_ATTEMPTS = 3;
    
    /**
     * Default job priority (1-10, higher = more important)
     */
    const DEFAULT_PRIORITY = 5;
    
    /**
     * Add job to queue
     * 
     * Enqueues a new background job for processing. Jobs are processed
     * asynchronously by a worker process (cron or task scheduler).
     * 
     * @param string $jobType Job type identifier (e.g., 'bulk_update', 'webhook_batch')
     * @param array $jobData Job-specific data to be processed
     * @param int $priority Job priority (1-10, default: 5)
     * @return string Job ID (UUID)
     */
    public function enqueue($jobType, $jobData, $priority = self::DEFAULT_PRIORITY) {
        try {
            // Generate unique job ID
            $jobId = $this->generateUuid();
            
            // Validate priority range
            $priority = max(1, min(10, (int)$priority));
            
            // Serialize job data
            $jobDataJson = json_encode($jobData);
            
            if ($jobDataJson === false) {
                $this->logMessage("Failed to serialize job data for type {$jobType}", 'error');
                return '';
            }
            
            // Insert job into queue
            $sql = "INSERT INTO " . $this->getTableName('pricepilot_queue') . " 
                    (job_id, job_type, job_data, status, progress, retry_count, priority, date_added) 
                    VALUES (
                        '" . $this->escape($jobId) . "',
                        '" . $this->escape($jobType) . "',
                        '" . $this->escape($jobDataJson) . "',
                        '" . self::STATUS_PENDING . "',
                        0,
                        0,
                        " . $priority . ",
                        '" . $this->getCurrentTimestamp() . "'
                    )";
            
            $this->query($sql);
            
            $this->logMessage("Enqueued job {$jobId} of type {$jobType} with priority {$priority}", 'info');
            
            return $jobId;
            
        } catch (Exception $e) {
            $this->logMessage("Failed to enqueue job: " . $e->getMessage(), 'error');
            return '';
        }
    }
    
    /**
     * Process next job in queue
     * 
     * Retrieves and processes the next pending job from the queue based
     * on priority and creation time. Updates job status and handles errors.
     * 
     * @return array ['success' => bool, 'job_id' => string|null, 'error' => string|null]
     */
    public function processNext() {
        try {
            // Get next pending job (highest priority first, then oldest)
            $sql = "SELECT job_id, job_type, job_data, retry_count 
                    FROM " . $this->getTableName('pricepilot_queue') . " 
                    WHERE status = '" . self::STATUS_PENDING . "' 
                    ORDER BY priority DESC, date_added ASC 
                    LIMIT 1";
            
            $result = $this->query($sql);
            
            if ($result->num_rows === 0) {
                return [
                    'success' => true,
                    'job_id' => null,
                    'error' => 'No pending jobs'
                ];
            }
            
            $job = $result->row;
            $jobId = $job['job_id'];
            $jobType = $job['job_type'];
            $jobData = json_decode($job['job_data'], true);
            $retryCount = (int)$job['retry_count'];
            
            // Mark job as processing
            $this->updateJobStatus($jobId, self::STATUS_PROCESSING, 0);
            
            // Update date_started
            $updateSql = "UPDATE " . $this->getTableName('pricepilot_queue') . " 
                         SET date_started = '" . $this->getCurrentTimestamp() . "' 
                         WHERE job_id = '" . $this->escape($jobId) . "'";
            $this->query($updateSql);
            
            $this->logMessage("Processing job {$jobId} of type {$jobType}", 'info');
            
            // Process the job based on type
            $result = $this->processJob($jobId, $jobType, $jobData);
            
            if ($result['success']) {
                // Mark job as completed
                $this->completeJob($jobId, $result['result']);
                
                return [
                    'success' => true,
                    'job_id' => $jobId,
                    'error' => null
                ];
            } else {
                // Job failed - check if we should retry
                if ($retryCount < self::MAX_RETRY_ATTEMPTS) {
                    // Retry the job
                    $this->retryJob($jobId, $result['error']);
                    
                    return [
                        'success' => false,
                        'job_id' => $jobId,
                        'error' => "Job failed, will retry (attempt " . ($retryCount + 1) . "/" . self::MAX_RETRY_ATTEMPTS . ")"
                    ];
                } else {
                    // Max retries reached - mark as failed
                    $this->failJob($jobId, $result['error']);
                    
                    return [
                        'success' => false,
                        'job_id' => $jobId,
                        'error' => "Job failed after " . self::MAX_RETRY_ATTEMPTS . " attempts: " . $result['error']
                    ];
                }
            }
            
        } catch (Exception $e) {
            $this->logMessage("Failed to process next job: " . $e->getMessage(), 'error');
            return [
                'success' => false,
                'job_id' => null,
                'error' => 'Internal error: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Get job status
     * 
     * Retrieves the current status, progress, and result of a job.
     * 
     * @param string $jobId Job ID to query
     * @return array ['status' => string, 'progress' => int, 'result' => array|null, 'error' => string|null]
     */
    public function getJobStatus($jobId) {
        try {
            $sql = "SELECT status, progress, result, retry_count, date_added, date_started, date_completed 
                    FROM " . $this->getTableName('pricepilot_queue') . " 
                    WHERE job_id = '" . $this->escape($jobId) . "' 
                    LIMIT 1";
            
            $result = $this->query($sql);
            
            if ($result->num_rows === 0) {
                return [
                    'status' => null,
                    'progress' => 0,
                    'result' => null,
                    'error' => 'Job not found'
                ];
            }
            
            $job = $result->row;
            
            // Decode result if present
            $jobResult = null;
            if (!empty($job['result'])) {
                $jobResult = json_decode($job['result'], true);
            }
            
            return [
                'status' => $job['status'],
                'progress' => (int)$job['progress'],
                'result' => $jobResult,
                'retry_count' => (int)$job['retry_count'],
                'date_added' => $job['date_added'],
                'date_started' => $job['date_started'],
                'date_completed' => $job['date_completed'],
                'error' => null
            ];
            
        } catch (Exception $e) {
            $this->logMessage("Failed to get job status for {$jobId}: " . $e->getMessage(), 'error');
            return [
                'status' => null,
                'progress' => 0,
                'result' => null,
                'error' => 'Internal error'
            ];
        }
    }
    
    /**
     * Cancel job
     * 
     * Cancels a pending or processing job. Completed or failed jobs
     * cannot be cancelled.
     * 
     * @param string $jobId Job ID to cancel
     * @return bool True if cancelled, false otherwise
     */
    public function cancelJob($jobId) {
        try {
            // Check if job can be cancelled (must be pending or processing)
            $sql = "SELECT status 
                    FROM " . $this->getTableName('pricepilot_queue') . " 
                    WHERE job_id = '" . $this->escape($jobId) . "' 
                    LIMIT 1";
            
            $result = $this->query($sql);
            
            if ($result->num_rows === 0) {
                $this->logMessage("Cannot cancel job {$jobId}: Job not found", 'warning');
                return false;
            }
            
            $status = $result->row['status'];
            
            // Only pending or processing jobs can be cancelled
            if ($status !== self::STATUS_PENDING && $status !== self::STATUS_PROCESSING) {
                $this->logMessage("Cannot cancel job {$jobId}: Job is {$status}", 'warning');
                return false;
            }
            
            // Update job status to cancelled
            $updateSql = "UPDATE " . $this->getTableName('pricepilot_queue') . " 
                         SET status = '" . self::STATUS_CANCELLED . "',
                             date_completed = '" . $this->getCurrentTimestamp() . "',
                             result = '" . $this->escape(json_encode(['cancelled' => true, 'message' => 'Job cancelled by user'])) . "'
                         WHERE job_id = '" . $this->escape($jobId) . "'";
            
            $this->query($updateSql);
            
            $this->logMessage("Cancelled job {$jobId}", 'info');
            
            return true;
            
        } catch (Exception $e) {
            $this->logMessage("Failed to cancel job {$jobId}: " . $e->getMessage(), 'error');
            return false;
        }
    }
    
    /**
     * Process a job based on its type
     * 
     * @param string $jobId Job ID
     * @param string $jobType Job type
     * @param array $jobData Job data
     * @return array ['success' => bool, 'result' => array|null, 'error' => string|null]
     */
    private function processJob($jobId, $jobType, $jobData) {
        try {
            switch ($jobType) {
                case 'bulk_update':
                    return $this->processBulkUpdate($jobId, $jobData);
                
                case 'webhook_batch':
                    return $this->processWebhookBatch($jobId, $jobData);
                
                case 'price_backup':
                    return $this->processPriceBackup($jobId, $jobData);
                
                default:
                    return [
                        'success' => false,
                        'result' => null,
                        'error' => "Unknown job type: {$jobType}"
                    ];
            }
        } catch (Exception $e) {
            return [
                'success' => false,
                'result' => null,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Process bulk price update job
     * 
     * @param string $jobId Job ID
     * @param array $jobData Job data containing 'updates' array
     * @return array ['success' => bool, 'result' => array|null, 'error' => string|null]
     */
    private function processBulkUpdate($jobId, $jobData) {
        try {
            // Load PriceService
            $this->load->model('extension/pricepilot/PriceService');
            $priceService = $this->model_extension_pricepilot_PriceService;
            
            $updates = isset($jobData['updates']) ? $jobData['updates'] : [];
            $storeId = isset($jobData['store_id']) ? $jobData['store_id'] : null;
            
            $totalUpdates = count($updates);
            $processedCount = 0;
            
            // Process updates in batches
            $batchSize = 50;
            $batches = array_chunk($updates, $batchSize);
            
            $successCount = 0;
            $failureCount = 0;
            $failures = [];
            
            foreach ($batches as $batchIndex => $batch) {
                // Process batch
                $result = $priceService->bulkUpdatePrices($batch, $storeId);
                
                $successCount += $result['success_count'];
                $failureCount += $result['failure_count'];
                $failures = array_merge($failures, $result['failures']);
                
                $processedCount += count($batch);
                
                // Update progress
                $progress = (int)(($processedCount / $totalUpdates) * 100);
                $this->updateJobProgress($jobId, $progress);
            }
            
            return [
                'success' => true,
                'result' => [
                    'total' => $totalUpdates,
                    'success_count' => $successCount,
                    'failure_count' => $failureCount,
                    'failures' => $failures
                ],
                'error' => null
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'result' => null,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Process webhook batch job
     * 
     * @param string $jobId Job ID
     * @param array $jobData Job data containing webhook information
     * @return array ['success' => bool, 'result' => array|null, 'error' => string|null]
     */
    private function processWebhookBatch($jobId, $jobData) {
        try {
            // Load WebhookService
            $this->load->model('extension/pricepilot/WebhookService');
            $webhookService = $this->model_extension_pricepilot_WebhookService;
            
            $webhooks = isset($jobData['webhooks']) ? $jobData['webhooks'] : [];
            $totalWebhooks = count($webhooks);
            $processedCount = 0;
            $successCount = 0;
            $failureCount = 0;
            
            foreach ($webhooks as $webhook) {
                $url = $webhook['url'];
                $event = $webhook['event'];
                $data = $webhook['data'];
                
                $result = $webhookService->sendWebhook($url, $event, $data);
                
                if ($result['success']) {
                    $successCount++;
                } else {
                    $failureCount++;
                }
                
                $processedCount++;
                
                // Update progress
                $progress = (int)(($processedCount / $totalWebhooks) * 100);
                $this->updateJobProgress($jobId, $progress);
            }
            
            return [
                'success' => true,
                'result' => [
                    'total' => $totalWebhooks,
                    'success_count' => $successCount,
                    'failure_count' => $failureCount
                ],
                'error' => null
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'result' => null,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Process price backup job
     * 
     * @param string $jobId Job ID
     * @param array $jobData Job data containing product IDs
     * @return array ['success' => bool, 'result' => array|null, 'error' => string|null]
     */
    private function processPriceBackup($jobId, $jobData) {
        try {
            // Load PriceService
            $this->load->model('extension/pricepilot/PriceService');
            $priceService = $this->model_extension_pricepilot_PriceService;
            
            $productIds = isset($jobData['product_ids']) ? $jobData['product_ids'] : [];
            
            // Create backup
            $backupId = $priceService->createPriceBackup($productIds);
            
            if (empty($backupId)) {
                return [
                    'success' => false,
                    'result' => null,
                    'error' => 'Failed to create price backup'
                ];
            }
            
            return [
                'success' => true,
                'result' => [
                    'backup_id' => $backupId,
                    'product_count' => count($productIds)
                ],
                'error' => null
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'result' => null,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Update job status
     * 
     * @param string $jobId Job ID
     * @param string $status New status
     * @param int $progress Progress percentage (0-100)
     */
    private function updateJobStatus($jobId, $status, $progress = null) {
        try {
            $sql = "UPDATE " . $this->getTableName('pricepilot_queue') . " 
                    SET status = '" . $this->escape($status) . "'";
            
            if ($progress !== null) {
                $sql .= ", progress = " . (int)$progress;
            }
            
            $sql .= " WHERE job_id = '" . $this->escape($jobId) . "'";
            
            $this->query($sql);
            
        } catch (Exception $e) {
            $this->logMessage("Failed to update job status for {$jobId}: " . $e->getMessage(), 'error');
        }
    }
    
    /**
     * Update job progress
     * 
     * @param string $jobId Job ID
     * @param int $progress Progress percentage (0-100)
     */
    private function updateJobProgress($jobId, $progress) {
        try {
            $progress = max(0, min(100, (int)$progress));
            
            $sql = "UPDATE " . $this->getTableName('pricepilot_queue') . " 
                    SET progress = " . $progress . " 
                    WHERE job_id = '" . $this->escape($jobId) . "'";
            
            $this->query($sql);
            
        } catch (Exception $e) {
            $this->logMessage("Failed to update job progress for {$jobId}: " . $e->getMessage(), 'error');
        }
    }
    
    /**
     * Complete a job successfully
     * 
     * @param string $jobId Job ID
     * @param array|null $result Job result data
     */
    private function completeJob($jobId, $result) {
        try {
            $resultJson = json_encode($result);
            
            $sql = "UPDATE " . $this->getTableName('pricepilot_queue') . " 
                    SET status = '" . self::STATUS_COMPLETED . "',
                        progress = 100,
                        result = '" . $this->escape($resultJson) . "',
                        date_completed = '" . $this->getCurrentTimestamp() . "'
                    WHERE job_id = '" . $this->escape($jobId) . "'";
            
            $this->query($sql);
            
            $this->logMessage("Completed job {$jobId}", 'info');
            
        } catch (Exception $e) {
            $this->logMessage("Failed to complete job {$jobId}: " . $e->getMessage(), 'error');
        }
    }
    
    /**
     * Retry a failed job
     * 
     * @param string $jobId Job ID
     * @param string $error Error message
     */
    private function retryJob($jobId, $error) {
        try {
            $sql = "UPDATE " . $this->getTableName('pricepilot_queue') . " 
                    SET status = '" . self::STATUS_PENDING . "',
                        retry_count = retry_count + 1,
                        result = '" . $this->escape(json_encode(['error' => $error, 'retry' => true])) . "'
                    WHERE job_id = '" . $this->escape($jobId) . "'";
            
            $this->query($sql);
            
            $this->logMessage("Retrying job {$jobId} after failure: {$error}", 'warning');
            
        } catch (Exception $e) {
            $this->logMessage("Failed to retry job {$jobId}: " . $e->getMessage(), 'error');
        }
    }
    
    /**
     * Mark a job as failed
     * 
     * @param string $jobId Job ID
     * @param string $error Error message
     */
    private function failJob($jobId, $error) {
        try {
            $resultJson = json_encode([
                'error' => $error,
                'failed' => true,
                'max_retries_reached' => true
            ]);
            
            $sql = "UPDATE " . $this->getTableName('pricepilot_queue') . " 
                    SET status = '" . self::STATUS_FAILED . "',
                        result = '" . $this->escape($resultJson) . "',
                        date_completed = '" . $this->getCurrentTimestamp() . "'
                    WHERE job_id = '" . $this->escape($jobId) . "'";
            
            $this->query($sql);
            
            $this->logMessage("Failed job {$jobId} after max retries: {$error}", 'error');
            
        } catch (Exception $e) {
            $this->logMessage("Failed to mark job {$jobId} as failed: " . $e->getMessage(), 'error');
        }
    }
    
    /**
     * Generate UUID v4
     * 
     * @return string UUID string
     */
    private function generateUuid() {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );
    }
}
