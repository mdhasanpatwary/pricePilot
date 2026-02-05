---
title: "Cache Monitoring"
description: "Monitoring cache performance and health"
category: "system-monitoring"
tags: ["cache", "monitoring", "performance"]
audience: "admin"
---

# Cache Monitoring Guide

## Overview

Effective cache monitoring is essential for maintaining optimal performance and identifying issues before they impact users. This guide covers monitoring strategies, key metrics, alerting, and troubleshooting for PricePilot's caching system.

## Key Metrics

### 1. Cache Hit Rate

**Definition**: Percentage of requests served from cache vs database

**Formula**: `hitRate = hits / (hits + misses)`

**Target**: >70%

**Interpretation**:
- **>80%**: Excellent - cache is highly effective
- **70-80%**: Good - cache is working well
- **60-70%**: Fair - room for improvement
- **<60%**: Poor - investigate TTLs, warming, or access patterns

**How to check**:
```typescript
import { cacheMonitoringService } from '@/lib/services/cache-monitoring';

const health = await cacheMonitoringService.getHealthStatus();
console.log(`Hit rate: ${(health.performance.hitRate * 100).toFixed(1)}%`);
```

### 2. Response Time

**Definition**: Time to retrieve data from cache

**Target**: <50ms for cache hits

**Interpretation**:
- **<25ms**: Excellent
- **25-50ms**: Good
- **50-100ms**: Fair - check network latency
- **>100ms**: Poor - investigate Redis performance

**How to check**:
```typescript
const startTime = Date.now();
const data = await cache.get(key);
const duration = Date.now() - startTime;

console.log(`Cache response time: ${duration}ms`);
```

### 3. Memory Usage

**Definition**: Redis memory consumption

**Target**: <80% of limit (400MB of 500MB)

**Interpretation**:
- **<60%**: Healthy - plenty of headroom
- **60-80%**: Good - monitor trends
- **80-95%**: Warning - consider optimization
- **>95%**: Critical - immediate action needed

**How to check**:
```typescript
const health = await cacheMonitoringService.getHealthStatus();
const usagePercent = (health.redis.memoryUsage / health.redis.memoryLimit) * 100;

console.log(`Memory usage: ${usagePercent.toFixed(1)}%`);
```

### 4. Eviction Rate

**Definition**: Number of keys evicted due to memory pressure

**Target**: <100 evictions/hour

**Interpretation**:
- **0**: Ideal - no memory pressure
- **<100/hour**: Good - normal operation
- **100-1000/hour**: Warning - monitor closely
- **>1000/hour**: Critical - increase memory or reduce TTLs

**How to check**:
```bash
# Via Redis CLI
redis-cli INFO stats | grep evicted_keys

# Via monitoring service
const stats = await cache.getCacheStats();
console.log(`Evictions: ${stats.evictions}`);
```

### 5. Cache Size

**Definition**: Number of keys in cache

**Target**: Varies by tenant, typically 1000-10000 keys

**Interpretation**:
- Growing steadily: Normal
- Sudden spike: Investigate new caching
- Sudden drop: Check for mass invalidation
- Constant: Stable operation

**How to check**:
```bash
# Via Redis CLI
redis-cli DBSIZE

# Via monitoring service
const stats = await cache.getCacheStats();
console.log(`Total keys: ${stats.totalKeys}`);
```

## Monitoring Methods

### 1. API Endpoint

**Endpoint**: `GET /api/v1/admin/performance/cache-stats`

**Authentication**: Admin token required

**Example**:
```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:3000/api/v1/admin/performance/cache-stats
```

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "redis": {
      "connected": true,
      "memoryUsage": 104857600,
      "memoryLimit": 524288000,
      "memoryUsagePercent": 20
    },
    "performance": {
      "hitRate": 0.75,
      "avgResponseTime": 25,
      "totalHits": 1500,
      "totalMisses": 500,
      "evictions": 10
    },
    "alerts": []
  }
}
```

### 2. Monitoring Service

**Service**: `CacheMonitoringService`

**Usage**:
```typescript
import { cacheMonitoringService } from '@/lib/services/cache-monitoring';

// Get health status
const health = await cacheMonitoringService.getHealthStatus();

// Log statistics
await cacheMonitoringService.logStats();

// Check if healthy
if (health.status === 'healthy') {
  console.log('Cache is healthy');
} else {
  console.error('Cache is unhealthy:', health.error);
}
```

### 3. Automated Logging

**Configuration**: Logs cache stats every 5 minutes

**Setup**:
```typescript
// In cron job or scheduler
setInterval(async () => {
  await cacheMonitoringService.logStats();
}, 5 * 60 * 1000); // 5 minutes
```

**Log output**:
```
[CacheMonitoring] Cache statistics: {
  "status": "healthy",
  "hitRate": 0.75,
  "memoryUsage": 104857600,
  "avgResponseTime": 25
}
```

### 4. Redis CLI

**Direct Redis monitoring**:
```bash
# Connection status
redis-cli PING

# Memory info
redis-cli INFO memory

# Statistics
redis-cli INFO stats

# Key count
redis-cli DBSIZE

# Monitor commands in real-time
redis-cli MONITOR
```

## Alerting

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Hit Rate | <70% | <60% | Review TTLs, warming |
| Memory Usage | >80% | >95% | Increase limit, optimize |
| Response Time | >50ms | >100ms | Check network, Redis |
| Evictions | >100/hr | >1000/hr | Increase memory |
| Connection | Disconnected | Down >5min | Check Redis, network |

### Alert Configuration

```typescript
// In CacheMonitoringService
private generateAlerts(stats: CacheStats, memoryUsage: number): Alert[] {
  const alerts: Alert[] = [];
  
  // Hit rate alert
  if (stats.hitRate < 0.6) {
    alerts.push({
      level: 'error',
      metric: 'hitRate',
      message: `Cache hit rate critical: ${(stats.hitRate * 100).toFixed(1)}%`,
      value: stats.hitRate,
      threshold: 0.6
    });
  } else if (stats.hitRate < 0.7) {
    alerts.push({
      level: 'warning',
      metric: 'hitRate',
      message: `Cache hit rate low: ${(stats.hitRate * 100).toFixed(1)}%`,
      value: stats.hitRate,
      threshold: 0.7
    });
  }
  
  // Memory usage alert
  const memoryPercent = memoryUsage / (500 * 1024 * 1024);
  if (memoryPercent > 0.95) {
    alerts.push({
      level: 'error',
      metric: 'memoryUsage',
      message: `Cache memory critical: ${(memoryPercent * 100).toFixed(1)}%`,
      value: memoryUsage,
      threshold: 0.95
    });
  } else if (memoryPercent > 0.8) {
    alerts.push({
      level: 'warning',
      metric: 'memoryUsage',
      message: `Cache memory high: ${(memoryPercent * 100).toFixed(1)}%`,
      value: memoryUsage,
      threshold: 0.8
    });
  }
  
  // Response time alert
  if (stats.avgResponseTime > 100) {
    alerts.push({
      level: 'error',
      metric: 'responseTime',
      message: `Cache operations slow: ${stats.avgResponseTime.toFixed(0)}ms`,
      value: stats.avgResponseTime,
      threshold: 100
    });
  } else if (stats.avgResponseTime > 50) {
    alerts.push({
      level: 'warning',
      metric: 'responseTime',
      message: `Cache operations slower than expected: ${stats.avgResponseTime.toFixed(0)}ms`,
      value: stats.avgResponseTime,
      threshold: 50
    });
  }
  
  return alerts;
}
```

### Alert Delivery

**Email alerts**:
```typescript
async function sendAlert(alert: Alert) {
  await emailService.send({
    to: 'ops@pricepilot.com',
    subject: `[${alert.level.toUpperCase()}] Cache Alert: ${alert.metric}`,
    body: alert.message
  });
}
```

**Slack alerts**:
```typescript
async function sendSlackAlert(alert: Alert) {
  await slackService.send({
    channel: '#alerts',
    text: `🚨 ${alert.level.toUpperCase()}: ${alert.message}`,
    color: alert.level === 'error' ? 'danger' : 'warning'
  });
}
```

**PagerDuty integration**:
```typescript
async function triggerPagerDuty(alert: Alert) {
  if (alert.level === 'error') {
    await pagerDutyService.trigger({
      severity: 'critical',
      summary: alert.message,
      source: 'cache-monitoring'
    });
  }
}
```

## Dashboards

### Metrics Dashboard

**Key visualizations**:
1. **Hit Rate Over Time** (line chart)
2. **Memory Usage Over Time** (area chart)
3. **Response Time Distribution** (histogram)
4. **Cache Operations** (counter)
5. **Eviction Rate** (line chart)
6. **Alert History** (timeline)

**Example Grafana dashboard**:
```json
{
  "dashboard": {
    "title": "PricePilot Cache Monitoring",
    "panels": [
      {
        "title": "Cache Hit Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "cache_hit_rate",
            "legendFormat": "Hit Rate"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "cache_memory_usage_bytes",
            "legendFormat": "Memory Usage"
          }
        ]
      }
    ]
  }
}
```

### Real-Time Monitoring

**WebSocket-based real-time updates**:
```typescript
// Server-side
io.on('connection', (socket) => {
  const interval = setInterval(async () => {
    const health = await cacheMonitoringService.getHealthStatus();
    socket.emit('cache-stats', health);
  }, 1000);
  
  socket.on('disconnect', () => {
    clearInterval(interval);
  });
});

// Client-side
socket.on('cache-stats', (health) => {
  updateDashboard(health);
});
```

## Performance Analysis

### Identify Slow Operations

```typescript
class CachePerformanceAnalyzer {
  private operations: Map<string, number[]> = new Map();
  
  async trackOperation(key: string, operation: () => Promise<any>) {
    const startTime = Date.now();
    const result = await operation();
    const duration = Date.now() - startTime;
    
    // Track duration
    if (!this.operations.has(key)) {
      this.operations.set(key, []);
    }
    this.operations.get(key)!.push(duration);
    
    // Alert if slow
    if (duration > 100) {
      logger.warn('Slow cache operation', { key, duration });
    }
    
    return result;
  }
  
  getSlowOperations(threshold: number = 50): string[] {
    const slow: string[] = [];
    
    for (const [key, durations] of this.operations) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      if (avg > threshold) {
        slow.push(key);
      }
    }
    
    return slow;
  }
}
```

### Analyze Cache Patterns

```typescript
class CachePatternAnalyzer {
  async analyzeAccessPatterns(tenantId: string) {
    const keys = await cache.keys(`${tenantId}:*`);
    const patterns = new Map<string, number>();
    
    for (const key of keys) {
      const pattern = key.split(':').slice(0, 3).join(':');
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    }
    
    return Array.from(patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([pattern, count]) => ({ pattern, count }));
  }
  
  async findUnusedKeys(tenantId: string, days: number = 7) {
    const keys = await cache.keys(`${tenantId}:*`);
    const unused: string[] = [];
    
    for (const key of keys) {
      const ttl = await cache.ttl(key);
      const age = await cache.getAge(key);
      
      if (age > days * 24 * 60 * 60 && ttl > 0) {
        unused.push(key);
      }
    }
    
    return unused;
  }
}
```

## Best Practices

### 1. Monitor Continuously

```typescript
// Set up continuous monitoring
setInterval(async () => {
  const health = await cacheMonitoringService.getHealthStatus();
  
  // Log to monitoring system
  await monitoring.log('cache.health', health);
  
  // Check for alerts
  if (health.alerts.length > 0) {
    await alerting.send(health.alerts);
  }
}, 60000); // Every minute
```

### 2. Track Trends

```typescript
class CacheTrendTracker {
  private history: CacheStats[] = [];
  
  async trackStats() {
    const stats = await cache.getCacheStats();
    this.history.push({ ...stats, timestamp: Date.now() });
    
    // Keep last 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.history = this.history.filter(s => s.timestamp > cutoff);
  }
  
  getTrend(metric: keyof CacheStats): 'improving' | 'stable' | 'degrading' {
    if (this.history.length < 2) return 'stable';
    
    const recent = this.history.slice(-10);
    const older = this.history.slice(-20, -10);
    
    const recentAvg = recent.reduce((sum, s) => sum + s[metric], 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s[metric], 0) / older.length;
    
    if (recentAvg > olderAvg * 1.1) return 'improving';
    if (recentAvg < olderAvg * 0.9) return 'degrading';
    return 'stable';
  }
}
```

### 3. Set Up Alerts

```typescript
// Configure alert rules
const alertRules = [
  {
    metric: 'hitRate',
    condition: (value: number) => value < 0.7,
    level: 'warning',
    message: 'Cache hit rate below 70%'
  },
  {
    metric: 'memoryUsage',
    condition: (value: number) => value > 0.8,
    level: 'warning',
    message: 'Memory usage above 80%'
  },
  {
    metric: 'responseTime',
    condition: (value: number) => value > 50,
    level: 'warning',
    message: 'Response time above 50ms'
  }
];

// Check alerts
async function checkAlerts() {
  const health = await cacheMonitoringService.getHealthStatus();
  
  for (const rule of alertRules) {
    const value = health.performance[rule.metric];
    if (rule.condition(value)) {
      await alerting.send({
        level: rule.level,
        message: rule.message,
        value
      });
    }
  }
}
```

### 4. Regular Reviews

```typescript
// Weekly cache review
async function weeklyCacheReview() {
  const report = {
    hitRate: await getAverageHitRate('week'),
    memoryUsage: await getAverageMemoryUsage('week'),
    slowOperations: await getSlowOperations('week'),
    topKeys: await getTopAccessedKeys('week'),
    recommendations: []
  };
  
  // Generate recommendations
  if (report.hitRate < 0.7) {
    report.recommendations.push('Consider increasing TTLs or implementing cache warming');
  }
  
  if (report.memoryUsage > 0.8) {
    report.recommendations.push('Consider increasing memory limit or reducing TTLs');
  }
  
  // Send report
  await emailService.send({
    to: 'ops@pricepilot.com',
    subject: 'Weekly Cache Performance Review',
    body: JSON.stringify(report, null, 2)
  });
}
```

## Testing Monitoring

### Unit Tests

```typescript
describe('Cache Monitoring', () => {
  it('should detect low hit rate', async () => {
    // Mock low hit rate
    jest.spyOn(cache, 'getCacheStats').mockResolvedValue({
      hits: 300,
      misses: 700,
      hitRate: 0.3
    });
    
    const health = await cacheMonitoringService.getHealthStatus();
    
    expect(health.alerts).toContainEqual(
      expect.objectContaining({
        level: 'error',
        metric: 'hitRate'
      })
    );
  });
  
  it('should detect high memory usage', async () => {
    // Mock high memory usage
    jest.spyOn(cache, 'getMemoryUsage').mockResolvedValue(450 * 1024 * 1024);
    
    const health = await cacheMonitoringService.getHealthStatus();
    
    expect(health.alerts).toContainEqual(
      expect.objectContaining({
        level: 'warning',
        metric: 'memoryUsage'
      })
    );
  });
});
```

## Related Documentation

- [Cache Configuration Guide](./CACHE_CONFIGURATION.md)
- [Cache Troubleshooting Guide](./CACHE_TROUBLESHOOTING.md)
- [Redis Configuration](./REDIS_CONFIGURATION.md)
- [Redis Memory Configuration](./REDIS_MEMORY_CONFIGURATION.md)
