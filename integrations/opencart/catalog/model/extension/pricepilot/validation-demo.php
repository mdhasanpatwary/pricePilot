<?php
/**
 * ValidationService Demo Script
 * 
 * This script demonstrates the ValidationService functionality.
 * Note: This is for demonstration purposes only and requires OpenCart environment.
 */

// Mock OpenCart registry for demonstration
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
    public function escape($value) {
        return addslashes($value);
    }
}

class MockCache {
    private $cache = [];
    
    public function get($key) {
        return isset($this->cache[$key]) ? $this->cache[$key] : null;
    }
    
    public function set($key, $value, $ttl = 300) {
        $this->cache[$key] = $value;
    }
    
    public function delete($key) {
        unset($this->cache[$key]);
    }
}

class MockConfig {
    public function get($key) {
        return null;
    }
}

class MockLog {
    public function write($message) {
        echo "[LOG] $message\n";
    }
}

// Initialize mock registry
$registry = new MockRegistry();
$registry->set('db', new MockDB());
$registry->set('cache', new MockCache());
$registry->set('config', new MockConfig());
$registry->set('log', new MockLog());
$registry->set('load', new stdClass());
$registry->set('request', new stdClass());
$registry->set('response', new stdClass());

// Load ValidationService
define('DIR_CATALOG', __DIR__ . '/');
require_once('Service.php');
require_once('ValidationService.php');

// Create service instance
$validator = new ValidationService($registry);

echo "=== ValidationService Demo ===\n\n";

// Test 1: Valid Product ID
echo "Test 1: Valid Product ID (123)\n";
$result = $validator->validateProductId(123);
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Value: " . ($result['value'] ?? 'null') . "\n";
echo "Error: " . ($result['error'] ?? 'none') . "\n\n";

// Test 2: Invalid Product ID (negative)
echo "Test 2: Invalid Product ID (-5)\n";
$result = $validator->validateProductId(-5);
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Error: " . ($result['error'] ?? 'none') . "\n\n";

// Test 3: Invalid Product ID (string)
echo "Test 3: Invalid Product ID ('abc')\n";
$result = $validator->validateProductId('abc');
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Error: " . ($result['error'] ?? 'none') . "\n\n";

// Test 4: Valid Price
echo "Test 4: Valid Price (99.99)\n";
$result = $validator->validatePrice(99.99);
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Value: " . ($result['value'] ?? 'null') . "\n";
echo "Error: " . ($result['error'] ?? 'none') . "\n\n";

// Test 5: Invalid Price (too many decimals)
echo "Test 5: Invalid Price (99.99999)\n";
$result = $validator->validatePrice(99.99999);
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Error: " . ($result['error'] ?? 'none') . "\n\n";

// Test 6: Invalid Price (negative)
echo "Test 6: Invalid Price (-10.00)\n";
$result = $validator->validatePrice(-10.00);
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Error: " . ($result['error'] ?? 'none') . "\n\n";

// Test 7: Valid Token Format
echo "Test 7: Valid Token Format (64 hex chars)\n";
$validToken = str_repeat('a', 64);
$result = $validator->validateTokenFormat($validToken);
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Error: " . ($result['error'] ?? 'none') . "\n\n";

// Test 8: Invalid Token Format (wrong length)
echo "Test 8: Invalid Token Format (32 chars)\n";
$invalidToken = str_repeat('a', 32);
$result = $validator->validateTokenFormat($invalidToken);
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Error: " . ($result['error'] ?? 'none') . "\n\n";

// Test 9: Invalid Token Format (non-hex)
echo "Test 9: Invalid Token Format (contains 'z')\n";
$invalidToken = str_repeat('z', 64);
$result = $validator->validateTokenFormat($invalidToken);
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Error: " . ($result['error'] ?? 'none') . "\n\n";

// Test 10: Valid Payload Size
echo "Test 10: Valid Payload Size (small payload)\n";
$payload = json_encode(['test' => 'data']);
$result = $validator->validatePayloadSize($payload);
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Payload size: " . strlen($payload) . " bytes\n";
echo "Error: " . ($result['error'] ?? 'none') . "\n\n";

// Test 11: Invalid Payload Size (too large)
echo "Test 11: Invalid Payload Size (> 1MB)\n";
$largePayload = str_repeat('x', 1048577); // 1MB + 1 byte
$result = $validator->validatePayloadSize($largePayload);
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Payload size: " . strlen($largePayload) . " bytes\n";
echo "Error: " . ($result['error'] ?? 'none') . "\n\n";

// Test 12: Valid Bulk Update
echo "Test 12: Valid Bulk Update (2 products)\n";
$products = [
    ['product_id' => 123, 'price' => 99.99],
    ['product_id' => 124, 'price' => 149.99]
];
$result = $validator->validateBulkUpdate($products);
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Valid products: " . count($result['products']) . "\n";
echo "Errors: " . (empty($result['errors']) ? 'none' : implode(', ', $result['errors'])) . "\n\n";

// Test 13: Invalid Bulk Update (missing price)
echo "Test 13: Invalid Bulk Update (missing price)\n";
$products = [
    ['product_id' => 123],
    ['product_id' => 124, 'price' => 149.99]
];
$result = $validator->validateBulkUpdate($products);
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Valid products: " . count($result['products']) . "\n";
echo "Errors: " . (empty($result['errors']) ? 'none' : implode(', ', $result['errors'])) . "\n\n";

// Test 14: Invalid Bulk Update (invalid product_id)
echo "Test 14: Invalid Bulk Update (invalid product_id)\n";
$products = [
    ['product_id' => -5, 'price' => 99.99],
    ['product_id' => 124, 'price' => 149.99]
];
$result = $validator->validateBulkUpdate($products);
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Valid products: " . count($result['products']) . "\n";
echo "Errors: " . (empty($result['errors']) ? 'none' : implode(', ', $result['errors'])) . "\n\n";

// Test 15: Empty Bulk Update
echo "Test 15: Empty Bulk Update\n";
$products = [];
$result = $validator->validateBulkUpdate($products);
echo "Valid: " . ($result['valid'] ? 'Yes' : 'No') . "\n";
echo "Errors: " . (empty($result['errors']) ? 'none' : implode(', ', $result['errors'])) . "\n\n";

echo "=== Demo Complete ===\n";
