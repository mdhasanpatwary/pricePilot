# Query Performance Measurement - Implementation Summary

## What Was Built

A comprehensive query performance measurement system for identifying and optimizing slow Prisma database queries.

## Components Created

### 1. Core Infrastructure

**File**: `lib/middleware/query-performance-tracker.ts`
- Prisma Client Extension for query tracking (Prisma 5+ compatible)
- Tracks: count, avg, min, max execution times per query
- Real-time slow query detection (>1000ms)
- Zero-overhead when disabled
- Export capabilities for monitoring systems

**File**: `lib/instrumented-prisma.ts`
- Drop-in replacement for standard Prisma client
- Automatic performance tracking enabled
- Includes encryption middleware
- Connection pooling configured

### 2. Measurement Tools

**File**: `scripts/measure-query-performance.ts`
- Simulates 10 typical application workflows
- Generates comprehensive performance reports
- Identifies slowest queries automatically
- Provides optimization recommendations
- Exports JSON report for analysis

**NPM Script**: `npm run measure-queries`

### 3. API Endpoint

**Endpoint**: `GET /api/v1/debug/query-performance`
- Real-time metrics access
- JSON and text format support
- Reset capability
- Production-safe

**Query Parameters**:
- `?format=json` - JSON response (default)
- `?format=text` - Human-readable text
- `?reset=true` - Reset all metrics

### 4. Documentation

**File**: `QUERY_PERFORMANCE_MEASUREMENT.md`
- Complete usage guide
- Optimization workflow
- Best practices
- Troubleshooting guide

**File**: `QUERY_PERFORMANCE_EXAMPLES.md`
- 10 practical examples
- Real-world use cases
- Integration patterns
- CI/CD integration

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Code                          │
│  (API Routes, Server Actions, Background Jobs)              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Instrumented Prisma Client                      │
│  (lib/instrumented-prisma.ts)                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         Query Performance Extension                          │
│  (Prisma Client Extension - intercepts all queries)         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─── Measure execution time
                     ├─── Record metrics
                     ├─── Detect slow queries
                     └─── Continue to database
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                       │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Performance Tracker                             │
│  (In-memory metrics storage)                                │
│  - Query counts                                             │
│  - Execution times (avg, min, max)                          │
│  - Last execution timestamp                                 │
└─────────────────────┬───────────────────────────────────────┘
                     │
                     ├─── API Endpoint (/api/v1/debug/query-performance)
                     ├─── CLI Tool (npm run measure-queries)
                     └─── Programmatic Access (getPerformanceTracker())
```

### Data Flow

1. **Query Execution**: Application makes Prisma query
2. **Interception**: Extension intercepts before execution
3. **Timing**: Records start time
4. **Execution**: Query runs normally
5. **Recording**: Calculates execution time
6. **Storage**: Updates in-memory metrics
7. **Alert**: Logs if query is slow (>1000ms)
8. **Return**: Returns result to application

### Metrics Collected

For each unique query (Model + Operation):
- **Count**: Number of executions
- **Total Time**: Sum of all execution times
- **Average Time**: Total / Count
- **Min Time**: Fastest execution
- **Max Time**: Slowest execution
- **Last Executed**: Timestamp of last execution

## Usage Guide

### Quick Start

```bash
# 1. Run performance measurement
npm run measure-queries

# 2. View the report in console
# 3. Check query-performance-report.json for details
# 4. Identify slowest query from report
# 5. Optimize based on recommendations
```

### In Your Code

```typescript
// Use instrumented client
import { instrumentedPrisma as prisma } from '@/lib/instrumented-prisma';

// Your queries are automatically tracked
const products = await prisma.product.findMany({
  where: { tenantId },
  take: 50,
});

// Access metrics
import { getPerformanceTracker } from '@/lib/middleware/query-performance-tracker';
const tracker = getPerformanceTracker();
tracker.printReport();
```

### Via API

```bash
# Get current metrics
curl http://localhost:3000/api/v1/debug/query-performance

# Get text report
curl http://localhost:3000/api/v1/debug/query-performance?format=text

# Reset metrics
curl http://localhost:3000/api/v1/debug/query-performance?reset=true
```

## Identifying the Slowest Query

### Method 1: Run Measurement Script

```bash
npm run measure-queries
```

Output shows:
```
🐌 SLOWEST QUERY IDENTIFIED:
   Model: Product
   Operation: findMany
   Average Time: 245.67ms
   Max Time: 312.45ms
   Execution Count: 12
   Total Time: 2948.04ms
```

### Method 2: Check JSON Report

```bash
cat query-performance-report.json | jq '.slowestQueries[0]'
```

### Method 3: API Endpoint

```bash
curl http://localhost:3000/api/v1/debug/query-performance | jq '.data.slowestQueries[0]'
```

## Why Queries Are Slow

### Common Causes & Solutions

#### 1. Missing Database Indexes
**Symptom**: High execution time on filtered queries
**Detection**: Check EXPLAIN ANALYZE output
**Solution**: Add indexes on WHERE clause columns

```sql
-- Check existing indexes
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Product';

-- Add missing indexes
CREATE INDEX idx_product_tenant_status ON "Product"("tenantId", "status");
CREATE INDEX idx_product_site ON "Product"("siteId");
```

#### 2. N+1 Query Problem
**Symptom**: Many queries with same operation
**Detection**: High query count for same model
**Solution**: Use `include` to fetch relations

```typescript
// Before (N+1)
const products = await prisma.product.findMany({ take: 10 });
for (const product of products) {
  await prisma.site.findUnique({ where: { id: product.siteId } });
}
// Result: 11 queries

// After (optimized)
const products = await prisma.product.findMany({
  take: 10,
  include: { site: true }
});
// Result: 1 query
```

#### 3. Fetching Too Much Data
**Symptom**: High execution time without limits
**Detection**: Large result sets
**Solution**: Add pagination and select specific fields

```typescript
// Before
const products = await prisma.product.findMany();

// After
const products = await prisma.product.findMany({
  take: 50,
  skip: page * 50,
  select: { id: true, name: true, price: true }
});
```

#### 4. Complex Nested Relations
**Symptom**: Slow queries with multiple includes
**Detection**: Deep nesting in query
**Solution**: Flatten or split queries

```typescript
// Consider splitting into separate queries
// or using dataloader pattern for batching
```

## Optimization Workflow

```
1. Measure
   ↓
   npm run measure-queries
   ↓
2. Identify
   ↓
   Review slowest queries in report
   ↓
3. Analyze
   ↓
   Check query structure and database indexes
   ↓
4. Optimize
   ↓
   Add indexes, refactor queries, add caching
   ↓
5. Verify
   ↓
   Run measurement again and compare
   ↓
6. Monitor
   ↓
   Set up alerts for production
```

## Performance Thresholds

| Time Range | Status | Action Required |
|------------|--------|-----------------|
| < 50ms | ✅ Good | Monitor as data grows |
| 50-100ms | ℹ️ Acceptable | Consider optimization |
| 100-500ms | ⚠️ Slow | Optimization recommended |
| 500-1000ms | 🚨 Very Slow | Immediate optimization needed |
| > 1000ms | 🔥 Critical | Critical performance issue |

## Production Deployment

### Enable Tracking

```bash
# .env.production
ENABLE_QUERY_TRACKING=true
```

### Monitor via API

```bash
# Set up monitoring to poll this endpoint
curl https://your-app.com/api/v1/debug/query-performance
```

### Export to Monitoring Systems

```typescript
import { getMetricsForMonitoring } from '@/lib/middleware/query-performance-tracker';

// Export to Prometheus, Datadog, New Relic, etc.
const metrics = getMetricsForMonitoring();
```

### Set Up Alerts

Monitor these metrics:
- Average query time > 100ms
- Max query time > 1000ms
- Query count spike (potential N+1)
- Total time increasing over time

## Files Reference

```
lib/
├── middleware/
│   └── query-performance-tracker.ts    # Core tracking logic
├── instrumented-prisma.ts              # Instrumented client
└── prisma.ts                           # Standard client

scripts/
└── measure-query-performance.ts        # Measurement tool

app/api/v1/debug/
└── query-performance/
    └── route.ts                        # API endpoint

Documentation:
├── QUERY_PERFORMANCE_MEASUREMENT.md    # Main guide
├── QUERY_PERFORMANCE_EXAMPLES.md       # Code examples
└── QUERY_PERFORMANCE_SUMMARY.md        # This file
```

## Next Steps

1. **Run Initial Measurement**
   ```bash
   npm run measure-queries
   ```

2. **Review Results**
   - Check console output
   - Review `query-performance-report.json`
   - Identify top 3 slowest queries

3. **Optimize Slowest Query**
   - Add database indexes
   - Refactor query structure
   - Implement caching if appropriate

4. **Verify Improvement**
   ```bash
   npm run measure-queries
   ```

5. **Set Up Monitoring**
   - Enable in production
   - Configure alerts
   - Export to monitoring system

6. **Iterate**
   - Move to next slowest query
   - Repeat optimization process
   - Monitor trends over time

## Support & Troubleshooting

### Common Issues

**Issue**: No queries tracked
**Solution**: Ensure you're using `instrumentedPrisma` not `prisma`

**Issue**: Metrics not resetting
**Solution**: Call `tracker.reset()` or use API endpoint with `?reset=true`

**Issue**: High memory usage
**Solution**: Reset metrics periodically in long-running processes

**Issue**: Inconsistent results
**Solution**: Run multiple times and average results

### Getting Help

1. Check documentation files
2. Review examples in `QUERY_PERFORMANCE_EXAMPLES.md`
3. Examine generated JSON report
4. Check database slow query logs
5. Contact development team with specific metrics

## Conclusion

You now have a complete system to:
- ✅ Measure execution time for every Prisma query
- ✅ Identify the slowest queries automatically
- ✅ Understand why queries are slow
- ✅ Optimize based on data-driven insights
- ✅ Monitor performance in production
- ✅ Prevent performance regressions

Start with `npm run measure-queries` and follow the optimization workflow!
