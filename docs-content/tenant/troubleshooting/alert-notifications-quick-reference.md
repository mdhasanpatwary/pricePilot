---
title: "Alert Notifications Quick Reference"
description: "Quick reference for alert notifications"
category: "troubleshooting"
tags: ["alerts", "notifications", "quick-reference"]
audience: "tenant"
relatedDocs: ["/admin-docs/alerting/alert-notifications-quick-reference.md"]
---

# Alert Notifications - Quick Reference

## Quick Setup

### Enable Email Notifications (User)
1. Go to **Settings** → **Notifications**
2. Toggle **Email Notifications** ON
3. Done! You'll receive alerts via email

### Enable Slack Notifications (Admin)
1. Go to **Settings** → **Notifications**
2. Toggle **Slack Alerts** ON
3. Enter your Slack Webhook URL
4. Click **Save**
5. Done! Team will receive alerts in Slack

## Get Slack Webhook URL

1. Visit https://api.slack.com/apps
2. Create new app or select existing
3. Go to **Incoming Webhooks**
4. Activate Incoming Webhooks
5. Click **Add New Webhook to Workspace**
6. Select channel for alerts
7. Copy webhook URL
8. Paste in PricePilot settings

## Alert Severity

| Severity | Icon | Color | Meaning |
|----------|------|-------|---------|
| CRITICAL | 🚨 | Red | Immediate attention required |
| WARNING | ⚠️ | Yellow | Potential issue, monitor closely |
| INFO | ℹ️ | Blue | Informational, for awareness |

## Common Alert Types

### Error Rate Alert
**Threshold:** >1% error rate  
**Action:** Check logs, verify services

### Response Time Alert
**Threshold:** >500ms average  
**Action:** Check database, review queries

### Scraping Block Rate Alert
**Threshold:** >30% blocked  
**Action:** Check proxies, adjust rate limits

### Price Update Failure Alert
**Threshold:** >5% failures  
**Action:** Verify API tokens, check connectivity

## Notification Features

✅ HTML-formatted emails  
✅ Severity-based color coding  
✅ Remediation steps included  
✅ Direct dashboard links  
✅ Resolution notifications  
✅ Slack rich formatting  
✅ Alert deduplication  
✅ Rate limiting protection  

## Troubleshooting

### Not Receiving Emails?
- Check Settings → Notifications is enabled
- Verify email address is correct
- Check spam/junk folder
- Contact admin if issue persists

### Not Receiving Slack Messages?
- Verify Slack is enabled (admin setting)
- Check webhook URL is correct
- Ensure Slack app has permissions
- Test with sample notification

## Best Practices

✅ Keep email notifications enabled  
✅ Configure Slack for team visibility  
✅ Check spam folder regularly  
✅ Test notifications after setup  
✅ Review alert history periodically  
✅ Document escalation procedures  

## API Quick Reference

### Get User Preferences
```bash
GET /api/v1/user/notification-preferences
```

### Update User Preferences
```bash
PATCH /api/v1/user/notification-preferences
{"emailNotifications": true}
```

### Get Tenant Settings
```bash
GET /api/v1/tenant/notification-settings
```

### Update Tenant Settings
```bash
PATCH /api/v1/tenant/notification-settings
{"slackEnabled": true, "slackWebhookUrl": "..."}
```

## Need Help?

📖 **Full Guide:** [Alert Notifications Guide](./ALERT_NOTIFICATIONS.md)  
📊 **Monitoring:** [Monitoring System Guide](./MONITORING_SYSTEM.md)  
⚙️ **Configuration:** [Alert Configuration Guide](./MONITORING_ALERT_CONFIGURATION.md)  

---

**Last Updated:** February 3, 2026  
**Version:** 1.0
