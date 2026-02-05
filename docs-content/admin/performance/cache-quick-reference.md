---
title: "Cache Quick Reference"
description: "Quick reference for cache operations"
category: "performance"
tags: ["cache", "quick-reference", "operations"]
audience: "admin"
relatedDocs: ["/docs/troubleshooting/cache-quick-reference.md"]
---

# Cache Quick Reference Guide

## Quick Start

### Basic Cache Operations

```typescript
import { cacheLayer } from '@/lib/services/cache-layer';

// Set cache
await cacheLayer.set('key', data, 300); // 300 seconds TTL

// Get cache
const data = await cacheLayer.get('key');

// Invalidate cache (automatically distributed)
await cacheLayer.invalidate('pattern:*');

// Delete specific key
await cacheLayer.del('key');
```

### Enhanced Cache Service

```typescript
import { cacheEnhancedService } from '@/lib/services/cache-enhanced';

// Cache product
await cacheEnhancedService.cacheProduct(tenantId, productId, data);

// Get cached product
const product = await cacheEnhancedService.getCachedProduct(tenantId, productId);

// Invalidate product cache
await cacheEnhancedService.invalidateProduct(tenantId, productId);

// Cache comparison
await cacheEnhancedService.cacheComparison(tenantId, filters, data);

// Get cached comparison
const comparison = await cacheEnhancedService.getCachedComparison(tenantId, filters);
```

### Cache Invalidation

```typescript
import { cacheInvalidationService } from '@/lib/services/cache-invalidation';

// After price update
await cacheInvalidationService.onPriceUpdate(tenantId, [productId1, productId2]);

// After product sync
await cacheInvalidationService.onProductSync(tenantId);

// After match update
await cacheInvalidationService.onMatchUpdate(tenantId, productId);

// After competitor scrape
await cacheInvalidationService.onCompetitorScrape(tenantId, competitorId);
```

### Cache Warming

```typescript
import { cacheWarmingService } from '@/lib/services/cache-warming';

// Warm on login
await cacheWarmingService.warmOnLogin(tenantId);

// Warm dashboard data
await cacheWarmingService.warmDashboardData(tenantId);

// Warm tenant cache
await cacheWarmingService.warmTenantCache(tenantId);
```

### Cache Monitoring

```typescript
import { cacheMonitoringService } from '@/lib/services/cache-monitoring';

// Get health status
const health = await cacheMonitoringService.getHealthStatus();

// Log statistics
await cacheMonitoringService.logStats();
```

## Default TTLs

| Data Type | TTL | Use Case |
|-----------|-----|----------|
| Products | 5 min | Frequently updated |
| Comparisons | 5 min | Real-time pricing |
| Matches | 15 min | Stable relationships |
| Competitor Products | 30 min | Less frequent updates |
| Price History | 1 hour | Historical data |
| Analytics | 10 min | Dashboard metrics |
| API Responses | 2-10 min | Endpoint-specific |

## Cache Key Patterns

All cache keys follow tenant isolation:

```
{tenantId}:{service}:{operation}:{params_hash}
```

Examples:
- `tenant_123:products:get:abc123`
- `tenant_123:comparison:report:xyz789`
- `tenant_123:matching:findMatches:def456`

## Distributed Invalidation

Cache invalidation automatically propagates to all instances:

```typescript
// On Instance 1
await cacheLayer.invalidate('tenant_123:products:*');

// Automatically invalidates on Instance 2, 3, etc.
```

## Error Handling

Cache operations fail gracefully:

```typescript
try {
  const data = await cacheLayer.get('key');
  if (!data) {
    // Cache miss - query database
    data = await database.query();
    await cacheLayer.set('key', data, 300);
  }
  return data;
} catch (error) {
  // Cache error - fall back to database
  logger.error('Cache error', { error });
  return await database.query();
}
```

## Best Practices

### 1. Always Use Tenant Isolation

```typescript
// Good
const key = `${tenantId}:products:${productId}`;

// Bad
const key = `products:${productId}`;
```

### 2. Set Appropriate TTLs

```typescript
// Frequently changing data - short TTL
await cacheLayer.set(key, data, 300); // 5 minutes

// Stable data - longer TTL
await cacheLayer.set(key, data, 3600); // 1 hour
```

### 3. Invalidate on Updates

```typescript
// After updating data
await database.update(productId, newData);
await cacheLayer.invalidate(`${tenantId}:products:*`);
```

### 4. Use Specific Patterns

```typescript
// Good - specific pattern
await cacheLayer.invalidate('tenant_123:products:get:abc123');

// Less efficient - broad wildcard
await cacheLayer.invalidate('tenant_123:*');
```

### 5. Handle Cache Misses

```typescript
async function getProduct(tenantId: string, productId: string) {
  // Try cache first
  let product = await cacheEnhancedService.getCachedProduct(tenantId, productId);
  
  if (!product) {
    // Cache miss - query database
    product = await database.product.findUnique({ where: { id: productId } });
    
    // Cache for next time
    if (product) {
      await cacheEnhancedService.cacheProduct(tenantId, productId, product);
    }
  }
  
  return product;
}
```

## Monitoring

### Check Cache Health

```bash
# Via API
curl http://localhost:3000/api/v1/admin/performance/cache-stats

# Via script
npx tsx scripts/test-cache-stats-endpoint.ts
```

### Monitor Logs

```bash
# Cache operations
grep "CacheLayer" logs/app.log

# Distributed invalidation
grep "CacheInvalidationPubSub" logs/app.log

# Cache monitoring
grep "CacheMonitoring" logs/app.log
```

### Key Metrics

- **Hit Rate**: Should be > 70%
- **Memory Usage**: Should be < 500MB
- **Response Time**: Should be < 50ms
- **Invalidation Latency**: Should be < 100ms

## Troubleshooting

### Cache Not Working

1. Check Redis connection:
```bash
redis-cli ping
```

2. Check environment variables:
```bash
echo $REDIS_URL
echo $UPSTASH_REDIS_REST_URL
```

3. Check cache health:
```typescript
const health = await cacheMonitoringService.getHealthStatus();
console.log(health);
```

### Low Hit Rate

1. Check TTL values (may be too short)
2. Verify cache warming is running
3. Check invalidation patterns (may be too broad)
4. Monitor cache memory (may be evicting too frequently)

### Invalidation Not Propagating

1. Check Redis pub/sub:
```bash
redis-cli PUBSUB CHANNELS
```

2. Check instance logs for subscription confirmation
3. Verify network connectivity to Redis
4. Check for firewall rules

### High Memory Usage

1. Check Redis memory:
```bash
redis-cli INFO memory
```

2. Review TTL values (may be too long)
3. Check for memory leaks in callbacks
4. Consider increasing Redis memory limit

## Configuration

### Environment Variables

```bash
# Redis connection
REDIS_URL=redis://localhost:6379

# Or Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

### Redis Configuration

```bash
# Memory limit
maxmemory 500mb

# Eviction policy
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
```

## Testing

### Unit Tests

```bash
npm test -- cache
```

### Integration Tests

```bash
npm test -- integration
```

### Distributed Cache Test

```bash
npx tsx scripts/test-distributed-cache.ts
```

### Load Tests

```bash
npm run test:load
```

## API Endpoints

### Cache Statistics

```
GET /api/v1/admin/performance/cache-stats
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "data": {
    "status": "healthy",
    "redis": {
      "connected": true,
      "memoryUsage": 104857600,
      "memoryLimit": 524288000
    },
    "performance": {
      "hitRate": 0.75,
      "avgResponseTime": 25,
      "totalHits": 1500,
      "totalMisses": 500
    },
    "alerts": []
  }
}
```

## Common Patterns

### Cache-Aside Pattern

```typescript
async function getData(key: string) {
  // Try cache
  let data = await cacheLayer.get(key);
  
  if (!data) {
    // Cache miss - load from database
    data = await database.query();
    
    // Store in cache
    await cacheLayer.set(key, data, 300);
  }
  
  return data;
}
```

### Write-Through Pattern

```typescript
async function updateData(key: string, data: any) {
  // Update database
  await database.update(data);
  
  // Update cache
  await cacheLayer.set(key, data, 300);
}
```

### Write-Behind Pattern

```typescript
async function updateData(key: string, data: any) {
  // Update cache immediately
  await cacheLayer.set(key, data, 300);
  
  // Queue database update
  await queue.add('update', { key, data });
}
```

## Resources

- [Distributed Cache Invalidation Guide](./DISTRIBUTED_CACHE_INVALIDATION.md)
- [Redis Configuration Guide](./REDIS_CONFIGURATION.md)
- [Performance Monitoring Guide](./PERFORMANCE_MONITORING.md)
- [Cache Layer README](../lib/services/cache-layer.README.md)
