<?php
/**
 * RateLimitService Demonstration Script
 * 
 * This script demonstrates the usage of RateLimitService for API request throttling.
 * It shows how to check rate limits, record requests, and handle rate limit exceeded scenarios.
 * 
 * Usage: php ratelimit-demo.php
 */

// Mock OpenCart environment for demonstration
class MockRegistry {
    private $data = [];
    
    public function get($key) {
        return $this->data[$key] ?? null;
    }
    
    public function set($key, $value) {
        $this->data[$key] = $value;
    }
}

class MockCache {
    private $data = [];
    
    public function get($key) {
        if (!isset($this->data[$key])) {
            return null;
        }
        
        $item = $this->data[$key];
        
        // Check if expired
        if ($item['expires'] < time()) {
            unset($this->data[$key]);
            return null;
        }
        
        return $item['value'];
    }
    
    public function set($key, $value, $ttl = 3600) {
        $this->data[$key] = [
            'value' => $value,
            'expires' => time() + $ttl
        ];
    }
    
    public function delete($key) {
        unset($this->data[$key]);
    }
}

class MockConfig {
    private $data = [
        'module_pricepilot_rate_limit' => 5,  // 5 requests for demo
        'module_pricepilot_rate_window' => 10  // 10 second window for demo
    ];
    
    public function get($key) {
        return $this->data[$key] ?? null;
    }
}

class MockLog {
    public function write($message) {
        echo "[LOG] " . $message . "\n";
    }
}

class MockDB {
    public function query($sql) {
        return new stdClass();
    }
    
    public function escape($value) {
        return addslashes($value);
    }
}

class MockLoader {
    public function model($model) {}
}

class MockRequest {}
class MockResponse {}

// Define DIR_APPLICATION constant
if (!defined('DIR_APPLICATION')) {
    define('DIR_APPLICATION', __DIR__ . '/');
}

// Setup mock registry
$registry = new MockRegistry();
$registry->set('cache', new MockCache());
$registry->set('config', new MockConfig());
$registry->set('log', new MockLog());
$registry->set('db', new MockDB());
$registry->set('load', new MockLoader());
$registry->set('request', new MockRequest());
$registry->set('response', new MockResponse());

// Load RateLimitService
require_once __DIR__ . '/Service.php';
require_once __DIR__ . '/RateLimitService.php';

// Create service instance
$rateLimitService = new RateLimitService($registry);

echo "=== RateLimitService Demonstration ===\n\n";

// Get configuration
$config = $rateLimitService->getRateLimitConfig();
echo "Rate Limit Configuration:\n";
echo "  Limit: {$config['limit']} requests\n";
echo "  Window: {$config['window']} seconds\n\n";

// Test IP and endpoint
$testIp = '192.168.1.100';
$testEndpoint = '/api/pricepilot/products';

echo "Testing rate limiting for IP: {$testIp}\n";
echo "Endpoint: {$testEndpoint}\n\n";

// Simulate multiple requests
echo "--- Simulating Requests ---\n";
for ($i = 1; $i <= 7; $i++) {
    echo "\nRequest #{$i}:\n";
    
    // Check if request is allowed
    $result = $rateLimitService->checkLimit($testIp, $testEndpoint);
    
    if ($result['allowed']) {
        echo "  ✓ Request ALLOWED\n";
        
        // Record the request
        $rateLimitService->recordRequest($testIp, $testEndpoint);
        
        // Show current count
        $count = $rateLimitService->getCurrentCount($testIp, $testEndpoint);
        echo "  Current count: {$count}/{$config['limit']}\n";
    } else {
        echo "  ✗ Request BLOCKED (Rate limit exceeded)\n";
        echo "  Retry after: {$result['retry_after']} seconds\n";
        
        // Show current count
        $count = $rateLimitService->getCurrentCount($testIp, $testEndpoint);
        echo "  Current count: {$count}/{$config['limit']}\n";
    }
}

// Test reset functionality
echo "\n\n--- Testing Reset Functionality ---\n";
echo "Resetting rate limit for IP: {$testIp}\n";
$rateLimitService->resetLimit($testIp);

$count = $rateLimitService->getCurrentCount($testIp, $testEndpoint);
echo "Count after reset: {$count}\n";

// Test one more request after reset
echo "\nRequest after reset:\n";
$result = $rateLimitService->checkLimit($testIp, $testEndpoint);
if ($result['allowed']) {
    echo "  ✓ Request ALLOWED\n";
    $rateLimitService->recordRequest($testIp, $testEndpoint);
    $count = $rateLimitService->getCurrentCount($testIp, $testEndpoint);
    echo "  Current count: {$count}/{$config['limit']}\n";
}

// Test different endpoint
echo "\n\n--- Testing Different Endpoint ---\n";
$testEndpoint2 = '/api/pricepilot/update';
echo "Endpoint: {$testEndpoint2}\n";

$result = $rateLimitService->checkLimit($testIp, $testEndpoint2);
echo "Request status: " . ($result['allowed'] ? 'ALLOWED' : 'BLOCKED') . "\n";

if ($result['allowed']) {
    $rateLimitService->recordRequest($testIp, $testEndpoint2);
    $count = $rateLimitService->getCurrentCount($testIp, $testEndpoint2);
    echo "Current count: {$count}/{$config['limit']}\n";
}

// Test different IP
echo "\n\n--- Testing Different IP Address ---\n";
$testIp2 = '10.0.0.50';
echo "IP: {$testIp2}\n";
echo "Endpoint: {$testEndpoint}\n";

$result = $rateLimitService->checkLimit($testIp2, $testEndpoint);
echo "Request status: " . ($result['allowed'] ? 'ALLOWED' : 'BLOCKED') . "\n";

if ($result['allowed']) {
    $rateLimitService->recordRequest($testIp2, $testEndpoint);
    $count = $rateLimitService->getCurrentCount($testIp2, $testEndpoint);
    echo "Current count: {$count}/{$config['limit']}\n";
}

echo "\n=== Demonstration Complete ===\n";
