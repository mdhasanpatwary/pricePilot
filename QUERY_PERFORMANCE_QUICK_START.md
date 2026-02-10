# Query Performance Measurement - Quick Start

## 🚀 Run Performance Test (30 seconds)

```bash
npm run measure-queries
```

This will:
1. ✅ Simulate typical application workflows
2. ✅ Measure execution time for each query
3. ✅ Generate performance report
4. ✅ Identify slowest query
5. ✅ Provide optimization suggestions

## 📊 View Results

### Console Output
```
================================================================================
PRISMA QUERY PERFORMANCE REPORT
================================================================================
Total Queries: 156
Total Time: 2847.32ms
Average Query Time: 18.25ms
================================================================================

TOP 20 SLOWEST QUERIES (by average execution time):
--------------------------------------------------------------------------------
Rank  Model.Operation                    Count   Avg(ms)   Min(ms)   Max(ms)
--------------------------------------------------------------------------------
1     Product.findMany                   12      245.67    189.23    312.45
2     ProductMatch.findMany              8       156.34    142.11    178.92
...
```

### JSON Report
```bash
cat query-performance-report.json
```

### API Endpoint
```bash
curl http://localhost:3000/api/v1/debug/query-performance
```

## 🐌 Slowest Query Identified

The script automatically identifies and displays:
- Model name
- Operation type
- Average execution time
- Max execution time
- Execution count
- Optimization suggestions

## 💡 Common Optimizations

### 1. Add Database Index
```sql
CREATE INDEX idx_product_tenant_status ON "Product"("tenantId", "status");
```

### 2. Fix N+1 Query
```typescript
// Before (slow)
const products = await prisma.product.findMany({ take: 10 });
for (const product of products) {
  await prisma.site.findUnique({ where: { id: product.siteId } });
}

// After (fast)
const products = await prisma.product.findMany({
  take: 10,
  include: { site: true }
});
```

### 3. Add Pagination
```typescript
// Before (slow)
const products = await prisma.product.findMany();

// After (fast)
const products = await prisma.product.findMany({
  take: 50,
  skip: page * 50
});
```

## 🔄 Optimization Workflow

```
1. Run: npm run measure-queries
2. Identify slowest query from report
3. Apply optimization (index, refactor, cache)
4. Run: npm run measure-queries (verify improvement)
5. Repeat for next slowest query
```

## 📈 Performance Thresholds

| Time | Status | Action |
|------|--------|--------|
| < 50ms | ✅ Good | Monitor |
| 50-100ms | ℹ️ OK | Consider optimizing |
| 100-500ms | ⚠️ Slow | Optimize |
| > 500ms | 🚨 Critical | Fix immediately |

## 🔧 Use in Your Code

```typescript
// Replace this
import { prisma } from '@/lib/prisma';

// With this (for tracking)
import { instrumentedPrisma as prisma } from '@/lib/instrumented-prisma';

// Access metrics
import { getPerformanceTracker } from '@/lib/middleware/query-performance-tracker';
const tracker = getPerformanceTracker();
tracker.printReport();
```

## 📚 Full Documentation

- **Complete Guide**: `QUERY_PERFORMANCE_MEASUREMENT.md`
- **Code Examples**: `QUERY_PERFORMANCE_EXAMPLES.md`
- **Implementation Details**: `QUERY_PERFORMANCE_SUMMARY.md`

## 🆘 Quick Troubleshooting

**No queries tracked?**
→ Use `instrumentedPrisma` instead of `prisma`

**Need to reset metrics?**
→ `curl http://localhost:3000/api/v1/debug/query-performance?reset=true`

**Want text format?**
→ `curl http://localhost:3000/api/v1/debug/query-performance?format=text`

## ⚡ That's It!

Run `npm run measure-queries` and start optimizing! 🎯
