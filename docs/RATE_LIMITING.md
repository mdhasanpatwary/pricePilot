# Rate Limiting Documentation

PricePilot implements comprehensive rate limiting using Upstash Redis with tenant-based limits, plan multipliers, admin management, and real-time monitoring.

## Table of Contents

- [Overview](#overview)
- [Rate Limiter Types](#rate-limiter-types)
- [Plan-Based Multipliers](#plan-based-multipliers)
- [Endpoint Coverage](#endpoint-coverage)
- [Rate Limit Headers](#rate-limit-headers)
- [Handling 429 Errors](#handling-429-errors)
- [Admin Management](#admin-management)
- [Code Examples](#code-examples)
- [Configuration](#configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Overview

Rate limiting protects the system from abuse, ensures fair resource usage, and provides different limits based on subscription plans. The system uses:

- **Upstash Redis** for distributed rate limiting
- **Sliding window algorithm** for accurate rate tracking
- **Tenant-based limits** with plan multipliers
- **Admin bypasses** for special circumstances
- **Comprehensive monitoring** and alerting

## Rate Limiter Types

All rate limits are defined as base limits that are multiplied by plan-specific multipliers.

| Limiter Type | Base Limit | Window | Description |
|-------------|-----------|--------|-------------|
| `auth` | 5 requests | 15 minutes | Authentication endpoints (login, register, password reset) |
| `sync` | 5 requests | 5 minutes | Resource-intensive sync operations |
| `importExport` | 10 requests | 1 minute | Import and export operations |
| `write` | 30 requests | 1 minute | Write operations (POST, PUT, DELETE, PATCH) |
| `read` | 200 requests | 1 minute | Read operations (GET requests) |
| `api` | 100 requests | 1 minute | General API endpoints (default fallback) |

### Effective Limits by Plan

The actual rate limit for a tenant is calculated as: **Base Limit × Plan Multiplier**

**Example for `read` limiter:**
- BASIC plan: 200 × 1.0 = **200 requests/minute**
- PREMIUM plan: 200 × 2.0 = **400 requests/minute**
- PRO plan: 200 × 5.0 = **1,000 requests/minute**

## Plan-Based Multipliers

Rate limits scale automatically based on subscription tier:

| Plan Type | Multiplier | Description |
|-----------|-----------|-------------|
| BASIC | 1.0× | Standard rate limits |
| PREMIUM | 2.0× | Double the base limits |
| PRO | 5.0× | Five times the base limits |

### Custom Multipliers

Super admins can set custom multipliers for specific tenants (0.1 to 100), which override plan-based multipliers. This is useful for:
- Special enterprise agreements
- Temporary adjustments during migrations
- Custom pricing arrangements

## Endpoint Coverage

### Protected Endpoints

All API routes are protected with appropriate rate limiters:

#### Authentication Endpoints (`auth` limiter)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/reset-password`
- `POST /api/auth/verify-email`

#### Sync Operations (`sync` limiter)
- `POST /api/v1/competitors/sync`
- `POST /api/v1/sync/full`
- `POST /api/v1/products/sync`

#### Import/Export (`importExport` limiter)
- `POST /api/v1/imports/products`
- `GET /api/v1/exports/products`
- `GET /api/v1/exports/audit-logs`
- `GET /api/v1/exports/price-history`

#### Write Operations (`write` limiter)
- `POST /api/v1/products`
- `PUT /api/v1/products/:id`
- `DELETE /api/v1/products/:id`
- `POST /api/v1/price-updates`
- `POST /api/v1/competitors`

#### Read Operations (`read` limiter)
- `GET /api/v1/products`
- `GET /api/v1/products/:id`
- `GET /api/v1/competitors`
- `GET /api/v1/analytics`
- `GET /api/v1/audit-logs`

#### Admin Endpoints
Admin endpoints use appropriate limiters based on operation type:
- `GET /api/v1/admin/*` - `read` limiter
- `POST /api/v1/admin/*` - `write` limiter

### Unprotected Endpoints

The following endpoints are intentionally not rate limited:
- Health check endpoints (`/api/health`)
- Webhook receivers (have separate authentication)
- Cron job endpoints (authenticated via secret tokens)

## Rate Limit Headers

All responses from rate-limited endpoints include these headers:

### Standard Headers

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Limit` | Total requests allowed in window | `400` |
| `X-RateLimit-Remaining` | Remaining requests in current window | `387` |
| `X-RateLimit-Reset` | Unix timestamp when limit resets | `1706789400` |

### Additional Headers (Authenticated Requests)

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Plan` | Tenant's subscription plan | `PREMIUM` |
| `X-RateLimit-Multiplier` | Effective multiplier applied | `2.0` |
| `X-RateLimit-Bypass` | Present if bypass is active | `true` |

### Error Response Headers (429)

| Header | Description | Example |
|--------|-------------|---------|
| `Retry-After` | Seconds to wait before retrying | `45` |
| `X-RateLimit-Type` | Type of limiter that was exceeded | `write` |

## Handling 429 Errors

When a rate limit is exceeded, the API returns HTTP 429 with a JSON error body.

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "limiterType": "write",
      "retryAfter": 45
    }
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-29T12:00:00.000Z"
  }
}
```

### Client-Side Handling

#### JavaScript/TypeScript Example

```typescript
async function makeApiRequest(url: string, options: RequestInit) {
  const response = await fetch(url, options);
  
  // Check for rate limit
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const data = await response.json();
    
    console.warn(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
    console.warn(`Limiter type: ${data.error.details.limiterType}`);
    
    // Option 1: Wait and retry
    if (retryAfter) {
      await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
      return makeApiRequest(url, options);
    }
    
    // Option 2: Show user-friendly error
    throw new Error(`Too many requests. Please wait ${retryAfter} seconds.`);
  }
  
  return response;
}
```

#### React Hook Example

```typescript
import { useState, useCallback } from 'react';

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export function useApiWithRateLimit() {
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const makeRequest = useCallback(async (url: string, options: RequestInit) => {
    try {
      const response = await fetch(url, options);
      
      // Extract rate limit headers
      const limit = response.headers.get('X-RateLimit-Limit');
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const reset = response.headers.get('X-RateLimit-Reset');
      
      if (limit && remaining && reset) {
        setRateLimitInfo({
          limit: parseInt(limit),
          remaining: parseInt(remaining),
          reset: parseInt(reset),
        });
      }
      
      // Handle rate limit error
      if (response.status === 429) {
        setIsRateLimited(true);
        const retryAfter = response.headers.get('Retry-After');
        
        // Auto-reset after retry period
        if (retryAfter) {
          setTimeout(() => {
            setIsRateLimited(false);
          }, parseInt(retryAfter) * 1000);
        }
        
        throw new Error('Rate limit exceeded');
      }
      
      setIsRateLimited(false);
      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }, []);

  return {
    makeRequest,
    rateLimitInfo,
    isRateLimited,
  };
}
```

#### Exponential Backoff Example

```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : Math.pow(2, retries) * 1000; // Exponential backoff
        
        console.log(`Rate limited. Waiting ${waitTime}ms before retry ${retries + 1}/${maxRetries}`);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retries++;
        continue;
      }
      
      return response;
    } catch (error) {
      if (retries === maxRetries - 1) throw error;
      retries++;
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

## Admin Management

Super admins can manage rate limits through the admin dashboard or API.

### Admin Dashboard

Access the rate limit dashboard at `/admin/rate-limits` to:
- View rate limit status for all tenants
- Monitor violations and usage patterns
- Set temporary bypasses
- Apply custom multipliers
- View detailed metrics and trends

### Admin API Endpoints

#### Get All Tenants Status

```typescript
GET /api/v1/admin/rate-limits

Response:
{
  "success": true,
  "data": [
    {
      "tenantId": "tenant-123",
      "companyName": "Acme Corp",
      "planType": "PREMIUM",
      "effectiveMultiplier": 2.0,
      "bypassActive": false,
      "recentViolations": 5,
      "currentUsage": {
        "read": { "limit": 400, "window": "1 m" },
        "write": { "limit": 60, "window": "1 m" }
      }
    }
  ]
}
```

#### Get Tenant Details

```typescript
GET /api/v1/admin/rate-limits/:tenantId

Response:
{
  "success": true,
  "data": {
    "tenantId": "tenant-123",
    "companyName": "Acme Corp",
    "planType": "PREMIUM",
    "effectiveMultiplier": 2.0,
    "bypassActive": false,
    "recentViolations": 5,
    "metrics": {
      "last24Hours": {
        "totalHits": 15420,
        "totalViolations": 5,
        "violationRate": 0.03
      }
    },
    "recentViolationDetails": [...]
  }
}
```

#### Set Temporary Bypass

```typescript
POST /api/v1/admin/rate-limits/:tenantId/bypass

Request:
{
  "durationMinutes": 60,
  "reason": "Data migration in progress"
}

Response:
{
  "success": true,
  "message": "Bypass set successfully",
  "expiresAt": "2024-01-29T13:00:00.000Z"
}
```

#### Set Custom Multiplier

```typescript
POST /api/v1/admin/rate-limits/:tenantId/multiplier

Request:
{
  "multiplier": 3.5,
  "reason": "Special enterprise agreement"
}

Response:
{
  "success": true,
  "message": "Custom multiplier set successfully"
}
```

### Admin Actions Audit Trail

All admin actions are logged in the audit trail:
- Bypass creation and expiration
- Custom multiplier changes
- Admin user who performed the action
- Reason for the change
- Timestamp and IP address

## Code Examples

### Basic API Route with Rate Limiting

```typescript
// app/api/v1/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/ratelimit';

async function handleGetProducts(req: NextRequest) {
  // Your route logic here
  const products = await getProducts();
  
  return NextResponse.json({
    success: true,
    data: products,
  });
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, 'read', handleGetProducts);
}
```

### Write Operation with Rate Limiting

```typescript
// app/api/v1/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/ratelimit';

async function handleCreateProduct(req: NextRequest) {
  const body = await req.json();
  const product = await createProduct(body);
  
  return NextResponse.json({
    success: true,
    data: product,
  }, { status: 201 });
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, 'write', handleCreateProduct);
}
```

### Auto-Detecting Rate Limiter Type

```typescript
import { withRateLimit, getRateLimiterType } from '@/lib/middleware/ratelimit';

export async function POST(req: NextRequest) {
  const limiterType = getRateLimiterType('POST', req.nextUrl.pathname);
  return withRateLimit(req, limiterType, handleRequest);
}
```

### Checking Rate Limit Status in Handler

```typescript
async function handleRequest(req: NextRequest) {
  // Rate limit headers are automatically added by middleware
  // You can access them in the response
  
  const response = NextResponse.json({ success: true });
  
  // Headers are already set by withRateLimit middleware:
  // - X-RateLimit-Limit
  // - X-RateLimit-Remaining
  // - X-RateLimit-Reset
  
  return response;
}
```

### Custom Error Handling

```typescript
async function handleRequest(req: NextRequest) {
  try {
    // Your logic here
    return NextResponse.json({ success: true });
  } catch (error) {
    // Rate limit errors are handled by middleware
    // This is for application errors
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
    }, { status: 500 });
  }
}
```

## Configuration

### Environment Variables

```env
# Required: Upstash Redis for distributed rate limiting
UPSTASH_REDIS_REST_URL="https://your-redis-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token-here"

# Optional: Rate limit configuration (defaults shown)
RATE_LIMIT_ENABLED="true"
```

### Getting Upstash Redis

1. Sign up at [Upstash Console](https://console.upstash.com/)
2. Create a Redis database (select region closest to your deployment)
3. Copy the REST URL and REST Token
4. Add to environment variables
5. Deploy and verify rate limiting works

**Note:** Without Upstash Redis, rate limiting falls back to in-memory storage, which only works for single-instance deployments.

### Customizing Rate Limits

To adjust base rate limits, edit `lib/services/rate-limit-config.ts`:

```typescript
export const ENDPOINT_LIMITS = {
  auth: {
    requests: 5,        // Adjust this value
    window: "15 m",
    windowMs: 15 * 60 * 1000,
    description: "Authentication endpoints",
  },
  // ... other limiters
};
```

### Customizing Plan Multipliers

To adjust plan multipliers, edit `lib/services/rate-limit-config.ts`:

```typescript
export const PLAN_MULTIPLIERS: Record<PlanType, number> = {
  BASIC: 1.0,      // Adjust these values
  PREMIUM: 2.0,
  PRO: 5.0,
};
```

## Testing

### Manual Testing

Test rate limiting with curl:

```bash
# Test auth rate limit (5 requests per 15 min)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123","companyName":"Test"}' \
    -i
  echo ""
done

# The 6th request should return 429
```

### Automated Testing

```typescript
import { describe, it, expect } from 'vitest';

describe('Rate Limiting', () => {
  it('should enforce rate limits', async () => {
    const requests = [];
    
    // Make requests up to the limit
    for (let i = 0; i < 6; i++) {
      requests.push(
        fetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com' }),
        })
      );
    }
    
    const responses = await Promise.all(requests);
    
    // First 5 should succeed (or fail for other reasons)
    // 6th should be rate limited
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
  
  it('should include rate limit headers', async () => {
    const response = await fetch('/api/v1/products');
    
    expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
    expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
  });
});
```

### Testing Plan Multipliers

```typescript
// Test that PREMIUM plan gets 2x limits
const basicResponse = await fetch('/api/v1/products', {
  headers: { Authorization: 'Bearer <basic-plan-token>' }
});

const premiumResponse = await fetch('/api/v1/products', {
  headers: { Authorization: 'Bearer <premium-plan-token>' }
});

const basicLimit = parseInt(basicResponse.headers.get('X-RateLimit-Limit'));
const premiumLimit = parseInt(premiumResponse.headers.get('X-RateLimit-Limit'));

expect(premiumLimit).toBe(basicLimit * 2);
```

## Troubleshooting

### Rate Limits Too Strict

**Symptom:** Users frequently hit rate limits during normal usage

**Solutions:**
1. Increase base limits in `rate-limit-config.ts`
2. Upgrade tenant to higher plan (PREMIUM or PRO)
3. Set custom multiplier for specific tenant
4. Set temporary bypass during high-usage periods

### Rate Limiting Not Working

**Symptom:** No rate limiting is applied, all requests succeed

**Checks:**
1. Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
2. Check Upstash Redis dashboard for connection issues
3. Verify `withRateLimit` middleware is applied to routes
4. Check logs for rate limiting errors (system fails open on errors)

### Different Limits Per Environment

**Symptom:** Rate limits differ between development and production

**Solution:** Use environment-specific configuration:

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

export const ENDPOINT_LIMITS = {
  auth: {
    requests: isDevelopment ? 100 : 5,  // Relaxed limits in dev
    window: "15 m",
    // ...
  },
};
```

### Monitoring Rate Limit Usage

**Symptom:** Need visibility into rate limit violations

**Solutions:**
1. Access admin dashboard at `/admin/rate-limits`
2. Query metrics API: `GET /api/v1/admin/rate-limits/metrics`
3. Check database table `RateLimitMetric` for historical data
4. Set up alerts for high violation rates

### Bypass Not Working

**Symptom:** Bypass is set but rate limiting still applies

**Checks:**
1. Verify bypass hasn't expired (`expiresAt` timestamp)
2. Check `isActive` flag in database
3. Verify tenant ID matches
4. Check logs for bypass check errors

### Custom Multiplier Not Applied

**Symptom:** Custom multiplier is set but limits don't change

**Checks:**
1. Verify custom multiplier is in valid range (0.1 to 100)
2. Check database table `RateLimitCustomMultiplier`
3. Verify tenant ID matches
4. Clear Redis cache if needed
5. Check `X-RateLimit-Multiplier` header in response

## Best Practices

### For Developers

1. **Always use appropriate limiter type** - Don't use `read` for write operations
2. **Handle 429 errors gracefully** - Implement retry logic with exponential backoff
3. **Show rate limit status to users** - Display remaining requests in UI
4. **Test rate limiting** - Include rate limit tests in your test suite
5. **Monitor violations** - Set up alerts for unusual patterns

### For Administrators

1. **Monitor violation rates** - Check dashboard regularly
2. **Adjust limits based on usage** - Increase limits if legitimate users are affected
3. **Document bypass reasons** - Always provide clear reasons for bypasses
4. **Review custom multipliers** - Periodically review and remove unnecessary custom multipliers
5. **Audit admin actions** - Review audit logs for rate limit changes

### For API Consumers

1. **Respect rate limits** - Don't try to circumvent limits
2. **Implement exponential backoff** - Wait longer between retries
3. **Cache responses** - Reduce API calls by caching data
4. **Batch operations** - Combine multiple operations into single requests
5. **Upgrade plan if needed** - Consider higher tier for increased limits

## Additional Resources

- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
- [HTTP 429 Status Code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
- [Retry-After Header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After)

## Support

For rate limiting issues:
1. Check this documentation
2. Review admin dashboard at `/admin/rate-limits`
3. Check audit logs for recent changes
4. Contact support with tenant ID and timestamp of issue
