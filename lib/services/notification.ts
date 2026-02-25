import { prisma } from "@/lib/prisma";
import { getNotificationQueue } from "../queue/client";
import { logger } from "../logger";

export type NotificationType =
  | "SYNC_SUCCESS"
  | "SYNC_ERROR"
  | "PRICE_ALERT"
  | "SYSTEM"
  | "SECURITY_NOTICE"
  | "MATCH_ALERT";

export class NotificationService {
  /**
   * Create a new notification for a tenant and dispatch background jobs
   */
  static async create(options: {
    tenantId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }) {
    try {
      const notification = await (prisma as any).notification.create({
        data: {
          tenantId: options.tenantId,
          type: options.type,
          title: options.title,
          message: options.message,
          link: options.link,
        },
      });

      // Dispatch to background worker for actual sending (Email/Slack)
      const queue = getNotificationQueue();

      // 1. Queue Slack notification
      await queue.add("slack-notification", {
        type: "WEBHOOK",
        payload: {
          title: options.title,
          message: options.message,
          link: options.link,
          tenantId: options.tenantId,
        },
        recipient: options.tenantId, // Use tenantId as recipient for Slack
      });

      // 2. Queue Email notifications for all tenant admins
      const admins = await prisma.user.findMany({
        where: {
          tenantId: options.tenantId,
          role: "ADMIN",
        },
        select: { email: true },
      });

      // 2. Queue Email notifications for all tenant admins via bulk pipeline (fixes N+1 Redis latency)
      const emailJobs = admins
        .filter(admin => admin.email)
        .map(admin => ({
          name: "email-notification",
          data: {
            type: "EMAIL",
            payload: {
              title: options.title,
              message: options.message,
              link: options.link,
            },
            recipient: admin.email,
          }
        }));

      if (emailJobs.length > 0) {
        await queue.addBulk(emailJobs);
      }

      // 3. Queue Custom Webhooks for the tenant
      await queue.add("custom-webhook-notification", {
        type: "CUSTOM_WEBHOOK",
        payload: {
          type: options.type,
          title: options.title,
          message: options.message,
          link: options.link,
          timestamp: new Date().toISOString(),
          tenantId: options.tenantId,
        },
        recipient: options.tenantId,
      });

      return notification;
    } catch (error) {
      logger.error("[NotificationService] Failed to create notification:", {
        error,
      });
      return null;
    }
  }

  /**
   * Send a sync success notification
   */
  static async sendSyncSuccess(tenantId: string, details: string) {
    return this.create({
      tenantId,
      type: "SYNC_SUCCESS",
      title: "Sync Completed Successfully",
      message: details,
      link: "/dashboard",
    });
  }

  /**
   * Send a sync error notification
   */
  static async sendSyncError(tenantId: string, error: string) {
    return this.create({
      tenantId,
      type: "SYNC_ERROR",
      title: "Sync Process Failed",
      message: error,
      link: "/dashboard/integrations",
    });
  }

  /**
   * Send a price change notification
   */
  static async sendPriceAlert(
    tenantId: string,
    productTitle: string,
    oldPrice: number,
    newPrice: number,
  ) {
    return this.create({
      tenantId,
      type: "PRICE_ALERT",
      title: "Market Price Shift",
      message: `Competitor price for ${productTitle} changed from ${oldPrice} to ${newPrice}.`,
      link: "/dashboard/products",
    });
  }

  /**
   * Send a security/block notification
   */
  static async sendSecurityNotice(tenantId: string, siteName: string, eta: string) {
    return this.create({
      tenantId,
      type: "SECURITY_NOTICE",
      title: "🛡️ Advanced Bot Protection Detected",
      message: `Heads up! ${siteName} has increased security. We've switched to "Golden Rule" mode. Scraping will be much slower to avoid bans. Estimated completion: ~${eta}.`,
      link: "/dashboard/competitors",
    });
  }

  /**
   * Send a bulk approval summary notification
   *
   * This method sends a single notification summarizing multiple price approvals
   * instead of sending individual notifications for each approval.
   *
   * @param tenantId - The tenant ID
   * @param count - Number of approvals
   * @param changes - Array of price changes with product details
   */
  static async sendBulkApprovalSummary(
    tenantId: string,
    count: number,
    changes: Array<{
      productTitle: string;
      oldPrice: number;
      newPrice: number;
    }>
  ) {
    // Create a summary message
    const totalSavings = changes.reduce((sum, change) => {
      return sum + (change.oldPrice - change.newPrice);
    }, 0);

    const message = count <= 5
      ? `Approved ${count} price changes:\n${changes.map(c =>
        `• ${c.productTitle}: $${c.oldPrice.toFixed(2)} → $${c.newPrice.toFixed(2)}`
      ).join('\n')}`
      : `Approved ${count} price changes. Total price adjustment: $${Math.abs(totalSavings).toFixed(2)}`;

    return this.create({
      tenantId,
      type: "PRICE_ALERT",
      title: `Bulk Price Approval: ${count} Products Updated`,
      message,
      link: "/dashboard/price-approvals",
    });
  }
}
