import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "SYNC_SUCCESS"
  | "SYNC_ERROR"
  | "PRICE_ALERT"
  | "SYSTEM"
  | "MATCH_ALERT";

export class NotificationService {
  /**
   * Create a new notification for a tenant
   */
  static async create(options: {
    tenantId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }) {
    try {
      return await (prisma as any).notification.create({
        data: {
          tenantId: options.tenantId,
          type: options.type,
          title: options.title,
          message: options.message,
          link: options.link,
        },
      });
    } catch (error) {
      console.error(
        "[NotificationService] Failed to create notification:",
        error,
      );
      // We don't throw here to prevent notification failures from breaking core logic
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
