---
title: "Rate Limiting"
description: "Rate limiting configuration and monitoring"
category: "system-monitoring"
tags: ["rate-limiting", "security", "configuration"]
audience: "admin"
---

# Rate Limiting Documentation

## Overview

PricePilot implements comprehensive rate limiting across all API endpoints to prevent abuse, ensure fair resource allocation, and maintain system stability. Rate limiting is enforced using Redis-backed sliding window counters with tenant-aware multipliers based on subscription plans.

## Rate Limit Types

### 1. Read Operations (`read`)
- **Base Limit**: 200 requests per minute
- **Endpoints**: GET requests for data retrieval
- **Examples**: 
  - `GET /api/v1/products`
  - `GET /api/v1/competitors`
  - `GET /api/v1/analytics/*`

### 2. Write Operations (`write`)
- **Base Limit**: 30 requests per minute
- **Endpoints**: POST, PUT, PATCH, DELETE requests
- **Examples**:
  - `POST /api/v1/products`
  - `PUT /api/v1/competitors/:id`
  - `DELETE /api/v1/products/:id`

### 3. Authentication (`auth`)
- **Base Limit**: 5 requests per 15 minutes
- **Endpoints**: Login, registration, password reset
- **Examples**:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/forgot-password`

### 4. Sync Operations (`sync`)
- **Base Limit**: 5 requests per 5 minutes
- **Endpoints**: Competitor scraping and product synchronization
- **Examples**:
  - `POST /api/v1/sync/full`
  - `POST /api/v1/competitors/sync`

### 5. Import/Export (`importExport`)
- **Base Limit**: 10 requests per minute
- **Endpoints**: Bulk data operations
- **Examples**:
  - `POST /api/v1/imports/products`
  - `GET /api/v1/exports/competitors`

### 6. General API (`api`)
- **Base Limit**: 100 requests per minute
- **Endpoints**: Default for endpoints not matching other categories
- **Examples**: Miscellaneous API calls

## Plan-Based Multipliers

Rate limits are multiplied based on the tenant's subscription plan:

| Plan | Multiplier | Example (Read) | Example (Write) |
|------|-----------|----------------|-----------------|
| BASIC | 1.0x | 200/min | 30/min |
| PROFESSIONAL | 2.0x | 400/min | 60/min |
| ENTERPRISE | 5.0x | 1000/min | 150/min |

## Rate Limit Headers

All API responses include rate limit information in headers:

```
X-RateLimit-Limit: 200          # Total requests allowed in window
X-RateLimit-Remaining: 195      # Remaining requests in current window
X-RateLimit-Reset: 1706789123   # Unix timestamp when limit resets
X-RateLimit-Plan: PROFESSIONAL  # Tenant's subscription plan
X-RateLimit-Multiplier: 2.0     # Applied multiplier
```

## Rate Limit Exceeded Response

When rate limit is exceeded, the API returns HTTP 429 with:

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
    "requestId": "uuid",
    "timestamp": "ISO8601"
  }
}
```

**Headers**:
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1706789123
Retry-After: 45
X-RateLimit-Type: write
```

## Automatic Limiter Selection

The system automatically selects the appropriate rate limiter based on:

1. **Path patterns**:
   - `/auth/`, `/register` → `auth` limiter
   - `/sync`, `/competitors/sync` → `sync` limiter
   - `/import`, `/export` → `importExport` limiter

2. **HTTP method**:
   - `GET` → `read` limiter
   - `POST`, `PUT`, `PATCH`, `DELETE` → `write` limiter

3. **Default**: `api` limiter for unmatched endpoints

## Implementation

### Basic Usage

```typescript
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handleGET(req: NextRequest) {
  // Your handler logic
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}
```

### Auto-Detection

```typescript
import { withRateLimit, getRateLimiterType } from "@/lib/middleware/ratelimit";

export async function POST(req: NextRequest) {
  const limiterType = getRateLimiterType('POST', req.nextUrl.pathname);
  return withRateLimit(req, limiterType, handlePOST);
}
```

## Admin Features

### Rate Limit Bypass

Admins can temporarily bypass rate limits for specific tenants:

```typescript
// Enable bypass for 1 hour
await enableRateLimitBypass(tenantId, 3600);

// Check if bypass is active
const isBypassed = await checkBypass(tenantId);
```

When bypass is active, responses include:
```
X-RateLimit-Bypass: true
```

### Custom Multipliers

Admins can set custom multipliers per tenant:

```typescript
// Set custom 10x multiplier
await setCustomMultiplier(tenantId, 10.0);

// Remove custom multiplier (revert to plan-based)
await removeCustomMultiplier(tenantId);
```

## Monitoring

### Metrics Tracking

The system tracks:
- Total requests per tenant
- Rate limit violations
- Requests by limiter type
- Requests by endpoint

### Alerts

Automatic alerts are triggered when:
- Violation rate exceeds 10% of total requests
- Sustained high violation rate (>5 violations/minute for 5 minutes)
- Unusual spike in violations

## Cron Jobs

Cron jobs (scheduled tasks) are **exempt from rate limiting** as they:
- Are authenticated via `CRON_SECRET`
- Are called by Vercel's cron scheduler, not users
- Run on a fixed schedule

Examples:
- `GET /api/v1/cron/global-sync`
- `GET /api/v1/cron/evaluate-alerts`
- `GET /api/v1/cron/auto-approval`

## Best Practices

### For API Consumers

1. **Monitor headers**: Check `X-RateLimit-Remaining` to avoid hitting limits
2. **Implement backoff**: Use `Retry-After` header value for retry delays
3. **Batch operations**: Use bulk endpoints when available
4. **Cache responses**: Reduce redundant API calls
5. **Upgrade plan**: Consider higher tier for increased limits

### For Developers

1. **Choose appropriate limiter**: Use the most specific limiter type
2. **Apply to all routes**: Ensure all public endpoints have rate limiting
3. **Test limits**: Verify rate limiting works in staging
4. **Document limits**: Update API docs when adding new endpoints
5. **Monitor violations**: Track and investigate high violation rates

## Testing Rate Limits

### Manual Testing

```bash
# Test rate limit with concurrent requests
for i in {1..250}; do
  curl -H "Authorization: Bearer $TOKEN" \
    https://api.example.com/api/v1/products &
done
wait

# Should see 429 responses after limit is reached
```

### Automated Testing

```typescript
import { describe, it, expect } from 'vitest';

describe('Rate Limiting', () => {
  it('should enforce read rate limit', async () => {
    const requests = Array(250).fill(null).map(() =>
      fetch('/api/v1/products', {
        headers: { Authorization: `Bearer ${token}` }
      })
    );
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);
    
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

## Troubleshooting

### Issue: Rate limit hit unexpectedly

**Solutions**:
1. Check `X-RateLimit-Plan` header to verify plan multiplier
2. Review recent API usage in monitoring dashboard
3. Check for custom multiplier: `await getCustomMultiplier(tenantId)`
4. Verify no bypass is active: `await checkBypass(tenantId)`

### Issue: Rate limit not enforced

**Solutions**:
1. Verify Redis connection is working
2. Check if bypass is enabled for tenant
3. Ensure `withRateLimit` middleware is applied
4. Check for errors in rate limit middleware logs

### Issue: Different limits than expected

**Solutions**:
1. Verify tenant's plan type in database
2. Check for custom multiplier overrides
3. Ensure correct limiter type is being used
4. Review plan multiplier configuration

## Configuration

### Environment Variables

```bash
# Redis connection (required)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Cron authentication (required for cron jobs)
CRON_SECRET=your-secret-here
```

### Customizing Limits

To modify base limits, edit `lib/ratelimit.ts`:

```typescript
export const rateLimiters = {
  read: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, "1 m"), // Adjust here
    analytics: true,
  }),
  // ... other limiters
};
```

## Security Considerations

1. **Distributed attacks**: Rate limits are per-tenant, not per-IP
2. **Token sharing**: Shared API tokens count toward same limit
3. **Bypass abuse**: Monitor bypass usage and duration
4. **Custom multipliers**: Audit custom multiplier changes
5. **Cron secrets**: Keep `CRON_SECRET` secure and rotate regularly

## Related Documentation

- [API Authentication](./API_AUTHENTICATION.md)
- [API Error Codes](./API_ERROR_CODES.md)
- [Monitoring System](./MONITORING_SYSTEM.md)
- [Security Requirements](../security-requirements.md)

---

**Last Updated**: February 2, 2026  
**Version**: 1.0  
**Requirements**: 2.7.2, 2.19.1-2.19.5
