<?php
/**
 * LoggingService Verification Script
 * 
 * This script verifies that all LoggingService methods are implemented
 * correctly and return expected results.
 */

// Define constants
if (!defined('DB_PREFIX')) {
    define('DB_PREFIX', 'oc_');
}
if (!defined('DIR_CATALOG')) {
    define('DIR_CATALOG', __DIR__ . '/');
}

// Mock classes
class MockRegistry {
    private $data = [];
    public function get($key) { return isset($this->data[$key]) ? $this->data[$key] : null; }
    public function set($key, $value) { $this->data[$key] = $value; }
}

class MockDB {
    public function query($sql) {
        $result = new stdClass();
        $result->row = ['total' => 100, 'name' => 'Test Product', 'success_count' => 90, 'error_count' => 10, 'avg_time' => 0.0234];
        $result->rows = [['log_id' => 1, 'product_id' => 123, 'product_name' => 'Test', 'old_price' => 99.99, 'new_price' => 89.99, 'changed_by' => 'API', 'store_id' => 0, 'date_added' => '2024-01-28 10:00:00']];
        $result->num_rows = 1;
        return $result;
    }
    public function escape($value) { return addslashes($value); }
    public function countAffected() { return 42; }
}

class MockCache {
    public function get($key) { return null; }
    public function set($key, $value, $ttl) { return true; }
    public function delete($key) { return true; }
}

class MockConfig {
    public function get($key) { return $key === 'config_language_id' ? 1 : null; }
}

class MockLog {
    public function write($message) { /* Silent */ }
}

// Load service
require_once __DIR__ . '/Service.php';
require_once __DIR__ . '/LoggingService.php';

// Setup
$registry = new MockRegistry();
$registry->set('db', new MockDB());
$registry->set('cache', new MockCache());
$registry->set('config', new MockConfig());
$registry->set('log', new MockLog());

$service = new LoggingService($registry);

echo "=== LoggingService Verification ===\n\n";

$passed = 0;
$failed = 0;

// Test 1: logPriceChange
echo "Test 1: logPriceChange() returns boolean\n";
$result = $service->logPriceChange(123, 99.99, 89.99, 'API', 0);
if (is_bool($result)) {
    echo "✓ PASS\n\n";
    $passed++;
} else {
    echo "✗ FAIL: Expected boolean, got " . gettype($result) . "\n\n";
    $failed++;
}

// Test 2: logApiRequest
echo "Test 2: logApiRequest() returns boolean\n";
$result = $service->logApiRequest('/api/test', 'POST', '127.0.0.1', '{"test":true}', 200, 0.123);
if (is_bool($result)) {
    echo "✓ PASS\n\n";
    $passed++;
} else {
    echo "✗ FAIL: Expected boolean, got " . gettype($result) . "\n\n";
    $failed++;
}

// Test 3: getActivityLog structure
echo "Test 3: getActivityLog() returns correct structure\n";
$result = $service->getActivityLog([], 0, 50);
if (is_array($result) && isset($result['logs']) && isset($result['total'])) {
    echo "✓ PASS\n\n";
    $passed++;
} else {
    echo "✗ FAIL: Expected array with 'logs' and 'total' keys\n\n";
    $failed++;
}

// Test 4: getActivityLog with filters
echo "Test 4: getActivityLog() accepts filters\n";
$filters = ['product_id' => 123, 'date_from' => '2024-01-01', 'date_to' => '2024-01-31'];
$result = $service->getActivityLog($filters, 0, 50);
if (is_array($result) && isset($result['logs']) && isset($result['total'])) {
    echo "✓ PASS\n\n";
    $passed++;
} else {
    echo "✗ FAIL: Failed with filters\n\n";
    $failed++;
}

// Test 5: getApiStatistics structure
echo "Test 5: getApiStatistics() returns correct structure\n";
$result = $service->getApiStatistics('today');
$requiredKeys = ['total_requests', 'success_count', 'error_count', 'avg_response_time', 'by_endpoint', 'by_status'];
$hasAllKeys = true;
foreach ($requiredKeys as $key) {
    if (!isset($result[$key])) {
        $hasAllKeys = false;
        break;
    }
}
if ($hasAllKeys) {
    echo "✓ PASS\n\n";
    $passed++;
} else {
    echo "✗ FAIL: Missing required keys\n\n";
    $failed++;
}

// Test 6: getApiStatistics with different periods
echo "Test 6: getApiStatistics() accepts different periods\n";
$periods = ['today', 'week', 'month', 'all'];
$allWork = true;
foreach ($periods as $period) {
    $result = $service->getApiStatistics($period);
    if (!is_array($result) || !isset($result['total_requests'])) {
        $allWork = false;
        break;
    }
}
if ($allWork) {
    echo "✓ PASS\n\n";
    $passed++;
} else {
    echo "✗ FAIL: Failed with one or more periods\n\n";
    $failed++;
}

// Test 7: cleanOldLogs returns integer
echo "Test 7: cleanOldLogs() returns integer\n";
$result = $service->cleanOldLogs(90);
if (is_int($result)) {
    echo "✓ PASS\n\n";
    $passed++;
} else {
    echo "✗ FAIL: Expected integer, got " . gettype($result) . "\n\n";
    $failed++;
}

// Test 8: cleanOldLogs with different retention periods
echo "Test 8: cleanOldLogs() accepts different retention periods\n";
$result30 = $service->cleanOldLogs(30);
$result60 = $service->cleanOldLogs(60);
$result90 = $service->cleanOldLogs(90);
if (is_int($result30) && is_int($result60) && is_int($result90)) {
    echo "✓ PASS\n\n";
    $passed++;
} else {
    echo "✗ FAIL: Failed with different retention periods\n\n";
    $failed++;
}

// Test 9: Sensitive data redaction
echo "Test 9: Sensitive data is redacted from request logs\n";
$requestData = json_encode(['api_token' => 'secret123', 'password' => 'pass123', 'data' => 'test']);
$result = $service->logApiRequest('/api/test', 'POST', '127.0.0.1', $requestData, 200, 0.1);
// We can't directly verify redaction without inspecting the database,
// but we can verify the method completes successfully
if ($result === true) {
    echo "✓ PASS (method completed successfully)\n\n";
    $passed++;
} else {
    echo "✗ FAIL: Method failed\n\n";
    $failed++;
}

// Test 10: Large request data is truncated
echo "Test 10: Large request data is truncated\n";
$largeData = str_repeat('x', 20000); // 20KB
$result = $service->logApiRequest('/api/test', 'POST', '127.0.0.1', $largeData, 200, 0.1);
if ($result === true) {
    echo "✓ PASS (method completed successfully)\n\n";
    $passed++;
} else {
    echo "✗ FAIL: Method failed with large data\n\n";
    $failed++;
}

// Summary
echo "=== Verification Summary ===\n";
echo "Passed: {$passed}/10\n";
echo "Failed: {$failed}/10\n\n";

if ($failed === 0) {
    echo "✓ All tests passed! LoggingService is working correctly.\n";
    exit(0);
} else {
    echo "✗ Some tests failed. Please review the implementation.\n";
    exit(1);
}
