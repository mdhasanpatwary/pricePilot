---
title: "Email Notifications"
description: "Email notification system overview"
category: "alerting"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["email", "notifications", "configuration"]
audience: "admin"
relatedDocs: ["/docs/troubleshooting/email-notifications.md"]
---

# Email Notifications Guide

## Overview

PricePilot includes a comprehensive email notification system for price approval workflows. This guide covers configuration, usage, and customization of email notifications.

## Features

### 1. Pending Approval Notifications
Notifies users when price changes are awaiting their approval.

**Trigger**: Manual or API call
**Recipients**: Users with `emailNotifications: true`
**Content**: Number of pending changes, link to dashboard

### 2. Daily Approval Summary
Sends a daily summary of approval activity.

**Trigger**: Cron job (daily at 8 AM)
**Recipients**: Users with `emailNotifications: true`
**Content**: 
- Manually approved count
- Auto-approved count
- Rejected count
- Still pending count

### 3. Auto-Approval Notifications
Notifies users when auto-approval rules process price changes.

**Trigger**: Auto-approval rule execution
**Recipients**: Users with `emailNotifications: true`
**Content**: Number of auto-approved changes, rule names

## Configuration

### SMTP Settings

Email notifications use SMTP configuration stored in the `SystemConfig` database table. These settings are managed by the Super Admin through the admin dashboard.

Required configuration keys:
- `NOTIFICATIONS_EMAIL_ENABLED`: "true" or "false"
- `SMTP_HOST`: SMTP server hostname
- `SMTP_PORT`: SMTP server port (typically 587 or 465)
- `SMTP_USER`: SMTP username
- `SMTP_PASS`: SMTP password
- `SMTP_FROM`: From email address

### User Preferences

Users can enable/disable email notifications in their account settings:

1. Navigate to Dashboard → Settings
2. Find "Email Notifications" toggle
3. Enable or disable as desired

This setting is stored in the `User.emailNotifications` field.

## Cron Jobs

### Daily Approval Summary

The daily approval summary is sent via a cron job configured in `vercel.json`:

```json
{
  "path": "/api/v1/cron/daily-approval-summary",
  "schedule": "0 8 * * *"
}
```

**Schedule**: Daily at 8:00 AM UTC

**Endpoint**: `GET /api/v1/cron/daily-approval-summary`

**Authentication**: Requires `CRON_SECRET` in Authorization header

## API Usage

### Send Pending Approval Notification

```typescript
import { mailService } from "@/lib/mail";

await mailService.sendPendingApprovalNotification(
  tenantId: string,
  pendingCount: number
);
```

### Send Daily Approval Summary

```typescript
import { mailService } from "@/lib/mail";

await mailService.sendDailyApprovalSummary(
  tenantId: string
);
```

### Send Auto-Approval Notification

```typescript
import { mailService } from "@/lib/mail";

await mailService.sendAutoApprovalNotification(
  tenantId: string,
  approvedCount: number,
  ruleNames: string[]
);
```

## Email Templates

All email templates include:
- Professional HTML formatting
- Responsive design
- Clear call-to-action buttons
- Unsubscribe instructions
- PricePilot branding

### Customization

To customize email templates, edit the HTML in `lib/mail.ts`:

```typescript
const html = `
  <h2>Your Custom Title</h2>
  <p>Your custom content...</p>
`;
```

## Error Handling

Email notifications are designed to fail gracefully:

- If SMTP is not configured, emails are skipped (logged)
- If a user has disabled notifications, they are skipped
- If email sending fails, errors are logged but don't throw
- Failed emails don't block other operations

## Testing

### Manual Testing

1. Configure SMTP settings in admin dashboard
2. Enable email notifications in user settings
3. Trigger a notification (e.g., create pending price changes)
4. Check your email inbox

### Automated Testing

Run the test suite:

```bash
npm test -- __tests__/lib/services/email-notifications.test.ts
```

### Test Cron Job Locally

```bash
curl -X GET http://localhost:3000/api/v1/cron/daily-approval-summary \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Troubleshooting

### Emails Not Sending

1. **Check SMTP Configuration**
   - Verify settings in SystemConfig table
   - Test SMTP credentials with a mail client

2. **Check User Preferences**
   - Ensure `emailNotifications: true` for the user
   - Check user email address is valid

3. **Check Logs**
   - Look for `[NotificationSender]` log entries
   - Check for SMTP connection errors

4. **Check Global Setting**
   - Ensure `NOTIFICATIONS_EMAIL_ENABLED: "true"` in SystemConfig

### Cron Job Not Running

1. **Verify Vercel Configuration**
   - Check `vercel.json` includes the cron job
   - Verify deployment includes cron configuration

2. **Check Cron Secret**
   - Ensure `CRON_SECRET` environment variable is set
   - Verify secret matches in request header

3. **Check Logs**
   - Look for `[DailySummary]` log entries
   - Check Vercel cron logs in dashboard

## Best Practices

1. **Rate Limiting**: Don't send too many emails in a short period
2. **Batching**: Group notifications when possible
3. **Timing**: Send summaries at appropriate times (e.g., morning)
4. **Content**: Keep emails concise and actionable
5. **Testing**: Always test email changes in staging first

## Security Considerations

1. **SMTP Credentials**: Store securely in database, never in code
2. **Cron Authentication**: Always verify `CRON_SECRET`
3. **Email Content**: Don't include sensitive data (passwords, tokens)
4. **User Privacy**: Respect user notification preferences
5. **Rate Limiting**: Prevent email spam/abuse

## Future Enhancements

Potential improvements for the email notification system:

- [ ] Email templates with Handlebars or React Email
- [ ] Rich HTML templates with inline CSS
- [ ] Email preview in dashboard
- [ ] Notification scheduling (digest mode)
- [ ] Per-notification-type preferences
- [ ] Email analytics (open rates, click rates)
- [ ] Multi-language support
- [ ] Custom email domains

## Related Documentation

- [Admin Dashboard Guide](./ADMIN_GUIDE.md)
- [Price Approval Guide](./PRICE_APPROVAL_GUIDE.md)
- [API Documentation](./ADMIN_API_REFERENCE.md)
- [Monitoring Guide](./MONITORING_UI.md)
