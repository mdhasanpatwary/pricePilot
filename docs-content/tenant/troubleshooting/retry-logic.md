---
title: "Retry Logic"
description: "Understanding retry logic and behavior"
category: "troubleshooting"
tags: ["retry", "reliability", "guide"]
audience: "tenant"
relatedDocs: ["/admin-docs/system-monitoring/retry-logic.md"]
---

# Retry Logic Documentation

## Overview

PricePilot implements comprehensive retry logic with exponential backoff to handle transient failures in external API calls and network operations. This ensures robust operation even when facing temporary network issues, rate limits, or service unavailability.

## Features

- **Exponential Backoff**: Delays between retries increase exponentially to avoid overwhelming failing services
- **Jitter**: Random variation in retry delays to prevent thundering herd problems
- **Configurable**: Maximum retries, backoff delays, and retry conditions can be customized
- **Selective Retry**: Only retries errors that are likely to be transient
- **Comprehensive Logging**: All retry attempts are logged for debugging and monitoring

## Configuration

### Environment Variables

Configure retry behavior globally using environment variables:

```bash
# Maximum number of retry attempts (default: 3)
SYNC_MAX_RETRIES=3

# Initial backoff delay in milliseconds (default: 1000)
SYNC_INITIAL_BACKOFF_MS=1000

# Maximum backoff delay in milliseconds (default: 30000)
SYNC_MAX_BACKOFF_MS=30000
```

### Retry Presets

The system provides several retry presets for common scenarios:

```typescript
import { RetryPresets } from '@/lib/utils/retry';

// Fast retry for quick operations (3 retries, 500ms initial backoff)
RetryPresets.FAST

// Standard retry for most operations (3 retries, 1s initial backoff)
RetryPresets.STANDARD

// Aggressive retry for critical operations (5 retries, 2s initial backoff)
RetryPresets.AGGRESSIVE

// Conservative retry for rate-limited APIs (3 retries, 5s initial backoff)
RetryPresets.CONSERVATIVE
```

## Retryable Errors

The system automatically retries the following types of errors:

### HTTP Errors (Axios)
- **5xx Server Errors**: Internal server errors, service unavailable, etc.
- **429 Too Many Requests**: Rate limiting
- **408 Request Timeout**: Request timeout
- **Network Errors**: No response received (connection refused, timeout, etc.)

### Network Errors
- **ECONNREFUSED**: Connection refused
- **ETIMEDOUT**: Connection timeout
- **ENOTFOUND**: DNS lookup failed
- **ECONNRESET**: Connection reset
- **EPIPE**: Broken pipe

### Non-Retryable Errors
- **4xx Client Errors** (except 408 and 429): Bad request, unauthorized, forbidden, not found, etc.
- These indicate client-side issues that won't be resolved by retrying

## Usage Examples

### Basic Usage

```typescript
import { withRetry } from '@/lib/utils/retry';

// Simple retry with defaults
const result = await withRetry(async () => {
  return await axios.get('https://api.example.com/data');
});
```

### Custom Configuration

```typescript
import { withRetry, RetryPresets } from '@/lib/utils/retry';

// Use a preset
const result = await withRetry(
  async () => {
    return await axios.get('https://api.example.com/data');
  },
  RetryPresets.AGGRESSIVE
);

// Custom configuration
const result = await withRetry(
  async () => {
    return await axios.get('https://api.example.com/data');
  },
  {
    maxRetries: 5,
    initialBackoff: 2000,
    maxBackoff: 60000,
    operationName: 'Fetch User Data',
    context: { userId: '123' },
  }
);
```

### Custom Retry Condition

```typescript
import { withRetry } from '@/lib/utils/retry';

const result = await withRetry(
  async () => {
    return await someOperation();
  },
  {
    shouldRetry: (error, attempt) => {
      // Only retry on specific error codes
      return error.code === 'CUSTOM_RETRYABLE_ERROR';
    },
  }
);
```

### Retry Callbacks

```typescript
import { withRetry } from '@/lib/utils/retry';

const result = await withRetry(
  async () => {
    return await axios.get('https://api.example.com/data');
  },
  {
    onRetry: async (error, attempt, delay) => {
      // Custom logic before retry
      console.log(`Retry attempt ${attempt} after ${delay}ms`);
      
      // Update UI, send notification, etc.
      await notifyUser(`Retrying operation (attempt ${attempt})`);
    },
  }
);
```

### Creating Reusable Retry Wrappers

```typescript
import { createRetryWrapper, RetryPresets } from '@/lib/utils/retry';

// Create a wrapper for all API calls
const retryableApi = createRetryWrapper({
  ...RetryPresets.STANDARD,
  operationName: 'API Call',
});

// Use the wrapper
const users = await retryableApi(() => 
  axios.get('/api/users')
);

const products = await retryableApi(() => 
  axios.get('/api/products')
);
```

## Implementation Details

### Exponential Backoff Formula

The delay between retries is calculated using exponential backoff with jitter:

```
delay = min(initialBackoff * (multiplier ^ (attempt - 1)), maxBackoff)
jitteredDelay = delay + random(-jitter * delay, jitter * delay)
```

**Example with defaults:**
- Attempt 1: 1000ms ± 100ms (jitter)
- Attempt 2: 2000ms ± 200ms
- Attempt 3: 4000ms ± 400ms

### Jitter

Jitter adds random variation to retry delays to prevent multiple clients from retrying simultaneously (thundering herd problem). Default jitter is 10% of the calculated delay.

## Services Using Retry Logic

### SyncService
- **Operations**: Product sync from OpenCart, Laravel, Shopify, WooCommerce, Magento
- **Configuration**: Uses environment variables for max retries and backoff
- **Preset**: Custom configuration based on environment variables

### WebhookService
- **Operations**: Webhook delivery to external endpoints
- **Preset**: STANDARD (3 retries, 1s initial backoff)
- **Behavior**: Failures are logged but don't break the main flow

### NotificationSender
- **Operations**: Slack notifications, custom webhook notifications
- **Preset**: STANDARD (3 retries, 1s initial backoff)
- **Behavior**: Returns false on failure, doesn't throw

## Monitoring and Debugging

### Log Levels

Retry operations generate logs at different levels:

- **INFO**: Successful operation after retry
- **WARN**: Retry attempt with error details
- **ERROR**: Operation failed after all retries

### Log Format

```json
{
  "level": "warn",
  "message": "Operation failed, retrying",
  "operationName": "HTTP Request",
  "attempt": 2,
  "totalAttempts": 3,
  "nextRetryIn": "2000ms",
  "error": {
    "message": "connect ECONNREFUSED",
    "name": "Error"
  },
  "context": {
    "method": "GET",
    "url": "https://api.example.com/data"
  }
}
```

### Monitoring Metrics

Track these metrics to monitor retry behavior:

- **Retry Rate**: Percentage of operations that require retries
- **Retry Success Rate**: Percentage of retried operations that eventually succeed
- **Average Retry Attempts**: Average number of retries before success
- **Retry Failure Rate**: Percentage of operations that fail after all retries

## Best Practices

### 1. Choose Appropriate Retry Configuration

- **Fast operations**: Use FAST preset (500ms initial backoff)
- **Standard operations**: Use STANDARD preset (1s initial backoff)
- **Critical operations**: Use AGGRESSIVE preset (5 retries, 2s initial backoff)
- **Rate-limited APIs**: Use CONSERVATIVE preset (5s initial backoff)

### 2. Set Appropriate Timeouts

Always set timeouts on HTTP requests to prevent hanging:

```typescript
await withRetry(async () => {
  return axios.get(url, { timeout: 10000 }); // 10 second timeout
});
```

### 3. Use Operation Names and Context

Provide meaningful operation names and context for better debugging:

```typescript
await withRetry(
  async () => fetchProducts(siteId),
  {
    operationName: 'Fetch Products',
    context: { siteId, platform: 'OpenCart' },
  }
);
```

### 4. Handle Non-Retryable Errors

Don't retry errors that won't be resolved by retrying:

```typescript
await withRetry(
  async () => {
    const result = await someOperation();
    
    // Validate result
    if (!result.isValid) {
      // Throw non-retryable error
      throw new ValidationError('Invalid result');
    }
    
    return result;
  },
  {
    shouldRetry: (error) => {
      // Don't retry validation errors
      if (error instanceof ValidationError) {
        return false;
      }
      return isRetryableHttpError(error);
    },
  }
);
```

### 5. Implement Circuit Breakers for Persistent Failures

For operations that consistently fail, consider implementing a circuit breaker pattern to prevent wasting resources on retries:

```typescript
// Pseudo-code for circuit breaker
if (circuitBreaker.isOpen()) {
  throw new Error('Circuit breaker is open');
}

try {
  const result = await withRetry(operation);
  circuitBreaker.recordSuccess();
  return result;
} catch (error) {
  circuitBreaker.recordFailure();
  throw error;
}
```

## Troubleshooting

### High Retry Rate

If you're seeing a high retry rate:

1. **Check external service health**: The external service may be experiencing issues
2. **Review timeout settings**: Timeouts may be too aggressive
3. **Check network connectivity**: Network issues may be causing failures
4. **Review rate limits**: You may be hitting rate limits

### Operations Failing After All Retries

If operations consistently fail after all retries:

1. **Check error logs**: Review the specific errors being thrown
2. **Verify credentials**: Ensure API tokens and credentials are valid
3. **Test manually**: Try the operation manually to isolate the issue
4. **Increase max retries**: Consider increasing max retries for critical operations
5. **Adjust backoff**: Increase initial backoff for rate-limited APIs

### Excessive Retry Delays

If retry delays are too long:

1. **Reduce max backoff**: Lower the `maxBackoff` setting
2. **Reduce backoff multiplier**: Use a smaller multiplier (e.g., 1.5 instead of 2)
3. **Use faster preset**: Switch to FAST preset for quick operations

## Related Documentation

- [Error Handling Guide](./ERROR_HANDLING_GUIDE.md)
- [Rate Limiting](./RATE_LIMITING.md)
- [Monitoring System](./MONITORING_SYSTEM.md)
- [API Documentation](./API_DOCUMENTATION_INDEX.md)
