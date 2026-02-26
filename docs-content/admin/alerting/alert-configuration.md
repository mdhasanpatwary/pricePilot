---
title: "Alert Configuration"
description: "Configure and manage system alerts in PricePilot"
category: "alerting"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
subcategory: null
tags: ["alerts", "monitoring", "configuration"]
relatedDocs: ["incident-response", "health-checks"]
---

# Alert Configuration

Configure system alerts to monitor PricePilot health and performance.

## Alert Types

### Performance Alerts
- **Slow API Response**: Triggered when API response time exceeds threshold
- **High Database Load**: Triggered when database query time is excessive
- **Memory Usage**: Triggered when memory usage exceeds 80%
- **CPU Usage**: Triggered when CPU usage exceeds 90%

### Business Alerts
- **Scraping Failures**: Triggered when scraping success rate drops below 95%
- **Price Update Failures**: Triggered when price updates fail repeatedly
- **Sync Failures**: Triggered when product sync fails
- **Queue Backlog**: Triggered when job queue depth exceeds threshold

### Security Alerts
- **Failed Login Attempts**: Triggered after 5 failed login attempts
- **Unauthorized Access**: Triggered on 403 errors
- **Rate Limit Violations**: Triggered when rate limits are exceeded
- **Suspicious Activity**: Triggered on unusual patterns

## Alert Configuration

### Database Schema
```sql
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metric_type VARCHAR(100) NOT NULL,
  threshold_value DECIMAL,
  comparison_operator VARCHAR(10),
  severity VARCHAR(20),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Configuration Example
```typescript
const alertRules = [
  {
    name: 'Slow API Response',
    metricType: 'api_response_time',
    thresholdValue: 1000, // milliseconds
    comparisonOperator: '>',
    severity: 'warning',
    enabled: true,
  },
  {
    name: 'High Error Rate',
    metricType: 'error_rate',
    thresholdValue: 5, // percentage
    comparisonOperator: '>',
    severity: 'critical',
    enabled: true,
  },
];
```

## Alert Channels

### Email Notifications
- Configure SMTP settings
- Set recipient lists by severity
- Customize email templates
- Include alert details and context

### Webhook Notifications
- Configure webhook URLs
- Set authentication headers
- Define payload format
- Implement retry logic

### Slack Integration
- Configure Slack webhook URL
- Set channel routing by severity
- Customize message format
- Include action buttons

## Alert Management

### Creating Alerts
```typescript
import { createAlertRule } from '@/lib/monitoring/alerts';

await createAlertRule({
  name: 'Database Connection Pool Exhausted',
  metricType: 'db_connection_pool_usage',
  thresholdValue: 90,
  comparisonOperator: '>',
  severity: 'critical',
  enabled: true,
});
```

### Updating Alerts
```typescript
await updateAlertRule(alertId, {
  thresholdValue: 95,
  enabled: false,
});
```

### Deleting Alerts
```typescript
await deleteAlertRule(alertId);
```

## Alert Evaluation

### Evaluation Frequency
- Critical alerts: Every 1 minute
- Warning alerts: Every 5 minutes
- Info alerts: Every 15 minutes

### Deduplication
- Suppress duplicate alerts within 15 minutes
- Group related alerts together
- Prevent alert fatigue

### Auto-Resolution
- Automatically resolve alerts when metric returns to normal
- Send resolution notifications
- Track time to resolution

## Best Practices

1. **Set Appropriate Thresholds**: Balance sensitivity vs noise
2. **Use Severity Levels**: Critical, Warning, Info
3. **Test Alert Rules**: Verify alerts trigger correctly
4. **Document Runbooks**: Include resolution steps
5. **Review Regularly**: Adjust thresholds based on patterns

## Related Documentation

- [Incident Response](incident-response)
- [System Monitoring](../system-monitoring/health-checks)
- [Performance Metrics](../system-monitoring/performance-metrics)
