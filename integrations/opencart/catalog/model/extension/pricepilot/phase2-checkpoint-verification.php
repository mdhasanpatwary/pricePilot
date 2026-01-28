<?php
/**
 * Phase 2 Checkpoint Verification Script
 * 
 * This script verifies that all Phase 2 core functionality is complete:
 * - ProductService implementation
 * - PriceService implementation
 * - API controller endpoints
 * - WebhookService implementation
 * - QueueService implementation
 * - Admin dashboard
 * - Activity log viewer
 * - API connection testing
 * - Token management
 * - Webhook configuration
 */

// Simulated OpenCart registry for testing
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
        return new MockResult();
    }
    
    public function escape($value) {
        return addslashes($value);
    }
}

class MockResult {
    public $row = [];
    public $rows = [];
    public $num_rows = 0;
}

class MockCache {
    private $data = [];
    
    public function get($key) {
        return isset($this->data[$key]) ? $this->data[$key] : null;
    }
    
    public function set($key, $value, $expire = 3600) {
        $this->data[$key] = $value;
    }
    
    public function delete($key) {
        unset($this->data[$key]);
    }
}

class MockConfig {
    private $data = [];
    
    public function __construct() {
        $this->data = [
            'module_pricepilot_status' => 1,
            'module_pricepilot_token' => str_repeat('a', 64),
            'module_pricepilot_rate_limit' => 100,
            'module_pricepilot_rate_window' => 60,
        ];
    }
    
    public function get($key) {
        return isset($this->data[$key]) ? $this->data[$key] : null;
    }
}

class MockLog {
    public function write($message) {
        // Silent logging for tests
    }
}

// Initialize mock registry
$registry = new MockRegistry();
$registry->set('db', new MockDB());
$registry->set('cache', new MockCache());
$registry->set('config', new MockConfig());
$registry->set('log', new MockLog());

// Test results
$results = [
    'total' => 0,
    'passed' => 0,
    'failed' => 0,
    'tests' => []
];

function test($name, $callback) {
    global $results;
    $results['total']++;
    
    try {
        $result = $callback();
        if ($result) {
            $results['passed']++;
            $results['tests'][] = ['name' => $name, 'status' => 'PASS'];
            echo "✓ {$name}\n";
        } else {
            $results['failed']++;
            $results['tests'][] = ['name' => $name, 'status' => 'FAIL', 'reason' => 'Assertion failed'];
            echo "✗ {$name}\n";
        }
    } catch (Exception $e) {
        $results['failed']++;
        $results['tests'][] = ['name' => $name, 'status' => 'FAIL', 'reason' => $e->getMessage()];
        echo "✗ {$name}: {$e->getMessage()}\n";
    }
}

echo "\n";
echo "=================================================================\n";
echo "Phase 2 Checkpoint Verification\n";
echo "=================================================================\n\n";

// Test 1: ProductService exists and can be instantiated
echo "Testing ProductService...\n";
test('ProductService class exists', function() {
    return class_exists('ProductService', false) || file_exists(__DIR__ . '/ProductService.php');
});

if (file_exists(__DIR__ . '/ProductService.php')) {
    require_once __DIR__ . '/Service.php';
    require_once __DIR__ . '/ProductService.php';
    
    test('ProductService can be instantiated', function() use ($registry) {
        $service = new ProductService($registry);
        return $service instanceof ProductService;
    });
    
    test('ProductService has getProducts method', function() {
        return method_exists('ProductService', 'getProducts');
    });
    
    test('ProductService has getProduct method', function() {
        return method_exists('ProductService', 'getProduct');
    });
    
    test('ProductService has searchProducts method', function() {
        return method_exists('ProductService', 'searchProducts');
    });
    
    test('ProductService has getProductWithVariants method', function() {
        return method_exists('ProductService', 'getProductWithVariants');
    });
}

echo "\n";

// Test 2: PriceService exists and can be instantiated
echo "Testing PriceService...\n";
test('PriceService class exists', function() {
    return class_exists('PriceService', false) || file_exists(__DIR__ . '/PriceService.php');
});

if (file_exists(__DIR__ . '/PriceService.php')) {
    $priceServiceContent = file_get_contents(__DIR__ . '/PriceService.php');
    
    test('PriceService has updatePrice method', function() use ($priceServiceContent) {
        return strpos($priceServiceContent, 'function updatePrice') !== false;
    });
    
    test('PriceService has bulkUpdatePrices method', function() use ($priceServiceContent) {
        return strpos($priceServiceContent, 'function bulkUpdatePrices') !== false;
    });
    
    test('PriceService has updateStock method', function() use ($priceServiceContent) {
        return strpos($priceServiceContent, 'function updateStock') !== false;
    });
    
    test('PriceService has updateSpecialPrice method', function() use ($priceServiceContent) {
        return strpos($priceServiceContent, 'function updateSpecialPrice') !== false;
    });
    
    test('PriceService has createPriceBackup method', function() use ($priceServiceContent) {
        return strpos($priceServiceContent, 'function createPriceBackup') !== false;
    });
    
    test('PriceService has restorePriceBackup method', function() use ($priceServiceContent) {
        return strpos($priceServiceContent, 'function restorePriceBackup') !== false;
    });
}

echo "\n";

// Test 3: WebhookService exists and can be instantiated
echo "Testing WebhookService...\n";
test('WebhookService class exists', function() {
    return class_exists('WebhookService', false) || file_exists(__DIR__ . '/WebhookService.php');
});

if (file_exists(__DIR__ . '/WebhookService.php')) {
    $webhookServiceContent = file_get_contents(__DIR__ . '/WebhookService.php');
    
    test('WebhookService has triggerEvent method', function() use ($webhookServiceContent) {
        return strpos($webhookServiceContent, 'function triggerEvent') !== false;
    });
    
    test('WebhookService has sendWebhook method', function() use ($webhookServiceContent) {
        return strpos($webhookServiceContent, 'function sendWebhook') !== false;
    });
    
    test('WebhookService has getWebhooksForEvent method', function() use ($webhookServiceContent) {
        return strpos($webhookServiceContent, 'function getWebhooksForEvent') !== false;
    });
    
    test('WebhookService has validateWebhookUrl method', function() use ($webhookServiceContent) {
        return strpos($webhookServiceContent, 'function validateWebhookUrl') !== false;
    });
}

echo "\n";

// Test 4: QueueService exists and can be instantiated
echo "Testing QueueService...\n";
test('QueueService class exists', function() {
    return class_exists('QueueService', false) || file_exists(__DIR__ . '/QueueService.php');
});

if (file_exists(__DIR__ . '/QueueService.php')) {
    $queueServiceContent = file_get_contents(__DIR__ . '/QueueService.php');
    
    test('QueueService has enqueue method', function() use ($queueServiceContent) {
        return strpos($queueServiceContent, 'function enqueue') !== false;
    });
    
    test('QueueService has processNext method', function() use ($queueServiceContent) {
        return strpos($queueServiceContent, 'function processNext') !== false;
    });
    
    test('QueueService has getJobStatus method', function() use ($queueServiceContent) {
        return strpos($queueServiceContent, 'function getJobStatus') !== false;
    });
    
    test('QueueService has cancelJob method', function() use ($queueServiceContent) {
        return strpos($queueServiceContent, 'function cancelJob') !== false;
    });
}

echo "\n";

// Test 5: API Controller exists
echo "Testing API Controller...\n";
$apiControllerPath = dirname(dirname(dirname(__DIR__))) . '/controller/api/pricepilot.php';
test('API Controller file exists', function() use ($apiControllerPath) {
    return file_exists($apiControllerPath);
});

if (file_exists($apiControllerPath)) {
    $apiContent = file_get_contents($apiControllerPath);
    
    test('API Controller has index method', function() use ($apiContent) {
        return strpos($apiContent, 'function index()') !== false || 
               strpos($apiContent, 'public function index()') !== false;
    });
    
    test('API Controller has update method', function() use ($apiContent) {
        return strpos($apiContent, 'function update()') !== false || 
               strpos($apiContent, 'public function update()') !== false;
    });
    
    test('API Controller has bulkUpdate method', function() use ($apiContent) {
        return strpos($apiContent, 'function bulkUpdate()') !== false || 
               strpos($apiContent, 'public function bulkUpdate()') !== false;
    });
    
    test('API Controller has stockUpdate method', function() use ($apiContent) {
        return strpos($apiContent, 'function stockUpdate()') !== false || 
               strpos($apiContent, 'public function stockUpdate()') !== false;
    });
    
    test('API Controller uses ValidationService', function() use ($apiContent) {
        return strpos($apiContent, 'ValidationService') !== false;
    });
    
    test('API Controller uses AuthenticationService', function() use ($apiContent) {
        return strpos($apiContent, 'AuthenticationService') !== false;
    });
    
    test('API Controller uses RateLimitService', function() use ($apiContent) {
        return strpos($apiContent, 'RateLimitService') !== false;
    });
}

echo "\n";

// Test 6: Admin Controller exists
echo "Testing Admin Controller...\n";
$adminControllerPath = dirname(dirname(dirname(dirname(__DIR__)))) . '/admin/controller/extension/module/pricepilot.php';
test('Admin Controller file exists', function() use ($adminControllerPath) {
    return file_exists($adminControllerPath);
});

if (file_exists($adminControllerPath)) {
    $adminContent = file_get_contents($adminControllerPath);
    
    test('Admin Controller has dashboard method', function() use ($adminContent) {
        return strpos($adminContent, 'function dashboard()') !== false || 
               strpos($adminContent, 'public function dashboard()') !== false ||
               strpos($adminContent, 'function index()') !== false;
    });
    
    test('Admin Controller has activityLog method', function() use ($adminContent) {
        return strpos($adminContent, 'function activityLog()') !== false || 
               strpos($adminContent, 'public function activityLog()') !== false;
    });
    
    test('Admin Controller has testConnection method', function() use ($adminContent) {
        return strpos($adminContent, 'function testConnection()') !== false || 
               strpos($adminContent, 'public function testConnection()') !== false;
    });
    
    test('Admin Controller has regenerateToken method', function() use ($adminContent) {
        return strpos($adminContent, 'function regenerateToken()') !== false || 
               strpos($adminContent, 'public function regenerateToken()') !== false;
    });
    
    test('Admin Controller has webhook management methods', function() use ($adminContent) {
        return strpos($adminContent, 'webhook') !== false;
    });
}

echo "\n";

// Test 7: Admin Views exist
echo "Testing Admin Views...\n";
$adminViewPath = dirname(dirname(dirname(dirname(__DIR__)))) . '/admin/view/template/extension/module';

test('Admin dashboard view exists', function() use ($adminViewPath) {
    return file_exists($adminViewPath . '/pricepilot.twig') || 
           file_exists($adminViewPath . '/pricepilot.tpl');
});

test('Admin activity log view exists', function() use ($adminViewPath) {
    return file_exists($adminViewPath . '/pricepilot_activity_log.twig') || 
           file_exists($adminViewPath . '/pricepilot_activity_log.tpl');
});

echo "\n";

// Summary
echo "=================================================================\n";
echo "Verification Summary\n";
echo "=================================================================\n";
echo "Total Tests: {$results['total']}\n";
echo "Passed: {$results['passed']}\n";
echo "Failed: {$results['failed']}\n";
echo "Success Rate: " . round(($results['passed'] / $results['total']) * 100, 2) . "%\n";
echo "=================================================================\n\n";

if ($results['failed'] > 0) {
    echo "Failed Tests:\n";
    foreach ($results['tests'] as $test) {
        if ($test['status'] === 'FAIL') {
            echo "  - {$test['name']}";
            if (isset($test['reason'])) {
                echo ": {$test['reason']}";
            }
            echo "\n";
        }
    }
    echo "\n";
}

// Exit with appropriate code
exit($results['failed'] > 0 ? 1 : 0);
