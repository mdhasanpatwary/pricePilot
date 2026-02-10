# Redis Rate Limit Cache - Quick Reference

## TL;DR

Redis caching for rate limit configuration is now live. It's **completely transparent** - no code changes needed. Cache hit rate should be >95%.

## Files Changed

- ✅ `lib/services/rate-limit-redis-cache.ts` (new)
- ✅ `lib/services/rate-limit-admin.ts` (modified)
- ✅ `app/api/admin/rate-limit/cache-metrics/route.ts` (new)

## How It Works

```
Request → Request Cache → Redis Cache → Database
          (fastest)       (fast)        (fallback)
```

## Cache Keys

```
ratelimit:bypass:{tenantId}      # TTL: 5 minutes
ratelimit:multiplier:{tenantId}  # TTL: 10 minutes
```

## Check Cache Metrics

```bash
curl https://your-domain.com/api/admin/rate-limit/cache-metrics \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Monitor in Logs

Search for: `[RateLimitRedisCache]`

## Expected Performance

- **Database queries**: 95%+ reduction
- **Latency**: 5-10x faster
- **Cache hit rate**: >95%

## If Redis Goes Down

No problem! System automatically falls back to database queries. Rate limiting continues to work.

## Configuration

Uses existing Redis setup:
- `REDIS_URL` or
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Low hit rate (<90%) | Check logs, verify Redis connectivity |
| Redis errors | Check environment variables, Redis status |
| Cache inconsistency | Clear cache: `redis-cli KEYS ratelimit:* \| xargs redis-cli DEL` |

## Key Functions

```typescript
// These now use Redis caching automatically
await checkBypass(tenantId);
await getCustomMultiplier(tenantId);

// Get cache metrics
const metrics = getCacheMetrics();
console.log(`Hit rate: ${metrics.bypassHitRate}%`);
```

## That's It!

Everything else happens automatically. Monitor cache hit rates and enjoy the performance boost! 🚀
