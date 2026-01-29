# Performance Testing Infrastructure

## Overview

The performance testing infrastructure provides comprehensive tools for testing, measuring, and monitoring database performance. It includes workload simulation, baseline establishment, and regression detection capabilities.

## Components

### 1. PerformanceTester

Main service for running performance tests and measuring query response times.

**Key Features:**
- Multi-tenant workload simulation
- Query response time measurement (p50, p95, p99)
- Concurrent connection testing (100+ connections)
- Weighted query execution
- Real-time metrics collection

**Usage Example:**

```typescript
import { PerformanceTester } from '@/lib/services/performance-tester';
import { getOptimizedPrisma } from '@/lib/database/optimized-prisma';

const pool = getOptimizedPrisma().pool;
const tester = new PerformanceTester(pool);

// Run a custom performance test
const result = await tester.runPerformanceTest({
  name: 'Product Query Test',
  queries: [
    {
      sql: 'SELECT * FROM user_products WHERE tenant_id = $1 LIMIT 20',
      params: ['tenant-123'],
      weight: 5, // Execute 5x more frequently
    },
    {
      sql: 'SELECT * FROM competitor_products WHERE tenant_id = $1 LIMIT 10',
      params: ['tenant-123'],
      weight: 2,
    },
  ],
  concurrentConnections: 50,
  durationSeconds: 30,
});

console.log('Test Results:', {
  p50: result.metrics.p50,
  p95: result.metrics.p95,
  p99: result.metrics.p99,
  queriesExecuted: result.queriesExecuted,
});

// Test concurrent connections
const connectionTest = await tester.testConcurrentConnections(100);
console.log('Connection Test:', connectionTest);

// Simulate multi-tenant workload
const workloadResult = await tester.simulateMultiTenantWorkload({
  concurrentConnections: 100,
  queriesPerSecond: 1000,
  durationSeconds: 60,
  tenantCount: 10,
});
```

### 2. PerformanceBaselineManager

Manages performance baselines and detects regressions.

**Key Features:**
- Establish performance baselines for critical queries
- Compare current performance against baselines
- Detect regressions (>20% degradation)
- Store and retrieve baseline data
- Track regression history

**Usage Example:**

```typescript
import { PerformanceBaselineManager } from '@/lib/services/performance-baseline-manager';
import { getOptimizedPrisma } from '@/lib/database/optimized-prisma';

const pool = getOptimizedPrisma().pool;
const manager = new PerformanceBaselineManager(pool);

// Establish a baseline for a critical query
const baseline = await manager.establishBaseline({
  queryFingerprint: 'user_products_active',
  queryName: 'Active User Products',
  sql: 'SELECT * FROM user_products WHERE tenant_id = $1 AND status = $2',
  params: ['tenant-123', 'active'],
  isCritical: true,
});

console.log('Baseline established:', baseline);

// Compare current performance against baseline
const comparison = await manager.compareAgainstBaseline(
  'user_products_active',
  'SELECT * FROM user_products WHERE tenant_id = $1 AND status = $2',
  ['tenant-123', 'active']
);

if (comparison?.isRegression) {
  console.warn('Performance regression detected!', {
    degradation: `${comparison.degradationPercent.toFixed(2)}%`,
    baseline: comparison.baselineP95,
    current: comparison.currentP95,
  });
}

// Get all baselines
const allBaselines = await manager.getAllBaselines();

// Get recent regressions
const regressions = await manager.getRecentRegressions(10);
```

## Database Schema

### performance_baselines

Stores baseline performance metrics for critical queries.

```sql
CREATE TABLE performance_baselines (
  id SERIAL PRIMARY KEY,
  query_fingerprint VARCHAR(255) UNIQUE,
  query_name VARCHAR(255),
  query_text TEXT,
  p50_ms NUMERIC(10, 2),
  p95_ms NUMERIC(10, 2),
  p99_ms NUMERIC(10, 2),
  is_critical BOOLEAN,
  established_at TIMESTAMP,
  updated_at TIMESTAMP,
  created_at TIMESTAMP
);
```

### performance_regressions

Records detected performance regressions.

```sql
CREATE TABLE performance_regressions (
  id SERIAL PRIMARY KEY,
  query_fingerprint VARCHAR(255),
  baseline_p95_ms NUMERIC(10, 2),
  current_p95_ms NUMERIC(10, 2),
  degradation_percent NUMERIC(10, 2),
  detected_at TIMESTAMP,
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP
);
```

### performance_test_results

Stores results from performance test runs.

```sql
CREATE TABLE performance_test_results (
  id SERIAL PRIMARY KEY,
  test_name VARCHAR(255),
  duration_ms INTEGER,
  queries_executed INTEGER,
  success_count INTEGER,
  failure_count INTEGER,
  p50_ms NUMERIC(10, 2),
  p95_ms NUMERIC(10, 2),
  p99_ms NUMERIC(10, 2),
  min_ms NUMERIC(10, 2),
  max_ms NUMERIC(10, 2),
  avg_ms NUMERIC(10, 2),
  concurrent_connections INTEGER,
  test_config JSONB,
  created_at TIMESTAMP
);
```

## Performance Metrics

### Percentiles Explained

- **p50 (Median):** 50% of queries complete faster than this time
- **p95:** 95% of queries complete faster than this time (good for SLA)
- **p99:** 99% of queries complete faster than this time (catches outliers)

### Regression Detection

A regression is detected when:
- Current p95 > Baseline p95 * (1 + REGRESSION_THRESHOLD)
- Default threshold: 20% degradation

## Scripts

### Run Performance Tests

```bash
# Run comprehensive performance test suite
npm run test:performance

# Run specific test
npm run test:performance -- --test="concurrent-connections"
```

### Establish Baselines

```bash
# Establish baselines for all critical queries
npm run baseline:establish

# Establish baseline for specific query
npm run baseline:establish -- --query="user_products_active"
```

### Check for Regressions

```bash
# Check all critical queries for regressions
npm run baseline:check

# Generate regression report
npm run baseline:report
```

## Best Practices

### 1. Baseline Establishment

- Establish baselines during low-traffic periods
- Use production-like data volumes
- Run multiple iterations (default: 1000)
- Update baselines after major optimizations

### 2. Performance Testing

- Test with realistic workloads
- Include multi-tenant scenarios
- Test concurrent connections (100+)
- Monitor during peak hours

### 3. Regression Detection

- Run regression checks before deployments
- Monitor critical queries continuously
- Investigate regressions immediately
- Document resolution steps

### 4. Workload Simulation

- Use weighted queries to match production patterns
- Include read and write operations
- Test with multiple tenant IDs
- Vary connection counts

## Configuration

### Constants (lib/database/optimization-constants.ts)

```typescript
export const PERFORMANCE_TEST_CONCURRENT_CONNECTIONS = 100;
export const PERFORMANCE_REGRESSION_THRESHOLD = 0.2; // 20%
export const PERFORMANCE_BASELINE_SAMPLE_SIZE = 1000;
```

### Environment Variables

```env
# Performance testing
PERFORMANCE_TEST_ENABLED=true
PERFORMANCE_TEST_DURATION=60
PERFORMANCE_TEST_CONNECTIONS=100

# Baseline management
PERFORMANCE_BASELINE_AUTO_UPDATE=false
PERFORMANCE_REGRESSION_ALERT=true
```

## Monitoring

### Metrics to Track

1. **Query Performance**
   - p50, p95, p99 response times
   - Query execution counts
   - Slow query frequency

2. **Connection Performance**
   - Connection establishment time
   - Connection pool utilization
   - Failed connection attempts

3. **Regression Tracking**
   - Number of active regressions
   - Degradation percentages
   - Time to resolution

### Alerting

Set up alerts for:
- Performance regressions detected
- p95 exceeds 1000ms for critical queries
- Connection test failures
- Baseline establishment failures

## Troubleshooting

### High p99 Times

- Check for outliers in execution times
- Review query execution plans
- Check for lock contention
- Monitor connection pool saturation

### Regression False Positives

- Verify baseline was established correctly
- Check for data volume changes
- Review recent schema changes
- Consider adjusting regression threshold

### Test Failures

- Verify database connectivity
- Check connection pool configuration
- Review query syntax
- Monitor system resources

## Integration

### CI/CD Pipeline

```yaml
# .github/workflows/performance-test.yml
name: Performance Tests

on:
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run performance tests
        run: npm run test:performance
      - name: Check for regressions
        run: npm run baseline:check
```

### Monitoring Dashboard

Integrate with monitoring tools:
- Grafana for visualization
- Prometheus for metrics collection
- PagerDuty for alerting
- Datadog for APM

## References

- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Database Performance Testing Best Practices](https://www.postgresql.org/docs/current/performance-tips.html)
- [Percentile Calculation Methods](https://en.wikipedia.org/wiki/Percentile)
