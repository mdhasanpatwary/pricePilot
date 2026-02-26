---
title: "Alert History Tracking"
description: "Tracking and analyzing alert history"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["alerts", "history", "monitoring"]
audience: "admin"
---

# Alert History Tracking

## Overview

The Alert History Tracking system provides comprehensive logging and management of all monitoring alerts triggered in the PricePilot system. This feature enables administrators to review past alerts, track resolution times, and analyze system health trends.

## Features

### 1. Complete Alert Audit Trail

All triggered alerts are automatically logged in the `MonitoringAlertHistory` table with:
- Alert rule information (rule ID, name, severity)
- Trigger timestamp and metric values
- Resolution timestamp (when alert condition clears)
- Acknowledgment information (who acknowledged and when)
- Notification delivery status
- Full context data for debugging

### 2. Alert Lifecycle Tracking

Each alert goes through the following lifecycle:

```
TRIGGERED → ACKNOWLEDGED → RESOLVED
     ↓            ↓            ↓
  (Active)   (Acknowledged) (Closed)
```

- **Triggered**: Alert condition is met, notifications sent
- **Acknowledged**: Admin has reviewed the alert
- **Resolved**: Alert condition no longer met (auto-resolved)

### 3. Admin Dashboard View

The alert history dashboard (`/admin/alert-history`) provides:

#### Statistics Cards
- **Active Alerts**: Count of unresolved alerts
- **Critical Alerts**: Count of critical severity alerts
- **Unacknowledged**: Count of alerts needing review

#### Filtering Options
- **By Severity**: CRITICAL, WARNING, INFO
- **By Status**: Active, Resolved, Acknowledged, Unacknowledged

#### Alert Details Display
- Severity badge and icon
- Rule name and metric information
- Metric value vs threshold comparison
- Trigger and resolution timestamps
- Acknowledgment information
- Notification delivery status

### 4. Alert Acknowledgment

Administrators can acknowledge alerts to indicate they have been reviewed:

```typescript
POST /api/v1/monitoring/alerts/:alertId/acknowledge
```

**Benefits:**
- Tracks who reviewed each alert
- Prevents duplicate investigations
- Provides accountability
- Stops repeated notifications (when configured)

## Database Schema

### MonitoringAlertHistory Model

```prisma
model MonitoringAlertHistory {
  id                 String                  @id @default(uuid())
  ruleId             String
  ruleName           String
  severity           MonitoringAlertSeverity
  triggeredAt        DateTime                @default(now())
  resolvedAt         DateTime?
  metricValue        Decimal                 @db.Decimal(10, 2)
  threshold          Decimal                 @db.Decimal(10, 2)
  tenantId           String?
  context            Json?
  notificationsSent  Json?
  acknowledgedAt     DateTime?
  acknowledgedBy     String?

  rule MonitoringAlertRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)

  @@index([ruleId])
  @@index([tenantId])
  @@index([triggeredAt])
  @@index([severity])
}
```

### Key Fields

- **ruleId**: Reference to the alert rule that triggered
- **ruleName**: Snapshot of rule name (for historical reference)
- **severity**: CRITICAL, WARNING, or INFO
- **triggeredAt**: When the alert was triggered
- **resolvedAt**: When the alert condition cleared (null if still active)
- **metricValue**: The actual metric value that triggered the alert
- **threshold**: The threshold that was exceeded
- **tenantId**: Tenant context (null for system-wide alerts)
- **context**: Additional context data (JSON)
- **notificationsSent**: Record of notification delivery attempts (JSON)
- **acknowledgedAt**: When an admin acknowledged the alert
- **acknowledgedBy**: User ID of the acknowledging admin

## API Endpoints

### 1. Get Alert History

```http
GET /api/v1/monitoring/alerts/history
```

**Query Parameters:**
- `limit` (optional): Maximum number of alerts to return (default: 50, max: 500)
- `tenantId` (optional): Filter by tenant (super admin only)

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert-uuid",
        "ruleId": "rule-uuid",
        "ruleName": "High Error Rate",
        "severity": "CRITICAL",
        "triggeredAt": "2026-02-03T10:00:00Z",
        "resolvedAt": "2026-02-03T10:15:00Z",
        "metricValue": 5.2,
        "threshold": 1.0,
        "tenantId": "tenant-uuid",
        "context": {},
        "notificationsSent": {},
        "acknowledgedAt": "2026-02-03T10:05:00Z",
        "acknowledgedBy": "user-uuid"
      }
    ],
    "count": 1,
    "limit": 50
  }
}
```

### 2. Acknowledge Alert

```http
POST /api/v1/monitoring/alerts/:alertId/acknowledge
```

**Response:**
```json
{
  "success": true,
  "data": {
    "alert": {
      "id": "alert-uuid",
      "acknowledgedAt": "2026-02-03T10:05:00Z",
      "acknowledgedBy": "user-uuid"
    }
  }
}
```

## Usage Examples

### Viewing Alert History

1. Navigate to `/admin/alert-history` in the admin dashboard
2. View statistics cards showing active, critical, and unacknowledged alerts
3. Use filters to narrow down alerts by severity or status
4. Click on individual alerts to see full details

### Acknowledging Alerts

1. Find an unacknowledged alert in the alert history
2. Click the "Acknowledge" button
3. The alert is marked as acknowledged with your user ID and timestamp
4. The alert remains visible but shows acknowledged status

### Analyzing Alert Trends

Use the alert history to:
- Identify recurring issues
- Measure response times
- Track resolution effectiveness
- Plan capacity improvements
- Audit system reliability

## Integration with Alert Rules

Alert history is automatically created when:

1. **Alert Rule Evaluation**: The alert rules evaluator checks metrics
2. **Threshold Exceeded**: A metric exceeds its configured threshold
3. **Alert Triggered**: A new entry is created in `MonitoringAlertHistory`
4. **Notifications Sent**: Configured notification channels are triggered
5. **Auto-Resolution**: When metric returns to normal, `resolvedAt` is set

## Best Practices

### For Administrators

1. **Regular Review**: Check alert history daily for patterns
2. **Prompt Acknowledgment**: Acknowledge alerts after investigation
3. **Document Actions**: Use external systems to track remediation steps
4. **Tune Thresholds**: Adjust alert rules based on historical data
5. **Archive Old Alerts**: Implement data retention policies

### For Developers

1. **Meaningful Context**: Include relevant debugging information in context field
2. **Accurate Metrics**: Ensure metric values are correctly calculated
3. **Proper Severity**: Use appropriate severity levels (CRITICAL, WARNING, INFO)
4. **Test Alerts**: Verify alert rules trigger correctly
5. **Monitor Performance**: Ensure alert evaluation doesn't impact system performance

## Troubleshooting

### Alerts Not Appearing

1. Check that alert rules are enabled
2. Verify metric collection is working
3. Confirm thresholds are configured correctly
4. Check database connectivity

### Acknowledgment Failing

1. Verify user has admin role
2. Check alert exists and is not already acknowledged
3. Review API logs for errors
4. Confirm database permissions

### Missing Historical Data

1. Check data retention policies
2. Verify database migrations ran successfully
3. Confirm alert rules were active during the period
4. Review system logs for errors

## Performance Considerations

### Database Indexes

The following indexes optimize alert history queries:

```sql
CREATE INDEX "MonitoringAlertHistory_ruleId_idx" ON "MonitoringAlertHistory" ("ruleId");
CREATE INDEX "MonitoringAlertHistory_tenantId_idx" ON "MonitoringAlertHistory" ("tenantId");
CREATE INDEX "MonitoringAlertHistory_triggeredAt_idx" ON "MonitoringAlertHistory" ("triggeredAt");
CREATE INDEX "MonitoringAlertHistory_severity_idx" ON "MonitoringAlertHistory" ("severity");
```

### Query Optimization

- Use pagination for large result sets
- Filter by date range when possible
- Index frequently queried fields
- Archive old alerts periodically

## Data Retention

Recommended retention policies:

- **Active Alerts**: Keep indefinitely until resolved
- **Resolved Alerts**: Keep for 90 days
- **Acknowledged Alerts**: Keep for 30 days after resolution
- **Archived Alerts**: Export to long-term storage after 90 days

## Security Considerations

- Only admins can view alert history
- Super admins can view all tenants' alerts
- Regular admins see only their tenant's alerts
- Acknowledgment actions are logged with user ID
- API endpoints are rate-limited

## Related Documentation

- [Monitoring System](./MONITORING_SYSTEM.md)
- [Alert Notifications](./ALERT_NOTIFICATIONS.md)
- [Alert Threshold Configuration](./ALERT_THRESHOLD_CONFIGURATION.md)
- [Monitoring Infrastructure Setup](./MONITORING_INFRASTRUCTURE_SETUP.md)

## Requirements Satisfied

- **2.15.4**: Alert history tracking implemented
- **2.15.5**: Alert acknowledgment workflow implemented

## Status

✅ **Complete** - Alert history tracking is fully implemented and operational.
