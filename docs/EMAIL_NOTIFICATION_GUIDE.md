# Email Notification System Guide

## Overview

PricePilot provides a comprehensive email notification system for price approval workflows. The system supports multiple notification types with professional HTML templates.

## Architecture

### Services

#### EmailService (lib/services/email.ts)
Class-based service for price approval notifications:
- `sendPendingApprovalNotification()` - Notify users of pending approvals
- `sendDailyApprovalSummary()` - Send daily activity summary
- `sendAutoApprovalNotification()` - Notify users of auto-approvals
- `sendDelegationNotification()` - Notify users of delegation

#### mailService (lib/mail.ts)
Object-based service with additional notification types:
- All EmailService methods (for backward compatibility)
- `sendVerificationEmail()` - User email verification
- `sendPasswordResetEmail()` - Password reset requests

#### NotificationSender (lib/services/notification-sender.ts)
Low-level service that handles actual email delivery via nodemailer.

## Configuration

### SMTP Settings

Email functionality requires SMTP configuration in the `SystemConfig` table:

```sql
INSERT INTO "SystemConfig" (key, value, description) VALUES
  ('NOTIFICATIONS_EMAIL_ENABLED', 'true', 'Enable/disable email notifications globally'),
  ('SMTP_HOST', 'smtp.example.com', 'SMTP server hostname'),
  ('SMTP_PORT', '587', 'SMTP server port (587 for TLS, 465 for SSL)'),
  ('SMTP_USER', 'noreply@pricepilot.com', 'SMTP authentication username'),
  ('SMTP_PASS', 'your-password', 'SMTP authentication password'),
  ('SMTP_FROM', 'PricePilot <noreply@pricepilot.com>', 'From address for emails');
```

### User Preferences

Users can control email notifications via the `emailNotifications` field on the User model:

```typescript
// Enable email notifications for a user
await prisma.user.update({
  where: { id: userId },
  data: { emailNotifications: true }
});
```

## Usage Examples

### Pending Approval Notifications

Send when price changes are awaiting approval:

```typescript
import { EmailService } from '@/lib/services/email';

// Notify users of 5 pending price changes
await EmailService.sendPendingApprovalNotification(tenantId, 5);
```

**Email Preview:**
- Subject: `[PricePilot] 5 Price Changes Awaiting Approval`
- Content: Summary with count and CTA button to dashboard
- Recipients: All users with `emailNotifications: true`

### Daily Approval Summary

Send daily summary of approval activity:

```typescript
import { EmailService } from '@/lib/services/email';

// Send summary for yesterday's activity
await EmailService.sendDailyApprovalSummary(tenantId);
```

**Email Preview:**
- Subject: `[PricePilot] Daily Approval Summary - Jan 28, 2024`
- Content: Table with approved, rejected, and pending counts
- Recipients: All users with `emailNotifications: true`
- Behavior: Skips if no activity

### Auto-Approval Notifications

Send when auto-approval rules process changes:

```typescript
import { EmailService } from '@/lib/services/email';

// Notify users of 10 auto-approved changes
await EmailService.sendAutoApprovalNotification(
  tenantId,
  10,
  ['Quick Approval Rule', 'Small Change Rule']
);
```

**Email Preview:**
- Subject: `[PricePilot] 10 Price Changes Auto-Approved`
- Content: Summary with rule names that triggered
- Recipients: All users with `emailNotifications: true`

### Delegation Notifications

Send when approval authority is delegated:

```typescript
import { EmailService } from '@/lib/services/email';

// Notify user of delegation
await EmailService.sendDelegationNotification(
  'user@example.com',
  'John Doe',
  'Jane Smith',
  new Date('2024-01-01'),
  new Date('2024-01-31')
);
```

**Email Preview:**
- Subject: `[PricePilot] You've Been Delegated Approval Authority`
- Content: Delegation details with start/end dates
- Recipients: Specific delegated user

## Email Templates

### Design Principles

All email templates follow these principles:
- **Professional**: Clean, business-appropriate design
- **Responsive**: Mobile-friendly layout
- **Accessible**: Proper color contrast and semantic HTML
- **Branded**: Consistent PricePilot colors and styling

### Color Scheme

- **Primary Blue** (#0070f3): CTAs, headers, links
- **Success Green** (#059669): Approved items
- **Warning Amber** (#d97706): Pending items
- **Error Red** (#dc2626): Rejected items
- **Info Blue** (#3b82f6): Auto-approval notifications

### Template Structure

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Title</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <!-- Main content area -->
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h2>Email Heading</h2>
    <!-- Content -->
  </div>
  
  <!-- Footer -->
  <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
    <p style="font-size: 12px; color: #9ca3af; margin: 0;">
      Unsubscribe instructions
    </p>
  </div>
</body>
</html>
```

## Integration with Workflows

### Auto-Approval Workflow

The email system integrates with the auto-approval workflow:

```typescript
// In AutoApprovalService.processAutoApprovals()
const autoApprovedCount = await this.processAutoApprovals(tenantId);

if (autoApprovedCount > 0) {
  await EmailService.sendAutoApprovalNotification(
    tenantId,
    autoApprovedCount,
    triggeredRuleNames
  );
}
```

### Cron Jobs

Daily summaries are sent via cron job:

```typescript
// app/api/v1/cron/daily-approval-summary/route.ts
export async function GET(req: NextRequest) {
  // Verify cron secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all tenants
  const tenants = await prisma.tenant.findMany();

  // Send summary to each tenant
  for (const tenant of tenants) {
    await EmailService.sendDailyApprovalSummary(tenant.id);
  }

  return NextResponse.json({ success: true });
}
```

### Vercel Cron Configuration

```json
{
  "crons": [
    {
      "path": "/api/v1/cron/daily-approval-summary",
      "schedule": "0 9 * * *"
    }
  ]
}
```

## Error Handling

### Graceful Failures

The email system handles errors gracefully:

```typescript
// Individual email failures don't block others
const emailPromises = users.map((user) =>
  NotificationSender.sendEmail(email, subject, html)
    .catch((error) => {
      console.error(`Failed to send email to ${user.email}:`, error);
    })
);

await Promise.allSettled(emailPromises);
```

### Logging

All email operations are logged:
- Success: `[EmailService] Email sent: ${messageId}`
- Failure: `[EmailService] Failed to send email: ${error}`

## Testing

### Manual Testing

1. Configure SMTP settings in SystemConfig
2. Enable email notifications for test user
3. Trigger approval workflows
4. Check email inbox for notifications

### Test Email Service

```typescript
// Test pending approval notification
await EmailService.sendPendingApprovalNotification('test-tenant-id', 3);

// Test daily summary
await EmailService.sendDailyApprovalSummary('test-tenant-id');

// Test auto-approval notification
await EmailService.sendAutoApprovalNotification(
  'test-tenant-id',
  5,
  ['Test Rule']
);
```

### Development Mode

For development, you can use a service like Mailtrap or Ethereal Email:

```sql
UPDATE "SystemConfig" SET value = 'smtp.mailtrap.io' WHERE key = 'SMTP_HOST';
UPDATE "SystemConfig" SET value = '2525' WHERE key = 'SMTP_PORT';
UPDATE "SystemConfig" SET value = 'your-mailtrap-user' WHERE key = 'SMTP_USER';
UPDATE "SystemConfig" SET value = 'your-mailtrap-pass' WHERE key = 'SMTP_PASS';
```

## Troubleshooting

### Emails Not Sending

1. **Check SMTP Configuration**
   ```sql
   SELECT * FROM "SystemConfig" WHERE key LIKE 'SMTP%';
   ```

2. **Verify Global Enable Flag**
   ```sql
   SELECT * FROM "SystemConfig" WHERE key = 'NOTIFICATIONS_EMAIL_ENABLED';
   ```

3. **Check User Preferences**
   ```sql
   SELECT email, "emailNotifications" FROM "User" WHERE "tenantId" = 'your-tenant-id';
   ```

4. **Review Logs**
   - Check application logs for email errors
   - Look for `[EmailService]` or `[NotificationSender]` prefixes

### Common Issues

**Issue**: Emails go to spam
- **Solution**: Configure SPF, DKIM, and DMARC records for your domain

**Issue**: SMTP authentication fails
- **Solution**: Verify SMTP credentials and enable "less secure apps" if using Gmail

**Issue**: Emails not received
- **Solution**: Check user's `emailNotifications` preference and spam folder

## Security Considerations

### Data Protection
- No sensitive data (passwords, tokens) in email bodies
- Links use HTTPS only
- Respects user privacy preferences

### SMTP Security
- Use TLS/SSL for SMTP connections
- Store SMTP credentials securely in database
- Rotate SMTP passwords regularly

### Compliance
- Include unsubscribe instructions in every email
- Respect user notification preferences
- Log email delivery for audit purposes

## Performance

### Optimization
- Batch email sending with Promise.allSettled
- Early return if no users have notifications enabled
- Efficient database queries
- Non-blocking error handling

### Rate Limiting
- Consider SMTP provider rate limits
- Implement queuing for large batches
- Monitor email delivery metrics

## Future Enhancements

### Planned Features
- Email template customization per tenant
- Additional notification types
- Email preview functionality
- A/B testing for email content
- Email delivery tracking
- Bounce handling

### Integration Opportunities
- Webhook notifications
- Slack integration
- SMS notifications
- Push notifications

## API Reference

### EmailService

```typescript
class EmailService {
  static async sendPendingApprovalNotification(
    tenantId: string,
    pendingCount: number
  ): Promise<void>

  static async sendDailyApprovalSummary(
    tenantId: string
  ): Promise<void>

  static async sendAutoApprovalNotification(
    tenantId: string,
    approvedCount: number,
    ruleNames: string[]
  ): Promise<void>

  static async sendDelegationNotification(
    toUserEmail: string,
    toUserName: string | null,
    fromUserName: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<void>
}
```

### NotificationSender

```typescript
class NotificationSender {
  static async sendEmail(
    to: string,
    subject: string,
    html: string
  ): Promise<boolean>

  static async sendSlack(
    message: string,
    tenantId?: string
  ): Promise<boolean>

  static async sendPriceAlert(options: {
    email: string;
    productTitle: string;
    oldPrice: number;
    newPrice: number;
    url: string;
  }): Promise<void>

  static async sendCustomWebhook(
    tenantId: string,
    payload: any
  ): Promise<boolean>
}
```

## Support

For issues or questions about the email notification system:
1. Check this documentation
2. Review application logs
3. Verify SMTP configuration
4. Contact system administrator

## Changelog

### Version 1.0 (Task 11.5)
- Initial implementation of EmailService
- Pending approval notifications
- Daily approval summaries
- Auto-approval notifications
- Delegation notifications
- Professional HTML email templates
- Integration with NotificationSender
