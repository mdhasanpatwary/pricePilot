<?php
/**
 * RateLimitService Requirements Verification Script
 * 
 * This script verifies that RateLimitService meets all requirements from
 * Requirement 3: Rate Limiting and Abuse Prevention
 */

// Mock OpenCart environment
class MockRegistry {
    private $data = [];
    public function get($key) { return $this->data[$key] ?? null; }
    public function set($key, $value) { $this->data[$key] = $value; }
}

class MockCache {
    private $data = [];
    public function get($key) {
        if (!isset($this->data[$key])) return null;
        $item = $this->data[$key];
        if ($item['expires'] < time()) {
            unset($this->data[$key]);
            return null;
        }
        return $item['value'];
    }
    public function set($key, $value, $ttl = 3600) {
        $this->data[$key] = ['value' => $value, 'expires' => time() + $ttl];
    }
    public function delete($key) { unset($this->data[$key]); }
}

class MockConfig {
    private $data = ['module_pricepilot_rate_limit' => 100, 'module_pricepilot_rate_window' => 60];
    public function get($key) { return $this->data[$key] ?? null; }
}

class MockLog {
    public function write($message) {}
}

class MockDB {
    public function query($sql) { return new stdClass(); }
    public function escape($value) { return addslashes($value); }
}

class MockLoader { public function model($model) {} }
class MockRequest {}
class MockResponse {}

if (!defined('DIR_APPLICATION')) {
    define('DIR_APPLICATION', __DIR__ . '/');
}

$registry = new MockRegistry();
$registry->set('cache', new MockCache());
$registry->set('config', new MockConfig());
$registry->set('log', new MockLog());
$registry->set('db', new MockDB());
$registry->set('load', new MockLoader());
$registry->set('request', new MockRequest());
$registry->set('response', new MockResponse());

require_once __DIR__ . '/Service.php';
require_once __DIR__ . '/RateLimitService.php';

$service = new RateLimitService($registry);

echo "=== RateLimitService Requirements Verification ===\n\n";

$passed = 0;
$failed = 0;

// Requirement 3.1: Reject requests exceeding 100 requests per 60 seconds with HTTP 429
echo "Requirement 3.1: Reject requests exceeding limit\n";
$testIp = '192.168.1.1';
$testEndpoint = '/api/pricepilot/test';

// Make 100 requests (should all be allowed)
for ($i = 0; $i < 100; $i++) {
    $result = $service->checkLimit($testIp, $testEndpoint);
    if ($result['allowed']) {
        $service->recordRequest($testIp, $testEndpoint);
    }
}

// 101st request should be rejected
$result = $service->checkLimit($testIp, $testEndpoint);
if (!$result['allowed'] && $result['retry_after'] !== null) {
    echo "  ✓ PASS: Request 101 rejected with retry_after value\n";
    $passed++;
} else {
    echo "  ✗ FAIL: Request 101 should be rejected\n";
    $failed++;
}

// Requirement 3.2: Return Retry-After header value
echo "\nRequirement 3.2: Return Retry-After header value\n";
if (is_int($result['retry_after']) && $result['retry_after'] > 0) {
    echo "  ✓ PASS: Retry-After value is {$result['retry_after']} seconds\n";
    $passed++;
} else {
    echo "  ✗ FAIL: Retry-After should be a positive integer\n";
    $failed++;
}

// Requirement 3.3: Track request counts per IP in cache
echo "\nRequirement 3.3: Track request counts in cache\n";
$count = $service->getCurrentCount($testIp, $testEndpoint);
if ($count === 100) {
    echo "  ✓ PASS: Request count tracked correctly (100 requests)\n";
    $passed++;
} else {
    echo "  ✗ FAIL: Expected count 100, got {$count}\n";
    $failed++;
}

// Verify different IP has separate counter
$testIp2 = '10.0.0.1';
$count2 = $service->getCurrentCount($testIp2, $testEndpoint);
if ($count2 === 0) {
    echo "  ✓ PASS: Different IP has separate counter\n";
    $passed++;
} else {
    echo "  ✗ FAIL: Different IP should have count 0, got {$count2}\n";
    $failed++;
}

// Requirement 3.4: Reset counter when window expires
echo "\nRequirement 3.4: Reset counter functionality\n";
$service->resetLimit($testIp, $testEndpoint);
$countAfterReset = $service->getCurrentCount($testIp, $testEndpoint);
if ($countAfterReset === 0) {
    echo "  ✓ PASS: Counter reset successfully\n";
    $passed++;
} else {
    echo "  ✗ FAIL: Counter should be 0 after reset, got {$countAfterReset}\n";
    $failed++;
}

// Verify request allowed after reset
$result = $service->checkLimit($testIp, $testEndpoint);
if ($result['allowed']) {
    echo "  ✓ PASS: Request allowed after reset\n";
    $passed++;
} else {
    echo "  ✗ FAIL: Request should be allowed after reset\n";
    $failed++;
}

// Additional verification: Cache key format
echo "\nAdditional: Cache key format verification\n";
$service->recordRequest($testIp, $testEndpoint);
$count = $service->getCurrentCount($testIp, $testEndpoint);
if ($count === 1) {
    echo "  ✓ PASS: Cache key format working correctly\n";
    $passed++;
} else {
    echo "  ✗ FAIL: Cache key format issue\n";
    $failed++;
}

// Additional verification: Per-endpoint isolation
echo "\nAdditional: Per-endpoint isolation\n";
$testEndpoint2 = '/api/pricepilot/other';
$result = $service->checkLimit($testIp, $testEndpoint2);
if ($result['allowed']) {
    echo "  ✓ PASS: Different endpoint has separate counter\n";
    $passed++;
} else {
    echo "  ✗ FAIL: Different endpoint should have separate counter\n";
    $failed++;
}

// Summary
echo "\n=== Verification Summary ===\n";
echo "Passed: {$passed}\n";
echo "Failed: {$failed}\n";
echo "Total:  " . ($passed + $failed) . "\n";

if ($failed === 0) {
    echo "\n✓ All requirements verified successfully!\n";
    exit(0);
} else {
    echo "\n✗ Some requirements failed verification\n";
    exit(1);
}
