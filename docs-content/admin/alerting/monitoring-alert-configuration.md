---
title: "Monitoring Alert Configuration"
description: "Configuring monitoring alerts"
category: "alerting"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["monitoring", "alerts", "setup"]
audience: "admin"
relatedDocs: ["/docs/troubleshooting/monitoring-alert-configuration.md"]
---

# Alert Rule Configuration Guide

## Overview

This guide explains how to configure alert rules in the PricePilot monitoring system. Alert rules define conditions that trigger notifications when system metrics exceed defined thresholds.

## Accessing Alert Configuration

1. Navigate to **Dashboard → Monitoring → Alerts**
2. Requires **admin role** access
3. View existing rules and create new ones

## Alert Rule Components

### Basic Information

- **Name**: Descriptive name for the alert (e.g., "High Error Rate")
- **Description**: Detailed explanation of what the alert monitors
- **Enabled**: Toggle to activate/deactivate the rule

### Severity Levels

- **Critical**: Immediate attention required (red indicator)
- **Warning**: Issue needs investigation (yellow indicator)
- **Info**: Informational notification (blue indicator)

### Metric Configuration

#### Metric Type

The type of metric to monitor:

- `error_rate`: Percentage of failed requests
- `response_time`: API endpoint latency
- `scraping_block_rate`: Percentage of blocked scraping attempts
- `price_update_failure_rate`: Percentage of failed price updates
- `auth_failures`: Number of authentication failures
- `db_connection_errors`: Database connection issues
- `redis_connection_errors`: Redis connection issues

#### Condition

Define how to evaluate the metric:

**Operator**:
- `gt` (greater than)
- `gte` (greater than or equal)
- `lt` (less than)
- `lte` (less than or equal)
- `eq` (equal)

**Aggregation**:
- `count`: Total number of occurrences
- `avg`: Average value
- `sum`: Sum of all values
- `max`: Maximum value
- `min`: Minimum value
- `p95`: 95th percentile
- `p99`: 99th percentile

**Example**: `avg response_time > 500ms`

#### Time Window

Period over which to evaluate the metric (in seconds):

- `60`: 1 minute
- `300`: 5 minutes
- `600`: 10 minutes
- `900`: 15 minutes
- `3600`: 1 hour

**Example**: "Average response time over 5 minutes"

#### Threshold

The value that triggers the alert:

- For percentages: `0.01` = 1%
- For milliseconds: `500` = 500ms
- For counts: `10` = 10 occurrences

### Notification Configuration

#### Notification Channels

Select which channels receive alerts:

- **Email**: Send to configured email addresses
- **Slack**: Post to configured Slack channels

Multiple channels can be selected for redundancy.

#### Tenant Scope

- **System-wide**: Monitors all tenants (leave tenant field empty)
- **Tenant-specific**: Monitors a specific tenant (select tenant ID)

## Creating an Alert Rule

### Via Dashboard UI

1. Navigate to **Dashboard → Monitoring → Alerts**
2. Click **"Create Alert Rule"**
3. Fill in the form:
   - Name and description
   - Select severity level
   - Choose metric type
   - Configure condition (operator, aggregation, threshold)
   - Set time window
   - Select notification channels
   - Optionally specify tenant
4. Click **"Create"**

### Via API

```bash
POST /api/v1/monitoring/alert-rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "High Error Rate",
  "description": "Triggers when error rate exceeds 1% over 5 minutes",
  "severity": "critical",
  "enabled": true,
  "metricType": "error_rate",
  "conditionOperator": "gt",
  "conditionAggregation": "avg",
  "threshold": 0.01,
  "timeWindowSeconds": 300,
  "notificationChannels": ["email", "slack"]
}
```

## Example Alert Rules

### 1. High Error Rate

```json
{
  "name": "High Error Rate",
  "description": "Critical alert when error rate exceeds 1%",
  "severity": "critical",
  "metricType": "error_rate",
  "conditionOperator": "gt",
  "conditionAggregation": "avg",
  "threshold": 0.01,
  "timeWindowSeconds": 300,
  "notificationChannels": ["email", "slack"]
}
```

### 2. Slow Response Time

```json
{
  "name": "Slow Response Time",
  "description": "Warning when average response time exceeds 500ms",
  "severity": "warning",
  "metricType": "response_time",
  "conditionOperator": "gt",
  "conditionAggregation": "avg",
  "threshold": 500,
  "timeWindowSeconds": 300,
  "notificationChannels": ["email"]
}
```

### 3. High Scraping Block Rate

```json
{
  "name": "High Scraping Block Rate",
  "description": "Warning when block rate exceeds 30%",
  "severity": "warning",
  "metricType": "scraping_block_rate",
  "conditionOperator": "gt",
  "conditionAggregation": "avg",
  "threshold": 0.30,
  "timeWindowSeconds": 900,
  "notificationChannels": ["email", "slack"]
}
```

### 4. Authentication Failures

```json
{
  "name": "Repeated Auth Failures",
  "description": "Security alert for repeated authentication failures",
  "severity": "critical",
  "metricType": "auth_failures",
  "conditionOperator": "gt",
  "conditionAggregation": "count",
  "threshold": 10,
  "timeWindowSeconds": 60,
  "notificationChannels": ["email", "slack"]
}
```

## Modifying Alert Rules

### Enable/Disable Rules

1. Navigate to alert rules list
2. Toggle the **"Enabled"** switch
3. Disabled rules do not trigger alerts

### Update Rule Configuration

1. Click **"Edit"** on the alert rule
2. Modify any configuration fields
3. Click **"Save"**
4. Changes take effect immediately

### Delete Rules

1. Click **"Delete"** on the alert rule
2. Confirm deletion
3. Alert history is preserved

## Testing Alert Rules

### Test Alert Functionality

1. Navigate to alert rule details
2. Click **"Send Test Alert"**
3. Test notification sent to all configured channels
4. Marked clearly as "TEST" in notification
5. Check delivery status in dashboard

### Verify Alert Delivery

1. Navigate to **Dashboard → Monitoring → Test**
2. View delivery statistics
3. Check success/failure rates per channel
4. Review delivery logs

## Maintenance Windows

### Purpose

Suppress alerts during planned maintenance to avoid alert fatigue.

### Configuration

```bash
POST /api/v1/monitoring/maintenance-window
Authorization: Bearer <token>
Content-Type: application/json

{
  "start": "2026-02-15T02:00:00Z",
  "end": "2026-02-15T04:00:00Z",
  "reason": "Database maintenance"
}
```

### Behavior

- No alerts sent during maintenance window
- Alerts are logged but not delivered
- Resolution notifications sent after window ends
- Dashboard shows maintenance mode indicator

## Alert Deduplication

### How It Works

- Same alert condition triggers only once per 15-minute window
- Prevents notification storms
- Alert fingerprint: `ruleId + tenantId + metricType`

### Resolution Notifications

- Sent when alert condition clears
- Includes duration of alert
- Sent to same channels as original alert

## Best Practices

### Threshold Selection

- Start conservative, adjust based on baseline
- Use percentiles (p95, p99) for response times
- Consider business hours vs off-hours patterns
- Review alert history to tune thresholds

### Notification Routing

- Critical alerts: Email + Slack
- Warnings: Email only
- Info: Dashboard only (no notifications)
- Use different channels for different teams

### Alert Naming

- Use clear, descriptive names
- Include metric and threshold in name
- Example: "Error Rate > 1% (5min)"

### Testing

- Test all new alert rules before enabling
- Verify notification delivery
- Check alert appears in dashboard
- Confirm resolution notifications work

### Monitoring

- Review alert delivery statistics weekly
- Adjust thresholds to reduce false positives
- Disable unused alert rules
- Document alert response procedures

## Troubleshooting

### Alert Not Triggering

1. Verify rule is enabled
2. Check metric is being collected
3. Verify threshold and time window
4. Check maintenance window status
5. Review alert evaluation logs

### Notification Not Received

1. Check notification channel configuration
2. Verify channel is enabled
3. Check delivery logs in dashboard
4. Test notification channel
5. Verify email/Slack credentials

### Too Many Alerts

1. Review and adjust thresholds
2. Increase time windows
3. Enable alert deduplication
4. Use maintenance windows
5. Consolidate related alerts

### False Positives

1. Analyze metric baseline
2. Adjust threshold higher
3. Increase time window
4. Use different aggregation method
5. Add tenant-specific rules

## API Reference

### List Alert Rules

```bash
GET /api/v1/monitoring/alert-rules
Authorization: Bearer <token>
```

### Get Alert Rule

```bash
GET /api/v1/monitoring/alert-rules/:id
Authorization: Bearer <token>
```

### Create Alert Rule

```bash
POST /api/v1/monitoring/alert-rules
Authorization: Bearer <token>
Content-Type: application/json
```

### Update Alert Rule

```bash
PUT /api/v1/monitoring/alert-rules/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### Delete Alert Rule

```bash
DELETE /api/v1/monitoring/alert-rules/:id
Authorization: Bearer <token>
```

### Test Alert Rule

```bash
POST /api/v1/monitoring/alert-rules/:id/test
Authorization: Bearer <token>
```

## Related Documentation

- [Notification Channel Setup](./MONITORING_NOTIFICATION_SETUP.md)
- [Monitoring Dashboard](./MONITORING_UI.md)
- [Troubleshooting Guide](./MONITORING_TROUBLESHOOTING.md)
- [API Monitoring](./API_MONITORING.md)
