# Performance Monitoring Guide

## Overview

This guide provides instructions for monitoring the performance of the admin dashboard enhancement in production environments.

## Key Performance Indicators (KPIs)

### 1. Response Time Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Dashboard Load Time (p50) | < 1s | > 1.5s |
| Dashboard Load Time (p95) | < 2s | > 2.5s |
| API Response Time (p50) | < 500ms | > 750ms |
| API Response Time (p95) | < 1s | > 1.5s |
| Real-time Update Latency | < 2s | > 3s |
| Metrics Calculation Time | < 500ms | > 750ms |

### 2. Resource Utilization Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Database Connection Pool Usage | < 70% | > 80% |
| Redis Memory Usage | < 70% | > 80% |
| CPU Usage | < 70% | > 85% |
| Memory Usage | < 80% | > 90% |

### 3. Cache Performance Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Cache Hit Rate | > 80% | < 70% |
| Cache Miss Rate | < 20% | > 30% |
| Cache Eviction Rate | < 5% | > 10% |

### 4. Error Rate Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API Error Rate | < 0.1% | > 1% |
| Database Query Errors | < 0.1% | > 0.5% |
| Redis Connection Errors | < 0.1% | > 0.5% |

## Monitoring Implementation

### Application-Level Metrics

#### Express Middleware for Response Time Tracking

```typescript
// lib/middleware/performance-monitoring.ts
import { Request, Response, NextFunction } from 'next';
import { logger } from '@/lib/logger';

export function performanceMonitoring(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const route = req.route?.path || req.path;
    
    // Log performance metrics
    logger.info('API Performance', {
      method: req.method,
      route,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString(),
    });
    
    // Alert on slow requests
    if (duration > 2000) {
      logger.warn('Slow API Request', {
        method: req.method,
        route,
        duration,
      });
    }
  });
  
  next();
}
```

#### Metrics Collection Service

```typescript
// lib/services/performance-metrics.ts
import { logger } from '@/lib/logger';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

class PerformanceMetricsCollector {
  private metrics: PerformanceMetric[] = [];
  
  recordMetric(name: string, value: number, tags?: Record<string, string>) {
    this.metrics.push({
      name,
      value,
      timestamp: new Date(),
      tags,
    });
    
    // Send to monitoring service (e.g., Prometheus, DataDog)
    this.sendToMonitoring({ name, value, tags });
  }
  
  recordDuration(name: string, startTime: number, tags?: Record<string, string>) {
    const duration = Date.now() - startTime;
    this.recordMetric(name, duration, tags);
  }
  
  private sendToMonitoring(metric: Omit<PerformanceMetric, 'timestamp'>) {
    // Implementation depends on monitoring service
    // Example: Prometheus, DataDog, New Relic, etc.
    logger.debug('Performance Metric', metric);
  }
}

export const performanceMetrics = new PerformanceMetricsCollector();
```

#### Usage in Services

```typescript
// Example: MetricsAggregator with performance tracking
async getDashboardMetrics(): Promise<DashboardMetrics> {
  const startTime = Date.now();
  
  try {
    const metrics = await this.calculateMetrics();
    
    // Record successful metric calculation
    performanceMetrics.recordDuration('dashboard_metrics_calculation', startTime, {
      status: 'success',
    });
    
    return metrics;
  } catch (error) {
    // Record failed metric calculation
    performanceMetrics.recordDuration('dashboard_metrics_calculation', startTime, {
      status: 'error',
    });
    
    throw error;
  }
}
```

### Database Performance Monitoring

#### Slow Query Logging

```typescript
// lib/prisma.ts - Add query logging
import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

export const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
});

// Log slow queries
prisma.$on('query', (e) => {
  if (e.duration > 1000) { // Queries taking more than 1 second
    logger.warn('Slow Database Query', {
      query: e.query,
      duration: e.duration,
      params: e.params,
    });
  }
});
```

#### Connection Pool Monitoring

```typescript
// lib/services/database-monitoring.ts
import { prisma } from '@/lib/prisma';
import { performanceMetrics } from './performance-metrics';

export async function monitorDatabasePool() {
  // Get pool statistics (implementation depends on database driver)
  const poolStats = await getPoolStatistics();
  
  performanceMetrics.recordMetric('db_pool_active', poolStats.active);
  performanceMetrics.recordMetric('db_pool_idle', poolStats.idle);
  performanceMetrics.recordMetric('db_pool_waiting', poolStats.waiting);
  
  const utilizationPercent = (poolStats.active / poolStats.max) * 100;
  performanceMetrics.recordMetric('db_pool_utilization', utilizationPercent);
  
  if (utilizationPercent > 80) {
    logger.warn('High Database Pool Utilization', {
      utilization: utilizationPercent,
      active: poolStats.active,
      max: poolStats.max,
    });
  }
}

// Run monitoring every 30 seconds
setInterval(monitorDatabasePool, 30000);
```

### Redis Performance Monitoring

```typescript
// lib/services/redis-monitoring.ts
import { redisClient } from '@/lib/redis';
import { performanceMetrics } from './performance-metrics';
import { logger } from '@/lib/logger';

export async function monitorRedis() {
  try {
    const info = await redisClient.info('memory');
    const stats = parseRedisInfo(info);
    
    performanceMetrics.recordMetric('redis_memory_used', stats.used_memory);
    performanceMetrics.recordMetric('redis_memory_peak', stats.used_memory_peak);
    
    const utilizationPercent = (stats.used_memory / stats.maxmemory) * 100;
    performanceMetrics.recordMetric('redis_memory_utilization', utilizationPercent);
    
    if (utilizationPercent > 80) {
      logger.warn('High Redis Memory Usage', {
        utilization: utilizationPercent,
        used: stats.used_memory,
        max: stats.maxmemory,
      });
    }
    
    // Monitor cache hit rate
    const cacheStats = await getCacheStatistics();
    const hitRate = (cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100;
    performanceMetrics.recordMetric('cache_hit_rate', hitRate);
    
    if (hitRate < 70) {
      logger.warn('Low Cache Hit Rate', {
        hitRate,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
      });
    }
  } catch (error) {
    logger.error('Redis Monitoring Error', { error });
  }
}

// Run monitoring every 30 seconds
setInterval(monitorRedis, 30000);
```

### Cache Performance Monitoring

```typescript
// lib/services/cache-monitoring.ts
import { MetricsAggregator } from './metrics-aggregator';
import { performanceMetrics } from './performance-metrics';

export function monitorCachePerformance() {
  const aggregator = MetricsAggregator.getInstance();
  const cacheStats = aggregator.getCacheStats();
  
  performanceMetrics.recordMetric('cache_size', cacheStats.size);
  performanceMetrics.recordMetric('cache_keys', cacheStats.keys.length);
  
  // Track cache operations
  const originalGetCached = aggregator['getCached'];
  aggregator['getCached'] = function<T>(key: string): T | null {
    const result = originalGetCached.call(this, key);
    
    if (result !== null) {
      performanceMetrics.recordMetric('cache_hit', 1, { key });
    } else {
      performanceMetrics.recordMetric('cache_miss', 1, { key });
    }
    
    return result;
  };
}
```

## Monitoring Dashboard Examples

### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "Admin Dashboard Performance",
    "panels": [
      {
        "title": "Dashboard Load Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, dashboard_load_time_bucket)",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.50, dashboard_load_time_bucket)",
            "legendFormat": "p50"
          }
        ],
        "thresholds": [
          { "value": 2000, "color": "red" },
          { "value": 1500, "color": "yellow" }
        ]
      },
      {
        "title": "API Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, api_response_time_bucket)",
            "legendFormat": "{{route}} p95"
          }
        ]
      },
      {
        "title": "Database Pool Utilization",
        "targets": [
          {
            "expr": "db_pool_utilization",
            "legendFormat": "Utilization %"
          }
        ],
        "thresholds": [
          { "value": 80, "color": "red" },
          { "value": 70, "color": "yellow" }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "cache_hit_rate",
            "legendFormat": "Hit Rate %"
          }
        ],
        "thresholds": [
          { "value": 70, "color": "red" },
          { "value": 80, "color": "yellow" }
        ]
      }
    ]
  }
}
```

### Prometheus Metrics Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'admin-dashboard'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
```

### Alert Rules

```yaml
# alerts.yml
groups:
  - name: performance
    rules:
      - alert: HighDashboardLoadTime
        expr: histogram_quantile(0.95, dashboard_load_time_bucket) > 2000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High dashboard load time"
          description: "Dashboard load time p95 is {{ $value }}ms"
      
      - alert: HighDatabasePoolUtilization
        expr: db_pool_utilization > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database pool utilization"
          description: "Database pool utilization is {{ $value }}%"
      
      - alert: LowCacheHitRate
        expr: cache_hit_rate < 70
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value }}%"
      
      - alert: HighErrorRate
        expr: rate(api_errors_total[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High API error rate"
          description: "API error rate is {{ $value }}"
```

## Performance Testing in Production

### Synthetic Monitoring

```typescript
// scripts/synthetic-monitoring.ts
import { MetricsAggregator } from '@/lib/services/metrics-aggregator';
import { SessionTracker } from '@/lib/services/session-tracker';
import { performanceMetrics } from '@/lib/services/performance-metrics';

async function runSyntheticTests() {
  const aggregator = MetricsAggregator.getInstance();
  const tracker = SessionTracker.getInstance();
  
  // Test 1: Dashboard load time
  const dashboardStart = Date.now();
  await aggregator.getDashboardMetrics();
  performanceMetrics.recordDuration('synthetic_dashboard_load', dashboardStart);
  
  // Test 2: Session retrieval
  const sessionStart = Date.now();
  await tracker.getActiveSessions();
  performanceMetrics.recordDuration('synthetic_session_retrieval', sessionStart);
  
  // Test 3: Metrics calculation
  const metricsStart = Date.now();
  await aggregator.getTimeSeriesData('requests', '24h');
  performanceMetrics.recordDuration('synthetic_metrics_calculation', metricsStart);
}

// Run synthetic tests every 5 minutes
setInterval(runSyntheticTests, 300000);
```

### Real User Monitoring (RUM)

```typescript
// components/performance-monitor.tsx
'use client';

import { useEffect } from 'react';

export function PerformanceMonitor() {
  useEffect(() => {
    // Monitor page load performance
    if (typeof window !== 'undefined' && window.performance) {
      const perfData = window.performance.timing;
      const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      
      // Send to analytics
      fetch('/api/analytics/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: 'page_load_time',
          value: pageLoadTime,
          page: window.location.pathname,
        }),
      });
    }
  }, []);
  
  return null;
}
```

## Troubleshooting Performance Issues

### High Dashboard Load Time

1. **Check database query performance**
   ```sql
   SELECT query, calls, mean_exec_time, max_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

2. **Verify cache hit rate**
   ```typescript
   const stats = metricsAggregator.getCacheStats();
   console.log('Cache size:', stats.size);
   console.log('Cache keys:', stats.keys);
   ```

3. **Check for missing indexes**
   ```sql
   SELECT schemaname, tablename, indexname
   FROM pg_indexes
   WHERE tablename IN ('ScrapingSession', 'ScrapingMetrics', 'ProxyMetrics');
   ```

### High Database Pool Utilization

1. **Increase pool size** (if resources allow)
2. **Optimize long-running queries**
3. **Implement connection pooling at application level**
4. **Add read replicas** for read-heavy workloads

### Low Cache Hit Rate

1. **Increase cache TTL** for stable data
2. **Implement cache warming** for frequently accessed data
3. **Review cache invalidation logic**
4. **Increase cache size** (Redis memory)

## Best Practices

1. **Monitor continuously** - Set up automated monitoring and alerting
2. **Establish baselines** - Know your normal performance metrics
3. **Test regularly** - Run performance tests before and after changes
4. **Document incidents** - Keep a log of performance issues and resolutions
5. **Review metrics** - Regularly review performance trends
6. **Optimize proactively** - Address issues before they become critical
7. **Capacity planning** - Monitor growth trends and plan for scaling

## Additional Resources

- [Performance Test Guide](../__tests__/lib/services/PERFORMANCE_TEST_GUIDE.md)
- [Performance Test Results](../PERFORMANCE_TEST_RESULTS.md)
- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Redis Performance Tuning](https://redis.io/docs/management/optimization/)
