# Redis Configuration Guide

## Overview

PricePilot uses Upstash Redis for distributed caching to improve performance and reduce database load. This guide covers the setup, configuration, and verification of Redis.

## Requirements

- Upstash Redis account (free tier available)
- Node.js environment with access to environment variables
- Network access to Upstash servers

## Performance Targets

- **Cache hit rate**: 70%+
- **Response time**: <50ms for cached queries
- **Database load reduction**: 60%+
- **Memory usage**: <500MB

## Setup Instructions

### 1. Create Upstash Redis Database

1. Go to [Upstash Console](https://console.upstash.com/)
2. Click "Create Database"
3. Choose a name for your database (e.g., "pricepilot-cache")
4. Select a region close to your application servers
5. Click "Create"

### 2. Get API Credentials

1. In the Upstash dashboard, select your database
2. Navigate to the "REST API" section
3. Copy the following values:
   - **REST URL**: `https://your-instance.upstash.io`
   - **REST TOKEN**: Your authentication token

### 3. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Redis Cache Configuration (Upstash)
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token-here"
```

**Important**: Never commit these credentials to version control!

### 4. Configure Memory Limits

In the Upstash dashboard:

1. Go to your database settings
2. Navigate to "Configuration" section
3. Set the following:
   - **Max Memory**: 500 MB
   - **Eviction Policy**: `allkeys-lru` (Least Recently Used)

**Why these settings?**
- **500MB limit**: Prevents unbounded memory growth while providing ample cache space
- **allkeys-lru**: Automatically evicts least recently used keys when memory limit is reached

### 5. Verify Configuration

Run the verification script to ensure everything is working:

```bash
npx tsx scripts/verify-redis-simple.ts
```

Expected output:
```
✅ ALL CHECKS PASSED

Redis Configuration Summary:
  • Connection: Working
  • Basic Operations: Working
  • Write Performance: ~150ms avg
  • Read Performance: ~150ms avg
```

## Cache Architecture

### Cache Services

PricePilot uses two cache service layers:

1. **CacheService** (`lib/services/cache.ts`)
   - Basic Redis operations using Upstash REST API
   - Simple get/set/delete operations
   - Used for general-purpose caching

2. **CacheLayer** (`lib/services/cache-layer.ts`)
   - Advanced caching with tenant isolation
   - Statistics tracking and monitoring
   - Pattern-based invalidation
   - Cache warming capabilities
   - Distributed invalidation via pub/sub

### Cache Key Structure

All cache keys follow this pattern for tenant isolation:

```
{tenantId}:{service}:{operation}:{params_hash}
```

Examples:
- `tenant_123:matching:findMatches:abc123def`
- `tenant_456:comparison:getReport:xyz789abc`
- `tenant_789:products:list:page_1_limit_20`

### TTL Configuration

Default Time-To-Live (TTL) values:

| Data Type | TTL | Reason |
|-----------|-----|--------|
| Product comparisons | 5 minutes | Frequently changing prices |
| Product matching | 15 minutes | Relatively stable matches |
| Competitor products | 30 minutes | Less frequent updates |
| Price history | 1 hour | Historical data changes slowly |
| Analytics | 10 minutes | Balance between freshness and performance |
| API responses | 2-10 minutes | Varies by endpoint |

## Usage Examples

### Basic Caching (CacheService)

```typescript
import { CacheService } from '@/lib/services/cache';

const cache = CacheService.getInstance();

// Set a value with 5-minute TTL
await cache.set('my-key', { data: 'value' }, 300);

// Get a value
const value = await cache.get<{ data: string }>('my-key');

// Delete a value
await cache.del('my-key');
```

### Advanced Caching (CacheLayer)

```typescript
import { CacheLayer } from '@/lib/services/cache-layer';

const cache = CacheLayer.getInstance();

// Set with tenant isolation
await cache.set('tenant:123:products:list', products, 300);

// Get with statistics tracking
const products = await cache.get<Product[]>('tenant:123:products:list');

// Invalidate by pattern
await cache.invalidate('tenant:123:products:*');

// Get cache statistics
const stats = await cache.getCacheStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
```

## Monitoring

### Cache Statistics

Monitor cache performance using the CacheLayer statistics:

```typescript
const stats = await cache.getCacheStats();

console.log({
  hitRate: stats.hitRate,        // Percentage of cache hits
  missRate: stats.missRate,      // Percentage of cache misses
  totalKeys: stats.totalKeys,    // Number of keys in cache
  memoryUsed: stats.memoryUsedBytes, // Memory usage in bytes
  evictions: stats.evictions     // Number of evicted keys
});
```

### Health Checks

The system automatically monitors:
- Redis connectivity
- Cache hit rate (alerts if <60%)
- Memory usage (alerts if >80%)
- Operation latency (alerts if >100ms)

### Logging

Cache operations are logged with the following prefixes:
- `[CacheService]` - Basic cache operations
- `[CacheLayer]` - Advanced cache operations
- `[Cache]` - General cache-related logs

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to Redis

**Solutions**:
1. Verify environment variables are set correctly
2. Check Upstash dashboard for database status
3. Ensure your IP is not blocked
4. Verify network connectivity to Upstash servers

### Slow Performance

**Problem**: Cache operations are slow (>100ms)

**Solutions**:
1. Check your network latency to Upstash region
2. Consider using a closer Upstash region
3. Verify you're not hitting rate limits
4. Check Upstash dashboard for performance metrics

### High Memory Usage

**Problem**: Memory usage approaching 500MB limit

**Solutions**:
1. Review TTL values - reduce if too long
2. Check for cache key leaks (keys not being deleted)
3. Verify eviction policy is set to `allkeys-lru`
4. Consider increasing memory limit if needed

### Low Hit Rate

**Problem**: Cache hit rate below 60%

**Solutions**:
1. Increase TTL values for stable data
2. Implement cache warming for frequently accessed data
3. Review cache invalidation patterns - may be too aggressive
4. Check if data access patterns are cacheable

## Security Considerations

### Credentials

- **Never commit** Redis credentials to version control
- Use environment variables for all credentials
- Rotate tokens periodically
- Use separate databases for development/staging/production

### Data Isolation

- All cache keys include tenant ID for isolation
- No cross-tenant data access possible
- Cache invalidation is tenant-scoped

### Encryption

- Upstash uses TLS/SSL for all connections
- Data is encrypted in transit
- Consider encrypting sensitive data before caching

## Performance Optimization

### Cache Warming

Pre-load frequently accessed data:

```typescript
// Warm cache on user login
await cache.warmTenantCache(tenantId);

// Warm specific data types
await cache.warmCache(tenantId, ['products', 'comparisons']);
```

### Batch Operations

Reduce round trips by batching:

```typescript
// Instead of multiple gets
const product1 = await cache.get('key1');
const product2 = await cache.get('key2');

// Use pipeline (if supported)
const [product1, product2] = await Promise.all([
  cache.get('key1'),
  cache.get('key2')
]);
```

### Invalidation Strategies

Choose the right invalidation strategy:

1. **Time-based**: Use TTL for data that changes predictably
2. **Event-based**: Invalidate on data changes
3. **Pattern-based**: Invalidate related keys together
4. **Manual**: For complex invalidation logic

## Migration Guide

### From No Cache to Redis Cache

1. Deploy Redis configuration (this guide)
2. Verify connectivity with verification script
3. Deploy cache integration code (Task 2+)
4. Monitor cache hit rate and performance
5. Adjust TTL values based on usage patterns

### Scaling Considerations

As your application grows:

1. **Increase memory**: Upgrade Upstash plan for more memory
2. **Add regions**: Use multiple Upstash databases in different regions
3. **Implement sharding**: Distribute cache across multiple databases
4. **Add monitoring**: Integrate with monitoring tools (Datadog, New Relic, etc.)

## Cost Optimization

### Upstash Pricing

- **Free tier**: 10,000 commands/day, 256MB storage
- **Pay-as-you-go**: $0.2 per 100K commands
- **Pro plans**: Fixed pricing with higher limits

### Reducing Costs

1. Use appropriate TTL values (don't cache forever)
2. Implement cache warming during off-peak hours
3. Monitor and optimize cache hit rate
4. Remove unused cache keys regularly
5. Use pattern-based invalidation to clean up related keys

## Additional Resources

- [Upstash Documentation](https://docs.upstash.com/redis)
- [Upstash REST API Reference](https://docs.upstash.com/redis/features/restapi)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Cache Invalidation Patterns](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/BestPractices.html)

## Support

For issues related to:
- **Upstash service**: Contact Upstash support
- **PricePilot caching**: Check application logs and monitoring
- **Configuration**: Review this guide and verify settings

## Changelog

- **2025-01-29**: Initial Redis configuration guide created
- **Task 1 Complete**: Environment variables verified, documentation created
