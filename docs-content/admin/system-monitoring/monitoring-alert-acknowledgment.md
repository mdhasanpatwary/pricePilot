---
title: "Monitoring Alert Acknowledgment"
description: "Acknowledging and managing monitoring alerts"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["monitoring", "alerts", "acknowledgment"]
audience: "admin"
---

# Monitoring Alert Acknowledgment

## Overview

Alert acknowledgment is a critical feature of the monitoring system that allows administrators to indicate they are aware of and addressing an alert. This prevents notification fatigue by stopping repeat notifications for acknowledged alerts while maintaining full visibility and audit trails.

## Architecture

### Database Schema

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
  acknowledgedAt     DateTime?               // Acknowledgment timestamp
  acknowledgedBy     String?                 // User ID who acknowledged
  
  rule MonitoringAlertRule @relation(...)
  
  @@index([ruleId])
  @@index([tenantId])
  @@index([triggeredAt])
  @@index([severity])
}
```

### API Endpoint

**Route**: `POST /api/v1/monitoring/alerts/:alertId/acknowledge`

**Handler**: `app/api/v1/monitoring/alerts/[alertId]/acknowledge/route.ts`

**Flow**:
```
1. Authenticate user (session required)
2. Verify admin role
3. Validate alert ID
4. Check alert exists
5. Verify not already acknowledged
6. Update alert with acknowledgment data
7. Log acknowledgment event
8. Return updated alert
```

### UI Component

**Page**: `app/admin/alert-history/page.tsx`

**Features**:
- Alert list with acknowledgment status
- Acknowledge button for unacknowledged alerts
- Loading states during acknowledgment
- Visual badges for acknowledged alerts
- Filter by acknowledgment status
- Statistics dashboard

### Notification Logic

**Service**: `lib/services/monitoring/alert-rules-evaluator.ts`

**Method**: `getRecentlyResolvedAlerts()`

**Filter Logic**:
```typescript
const resolvedAlerts = await prisma.monitoringAlertHistory.findMany({
    where: {
        resolvedAt: { gte: since },
        acknowledgedAt: null,  // Exclude acknowledged alerts
    },
});
```

This ensures:
- Acknowledged alerts don't trigger repeat notifications
- Resolution notifications respect acknowledgment status
- System maintains clean notification flow

## User Workflow

### 1. Alert Triggered
```
System detects threshold breach
    ↓
Alert created in database
    ↓
Notifications sent to channels
    ↓
Alert appears in history (unacknowledged)
```

### 2. Administrator Reviews
```
Admin views alert history
    ↓
Identifies critical alert
    ↓
Reviews alert details
    ↓
Decides to investigate
```

### 3. Acknowledgment
```
Admin clicks "Acknowledge" button
    ↓
API validates and updates alert
    ↓
UI shows acknowledged badge
    ↓
Notifications stop for this alert
```

### 4. Resolution
```
Admin fixes underlying issue
    ↓
Metric returns to normal
    ↓
System marks alert as resolved
    ↓
Alert shows both acknowledged and resolved
```

## Implementation Details

### Authentication & Authorization

```typescript
// Check authentication
const session = await getServerSession(authOptions);
if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Check admin role
const isAdmin = session.user.role === 'ADMIN' || session.user.isSuperAdmin === true;
if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Validation

```typescript
// Validate alert ID
if (!alertId || typeof alertId !== 'string') {
    return NextResponse.json({ error: 'Invalid alert ID' }, { status: 422 });
}

// Check alert exists
const alert = await prisma.monitoringAlertHistory.findUnique({
    where: { id: alertId },
});
if (!alert) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// Check not already acknowledged
if (alert.acknowledgedAt) {
    return NextResponse.json({ error: 'Already acknowledged' }, { status: 400 });
}
```

### Update Operation

```typescript
const updatedAlert = await prisma.monitoringAlertHistory.update({
    where: { id: alertId },
    data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: session.user.id,
    },
});
```

### Audit Logging

```typescript
logger.info('Alert acknowledged', {
    alertId,
    userId: session.user.id,
    userEmail: session.user.email,
    ruleName: alert.ruleName,
    severity: alert.severity,
});
```

## UI Implementation

### Alert Card Component

```tsx
<Card className={cn(
    "p-5",
    !alert.resolvedAt && "border-l-4",
    alert.severity === "CRITICAL" && "border-l-red-500"
)}>
    <div className="flex items-start gap-4">
        {/* Severity Icon */}
        <div className={getSeverityColor(alert.severity)}>
            {getSeverityIcon(alert.severity)}
        </div>
        
        {/* Alert Content */}
        <div className="flex-1">
            <div className="flex items-center gap-2">
                <Badge variant={getSeverityBadgeVariant(alert.severity)}>
                    {alert.severity}
                </Badge>
                {alert.acknowledgedAt && (
                    <Badge variant="outline">
                        <CheckCircle className="w-3 h-3" />
                        Acknowledged
                    </Badge>
                )}
            </div>
            
            {/* Alert Details */}
            <div className="space-y-2">
                <div>Metric Value: {alert.metricValue}</div>
                <div>Triggered: {new Date(alert.triggeredAt).toLocaleString()}</div>
                {alert.acknowledgedAt && (
                    <div className="text-xs text-muted-foreground">
                        Acknowledged at {new Date(alert.acknowledgedAt).toLocaleString()}
                        {alert.acknowledgedBy && ` by ${alert.acknowledgedBy}`}
                    </div>
                )}
            </div>
        </div>
        
        {/* Action Button */}
        {!alert.acknowledgedAt && !alert.resolvedAt && (
            <Button
                onClick={() => handleAcknowledge(alert.id)}
                disabled={acknowledgingIds.has(alert.id)}
                size="sm"
                variant="outline"
            >
                {acknowledgingIds.has(alert.id) ? (
                    <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Acknowledging...
                    </>
                ) : (
                    <>
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                        Acknowledge
                    </>
                )}
            </Button>
        )}
    </div>
</Card>
```

### Acknowledgment Handler

```tsx
const handleAcknowledge = async (alertId: string) => {
    setAcknowledgingIds((prev) => new Set(prev).add(alertId));
    
    try {
        const res = await fetch(`/api/v1/monitoring/alerts/${alertId}/acknowledge`, {
            method: "POST",
        });
        
        if (res.ok) {
            // Update local state
            setData((prevData) =>
                prevData.map((alert) =>
                    alert.id === alertId
                        ? {
                            ...alert,
                            acknowledgedAt: new Date().toISOString(),
                            acknowledgedBy: "current-user",
                        }
                        : alert
                )
            );
        } else {
            console.error("Failed to acknowledge alert");
        }
    } catch (error) {
        console.error("Error acknowledging alert:", error);
    } finally {
        setAcknowledgingIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(alertId);
            return newSet;
        });
    }
};
```

## Notification Filtering

### Alert Rules Evaluator

The `getRecentlyResolvedAlerts` method filters out acknowledged alerts:

```typescript
async getRecentlyResolvedAlerts(sinceMinutes: number = 5): Promise<TriggeredAlert[]> {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
    
    const resolvedAlerts = await prisma.monitoringAlertHistory.findMany({
        where: {
            resolvedAt: {
                gte: since,
            },
            // Only get alerts that were resolved recently but not acknowledged yet
            acknowledgedAt: null,
        },
        orderBy: {
            resolvedAt: 'desc',
        },
    });
    
    return resolvedAlerts.map((alert) => ({
        ruleId: alert.ruleId,
        ruleName: alert.ruleName,
        severity: alert.severity,
        triggeredAt: alert.triggeredAt,
        metricValue: Number(alert.metricValue),
        threshold: Number(alert.threshold),
        tenantId: alert.tenantId,
        context: {
            ...(alert.context as Record<string, any> || {}),
            resolvedAt: alert.resolvedAt,
            isResolution: true,
        },
    }));
}
```

### Benefits

1. **Prevents Notification Spam**: Acknowledged alerts don't trigger repeat notifications
2. **Maintains Visibility**: Alerts remain in history for reference
3. **Audit Trail**: Full record of who acknowledged what and when
4. **Clean Workflow**: Clear separation between active, acknowledged, and resolved states

## Performance Considerations

### Database Indexes

```sql
-- Existing indexes support efficient queries
CREATE INDEX idx_alert_history_acknowledged ON "MonitoringAlertHistory"("acknowledgedAt");
CREATE INDEX idx_alert_history_resolved ON "MonitoringAlertHistory"("resolvedAt");
CREATE INDEX idx_alert_history_triggered ON "MonitoringAlertHistory"("triggeredAt");
```

### Query Optimization

```typescript
// Efficient query with proper indexes
const unacknowledgedAlerts = await prisma.monitoringAlertHistory.findMany({
    where: {
        acknowledgedAt: null,
        resolvedAt: null,
    },
    orderBy: {
        triggeredAt: 'desc',
    },
    take: 100,
});
```

### Caching Strategy

- Alert history is fetched on page load
- Optimistic UI updates for acknowledgments
- Refresh button for manual updates
- No aggressive polling (reduces server load)

## Security Considerations

### Access Control

1. **Authentication Required**: All endpoints require valid session
2. **Admin Only**: Only admin users can acknowledge alerts
3. **Audit Logging**: All acknowledgments logged with user details
4. **Rate Limiting**: API endpoints are rate-limited

### Data Validation

1. **Alert ID Validation**: Ensures valid UUID format
2. **Existence Check**: Verifies alert exists before update
3. **State Validation**: Prevents double acknowledgment
4. **User Validation**: Verifies user has permission

### Audit Trail

Every acknowledgment creates:
- Database record with timestamp and user ID
- Application log entry
- Audit log entry (if configured)

## Testing

### Unit Tests

```typescript
describe('Alert Acknowledgment', () => {
    it('should acknowledge unacknowledged alert', async () => {
        // Test implementation
    });
    
    it('should reject already acknowledged alert', async () => {
        // Test implementation
    });
    
    it('should require admin role', async () => {
        // Test implementation
    });
});
```

### Integration Tests

```typescript
describe('Alert Acknowledgment API', () => {
    it('should acknowledge alert via API', async () => {
        // Test implementation
    });
    
    it('should filter acknowledged alerts from notifications', async () => {
        // Test implementation
    });
});
```

### Manual Testing Checklist

- [ ] Acknowledge button appears on unacknowledged alerts
- [ ] Button disabled during acknowledgment
- [ ] UI updates after successful acknowledgment
- [ ] Acknowledged badge displays correctly
- [ ] Filter by acknowledgment status works
- [ ] Statistics update correctly
- [ ] Non-admin users cannot acknowledge
- [ ] Already acknowledged alerts show error
- [ ] Notifications stop after acknowledgment

## Monitoring & Metrics

### Key Metrics

1. **Acknowledgment Rate**: % of alerts acknowledged
2. **Time to Acknowledgment**: Average time from trigger to acknowledgment
3. **Acknowledgment by User**: Track which users acknowledge most alerts
4. **Acknowledgment by Severity**: Track acknowledgment patterns by severity

### Queries

```sql
-- Acknowledgment rate
SELECT 
    COUNT(*) FILTER (WHERE "acknowledgedAt" IS NOT NULL) * 100.0 / COUNT(*) as acknowledgment_rate
FROM "MonitoringAlertHistory"
WHERE "triggeredAt" >= NOW() - INTERVAL '7 days';

-- Average time to acknowledgment
SELECT 
    AVG(EXTRACT(EPOCH FROM ("acknowledgedAt" - "triggeredAt"))) / 60 as avg_minutes
FROM "MonitoringAlertHistory"
WHERE "acknowledgedAt" IS NOT NULL
AND "triggeredAt" >= NOW() - INTERVAL '7 days';

-- Acknowledgments by user
SELECT 
    "acknowledgedBy",
    COUNT(*) as acknowledgment_count
FROM "MonitoringAlertHistory"
WHERE "acknowledgedAt" IS NOT NULL
AND "triggeredAt" >= NOW() - INTERVAL '7 days'
GROUP BY "acknowledgedBy"
ORDER BY acknowledgment_count DESC;
```

## Future Enhancements

### Planned Features

1. **Bulk Acknowledgment**: Acknowledge multiple alerts at once
2. **Auto-Acknowledgment**: Automatically acknowledge resolved alerts after X hours
3. **Acknowledgment Notes**: Allow users to add notes when acknowledging
4. **Acknowledgment Templates**: Pre-defined acknowledgment reasons
5. **Notification Preferences**: Per-user preferences for acknowledged alerts
6. **Acknowledgment Reminders**: Remind users of unacknowledged critical alerts
7. **Acknowledgment Delegation**: Allow users to delegate acknowledgment to others
8. **Acknowledgment Workflows**: Multi-step acknowledgment process for critical alerts

### API Extensions

```typescript
// Bulk acknowledgment
POST /api/v1/monitoring/alerts/acknowledge-bulk
{
  "alertIds": ["id1", "id2", "id3"],
  "note": "Investigating database performance issue"
}

// Acknowledgment with note
POST /api/v1/monitoring/alerts/:alertId/acknowledge
{
  "note": "Scaling up database instances",
  "estimatedResolution": "2026-02-03T12:00:00Z"
}

// Unacknowledge (if needed)
DELETE /api/v1/monitoring/alerts/:alertId/acknowledge
```

## Related Documentation

- [Alert Notifications](./ALERT_NOTIFICATIONS.md)
- [Alert Threshold Configuration](./ALERT_THRESHOLD_CONFIGURATION.md)
- [Alert History Tracking](./ALERT_HISTORY_TRACKING.md)
- [Monitoring System Overview](./MONITORING_SYSTEM.md)
- [Alert Rules Evaluator](./ALERT_RULES_EVALUATOR.md)

## Support

For issues or questions:
1. Check the [Quick Reference](./ALERT_ACKNOWLEDGMENT_QUICK_REFERENCE.md)
2. Review the [User Guide](./ALERT_ACKNOWLEDGMENT_GUIDE.md)
3. Check audit logs for acknowledgment history
4. Contact system administrator

---

**Version**: 1.0  
**Last Updated**: February 3, 2026  
**Status**: Production Ready
