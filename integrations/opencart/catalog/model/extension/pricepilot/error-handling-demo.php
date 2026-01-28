<?php
/**
 * ErrorHandlingService Demonstration Script
 * 
 * This script demonstrates the usage of ErrorHandlingService for structured
 * error handling with HTTP status codes.
 * 
 * Run this script from the OpenCart root directory:
 * php catalog/model/extension/pricepilot/error-handling-demo.php
 */

// Mock OpenCart environment for demonstration
class MockRegistry {
    private $data = array();
    
    public function get($key) {
        return isset($this->data[$key]) ? $this->data[$key] : null;
    }
    
    public function set($key, $value) {
        $this->data[$key] = $value;
    }
}

class MockResponse {
    private $headers = array();
    private $output = '';
    
    public function addHeader($header) {
        $this->headers[] = $header;
        echo "Header: {$header}\n";
    }
    
    public function setOutput($output) {
        $this->output = $output;
        echo "Response Body:\n{$output}\n\n";
    }
    
    public function getOutput() {
        return $this->output;
    }
}

class MockLog {
    public function write($message) {
        echo "LOG: {$message}\n";
    }
}

class MockConfig {
    private $data = array();
    
    public function get($key) {
        return isset($this->data[$key]) ? $this->data[$key] : null;
    }
    
    public function set($key, $value) {
        $this->data[$key] = $value;
    }
}

// Define DIR_CATALOG if not defined
if (!defined('DIR_CATALOG')) {
    define('DIR_CATALOG', __DIR__ . '/../../../../catalog/');
}

// Load ErrorHandlingService
require_once(__DIR__ . '/Service.php');
require_once(__DIR__ . '/ErrorHandlingService.php');

// Setup mock environment
$registry = new MockRegistry();
$registry->set('response', new MockResponse());
$registry->set('log', new MockLog());
$registry->set('config', new MockConfig());

// Create ErrorHandlingService instance
$errorHandler = new ErrorHandlingService($registry);

echo "=== ErrorHandlingService Demonstration ===\n\n";

// Example 1: Validation Error (HTTP 400)
echo "--- Example 1: Validation Error ---\n";
$errorHandler->sendValidationError('Invalid product ID: must be a positive integer', array(
    'field' => 'product_id',
    'value' => 'abc'
));

// Example 2: Authentication Error (HTTP 401)
echo "--- Example 2: Authentication Error ---\n";
$errorHandler->sendAuthenticationError();

// Example 3: Forbidden Error (HTTP 403)
echo "--- Example 3: Forbidden Error ---\n";
$errorHandler->sendForbiddenError('IP address not whitelisted');

// Example 4: Not Found Error (HTTP 404)
echo "--- Example 4: Not Found Error ---\n";
$errorHandler->sendNotFoundError('Product not found');

// Example 5: Rate Limit Error (HTTP 429)
echo "--- Example 5: Rate Limit Error ---\n";
$errorHandler->sendRateLimitError(45);

// Example 6: Payload Too Large Error (HTTP 413)
echo "--- Example 6: Payload Too Large Error ---\n";
$errorHandler->sendPayloadTooLargeError();

// Example 7: Internal Server Error (HTTP 500)
echo "--- Example 7: Internal Server Error ---\n";
$errorHandler->sendInternalError();

// Example 8: Internal Server Error with Exception
echo "--- Example 8: Internal Server Error with Exception ---\n";
try {
    throw new Exception('Database connection failed');
} catch (Exception $e) {
    $errorHandler->sendInternalError('An internal error occurred', $e);
}

// Example 9: Missing Parameter Error (HTTP 400)
echo "--- Example 9: Missing Parameter Error ---\n";
$errorHandler->sendMissingParameterError('price');

// Example 10: Invalid JSON Error (HTTP 400)
echo "--- Example 10: Invalid JSON Error ---\n";
$errorHandler->sendInvalidJsonError();

// Example 11: Success Response (HTTP 200)
echo "--- Example 11: Success Response ---\n";
$errorHandler->sendSuccessResponse(array(
    'success' => 'Price updated successfully',
    'product_id' => 123,
    'old_price' => '99.99',
    'new_price' => '89.99'
));

// Example 12: Custom Error Response
echo "--- Example 12: Custom Error Response ---\n";
$errorHandler->sendErrorResponse(
    ErrorHandlingService::ERROR_INVALID_PARAMETER,
    'Custom validation error',
    ErrorHandlingService::HTTP_BAD_REQUEST,
    array(
        'field' => 'quantity',
        'value' => -5,
        'constraint' => 'must be non-negative'
    )
);

echo "\n=== Demonstration Complete ===\n";
echo "\nKey Features Demonstrated:\n";
echo "1. Consistent error response format with 'error' field\n";
echo "2. Appropriate HTTP status codes for each error type\n";
echo "3. Error codes for programmatic error handling\n";
echo "4. Optional details field for additional context\n";
echo "5. Automatic error logging with context\n";
echo "6. Retry-After header for rate limit errors\n";
echo "7. Exception handling and logging\n";
echo "8. Success response formatting\n";

echo "\n=== Error Code Constants ===\n";
echo "ERROR_INVALID_PARAMETER: " . ErrorHandlingService::ERROR_INVALID_PARAMETER . "\n";
echo "ERROR_AUTH_FAILED: " . ErrorHandlingService::ERROR_AUTH_FAILED . "\n";
echo "ERROR_NOT_FOUND: " . ErrorHandlingService::ERROR_NOT_FOUND . "\n";
echo "ERROR_RATE_LIMIT_EXCEEDED: " . ErrorHandlingService::ERROR_RATE_LIMIT_EXCEEDED . "\n";
echo "ERROR_PAYLOAD_TOO_LARGE: " . ErrorHandlingService::ERROR_PAYLOAD_TOO_LARGE . "\n";
echo "ERROR_INTERNAL_ERROR: " . ErrorHandlingService::ERROR_INTERNAL_ERROR . "\n";
echo "ERROR_INVALID_JSON: " . ErrorHandlingService::ERROR_INVALID_JSON . "\n";
echo "ERROR_MISSING_PARAMETER: " . ErrorHandlingService::ERROR_MISSING_PARAMETER . "\n";
echo "ERROR_FORBIDDEN: " . ErrorHandlingService::ERROR_FORBIDDEN . "\n";

echo "\n=== HTTP Status Code Constants ===\n";
echo "HTTP_OK: " . ErrorHandlingService::HTTP_OK . "\n";
echo "HTTP_BAD_REQUEST: " . ErrorHandlingService::HTTP_BAD_REQUEST . "\n";
echo "HTTP_UNAUTHORIZED: " . ErrorHandlingService::HTTP_UNAUTHORIZED . "\n";
echo "HTTP_FORBIDDEN: " . ErrorHandlingService::HTTP_FORBIDDEN . "\n";
echo "HTTP_NOT_FOUND: " . ErrorHandlingService::HTTP_NOT_FOUND . "\n";
echo "HTTP_PAYLOAD_TOO_LARGE: " . ErrorHandlingService::HTTP_PAYLOAD_TOO_LARGE . "\n";
echo "HTTP_TOO_MANY_REQUESTS: " . ErrorHandlingService::HTTP_TOO_MANY_REQUESTS . "\n";
echo "HTTP_INTERNAL_SERVER_ERROR: " . ErrorHandlingService::HTTP_INTERNAL_SERVER_ERROR . "\n";
