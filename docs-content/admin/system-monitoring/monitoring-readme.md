---
title: "Monitoring System Overview"
description: "Overview of the PricePilot monitoring system"
category: "system-monitoring"
tags: ["monitoring", "overview", "readme"]
audience: "admin"
---

# Monitoring and Alerting System - Quick Start Guide

## What is This?

The PricePilot monitoring and alerting system provides comprehensive observability for the platform. It tracks application health, detects critical issues, and delivers notifications through email and Slack to ensure rapid incident response.

## Quick Links

- **Dashboard**: `/dashboard/monitoring`
- **Alert Configuration**: `/dashboard/monitoring/alerts`
- **Notification Channels**: `/dashboard/monitoring/channels`
- **Test Alerts**: `/dashboard/monitoring/test`

## 5-Minute Setup

### 1. Configure Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# Required
SENTRY_DSN=your-sentry-dsn
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
RESEND_API_KEY=your-resend-key
EMAIL_FROM=alerts@yourdomain.com

# Optional
SLACK_WEBHOOK_URL=your-slack-webhook
```

### 2. Run Database Migrations

```bash
npm run db:migrate:deploy
```

### 3. Verify Setup

```bash
npm run verify:monitoring
```

### 4. Access Dashboard

Navigate to `/dashboard/monitoring` (requires admin role)

## What Gets Monitored?

### Automatic Monitoring

The system automatically tracks:

- **Error Rates**: Percentage of failed requests
- **Response Times**: API endpoint latency (avg, p95, p99)
- **Scraping Metrics**: Success/block rates for competitor scraping
- **Price Updates**: Success rates for price update operations
- **Security Events**: Authentication failures, rate limits
- **System Health**: Database and Redis connections

### Built-in Alerts

Pre-configured alerts for:

1. High error rate (> 1% over 5 minutes)
2. Slow response time (> 500ms over 5 minutes)
3. High scraping block rate (> 30% over 15 minutes)
4. Price update failures (> 10% over 10 minutes)
5. Authentication failures (> 10 from single IP)
6. Database connection issues
7. Redis connection issues

## How to Use

### View System Health

1. Go to `/dashboard/monitoring`
2. Check system health status (green = healthy)
3. Review active alerts
4. View metric trends

### Configure Alert Rules

1. Go to `/dashboard/monitoring/alerts`
2. Click "Create Alert Rule"
3. Configure:
   - Metric type (error_rate, response_time, etc.)
   - Threshold (when to trigger)
   - Time window (evaluation period)
   - Notification channels (where to send)
4. Save and enable

### Set Up Notifications

1. Go to `/dashboard/monitoring/channels`
2. Add email channel:
   - Recipients
   - Sender address
3. Add Slack channel (optional):
   - Webhook URL
   - Channel name
4. Test each channel

### Test Alerts

1. Go to `/dashboard/monitoring/test`
2. Select an alert rule
3. Click "Send Test Alert"
4. Verify delivery in email/Slack

## Common Tasks

### Adjust Alert Threshold

```bash
# Via API
PUT /api/v1/monitoring/alert-rules/:id
{
  "threshold": 0.02  # Change from 1% to 2%
}
```

### Disable Noisy Alert

1. Go to alert configuration
2. Toggle "Enabled" switch off
3. Alert stops triggering

### Set Maintenance Window

```bash
# Via API
POST /api/v1/monitoring/maintenance-window
{
  "start": "2026-02-15T02:00:00Z",
  "end": "2026-02-15T04:00:00Z"
}
```

### View Alert History

```bash
# Via API
GET /api/v1/monitoring/alerts/history?limit=50
```

## Troubleshooting

### Alerts Not Triggering

1. Check alert rule is enabled
2. Verify metrics are being collected
3. Review threshold and time window
4. Check maintenance window status

### Notifications Not Received

1. Test notification channel
2. Check delivery logs in dashboard
3. Verify email/Slack configuration
4. Check spam folder (for email)

### Dashboard Not Loading

1. Verify you have admin role
2. Check browser console for errors
3. Verify API endpoints are accessible
4. Clear browser cache

### Need Help?

1. Check [Troubleshooting Guide](./MONITORING_TROUBLESHOOTING.md)
2. Review [Full Documentation](./MONITORING_SYSTEM.md)
3. Contact platform support

## Documentation Index

### Getting Started
- [Quick Start Guide](./MONITORING_README.md) ← You are here
- [Full System Overview](./MONITORING_SYSTEM.md)
- [Infrastructure Setup](./MONITORING_INFRASTRUCTURE_SETUP.md)
- [Environment Variables](./MONITORING_ENVIRONMENT_VARIABLES.md)

### Configuration
- [Alert Rule Configuration](./MONITORING_ALERT_CONFIGURATION.md)
- [Notification Channel Setup](./MONITORING_NOTIFICATION_SETUP.md)
- [Dashboard Usage](./MONITORING_UI.md)

### Operations
- [Deployment Checklist](./MONITORING_DEPLOYMENT_CHECKLIST.md)
- [Troubleshooting Guide](./MONITORING_TROUBLESHOOTING.md)
- [API Reference](./API_MONITORING.md)

### Integration
- [Email Notifications](./EMAIL_NOTIFICATIONS.md)
- [Performance Monitoring](./PERFORMANCE_MONITORING.md)

## Key Features

### Real-Time Monitoring
- Live system health dashboard
- Auto-refresh every 30 seconds
- Historical trend charts
- Active alerts display

### Smart Alerting
- Threshold-based triggering
- Alert deduplication (15-minute window)
- Resolution notifications
- Maintenance window support

### Multi-Channel Notifications
- Email with rich formatting
- Slack with color coding
- Retry logic with exponential backoff
- Fallback to alternative channels

### Multi-Tenant Support
- Tenant-specific metrics
- Tenant-specific alerts
- Dashboard filtering by tenant
- Tenant isolation enforced

### Security Monitoring
- Authentication failure tracking
- Rate limit violation detection
- Suspicious pattern detection
- Unauthorized access tracking

## Performance

The monitoring system is designed for minimal overhead:

- **Request Overhead**: < 5ms per request
- **Alert Evaluation**: < 1 second for all rules
- **Notification Delivery**: < 5 seconds to all channels
- **Dashboard Load**: < 2 seconds

## Best Practices

### Alert Configuration
- Start with conservative thresholds
- Adjust based on baseline metrics
- Use percentiles for response times
- Test alerts before enabling

### Notification Routing
- Critical alerts: Email + Slack
- Warnings: Email only
- Info: Dashboard only
- Use different channels for different teams

### Maintenance
- Review alert rules monthly
- Update thresholds based on trends
- Clean up unused channels
- Test notification delivery regularly

### Monitoring
- Check dashboard daily
- Review alert history weekly
- Analyze false positive rates
- Document response procedures

## Support

### Before Contacting Support

1. Run verification script: `npm run verify:monitoring`
2. Check troubleshooting guide
3. Review system health dashboard
4. Check Sentry for error details

### What to Provide

- System health status
- Error messages and stack traces
- Alert rule configuration
- Notification channel configuration
- Verification script output

### Contact

- **Documentation**: Review all monitoring docs
- **Dashboard**: Check delivery statistics
- **Platform Support**: platform@yourdomain.com

## Next Steps

1. **Configure Alerts**: Set up alert rules for your needs
2. **Set Up Notifications**: Configure email and Slack channels
3. **Test System**: Send test alerts to verify delivery
4. **Monitor**: Check dashboard regularly
5. **Tune**: Adjust thresholds based on experience

## Related Systems

The monitoring system integrates with:

- **Sentry**: Error tracking and performance monitoring
- **Redis/Upstash**: Metrics storage and alert state
- **Resend**: Email notification delivery
- **Slack**: Team collaboration and alerts
- **PostgreSQL**: Alert configuration and history

## Version History

- **v1.0.0** (2026-02-02): Initial release
  - Error tracking with Sentry
  - Custom metrics collection
  - Multi-channel alerting
  - Real-time dashboard
  - Multi-tenant support

## License

Internal use only - PricePilot Platform
