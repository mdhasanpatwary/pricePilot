---
title: "Alert Acknowledgment Guide"
description: "Guide for acknowledging alerts"
category: "troubleshooting"
tags: ["alerts", "guide", "notifications"]
audience: "tenant"
relatedDocs: ["/admin-docs/alerting/alert-acknowledgment-guide.md"]
author: "PricePilot Team"
lastReviewed: "2024-05-20"
---

# Alert Acknowledgment Guide

## Overview

The alert acknowledgment feature allows administrators to acknowledge monitoring alerts, indicating that they are aware of the issue and are taking action. Acknowledged alerts will not trigger additional notifications, reducing alert fatigue while maintaining visibility.

## Key Features

- **One-Click Acknowledgment**: Acknowledge alerts directly from the alert history page
- **User Tracking**: System tracks who acknowledged each alert and when
- **Notification Control**: Acknowledged alerts stop sending repeat notifications
- **Visual Indicators**: Clear badges show acknowledgment status
- **Filtering**: Filter alerts by acknowledgment status
- **Audit Trail**: All acknowledgments are logged for compliance

## How to Acknowledge an Alert

### From Alert History Page

1. Navigate to **Admin Dashboard** → **Alert History**
2. Locate the alert you want to acknowledge
3. Click the **"Acknowledge"** button on the alert card
4. The alert will be marked as acknowledged immediately

### Visual Feedback

- **Before**: Alert shows "Acknowledge" button
- **During**: Button shows "Acknowledging..." with spinner
- **After**: Alert displays "Acknowledged" badge with timestamp

## Alert States

### Active Alert (Unacknowledged)
```
🚨 CRITICAL
High Error Rate

Metric Value: 5.23% (Threshold: 1.00%)
Triggered: 2/3/2026, 10:15:23 AM

[✓ Acknowledge]
```

### Acknowledged Alert
```
🚨 CRITICAL              [✓ Acknowledged]
High Error Rate

Metric Value: 5.23% (Threshold: 1.00%)
Triggered: 2/3/2026, 10:15:23 AM

Acknowledged at 2/3/2026, 10:30:45 AM by admin@example.com
```

### Resolved Alert
```
🚨 CRITICAL              [✓ Resolved]
High Error Rate

Metric Value: 5.23% (Threshold: 1.00%)
Triggered: 2/3/2026, 10:15:23 AM
Resolved: 2/3/2026, 11:00:00 AM
```

## Filtering Alerts

Use the filter dropdown to view specific alert types:

- **All Alerts**: Show all alerts regardless of status
- **Active**: Show only unresolved alerts
- **Resolved**: Show only resolved alerts
- **Acknowledged**: Show only acknowledged alerts
- **Unacknowledged**: Show only unacknowledged alerts

## Dashboard Statistics

The alert history page displays three key metrics:

1. **Active Alerts**: Number of unresolved alerts
2. **Critical Alerts**: Number of critical severity alerts requiring attention
3. **Unacknowledged**: Number of alerts that need review

## Notification Behavior

### Before Acknowledgment
- Alert triggers initial notification to all configured channels
- Repeat notifications may be sent based on alert rule configuration
- Resolution notifications sent when condition clears

### After Acknowledgment
- No additional notifications sent for this alert
- Alert remains visible in history for reference
- Resolution notifications are suppressed
- New alerts for the same rule will still trigger notifications

## Best Practices

### When to Acknowledge

✅ **Do acknowledge when**:
- You are actively investigating the issue
- You have identified the root cause
- You are implementing a fix
- The alert is a known issue with a workaround

❌ **Don't acknowledge when**:
- You haven't reviewed the alert details
- The issue requires immediate escalation
- You're unsure about the severity
- Multiple team members need to be notified

### Team Workflow

1. **Triage**: Review unacknowledged alerts daily
2. **Acknowledge**: Acknowledge alerts you're working on
3. **Investigate**: Determine root cause and impact
4. **Resolve**: Fix the underlying issue
5. **Monitor**: Verify the alert resolves automatically

### Alert Fatigue Prevention

- Acknowledge alerts you're actively working on
- Use filters to focus on unacknowledged alerts
- Review acknowledgment patterns to identify recurring issues
- Adjust alert thresholds if too many false positives

## API Integration

### Acknowledge Alert Endpoint

```http
POST /api/v1/monitoring/alerts/:alertId/acknowledge
Authorization: Bearer <admin-token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "alert": {
      "id": "alert-id",
      "acknowledgedAt": "2026-02-03T10:30:45.000Z",
      "acknowledgedBy": "user-id"
    }
  }
}
```

### Error Responses

**Already Acknowledged** (400):
```json
{
  "success": false,
  "error": {
    "code": "ALREADY_ACKNOWLEDGED",
    "message": "Alert has already been acknowledged"
  }
}
```

**Not Found** (404):
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Alert not found"
  }
}
```

**Unauthorized** (403):
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required"
  }
}
```

## Permissions

### Required Role
- **Admin**: Can acknowledge all alerts
- **Viewer/Editor**: Cannot acknowledge alerts

### Access Control
- Only authenticated users can access the API
- Only admin users can acknowledge alerts
- All acknowledgments are logged with user details

## Audit Trail

Every acknowledgment is logged with:
- Alert ID and rule name
- User ID and email
- Timestamp
- Alert severity
- Metric value and threshold

View audit logs in the system logs or database:
```sql
SELECT * FROM "TenantAuditLog"
WHERE action = 'ACKNOWLEDGE_ALERT'
ORDER BY "createdAt" DESC;
```

## Troubleshooting

### Button Not Appearing

**Possible Causes**:
- Alert is already acknowledged
- Alert is already resolved
- You don't have admin permissions

**Solution**: Check alert status and your user role

### Acknowledgment Fails

**Possible Causes**:
- Network connectivity issue
- Session expired
- Alert was acknowledged by another user

**Solution**: Refresh the page and try again

### Notifications Still Sending

**Possible Causes**:
- Notifications were already queued before acknowledgment
- Different alert rule triggered
- Alert was resolved and re-triggered

**Solution**: Verify the alert ID and check for new alerts

## Related Documentation

- [Alert Notifications Guide](./ALERT_NOTIFICATIONS.md)
- [Alert Threshold Configuration](./ALERT_THRESHOLD_CONFIGURATION.md)
- [Alert History Tracking](./ALERT_HISTORY_TRACKING.md)
- [Monitoring System Overview](./MONITORING_SYSTEM.md)

## Support

For issues or questions about alert acknowledgment:
1. Check the troubleshooting section above
2. Review the audit logs for acknowledgment history
3. Contact your system administrator
4. Refer to the API documentation for integration issues

---

**Last Updated**: February 3, 2026
**Version**: 1.0
