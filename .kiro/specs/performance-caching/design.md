# Design Document: Performance Caching

## Overview

This design document describes the integration and completion of PricePilot's caching infrastructure to achieve significant performance improvements. The system already has foundational caching components (CacheService, CacheLayer, API middleware) that need to be fully integrated into critical services and workflows.

The caching strategy focuses on:
- **Tenant-isolated caching** to maintain multi-tenant security
- **Strategic cache placement** in high-traffic, expensive operations
- **Intelligent invalidation** to ensure data freshness
- **Proactive warming** for frequently accessed data
- **Comprehensive monitoring** to track effectiveness

**Performance Goals:**
- Reduce database query load by 60%+
- Improve API response times by 40%+
- Achieve 70%+ cache hit rate
- Keep cache memory usage under 500MB

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ API Routes   │  │ Matching     │  │ Comparison   │      │
│  │              │  │ Service      │  │ Service      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      Cache Layer                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Tenant Isolation │ Stats Tracking │ Warming │ Invalidation │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
          │                                      │
          ▼                                      ▼
┌──────────────────────┐            ┌──────────────────────┐
│   Upstash Redis      │            │   PostgreSQL DB      │
│   (Cache Store)      │            │   (Source of Truth)  │
└──────────────────────┘            └──────────────────────┘
```

### Cache Hierarchy

1. **API Response Cache** (TTL: 2-10 minutes)
   - Caches complete API responses
   - Fastest response time
   - Invalidated on any data change

2. **Service Layer Cache** (TTL: 5-30 minutes)
   - Caches service method results
   - Shared across API endpoints
   - Invalidated on specific data changes

3. **Query Result Cache** (TTL: 15-60 minutes)
   - Caches expensive database queries
   - Lowest level cache
   - Invalidated on table updates

### Tenant Isolation Strategy

All cache keys follow the pattern:
```
{tenantId}:{service}:{operation}:{params_hash}
```

Examples:
- `tenant_123:matching:findMatches:abc123def`
- `tenant_456:comparison:getReport:xyz789abc`
- `tenant_789:products:list:page_1_limit_20`

This ensures complete isolation between tenants and prevents cache key collisions.

## Components and Interfaces

### 1. Enhanced Cache Service

**File:** `lib/services/cache-enhanced.ts`

This service extends the existing CacheLayer with application-specific caching methods.

```typescript
interface CacheEnhancedService {
  // Product caching
  cacheProduct(tenantId: string, productId: string, data: any, ttl?: number): Promise<void>;
  getCachedProduct(tenantId: string, productId: string): Promise<any | null>;
  invalidateProduct(tenantId: string, productId: string): Promise<void>;
  
  // Comparison caching
  cacheComparison(tenantId: string, filters: ComparisonFilters, data: any, ttl?: number): Promise<void>;
  getCachedComparison(tenantId: string, filters: ComparisonFilters): Promise<any | null>;
  invalidateComparisons(tenantId: string): Promise<void>;
  
  // Matching caching
  cacheMatches(tenantId: string, productId: string, matches: any[], ttl?: number): Promise<void>;
  getCachedMatches(tenantId: string, productId: string): Promise<any[] | null>;
  invalidateMatches(tenantId: string, productId?: string): Promise<void>;
  
  // Competitor caching
  cacheCompetitorProducts(tenantId: string, competitorId: string, products: any[], ttl?: number): Promise<void>;
  getCachedCompetitorProducts(tenantId: string, competitorId: string): Promise<any[] | null>;
  invalidateCompetitorProducts(tenantId: string, competitorId: string): Promise<void>;
  
  // Price history caching
  cachePriceHistory(tenantId: string, productId: string, history: any[], ttl?: number): Promise<void>;
  getCachedPriceHistory(tenantId: string, productId: string): Promise<any[] | null>;
  invalidatePriceHistory(tenantId: string, productId: string): Promise<void>;
  
  // Analytics caching
  cacheAnalytics(tenantId: string, type: string, data: any, ttl?: number): Promise<void>;
  getCachedAnalytics(tenantId: string, type: string): Promise<any | null>;
  invalidateAnalytics(tenantId: string): Promise<void>;
  
  // Bulk operations
  invalidateAll(tenantId: string): Promise<void>;
  warmCache(tenantId: string, types: string[]): Promise<void>;
  
  // Statistics
  getStats(tenantId: string): Promise<CacheStats>;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
  memoryUsage: number;
}

interface ComparisonFilters {
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```

### 2. Matching Service Integration

**File:** `lib/services/matching.ts` (existing, to be enhanced)

The MatchingService will be enhanced to use caching for expensive matching operations.

```typescript
class MatchingService {
  private cacheService: CacheEnhancedService;
  
  async findMatches(tenantId: string, productId: string): Promise<Match[]> {
    // Try cache first
    const cached = await this.cacheService.getCachedMatches(tenantId, productId);
    if (cached) return cached;
    
    // Cache miss - compute matches
    const matches = await this.computeMatches(tenantId, productId);
    
    // Store in cache
    await this.cacheService.cacheMatches(tenantId, productId, matches, 900); // 15 min TTL
    
    return matches;
  }
  
  async autoMatchProducts(tenantId: string): Promise<MatchResult> {
    // Expensive operation - cache results
    const cacheKey = `autoMatch:${tenantId}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;
    
    const result = await this.performAutoMatching(tenantId);
    await this.cacheService.set(cacheKey, result, 1800); // 30 min TTL
    
    return result;
  }
}
```

### 3. Comparison Query Caching

**File:** `lib/services/comparison.ts` (to be created/enhanced)

Caches expensive product comparison queries.

```typescript
class ComparisonService {
  private cacheService: CacheEnhancedService;
  
  async getComparisonReport(
    tenantId: string, 
    filters: ComparisonFilters
  ): Promise<ComparisonReport> {
    // Try cache first
    const cached = await this.cacheService.getCachedComparison(tenantId, filters);
    if (cached) return cached;
    
    // Cache miss - query database
    const report = await this.queryComparisonData(tenantId, filters);
    
    // Store in cache
    await this.cacheService.cacheComparison(tenantId, filters, report, 300); // 5 min TTL
    
    return report;
  }
  
  async getProductComparison(
    tenantId: string,
    productId: string
  ): Promise<ProductComparison> {
    const cacheKey = `productComparison:${tenantId}:${productId}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;
    
    const comparison = await this.queryProductComparison(tenantId, productId);
    await this.cacheService.set(cacheKey, comparison, 300); // 5 min TTL
    
    return comparison;
  }
}
```

### 4. Cache Invalidation Triggers

**File:** `lib/services/cache-invalidation.ts` (to be created)

Centralized cache invalidation logic triggered by data changes.

```typescript
class CacheInvalidationService {
  private cacheService: CacheEnhancedService;
  
  async onPriceUpdate(tenantId: string, productIds: string[]): Promise<void> {
    // Invalidate affected caches
    await Promise.all([
      this.cacheService.invalidateComparisons(tenantId),
      ...productIds.map(id => this.cacheService.invalidateProduct(tenantId, id)),
      ...productIds.map(id => this.cacheService.invalidatePriceHistory(tenantId, id)),
      this.cacheService.invalidateAnalytics(tenantId)
    ]);
  }
  
  async onProductSync(tenantId: string): Promise<void> {
    // Invalidate all product-related caches
    await Promise.all([
      this.cacheService.invalidateComparisons(tenantId),
      this.cacheService.invalidateMatches(tenantId),
      this.cacheService.invalidateAnalytics(tenantId)
    ]);
  }
  
  async onMatchUpdate(tenantId: string, productId: string): Promise<void> {
    // Invalidate matching and comparison caches
    await Promise.all([
      this.cacheService.invalidateMatches(tenantId, productId),
      this.cacheService.invalidateComparisons(tenantId),
      this.cacheService.invalidateProduct(tenantId, productId)
    ]);
  }
  
  async onCompetitorScrape(tenantId: string, competitorId: string): Promise<void> {
    // Invalidate competitor product caches
    await Promise.all([
      this.cacheService.invalidateCompetitorProducts(tenantId, competitorId),
      this.cacheService.invalidateComparisons(tenantId)
    ]);
  }
}
```

### 5. Cache Warming Service

**File:** `lib/services/cache-warming.ts` (to be created)

Proactively loads frequently accessed data into cache.

```typescript
class CacheWarmingService {
  private cacheService: CacheEnhancedService;
  private db: PrismaClient;
  
  async warmTenantCache(tenantId: string): Promise<void> {
    // Warm active products
    const activeProducts = await this.db.userProduct.findMany({
      where: { tenantId, status: 'active' },
      take: 100,
      orderBy: { lastSyncAt: 'desc' }
    });
    
    for (const product of activeProducts) {
      await this.cacheService.cacheProduct(tenantId, product.id, product);
    }
    
    // Warm recent comparisons
    await this.warmRecentComparisons(tenantId);
    
    // Warm analytics
    await this.warmAnalytics(tenantId);
  }
  
  async warmOnLogin(tenantId: string): Promise<void> {
    // Warm essential data when user logs in
    await Promise.all([
      this.warmDashboardData(tenantId),
      this.warmRecentProducts(tenantId, 20)
    ]);
  }
  
  async warmDashboardData(tenantId: string): Promise<void> {
    // Warm data needed for dashboard
    const analytics = await this.computeDashboardAnalytics(tenantId);
    await this.cacheService.cacheAnalytics(tenantId, 'dashboard', analytics, 600);
  }
  
  async scheduledWarming(): Promise<void> {
    // Run during off-peak hours
    const tenants = await this.getActiveTenants();
    
    for (const tenant of tenants) {
      try {
        await this.warmTenantCache(tenant.id);
      } catch (error) {
        console.error(`Cache warming failed for tenant ${tenant.id}:`, error);
      }
    }
  }
}
```

### 6. Cache Monitoring Service

**File:** `lib/services/cache-monitoring.ts` (to be created)

Monitors cache performance and health.

```typescript
class CacheMonitoringService {
  private cacheService: CacheEnhancedService;
  
  async getHealthStatus(): Promise<CacheHealth> {
    try {
      // Check Redis connectivity
      const isConnected = await this.cacheService.ping();
      
      // Get memory usage
      const memoryUsage = await this.cacheService.getMemoryUsage();
      
      // Get performance stats
      const stats = await this.cacheService.getGlobalStats();
      
      return {
        status: isConnected ? 'healthy' : 'unhealthy',
        redis: {
          connected: isConnected,
          memoryUsage,
          memoryLimit: 500 * 1024 * 1024 // 500MB
        },
        performance: {
          hitRate: stats.hitRate,
          avgResponseTime: stats.avgResponseTime,
          totalHits: stats.hits,
          totalMisses: stats.misses
        },
        alerts: this.generateAlerts(stats, memoryUsage)
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
  
  private generateAlerts(stats: CacheStats, memoryUsage: number): Alert[] {
    const alerts: Alert[] = [];
    
    if (stats.hitRate < 0.6) {
      alerts.push({
        level: 'warning',
        message: `Cache hit rate below 60%: ${(stats.hitRate * 100).toFixed(1)}%`
      });
    }
    
    if (memoryUsage > 400 * 1024 * 1024) { // 400MB
      alerts.push({
        level: 'warning',
        message: `Cache memory usage high: ${(memoryUsage / 1024 / 1024).toFixed(0)}MB`
      });
    }
    
    if (stats.avgResponseTime > 100) {
      alerts.push({
        level: 'warning',
        message: `Cache operations slow: ${stats.avgResponseTime.toFixed(0)}ms avg`
      });
    }
    
    return alerts;
  }
  
  async logStats(): Promise<void> {
    const health = await this.getHealthStatus();
    console.log('[Cache Stats]', JSON.stringify(health, null, 2));
    
    // Send to monitoring dashboard
    await this.sendToMonitoring(health);
  }
}

interface CacheHealth {
  status: 'healthy' | 'unhealthy';
  redis?: {
    connected: boolean;
    memoryUsage: number;
    memoryLimit: number;
  };
  performance?: {
    hitRate: number;
    avgResponseTime: number;
    totalHits: number;
    totalMisses: number;
  };
  alerts?: Alert[];
  error?: string;
}

interface Alert {
  level: 'info' | 'warning' | 'error';
  message: string;
}
```

### 7. API Middleware Integration

**File:** `lib/middleware/api-cache.ts` (existing, to be enhanced)

The existing API cache middleware will be integrated into API routes.

```typescript
// Apply to GET endpoints
app.get('/api/v1/products', 
  apiCache({ ttl: 120, keyPrefix: 'products:list' }), 
  productsController.list
);

app.get('/api/v1/comparison/report',
  apiCache({ ttl: 300, keyPrefix: 'comparison:report' }),
  comparisonController.getReport
);

app.get('/api/v1/competitors/:id/products',
  apiCache({ ttl: 600, keyPrefix: 'competitors:products' }),
  competitorsController.getProducts
);
```

## Data Models

### Cache Key Structure

```typescript
interface CacheKey {
  tenantId: string;
  service: string;
  operation: string;
  params: Record<string, any>;
}

function buildCacheKey(key: CacheKey): string {
  const paramsHash = hashObject(key.params);
  return `${key.tenantId}:${key.service}:${key.operation}:${paramsHash}`;
}

function hashObject(obj: Record<string, any>): string {
  const sorted = JSON.stringify(obj, Object.keys(obj).sort());
  return crypto.createHash('md5').update(sorted).digest('hex');
}
```

### Cache Configuration

```typescript
interface CacheConfig {
  ttl: {
    products: number;           // 300 (5 min)
    comparisons: number;        // 300 (5 min)
    matches: number;            // 900 (15 min)
    competitorProducts: number; // 1800 (30 min)
    priceHistory: number;       // 3600 (1 hour)
    analytics: number;          // 600 (10 min)
    apiResponses: {
      productList: number;      // 120 (2 min)
      comparisonReport: number; // 300 (5 min)
      competitorProducts: number; // 600 (10 min)
    };
  };
  limits: {
    maxMemory: number;          // 500MB
    maxKeySize: number;         // 1MB
    evictionPolicy: 'lru' | 'lfu';
  };
  warming: {
    enabled: boolean;
    schedule: string;           // Cron expression
    topProductsCount: number;   // 100
  };
  monitoring: {
    enabled: boolean;
    logInterval: number;        // 300 seconds
    alertThresholds: {
      hitRate: number;          // 0.6 (60%)
      memoryUsage: number;      // 0.8 (80%)
      responseTime: number;     // 100ms
    };
  };
}
```

### Cache Statistics Model

```typescript
interface CacheStatistics {
  tenantId: string;
  period: 'hourly' | 'daily' | 'weekly';
  timestamp: Date;
  metrics: {
    hits: number;
    misses: number;
    hitRate: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    memoryUsage: number;
    evictions: number;
    errors: number;
  };
  byService: Record<string, {
    hits: number;
    misses: number;
    hitRate: number;
  }>;
}
```

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Tenant Isolation in Cache Keys

*For any* tenant ID and cache operation, the generated cache key must include the tenant ID as a prefix, and cache keys for different tenants with identical operations must be distinct.

**Validates: Requirements 5.1, 5.4**

### Property 2: Tenant Data Access Isolation

*For any* cache retrieval operation, the system must only return cached data that belongs to the requesting tenant, and attempts to access another tenant's cached data must fail or return null.

**Validates: Requirements 1.5, 5.2**

### Property 3: Tenant-Scoped Cache Operations

*For any* cache invalidation or warming operation with a specified tenant ID, only cache keys belonging to that tenant must be affected, and other tenants' cached data must remain unchanged.

**Validates: Requirements 5.3, 5.5**

### Property 4: Graceful Degradation on Cache Failure

*For any* query operation, if Redis is unavailable or cache operations fail, the system must return correct results from the database without throwing errors, and the response must be functionally equivalent to a cache hit.

**Validates: Requirements 1.6, 2.6, 3.5**

### Property 5: Cache Invalidation Correctness

*For any* data modification operation (price update, product sync, match update, competitor scrape), after the operation completes and cache invalidation is triggered, subsequent cache lookups for affected data must either return null (cache miss) or return fresh data from the database.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 6: Pattern-Based Invalidation

*For any* cache invalidation pattern (e.g., "tenant_123:products:*"), all cache keys matching the pattern must be removed, and cache keys not matching the pattern must remain in cache.

**Validates: Requirements 2.5**

### Property 7: Cache Warming on Comparison Request

*For any* comparison report request, after the request completes, the cache must contain entries for the related competitor products that were included in the comparison.

**Validates: Requirements 3.2**

### Property 8: Statistics Tracking Accuracy

*For any* sequence of cache operations (hits and misses), the tracked hit rate, miss rate, and average response time must accurately reflect the actual operations performed, with hit rate calculated as hits / (hits + misses).

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 9: API Mutation Request Non-Caching

*For any* HTTP request with method POST, PUT, PATCH, or DELETE, the API middleware must not cache the response, and each request must execute the full operation.

**Validates: Requirements 8.4**

### Property 10: Cache Status Header Presence

*For any* API response served through the cache middleware, the response must include an X-Cache-Status header with value either "HIT" or "MISS" indicating whether the response was served from cache.

**Validates: Requirements 8.5**

### Property 11: Distributed Cache Invalidation Propagation

*For any* cache invalidation operation in a multi-instance deployment, all application instances must observe the invalidation, and subsequent cache lookups on any instance must reflect the invalidated state.

**Validates: Requirements 7.2**

### Property 12: Concurrent Cache Operation Safety

*For any* concurrent cache operations (reads, writes, invalidations) across multiple instances or threads, the cache must maintain consistency, prevent race conditions, and ensure that the final cache state reflects a valid serialization of the operations.

**Validates: Requirements 7.3, 7.4**

### Property 13: TTL Expiration Correctness

*For any* cached item with a specified TTL, after the TTL duration has elapsed, cache lookups for that item must return null (cache miss), and the item must not be served from cache.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

## Error Handling

### Cache Operation Failures

**Strategy:** Fail-open approach - if cache operations fail, continue with database operations.

```typescript
async getCachedData<T>(key: string, fallback: () => Promise<T>): Promise<T> {
  try {
    const cached = await this.cacheService.get(key);
    if (cached) return cached;
  } catch (error) {
    console.error('[Cache] Read failed, falling back to database:', error);
    // Continue to fallback
  }
  
  // Cache miss or error - use fallback
  const data = await fallback();
  
  // Try to cache for next time (fire and forget)
  this.cacheService.set(key, data).catch(err => {
    console.error('[Cache] Write failed:', err);
  });
  
  return data;
}
```

### Redis Connection Failures

**Strategy:** Detect connection failures early and disable caching temporarily.

```typescript
class CacheService {
  private isHealthy: boolean = true;
  private lastHealthCheck: Date;
  
  async ping(): Promise<boolean> {
    try {
      await this.redis.ping();
      this.isHealthy = true;
      return true;
    } catch (error) {
      this.isHealthy = false;
      console.error('[Cache] Redis unhealthy:', error);
      return false;
    }
  }
  
  async get(key: string): Promise<any> {
    if (!this.isHealthy) return null;
    
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.isHealthy = false;
      throw error;
    }
  }
}
```

### Invalidation Failures

**Strategy:** Log errors but don't block operations. Stale cache is better than broken operations.

```typescript
async invalidateCache(keys: string[]): Promise<void> {
  try {
    await this.cacheService.del(keys);
  } catch (error) {
    console.error('[Cache] Invalidation failed:', error);
    // Log to monitoring but don't throw
    await this.monitoring.logError('cache_invalidation_failed', { keys, error });
  }
}
```

### Memory Limit Exceeded

**Strategy:** Implement LRU eviction and alert when approaching limits.

```typescript
async checkMemoryUsage(): Promise<void> {
  const usage = await this.redis.info('memory');
  const usedMemory = parseInt(usage.used_memory);
  const maxMemory = 500 * 1024 * 1024; // 500MB
  
  if (usedMemory > maxMemory * 0.8) {
    await this.monitoring.alert('cache_memory_high', {
      used: usedMemory,
      max: maxMemory,
      percentage: (usedMemory / maxMemory * 100).toFixed(1)
    });
  }
  
  if (usedMemory > maxMemory) {
    // Redis will handle LRU eviction automatically
    console.warn('[Cache] Memory limit exceeded, LRU eviction active');
  }
}
```

## Testing Strategy

### Dual Testing Approach

The caching system requires both unit tests and property-based tests to ensure correctness:

- **Unit tests**: Verify specific caching scenarios, edge cases, and error conditions
- **Property tests**: Verify universal properties across all cache operations

Both approaches are complementary and necessary for comprehensive coverage.

### Unit Testing Focus

Unit tests should focus on:

1. **Specific Cache Scenarios**
   - Cache hit returns correct data
   - Cache miss triggers database query
   - Cache write stores data correctly
   - TTL expiration removes data

2. **Integration Points**
   - MatchingService uses cache correctly
   - ComparisonService uses cache correctly
   - API middleware caches responses
   - Invalidation triggers fire on data changes

3. **Edge Cases**
   - Empty cache keys
   - Null values
   - Very large cached objects
   - Concurrent access to same key

4. **Error Conditions**
   - Redis connection failure
   - Cache write failure
   - Invalidation failure
   - Memory limit exceeded

### Property-Based Testing Focus

Property tests should focus on:

1. **Tenant Isolation Properties**
   - Generate random tenant IDs and operations
   - Verify cache keys are properly prefixed
   - Verify cross-tenant access fails
   - Verify invalidation is tenant-scoped

2. **Cache Correctness Properties**
   - Generate random cache operations
   - Verify cache returns same data as database
   - Verify invalidation removes correct keys
   - Verify TTL expiration works correctly

3. **Statistics Accuracy Properties**
   - Generate random sequences of hits/misses
   - Verify hit rate calculation is correct
   - Verify response time tracking is accurate

4. **Distributed System Properties**
   - Simulate multiple instances
   - Verify invalidation propagates
   - Verify concurrent operations are safe

### Property Test Configuration

- **Minimum iterations**: 100 per property test (due to randomization)
- **Test framework**: fast-check (for TypeScript/JavaScript)
- **Tag format**: `Feature: performance-caching, Property {number}: {property_text}`

### Example Property Test

```typescript
import fc from 'fast-check';

describe('Property: Tenant Isolation in Cache Keys', () => {
  it('should generate unique cache keys for different tenants', async () => {
    // Feature: performance-caching, Property 1: Tenant Isolation in Cache Keys
    
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // tenantId1
        fc.string(), // tenantId2
        fc.string(), // operation
        fc.object(), // params
        async (tenant1, tenant2, operation, params) => {
          fc.pre(tenant1 !== tenant2); // Ensure different tenants
          
          const key1 = buildCacheKey({ tenantId: tenant1, service: 'test', operation, params });
          const key2 = buildCacheKey({ tenantId: tenant2, service: 'test', operation, params });
          
          // Keys must be different for different tenants
          expect(key1).not.toBe(key2);
          
          // Keys must start with tenant ID
          expect(key1).toStartWith(tenant1);
          expect(key2).toStartWith(tenant2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Test Coverage Goals

- **Unit test coverage**: 80%+ of cache service code
- **Property test coverage**: All 13 correctness properties
- **Integration test coverage**: All service integrations
- **Performance test coverage**: Cache impact on response times

### Testing Checklist

Before deployment:
- [ ] All unit tests pass
- [ ] All property tests pass (100 iterations each)
- [ ] Integration tests verify service integration
- [ ] Performance tests show 40%+ response time improvement
- [ ] Load tests verify cache handles expected traffic
- [ ] Failure tests verify graceful degradation
- [ ] Security tests verify tenant isolation
- [ ] Monitoring tests verify statistics tracking

## Implementation Notes

### Phase 1: Core Integration (Priority: High)

1. Integrate CacheLayer into MatchingService
2. Integrate CacheLayer into comparison queries
3. Add cache invalidation triggers
4. Test tenant isolation

### Phase 2: Warming and Monitoring (Priority: Medium)

1. Implement cache warming service
2. Implement cache monitoring service
3. Add health check endpoint
4. Configure alerting

### Phase 3: Optimization (Priority: Low)

1. Tune TTL values based on usage patterns
2. Optimize cache key structure
3. Implement advanced eviction strategies
4. Add cache analytics dashboard

### Performance Benchmarks

Before and after metrics to track:

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Database query load | 100% | <40% | Queries per second |
| API response time (p95) | 500ms | <300ms | Response time |
| Cache hit rate | 0% | >70% | Hits / (Hits + Misses) |
| Memory usage | 0MB | <500MB | Redis memory |

### Rollout Strategy

1. **Development**: Test with synthetic data
2. **Staging**: Test with production-like data
3. **Production (10%)**: Enable for 10% of tenants
4. **Production (50%)**: Enable for 50% of tenants
5. **Production (100%)**: Enable for all tenants

Monitor metrics at each stage and rollback if issues detected.
