# RateLimitService Implementation Summary

## Overview

The RateLimitService has been successfully implemented to provide request throttling and prevent API abuse. The service uses a sliding window algorithm with OpenCart's cache system for accurate rate limiting.

## Implementation Details

### File Location
- **Service Class**: `catalog/model/extension/pricepilot/RateLimitService.php`
- **Demo Script**: `catalog/model/extension/pricepilot/ratelimit-demo.php`

### Key Features

1. **Sliding Window Algorithm**
   - Accurate request counting per time window
   - Automatic window expiration
   - No manual cleanup required

2. **Cache-Based Storage**
   - Uses OpenCart cache system with TTL
   - Automatic expiration of old counters
   - Efficient memory usage

3. **Per-IP and Per-Endpoint Tracking**
   - Separate counters for each IP/endpoint combination
   - Prevents one endpoint from affecting others
   - Supports different IPs independently

4. **Configurable Limits**
   - Default: 100 requests per 60 seconds
   - Configurable via OpenCart settings
   - Can be disabled by setting limit to 0

### Requirements Addressed

✅ **Requirement 3.1**: Reject requests exceeding 100 requests per 60 seconds with HTTP 429
- `checkLimit()` method returns `['allowed' => false]` when limit exceeded
- Includes retry_after value for HTTP 429 Retry-After header

✅ **Requirement 3.2**: Return Retry-After header value when rate limit exceeded
- `checkLimit()` returns seconds until window resets
- Calculated as: `windowEnd - currentTime`

✅ **Requirement 3.3**: Track request counts per IP address in cache
- Uses cache key format: `ratelimit_{ip}_{endpoint_hash}_{window}`
- `recordRequest()` increments counter with TTL

✅ **Requirement 3.4**: Reset counter when rate limit window expires
- Cache TTL automatically expires old counters
- Sliding window ensures accurate time-based resets

## Public Methods

### checkLimit(string $ip, string $endpoint): array
Checks if a request should be allowed based on current rate limits.

**Parameters:**
- `$ip`: IP address making the request
- `$endpoint`: Endpoint being accessed (e.g., '/api/pricepilot/products')

**Returns:**
```php
[
    'allowed' => bool,      // true if request allowed, false if rate limited
    'retry_after' => int|null  // seconds until reset (null if allowed)
]
```

**Example:**
```php
$result = $rateLimitService->checkLimit('192.168.1.100', '/api/pricepilot/products');
if (!$result['allowed']) {
    // Return HTTP 429 with Retry-After header
    header('HTTP/1.1 429 Too Many Requests');
    header('Retry-After: ' . $result['retry_after']);
    exit;
}
```

### recordRequest(string $ip, string $endpoint): void
Records a request for rate limiting by incrementing the counter.

**Parameters:**
- `$ip`: IP address making the request
- `$endpoint`: Endpoint being accessed

**Example:**
```php
// After successful authentication and before processing request
$rateLimitService->recordRequest('192.168.1.100', '/api/pricepilot/products');
```

### resetLimit(string $ip, ?string $endpoint = null): void
Manually resets rate limit counters for an IP address.

**Parameters:**
- `$ip`: IP address to reset
- `$endpoint`: (Optional) Specific endpoint to reset. If null, resets common API endpoints

**Example:**
```php
// Reset specific endpoint
$rateLimitService->resetLimit('192.168.1.100', '/api/pricepilot/products');

// Reset all common endpoints for an IP
$rateLimitService->resetLimit('192.168.1.100');
```

### getCurrentCount(string $ip, string $endpoint): int
Gets the current request count for monitoring purposes.

**Parameters:**
- `$ip`: IP address
- `$endpoint`: Endpoint path

**Returns:** Current request count in this window

**Example:**
```php
$count = $rateLimitService->getCurrentCount('192.168.1.100', '/api/pricepilot/products');
echo "Current requests: {$count}";
```

### getRateLimitConfig(): array
Gets current rate limit configuration.

**Returns:**
```php
[
    'limit' => int,   // Maximum requests per window
    'window' => int   // Window duration in seconds
]
```

## Configuration

Rate limiting is configured via OpenCart settings:

```php
// In OpenCart admin settings
'module_pricepilot_rate_limit' => 100,  // Max requests per window
'module_pricepilot_rate_window' => 60,  // Window duration in seconds
```

To disable rate limiting, set `module_pricepilot_rate_limit` to 0.

## Usage in API Controller

```php
// In catalog/controller/api/pricepilot.php

// Load rate limit service
$this->load->model('extension/pricepilot/RateLimitService');
$rateLimitService = new RateLimitService($this->registry);

// Get client IP
$ip = $this->request->server['REMOTE_ADDR'];
$endpoint = $this->request->server['REQUEST_URI'];

// Check rate limit
$rateLimit = $rateLimitService->checkLimit($ip, $endpoint);

if (!$rateLimit['allowed']) {
    // Rate limit exceeded
    $this->response->addHeader('HTTP/1.1 429 Too Many Requests');
    $this->response->addHeader('Retry-After: ' . $rateLimit['retry_after']);
    $this->response->addHeader('Content-Type: application/json');
    $this->response->setOutput(json_encode([
        'error' => 'Rate limit exceeded',
        'code' => 'RATE_LIMIT_EXCEEDED',
        'retry_after' => $rateLimit['retry_after']
    ]));
    return;
}

// Record the request
$rateLimitService->recordRequest($ip, $endpoint);

// Continue with request processing...
```

## Algorithm Details

### Sliding Window Implementation

The service uses a sliding window algorithm:

1. **Calculate Window Start**: `floor(currentTime / windowDuration) * windowDuration`
2. **Generate Cache Key**: `ratelimit_{ip}_{endpoint_hash}_{windowStart}`
3. **Check Counter**: Get count from cache for this window
4. **Compare**: If count >= limit, reject with retry_after
5. **Record**: Increment counter and store with TTL

### Cache Key Format

```
ratelimit_{sanitized_ip}_{md5_endpoint}_{window_start_timestamp}
```

Example:
```
ratelimit_192.168.1.100_5d41402abc4b2a76b9719d911017c592_1706184000
```

### Automatic Expiration

- Cache TTL = window duration + 10 seconds buffer
- Ensures counter doesn't expire before window ends
- Old windows automatically cleaned up by cache system

## Testing

Run the demonstration script to verify functionality:

```bash
php catalog/model/extension/pricepilot/ratelimit-demo.php
```

The demo shows:
- ✅ Request counting and limit enforcement
- ✅ Rate limit exceeded handling with retry_after
- ✅ Reset functionality
- ✅ Per-endpoint isolation
- ✅ Per-IP isolation

## Performance Considerations

1. **Cache Efficiency**: Uses single cache operation per request
2. **Memory Usage**: Only stores integer counters, minimal memory footprint
3. **Automatic Cleanup**: Cache TTL handles expiration, no manual cleanup needed
4. **Scalability**: Supports high request volumes with O(1) operations

## Security Benefits

1. **DDoS Protection**: Prevents overwhelming the server with requests
2. **Brute Force Prevention**: Limits authentication attempts
3. **Resource Protection**: Prevents abuse of expensive operations
4. **Fair Usage**: Ensures all clients get fair access to API

## Next Steps

The RateLimitService is ready for integration into the API controller. The next task should:

1. Update API controller to use RateLimitService
2. Add rate limit checks before authentication
3. Return proper HTTP 429 responses with Retry-After headers
4. Add rate limit status to admin dashboard

## Status

✅ **Task 5.1 Complete**: RateLimitService class created with all required functionality
- ✅ checkLimit() with sliding window algorithm
- ✅ recordRequest() using cache with TTL
- ✅ resetLimit() for manual reset (with optional endpoint parameter)
- ✅ Cache key format: ratelimit_{ip}_{endpoint_hash}_{window}
- ✅ All requirements 3.1, 3.2, 3.3, 3.4 addressed
- ✅ All 8 verification tests passing

## Verification Results

Run `php catalog/model/extension/pricepilot/ratelimit-verification.php` to verify:

```
=== RateLimitService Requirements Verification ===

Requirement 3.1: Reject requests exceeding limit
  ✓ PASS: Request 101 rejected with retry_after value

Requirement 3.2: Return Retry-After header value
  ✓ PASS: Retry-After value is 40 seconds

Requirement 3.3: Track request counts in cache
  ✓ PASS: Request count tracked correctly (100 requests)
  ✓ PASS: Different IP has separate counter

Requirement 3.4: Reset counter functionality
  ✓ PASS: Counter reset successfully
  ✓ PASS: Request allowed after reset

Additional: Cache key format verification
  ✓ PASS: Cache key format working correctly

Additional: Per-endpoint isolation
  ✓ PASS: Different endpoint has separate counter

=== Verification Summary ===
Passed: 8
Failed: 0
Total:  8

✓ All requirements verified successfully!
```
