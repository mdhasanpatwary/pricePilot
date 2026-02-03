# Notification Channel Setup Guide

## Overview

This guide explains how to configure notification channels for the PricePilot monitoring system. Notification channels determine where alerts are delivered when triggered.

## Supported Channels

- **Email**: Send alerts via email using Resend
- **Slack**: Post alerts to Slack channels via webhooks

## Email Notification Setup

### Prerequisites

- Resend account and API key
- Verified sender domain
- Recipient email addresses

### Environment Configuration

Add to `.env`:

```bash
# Email Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=alerts@yourdomain.com
EMAIL_FROM_NAME=PricePilot Alerts
```

### Email Channel Configuration

#### Via Dashboard UI

1. Navigate to **Dashboard → Monitoring → Channels**
2. Click **"Add Email Channel"**
3. Fill in the form:
   - **Name**: Descriptive name (e.g., "Operations Team")
   - **Recipients**: Comma-separated email addresses
   - **From Address**: Sender email (must be verified in Resend)
   - **From Name**: Display name for sender
4. Click **"Save"**
5. Click **"Test"** to verify delivery

#### Via API

```bash
POST /api/v1/monitoring/channels
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "email",
  "name": "Operations Team",
  "enabled": true,
  "config": {
    "recipients": ["ops@company.com", "alerts@company.com"],
    "fromAddress": "alerts@yourdomain.com",
    "fromName": "PricePilot Alerts"
  }
}
```

### Email Template

Alerts are sent with both HTML and plain text versions:

**Subject Format**: `[SEVERITY] PricePilot Alert: {RULE_NAME}`

**Email Content**:
- Alert severity with color coding
- Triggered timestamp
- Metric value vs threshold
- Affected component/tenant
- Link to monitoring dashboard
- Suggested remediation steps
- Alert context data

**Example**:

```
[CRITICAL] PricePilot Alert: High Error Rate

Severity: Critical
Triggered: 2026-02-02 14:30:00 UTC
Metric: error_rate
Value: 2.5% (threshold: 1.0%)
Time Window: 5 minutes

Affected Component: API Endpoints
Tenant: Acme Corp (tenant-123)

Suggested Actions:
1. Check application logs for error details
2. Review recent deployments
3. Check external service status
4. Monitor error rate trend

View Dashboard: https://app.pricepilot.com/dashboard/monitoring

Alert Context:
- Request ID: req-abc123
- Endpoint: /api/v1/products
- Error Type: DatabaseConnectionError
```

### Email Retry Logic

- Failed deliveries retry up to 3 times
- Exponential backoff: 1s, 2s, 4s
- Delivery status logged in dashboard

## Slack Notification Setup

### Prerequisites

- Slack workspace
- Incoming webhook URL
- Channel to post alerts

### Create Slack Webhook

1. Go to https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. Name: "PricePilot Alerts"
4. Select your workspace
5. Navigate to **"Incoming Webhooks"**
6. Activate incoming webhooks
7. Click **"Add New Webhook to Workspace"**
8. Select channel (e.g., #alerts)
9. Copy webhook URL

### Environment Configuration

Add to `.env`:

```bash
# Slack Configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
SLACK_CHANNEL=#alerts
```

### Slack Channel Configuration

#### Via Dashboard UI

1. Navigate to **Dashboard → Monitoring → Channels**
2. Click **"Add Slack Channel"**
3. Fill in the form:
   - **Name**: Descriptive name (e.g., "Engineering Alerts")
   - **Webhook URL**: Slack incoming webhook URL
   - **Channel**: Slack channel name (e.g., #alerts)
   - **Username**: Bot display name (e.g., "PricePilot Bot")
   - **Icon Emoji**: Bot icon (e.g., :warning:)
4. Click **"Save"**
5. Click **"Test"** to verify delivery

#### Via API

```bash
POST /api/v1/monitoring/channels
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "slack",
  "name": "Engineering Alerts",
  "enabled": true,
  "config": {
    "webhookUrl": "https://hooks.slack.com/services/...",
    "channel": "#alerts",
    "username": "PricePilot Bot",
    "iconEmoji": ":warning:"
  }
}
```

### Slack Message Format

Alerts are posted with rich formatting:

**Color Coding**:
- Critical: Red (#FF0000)
- Warning: Yellow (#FFA500)
- Info: Blue (#0000FF)

**Message Structure**:
- Alert title with severity
- Metric value and threshold
- Time window and trend
- Affected component/tenant
- Action buttons

**Example**:

```
🚨 CRITICAL: High Error Rate

Error Rate: 2.5% (threshold: 1.0%)
Time Window: 5 minutes
Trend: ↑ Increasing

Affected: API Endpoints
Tenant: Acme Corp

Suggested Actions:
• Check application logs
• Review recent deployments
• Monitor error rate trend

[View Dashboard] [Acknowledge] [Mute 1h]
```

### Slack Action Buttons

- **View Dashboard**: Opens monitoring dashboard
- **Acknowledge**: Marks alert as acknowledged
- **Mute**: Suppresses alerts for specified duration

### Slack Threading

- Resolution notifications posted as thread replies
- Keeps alert history organized
- Easy to track alert lifecycle

## Channel Management

### Enable/Disable Channels

1. Navigate to **Dashboard → Monitoring → Channels**
2. Toggle **"Enabled"** switch
3. Disabled channels do not receive alerts

### Update Channel Configuration

1. Click **"Edit"** on the channel
2. Modify configuration fields
3. Click **"Save"**
4. Changes take effect immediately

### Delete Channels

1. Click **"Delete"** on the channel
2. Confirm deletion
3. Alert rules using this channel are updated

### Test Channels

1. Click **"Test"** on the channel
2. Test notification sent immediately
3. Marked clearly as "TEST"
4. Verify delivery in email/Slack

## Multiple Channels

### Channel Routing

Alert rules can send to multiple channels:

```json
{
  "notificationChannels": ["email-ops", "slack-engineering"]
}
```

### Severity-Based Routing

Configure different channels for different severities:

- **Critical**: Email + Slack
- **Warning**: Email only
- **Info**: Dashboard only

### Team-Based Routing

Create channels for different teams:

- **Operations Team**: Email channel
- **Engineering Team**: Slack channel
- **Security Team**: Email + Slack channels

## Notification Rate Limiting

### Purpose

Prevent notification storms during incidents.

### Configuration

- Maximum 10 notifications per channel per minute
- Excess notifications queued for next cycle
- Rate limit events logged

### Behavior

- First 10 alerts delivered immediately
- Additional alerts queued
- Queue processed every minute
- Dashboard shows queued alerts

## Fallback Behavior

### Email Fallback

If Slack delivery fails:
- System falls back to email automatically
- Failure logged in dashboard
- Email includes note about Slack failure

### Logging Fallback

If all channels fail:
- Alert logged to database
- Marked as "undelivered"
- Displayed prominently in dashboard
- Manual notification required

## Notification Content

### Required Fields

All notifications include:

- Alert severity
- Triggered timestamp
- Metric name and value
- Threshold value
- Time window
- Affected component
- Tenant information (if applicable)
- Dashboard link
- Suggested remediation steps

### Optional Fields

- Alert context data
- Related metrics
- Historical trend
- Recent changes
- Error details

### Sensitive Data

Sensitive data is sanitized:

- Passwords removed
- API tokens redacted
- Credit card numbers masked
- Personal information anonymized

## Testing Notifications

### Test Individual Channels

1. Navigate to channel details
2. Click **"Send Test"**
3. Verify delivery
4. Check formatting and content

### Test Alert Rules

1. Navigate to alert rule details
2. Click **"Send Test Alert"**
3. Notifications sent to all configured channels
4. Verify delivery to each channel

### Delivery Statistics

1. Navigate to **Dashboard → Monitoring → Test**
2. View delivery statistics:
   - Total sent
   - Successful deliveries
   - Failed deliveries
   - Average delivery time
3. Filter by channel and time range

## Troubleshooting

### Email Not Received

**Check**:
1. Resend API key is valid
2. Sender domain is verified
3. Recipient email is correct
4. Check spam folder
5. Review delivery logs

**Solutions**:
- Verify Resend configuration
- Test with different recipient
- Check email service status
- Review error messages in logs

### Slack Not Received

**Check**:
1. Webhook URL is correct
2. Channel exists and bot has access
3. Slack workspace is active
4. Check Slack app status

**Solutions**:
- Regenerate webhook URL
- Verify channel permissions
- Test webhook with curl
- Check Slack API status

### Delayed Notifications

**Causes**:
- Rate limiting active
- Email service slow
- Slack API slow
- Network issues

**Solutions**:
- Check rate limit status
- Review delivery logs
- Monitor external service status
- Increase timeout settings

### Missing Notifications

**Check**:
1. Channel is enabled
2. Alert rule includes channel
3. Alert actually triggered
4. Not in maintenance window
5. Not deduplicated

**Solutions**:
- Enable channel
- Update alert rule configuration
- Verify metric collection
- Check maintenance window
- Review deduplication logs

## Best Practices

### Channel Organization

- Create separate channels for different teams
- Use descriptive channel names
- Document channel purposes
- Review channel usage regularly

### Recipient Management

- Keep recipient lists up to date
- Use distribution lists for teams
- Document on-call rotations
- Test with new recipients

### Testing

- Test channels after configuration
- Test after any changes
- Regular delivery verification
- Monitor delivery statistics

### Monitoring

- Review delivery success rates
- Monitor delivery times
- Check for failed deliveries
- Investigate delivery issues promptly

### Security

- Protect webhook URLs
- Rotate webhooks periodically
- Use environment variables
- Audit channel access

## API Reference

### List Channels

```bash
GET /api/v1/monitoring/channels
Authorization: Bearer <token>
```

### Get Channel

```bash
GET /api/v1/monitoring/channels/:id
Authorization: Bearer <token>
```

### Create Channel

```bash
POST /api/v1/monitoring/channels
Authorization: Bearer <token>
Content-Type: application/json
```

### Update Channel

```bash
PUT /api/v1/monitoring/channels/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### Delete Channel

```bash
DELETE /api/v1/monitoring/channels/:id
Authorization: Bearer <token>
```

### Test Channel

```bash
POST /api/v1/monitoring/channels/:id/test
Authorization: Bearer <token>
```

## Related Documentation

- [Alert Rule Configuration](./MONITORING_ALERT_CONFIGURATION.md)
- [Monitoring Dashboard](./MONITORING_UI.md)
- [Troubleshooting Guide](./MONITORING_TROUBLESHOOTING.md)
- [Email Notifications](./EMAIL_NOTIFICATIONS.md)
