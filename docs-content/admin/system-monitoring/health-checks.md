---
title: "System Health Checks"
description: "Monitor and maintain PricePilot system health"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
subcategory: null
tags: ["monitoring", "health", "uptime", "diagnostics"]
relatedDocs: ["performance-metrics", "alert-configuration"]
---

# System Health Checks

Comprehensive guide to monitoring PricePilot system health.

## Health Check Endpoints

### System Status

```http
GET /api/v1/admin/health
Authorization: Bearer ADMIN_TOKEN

Response:
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.5.0",
  "uptime": 864000, // seconds
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "queue": "healthy",
    "scraping": "healthy"
  }
}
```

### Component Health

Monitor individual components:

```typescript
interface HealthCheck {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number; // milliseconds
  lastCheck: Date;
  details?: Record<string, any>;
}
```

## Database Health

### Connection Pool Status

```sql
-- Check active connections
SELECT 
  count(*) as active_connections,
  max_connections
FROM pg_stat_activity
CROSS JOIN (SELECT setting::int as max_connections FROM pg_settings WHERE name = 'max_connections') s;
```

### Query Performance

```sql
-- Identify slow queries
SELECT 
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000 -- queries taking >1 second
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Database Size

```sql
-- Monitor database growth
SELECT 
  pg_size_pretty(pg_database_size('pricepilot')) as database_size,
  pg_size_pretty(pg_total_relation_size('user_products')) as products_table_size,
  pg_size_pretty(pg_total_relation_size('price_history')) as history_table_size;
```

## Redis Health

### Connection Status

```bash
# Check Redis connectivity
redis-cli ping
# Expected: PONG
```

### Memory Usage

```bash
# Check memory usage
redis-cli INFO memory

# Key metrics:
# - used_memory_human
# - used_memory_peak_human
# - mem_fragmentation_ratio
```

### Cache Hit Rate

```typescript
// Monitor cache effectiveness
{
  hits: 95000,
  misses: 5000,
  hitRate: 0.95, // 95%
  // Target: >90% hit rate
}
```

## Queue Health

### Queue Status

```typescript
// Check queue metrics
{
  queues: {
    scraping: {
      waiting: 150,
      active: 10,
      completed: 5000,
      failed: 25,
      delayed: 5
    },
    priceUpdates: {
      waiting: 50,
      active: 5,
      completed: 10000,
      failed: 10,
      delayed: 0
    }
  }
}
```

### Worker Status

```bash
# Check worker processes
pm2 list

# Expected output:
# ┌─────┬──────────┬─────────┬─────────┐
# │ id  │ name     │ status  │ cpu     │
# ├─────┼──────────┼─────────┼─────────┤
# │ 0   │ scraper  │ online  │ 15%     │
# │ 1   │ updater  │ online  │ 10%     │
# └─────┴──────────┴─────────┴─────────┘
```

### Failed Jobs

```typescript
// Monitor failed jobs
{
  totalFailed: 35,
  recentFailures: [
    {
      jobId: "12345",
      queue: "scraping",
      error: "Timeout after 30s",
      timestamp: "2024-01-15T10:25:00Z",
      attempts: 3
    }
  ],
  failureRate: 0.003 // 0.3%
  // Target: <1% failure rate
}
```

## API Health

### Response Times

```typescript
// Monitor API performance
{
  endpoints: {
    "/api/v1/products": {
      avgResponseTime: 150, // ms
      p95ResponseTime: 300, // ms
      p99ResponseTime: 500, // ms
      requestCount: 10000,
      errorRate: 0.001 // 0.1%
    },
    "/api/v1/competitors": {
      avgResponseTime: 200,
      p95ResponseTime: 400,
      p99ResponseTime: 600,
      requestCount: 5000,
      errorRate: 0.002
    }
  }
}
```

### Error Rates

```typescript
// Track error rates by endpoint
{
  period: "1h",
  errors: {
    "4xx": 50,  // Client errors
    "5xx": 5,   // Server errors
    total: 55,
    rate: 0.0055 // 0.55%
  },
  // Target: <1% error rate
}
```

## Scraping Health

### Scraper Status

```typescript
// Monitor scraping operations
{
  activeScrapers: 10,
  queuedJobs: 150,
  completedToday: 5000,
  failedToday: 25,
  successRate: 0.995, // 99.5%
  avgScrapingTime: 2500, // ms
  competitors: {
    total: 50,
    active: 48,
    failing: 2,
    lastScraped: "2024-01-15T10:20:00Z"
  }
}
```

### Scraping Errors

```typescript
// Track scraping issues
{
  errors: [
    {
      competitor: "competitor.com",
      error: "Timeout",
      count: 5,
      lastOccurred: "2024-01-15T10:25:00Z"
    },
    {
      competitor: "another-site.com",
      error: "CAPTCHA detected",
      count: 3,
      lastOccurred: "2024-01-15T10:20:00Z"
    }
  ]
}
```

## System Resources

### CPU Usage

```bash
# Monitor CPU usage
top -b -n 1 | grep "Cpu(s)"

# Target: <70% average
```

### Memory Usage

```bash
# Check memory usage
free -h

# Monitor Node.js memory
node --max-old-space-size=4096 # Set appropriate limit
```

### Disk Usage

```bash
# Check disk space
df -h

# Monitor database disk usage
du -sh /var/lib/postgresql/data

# Target: <80% disk usage
```

## Automated Health Checks

### Health Check Schedule

```typescript
// Automated health check configuration
{
  checks: [
    {
      name: "database",
      interval: "1m",
      timeout: "5s",
      alertThreshold: 3 // Alert after 3 failures
    },
    {
      name: "redis",
      interval: "1m",
      timeout: "2s",
      alertThreshold: 3
    },
    {
      name: "queue",
      interval: "5m",
      timeout: "10s",
      alertThreshold: 2
    },
    {
      name: "scraping",
      interval: "10m",
      timeout: "30s",
      alertThreshold: 2
    }
  ]
}
```

### Health Check Script

```typescript
// Example health check implementation
async function performHealthCheck(): Promise<HealthStatus> {
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkQueue(),
    checkScraping()
  ]);

  const allHealthy = checks.every(c => c.status === 'healthy');
  
  return {
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date(),
    checks: checks.reduce((acc, check) => {
      acc[check.component] = check.status;
      return acc;
    }, {})
  };
}
```

## Alert Configuration

### Critical Alerts

```typescript
// Configure critical alerts
{
  alerts: [
    {
      name: "Database Down",
      condition: "database.status === 'unhealthy'",
      severity: "critical",
      channels: ["email", "sms", "slack"]
    },
    {
      name: "High Error Rate",
      condition: "api.errorRate > 0.05", // >5%
      severity: "critical",
      channels: ["email", "slack"]
    },
    {
      name: "Queue Backlog",
      condition: "queue.waiting > 1000",
      severity: "warning",
      channels: ["email"]
    }
  ]
}
```

## Monitoring Dashboard

### Key Metrics Display

```typescript
// Dashboard metrics
{
  overview: {
    status: "healthy",
    uptime: "99.95%",
    activeUsers: 150,
    requestsPerMinute: 500
  },
  components: {
    database: { status: "healthy", responseTime: 5 },
    redis: { status: "healthy", hitRate: 0.95 },
    queue: { status: "healthy", backlog: 150 },
    scraping: { status: "healthy", successRate: 0.995 }
  },
  alerts: {
    active: 0,
    resolved: 5,
    acknowledged: 0
  }
}
```

## Troubleshooting

### Database Issues

**Symptoms:**
- Slow queries
- Connection timeouts
- High CPU usage

**Solutions:**
```sql
-- Kill long-running queries
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';

-- Vacuum and analyze
VACUUM ANALYZE;

-- Reindex if needed
REINDEX DATABASE pricepilot;
```

### Redis Issues

**Symptoms:**
- High memory usage
- Slow response times
- Connection errors

**Solutions:**
```bash
# Clear cache if needed
redis-cli FLUSHDB

# Restart Redis
systemctl restart redis

# Check configuration
redis-cli CONFIG GET maxmemory
```

### Queue Issues

**Symptoms:**
- Growing backlog
- Failed jobs
- Worker crashes

**Solutions:**
```bash
# Restart workers
pm2 restart all

# Clear failed jobs
npm run queue:clear-failed

# Scale workers
pm2 scale scraper +2
```

## Best Practices

1. **Monitor Continuously**: Set up 24/7 monitoring
2. **Set Alerts**: Configure alerts for critical metrics
3. **Regular Reviews**: Review health metrics weekly
4. **Capacity Planning**: Monitor trends for scaling decisions
5. **Documentation**: Document all incidents and resolutions

## Next Steps

- Configure [Performance Metrics](performance-metrics)
- Set up [Alert Configuration](../alerting/alert-configuration)
- Review [Incident Response](../alerting/incident-response)
