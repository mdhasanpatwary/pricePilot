# Alert Acknowledgment - Quick Reference

## Quick Actions

| Action | Location | Button |
|--------|----------|--------|
| Acknowledge Alert | Alert History Page | `[✓ Acknowledge]` |
| View Acknowledged | Filter Dropdown | Select "Acknowledged" |
| View Unacknowledged | Filter Dropdown | Select "Unacknowledged" |

## Alert States

| State | Badge | Notifications |
|-------|-------|---------------|
| Active | None | ✅ Sending |
| Acknowledged | `[✓ Acknowledged]` | ❌ Stopped |
| Resolved | `[✓ Resolved]` | ❌ Stopped |

## API Endpoint

```http
POST /api/v1/monitoring/alerts/:alertId/acknowledge
```

**Auth**: Admin only  
**Rate Limit**: Write tier

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Already acknowledged |
| 401 | Not authenticated |
| 403 | Not admin |
| 404 | Alert not found |
| 422 | Invalid alert ID |
| 500 | Server error |

## Permissions

| Role | Can Acknowledge |
|------|----------------|
| Admin | ✅ Yes |
| Editor | ❌ No |
| Viewer | ❌ No |

## Best Practices

✅ **Do**:
- Acknowledge when investigating
- Use filters to focus on unacknowledged
- Review daily for new alerts

❌ **Don't**:
- Acknowledge without reviewing
- Acknowledge critical alerts prematurely
- Use as a way to hide alerts

## Notification Behavior

```
Alert Triggered → Notification Sent
       ↓
Acknowledged → Notifications Stop
       ↓
Resolved → Alert Closed
```

## Statistics

View on Alert History page:
- **Active Alerts**: Unresolved count
- **Critical Alerts**: Requiring attention
- **Unacknowledged**: Need review

## Filters

| Filter | Shows |
|--------|-------|
| All Alerts | Everything |
| Active | Unresolved only |
| Resolved | Resolved only |
| Acknowledged | Acknowledged only |
| Unacknowledged | Unacknowledged only |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Button missing | Check if already acknowledged/resolved |
| Can't acknowledge | Verify admin role |
| Still getting notifications | Check if new alert triggered |

## Related Pages

- [Full Guide](./ALERT_ACKNOWLEDGMENT_GUIDE.md)
- [Alert Notifications](./ALERT_NOTIFICATIONS.md)
- [Alert History](./ALERT_HISTORY_TRACKING.md)

---

**Quick Tip**: Use keyboard shortcuts to navigate alerts faster!
