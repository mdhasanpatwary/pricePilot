# Rate Limiting Implementation

PricePilot uses `@upstash/ratelimit` with Upstash Redis for distributed rate limiting across API routes.

## Overview

Rate limiting prevents abuse, DDoS attacks, and ensures fair resource usage. Different endpoints have different limits based on their resource requirements.

## Rate Limit Tiers

| Limiter Type | Limit | Window | Use Case |
|-------------|-------|--------|----------|
| `auth` | 5 requests | 15 minutes | Authentication endpoints (login, register) |
| `sync` | 5 requests | 5 minutes | Sync operations (resource-intensive) |
| `importExport` | 10 requests | 1 minute | Import/Export operations |
| `write` | 30 requests | 1 minute | Write operations (POST, PUT, DELETE) |
| `read` | 200 requests | 1 minute | Read operations (GET) |
| `api` | 100 requests | 1 minute | General API endpoints (default) |

## Usage

### Basic Usage

Wrap your route handler with `withRateLimit`:

```typescript
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handleRequest(req: NextRequest) {
  // Your route logic here
  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "write", handleRequest);
}
```

### Example: Auth Endpoint

```typescript
// app/api/auth/register/route.ts
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handleRegister(req: NextRequest) {
  // Registration logic
  // ...
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "auth", handleRegister);
}
```

### Example: Sync Endpoint

```typescript
// app/api/competitors/sync/route.ts
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handleSync(req: NextRequest) {
  // Sync logic
  // ...
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "sync", handleSync);
}
```

## Configuration

### Environment Variables

Add to `.env`:

```env
# Optional: Upstash Redis for distributed rate limiting
# Without these, rate limiting falls back to in-memory (single instance only)
UPSTASH_REDIS_REST_URL="https://your-redis-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token-here"
```

### Getting Upstash Redis

1. Sign up at [Upstash Console](https://console.upstash.com/)
2. Create a Redis database
3. Copy the REST URL and token
4. Add to environment variables

**Note:** Rate limiting works without Upstash Redis (uses in-memory), but it's recommended for production multi-instance deployments.

## Rate Limit Response

When rate limit is exceeded, the API returns:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 45
}
```

**HTTP Status:** `429 Too Many Requests`

**Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds to wait before retrying

## Identifier Strategy

Rate limiting uses:

1. **User ID** (if authenticated) - More accurate, per-user limits
2. **IP Address** (fallback) - For unauthenticated requests

This prevents authenticated users from bypassing limits by changing IPs.

## Applying to All Routes

To apply rate limiting to all routes, you can:

1. Use the `withRateLimit` wrapper (recommended)
2. Determine limiter type automatically using `getRateLimiterType()`

### Auto-Detection Example

```typescript
import { withRateLimit, getRateLimiterType } from "@/lib/middleware/ratelimit";

export async function POST(req: NextRequest) {
  const limiterType = getRateLimiterType("POST", req.nextUrl.pathname);
  return withRateLimit(req, limiterType, handleRequest);
}
```

## Current Implementation Status

✅ **Implemented:**
- `/api/auth/register` - Auth rate limiting
- `/api/competitors/sync` - Sync rate limiting
- `/api/sync/full` - Full sync rate limiting
- `/api/imports/products` - Import rate limiting

⚠️ **To Do:**
- Apply to remaining API routes
- Add rate limiting to GET endpoints
- Consider per-tenant rate limits for enterprise plans

## Testing

Rate limiting automatically works in development. To test:

1. Make rapid requests to a rate-limited endpoint
2. Check for `429` response after limit is exceeded
3. Verify `X-RateLimit-*` headers in response

Example test:

```bash
# Test auth rate limit (5 requests per 15 min)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123","companyName":"Test"}'
  echo ""
done
```

## Best Practices

1. **Choose appropriate limiter**: Use strict limits for expensive operations
2. **Fail open**: If rate limiting fails, log but don't block (already implemented)
3. **Monitor limits**: Track rate limit hits in production logs
4. **User feedback**: Show rate limit status in UI (remaining requests)
5. **Adjust limits**: Monitor and adjust limits based on actual usage patterns

## Troubleshooting

**Issue:** Rate limits too strict
**Solution:** Adjust limits in `lib/ratelimit.ts` based on your use case

**Issue:** Rate limiting not working in production
**Solution:** Ensure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set

**Issue:** Different limits per plan
**Solution:** Extend `rateLimiters` to support plan-based limits (e.g., `api-premium`, `api-basic`)
