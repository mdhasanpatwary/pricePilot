---
title: "Performance Metrics"
description: "Monitor and analyze PricePilot system performance metrics"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
subcategory: null
tags: ["performance", "metrics", "monitoring"]
relatedDocs: ["health-checks", "optimization-guide"]
---

# Performance Metrics

Monitor and analyze key performance metrics for PricePilot system health.

## Key Performance Indicators

### API Performance

#### Response Time
- **Target**: <200ms for 95th percentile
- **Critical**: >1000ms
- **Measurement**: Time from request to response

```typescript
// Query API response times
const metrics = await db.requestLog.aggregate({
  where: {
    createdAt: { gte: new Date(Date.now() - 3600000) }
  },
  _avg: { responseTime: true },
  _max: { responseTime: true },
  _min: { responseTime: true }
});
```

#### Throughput
- **Target**: 1000 requests/minute
- **Measurement**: Requests processed per time unit

#### Error Rate
- **Target**: <1%
- **Critical**: >5%
- **Measurement**: Failed requests / total requests

### Database Performance

#### Query Time
- **Target**: <100ms average
- **Critical**: >500ms
- **Measurement**: Time to execute queries

```sql
-- PostgreSQL slow query log
SELECT 
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

#### Connection Pool Usage
- **Target**: <80% utilization
- **Critical**: >95%
- **Measurement**: Active connections / max connections

#### Cache Hit Rate
- **Target**: >80%
- **Measurement**: Cache hits / total queries

### Scraping Performance

#### Success Rate
- **Target**: >95%
- **Warning**: <90%
- **Critical**: <80%
- **Measurement**: Successful scrapes / total attempts

```typescript
const scrapingMetrics = await db.scrapingLog.groupBy({
  by: ['status'],
  where: {
    createdAt: { gte: new Date(Date.now() - 86400000) }
  },
  _count: true
});

const successRate = (
  scrapingMetrics.find(m => m.status === 'success')?._count || 0
) / scrapingMetrics.reduce((sum, m) => sum + m._count, 0) * 100;
```

#### Scraping Duration
- **Target**: <5 seconds per product
- **Critical**: >30 seconds
- **Measurement**: Time to scrape single product

#### Queue Depth
- **Target**: <100 pending jobs
- **Critical**: >1000
- **Measurement**: Unprocessed scraping jobs

### System Resources

#### CPU Usage
- **Target**: <70%
- **Warning**: >80%
- **Critical**: >90%

```bash
# Check CPU usage
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1
```

#### Memory Usage
- **Target**: <80%
- **Warning**: >85%
- **Critical**: >95%

```bash
# Check memory usage
free -m | awk 'NR==2{printf "%.2f%%", $3*100/$2 }'
```

#### Disk Usage
- **Target**: <70%
- **Warning**: >80%
- **Critical**: >90%

```bash
# Check disk usage
df -h | grep '/dev/' | awk '{print $5}' | cut -d'%' -f1
```

## Monitoring Dashboard

### Real-Time Metrics

Access the monitoring dashboard at `/admin/monitoring`:

- **System Health**: Overall system status
- **API Metrics**: Request rates, response times, errors
- **Database Metrics**: Query performance, connection pool
- **Scraping Metrics**: Success rates, queue depth
- **Resource Usage**: CPU, memory, disk

### Historical Trends

View historical performance data:

```typescript
// Get API response time trend
const trend = await db.requestLog.groupBy({
  by: ['createdAt'],
  where: {
    createdAt: { gte: new Date(Date.now() - 86400000) }
  },
  _avg: { responseTime: true },
  orderBy: { createdAt: 'asc' }
});
```

## Alerting Thresholds

### Critical Alerts (P0)

Immediate action required:

- API error rate >5%
- Database connection pool >95%
- Disk usage >90%
- Memory usage >95%
- Scraping success rate <80%

### Warning Alerts (P1)

Action required within 1 hour:

- API response time >500ms (95th percentile)
- Database query time >200ms (average)
- CPU usage >80%
- Memory usage >85%
- Scraping success rate <90%

### Info Alerts (P2)

Monitor and investigate:

- API response time >300ms (95th percentile)
- Cache hit rate <70%
- Queue depth >500
- Disk usage >70%

## Performance Optimization

### Database Optimization

#### Add Indexes
```sql
-- Add index for frequently queried columns
CREATE INDEX idx_products_tenant_status 
ON user_products(tenant_id, status);

-- Add composite index for common queries
CREATE INDEX idx_price_history_product_date 
ON price_history(product_id, recorded_at DESC);
```

#### Optimize Queries
```typescript
// Bad: N+1 query
const products = await db.product.findMany();
for (const product of products) {
  const matches = await db.productMatch.findMany({
    where: { userProductId: product.id }
  });
}

// Good: Single query with include
const products = await db.product.findMany({
  include: { matches: true }
});
```

### Caching Strategy

#### Redis Caching
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Cache frequently accessed data
async function getProduct(id: string) {
  const cached = await redis.get(`product:${id}`);
  if (cached) return JSON.parse(cached);
  
  const product = await db.product.findUnique({ where: { id } });
  await redis.setex(`product:${id}`, 3600, JSON.stringify(product));
  
  return product;
}
```

### API Optimization

#### Response Compression
```typescript
import compression from 'compression';

app.use(compression());
```

#### Pagination
```typescript
// Always paginate large result sets
const products = await db.product.findMany({
  take: 20,
  skip: (page - 1) * 20,
  orderBy: { createdAt: 'desc' }
});
```

## Monitoring Tools

### Application Performance Monitoring

- **Sentry**: Error tracking and performance monitoring
- **New Relic**: Full-stack observability
- **DataDog**: Infrastructure and application monitoring

### Database Monitoring

- **pg_stat_statements**: PostgreSQL query statistics
- **pgAdmin**: Database administration and monitoring
- **Grafana**: Visualization of database metrics

### Infrastructure Monitoring

- **Prometheus**: Metrics collection and storage
- **Grafana**: Metrics visualization
- **AlertManager**: Alert routing and management

## Performance Testing

### Load Testing

Use k6 for load testing:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100, // 100 virtual users
  duration: '5m',
};

export default function () {
  const res = http.get('https://api.pricepilot.com/v1/products');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1);
}
```

### Stress Testing

Test system limits:

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Stay at 100
    { duration: '2m', target: 200 },  // Ramp to 200
    { duration: '5m', target: 200 },  // Stay at 200
    { duration: '2m', target: 0 },    // Ramp down
  ],
};
```

## Best Practices

1. **Monitor Continuously**: Set up automated monitoring
2. **Set Realistic Thresholds**: Based on actual usage patterns
3. **Review Regularly**: Weekly performance reviews
4. **Optimize Proactively**: Don't wait for issues
5. **Document Changes**: Track performance impact of changes
6. **Test Before Deploy**: Load test new features
7. **Plan for Scale**: Design for 10x current load

## Related Documentation

- [Health Checks](health-checks)
- [Performance Optimization](../performance/optimization-guide)
- [Alert Configuration](../alerting/alert-configuration)
