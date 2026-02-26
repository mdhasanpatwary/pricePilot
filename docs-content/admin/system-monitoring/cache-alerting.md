---
title: "Cache Alerting"
description: "Setting up alerts for cache performance and issues"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["cache", "alerts", "monitoring"]
audience: "admin"
---

# Cache Alerting Configuration

## Overview

The cache alerting system monitors cache health and sends alerts when issues are detected. It integrates with the cache monitoring service to track performance metrics and notify administrators of problems.

## Features

- **Automatic Health Checks**: Runs every 5 minutes to check cache health
- **Threshold-Based Alerts**: Configurable thresholds for hit rate, memory usage, and response time
- **Multiple Notification Channels**: Log, email, Slack, and webhook support
- **Alert Cooldown**: Prevents alert spam with configurable cooldown periods
- **Alert History**: Tracks all alerts and their resolution status

## Alert Types

### 1. Hit Rate Alert
**Requirement 4.5**: Alert when cache hit rate falls below 60%

- **Threshold**: 60% (configurable)
- **Level**: Warning
- **Message**: "Cache hit rate below threshold: X%"
- **Action**: Review cache warming strategy, check invalidation patterns

### 2. Memory Usage Alert
**Requirement 10.4**: Alert when memory usage exceeds 80%

- **Threshold**: 80% (configurable)
- **Level**: Warning (Error if >95%)
- **Message**: "Cache memory usage high: XMB (Y%)"
- **Action**: Increase Redis memory limit, review TTL settings

### 3. Response Time Alert
**Requirement 10.6**: Alert when cache operations take longer than 100ms

- **Threshold**: 100ms (configurable)
- **Level**: Warning
- **Message**: "Cache operations slow: Xms"
- **Action**: Check Redis performance, network latency

### 4. Connectivity Alert
**Requirement 10.6**: Alert on Redis connectivity failures

- **Level**: Error
- **Message**: "Redis connectivity failed: [error]"
- **Action**: Check Redis server status, network connectivity

## Configuration

### Environment Variables

```bash
# Enable/disable alerting
CACHE_ALERTING_ENABLED=true

# Alert thresholds
CACHE_HIT_RATE_THRESHOLD=0.6          # 60%
CACHE_MEMORY_THRESHOLD=0.8            # 80%
CACHE_RESPONSE_TIME_THRESHOLD=100     # 100ms

# Notification channels (comma-separated)
CACHE_ALERT_CHANNELS=log,email,slack

# Email configuration
ALERT_EMAIL=admin@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=alerts@example.com
SMTP_PASS=your-password

# Slack configuration
SLACK_ALERT_CHANNEL=#alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Webhook configuration
ALERT_WEBHOOK_URL=https://your-monitoring-system.com/webhook
```

### Programmatic Configuration

```typescript
import { cacheAlertingService } from '@/lib/services/cache-alerting';

// Update configuration
cacheAlertingService.updateConfig({
    enabled: true,
    hitRateThreshold: 0.7,        // 70%
    memoryUsageThreshold: 0.85,   // 85%
    responseTimeThreshold: 150,   // 150ms
    notificationChannels: ['log', 'email', 'slack'],
});

// Get current configuration
const config = cacheAlertingService.getConfig();
console.log('Alert config:', config);
```

## Notification Channels

### 1. Log (Default)

Logs alerts to the application logger. Always enabled by default.

```typescript
// Automatically logs to console/logger
[CacheAlerting] Cache Alert {
  alertId: 'hitRate_warning_1234567890',
  metric: 'hitRate',
  message: 'Cache hit rate below threshold: 55.2%',
  value: 0.552,
  threshold: 0.6
}
```

### 2. Email

Sends formatted email alerts to administrators.

**Setup:**
1. Configure SMTP settings in environment variables
2. Add 'email' to CACHE_ALERT_CHANNELS
3. Set ALERT_EMAIL to recipient address

**Email Format:**
```
Subject: [WARNING] Cache Alert: hitRate

Cache Alert Detected

Alert ID: hitRate_warning_1234567890
Level: WARNING
Metric: hitRate
Message: Cache hit rate below threshold: 55.2%
Timestamp: 2024-01-15T10:30:00.000Z

Current Value: 0.552
Threshold: 0.6

Cache Health Status:
Status: healthy
Redis Connected: true
Memory Usage: 65%
Hit Rate: 55.2%
Total Keys: 1234
```

### 3. Slack

Sends formatted messages to Slack channels.

**Setup:**
1. Create a Slack webhook URL
2. Set SLACK_WEBHOOK_URL in environment variables
3. Add 'slack' to CACHE_ALERT_CHANNELS
4. Set SLACK_ALERT_CHANNEL to target channel

**Slack Format:**
```
⚠️ *Cache Alert: hitRate*
Cache hit rate below threshold: 55.2%
Value: 0.552 | Threshold: 0.6

Hit Rate: 55.2% | Keys: 1234
```

### 4. Webhook

Sends JSON payload to external monitoring systems.

**Setup:**
1. Set ALERT_WEBHOOK_URL in environment variables
2. Add 'webhook' to CACHE_ALERT_CHANNELS

**Webhook Payload:**
```json
{
  "alert": {
    "alertId": "hitRate_warning_1234567890",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "level": "warning",
    "metric": "hitRate",
    "message": "Cache hit rate below threshold: 55.2%",
    "value": 0.552,
    "threshold": 0.6,
    "resolved": false
  },
  "health": {
    "status": "healthy",
    "redis": {
      "connected": true,
      "memoryUsage": 341835776,
      "memoryLimit": 524288000,
      "memoryUsagePercent": 0.65
    },
    "performance": {
      "hitRate": 0.552,
      "totalHits": 1234,
      "totalMisses": 1000,
      "totalKeys": 1234
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Alert Cooldown

To prevent alert spam, the system implements a cooldown period:

- **Default Cooldown**: 5 minutes
- **Behavior**: Same alert type won't be sent again within cooldown period
- **Per-Metric**: Cooldown is tracked per metric (hitRate, memoryUsage, etc.)

Example:
```
10:00 - Hit rate alert sent
10:02 - Hit rate still low, but alert NOT sent (cooldown)
10:05 - Hit rate still low, but alert NOT sent (cooldown)
10:06 - Cooldown expired, alert sent if still low
```

## Alert History

The system maintains a history of all alerts:

```typescript
import { cacheAlertingService } from '@/lib/services/cache-alerting';

// Get all alerts (last 100)
const history = cacheAlertingService.getAlertHistory(100);

// Get only active (unresolved) alerts
const activeAlerts = cacheAlertingService.getActiveAlerts();

// Clear alert history
cacheAlertingService.clearHistory();
```

**Alert History Structure:**
```typescript
interface AlertHistory {
    alertId: string;
    timestamp: Date;
    level: 'info' | 'warning' | 'error';
    metric: string;
    message: string;
    value?: number;
    threshold?: number;
    resolved: boolean;
    resolvedAt?: Date;
}
```

## Scheduled Checks

The alerting service runs automatically via the scheduler:

- **Schedule**: Every 5 minutes
- **Job Name**: `check-cache-alerts`
- **Actions**:
  1. Get current cache health status
  2. Check for threshold violations
  3. Send alerts through configured channels
  4. Resolve inactive alerts
  5. Update alert history

## Manual Checks

You can manually trigger alert checks:

```typescript
import { cacheAlertingService } from '@/lib/services/cache-alerting';

// Run manual check
await cacheAlertingService.checkAndAlert();
```

Or via CLI:

```bash
# Create a script to run manual check
npx tsx -e "
import { cacheAlertingService } from './lib/services/cache-alerting';
await cacheAlertingService.checkAndAlert();
"
```

## Integration with Monitoring Systems

### DataDog

```typescript
// In lib/services/cache-alerting.ts
import { StatsD } from 'node-dogstatsd';

const dogstatsd = new StatsD();

// Send metrics to DataDog
dogstatsd.gauge('cache.hit_rate', health.performance.hitRate);
dogstatsd.gauge('cache.memory_usage', health.redis.memoryUsagePercent);
```

### Prometheus

```typescript
// In lib/services/cache-alerting.ts
import { register, Gauge } from 'prom-client';

const cacheHitRate = new Gauge({
    name: 'cache_hit_rate',
    help: 'Cache hit rate percentage',
});

cacheHitRate.set(health.performance.hitRate);
```

### New Relic

```typescript
// In lib/services/cache-alerting.ts
import newrelic from 'newrelic';

newrelic.recordMetric('Custom/Cache/HitRate', health.performance.hitRate);
newrelic.recordMetric('Custom/Cache/MemoryUsage', health.redis.memoryUsagePercent);
```

## Troubleshooting

### Alerts Not Being Sent

1. **Check if alerting is enabled**:
   ```bash
   echo $CACHE_ALERTING_ENABLED
   ```

2. **Verify scheduler is running**:
   ```bash
   pm2 status db-scheduler
   # or
   systemctl status db-scheduler
   ```

3. **Check logs**:
   ```bash
   pm2 logs db-scheduler | grep CacheAlerting
   ```

4. **Verify notification channel configuration**:
   ```bash
   echo $CACHE_ALERT_CHANNELS
   ```

### Too Many Alerts

1. **Adjust thresholds**:
   ```bash
   # Increase hit rate threshold to 50%
   export CACHE_HIT_RATE_THRESHOLD=0.5
   ```

2. **Increase cooldown period** (requires code change):
   ```typescript
   // In lib/services/cache-alerting.ts
   private readonly ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
   ```

3. **Disable specific channels**:
   ```bash
   # Only log, don't send emails
   export CACHE_ALERT_CHANNELS=log
   ```

### Email Alerts Not Working

1. **Verify SMTP configuration**:
   ```bash
   echo $SMTP_HOST
   echo $SMTP_PORT
   echo $SMTP_USER
   ```

2. **Test SMTP connection**:
   ```bash
   telnet $SMTP_HOST $SMTP_PORT
   ```

3. **Check notification service logs**:
   ```bash
   pm2 logs | grep notification
   ```

### Slack Alerts Not Working

1. **Verify webhook URL**:
   ```bash
   echo $SLACK_WEBHOOK_URL
   ```

2. **Test webhook manually**:
   ```bash
   curl -X POST $SLACK_WEBHOOK_URL \
     -H 'Content-Type: application/json' \
     -d '{"text":"Test alert"}'
   ```

3. **Check channel name**:
   ```bash
   echo $SLACK_ALERT_CHANNEL
   ```

## Best Practices

1. **Start with log-only alerts** to tune thresholds
2. **Gradually add notification channels** as you validate alert accuracy
3. **Monitor alert frequency** to avoid alert fatigue
4. **Document alert response procedures** for your team
5. **Review alert history regularly** to identify patterns
6. **Adjust thresholds based on your workload** (not one-size-fits-all)
7. **Test alerting in staging** before enabling in production

## API Endpoints

### Get Alert History

```
GET /api/v1/admin/cache/alerts
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "data": {
    "alerts": [
      {
        "alertId": "hitRate_warning_1234567890",
        "timestamp": "2024-01-15T10:30:00.000Z",
        "level": "warning",
        "metric": "hitRate",
        "message": "Cache hit rate below threshold: 55.2%",
        "value": 0.552,
        "threshold": 0.6,
        "resolved": false
      }
    ],
    "total": 1
  }
}
```

### Get Active Alerts

```
GET /api/v1/admin/cache/alerts/active
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "data": {
    "alerts": [...],
    "count": 2
  }
}
```

### Clear Alert History

```
DELETE /api/v1/admin/cache/alerts
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "message": "Alert history cleared"
}
```

## See Also

- [Cache Monitoring](./CACHE_MONITORING.md)
- [Redis Configuration](./REDIS_CONFIGURATION.md)
- [Cache Quick Reference](./CACHE_QUICK_REFERENCE.md)
- [Scheduler README](../scripts/SCHEDULER_README.md)
