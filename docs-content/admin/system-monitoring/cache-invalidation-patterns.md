---
title: "Cache Invalidation Patterns"
description: "Patterns and strategies for cache invalidation"
category: "system-monitoring"
tags: ["cache", "invalidation", "patterns"]
audience: "admin"
---

# Cache Invalidation Patterns

## Overview

Cache invalidation is one of the hardest problems in computer science. This guide documents PricePilot's cache invalidation patterns, strategies, and best practices to ensure data consistency while maintaining performance.

## Core Principle

> "There are only two hard things in Computer Science: cache invalidation and naming things." - Phil Karlton

PricePilot follows the principle: **Invalidate early, invalidate specifically, invalidate automatically**.

## Invalidation Strategies

### 1. Time-Based Invalidation (TTL)

**When to use**: Data that changes predictably or can tolerate staleness

**How it works**: Cache entries expire automatically after a set time period

**Example**:
```typescript
// Product prices change frequently - short TTL
await cache.set('tenant:123:product:456', product, 300); // 5 minutes

// Historical data rarely changes - long TTL
await cache.set('tenant:123:history:456', history, 3600); // 1 hour
```

**Pros**:
- Simple to implement
- No manual invalidation needed
- Predictable memory usage

**Cons**:
- May serve stale data
- Doesn't respond to immediate changes
- Wastes cache space if data changes before TTL

### 2. Event-Based Invalidation

**When to use**: Data that changes unpredictably and must be fresh

**How it works**: Invalidate cache when underlying data changes

**Example**:
```typescript
// After price update
async function updatePrice(productId: string, newPrice: number) {
  // Update database
  await db.product.update({ where: { id: productId }, data: { price: newPrice } });
  
  // Invalidate affected caches
  await cacheInvalidationService.onPriceUpdate(tenantId, [productId]);
}
```

**Pros**:
- Always serves fresh data
- Responds immediately to changes
- Efficient cache usage

**Cons**:
- Requires integration with data modification code
- More complex to implement
- Risk of missing invalidation points

### 3. Pattern-Based Invalidation

**When to use**: Multiple related cache entries need invalidation

**How it works**: Use wildcard patterns to invalidate groups of keys

**Example**:
```typescript
// Invalidate all product caches for a tenant
await cache.invalidate('tenant:123:products:*');

// Invalidate all comparison caches
await cache.invalidate('tenant:123:comparison:*');

// Invalidate specific product across all operations
await cache.invalidate('tenant:123:*:product:456');
```

**Pros**:
- Invalidates related data together
- Simpler than individual key invalidation
- Handles unknown cache keys

**Cons**:
- May invalidate more than necessary
- Slower than specific key invalidation
- Requires careful pattern design

### 4. Dependency-Based Invalidation

**When to use**: Cache entries depend on other data

**How it works**: Track dependencies and invalidate cascading caches

**Example**:
```typescript
// Price update affects multiple caches
async onPriceUpdate(tenantId: string, productIds: string[]) {
  await Promise.all([
    // Invalidate product caches
    ...productIds.map(id => this.invalidateProduct(tenantId, id)),
    
    // Invalidate dependent caches
    this.invalidateComparisons(tenantId),
    this.invalidatePriceHistory(tenantId),
    this.invalidateAnalytics(tenantId)
  ]);
}
```

**Pros**:
- Maintains data consistency
- Handles complex relationships
- Prevents stale dependent data

**Cons**:
- Complex dependency tracking
- May over-invalidate
- Performance impact on writes

## PricePilot Invalidation Patterns

### Product Updates

**Trigger**: Product data changes (price, name, status, etc.)

**Invalidation**:
```typescript
await cacheInvalidationService.onPriceUpdate(tenantId, [productId]);

// Invalidates:
// - tenant:123:products:get:productId
// - tenant:123:comparison:*
// - tenant:123:priceHistory:productId
// - tenant:123:analytics:*
```

**Why**: Product changes affect comparisons, history, and analytics

### Product Sync

**Trigger**: Bulk product synchronization from user's website

**Invalidation**:
```typescript
await cacheInvalidationService.onProductSync(tenantId);

// Invalidates:
// - tenant:123:products:*
// - tenant:123:comparison:*
// - tenant:123:matching:*
// - tenant:123:analytics:*
```

**Why**: Sync may add/update/remove products, affecting all product-related caches

### Match Updates

**Trigger**: Product matching created or updated

**Invalidation**:
```typescript
await cacheInvalidationService.onMatchUpdate(tenantId, productId);

// Invalidates:
// - tenant:123:matching:findMatches:productId
// - tenant:123:comparison:*
// - tenant:123:products:get:productId
```

**Why**: Matches affect comparisons and product details

### Competitor Scrape

**Trigger**: Competitor product data scraped

**Invalidation**:
```typescript
await cacheInvalidationService.onCompetitorScrape(tenantId, competitorId);

// Invalidates:
// - tenant:123:competitors:competitorId:*
// - tenant:123:comparison:*
```

**Why**: New competitor data affects all comparisons

### Manual Invalidation

**Trigger**: Admin or system maintenance

**Invalidation**:
```typescript
// Invalidate all caches for a tenant
await cacheEnhancedService.invalidateAll(tenantId);

// Invalidate specific cache type
await cacheEnhancedService.invalidateComparisons(tenantId);
await cacheEnhancedService.invalidateAnalytics(tenantId);
```

**Why**: Maintenance, debugging, or data corrections

## Implementation Examples

### Basic Invalidation

```typescript
import { cacheLayer } from '@/lib/services/cache-layer';

// Invalidate specific key
await cacheLayer.del('tenant:123:products:get:456');

// Invalidate by pattern (distributed)
await cacheLayer.invalidate('tenant:123:products:*');
```

### Service-Level Invalidation

```typescript
import { cacheEnhancedService } from '@/lib/services/cache-enhanced';

// Invalidate product
await cacheEnhancedService.invalidateProduct(tenantId, productId);

// Invalidate all comparisons
await cacheEnhancedService.invalidateComparisons(tenantId);

// Invalidate all matches
await cacheEnhancedService.invalidateMatches(tenantId);
```

### Automatic Invalidation

```typescript
// In API route
app.post('/api/v1/products/:id/price', async (req, res) => {
  const { id } = req.params;
  const { price } = req.body;
  
  // Update database
  await db.product.update({ where: { id }, data: { price } });
  
  // Automatic invalidation
  await cacheInvalidationService.onPriceUpdate(req.user.tenantId, [id]);
  
  res.json({ success: true });
});
```

### Batch Invalidation

```typescript
// Invalidate multiple products efficiently
async function invalidateProducts(tenantId: string, productIds: string[]) {
  // Build patterns
  const patterns = productIds.map(id => `${tenantId}:products:*:${id}`);
  
  // Batch invalidate
  await Promise.all(patterns.map(p => cache.invalidate(p)));
  
  // Also invalidate dependent caches
  await cache.invalidate(`${tenantId}:comparison:*`);
}
```

## Distributed Invalidation

PricePilot uses Redis pub/sub for distributed cache invalidation across multiple instances.

### How It Works

```
Instance 1                    Redis Pub/Sub                Instance 2
    │                              │                            │
    │  1. Invalidate local cache   │                            │
    ├──────────────────────────────┤                            │
    │                              │                            │
    │  2. Publish event            │                            │
    ├─────────────────────────────>│                            │
    │                              │                            │
    │                              │  3. Broadcast event        │
    │                              ├───────────────────────────>│
    │                              │                            │
    │                              │  4. Invalidate local cache │
    │                              │<───────────────────────────┤
```

### Example

```typescript
// On Instance 1
await cacheLayer.invalidate('tenant:123:products:*');

// Automatically propagates to Instance 2, 3, etc.
// All instances invalidate their local caches
```

See [Distributed Cache Invalidation Guide](./DISTRIBUTED_CACHE_INVALIDATION.md) for details.

## Best Practices

### 1. Invalidate Specifically

```typescript
// Good: Specific invalidation
await cache.invalidate('tenant:123:products:get:456');

// Less efficient: Broad invalidation
await cache.invalidate('tenant:123:*');
```

### 2. Invalidate Early

```typescript
// Good: Invalidate immediately after update
await db.update(data);
await cache.invalidate(key);

// Bad: Delayed invalidation
await db.update(data);
setTimeout(() => cache.invalidate(key), 5000); // May serve stale data
```

### 3. Handle Invalidation Failures

```typescript
try {
  await cache.invalidate(pattern);
} catch (error) {
  logger.error('Cache invalidation failed', { error, pattern });
  // Don't throw - stale cache is better than broken app
}
```

### 4. Use Dependency Tracking

```typescript
// Track what caches depend on what data
const DEPENDENCIES = {
  product: ['products', 'comparison', 'analytics'],
  match: ['matching', 'comparison'],
  competitor: ['competitors', 'comparison']
};

async function invalidateDependencies(type: string, tenantId: string) {
  const deps = DEPENDENCIES[type] || [];
  await Promise.all(deps.map(d => cache.invalidate(`${tenantId}:${d}:*`)));
}
```

### 5. Log Invalidations

```typescript
async function invalidateWithLogging(pattern: string) {
  const startTime = Date.now();
  const count = await cache.invalidate(pattern);
  const duration = Date.now() - startTime;
  
  logger.info('Cache invalidated', { pattern, count, duration });
  
  return count;
}
```

### 6. Test Invalidation

```typescript
describe('Cache Invalidation', () => {
  it('should invalidate product cache on price update', async () => {
    // Cache product
    await cache.set('tenant:123:products:get:456', product);
    
    // Update price
    await updatePrice('456', 99.99);
    
    // Verify cache invalidated
    const cached = await cache.get('tenant:123:products:get:456');
    expect(cached).toBeNull();
  });
});
```

## Common Patterns

### Write-Through Invalidation

Update cache immediately after database write:

```typescript
async function updateProduct(id: string, data: any) {
  // Update database
  const updated = await db.product.update({ where: { id }, data });
  
  // Update cache
  await cache.set(`tenant:${tenantId}:products:get:${id}`, updated, 300);
  
  return updated;
}
```

### Write-Behind Invalidation

Invalidate cache, update database asynchronously:

```typescript
async function updateProduct(id: string, data: any) {
  // Invalidate cache immediately
  await cache.invalidate(`tenant:${tenantId}:products:*:${id}`);
  
  // Queue database update
  await queue.add('updateProduct', { id, data });
}
```

### Lazy Invalidation

Invalidate on next read if data is stale:

```typescript
async function getProduct(id: string) {
  const cached = await cache.get(`tenant:${tenantId}:products:get:${id}`);
  
  if (cached) {
    // Check if stale
    if (await isStale(cached)) {
      await cache.del(`tenant:${tenantId}:products:get:${id}`);
      return await fetchFresh(id);
    }
    return cached;
  }
  
  return await fetchFresh(id);
}
```

### Cascading Invalidation

Invalidate dependent caches automatically:

```typescript
async function invalidateWithCascade(key: string) {
  // Invalidate primary key
  await cache.del(key);
  
  // Find and invalidate dependent keys
  const dependents = await findDependentKeys(key);
  await Promise.all(dependents.map(k => cache.del(k)));
}
```

## Anti-Patterns

### ❌ Over-Invalidation

```typescript
// Bad: Invalidates too much
await cache.invalidate('tenant:123:*');

// Good: Specific invalidation
await cache.invalidate('tenant:123:products:get:456');
```

### ❌ Under-Invalidation

```typescript
// Bad: Doesn't invalidate dependent caches
await cache.del('tenant:123:products:get:456');

// Good: Invalidates dependencies
await cacheInvalidationService.onPriceUpdate(tenantId, ['456']);
```

### ❌ Synchronous Invalidation Blocking

```typescript
// Bad: Blocks request
await cache.invalidate('tenant:123:*');
res.json({ success: true });

// Good: Fire and forget
cache.invalidate('tenant:123:*').catch(err => logger.error(err));
res.json({ success: true });
```

### ❌ Missing Error Handling

```typescript
// Bad: Throws on invalidation failure
await cache.invalidate(pattern);

// Good: Handles errors gracefully
try {
  await cache.invalidate(pattern);
} catch (error) {
  logger.error('Invalidation failed', { error });
}
```

### ❌ No Logging

```typescript
// Bad: Silent invalidation
await cache.invalidate(pattern);

// Good: Logged invalidation
logger.info('Invalidating cache', { pattern });
await cache.invalidate(pattern);
```

## Monitoring Invalidation

### Track Invalidation Metrics

```typescript
class InvalidationMetrics {
  private metrics = {
    total: 0,
    byPattern: new Map<string, number>(),
    failures: 0
  };
  
  async invalidate(pattern: string) {
    try {
      const count = await cache.invalidate(pattern);
      this.metrics.total += count;
      this.metrics.byPattern.set(pattern, 
        (this.metrics.byPattern.get(pattern) || 0) + count
      );
      return count;
    } catch (error) {
      this.metrics.failures++;
      throw error;
    }
  }
  
  getMetrics() {
    return this.metrics;
  }
}
```

### Alert on Invalidation Issues

```typescript
async function invalidateWithAlert(pattern: string) {
  const startTime = Date.now();
  
  try {
    const count = await cache.invalidate(pattern);
    const duration = Date.now() - startTime;
    
    // Alert if slow
    if (duration > 1000) {
      await alerting.warn('Slow cache invalidation', { pattern, duration });
    }
    
    // Alert if too many keys
    if (count > 10000) {
      await alerting.warn('Large cache invalidation', { pattern, count });
    }
    
    return count;
  } catch (error) {
    await alerting.error('Cache invalidation failed', { pattern, error });
    throw error;
  }
}
```

## Testing Invalidation

### Unit Tests

```typescript
describe('Cache Invalidation', () => {
  it('should invalidate by pattern', async () => {
    await cache.set('tenant:123:products:1', { id: 1 });
    await cache.set('tenant:123:products:2', { id: 2 });
    
    await cache.invalidate('tenant:123:products:*');
    
    expect(await cache.get('tenant:123:products:1')).toBeNull();
    expect(await cache.get('tenant:123:products:2')).toBeNull();
  });
  
  it('should not invalidate other tenants', async () => {
    await cache.set('tenant:123:products:1', { id: 1 });
    await cache.set('tenant:456:products:1', { id: 1 });
    
    await cache.invalidate('tenant:123:*');
    
    expect(await cache.get('tenant:123:products:1')).toBeNull();
    expect(await cache.get('tenant:456:products:1')).not.toBeNull();
  });
});
```

### Integration Tests

```typescript
describe('Distributed Invalidation', () => {
  it('should propagate invalidation across instances', async () => {
    // Set cache on instance 1
    await instance1.cache.set('key', 'value');
    
    // Invalidate on instance 2
    await instance2.cache.invalidate('key');
    
    // Wait for propagation
    await sleep(100);
    
    // Verify invalidated on instance 1
    expect(await instance1.cache.get('key')).toBeNull();
  });
});
```

## Troubleshooting

### Problem: Cache Not Invalidating

**Check**:
1. Verify invalidation is being called
2. Check pattern matches cache keys
3. Verify distributed invalidation is working
4. Check Redis connectivity

**Solution**:
```bash
# Test invalidation manually
redis-cli KEYS "tenant:123:products:*"
redis-cli DEL "tenant:123:products:*"
```

### Problem: Over-Invalidation

**Check**:
1. Review invalidation patterns
2. Check for wildcard overuse
3. Monitor invalidation frequency

**Solution**:
- Use more specific patterns
- Implement dependency tracking
- Add invalidation logging

### Problem: Stale Data After Invalidation

**Check**:
1. Verify invalidation completed
2. Check for race conditions
3. Verify distributed propagation

**Solution**:
- Add delays after invalidation
- Use write-through caching
- Implement versioning

## Related Documentation

- [Cache Configuration Guide](./CACHE_CONFIGURATION.md)
- [Distributed Cache Invalidation](./DISTRIBUTED_CACHE_INVALIDATION.md)
- [Cache Warming Strategies](./CACHE_WARMING_STRATEGIES.md)
- [Cache Monitoring Guide](./CACHE_MONITORING.md)
- [Cache Troubleshooting Guide](./CACHE_TROUBLESHOOTING.md)
