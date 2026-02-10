# Query Optimization Plan

Based on the performance measurement results, here's your action plan to optimize the slowest queries.

## 📊 Current Performance

| Query | Avg Time | Status | Priority |
|-------|----------|--------|----------|
| Tenant.findFirst | 647.30ms | 🚨 Critical | P0 |
| Product.findMany | 265.97ms | ⚠️ Slow | P1 |
| Site.findMany | 159.12ms | ⚠️ Slow | P2 |

## 🎯 Priority 0: Optimize Tenant.findFirst (647ms → <50ms)

### Current Issue
```typescript
// Fetches ALL fields (including large JSON fields)
const tenant = await prisma.tenant.findFirst();
```

### Solution 1: Select Only Needed Fields
```typescript
const tenant = await prisma.tenant.findFirst({
  select: {
    id: true,
    companyName: true,
    // Only include fields you actually need
  }
});
```

**Expected Improvement**: 80-90% faster (647ms → ~65ms)

### Solution 2: Add Database Index
```sql
-- Check if index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'Tenant';

-- Add index if missing (likely already exists on PK)
CREATE INDEX IF NOT EXISTS idx_tenant_id ON "Tenant"("id");
```

### Solution 3: Cache Tenant Data
```typescript
// In lib/tenant/cached-tenant.ts (already exists!)
import { getCachedTenant } from '@/lib/tenant/cached-tenant';

// Use cached version instead
const tenant = await getCachedTenant(tenantId);
```

**Expected Improvement**: 95% faster (647ms → ~30ms)

### Solution 4: Connection Pooling (Already Implemented ✅)
Your `instrumented-prisma.ts` already uses connection pooling, so this is covered.

## 🎯 Priority 1: Optimize Product.findMany (265ms → <100ms)

### Current Issue
- Average: 265.97ms
- Max: 789.76ms (one query is very slow!)
- High variance indicates different query patterns

### Identify the Slow Query
Check `query-performance-report.json` to see which specific `Product.findMany` is slowest.

### Solution 1: Add Indexes on Filtered Columns
```sql
-- Check existing indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'Product';

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_product_tenant_site 
  ON "Product"("tenantId", "siteId");

CREATE INDEX IF NOT EXISTS idx_product_tenant_title 
  ON "Product"("tenantId", "title");

CREATE INDEX IF NOT EXISTS idx_product_tenant_price 
  ON "Product"("tenantId", "currentPrice");
```

**Expected Improvement**: 50-70% faster (265ms → ~80ms)

### Solution 2: Reduce Selected Fields
```typescript
// Before (fetches all 27 fields)
const products = await prisma.product.findMany({
  where: { tenantId, siteId: { in: siteIds } },
  take: 50,
});

// After (only needed fields)
const products = await prisma.product.findMany({
  where: { tenantId, siteId: { in: siteIds } },
  select: {
    id: true,
    title: true,
    currentPrice: true,
    brand: true,
    model: true,
    // Only fields you display
  },
  take: 50,
});
```

**Expected Improvement**: 30-40% faster

### Solution 3: Fix N+1 Queries
The variance (57ms to 789ms) suggests some queries are loading relations inefficiently.

```typescript
// Bad (N+1 pattern)
const products = await prisma.product.findMany({ take: 50 });
for (const product of products) {
  const site = await prisma.site.findUnique({ where: { id: product.siteId } });
}

// Good (single query with include)
const products = await prisma.product.findMany({
  take: 50,
  include: {
    Site: {
      select: { id: true, baseUrl: true }
    }
  }
});
```

**Expected Improvement**: 80-90% faster for affected queries

## 🎯 Priority 2: Optimize Site.findMany (159ms → <80ms)

### Solution: Add Composite Index
```sql
CREATE INDEX IF NOT EXISTS idx_site_tenant_type 
  ON "Site"("tenantId", "type");
```

**Expected Improvement**: 40-50% faster (159ms → ~80ms)

## 📋 Implementation Checklist

### Immediate Actions (This Week)

- [ ] **Optimize Tenant Lookup**
  ```typescript
  // In scripts/measure-query-performance.ts
  const tenant = await instrumentedPrisma.tenant.findFirst({
    select: { id: true, companyName: true }
  });
  ```

- [ ] **Add Database Indexes**
  ```bash
  # Run these SQL commands
  psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_product_tenant_site ON \"Product\"(\"tenantId\", \"siteId\");"
  psql $DATABASE_URL -c "CREATE INDEX IF NOT EXISTS idx_site_tenant_type ON \"Site\"(\"tenantId\", \"type\");"
  ```

- [ ] **Review Product Queries**
  - Check which Product.findMany is taking 789ms
  - Add `select` to limit fields
  - Verify no N+1 patterns

### Short-term Actions (This Month)

- [ ] **Implement Query Result Caching**
  ```typescript
  // Use your existing request cache
  import { getCached } from '@/lib/cache/request-cache';
  
  const products = await getCached(
    `products:${tenantId}`,
    () => prisma.product.findMany({ where: { tenantId } }),
    { ttl: 300 } // 5 minutes
  );
  ```

- [ ] **Add Monitoring Alerts**
  ```typescript
  // Set up alerts for queries >500ms
  if (executionTime > 500) {
    // Send to monitoring service
    await sendAlert({ query, executionTime });
  }
  ```

- [ ] **Run Performance Tests Weekly**
  ```bash
  # Add to CI/CD or cron
  npm run measure-queries
  ```

### Long-term Actions (This Quarter)

- [ ] **Implement Read Replicas**
  - Route read queries to replicas
  - Keep writes on primary
  - Use `replica-aware-prisma.ts` (already exists!)

- [ ] **Add Materialized Views**
  ```sql
  -- For expensive aggregations
  CREATE MATERIALIZED VIEW product_stats AS
  SELECT 
    "tenantId",
    "siteId",
    COUNT(*) as product_count,
    AVG("currentPrice") as avg_price
  FROM "Product"
  GROUP BY "tenantId", "siteId";
  
  -- Refresh periodically
  REFRESH MATERIALIZED VIEW product_stats;
  ```

- [ ] **Implement Query Result Pagination**
  - Use cursor-based pagination for large datasets
  - Limit default page size to 50

## 🎯 Expected Results After Optimization

| Query | Current | Target | Improvement |
|-------|---------|--------|-------------|
| Tenant.findFirst | 647ms | <50ms | 92% faster |
| Product.findMany | 266ms | <80ms | 70% faster |
| Site.findMany | 159ms | <80ms | 50% faster |
| **Overall Average** | **174ms** | **<60ms** | **65% faster** |

## 📊 Verification Steps

After implementing optimizations:

1. **Run Performance Test**
   ```bash
   npm run measure-queries
   ```

2. **Compare Results**
   ```bash
   # Before
   Total Time: 2962.63ms
   Average: 174.27ms
   
   # After (expected)
   Total Time: <1000ms
   Average: <60ms
   ```

3. **Monitor in Production**
   ```bash
   curl http://localhost:3000/api/v1/debug/query-performance
   ```

## 🚀 Quick Wins (Do These First!)

### 1. Add Missing Indexes (5 minutes)
```sql
CREATE INDEX IF NOT EXISTS idx_product_tenant_site ON "Product"("tenantId", "siteId");
CREATE INDEX IF NOT EXISTS idx_site_tenant_type ON "Site"("tenantId", "type");
```

### 2. Optimize Tenant Query (2 minutes)
```typescript
// Change in scripts/measure-query-performance.ts line 23
const tenant = await instrumentedPrisma.tenant.findFirst({
  select: { id: true, companyName: true }
});
```

### 3. Run Test Again (1 minute)
```bash
npm run measure-queries
```

**Expected Result**: 50-60% improvement in total execution time!

## 📝 Notes

- The 647ms tenant query is likely a cold start issue
- Product.findMany variance (57ms to 789ms) needs investigation
- Most queries are already well-optimized (<100ms)
- Focus on the top 3 slowest queries for maximum impact

## 🎉 Success Criteria

✅ Tenant.findFirst < 100ms  
✅ Product.findMany average < 100ms  
✅ No queries > 500ms  
✅ Overall average < 100ms  
✅ Total execution time < 1500ms  

Start with the Quick Wins section and you'll see immediate improvements!
