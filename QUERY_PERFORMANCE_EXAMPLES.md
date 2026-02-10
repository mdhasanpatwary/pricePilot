# Query Performance Measurement Examples

## Example 1: Basic Usage in API Route

```typescript
// app/api/v1/products/route.ts
import { instrumentedPrisma as prisma } from '@/lib/instrumented-prisma';
import { getPerformanceTracker } from '@/lib/middleware/query-performance-tracker';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = 'your-tenant-id'; // From auth
  
  // This query will be automatically tracked
  const products = await prisma.product.findMany({
    where: { tenantId },
    take: 50,
  });
  
  // Optional: Log metrics for this request
  if (process.env.NODE_ENV === 'development') {
    const tracker = getPerformanceTracker();
    const metrics = tracker.getQueryMetrics('Product', 'findMany');
    console.log('Product.findMany metrics:', metrics);
  }
  
  return NextResponse.json({ products });
}
```

## Example 2: Measuring Specific Workflow

```typescript
// scripts/measure-dashboard-load.ts
import { instrumentedPrisma as prisma } from '@/lib/instrumented-prisma';
import { getPerformanceTracker } from '@/lib/middleware/query-performance-tracker';

async function measureDashboardLoad(tenantId: string) {
  const tracker = getPerformanceTracker();
  tracker.reset(); // Start fresh
  
  // Simulate dashboard load
  const [sites, products, matches] = await Promise.all([
    prisma.site.findMany({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId } }),
    prisma.productMatch.count({ where: { userProduct: { tenantId } } }),
  ]);
  
  // Get results
  const report = tracker.getReport();
  console.log(`Dashboard loaded in ${report.totalTime.toFixed(2)}ms`);
  console.log(`Total queries: ${report.totalQueries}`);
  
  return report;
}
```

## Example 3: Comparing Before/After Optimization

```typescript
// scripts/compare-optimization.ts
import { instrumentedPrisma as prisma } from '@/lib/instrumented-prisma';
import { getPerformanceTracker } from '@/lib/middleware/query-performance-tracker';

async function compareOptimization(tenantId: string) {
  const tracker = getPerformanceTracker();
  
  // BEFORE: N+1 query problem
  console.log('Testing BEFORE optimization...');
  tracker.reset();
  
  const productsBefore = await prisma.product.findMany({
    where: { tenantId },
    take: 10,
  });
  
  for (const product of productsBefore) {
    await prisma.site.findUnique({ where: { id: product.siteId } });
  }
  
  const beforeReport = tracker.getReport();
  console.log(`BEFORE: ${beforeReport.totalQueries} queries in ${beforeReport.totalTime.toFixed(2)}ms`);
  
  // AFTER: Optimized with include
  console.log('\nTesting AFTER optimization...');
  tracker.reset();
  
  const productsAfter = await prisma.product.findMany({
    where: { tenantId },
    take: 10,
    include: { site: true },
  });
  
  const afterReport = tracker.getReport();
  console.log(`AFTER: ${afterReport.totalQueries} queries in ${afterReport.totalTime.toFixed(2)}ms`);
  
  // Calculate improvement
  const improvement = ((beforeReport.totalTime - afterReport.totalTime) / beforeReport.totalTime) * 100;
  console.log(`\nImprovement: ${improvement.toFixed(1)}% faster`);
  console.log(`Queries reduced: ${beforeReport.totalQueries} → ${afterReport.totalQueries}`);
}
```

## Example 4: Real-Time Monitoring Dashboard

```typescript
// app/api/v1/admin/performance/route.ts
import { NextResponse } from 'next/server';
import { getPerformanceTracker } from '@/lib/middleware/query-performance-tracker';

export async function GET() {
  const tracker = getPerformanceTracker();
  const report = tracker.getReport();
  
  // Find queries that need attention
  const slowQueries = report.slowestQueries.filter(q => q.avgTime > 100);
  const frequentQueries = Array.from(report.queryBreakdown.values())
    .filter(q => q.count > 100)
    .sort((a, b) => b.count - a.count);
  
  return NextResponse.json({
    summary: {
      totalQueries: report.totalQueries,
      totalTime: report.totalTime,
      avgQueryTime: report.avgQueryTime,
    },
    alerts: {
      slowQueries: slowQueries.length,
      frequentQueries: frequentQueries.length,
    },
    slowQueries: slowQueries.slice(0, 5),
    frequentQueries: frequentQueries.slice(0, 5),
  });
}
```

## Example 5: Automated Performance Testing

```typescript
// scripts/performance-test.ts
import { instrumentedPrisma as prisma } from '@/lib/instrumented-prisma';
import { getPerformanceTracker } from '@/lib/middleware/query-performance-tracker';

async function runPerformanceTest() {
  const tracker = getPerformanceTracker();
  const results: any[] = [];
  
  // Test 1: Simple query
  tracker.reset();
  await prisma.product.findMany({ take: 10 });
  results.push({
    test: 'Simple findMany',
    ...tracker.getReport(),
  });
  
  // Test 2: With relations
  tracker.reset();
  await prisma.product.findMany({
    take: 10,
    include: { site: true, userProductMatches: true },
  });
  results.push({
    test: 'With relations',
    ...tracker.getReport(),
  });
  
  // Test 3: Complex filter
  tracker.reset();
  await prisma.product.findMany({
    where: {
      price: { gte: 100, lte: 500 },
      name: { contains: 'Samsung' },
    },
    take: 10,
  });
  results.push({
    test: 'Complex filter',
    ...tracker.getReport(),
  });
  
  // Compare results
  console.log('\nPerformance Test Results:');
  console.log('='.repeat(80));
  results.forEach(r => {
    console.log(`${r.test}: ${r.totalTime.toFixed(2)}ms (${r.totalQueries} queries)`);
  });
  
  // Check for regressions
  const baseline = results[0].totalTime;
  results.forEach((r, i) => {
    if (i > 0) {
      const diff = ((r.totalTime - baseline) / baseline) * 100;
      if (diff > 200) {
        console.warn(`⚠️  ${r.test} is ${diff.toFixed(0)}% slower than baseline!`);
      }
    }
  });
}
```

## Example 6: Export Metrics to Prometheus

```typescript
// app/api/metrics/route.ts
import { NextResponse } from 'next/server';
import { getMetricsForMonitoring } from '@/lib/middleware/query-performance-tracker';

export async function GET() {
  const metrics = getMetricsForMonitoring();
  
  // Convert to Prometheus format
  let output = '';
  
  output += `# HELP prisma_queries_total Total number of Prisma queries executed\n`;
  output += `# TYPE prisma_queries_total counter\n`;
  output += `prisma_queries_total ${metrics.prisma_queries_total}\n\n`;
  
  output += `# HELP prisma_queries_duration_ms_total Total duration of all queries in milliseconds\n`;
  output += `# TYPE prisma_queries_duration_ms_total counter\n`;
  output += `prisma_queries_duration_ms_total ${metrics.prisma_queries_duration_ms_total}\n\n`;
  
  output += `# HELP prisma_queries_duration_ms_avg Average query duration in milliseconds\n`;
  output += `# TYPE prisma_queries_duration_ms_avg gauge\n`;
  output += `prisma_queries_duration_ms_avg ${metrics.prisma_queries_duration_ms_avg}\n\n`;
  
  metrics.prisma_queries_by_operation.forEach(op => {
    output += `prisma_query_duration_ms{model="${op.model}",operation="${op.operation}"} ${op.avg_duration_ms}\n`;
    output += `prisma_query_count{model="${op.model}",operation="${op.operation}"} ${op.count}\n`;
  });
  
  return new NextResponse(output, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
```

## Example 7: Conditional Tracking

```typescript
// lib/conditional-prisma.ts
import { prisma } from '@/lib/prisma';
import { instrumentedPrisma } from '@/lib/instrumented-prisma';

// Use instrumented client only in development or when explicitly enabled
export const db = process.env.ENABLE_QUERY_TRACKING === 'true' 
  ? instrumentedPrisma 
  : prisma;
```

## Example 8: Testing Query Performance in CI/CD

```typescript
// scripts/ci-performance-check.ts
import { instrumentedPrisma as prisma } from '@/lib/instrumented-prisma';
import { getPerformanceTracker } from '@/lib/middleware/query-performance-tracker';

async function checkPerformance() {
  const tracker = getPerformanceTracker();
  
  // Run typical queries
  await prisma.product.findMany({ take: 50 });
  await prisma.site.findMany();
  await prisma.productMatch.findMany({ take: 50 });
  
  const report = tracker.getReport();
  
  // Fail CI if queries are too slow
  const slowQueries = report.slowestQueries.filter(q => q.avgTime > 500);
  
  if (slowQueries.length > 0) {
    console.error('❌ Performance check failed!');
    console.error('Slow queries detected:');
    slowQueries.forEach(q => {
      console.error(`  ${q.model}.${q.operation}: ${q.avgTime.toFixed(2)}ms`);
    });
    process.exit(1);
  }
  
  console.log('✅ Performance check passed!');
  console.log(`Average query time: ${report.avgQueryTime.toFixed(2)}ms`);
}

checkPerformance();
```

## Example 9: Per-Request Tracking

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getPerformanceTracker } from '@/lib/middleware/query-performance-tracker';

export function middleware(request: NextRequest) {
  const tracker = getPerformanceTracker();
  const startMetrics = tracker.getReport();
  
  const response = NextResponse.next();
  
  // Add query metrics to response headers (development only)
  if (process.env.NODE_ENV === 'development') {
    const endMetrics = tracker.getReport();
    const queriesInRequest = endMetrics.totalQueries - startMetrics.totalQueries;
    const timeInRequest = endMetrics.totalTime - startMetrics.totalTime;
    
    response.headers.set('X-Query-Count', queriesInRequest.toString());
    response.headers.set('X-Query-Time', timeInRequest.toFixed(2));
  }
  
  return response;
}
```

## Example 10: Alerting on Slow Queries

```typescript
// lib/query-alerting.ts
import { getPerformanceTracker } from '@/lib/middleware/query-performance-tracker';

export function setupQueryAlerting() {
  const tracker = getPerformanceTracker();
  
  // Check every 5 minutes
  setInterval(() => {
    const report = tracker.getReport();
    const slowQueries = report.slowestQueries.filter(q => q.avgTime > 1000);
    
    if (slowQueries.length > 0) {
      // Send alert (email, Slack, PagerDuty, etc.)
      console.error('🚨 SLOW QUERY ALERT');
      slowQueries.forEach(q => {
        console.error(`${q.model}.${q.operation}: ${q.avgTime.toFixed(2)}ms avg`);
      });
      
      // Send to monitoring service
      // await sendAlert({ type: 'slow_query', queries: slowQueries });
    }
  }, 5 * 60 * 1000);
}
```

## Running the Examples

```bash
# Run the main measurement script
npm run measure-queries

# Run custom measurement
tsx scripts/measure-dashboard-load.ts

# Run comparison test
tsx scripts/compare-optimization.ts

# Run performance test suite
tsx scripts/performance-test.ts

# Check performance in CI
tsx scripts/ci-performance-check.ts
```

## Tips for Effective Measurement

1. **Use realistic data volumes**: Test with production-like data sizes
2. **Warm up the database**: Run queries once before measuring
3. **Test under load**: Simulate concurrent requests
4. **Compare over time**: Track metrics across releases
5. **Focus on P95/P99**: Average can hide outliers
6. **Test different scenarios**: Empty DB, full DB, concurrent users
7. **Monitor in production**: Use the API endpoint for real-time data
8. **Set up alerts**: Don't wait for users to complain
9. **Document baselines**: Know what "good" looks like
10. **Iterate**: Measure → Optimize → Measure again
