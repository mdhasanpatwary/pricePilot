---
title: "Cache Configuration"
description: "Cache configuration and optimization"
category: "troubleshooting"
tags: ["cache", "configuration", "performance"]
audience: "tenant"
relatedDocs: ["/admin-docs/performance/cache-configuration.md"]
---

> **Note:** This is a simplified version for tenants. For technical details, administrators can refer to the [admin documentation](/admin-docs/performance/cache-configuration.md).

# Cache Configuration Guide

## Overview

PricePilot uses a multi-layered caching strategy with Redis (Upstash) to improve performance, reduce database load, and enhance user experience. This guide covers complete cache configuration, from basic setup to advanced optimization.

## Quick Start

### 1. Environment Setup

Add to your `.env` file:

```bash
# Redis Cache Configuration (Upstash)
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token-here"

# Redis Memory Configuration
REDIS_MEMORY_LIMIT_MB=500
REDIS_MEMORY_ALERT_THRESHOLD=0.8

# Cache Configuration (Optional - defaults shown)
CACHE_DEFAULT_TTL=300
CACHE_ENABLED=true
```

### 2. Verify Setup

```bash
# Test Redis connectivity
npx tsx scripts/verify-redis-simple.ts

# Verify memory configuration
npx tsx scripts/verify-redis-memory-config.ts

# Test cache operations
npx tsx scripts/test-cache-stats-endpoint.ts
```

### 3. Initialize Distributed Caching

Distributed caching is automatically initialized on application startup via `instrumentation.ts`:

```typescript
// instrumentation.ts
import { initializeDistributedCache } from '@/lib/services/cache-initialization';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await initializeDistributedCache();
  }
}
```

## Architecture

### Cache Layers

PricePilot implements a three-tier caching architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ API Routes   │  │ Services     │  │ Components   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Cache Enhanced Service Layer                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Product Cache │ Comparison Cache │ Matching Cache     │ │
│  │  Analytics Cache │ Price History Cache                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
          │                                      │
          ▼                                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      Cache Layer                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Tenant Isolation │ Stats │ Warming │ Invalidation    │ │
│  │  Distributed Pub/Sub │ Monitoring │ Error Handling    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
          │                                      │
          ▼                                      ▼
┌──────────────────────┐            ┌──────────────────────┐
│   Upstash Redis      │            │   PostgreSQL DB      │
│   (Cache Store)      │            │   (Source of Truth)  │
└──────────────────────┘            └──────────────────────┘
```

### Cache Services

#### 1. CacheService (Basic)
**Location**: `lib/services/cache.ts`

Basic Redis operations using Upstash REST API:
- Simple get/set/delete operations
- Connection management
- Error handling

#### 2. CacheLayer (Advanced)
**Location**: `lib/services/cache-layer.ts`

Advanced caching with enterprise features:
- Tenant isolation
- Statistics tracking
- Pattern-based invalidation
- Cache warming
- Distributed invalidation via pub/sub

#### 3. CacheEnhancedService (Application-Specific)
**Location**: `lib/services/cache-enhanced.ts`

Application-specific caching methods:
- Product caching
- Comparison caching
- Matching caching
- Competitor product caching
- Price history caching
- Analytics caching

## Configuration Options

### TTL Configuration

Default Time-To-Live values for different data types:

```typescript
// lib/services/cache-enhanced.ts
const DEFAULT_TTLS = {
  products: 300,              // 5 minutes
  comparisons: 300,           // 5 minutes
  matches: 900,               // 15 minutes
  competitorProducts: 1800,   // 30 minutes
  priceHistory: 3600,         // 1 hour
  analytics: 600,             // 10 minutes
  apiResponses: {
    productList: 120,         // 2 minutes
    comparisonReport: 300,    // 5 minutes
    competitorProducts: 600   // 10 minutes
  }
};
```

**Customizing TTLs**:

```typescript
// Override default TTL
await cacheEnhancedService.cacheProduct(
  tenantId, 
  productId, 
  data, 
  600  // Custom 10-minute TTL
);

// Use default TTL
await cacheEnhancedService.cacheProduct(
  tenantId, 
  productId, 
  data
);
```

### Memory Configuration

**Memory Limit**: 500MB (configurable in Upstash dashboard)
**Eviction Policy**: allkeys-lru (Least Recently Used)

See [Redis Memory Configuration Guide](./REDIS_MEMORY_CONFIGURATION.md) for details.

### Tenant Isolation

All cache keys include tenant ID for complete isolation:

```typescript
// Cache key format
{tenantId}:{service}:{operation}:{params_hash}

// Examples
tenant_123:products:get:abc123
tenant_456:comparison:report:xyz789
tenant_789:matching:findMatches:def456
```

**Benefits**:
- No cross-tenant data leakage
- Tenant-scoped invalidation
- Independent cache management per tenant
- Security compliance

## Usage Examples

### Basic Caching

```typescript
import { cacheLayer } from '@/lib/services/cache-layer';

// Set cache with TTL
await cacheLayer.set('my-key', { data: 'value' }, 300);

// Get from cache
const value = await cacheLayer.get('my-key');

// Delete from cache
await cacheLayer.del('my-key');

// Invalidate by pattern (distributed)
await cacheLayer.invalidate('tenant_123:products:*');
```

### Application-Specific Caching

```typescript
import { cacheEnhancedService } from '@/lib/services/cache-enhanced';

// Cache product
await cacheEnhancedService.cacheProduct(tenantId, productId, productData);

// Get cached product
const product = await cacheEnhancedService.getCachedProduct(tenantId, productId);

// Cache comparison
await cacheEnhancedService.cacheComparison(tenantId, filters, comparisonData);

// Get cached comparison
const comparison = await cacheEnhancedService.getCachedComparison(tenantId, filters);

// Invalidate product cache
await cacheEnhancedService.invalidateProduct(tenantId, productId);
```

### Service Integration

```typescript
// In MatchingService
import { cacheEnhancedService } from '@/lib/services/cache-enhanced';

async findMatches(tenantId: string, productId: string) {
  // Try cache first
  const cached = await cacheEnhancedService.getCachedMatches(tenantId, productId);
  if (cached) return cached;
  
  // Cache miss - compute matches
  const matches = await this.computeMatches(tenantId, productId);
  
  // Store in cache
  await cacheEnhancedService.cacheMatches(tenantId, productId, matches);
  
  return matches;
}
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

// Warm on user login
await cacheWarmingService.warmOnLogin(tenantId);

// Warm dashboard data
await cacheWarmingService.warmDashboardData(tenantId);

// Warm entire tenant cache
await cacheWarmingService.warmTenantCache(tenantId);

// Scheduled warming (cron job)
await cacheWarmingService.scheduledWarming();
```

## Performance Targets

### Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cache Hit Rate | >70% | Hits / (Hits + Misses) |
| Response Time (cached) | <50ms | p95 latency |
| Response Time (uncached) | <500ms | p95 latency |
| Database Load Reduction | >60% | Queries per second |
| Memory Usage | <500MB | Redis memory |

### Monitoring

```typescript
import { cacheMonitoringService } from '@/lib/services/cache-monitoring';

// Get health status
const health = await cacheMonitoringService.getHealthStatus();

console.log({
  status: health.status,
  hitRate: health.performance?.hitRate,
  memoryUsage: health.redis?.memoryUsage,
  alerts: health.alerts
});

// Log statistics
await cacheMonitoringService.logStats();
```

### API Endpoint

```bash
# Get cache statistics
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/v1/admin/performance/cache-stats

# Response
{
  "success": true,
  "data": {
    "status": "healthy",
    "redis": {
      "connected": true,
      "memoryUsage": 104857600,
      "memoryLimit": 524288000,
      "memoryUsagePercent": 20
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

## Best Practices

### 1. Always Use Tenant Isolation

```typescript
// Good: Tenant-scoped key
const key = `${tenantId}:products:${productId}`;

// Bad: Global key (security risk)
const key = `products:${productId}`;
```

### 2. Set Appropriate TTLs

```typescript
// Frequently changing data - short TTL
await cache.set(key, data, 300); // 5 minutes

// Stable data - longer TTL
await cache.set(key, data, 3600); // 1 hour

// Historical data - very long TTL
await cache.set(key, data, 86400); // 24 hours
```

### 3. Invalidate on Updates

```typescript
// After updating data
await database.update(productId, newData);

// Invalidate affected caches
await cacheInvalidationService.onPriceUpdate(tenantId, [productId]);
```

### 4. Handle Cache Failures Gracefully

```typescript
async function getData(key: string) {
  try {
    const cached = await cache.get(key);
    if (cached) return cached;
  } catch (error) {
    logger.error('Cache error, falling back to database', { error });
  }
  
  // Cache miss or error - query database
  return await database.query();
}
```

### 5. Use Specific Invalidation Patterns

```typescript
// Good: Specific pattern
await cache.invalidate('tenant_123:products:get:abc123');

// Less efficient: Broad wildcard
await cache.invalidate('tenant_123:*');
```

### 6. Implement Cache Warming

```typescript
// Warm cache on login
app.post('/api/auth/login', async (req, res) => {
  const user = await authenticate(req.body);
  
  // Warm cache in background (don't block login)
  cacheWarmingService.warmOnLogin(user.tenantId).catch(err => {
    logger.error('Cache warming failed', { err });
  });
  
  res.json({ user });
});
```

### 7. Monitor Performance

```typescript
// Track cache operations
const startTime = Date.now();
const data = await cache.get(key);
const duration = Date.now() - startTime;

if (duration > 100) {
  logger.warn('Slow cache operation', { key, duration });
}
```

## Advanced Configuration

### Custom Cache Service

Create custom cache services for specific use cases:

```typescript
import { CacheLayer } from '@/lib/services/cache-layer';

class CustomCacheService {
  private cache: CacheLayer;
  
  constructor() {
    this.cache = CacheLayer.getInstance();
  }
  
  async cacheCustomData(tenantId: string, data: any) {
    const key = `${tenantId}:custom:${data.id}`;
    await this.cache.set(key, data, 600); // 10 min TTL
  }
  
  async getCachedCustomData(tenantId: string, id: string) {
    const key = `${tenantId}:custom:${id}`;
    return await this.cache.get(key);
  }
}
```

### Conditional Caching

Cache based on conditions:

```typescript
async function getProducts(tenantId: string, filters: any) {
  // Only cache if no complex filters
  const shouldCache = !filters.search && !filters.customFilter;
  
  if (shouldCache) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }
  
  const products = await database.query(filters);
  
  if (shouldCache) {
    await cache.set(cacheKey, products, 300);
  }
  
  return products;
}
```

### Tiered TTL Strategy

Different TTLs based on data characteristics:

```typescript
function getTTL(dataType: string, importance: 'high' | 'medium' | 'low') {
  const ttlMatrix = {
    products: { high: 600, medium: 300, low: 120 },
    analytics: { high: 1800, medium: 600, low: 300 },
    history: { high: 7200, medium: 3600, low: 1800 }
  };
  
  return ttlMatrix[dataType]?.[importance] || 300;
}

// Usage
const ttl = getTTL('products', 'high');
await cache.set(key, data, ttl);
```

## Troubleshooting

See [Cache Troubleshooting Guide](./CACHE_TROUBLESHOOTING.md) for detailed troubleshooting steps.

### Quick Checks

```bash
# 1. Verify Redis connection
npx tsx scripts/verify-redis-simple.ts

# 2. Check cache health
curl http://localhost:3000/api/v1/admin/performance/cache-stats

# 3. Test distributed invalidation
npx tsx scripts/test-distributed-cache.ts

# 4. Monitor logs
grep "Cache" logs/app.log | tail -100
```

## Related Documentation

- [Redis Configuration Guide](./REDIS_CONFIGURATION.md) - Redis setup and connectivity
- [Redis Memory Configuration](./REDIS_MEMORY_CONFIGURATION.md) - Memory limits and eviction
- [Distributed Cache Invalidation](./DISTRIBUTED_CACHE_INVALIDATION.md) - Multi-instance caching
- [Cache Invalidation Patterns](./CACHE_INVALIDATION_PATTERNS.md) - Invalidation strategies
- [Cache Warming Strategies](./CACHE_WARMING_STRATEGIES.md) - Proactive cache loading
- [Cache Monitoring Guide](./CACHE_MONITORING.md) - Performance monitoring
- [Cache Troubleshooting Guide](./CACHE_TROUBLESHOOTING.md) - Common issues and solutions
- [Cache Quick Reference](./CACHE_QUICK_REFERENCE.md) - Quick reference guide

## Support

For cache-related issues:
- **Configuration**: Review this guide and related documentation
- **Performance**: Check monitoring dashboard and logs
- **Errors**: See troubleshooting guide
- **Upstash Issues**: Contact Upstash support
