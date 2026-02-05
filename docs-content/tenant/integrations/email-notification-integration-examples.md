---
title: "Email Notification Integration Examples"
description: "Examples of email notification integrations"
category: "integrations"
tags: ["email", "notifications", "examples"]
audience: "tenant"
relatedDocs: ["/admin-docs/alerting/email-notification-integration-examples.md"]
---

# Email Notification Integration Examples

This document provides practical examples of how to integrate email notifications into your PricePilot workflows.

## Integration Points

### 1. After Creating Pending Price Changes

When the pricing rules engine creates pending price changes, notify users:

```typescript
// lib/services/rules-engine.ts

import { mailService } from "@/lib/mail";

export class RulesEngine {
  static async createPendingChanges(tenantId: string, changes: PriceChange[]) {
    // Create pending changes in database
    const created = await prisma.pendingPriceChange.createMany({
      data: changes.map(change => ({
        tenantId,
        productId: change.productId,
        currentPrice: change.currentPrice,
        recommendedPrice: change.recommendedPrice,
        status: "PENDING",
        // ... other fields
      }))
    });

    // Send notification if changes were created
    if (created.count > 0) {
      await mailService.sendPendingApprovalNotification(
        tenantId,
        created.count
      );
    }

    return created;
  }
}
```

### 2. After Auto-Approval Rule Execution

When auto-approval rules process changes, notify users of the results:

```typescript
// lib/services/auto-approval.ts

import { mailService } from "@/lib/mail";

export class AutoApprovalService {
  static async processAutoApprovals(tenantId: string) {
    const pendingChanges = await prisma.pendingPriceChange.findMany({
      where: { tenantId, status: "PENDING" }
    });

    const approvedChanges: string[] = [];
    const ruleNames: string[] = [];

    for (const change of pendingChanges) {
      const { approved, reason, ruleName } = await this.shouldAutoApprove(
        change,
        tenantId
      );

      if (approved) {
        await this.approveChange(change.id);
        approvedChanges.push(change.id);
        if (ruleName) ruleNames.push(ruleName);
      }
    }

    // Send notification if any changes were auto-approved
    if (approvedChanges.length > 0) {
      await mailService.sendAutoApprovalNotification(
        tenantId,
        approvedChanges.length,
        ruleNames
      );
    }

    return approvedChanges.length;
  }
}
```

### 3. Scheduled Daily Summary

The daily summary is automatically sent via cron job, but you can also trigger it manually:

```typescript
// Manual trigger example (e.g., for testing or on-demand summaries)

import { mailService } from "@/lib/mail";

async function sendManualSummary(tenantId: string) {
  await mailService.sendDailyApprovalSummary(tenantId);
}

// Or send to all tenants
async function sendSummaryToAllTenants() {
  const tenants = await prisma.tenant.findMany({
    where: { status: "ACTIVE" }
  });

  for (const tenant of tenants) {
    await mailService.sendDailyApprovalSummary(tenant.id);
  }
}
```

### 4. API Endpoint Integration

Create an API endpoint to manually trigger notifications:

```typescript
// app/api/v1/notifications/send-pending/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mailService } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  // Count pending changes
  const pendingCount = await prisma.pendingPriceChange.count({
    where: { tenantId, status: "PENDING" }
  });

  if (pendingCount === 0) {
    return NextResponse.json({
      success: true,
      message: "No pending changes to notify about"
    });
  }

  // Send notification
  await mailService.sendPendingApprovalNotification(tenantId, pendingCount);

  return NextResponse.json({
    success: true,
    message: `Notification sent for ${pendingCount} pending changes`
  });
}
```

### 5. Webhook Integration

Trigger email notifications from external webhooks:

```typescript
// app/api/v1/webhooks/price-change/route.ts

import { NextRequest, NextResponse } from "next/server";
import { mailService } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { tenantId, event, data } = await req.json();

  // Verify webhook signature (implement your security)
  // ...

  if (event === "price_changes_created") {
    const count = data.changes?.length || 0;
    
    if (count > 0) {
      await mailService.sendPendingApprovalNotification(tenantId, count);
    }
  }

  return NextResponse.json({ success: true });
}
```

## Advanced Integration Patterns

### Batching Notifications

Avoid sending too many emails by batching notifications:

```typescript
// lib/services/notification-batcher.ts

export class NotificationBatcher {
  private static batches = new Map<string, number>();
  private static timers = new Map<string, NodeJS.Timeout>();

  static addToBatch(tenantId: string, count: number) {
    const current = this.batches.get(tenantId) || 0;
    this.batches.set(tenantId, current + count);

    // Clear existing timer
    const existingTimer = this.timers.get(tenantId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer to send after 5 minutes of inactivity
    const timer = setTimeout(async () => {
      const totalCount = this.batches.get(tenantId) || 0;
      if (totalCount > 0) {
        await mailService.sendPendingApprovalNotification(
          tenantId,
          totalCount
        );
        this.batches.delete(tenantId);
        this.timers.delete(tenantId);
      }
    }, 5 * 60 * 1000); // 5 minutes

    this.timers.set(tenantId, timer);
  }
}

// Usage
NotificationBatcher.addToBatch("tenant-123", 5);
NotificationBatcher.addToBatch("tenant-123", 3); // Will batch with previous
```

### Conditional Notifications

Only send notifications based on certain conditions:

```typescript
// lib/services/smart-notifications.ts

export class SmartNotifications {
  static async notifyIfThresholdMet(tenantId: string) {
    const pendingCount = await prisma.pendingPriceChange.count({
      where: { tenantId, status: "PENDING" }
    });

    // Get tenant notification preferences
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { notificationThreshold: true }
    });

    const threshold = tenant?.notificationThreshold || 10;

    // Only notify if threshold is met
    if (pendingCount >= threshold) {
      await mailService.sendPendingApprovalNotification(
        tenantId,
        pendingCount
      );
      return true;
    }

    return false;
  }
}
```

### Notification Scheduling

Schedule notifications for specific times:

```typescript
// lib/services/notification-scheduler.ts

export class NotificationScheduler {
  static async scheduleNotification(
    tenantId: string,
    type: "pending" | "summary",
    scheduledFor: Date
  ) {
    const delay = scheduledFor.getTime() - Date.now();

    if (delay <= 0) {
      // Send immediately
      if (type === "pending") {
        const count = await this.getPendingCount(tenantId);
        await mailService.sendPendingApprovalNotification(tenantId, count);
      } else {
        await mailService.sendDailyApprovalSummary(tenantId);
      }
      return;
    }

    // Schedule for later
    setTimeout(async () => {
      if (type === "pending") {
        const count = await this.getPendingCount(tenantId);
        await mailService.sendPendingApprovalNotification(tenantId, count);
      } else {
        await mailService.sendDailyApprovalSummary(tenantId);
      }
    }, delay);
  }

  private static async getPendingCount(tenantId: string): Promise<number> {
    return await prisma.pendingPriceChange.count({
      where: { tenantId, status: "PENDING" }
    });
  }
}
```

## Testing Integration

### Unit Test Example

```typescript
import { RulesEngine } from "@/lib/services/rules-engine";
import { mailService } from "@/lib/mail";

jest.mock("@/lib/mail");

describe("RulesEngine Integration", () => {
  it("should send notification after creating pending changes", async () => {
    const changes = [
      { productId: "1", currentPrice: 100, recommendedPrice: 95 },
      { productId: "2", currentPrice: 200, recommendedPrice: 190 },
    ];

    await RulesEngine.createPendingChanges("tenant-123", changes);

    expect(mailService.sendPendingApprovalNotification).toHaveBeenCalledWith(
      "tenant-123",
      2
    );
  });
});
```

### Integration Test Example

```typescript
import { mailService } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

describe("Email Notification Integration", () => {
  it("should send notification when pending changes are created", async () => {
    // Create test tenant and user
    const tenant = await prisma.tenant.create({
      data: { companyName: "Test Co" }
    });

    const user = await prisma.user.create({
      data: {
        email: "test@example.com",
        tenantId: tenant.id,
        emailNotifications: true,
        // ... other required fields
      }
    });

    // Create pending changes
    await prisma.pendingPriceChange.createMany({
      data: [
        { tenantId: tenant.id, productId: "1", status: "PENDING" },
        { tenantId: tenant.id, productId: "2", status: "PENDING" },
      ]
    });

    // Send notification
    await mailService.sendPendingApprovalNotification(tenant.id, 2);

    // Verify (check logs, mock email service, etc.)
  });
});
```

## Best Practices

### 1. Rate Limiting

Don't send too many emails in a short period:

```typescript
const NOTIFICATION_COOLDOWN = 60 * 60 * 1000; // 1 hour

async function sendWithCooldown(tenantId: string, type: string) {
  const lastSent = await redis.get(`notification:${tenantId}:${type}`);
  
  if (lastSent && Date.now() - parseInt(lastSent) < NOTIFICATION_COOLDOWN) {
    console.log("Notification on cooldown, skipping");
    return;
  }

  await mailService.sendPendingApprovalNotification(tenantId, count);
  await redis.set(`notification:${tenantId}:${type}`, Date.now().toString());
}
```

### 2. Error Recovery

Handle email failures gracefully:

```typescript
async function sendWithRetry(tenantId: string, count: number, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await mailService.sendPendingApprovalNotification(tenantId, count);
      return true;
    } catch (error) {
      console.error(`Email send attempt ${i + 1} failed:`, error);
      if (i === maxRetries - 1) {
        // Log to error tracking service
        // Create notification in database as fallback
        await createInAppNotification(tenantId, count);
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return false;
}
```

### 3. Monitoring

Track email notification metrics:

```typescript
async function sendWithMetrics(tenantId: string, count: number) {
  const startTime = Date.now();
  
  try {
    await mailService.sendPendingApprovalNotification(tenantId, count);
    
    // Record success metric
    await prisma.notificationMetric.create({
      data: {
        tenantId,
        type: "pending_approval",
        status: "success",
        duration: Date.now() - startTime,
        recipientCount: count
      }
    });
  } catch (error) {
    // Record failure metric
    await prisma.notificationMetric.create({
      data: {
        tenantId,
        type: "pending_approval",
        status: "failure",
        duration: Date.now() - startTime,
        error: error.message
      }
    });
    throw error;
  }
}
```

## Troubleshooting

### Emails Not Sending

1. Check SMTP configuration in SystemConfig
2. Verify user has `emailNotifications: true`
3. Check application logs for errors
4. Test SMTP connection manually

### Duplicate Emails

1. Implement cooldown periods
2. Use batching for multiple triggers
3. Check for duplicate cron jobs
4. Review integration points

### Missing Emails

1. Check spam folder
2. Verify email address is correct
3. Check SMTP server logs
4. Verify cron job is running

## Related Documentation

- [Email Notifications Guide](./EMAIL_NOTIFICATIONS.md)
- [Price Approval Guide](./PRICE_APPROVAL_GUIDE.md)
- [API Documentation](./ADMIN_API_REFERENCE.md)
