# Redis Rate Limit Cache - Usage Guide

## Overview

This guide explains how to use and monitor the Redis caching layer for rate limit configuration in PricePilot.

## For Developers

### Using the Cache

The Redis cache is **completely transparent** to existing code. No changes are required to use it.

```typescript
// This function now uses Redis caching automatically
const hasBypass = await checkBypass('tenant-123');

// This function also uses Redis caching automatically
const multiplier = await getCustomMultiplier('tenant-123');
```

### Cache Flow

1. **Request-scoped cache** (fastest, in-memory)
2. **Redis cache** (fast, distributed)
3. **PostgreSQL database** (fallback)

### Cache Invalidation

Cache is automatically invalidated when configuration changes:

```typescript
// Setting a bypass invalidates the cache
await setBypass(tenantId, adminUserId, 60, 'Migration in progress');

// Setting a multiplier invalidates the cache
await setCustomMultiplier(tenantId, adminUserId, 2.5, 'Enterprise agreement');

// Removing a multiplier invalidates the cache
await removeCustomMultiplier(tenantId, adminUserId, 'Agreement ended');
```

### Getting Cache Metrics

```typescript
import { getCacheMetrics } from '@/lib/services/rate-limit-admin';

const metrics = getCacheMetrics();
console.log(`Bypass hit rate: ${metrics.bypassHitRate.toFixed(2)}%`);
console.log(`Multiplier hit rate: ${metrics.multiplierHitRate.toFixed(2)}%`);
```

### Logging Cache Metrics

```typescript
import { logCacheMetrics } from '@/lib/services/rate-limit-admin';

// Log current metrics
logCacheMetrics();
```

## For Operations/DevOps

### Monitoring Cache Performance

#### Via API Endpoint

```bash
# Get cache metrics (requires super admin authentication)
curl -X GET https://your-domain.com/api/admin/rate-limit/cache-metrics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "success": true,
  "data": {
    "bypass": {
      "hits": 1250,
      "misses": 50,
      "total": 1300,
      "hitRate": 96.15
    },
    "multiplier": {
      "hits": 980,
      "misses": 20,
      "total": 1000,
      "hitRate": 98.0
    },
    "overall": {
      "totalHits": 2230,
      "totalMisses": 70,
      "totalRequests": 2300
    }
  }
}
```

#### Via Application Logs

Cache operations are logged with appropriate levels:
- **DEBUG**: Cache hits
- **INFO**: Cache invalidations
- **ERROR**: Cache failures

Search logs for:
```
[RateLimitRedisCache]
```

### Key Metrics to Monitor

1. **Cache Hit Rate**
   - Target: >95% for both bypass and multiplier
   - Low hit rate indicates issues or high configuration churn

2. **Redis Latency**
   - Target: <5ms for GET operations
   - Monitor via Redis metrics or APM tools

3. **Cache Invalidation Rate**
   - Track frequency of invalidations
   - High rate may indicate TTL adjustment needed

### Troubleshooting

#### Low Cache Hit Rate

**Symptoms**: Hit rate below 90%

**Possible Causes**:
- TTL too short
- High configuration change frequency
- Cache invalidation too aggressive

**Actions**:
1. Check cache metrics via API
2. Review application logs for invalidation frequency
3. Consider increasing TTL values if appropriate

#### Redis Connection Issues

**Symptoms**: Errors in logs about Redis connection

**Possible Causes**:
- Redis server down
- Network connectivity issues
- Authentication failures

**Actions**:
1. Check Redis server status
2. Verify environment variables:
   - `REDIS_URL` or
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
3. Check network connectivity
4. Review Redis server logs

**Note**: The system will automatically fall back to database queries if Redis is unavailable.

#### Cache Inconsistency

**Symptoms**: Different values across application instances

**Possible Causes**:
- Cache invalidation not propagating
- Race conditions
- Network issues

**Actions**:
1. Check Redis connectivity across all instances
2. Verify cache invalidation is being called
3. Review distributed cache behavior
4. Check for clock skew across instances

### Configuration

#### Environment Variables

Uses existing Redis configuration:
```bash
# Option 1: Direct Redis URL
REDIS_URL=redis://localhost:6379

# Option 2: Upstash (recommended for production)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

#### Cache TTL Values

Configured in `lib/services/rate-limit-redis-cache.ts`:
- **Bypass**: 5 minutes (300 seconds)
- **Custom Multiplier**: 10 minutes (600 seconds)

To adjust TTL values, modify the `CACHE_TTL` constant.

### Health Checks

#### Verify Redis Connection

```bash
# Connect to Redis CLI
redis-cli -u $REDIS_URL

# Test connection
PING
# Should return: PONG

# Check cache keys
KEYS ratelimit:*
```

#### Verify Cache Data

```bash
# Get bypass cache for a tenant
GET ratelimit:bypass:tenant-id-here

# Get multiplier cache for a tenant
GET ratelimit:multiplier:tenant-id-here
```

### Performance Impact

Expected improvements:
- **Database Load**: 95%+ reduction in rate limit config queries
- **Response Time**: 5-10x faster configuration checks
- **Scalability**: Better horizontal scaling with distributed cache

### Maintenance

#### Clear All Cache

```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# Delete all rate limit cache keys
KEYS ratelimit:* | xargs redis-cli DEL
```

#### Clear Specific Tenant Cache

```bash
# Delete bypass cache
DEL ratelimit:bypass:tenant-id-here

# Delete multiplier cache
DEL ratelimit:multiplier:tenant-id-here
```

## For QA/Testing

### Testing Cache Behavior

#### Test Cache Hit

1. Make first request (cache miss, queries database)
2. Make second request within TTL (cache hit, no database query)
3. Verify response is consistent

#### Test Cache Invalidation

1. Set a bypass or multiplier
2. Verify cache is invalidated (check logs)
3. Next request should be cache miss
4. Subsequent requests should be cache hits

#### Test Redis Unavailability

1. Stop Redis server
2. Make requests (should fall back to database)
3. Verify no errors in application
4. Start Redis server
5. Verify caching resumes

### Load Testing

When load testing, monitor:
- Cache hit rate (should be >95%)
- Redis latency (should be <5ms)
- Database query reduction
- Overall response time improvement

## Common Questions

### Q: Do I need to change my code to use Redis caching?

**A**: No, the caching is completely transparent. Existing code automatically uses Redis caching.

### Q: What happens if Redis is down?

**A**: The system automatically falls back to database queries. Rate limiting continues to work normally.

### Q: How do I know if caching is working?

**A**: Check the cache metrics via the API endpoint or application logs. Look for high hit rates (>95%).

### Q: Can I disable Redis caching?

**A**: Yes, simply don't configure Redis environment variables. The system will use database queries only.

### Q: How often should I monitor cache metrics?

**A**: Monitor continuously via your APM/monitoring system. Review metrics daily or when investigating performance issues.

### Q: What's the difference between request-scoped cache and Redis cache?

**A**: Request-scoped cache is in-memory and only lasts for a single HTTP request. Redis cache is distributed and shared across all application instances.

## Support

For issues or questions:
1. Check application logs for `[RateLimitRedisCache]` entries
2. Review cache metrics via API endpoint
3. Verify Redis connectivity
4. Contact the development team with logs and metrics
