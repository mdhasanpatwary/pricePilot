import { prisma } from "@/lib/prisma";
import { getNotificationQueue } from "../queue/client";
import { logger } from "../logger";

export type NotificationType =
  | "SYNC_SUCCESS"
  | "SYNC_ERROR"
  | "PRICE_ALERT"
  | "SYSTEM"
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

      // 1. Queue Slack notification (Global)
      await queue.add("slack-notification", {
        type: "WEBHOOK",
        payload: {
          title: options.title,
          message: options.message,
          link: options.link,
        },
        recipient: "SLACK_GLOBAL",
      });

      // 2. Queue Email notifications for all tenant admins
      const admins = await prisma.user.findMany({
        where: {
          tenantId: options.tenantId,
          role: "ADMIN",
        },
        select: { email: true },
      });

      for (const admin of admins) {
        if (admin.email) {
          await queue.add("email-notification", {
            type: "EMAIL",
            payload: {
              title: options.title,
              message: options.message,
              link: options.link,
            },
            recipient: admin.email,
          });
        }
      }

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
      link: "/dashboard/activity",
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
}
