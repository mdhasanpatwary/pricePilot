# ErrorHandlingService Implementation Summary

## Overview

The ErrorHandlingService provides structured error handling with HTTP status codes and consistent JSON error response formatting for the PricePilot OpenCart plugin. This service ensures all API errors follow a standardized format and include appropriate HTTP status codes.

## Requirements Addressed

- **Requirement 5.1**: Successful requests return HTTP 200 status
- **Requirement 5.2**: Authentication failures return HTTP 401 status
- **Requirement 5.3**: Not found resources return HTTP 404 status
- **Requirement 5.4**: Validation failures return HTTP 400 status
- **Requirement 5.5**: Internal errors return HTTP 500 status
- **Requirement 5.6**: All error responses include "error" field in JSON format
- **Requirement 5.7**: All errors are logged with details for debugging

## Features

### Error Code Constants

The service defines standard error codes for consistent error identification:

- `ERROR_INVALID_PARAMETER` - Invalid or malformed parameter
- `ERROR_AUTH_FAILED` - Authentication failure
- `ERROR_NOT_FOUND` - Resource not found
- `ERROR_RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `ERROR_PAYLOAD_TOO_LARGE` - Request payload too large
- `ERROR_INTERNAL_ERROR` - Internal server error
- `ERROR_INVALID_JSON` - Invalid JSON payload
- `ERROR_MISSING_PARAMETER` - Required parameter missing
- `ERROR_FORBIDDEN` - Access forbidden
- `ERROR_METHOD_NOT_ALLOWED` - HTTP method not allowed

### HTTP Status Code Constants

Standard HTTP status codes are defined as constants:

- `HTTP_OK` (200) - Success
- `HTTP_BAD_REQUEST` (400) - Bad request
- `HTTP_UNAUTHORIZED` (401) - Unauthorized
- `HTTP_FORBIDDEN` (403) - Forbidden
- `HTTP_NOT_FOUND` (404) - Not found
- `HTTP_METHOD_NOT_ALLOWED` (405) - Method not allowed
- `HTTP_PAYLOAD_TOO_LARGE` (413) - Payload too large
- `HTTP_TOO_MANY_REQUESTS` (429) - Too many requests
- `HTTP_INTERNAL_SERVER_ERROR` (500) - Internal server error

## Core Methods

### sendErrorResponse()

Generic error response method that all other error methods use internally.

```php
public function sendErrorResponse($errorCode, $message, $statusCode, $details = null, $logError = true)
```

**Parameters:**
- `$errorCode` - Error code constant
- `$message` - Human-readable error message
- `$statusCode` - HTTP status code
- `$details` - Optional additional error details (array)
- `$logError` - Whether to log this error (default: true)

**Response Format:**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "parameter_name",
    "additional": "info"
  }
}
```

### sendSuccessResponse()

Send successful response with HTTP 200 status.

```php
public function sendSuccessResponse($data)
```

**Parameters:**
- `$data` - Response data array

### Specialized Error Methods

#### sendValidationError()
Send validation error (HTTP 400) with field-specific details.

```php
public function sendValidationError($message, $details = null)
```

**Example:**
```php
$errorHandler->sendValidationError('Invalid product ID', array(
    'field' => 'product_id',
    'value' => 'abc'
));
```

#### sendAuthenticationError()
Send authentication error (HTTP 401).

```php
public function sendAuthenticationError($message = 'Invalid API Token')
```

#### sendForbiddenError()
Send forbidden error (HTTP 403).

```php
public function sendForbiddenError($message = 'Access forbidden')
```

#### sendNotFoundError()
Send not found error (HTTP 404).

```php
public function sendNotFoundError($message = 'Resource not found')
```

#### sendRateLimitError()
Send rate limit error (HTTP 429) with Retry-After header.

```php
public function sendRateLimitError($retryAfter)
```

**Parameters:**
- `$retryAfter` - Seconds until rate limit resets

**Response includes:**
- `Retry-After` HTTP header
- `retry_after` field in response details

#### sendPayloadTooLargeError()
Send payload too large error (HTTP 413).

```php
public function sendPayloadTooLargeError($message = 'Request payload too large')
```

#### sendInternalError()
Send internal server error (HTTP 500).

```php
public function sendInternalError($message = 'An internal error occurred', $exception = null)
```

**Parameters:**
- `$message` - Generic error message (for security)
- `$exception` - Optional Exception object for logging

**Note:** Exception details are only included in response when `config_error_display` is enabled (development mode).

#### sendMissingParameterError()
Send missing parameter error (HTTP 400).

```php
public function sendMissingParameterError($parameterName)
```

#### sendInvalidJsonError()
Send invalid JSON error (HTTP 400).

```php
public function sendInvalidJsonError($message = 'Invalid JSON payload')
```

## Error Logging

All errors are automatically logged with comprehensive context:

- Error code and message
- HTTP status code
- Error details (if provided)
- Client IP address
- Request endpoint and method
- Timestamp

**Log Format:**
```
[PRICEPILOT ERROR] API Error [ERROR_CODE] HTTP 400: Error message | Details: {...} | IP: 192.168.1.1 | Endpoint: /api/pricepilot/update | Method: POST
```

### Exception Logging

When exceptions are passed to `sendInternalError()`, they are logged with full stack trace:

```
[PRICEPILOT ERROR] Exception: RuntimeException in /path/to/file.php:123 | Message: Error details | Trace: ...
```

## Usage Examples

### In API Controller

```php
class ControllerApiPricepilot extends Controller {
    private $errorHandler;
    
    private function initErrorHandler() {
        if ($this->errorHandler === null) {
            require_once(DIR_CATALOG . 'model/extension/pricepilot/ErrorHandlingService.php');
            $this->errorHandler = new ErrorHandlingService($this->registry);
        }
    }
    
    public function update() {
        $this->initErrorHandler();
        
        // Authentication check
        if (!$this->validateToken()) {
            $this->errorHandler->sendAuthenticationError();
            return;
        }
        
        // Missing parameter check
        if (!isset($post_data['product_id'])) {
            $this->errorHandler->sendMissingParameterError('product_id');
            return;
        }
        
        // Validation error
        if (!$validation['valid']) {
            $this->errorHandler->sendValidationError($validation['error'], array(
                'field' => 'price',
                'value' => $post_data['price']
            ));
            return;
        }
        
        // Not found error
        if (!$product) {
            $this->errorHandler->sendNotFoundError('Product not found');
            return;
        }
        
        // Success response
        $this->errorHandler->sendSuccessResponse(array(
            'success' => 'Price updated successfully',
            'product_id' => $productId
        ));
    }
}
```

### Error Response Examples

**Validation Error:**
```json
{
  "error": "Invalid product ID: must be a positive integer",
  "code": "INVALID_PARAMETER",
  "details": {
    "field": "product_id",
    "value": "abc"
  }
}
```

**Authentication Error:**
```json
{
  "error": "Invalid API Token",
  "code": "AUTH_FAILED"
}
```

**Rate Limit Error:**
```json
{
  "error": "Rate limit exceeded. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "retry_after": 45
  }
}
```

**Internal Error (Production):**
```json
{
  "error": "An internal error occurred",
  "code": "INTERNAL_ERROR"
}
```

**Internal Error (Development with error display enabled):**
```json
{
  "error": "An internal error occurred",
  "code": "INTERNAL_ERROR",
  "details": {
    "exception": "RuntimeException",
    "message": "Database connection failed",
    "file": "/path/to/file.php",
    "line": 123
  }
}
```

## Integration with Other Services

The ErrorHandlingService integrates seamlessly with other PricePilot services:

### With ValidationService

```php
$validation = $validationService->validateProductId($productId);
if (!$validation['valid']) {
    $errorHandler->sendValidationError($validation['error'], array(
        'field' => 'product_id',
        'value' => $productId
    ));
    return;
}
```

### With AuthenticationService

```php
if (!$authService->validateToken($token)) {
    $errorHandler->sendAuthenticationError();
    return;
}

if (!$authService->isIpWhitelisted($ip)) {
    $errorHandler->sendForbiddenError('IP address not whitelisted');
    return;
}
```

### With RateLimitService

```php
$rateLimit = $rateLimitService->checkLimit($ip, $endpoint);
if (!$rateLimit['allowed']) {
    $errorHandler->sendRateLimitError($rateLimit['retry_after']);
    return;
}
```

## Benefits

1. **Consistency**: All API errors follow the same format
2. **HTTP Compliance**: Proper HTTP status codes for all error types
3. **Debugging**: Comprehensive error logging with context
4. **Security**: Generic error messages in production, detailed in development
5. **Maintainability**: Centralized error handling logic
6. **API Consumer Friendly**: Structured errors with error codes and details

## Testing

The ErrorHandlingService should be tested for:

1. Correct HTTP status codes for each error type
2. Proper JSON response structure with "error" field
3. Error logging functionality
4. Retry-After header for rate limit errors
5. Exception handling and logging
6. Development vs production error detail exposure

## Files Modified

- `integrations/opencart/catalog/model/extension/pricepilot/ErrorHandlingService.php` - New service class
- `integrations/opencart/catalog/controller/api/pricepilot.php` - Updated to use ErrorHandlingService

## Next Steps

1. Update all API endpoints to use ErrorHandlingService
2. Write property tests for HTTP status codes (Task 6.2)
3. Integrate with LoggingService for API request logging
4. Add error response examples to API documentation
