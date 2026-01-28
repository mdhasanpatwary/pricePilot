# RateLimitService - Quick Start Guide

## Overview

The RateLimitService provides request throttling to prevent API abuse. It uses a sliding window algorithm with OpenCart's cache system for accurate rate limiting.

## Quick Start

### 1. Load the Service

```php
// In your API controller
$this->load->model('extension/pricepilot/RateLimitService');
$rateLimitService = new RateLimitService($this->registry);
```

### 2. Check Rate Limit

```php
// Get client IP and endpoint
$ip = $this->request->server['REMOTE_ADDR'];
$endpoint = $this->request->server['REQUEST_URI'];

// Check if request is allowed
$result = $rateLimitService->checkLimit($ip, $endpoint);

if (!$result['allowed']) {
    // Rate limit exceeded - return HTTP 429
    $this->response->addHeader('HTTP/1.1 429 Too Many Requests');
    $this->response->addHeader('Retry-After: ' . $result['retry_after']);
    $this->response->addHeader('Content-Type: application/json');
    $this->response->setOutput(json_encode([
        'error' => 'Rate limit exceeded',
        'code' => 'RATE_LIMIT_EXCEEDED',
        'retry_after' => $result['retry_after']
    ]));
    return;
}
```

### 3. Record the Request

```php
// After successful authentication, record the request
$rateLimitService->recordRequest($ip, $endpoint);

// Continue processing the request...
```

## Configuration

Set these values in OpenCart admin settings:

```php
'module_pricepilot_rate_limit' => 100,  // Max requests per window
'module_pricepilot_rate_window' => 60,  // Window duration in seconds
```

**Default:** 100 requests per 60 seconds

**To disable:** Set `module_pricepilot_rate_limit` to 0

## Complete Example

```php
<?php
class ControllerApiPricepilot extends Controller {
    public function index() {
        // Load rate limit service
        $this->load->model('extension/pricepilot/RateLimitService');
        $rateLimitService = new RateLimitService($this->registry);
        
        // Get client info
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
                'error' => 'Rate limit exceeded. Please try again later.',
                'code' => 'RATE_LIMIT_EXCEEDED',
                'retry_after' => $rateLimit['retry_after']
            ]));
            return;
        }
        
        // Record the request
        $rateLimitService->recordRequest($ip, $endpoint);
        
        // Continue with authentication and request processing...
        // Your API logic here
    }
}
```

## Advanced Usage

### Get Current Request Count

```php
$count = $rateLimitService->getCurrentCount($ip, $endpoint);
echo "Requests in current window: {$count}";
```

### Reset Rate Limit (Admin Override)

```php
// Reset specific endpoint
$rateLimitService->resetLimit($ip, '/api/pricepilot/products');

// Reset all common endpoints
$rateLimitService->resetLimit($ip);
```

### Get Configuration

```php
$config = $rateLimitService->getRateLimitConfig();
echo "Limit: {$config['limit']} requests per {$config['window']} seconds";
```

## Testing

### Run Demo Script

```bash
php catalog/model/extension/pricepilot/ratelimit-demo.php
```

### Run Verification Tests

```bash
php catalog/model/extension/pricepilot/ratelimit-verification.php
```

Expected output:
```
✓ All requirements verified successfully!
```

## How It Works

### Sliding Window Algorithm

1. **Calculate Window**: Current time is divided into fixed windows (e.g., 60-second windows)
2. **Generate Key**: `ratelimit_{ip}_{endpoint_hash}_{window_start}`
3. **Check Counter**: Get request count from cache for this window
4. **Enforce Limit**: If count >= limit, reject with retry_after value
5. **Record Request**: Increment counter with TTL = window + buffer

### Automatic Cleanup

- Cache entries expire automatically after window + 10 seconds
- No manual cleanup required
- Old windows are automatically removed by cache system

### Per-IP and Per-Endpoint Isolation

- Each IP address has separate counters
- Each endpoint has separate counters
- One IP hitting one endpoint doesn't affect other IPs or endpoints

## Requirements Addressed

✅ **3.1**: Reject requests exceeding 100 per 60 seconds with HTTP 429  
✅ **3.2**: Return Retry-After header value  
✅ **3.3**: Track request counts in cache  
✅ **3.4**: Reset counter when window expires  

## Troubleshooting

### Rate limit not working

1. Check if rate limiting is enabled: `module_pricepilot_rate_limit > 0`
2. Verify cache system is working
3. Check logs for rate limit messages

### Requests blocked immediately

1. Check if counter was not reset from previous window
2. Verify window calculation is correct
3. Use `getCurrentCount()` to check current counter value

### Different behavior in production

1. Ensure cache system is properly configured
2. Check if multiple servers share the same cache
3. Verify time synchronization across servers

## Support

For issues or questions:
1. Check the logs: Look for `[PricePilot WARNING]` and `[PricePilot INFO]` messages
2. Run verification script to ensure service is working correctly
3. Review the RATELIMIT_SERVICE_SUMMARY.md for detailed documentation
