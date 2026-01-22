import nodemailer from "nodemailer";
import axios from "axios";
import { prisma } from "@/lib/prisma";
import { logger } from "../logger";

export class NotificationSender {
  private static async getConfigs() {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            "NOTIFICATIONS_EMAIL_ENABLED",
            "SMTP_HOST",
            "SMTP_PORT",
            "SMTP_USER",
            "SMTP_PASS",
            "SMTP_FROM",
            "NOTIFICATIONS_SLACK_ENABLED",
            "SLACK_WEBHOOK_URL",
          ],
        },
      },
    });

    const configMap: Record<string, string> = {};
    configs.forEach((c) => {
      configMap[c.key] = c.value;
    });

    return configMap;
  }

  /**
   * Send an email notification
   */
  static async sendEmail(to: string, subject: string, html: string) {
    const configs = await this.getConfigs();

    if (configs["NOTIFICATIONS_EMAIL_ENABLED"] !== "true") {
      logger.info(
        "[NotificationSender] Email notifications are disabled globally",
      );
      return false;
    }

    // Check individual user preference
    const user = await prisma.user.findUnique({
      where: { email: to },
      select: { emailNotifications: true },
    });

    if (user && !user.emailNotifications) {
      logger.info(
        `[NotificationSender] User ${to} has disabled email notifications`,
      );
      return false;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: configs["SMTP_HOST"],
        port: parseInt(configs["SMTP_PORT"] || "587"),
        secure: configs["SMTP_PORT"] === "465",
        auth: {
          user: configs["SMTP_USER"],
          pass: configs["SMTP_PASS"],
        },
      });

      const info = await transporter.sendMail({
        from: configs["SMTP_FROM"] || "PricePilot <noreply@pricepilot.com>",
        to,
        subject,
        html,
      });

      logger.info(`[NotificationSender] Email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error("[NotificationSender] Failed to send email:", { error });
      return false;
    }
  }

  /**
   * Send a Slack notification
   */
  static async sendSlack(message: string, tenantId?: string) {
    const configs = await this.getConfigs();

    if (configs["NOTIFICATIONS_SLACK_ENABLED"] !== "true") {
      logger.info(
        "[NotificationSender] Slack notifications are disabled globally",
      );
      return false;
    }

    // Determine webhook URL: Tenant specific vs Global
    let webhookUrl = configs["SLACK_WEBHOOK_URL"];
    let isEnabled = true;

    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { slackEnabled: true, slackWebhookUrl: true },
      });

      if (tenant) {
        isEnabled = tenant.slackEnabled;
        if (tenant.slackWebhookUrl) {
          webhookUrl = tenant.slackWebhookUrl;
        }
      }
    }

    if (!isEnabled) {
      logger.info(
        `[NotificationSender] Slack notifications disabled for tenant ${tenantId}`,
      );
      return false;
    }

    if (!webhookUrl) {
      logger.warn("[NotificationSender] Slack webhook URL is not configured");
      return false;
    }

    try {
      await axios.post(webhookUrl, {
        text: message,
      });

      logger.info(
        `[NotificationSender] Slack notification sent (Tenant: ${tenantId || "Global"})`,
      );
      return true;
    } catch (error) {
      logger.error("[NotificationSender] Failed to send Slack notification:", {
        error,
      });
      return false;
    }
  }

  /**
   * Send a formatted price alert to both channels if enabled
   */
  static async sendPriceAlert(options: {
    email: string;
    productTitle: string;
    oldPrice: number;
    newPrice: number;
    url: string;
  }) {
    const { email, productTitle, oldPrice, newPrice, url } = options;
    const priceDiff = newPrice - oldPrice;
    const indicator = priceDiff < 0 ? "📉 LOW" : "📈 HIGH";

    // 1. Send Email
    const emailSubject = `[PricePilot] ${indicator} - Price change for ${productTitle}`;
    const emailHtml = `
      <h2>Market Price Alert</h2>
      <p>The price for <strong>${productTitle}</strong> has changed.</p>
      <ul>
        <li><strong>Old Price:</strong> ${oldPrice}</li>
        <li><strong>New Price:</strong> ${newPrice}</li>
        <li><strong>Difference:</strong> ${priceDiff.toFixed(2)}</li>
      </ul>
      <p><a href="${url}">View Product in Dashboard</a></p>
    `;
    await this.sendEmail(email, emailSubject, emailHtml);

    // 2. Send Slack
    const slackMsg = `🚨 *Price Alert*: ${productTitle}\nOld: ${oldPrice} | New: ${newPrice} | Diff: ${priceDiff.toFixed(2)}\n<${url}|View Details>`;
    await this.sendSlack(slackMsg);
  }
}
