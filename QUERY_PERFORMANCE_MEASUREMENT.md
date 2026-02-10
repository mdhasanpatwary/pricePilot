# Query Performance Measurement Guide

## Overview

This guide explains how to measure average execution time for each Prisma query in your application to identify performance bottlenecks and optimize database operations.

## Architecture

### Components

1. **Query Performance Tracker** (`lib/middleware/query-performance-tracker.ts`)
   - Uses Prisma Client Extensions (Prisma 5+ compatible)
   - Tracks execution time for every query
   - Maintains metrics: count, avg, min, max, total time
   - Zero performance overhead when disabled

2. **Instrumented Prisma Client** (`lib/instrumented-prisma.ts`)
   - Drop-in replacement for standard Prisma client
   - Automatically tracks all queries
   - Includes encryption middleware
   - Connection pooling configured

3. **Performance Measurement Script** (`scripts/measure-query-performance.ts`)
   - Simulates typical application workflows
   - Generates comprehensive performance reports
   - Identifies slowest queries
   - Provides optimization recommendations

4. **API Endpoint** (`/api/v1/debug/query-performance`)
   - Real-time metrics access
   - JSON and text formats
   - Reset capability
   - Production-safe

## Quick Start

### 1. Run Performance Measurement

```bash
npm run measure-queries
```

This will:
- Simulate 10 typical application workflows
- Measure execution time for each query
- Generate a detailed performance report
- Save results to `query-performance-report.json`
- Identify the slowest query with optimization suggestions

### 2. View Real-Time Metrics via API

```bash
# Get JSON report
curl http://localhost:3000/api/v1/debug/query-performance

# Get text report
curl http://localhost:3000/api/v1/debug/query-performance?format=text

# Reset metrics
curl http://localhost:3000/api/v1/debug/query-performance?reset=true
```

### 3. Use Instrumented Client in Your Code

Replace your Prisma import:

```typescript
// Before
import { prisma } from '@/lib/prisma';

// After (for performance tracking)
import { instrumentedPrisma as prisma } from '@/lib/instrumented-prisma';
```

Then access metrics:

```typescript
import { getPerformanceTracker } from '@/lib/middleware/query-performance-tracker';

// Get report
const tracker = getPerformanceTracker();
const report = tracker.getReport();

// Print to console
tracker.printReport();

// Get specific query metrics
const metrics = tracker.getQueryMetrics('Product', 'findMany');
```

## Understanding the Report

### Sample Output

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
3     PriceHistory.findMany              5       98.45     87.32     115.67
4     Site.findMany                      10      45.23     38.91     52.34
5     Product.count                      15      32.18     28.45     38.92
...
================================================================================
```

### Metrics Explained

- **Count**: Number of times this query was executed
- **Avg(ms)**: Average execution time in milliseconds
- **Min(ms)**: Fastest execution time
- **Max(ms)**: Slowest execution time
- **Total Time**: Sum of all executions (Count × Avg)

### Performance Thresholds

- **< 50ms**: ✅ Good performance
- **50-100ms**: ℹ️ Acceptable, monitor as data grows
- **100-500ms**: ⚠️ Slow, optimization recommended
- **> 500ms**: 🚨 Very slow, immediate optimization needed

## Identifying Slow Queries

### Common Causes

1. **Missing Indexes**
   - Symptom: High execution time on filtered queries
   - Solution: Add database indexes on WHERE clause columns
   ```sql
   CREATE INDEX idx_products_tenant_status ON "Product"("tenantId", "status");
   ```

2. **N+1 Query Problem**
   - Symptom: Many queries with same operation
   - Solution: Use `include` or `select` to fetch relations in one query
   ```typescript
   // Bad (N+1)
   const products = await prisma.product.findMany();
   for (const product of products) {
     const site = await prisma.site.findUnique({ where: { id: product.siteId } });
   }
   
   // Good (single query)
   const products = await prisma.product.findMany({
     include: { site: true }
   });
   ```

3. **Fetching Too Much Data**
   - Symptom: High execution time on findMany without limits
   - Solution: Add pagination and select only needed fields
   ```typescript
   // Bad
   const products = await prisma.product.findMany();
   
   // Good
   const products = await prisma.product.findMany({
     take: 50,
     skip: page * 50,
     select: { id: true, name: true, price: true }
   });
   ```

4. **Complex Nested Relations**
   - Symptom: Slow queries with multiple includes
   - Solution: Flatten queries or use separate queries with caching
   ```typescript
   // Consider splitting into multiple queries
   // or using dataloader pattern
   ```

## Optimization Workflow

### Step 1: Identify Slowest Query

Run the measurement script and look at the top of the report:

```bash
npm run measure-queries
```

### Step 2: Analyze the Query

Check the generated `query-performance-report.json`:

```json
{
  "slowestQueries": [
    {
      "model": "Product",
      "operation": "findMany",
      "count": 12,
      "avgTime": 245.67,
      "maxTime": 312.45
    }
  ]
}
```

### Step 3: Check Database Indexes

```sql
-- List all indexes on Product table
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'Product';
```

### Step 4: Add Missing Indexes

Based on your WHERE clauses:

```sql
-- For queries filtering by tenantId and status
CREATE INDEX idx_product_tenant_status ON "Product"("tenantId", "status");

-- For queries filtering by siteId
CREATE INDEX idx_product_site ON "Product"("siteId");

-- For queries with date ranges
CREATE INDEX idx_price_history_recorded ON "PriceHistory"("recordedAt" DESC);
```

### Step 5: Verify Improvement

Run the measurement again and compare:

```bash
npm run measure-queries
```

## Production Monitoring

### Enable in Production

The instrumented client has minimal overhead but you may want to enable it selectively:

```typescript
// lib/instrumented-prisma.ts
import { getPerformanceTracker } from './middleware/query-performance-tracker';

// Enable/disable based on environment
const tracker = getPerformanceTracker();
tracker.setEnabled(process.env.ENABLE_QUERY_TRACKING === 'true');
```

### Export Metrics to Monitoring Systems

```typescript
import { getMetricsForMonitoring } from '@/lib/middleware/query-performance-tracker';

// Export to Prometheus, Datadog, etc.
const metrics = getMetricsForMonitoring();
```

### Set Up Alerts

Monitor these metrics:
- `prisma_queries_duration_ms_avg` > 100ms
- `prisma_queries_total` spike (potential N+1)
- Individual query `max_duration_ms` > 1000ms

## Simulated Workflows

The measurement script simulates these typical workflows:

1. **Dashboard Load**: Sites, products, matches counts
2. **Product Comparison Table**: Products with nested matches
3. **Price History**: Historical price data
4. **Competitor Analysis**: Competitor products with matches
5. **Pricing Rules**: Active pricing rules
6. **Audit Logs**: Recent audit entries
7. **Complex Aggregations**: Group by and averages
8. **Search/Filter**: Text search and range filters
9. **Bulk Operations**: Multiple products by IDs
10. **Nested Relations**: Sites with products and rules

## API Reference

### GET /api/v1/debug/query-performance

Returns current query performance metrics.

**Query Parameters:**
- `format`: `json` (default) or `text`
- `reset`: `true` to reset all metrics

**Response (JSON):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalQueries": 156,
      "totalTime": 2847.32,
      "avgQueryTime": 18.25
    },
    "slowestQueries": [...],
    "allQueries": [...]
  }
}
```

## Best Practices

### 1. Regular Measurement
- Run performance tests weekly
- Compare trends over time
- Monitor as data volume grows

### 2. Index Strategy
- Index all foreign keys
- Index WHERE clause columns
- Use composite indexes for multi-column filters
- Don't over-index (impacts write performance)

### 3. Query Optimization
- Use `select` to fetch only needed fields
- Implement pagination (take/skip)
- Avoid N+1 with proper includes
- Cache frequently accessed data

### 4. Monitoring
- Set up alerts for slow queries
- Track P95 and P99 percentiles
- Monitor query count trends
- Review slow query logs regularly

## Troubleshooting

### High Execution Times

**Problem**: All queries are slow

**Solutions:**
- Check database connection pool settings
- Verify database server resources (CPU, memory)
- Check network latency to database
- Review concurrent connection count

### Inconsistent Performance

**Problem**: Same query varies widely (high max vs avg)

**Solutions:**
- Check for database locks
- Review concurrent query load
- Verify connection pool isn't exhausted
- Check for background maintenance tasks

### Memory Issues

**Problem**: Performance degrades over time

**Solutions:**
- Implement proper pagination
- Limit result set sizes
- Clear unused connections
- Review memory leaks in application code

## Additional Resources

- [Prisma Performance Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [PostgreSQL Index Documentation](https://www.postgresql.org/docs/current/indexes.html)
- [Database Optimization Guide](./database-schema-guidelines.md)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the generated `query-performance-report.json`
3. Examine slow query logs in the database
4. Contact the development team with specific metrics
