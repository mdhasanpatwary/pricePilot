# Post-Migration Optimization Plan

## Executive Summary

After successfully migrating 195 endpoints to use request-scoped caching, query performance analysis reveals additional optimization opportunities. While duplicate queries have been eliminated, some individual queries remain slow and need optimization.

---

## Current Performance Analysis

### Query Performance Report Summary

**Total Queries:** 17  
**Total Time:** 4,027ms  
**Average Query Time:** 237ms

### Critical Performance Issues

| Rank | Query | Count | Avg Time | Status |
|------|-------|-------|----------|--------|
| 1 | Tenant.findFirst | 1 | 1,442ms | 🔴 CRITICAL |
| 2 | Product.findMany | 5 | 294ms | 🟡 NEEDS OPTIMIZATION |
| 3 | Site.findMany | 3 | 182ms | 🟡 NEEDS OPTIMIZATION |
| 4 | ProductMatch.count | 1 | 80ms | 🟢 ACCEPTABLE |
| 5 | PriceHistory.findMany | 1 | 75ms | 🟢 ACCEPTABLE |

---

## Priority 1: Critical Slow Queries (>1s)

### 🔴 Tenant.findFirst - 1,442ms

**Impact:** CRITICAL - This is likely the tenant lookup in authentication/authorization

**Root Cause Analysis:**
- Missing or inefficient database index
- Complex query with multiple joins
- Large dataset without proper filtering
- Possible N+1 query pattern

**Optimization Actions:**

1. **Add Database Indexes**
   ```sql
   -- Check existing indexes
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'Tenant';
   
   -- Add missing indexes
   CREATE INDEX IF NOT EXISTS idx_tenant_id ON "Tenant"(id);
   CREATE INDEX IF NOT EXISTS idx_tenant_status ON "Tenant"(status);
   CREATE INDEX IF NOT EXISTS idx_tenant_slug ON "Tenant"(slug);
   ```

2. **Optimize Query Selection**
   - Review what fields are being selected
   - Remove unnecessary joins
   - Use `select` to limit returned fields
   
   ```typescript
   // Before (slow)
   const tenant = await prisma.tenant.findFirst({
     where: { id: tenantId },
     include: { /* many relations */ }
   });
   
   // After (fast)
   const tenant = await prisma.tenant.findFirst({
     where: { id: tenantId },
     select: {
       id: true,
       planType: true,
       companyName: true,
       status: true
     }
   });
   ```

3. **Use findUnique Instead of findFirst**
   ```typescript
   // findFirst is slower (scans table)
   const tenant = await prisma.tenant.findFirst({
     where: { id: tenantId }
   });
   
   // findUnique is faster (uses primary key/unique index)
   const tenant = await prisma.tenant.findUnique({
     where: { id: tenantId }
   });
   ```

4. **Verify Caching is Working**
   - Ensure `getCachedTenant()` is being used
   - Check cache hit rates
   - Verify request context is properly initialized

---

## Priority 2: Slow Queries (200-500ms)

### 🟡 Product.findMany - 294ms average (max 878ms)

**Impact:** HIGH - Product queries are frequent and critical

**Optimization Actions:**

1. **Add Composite Indexes**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_product_tenant_status 
   ON "Product"(tenantId, status);
   
   CREATE INDEX IF NOT EXISTS idx_product_tenant_updated 
   ON "Product"(tenantId, updatedAt DESC);
   
   CREATE INDEX IF NOT EXISTS idx_product_sku 
   ON "Product"(sku);
   ```

2. **Implement Pagination**
   ```typescript
   // Add pagination to large result sets
   const products = await prisma.product.findMany({
     where: { tenantId },
     take: 50,
     skip: page * 50,
     orderBy: { updatedAt: 'desc' }
   });
   ```

3. **Use Cursor-Based Pagination for Better Performance**
   ```typescript
   const products = await prisma.product.findMany({
     where: { tenantId },
     take: 50,
     cursor: lastProductId ? { id: lastProductId } : undefined,
     orderBy: { id: 'asc' }
   });
   ```

4. **Optimize Select Fields**
   ```typescript
   // Only select needed fields
   const products = await prisma.product.findMany({
     where: { tenantId },
     select: {
       id: true,
       name: true,
       sku: true,
       currentPrice: true,
       status: true
       // Don't include large text fields or relations unless needed
     }
   });
   ```

### 🟡 Site.findMany - 182ms average (max 378ms)

**Optimization Actions:**

1. **Add Indexes**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_site_tenant_status 
   ON "Site"(tenantId, status);
   
   CREATE INDEX IF NOT EXISTS idx_site_syncing 
   ON "Site"(isSyncing) WHERE isSyncing = true;
   ```

2. **Optimize Active Site Queries**
   ```typescript
   // If querying for active syncing sites
   const activeSites = await prisma.site.findMany({
     where: {
       isSyncing: true
     },
     select: {
       id: true,
       baseUrl: true,
       syncStartedAt: true,
       syncProcessed: true,
       syncTotal: true,
       Tenant: {
         select: {
           companyName: true
         }
       }
     },
     orderBy: {
       syncStartedAt: 'desc'
     }
   });
   ```

---

## Priority 3: Moderate Queries (50-100ms)

### 🟢 ProductMatch.count - 80ms
### 🟢 PriceHistory.findMany - 75ms
### 🟢 Product.count - 70ms

**Status:** Acceptable but can be improved

**Optimization Actions:**

1. **Add Indexes for Count Operations**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_product_match_tenant 
   ON "ProductMatch"(tenantId, status);
   
   CREATE INDEX IF NOT EXISTS idx_price_history_tenant_recorded 
   ON "PriceHistory"(tenantId, recordedAt DESC);
   ```

2. **Consider Caching Count Results**
   ```typescript
   // Cache counts that don't change frequently
   const cacheKey = `product_count:${tenantId}`;
   let count = await redis.get(cacheKey);
   
   if (!count) {
     count = await prisma.product.count({
       where: { tenantId, status: 'ACTIVE' }
     });
     await redis.set(cacheKey, count, 'EX', 300); // 5 min cache
   }
   ```

---

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)

**Goal:** Fix the 1.4s Tenant.findFirst query

1. **Day 1-2: Investigation**
   - [ ] Identify exact query causing slow Tenant.findFirst
   - [ ] Check current database indexes
   - [ ] Analyze query execution plan
   - [ ] Verify caching is working

2. **Day 3-4: Implementation**
   - [ ] Add missing database indexes
   - [ ] Change findFirst to findUnique where applicable
   - [ ] Optimize field selection
   - [ ] Update cached tenant helper if needed

3. **Day 5: Testing & Validation**
   - [ ] Run performance tests
   - [ ] Verify query time reduced to <50ms
   - [ ] Check cache hit rates
   - [ ] Monitor production metrics

**Expected Improvement:** 1,442ms → <50ms (96% reduction)

### Phase 2: High-Impact Optimizations (Week 2)

**Goal:** Optimize Product and Site queries

1. **Product Query Optimization**
   - [ ] Add composite indexes
   - [ ] Implement pagination
   - [ ] Optimize field selection
   - [ ] Add query result caching

2. **Site Query Optimization**
   - [ ] Add indexes for common queries
   - [ ] Optimize active site lookups
   - [ ] Reduce unnecessary joins

**Expected Improvement:** 294ms → <100ms (66% reduction)

### Phase 3: Moderate Optimizations (Week 3)

**Goal:** Optimize count and aggregate queries

1. **Count Query Optimization**
   - [ ] Add indexes for count operations
   - [ ] Implement count caching
   - [ ] Use approximate counts where acceptable

2. **Aggregate Query Optimization**
   - [ ] Optimize groupBy queries
   - [ ] Add materialized views if needed
   - [ ] Cache aggregate results

**Expected Improvement:** 70-80ms → <30ms (60% reduction)

---

## Database Index Strategy

### Recommended Indexes to Add

```sql
-- Tenant table
CREATE INDEX IF NOT EXISTS idx_tenant_id ON "Tenant"(id);
CREATE INDEX IF NOT EXISTS idx_tenant_status ON "Tenant"(status);
CREATE INDEX IF NOT EXISTS idx_tenant_slug ON "Tenant"(slug);

-- Product table
CREATE INDEX IF NOT EXISTS idx_product_tenant_status ON "Product"(tenantId, status);
CREATE INDEX IF NOT EXISTS idx_product_tenant_updated ON "Product"(tenantId, updatedAt DESC);
CREATE INDEX IF NOT EXISTS idx_product_sku ON "Product"(sku);
CREATE INDEX IF NOT EXISTS idx_product_tenant_sku ON "Product"(tenantId, sku);

-- Site table
CREATE INDEX IF NOT EXISTS idx_site_tenant_status ON "Site"(tenantId, status);
CREATE INDEX IF NOT EXISTS idx_site_syncing ON "Site"(isSyncing) WHERE isSyncing = true;
CREATE INDEX IF NOT EXISTS idx_site_tenant_syncing ON "Site"(tenantId, isSyncing);

-- ProductMatch table
CREATE INDEX IF NOT EXISTS idx_product_match_tenant_status ON "ProductMatch"(tenantId, status);
CREATE INDEX IF NOT EXISTS idx_product_match_user_product ON "ProductMatch"(userProductId);
CREATE INDEX IF NOT EXISTS idx_product_match_competitor_product ON "ProductMatch"(competitorProductId);

-- PriceHistory table
CREATE INDEX IF NOT EXISTS idx_price_history_tenant_recorded ON "PriceHistory"(tenantId, recordedAt DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_product_recorded ON "PriceHistory"(productId, recordedAt DESC);

-- PricingRule table
CREATE INDEX IF NOT EXISTS idx_pricing_rule_tenant_active ON "PricingRule"(tenantId, isActive);

-- TenantAuditLog table
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created ON "TenantAuditLog"(tenantId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON "TenantAuditLog"(entityType, entityId);
```

### Index Maintenance

```sql
-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Find unused indexes
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexname NOT LIKE 'pg_%';

-- Analyze table statistics
ANALYZE "Tenant";
ANALYZE "Product";
ANALYZE "Site";
ANALYZE "ProductMatch";
ANALYZE "PriceHistory";
```

---

## Query Optimization Patterns

### Pattern 1: Use Specific Queries

```typescript
// ❌ Slow: findFirst scans table
const tenant = await prisma.tenant.findFirst({
  where: { id: tenantId }
});

// ✅ Fast: findUnique uses index
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId }
});
```

### Pattern 2: Select Only Needed Fields

```typescript
// ❌ Slow: Returns all fields
const products = await prisma.product.findMany({
  where: { tenantId }
});

// ✅ Fast: Returns only needed fields
const products = await prisma.product.findMany({
  where: { tenantId },
  select: {
    id: true,
    name: true,
    sku: true,
    currentPrice: true
  }
});
```

### Pattern 3: Implement Pagination

```typescript
// ❌ Slow: Returns all records
const products = await prisma.product.findMany({
  where: { tenantId }
});

// ✅ Fast: Returns paginated results
const products = await prisma.product.findMany({
  where: { tenantId },
  take: 50,
  skip: page * 50
});
```

### Pattern 4: Use Composite Indexes

```typescript
// Query that benefits from composite index
const products = await prisma.product.findMany({
  where: {
    tenantId: tenantId,
    status: 'ACTIVE'
  },
  orderBy: {
    updatedAt: 'desc'
  }
});

// Requires index: (tenantId, status, updatedAt)
```

### Pattern 5: Cache Expensive Queries

```typescript
// Cache results that don't change frequently
const cacheKey = `tenant:${tenantId}:stats`;
let stats = await getRequestCache(cacheKey);

if (!stats) {
  stats = await prisma.product.aggregate({
    where: { tenantId },
    _count: true,
    _avg: { currentPrice: true }
  });
  setRequestCache(cacheKey, stats);
}
```

---

## Monitoring & Validation

### Performance Metrics to Track

1. **Query Performance**
   - Average query time per model/operation
   - P95 and P99 query times
   - Slowest queries (>100ms)
   - Query count per request

2. **Cache Performance**
   - Cache hit rate
   - Cache miss rate
   - Average cache lookup time
   - Cache size and memory usage

3. **Database Performance**
   - Connection pool usage
   - Active connections
   - Query queue length
   - Index usage statistics

### Monitoring Tools

```typescript
// Add to query performance tracker
export function trackQueryMetrics() {
  const metrics = getQueryMetrics();
  
  // Log slow queries
  metrics.slowQueries.forEach(query => {
    if (query.avgTime > 100) {
      console.warn(`Slow query detected: ${query.model}.${query.operation} - ${query.avgTime}ms`);
    }
  });
  
  // Track cache performance
  const cacheMetrics = getRequestCacheMetrics();
  const hitRate = cacheMetrics.hits / (cacheMetrics.hits + cacheMetrics.misses);
  console.log(`Cache hit rate: ${(hitRate * 100).toFixed(2)}%`);
}
```

---

## Success Criteria

### Phase 1 Success Metrics
- ✅ Tenant.findFirst < 50ms (currently 1,442ms)
- ✅ Cache hit rate > 80%
- ✅ No queries > 500ms

### Phase 2 Success Metrics
- ✅ Product.findMany < 100ms (currently 294ms)
- ✅ Site.findMany < 100ms (currently 182ms)
- ✅ Overall average query time < 50ms

### Phase 3 Success Metrics
- ✅ All count queries < 30ms
- ✅ All queries < 100ms
- ✅ P95 query time < 50ms

---

## Next Steps

1. **Immediate Actions** (This Week)
   - [ ] Investigate Tenant.findFirst slow query
   - [ ] Check database indexes
   - [ ] Verify caching is working
   - [ ] Create database index migration

2. **Short-term Actions** (Next 2 Weeks)
   - [ ] Implement Phase 1 optimizations
   - [ ] Add missing database indexes
   - [ ] Optimize Product and Site queries
   - [ ] Monitor performance improvements

3. **Long-term Actions** (Next Month)
   - [ ] Implement query result caching
   - [ ] Add materialized views for aggregates
   - [ ] Set up automated performance monitoring
   - [ ] Create performance regression tests

---

## Conclusion

The request-scoped caching migration successfully eliminated duplicate queries, but individual query performance needs optimization. The primary focus should be on the critical 1.4s Tenant.findFirst query, followed by Product and Site query optimizations.

**Expected Overall Improvement:**
- Current: 4,027ms total, 237ms average
- Target: <1,000ms total, <50ms average
- Improvement: 75% reduction in total query time

**Priority Order:**
1. 🔴 Fix Tenant.findFirst (1,442ms → <50ms)
2. 🟡 Optimize Product.findMany (294ms → <100ms)
3. 🟡 Optimize Site.findMany (182ms → <100ms)
4. 🟢 Optimize count queries (70-80ms → <30ms)

---

**Document Created:** February 10, 2026  
**Status:** Ready for Implementation  
**Next Action:** Investigate Tenant.findFirst slow query
