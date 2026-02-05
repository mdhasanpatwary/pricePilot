---
title: "Cache Warming Strategies"
description: "Strategies for warming caches to improve performance"
category: "troubleshooting"
tags: ["cache", "performance", "optimization"]
audience: "tenant"
---

# Cache Warming Strategies

## Overview

Cache warming is the practice of proactively loading frequently accessed data into cache before user requests. This eliminates cold cache scenarios and ensures fast response times from the first request.

## Why Cache Warming?

### The Cold Cache Problem

Without cache warming:
```
User Request → Cache Miss → Database Query (500ms) → Cache Store → Response
```

With cache warming:
```
User Request → Cache Hit (25ms) → Response
```

### Benefits

- **Faster First Response**: No cold cache penalty
- **Reduced Database Load**: Fewer queries during peak times
- **Better User Experience**: Consistent fast response times
- **Predictable Performance**: No performance spikes on cache expiration

## Warming Strategies

### 1. On-Demand Warming

**When**: User triggers an action that will need data

**Example**: Warm cache on user login

```typescript
import { cacheWarmingService } from '@/lib/services/cache-warming';

app.post('/api/auth/login', async (req, res) => {
  const user = await authenticate(req.body);
  
  // Warm cache in background (don't block login)
  cacheWarmingService.warmOnLogin(user.tenantId).catch(err => {
    logger.error('Cache warming failed', { err });
  });
  
  res.json({ user });
});
```

**What gets warmed**:
- Active products (last 20)
- Dashboard analytics
- Recent comparisons
- User preferences

**Pros**:
- Warms exactly what user needs
- Triggered by actual usage
- No wasted warming

**Cons**:
- Slight delay after login
- Doesn't help first-time users
- Requires user action

### 2. Scheduled Warming

**When**: Off-peak hours (e.g., 2 AM daily)

**Example**: Cron job for daily warming

```typescript
// scripts/warm-cache.ts
import { cacheWarmingService } from '@/lib/services/cache-warming';

async function scheduledWarming() {
  console.log('Starting scheduled cache warming...');
  
  try {
    await cacheWarmingService.scheduledWarming();
    console.log('Cache warming completed successfully');
  } catch (error) {
    console.error('Cache warming failed:', error);
    process.exit(1);
  }
}

scheduledWarming();
```

**Cron configuration**:
```bash
# Run daily at 2 AM
0 2 * * * cd /app && npx tsx scripts/warm-cache.ts
```

**What gets warmed**:
- Top 100 products per tenant
- Popular comparisons
- Dashboard analytics
- Frequently accessed data

**Pros**:
- Warms cache before peak hours
- No impact on user requests
- Comprehensive warming

**Cons**:
- May warm unused data
- Requires scheduling infrastructure
- Fixed timing may not suit all timezones

### 3. Predictive Warming

**When**: Based on usage patterns and predictions

**Example**: Warm related data on comparison request

```typescript
async function getComparisonReport(tenantId: string, filters: any) {
  // Get comparison data
  const report = await comparisonService.getReport(tenantId, filters);
  
  // Predictively warm related competitor products
  const competitorIds = report.competitors.map(c => c.id);
  cacheWarmingService.warmCompetitorProducts(tenantId, competitorIds)
    .catch(err => logger.error('Predictive warming failed', { err }));
  
  return report;
}
```

**What gets warmed**:
- Related competitor products
- Similar comparisons
- Dependent analytics
- Likely next requests

**Pros**:
- Intelligent warming
- Improves subsequent requests
- Adapts to usage patterns

**Cons**:
- Complex to implement
- May warm wrong data
- Requires pattern analysis

### 4. Lazy Warming

**When**: On cache miss, warm related data

**Example**: Warm similar products on product request

```typescript
async function getProduct(tenantId: string, productId: string) {
  // Try cache
  let product = await cache.get(`${tenantId}:products:${productId}`);
  
  if (!product) {
    // Cache miss - fetch from database
    product = await db.product.findUnique({ where: { id: productId } });
    
    // Cache this product
    await cache.set(`${tenantId}:products:${productId}`, product, 300);
    
    // Lazy warm related products
    warmRelatedProducts(tenantId, product).catch(err => 
      logger.error('Lazy warming failed', { err })
    );
  }
  
  return product;
}

async function warmRelatedProducts(tenantId: string, product: any) {
  // Find related products (same brand, category, etc.)
  const related = await db.product.findMany({
    where: {
      tenantId,
      brand: product.brand,
      id: { not: product.id }
    },
    take: 10
  });
  
  // Warm cache for related products
  await Promise.all(
    related.map(p => 
      cache.set(`${tenantId}:products:${p.id}`, p, 300)
    )
  );
}
```

**What gets warmed**:
- Related products
- Similar data
- Likely next requests
- Dependent data

**Pros**:
- Warms based on actual usage
- No wasted warming
- Improves subsequent requests

**Cons**:
- Doesn't help first request
- May warm too much
- Adds latency to cache miss

## PricePilot Warming Implementation

### WarmOnLogin

Warms essential data when user logs in:

```typescript
async warmOnLogin(tenantId: string): Promise<void> {
  try {
    await Promise.all([
      this.warmDashboardData(tenantId),
      this.warmRecentProducts(tenantId, 20),
      this.warmRecentComparisons(tenantId, 10)
    ]);
    
    logger.info('Login cache warming completed', { tenantId });
  } catch (error) {
    logger.error('Login cache warming failed', { tenantId, error });
    // Don't throw - warming failure shouldn't block login
  }
}
```

**Warms**:
- Dashboard analytics
- Last 20 active products
- Last 10 comparisons
- User preferences

**Timing**: ~500ms (background, doesn't block login)

### WarmDashboardData

Warms data needed for dashboard:

```typescript
async warmDashboardData(tenantId: string): Promise<void> {
  // Compute dashboard analytics
  const analytics = await this.computeDashboardAnalytics(tenantId);
  
  // Cache for 10 minutes
  await this.cacheService.cacheAnalytics(
    tenantId, 
    'dashboard', 
    analytics, 
    600
  );
}
```

**Warms**:
- Product count
- Comparison summary
- Price statistics
- Recent activity

**Timing**: ~200ms

### WarmTenantCache

Comprehensive warming for a tenant:

```typescript
async warmTenantCache(tenantId: string): Promise<void> {
  // Get active products
  const products = await this.db.userProduct.findMany({
    where: { tenantId, status: 'active' },
    take: 100,
    orderBy: { lastSyncAt: 'desc' }
  });
  
  // Warm product caches
  await Promise.all(
    products.map(p => 
      this.cacheService.cacheProduct(tenantId, p.id, p)
    )
  );
  
  // Warm comparisons
  await this.warmRecentComparisons(tenantId);
  
  // Warm analytics
  await this.warmDashboardData(tenantId);
}
```

**Warms**:
- Top 100 active products
- Recent comparisons
- Dashboard analytics
- Price history

**Timing**: ~2-5 seconds

### ScheduledWarming

Daily warming for all active tenants:

```typescript
async scheduledWarming(): Promise<void> {
  const tenants = await this.getActiveTenants();
  
  logger.info('Starting scheduled warming', { tenantCount: tenants.length });
  
  for (const tenant of tenants) {
    try {
      await this.warmTenantCache(tenant.id);
      logger.info('Tenant cache warmed', { tenantId: tenant.id });
    } catch (error) {
      logger.error('Tenant warming failed', { tenantId: tenant.id, error });
      // Continue with next tenant
    }
  }
  
  logger.info('Scheduled warming completed');
}
```

**Warms**:
- All active tenants
- Top products per tenant
- Recent data per tenant

**Timing**: ~30-60 seconds per tenant

## Best Practices

### 1. Don't Block User Requests

```typescript
// Good: Fire and forget
cacheWarmingService.warmOnLogin(tenantId).catch(err => 
  logger.error('Warming failed', { err })
);
res.json({ user });

// Bad: Blocks login
await cacheWarmingService.warmOnLogin(tenantId);
res.json({ user });
```

### 2. Warm Most Valuable Data First

```typescript
async warmTenantCache(tenantId: string) {
  // Warm in priority order
  await this.warmDashboardData(tenantId);        // High priority
  await this.warmRecentProducts(tenantId, 20);   // Medium priority
  await this.warmAllProducts(tenantId);          // Low priority
}
```

### 3. Set Appropriate TTLs

```typescript
// Frequently accessed - longer TTL
await cache.set(key, dashboardData, 1800); // 30 minutes

// Less frequently accessed - shorter TTL
await cache.set(key, productData, 300); // 5 minutes
```

### 4. Handle Warming Failures Gracefully

```typescript
async warmCache(tenantId: string) {
  try {
    await this.warmProducts(tenantId);
  } catch (error) {
    logger.error('Product warming failed', { error });
    // Continue with other warming tasks
  }
  
  try {
    await this.warmAnalytics(tenantId);
  } catch (error) {
    logger.error('Analytics warming failed', { error });
  }
}
```

### 5. Monitor Warming Performance

```typescript
async warmWithMetrics(tenantId: string) {
  const startTime = Date.now();
  
  try {
    await this.warmTenantCache(tenantId);
    const duration = Date.now() - startTime;
    
    logger.info('Cache warming completed', { tenantId, duration });
    
    if (duration > 5000) {
      logger.warn('Slow cache warming', { tenantId, duration });
    }
  } catch (error) {
    logger.error('Cache warming failed', { tenantId, error });
  }
}
```

### 6. Avoid Over-Warming

```typescript
// Good: Warm top 100 products
const products = await db.product.findMany({ take: 100 });

// Bad: Warm all products (may be thousands)
const products = await db.product.findMany();
```

### 7. Use Batch Operations

```typescript
// Good: Batch warming
await Promise.all(
  products.map(p => cache.set(`product:${p.id}`, p, 300))
);

// Bad: Sequential warming
for (const product of products) {
  await cache.set(`product:${product.id}`, product, 300);
}
```

## Warming Patterns

### Progressive Warming

Warm data in stages based on priority:

```typescript
async progressiveWarming(tenantId: string) {
  // Stage 1: Critical data (immediate)
  await this.warmDashboardData(tenantId);
  
  // Stage 2: Important data (after 1 second)
  await sleep(1000);
  await this.warmRecentProducts(tenantId, 20);
  
  // Stage 3: Nice-to-have data (after 5 seconds)
  await sleep(4000);
  await this.warmAllProducts(tenantId);
}
```

### Selective Warming

Warm only what's likely to be accessed:

```typescript
async selectiveWarming(tenantId: string) {
  // Get user's access patterns
  const patterns = await this.getAccessPatterns(tenantId);
  
  // Warm only frequently accessed data
  if (patterns.viewsDashboard) {
    await this.warmDashboardData(tenantId);
  }
  
  if (patterns.viewsComparisons) {
    await this.warmRecentComparisons(tenantId);
  }
  
  if (patterns.viewsProducts) {
    await this.warmRecentProducts(tenantId, 50);
  }
}
```

### Adaptive Warming

Adjust warming based on cache hit rates:

```typescript
async adaptiveWarming(tenantId: string) {
  const stats = await cache.getStats(tenantId);
  
  // If hit rate is low, warm more aggressively
  if (stats.hitRate < 0.6) {
    await this.warmTenantCache(tenantId);
  }
  
  // If hit rate is high, warm less
  else if (stats.hitRate > 0.8) {
    await this.warmDashboardData(tenantId);
  }
}
```

## Monitoring Warming

### Track Warming Metrics

```typescript
class WarmingMetrics {
  private metrics = {
    totalWarmings: 0,
    successfulWarmings: 0,
    failedWarmings: 0,
    avgDuration: 0,
    itemsWarmed: 0
  };
  
  async warmWithTracking(tenantId: string) {
    const startTime = Date.now();
    this.metrics.totalWarmings++;
    
    try {
      const count = await this.warmTenantCache(tenantId);
      this.metrics.successfulWarmings++;
      this.metrics.itemsWarmed += count;
      
      const duration = Date.now() - startTime;
      this.metrics.avgDuration = 
        (this.metrics.avgDuration * (this.metrics.totalWarmings - 1) + duration) 
        / this.metrics.totalWarmings;
      
      return count;
    } catch (error) {
      this.metrics.failedWarmings++;
      throw error;
    }
  }
}
```

### Alert on Warming Issues

```typescript
async warmWithAlerts(tenantId: string) {
  const startTime = Date.now();
  
  try {
    await this.warmTenantCache(tenantId);
    const duration = Date.now() - startTime;
    
    // Alert if slow
    if (duration > 10000) {
      await alerting.warn('Slow cache warming', { tenantId, duration });
    }
  } catch (error) {
    await alerting.error('Cache warming failed', { tenantId, error });
  }
}
```

## Testing Warming

### Unit Tests

```typescript
describe('Cache Warming', () => {
  it('should warm dashboard data', async () => {
    await cacheWarmingService.warmDashboardData(tenantId);
    
    const cached = await cache.get(`${tenantId}:analytics:dashboard`);
    expect(cached).not.toBeNull();
    expect(cached).toHaveProperty('productCount');
  });
  
  it('should not block on warming failure', async () => {
    // Mock warming to fail
    jest.spyOn(cache, 'set').mockRejectedValue(new Error('Cache error'));
    
    // Should not throw
    await expect(
      cacheWarmingService.warmOnLogin(tenantId)
    ).resolves.not.toThrow();
  });
});
```

### Integration Tests

```typescript
describe('Cache Warming Integration', () => {
  it('should warm cache on login', async () => {
    // Login
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    
    // Wait for warming
    await sleep(1000);
    
    // Verify cache warmed
    const cached = await cache.get(`${tenantId}:analytics:dashboard`);
    expect(cached).not.toBeNull();
  });
});
```

## Troubleshooting

### Problem: Warming Too Slow

**Symptoms**: Warming takes >10 seconds

**Solutions**:
1. Reduce items warmed
2. Use batch operations
3. Warm in parallel
4. Optimize database queries

### Problem: Warming Failures

**Symptoms**: Frequent warming errors

**Solutions**:
1. Check Redis connectivity
2. Verify database access
3. Add retry logic
4. Improve error handling

### Problem: Over-Warming

**Symptoms**: High memory usage, low hit rate

**Solutions**:
1. Reduce warming scope
2. Use selective warming
3. Adjust TTLs
4. Monitor access patterns

## Related Documentation

- [Cache Configuration Guide](./CACHE_CONFIGURATION.md)
- [Cache Invalidation Patterns](./CACHE_INVALIDATION_PATTERNS.md)
- [Cache Monitoring Guide](./CACHE_MONITORING.md)
- [Cache Troubleshooting Guide](./CACHE_TROUBLESHOOTING.md)
