<?php
/**
 * LoggingService Demonstration Script
 * 
 * This script demonstrates the usage of the LoggingService class
 * for activity and API request logging.
 * 
 * IMPORTANT: This is a demonstration script. In production, the LoggingService
 * should be integrated into your API controllers and admin panels.
 */

// Mock OpenCart environment for demonstration
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
        echo "SQL Query: " . substr($sql, 0, 100) . "...\n";
        
        // Mock result
        $result = new stdClass();
        
        // Check query type and return appropriate mock data
        if (strpos($sql, 'SUM(CASE WHEN response_code') !== false) {
            // Statistics query for success/error counts
            $result->row = ['success_count' => 140, 'error_count' => 10];
        } elseif (strpos($sql, 'AVG(response_time)') !== false) {
            // Average response time query
            $result->row = ['avg_time' => 0.0234];
        } elseif (strpos($sql, 'GROUP BY endpoint') !== false) {
            // Endpoint statistics
            $result->rows = [
                ['endpoint' => '/api/pricepilot/update', 'count' => 100],
                ['endpoint' => '/api/pricepilot/list', 'count' => 50]
            ];
        } elseif (strpos($sql, 'GROUP BY response_code') !== false) {
            // Status code statistics
            $result->rows = [
                ['response_code' => 200, 'count' => 140],
                ['response_code' => 400, 'count' => 8],
                ['response_code' => 500, 'count' => 2]
            ];
        } else {
            // Default mock data
            $result->row = ['total' => 150, 'name' => 'Test Product', 'avg_time' => 0.0234];
            $result->rows = [
                [
                    'log_id' => 1,
                    'product_id' => 123,
                    'product_name' => 'Test Product',
                    'old_price' => 99.99,
                    'new_price' => 89.99,
                    'changed_by' => 'API',
                    'store_id' => 0,
                    'date_added' => '2024-01-28 10:00:00'
                ]
            ];
        }
        
        $result->num_rows = 1;
        
        return $result;
    }
    
    public function escape($value) {
        return addslashes($value);
    }
    
    public function countAffected() {
        return 42;
    }
}

class MockCache {
    public function get($key) { return null; }
    public function set($key, $value, $ttl) { return true; }
    public function delete($key) { return true; }
}

class MockConfig {
    public function get($key) {
        if ($key === 'config_language_id') return 1;
        return null;
    }
}

class MockLog {
    public function write($message) {
        echo "LOG: {$message}\n";
    }
}

// Define DB_PREFIX constant
if (!defined('DB_PREFIX')) {
    define('DB_PREFIX', 'oc_');
}

// Define DIR_SYSTEM constant
if (!defined('DIR_SYSTEM')) {
    define('DIR_SYSTEM', __DIR__ . '/');
}

// Define DIR_CATALOG constant
if (!defined('DIR_CATALOG')) {
    define('DIR_CATALOG', __DIR__ . '/');
}

// Load the LoggingService
require_once __DIR__ . '/Service.php';
require_once __DIR__ . '/LoggingService.php';

// Setup mock registry
$registry = new MockRegistry();
$registry->set('db', new MockDB());
$registry->set('cache', new MockCache());
$registry->set('config', new MockConfig());
$registry->set('log', new MockLog());

// Create LoggingService instance
$loggingService = new LoggingService($registry);

echo "=== LoggingService Demonstration ===\n\n";

// ============================================================================
// 1. Log Price Change
// ============================================================================
echo "1. Logging a price change:\n";
echo str_repeat("-", 50) . "\n";

$result = $loggingService->logPriceChange(
    123,        // product_id
    99.99,      // old_price
    89.99,      // new_price
    'API',      // changed_by
    0           // store_id
);

echo "Result: " . ($result ? "SUCCESS" : "FAILED") . "\n\n";

// ============================================================================
// 2. Log API Request
// ============================================================================
echo "2. Logging an API request:\n";
echo str_repeat("-", 50) . "\n";

$requestData = json_encode([
    'product_id' => 123,
    'price' => 89.99,
    'api_token' => 'secret_token_here'
]);

$result = $loggingService->logApiRequest(
    '/api/pricepilot/update',  // endpoint
    'POST',                     // method
    '192.168.1.100',           // ip
    $requestData,               // request_data (will be sanitized)
    200,                        // response_code
    0.0234                      // response_time
);

echo "Result: " . ($result ? "SUCCESS" : "FAILED") . "\n";
echo "Note: Sensitive data (api_token) will be redacted in logs\n\n";

// ============================================================================
// 3. Get Activity Log with Filters
// ============================================================================
echo "3. Retrieving activity log with filters:\n";
echo str_repeat("-", 50) . "\n";

$filters = [
    'product_id' => 123,
    'date_from' => '2024-01-01',
    'date_to' => '2024-01-31',
    'changed_by' => 'API'
];

$result = $loggingService->getActivityLog($filters, 0, 50);

echo "Total logs found: {$result['total']}\n";
echo "Logs returned: " . count($result['logs']) . "\n";

if (!empty($result['logs'])) {
    echo "\nSample log entry:\n";
    $log = $result['logs'][0];
    echo "  Product: {$log['product_name']} (ID: {$log['product_id']})\n";
    echo "  Price Change: {$log['old_price']} → {$log['new_price']}\n";
    echo "  Changed By: {$log['changed_by']}\n";
    echo "  Date: {$log['date_added']}\n";
}
echo "\n";

// ============================================================================
// 4. Get API Statistics
// ============================================================================
echo "4. Getting API statistics for today:\n";
echo str_repeat("-", 50) . "\n";

$stats = $loggingService->getApiStatistics('today');

echo "Total Requests: {$stats['total_requests']}\n";
echo "Successful: {$stats['success_count']}\n";
echo "Errors: {$stats['error_count']}\n";
echo "Avg Response Time: {$stats['avg_response_time']}s\n";

if (!empty($stats['by_endpoint'])) {
    echo "\nTop Endpoints:\n";
    foreach ($stats['by_endpoint'] as $endpoint) {
        echo "  {$endpoint['endpoint']}: {$endpoint['count']} requests\n";
    }
}

if (!empty($stats['by_status'])) {
    echo "\nStatus Code Distribution:\n";
    foreach ($stats['by_status'] as $status) {
        echo "  HTTP {$status['response_code']}: {$status['count']} requests\n";
    }
}
echo "\n";

// ============================================================================
// 5. Clean Old Logs
// ============================================================================
echo "5. Cleaning old logs (older than 90 days):\n";
echo str_repeat("-", 50) . "\n";

$deletedCount = $loggingService->cleanOldLogs(90);

echo "Deleted {$deletedCount} old log entries\n\n";

// ============================================================================
// 6. Different Time Periods for Statistics
// ============================================================================
echo "6. Statistics for different time periods:\n";
echo str_repeat("-", 50) . "\n";

$periods = ['today', 'week', 'month', 'all'];

foreach ($periods as $period) {
    $stats = $loggingService->getApiStatistics($period);
    echo "{$period}: {$stats['total_requests']} requests, ";
    echo "avg {$stats['avg_response_time']}s\n";
}
echo "\n";

// ============================================================================
// 7. Activity Log Pagination Example
// ============================================================================
echo "7. Activity log pagination example:\n";
echo str_repeat("-", 50) . "\n";

$perPage = 50;
$page = 1;
$start = ($page - 1) * $perPage;

$result = $loggingService->getActivityLog([], $start, $perPage);

$totalPages = ceil($result['total'] / $perPage);

echo "Page {$page} of {$totalPages}\n";
echo "Showing " . count($result['logs']) . " of {$result['total']} total logs\n\n";

// ============================================================================
// 8. Error Handling Example
// ============================================================================
echo "8. Error handling demonstration:\n";
echo str_repeat("-", 50) . "\n";

// This would normally fail gracefully
$result = $loggingService->logPriceChange(
    999999,     // non-existent product
    0,
    0,
    'TEST',
    0
);

echo "Logging for non-existent product: " . ($result ? "SUCCESS" : "FAILED") . "\n";
echo "Note: Service handles errors gracefully and logs them\n\n";

// ============================================================================
// Summary
// ============================================================================
echo "=== Demonstration Complete ===\n\n";

echo "Key Features Demonstrated:\n";
echo "✓ Price change logging with product details\n";
echo "✓ API request logging with performance metrics\n";
echo "✓ Flexible filtering and pagination\n";
echo "✓ Comprehensive statistics generation\n";
echo "✓ Automatic log retention management\n";
echo "✓ Sensitive data redaction\n";
echo "✓ Error handling and graceful degradation\n\n";

echo "Integration Points:\n";
echo "• API Controller: Log all API requests with response times\n";
echo "• Price Service: Log all price changes with audit trail\n";
echo "• Admin Dashboard: Display statistics and recent activity\n";
echo "• Cron Jobs: Run cleanOldLogs() daily for maintenance\n\n";

echo "Next Steps:\n";
echo "1. Integrate LoggingService into API controllers\n";
echo "2. Add logging calls to PriceService\n";
echo "3. Create admin dashboard views for statistics\n";
echo "4. Set up cron job for log cleanup\n";
echo "5. Implement log export functionality\n";
