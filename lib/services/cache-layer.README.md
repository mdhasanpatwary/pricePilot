# Cache Layer Component

## Overview

The Cache Layer component implements a multi-layer caching strategy to reduce database load and improve application performance. It provides tenant-isolated caching with TTL-based expiration, pattern-based invalidation, and distributed cache synchronization.

## Features

- **Tenant Isolation**: All cache keys include tenant ID to prevent cross-tenant data leakage
- **TTL Support**: Automatic expiration of cached data based on configurable time-to-live
- **Pattern Invalidation**: Invalidate multiple cache entries using wildcard patterns
- **Cache Warming**: Pre-populate cache with frequently accessed data during off-peak hours
- **Hit Rate Monitoring**: Track cache performance and alert when hit rate falls below 60%
- **Distributed Caching**: Redis pub/sub for cache invalidation across multiple application instances

## Requirements Satisfied

- **4.1**: Tenant-specific cache keys with 5-minute TTL for product comparisons
- **4.2**: Cache invalidation on database updates
- **4.3**: Distributed cache invalidation via Redis pub/sub
- **4.4**: Cache warming for frequently accessed tenant data
- **4.5**: Cache hit rate tracking with alerts below 60%
- **4.6**: Redis for distributed caching across instances

## Usage

### Basic Operations

```typescript
import { cacheLayer } from '@/lib/services/cache-layer';

// Get cached value
const product = await cacheLayer.get<Product>('tenant:123:product:456');

// Set cached value with 5-minute TTL
await cacheLayer.set('tenant:123:product:456', productData, 300);

// Invalidate cache entries by pattern
await cacheLayer.invalidate('tenant:123:product:*');
```

### Cache Key Generators

```typescript
// Product comparison cache key
const key = cacheLayer.keys.productComparison('tenant-123', { 
  status: 'active',
  minPrice: 100 
});

// Competitor products cache key
const key = cacheLayer.keys.competitorProducts('competitor-456');

// Price history cache key
const key = cacheLayer.keys.priceHistory('product-789', {
  start: new Date('2024-01-01'),
  end: new Date('2024-01-31')
});
```

### Cache Warming

```typescript
// Warm cache for a specific tenant (run during off-peak hours)
await cacheLayer.warmCache('tenant-123');
```

### Cache Statistics

```typescript
// Get cache performance metrics
const stats = await cacheLayer.getCacheStats();
console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
console.log(`Total Keys: ${stats.totalKeys}`);
console.log(`Memory Used: ${stats.memoryUsedBytes} bytes`);
```

### Distributed Invalidation

```typescript
// Subscribe to cache invalidation events
await cacheLayer.subscribeToInvalidations((pattern) => {
  console.log(`Cache invalidated: ${pattern}`);
  // Handle invalidation in this instance
});
```

## Cache TTL Strategy

| Data Type | TTL | Reason |
|-----------|-----|--------|
| Product Comparisons | 5 minutes | Frequently updated, needs to be fresh |
| Competitor Products | 15 minutes | Less frequently updated, can be slightly stale |
| Price History | 1 hour | Historical data, rarely changes |
| Analytics Aggregations | 15 minutes | Expensive queries, acceptable staleness |

## Cache Invalidation Patterns

### On Product Update
```typescript
// Invalidate all product-related caches for a tenant
await cacheLayer.invalidate(`tenant:${tenantId}:product:*`);
```

### On Price Update
```typescript
// Invalidate specific product and comparison caches
await cacheLayer.invalidate(`tenant:${tenantId}:product:${productId}:*`);
await cacheLayer.invalidate(`tenant:${tenantId}:product-comparison:*`);
```

### On Competitor Scrape
```typescript
// Invalidate competitor product caches
await cacheLayer.invalidate(`competitor:${competitorId}:*`);
```

## Monitoring

### Cache Hit Rate Alert

The system automatically logs a warning when cache hit rate falls below 60%:

```
[CacheLayer] Cache hit rate below threshold
{
  hitRate: "45.23%",
  threshold: "60%",
  hits: 452,
  misses: 548
}
```

### Performance Metrics

Monitor these metrics in production:
- **Hit Rate**: Should be > 60% for optimal performance
- **Memory Usage**: Monitor Redis memory consumption
- **Evictions**: High evictions indicate insufficient memory
- **Total Keys**: Track cache size growth

## Integration with Database Operations

### Example: Product API with Caching

```typescript
import { cacheLayer } from '@/lib/services/cache-layer';
import { prisma } from '@/lib/prisma';

export async function getProductComparison(tenantId: string, filters: any) {
  // Try cache first
  const cacheKey = cacheLayer.keys.productComparison(tenantId, filters);
  const cached = await cacheLayer.get(cacheKey);
  
  if (cached) {
    return cached;
  }

  // Cache miss - fetch from database
  const data = await prisma.userProduct.findMany({
    where: {
      tenantId,
      ...filters,
    },
    include: {
      productMatches: {
        include: {
          competitorProduct: true,
        },
      },
    },
  });

  // Store in cache with 5-minute TTL
  await cacheLayer.set(cacheKey, data, 300);

  return data;
}

export async function updateProduct(tenantId: string, productId: string, data: any) {
  // Update database
  const updated = await prisma.userProduct.update({
    where: { id: productId },
    data,
  });

  // Invalidate related caches
  await cacheLayer.invalidate(`tenant:${tenantId}:product:${productId}:*`);
  await cacheLayer.invalidate(`tenant:${tenantId}:product-comparison:*`);

  return updated;
}
```

## Cache Warming Schedule

Run cache warming during off-peak hours (2-4 AM UTC):

```typescript
// In a cron job or scheduled task
import { cacheLayer } from '@/lib/services/cache-layer';
import { prisma } from '@/lib/prisma';

async function warmAllTenantCaches() {
  const tenants = await prisma.tenant.findMany({
    where: { status: 'active' },
  });

  for (const tenant of tenants) {
    await cacheLayer.warmCache(tenant.id);
  }
}

// Schedule: 0 2 * * * (2 AM UTC daily)
```

## Testing

### Unit Tests

```typescript
import { cacheLayer } from '@/lib/services/cache-layer';

describe('CacheLayer', () => {
  beforeEach(async () => {
    await cacheLayer.clearAll();
  });

  it('should cache and retrieve values', async () => {
    await cacheLayer.set('test-key', { data: 'value' }, 60);
    const result = await cacheLayer.get('test-key');
    expect(result).toEqual({ data: 'value' });
  });

  it('should generate tenant-specific cache keys', () => {
    const key = cacheLayer.keys.productComparison('tenant-123', { status: 'active' });
    expect(key).toContain('tenant:tenant-123');
  });

  it('should invalidate by pattern', async () => {
    await cacheLayer.set('tenant:123:product:1', { id: 1 }, 60);
    await cacheLayer.set('tenant:123:product:2', { id: 2 }, 60);
    
    const count = await cacheLayer.invalidate('tenant:123:product:*');
    expect(count).toBe(2);
  });
});
```

## Configuration

### Environment Variables

```env
# Redis connection (choose one)
REDIS_URL=redis://localhost:6379

# OR Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

### Redis Configuration

The cache layer uses the shared Redis connection from `lib/queue/connection.ts` with:
- Connection pooling enabled
- Auto-pipelining for performance
- Exponential backoff retry strategy
- Automatic reconnection on failure

## Performance Considerations

1. **Cache Key Design**: Keep keys short but descriptive
2. **TTL Selection**: Balance freshness vs. database load
3. **Batch Operations**: Use pipelining for multiple cache operations
4. **Memory Management**: Monitor Redis memory and set maxmemory policy
5. **Eviction Policy**: Use `allkeys-lru` for automatic eviction

## Troubleshooting

### Low Hit Rate

If cache hit rate is consistently below 60%:
1. Check if TTL is too short
2. Verify cache warming is running
3. Review invalidation patterns (too aggressive?)
4. Analyze query patterns (cacheable queries?)

### High Memory Usage

If Redis memory usage is high:
1. Review TTL settings (too long?)
2. Check for memory leaks in cached data
3. Implement cache size limits
4. Consider increasing Redis memory or using eviction

### Cache Invalidation Issues

If stale data is being served:
1. Verify invalidation patterns are correct
2. Check pub/sub is working across instances
3. Review database update hooks
4. Test distributed invalidation

## Related Components

- **Query Analyzer**: Identifies slow queries that benefit from caching
- **Connection Pool Manager**: Reduces database connections via caching
- **Read Replica Router**: Works with cache layer for read optimization
