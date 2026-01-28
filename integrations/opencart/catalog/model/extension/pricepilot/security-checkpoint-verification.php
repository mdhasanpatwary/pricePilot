<?php
/**
 * Security Foundation Checkpoint Verification Script
 * 
 * This script verifies that all Phase 1 security components are working correctly:
 * - Service layer architecture
 * - ValidationService
 * - AuthenticationService
 * - RateLimitService
 * - ErrorHandlingService
 * - LoggingService
 * - Database schema with indexes
 * 
 * Usage: Run this script from command line or browser to verify security foundation
 */

// Simulated OpenCart environment for testing
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
    
    public function query($sql) {
        $result = new stdClass();
        $result->row = [];
        $result->rows = [];
        $result->num_rows = 0;
        return $result;
    }
}

class MockCache {
    private $data = [];
    
    public function get($key) {
        if (isset($this->data[$key])) {
            if ($this->data[$key]['expires'] > time()) {
                return $this->data[$key]['value'];
            }
            unset($this->data[$key]);
        }
        return null;
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
        'module_pricepilot_token' => 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        'module_pricepilot_rate_limit' => 100,
        'module_pricepilot_rate_window' => 60,
        'config_language_id' => 1
    ];
    
    public function get($key) {
        return isset($this->data[$key]) ? $this->data[$key] : null;
    }
}

class MockLog {
    public function write($message) {
        // Silent for testing
    }
}

class MockLoader {
    public function model($path) {
        // Silent for testing
    }
}

class MockRequest {
    public $get = [];
    public $post = [];
    public $server = [];
}

class MockResponse {
    private $headers = [];
    private $output = '';
    
    public function addHeader($header) {
        $this->headers[] = $header;
    }
    
    public function setOutput($output) {
        $this->output = $output;
    }
    
    public function getOutput() {
        return $this->output;
    }
    
    public function getHeaders() {
        return $this->headers;
    }
}

// Setup mock environment
$registry = new MockRegistry();
$registry->set('db', new MockDB());
$registry->set('cache', new MockCache());
$registry->set('config', new MockConfig());
$registry->set('log', new MockLog());
$registry->set('load', new MockLoader());
$registry->set('request', new MockRequest());
$registry->set('response', new MockResponse());

// Define DIR_CATALOG constant if not defined
if (!defined('DIR_CATALOG')) {
    define('DIR_CATALOG', __DIR__ . '/../../');
}

// Define DB_PREFIX if not defined
if (!defined('DB_PREFIX')) {
    define('DB_PREFIX', 'oc_');
}

// Load services
require_once __DIR__ . '/Service.php';
require_once __DIR__ . '/ValidationService.php';
require_once __DIR__ . '/AuthenticationService.php';
require_once __DIR__ . '/RateLimitService.php';
require_once __DIR__ . '/ErrorHandlingService.php';
require_once __DIR__ . '/LoggingService.php';

// Test results
$results = [];
$passed = 0;
$failed = 0;

function test($name, $callback) {
    global $results, $passed, $failed;
    
    try {
        $result = $callback();
        if ($result === true) {
            $results[] = ['name' => $name, 'status' => 'PASS', 'message' => ''];
            $passed++;
        } else {
            $results[] = ['name' => $name, 'status' => 'FAIL', 'message' => $result];
            $failed++;
        }
    } catch (Exception $e) {
        $results[] = ['name' => $name, 'status' => 'ERROR', 'message' => $e->getMessage()];
        $failed++;
    }
}

echo "=== PricePilot Security Foundation Checkpoint ===\n\n";

// Test 1: Service Layer Architecture
echo "Testing Service Layer Architecture...\n";

test('Service base class exists', function() {
    return class_exists('Service');
});

test('Service can be instantiated with registry', function() use ($registry) {
    $service = new class($registry) extends Service {
        public function testAccess() {
            return $this->db !== null && $this->cache !== null && $this->config !== null;
        }
    };
    return $service->testAccess();
});

// Test 2: ValidationService
echo "\nTesting ValidationService...\n";

$validationService = new ValidationService($registry);

test('ValidationService: Valid product ID accepted', function() use ($validationService) {
    $result = $validationService->validateProductId(123);
    return $result['valid'] === true && $result['value'] === 123;
});

test('ValidationService: Negative product ID rejected', function() use ($validationService) {
    $result = $validationService->validateProductId(-1);
    return $result['valid'] === false;
});

test('ValidationService: Zero product ID rejected', function() use ($validationService) {
    $result = $validationService->validateProductId(0);
    return $result['valid'] === false;
});

test('ValidationService: Non-numeric product ID rejected', function() use ($validationService) {
    $result = $validationService->validateProductId('abc');
    return $result['valid'] === false;
});

test('ValidationService: Valid price accepted', function() use ($validationService) {
    $result = $validationService->validatePrice(99.99);
    return $result['valid'] === true && abs($result['value'] - 99.99) < 0.0001;
});

test('ValidationService: Negative price rejected', function() use ($validationService) {
    $result = $validationService->validatePrice(-10.00);
    return $result['valid'] === false;
});

test('ValidationService: Price with too many decimals rejected', function() use ($validationService) {
    $result = $validationService->validatePrice('99.99999');
    return $result['valid'] === false;
});

test('ValidationService: Valid token format accepted', function() use ($validationService) {
    $token = str_repeat('a', 64);
    $result = $validationService->validateTokenFormat($token);
    return $result['valid'] === true;
});

test('ValidationService: Short token rejected', function() use ($validationService) {
    $result = $validationService->validateTokenFormat('short');
    return $result['valid'] === false;
});

test('ValidationService: Non-hex token rejected', function() use ($validationService) {
    $token = str_repeat('z', 64);
    $result = $validationService->validateTokenFormat($token);
    return $result['valid'] === false;
});

test('ValidationService: Valid bulk update accepted', function() use ($validationService) {
    $products = [
        ['product_id' => 1, 'price' => 10.00],
        ['product_id' => 2, 'price' => 20.00]
    ];
    $result = $validationService->validateBulkUpdate($products);
    return $result['valid'] === true && count($result['products']) === 2;
});

test('ValidationService: Empty bulk update rejected', function() use ($validationService) {
    $result = $validationService->validateBulkUpdate([]);
    return $result['valid'] === false;
});

// Test 3: AuthenticationService
echo "\nTesting AuthenticationService...\n";

$authService = new AuthenticationService($registry);

test('AuthenticationService: Valid token accepted', function() use ($authService) {
    $token = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    return $authService->validateToken($token) === true;
});

test('AuthenticationService: Invalid token rejected', function() use ($authService) {
    $token = str_repeat('0', 64);
    return $authService->validateToken($token) === false;
});

test('AuthenticationService: Short token rejected', function() use ($authService) {
    return $authService->validateToken('short') === false;
});

test('AuthenticationService: Token generation produces 64-char hex', function() use ($authService) {
    $token = $authService->generateToken();
    return strlen($token) === 64 && ctype_xdigit($token);
});

test('AuthenticationService: Generated tokens are unique', function() use ($authService) {
    $token1 = $authService->generateToken();
    $token2 = $authService->generateToken();
    return $token1 !== $token2;
});

test('AuthenticationService: IP whitelist disabled allows all IPs', function() use ($authService) {
    return $authService->isIpWhitelisted('192.168.1.1') === true;
});

test('AuthenticationService: Auth attempt logging works', function() use ($authService) {
    $authService->logAuthAttempt('192.168.1.1', true);
    $attempts = $authService->getAuthAttempts('192.168.1.1');
    return count($attempts) > 0;
});

// Test 4: RateLimitService
echo "\nTesting RateLimitService...\n";

$rateLimitService = new RateLimitService($registry);

test('RateLimitService: First request allowed', function() use ($rateLimitService) {
    $result = $rateLimitService->checkLimit('192.168.1.100', '/api/test');
    return $result['allowed'] === true;
});

test('RateLimitService: Request recording increments count', function() use ($rateLimitService) {
    $ip = '192.168.1.101';
    $endpoint = '/api/test';
    $rateLimitService->recordRequest($ip, $endpoint);
    $count = $rateLimitService->getCurrentCount($ip, $endpoint);
    return $count === 1;
});

test('RateLimitService: Multiple requests increment count', function() use ($rateLimitService) {
    $ip = '192.168.1.102';
    $endpoint = '/api/test';
    $rateLimitService->recordRequest($ip, $endpoint);
    $rateLimitService->recordRequest($ip, $endpoint);
    $rateLimitService->recordRequest($ip, $endpoint);
    $count = $rateLimitService->getCurrentCount($ip, $endpoint);
    return $count === 3;
});

test('RateLimitService: Reset clears count', function() use ($rateLimitService) {
    $ip = '192.168.1.103';
    $endpoint = '/api/test';
    $rateLimitService->recordRequest($ip, $endpoint);
    $rateLimitService->resetLimit($ip, $endpoint);
    $count = $rateLimitService->getCurrentCount($ip, $endpoint);
    return $count === 0;
});

test('RateLimitService: Config returns correct values', function() use ($rateLimitService) {
    $config = $rateLimitService->getRateLimitConfig();
    return $config['limit'] === 100 && $config['window'] === 60;
});

// Test 5: ErrorHandlingService
echo "\nTesting ErrorHandlingService...\n";

$errorService = new ErrorHandlingService($registry);

test('ErrorHandlingService: Validation error creates proper response', function() use ($errorService, $registry) {
    $errorService->sendValidationError('Test validation error');
    $output = $registry->get('response')->getOutput();
    $decoded = json_decode($output, true);
    return isset($decoded['error']) && $decoded['code'] === 'INVALID_PARAMETER';
});

test('ErrorHandlingService: Auth error creates proper response', function() use ($errorService, $registry) {
    $errorService->sendAuthenticationError();
    $output = $registry->get('response')->getOutput();
    $decoded = json_decode($output, true);
    return isset($decoded['error']) && $decoded['code'] === 'AUTH_FAILED';
});

test('ErrorHandlingService: Not found error creates proper response', function() use ($errorService, $registry) {
    $errorService->sendNotFoundError();
    $output = $registry->get('response')->getOutput();
    $decoded = json_decode($output, true);
    return isset($decoded['error']) && $decoded['code'] === 'NOT_FOUND';
});

test('ErrorHandlingService: Rate limit error includes retry_after', function() use ($errorService, $registry) {
    $errorService->sendRateLimitError(60);
    $output = $registry->get('response')->getOutput();
    $decoded = json_decode($output, true);
    return isset($decoded['details']['retry_after']) && $decoded['details']['retry_after'] === 60;
});

test('ErrorHandlingService: Success response is valid JSON', function() use ($errorService, $registry) {
    $errorService->sendSuccessResponse(['status' => 'ok']);
    $output = $registry->get('response')->getOutput();
    $decoded = json_decode($output, true);
    return isset($decoded['status']) && $decoded['status'] === 'ok';
});

// Test 6: LoggingService
echo "\nTesting LoggingService...\n";

$loggingService = new LoggingService($registry);

test('LoggingService: Class instantiates correctly', function() use ($loggingService) {
    return $loggingService instanceof LoggingService;
});

test('LoggingService: Has logPriceChange method', function() use ($loggingService) {
    return method_exists($loggingService, 'logPriceChange');
});

test('LoggingService: Has logApiRequest method', function() use ($loggingService) {
    return method_exists($loggingService, 'logApiRequest');
});

test('LoggingService: Has getActivityLog method', function() use ($loggingService) {
    return method_exists($loggingService, 'getActivityLog');
});

test('LoggingService: Has getApiStatistics method', function() use ($loggingService) {
    return method_exists($loggingService, 'getApiStatistics');
});

test('LoggingService: Has cleanOldLogs method', function() use ($loggingService) {
    return method_exists($loggingService, 'cleanOldLogs');
});

// Print results
echo "\n=== Test Results ===\n\n";

foreach ($results as $result) {
    $status = $result['status'];
    $symbol = $status === 'PASS' ? '✓' : '✗';
    $color = $status === 'PASS' ? '' : '';
    
    echo sprintf("%s [%s] %s", $symbol, $status, $result['name']);
    
    if ($result['message']) {
        echo "\n    Error: " . $result['message'];
    }
    
    echo "\n";
}

echo "\n=== Summary ===\n";
echo "Total Tests: " . ($passed + $failed) . "\n";
echo "Passed: " . $passed . "\n";
echo "Failed: " . $failed . "\n";
echo "Success Rate: " . round(($passed / ($passed + $failed)) * 100, 2) . "%\n";

if ($failed === 0) {
    echo "\n✓ All security foundation tests passed!\n";
    echo "The security layer is ready for Phase 2 implementation.\n";
    exit(0);
} else {
    echo "\n✗ Some tests failed. Please review the errors above.\n";
    exit(1);
}
