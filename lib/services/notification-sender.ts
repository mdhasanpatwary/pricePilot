import nodemailer from "nodemailer";
import axios from "axios";
import { prisma } from "@/lib/prisma";
import { logger } from "../logger";
import { withRetry, RetryPresets } from "@/lib/utils/retry";
import {
  decryptForUse,
  encryptForStorage,
  isEncryptedString,
} from "@/lib/services/encryption/field-encryption";

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
      select: { emailNotifications: true } as any,
    });

    if (user && !(user as any).emailNotifications) {
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
   * Send a Slack notification with retry logic
   * 
   * Retries up to 3 times with exponential backoff to handle
   * transient network failures and Slack API rate limits.
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
        select: { slackEnabled: true, slackWebhookUrl: true } as any,
      });

      if (tenant) {
        isEnabled = (tenant as any).slackEnabled;
        if ((tenant as any).slackWebhookUrl) {
          webhookUrl = (tenant as any).slackWebhookUrl;
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
      // Use retry logic for Slack webhook delivery
      await withRetry(
        async () => {
          return axios.post(webhookUrl, {
            text: message,
          });
        },
        {
          ...RetryPresets.STANDARD,
          operationName: 'Slack Notification',
          context: {
            tenantId: tenantId || 'Global',
            messagePreview: message.substring(0, 50),
          },
          onRetry: async (error, attempt, delay) => {
            logger.warn(`Slack notification failed, retrying`, {
              tenantId,
              attempt,
              delay: `${delay}ms`,
              error: error instanceof Error ? error.message : String(error),
            });
          },
        }
      );

      logger.info(
        `[NotificationSender] Slack notification sent (Tenant: ${tenantId || "Global"})`,
      );
      return true;
    } catch (error) {
      logger.error("[NotificationSender] Failed to send Slack notification after retries:", {
        error,
        tenantId,
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
  /**
   * Send a custom webhook notification to all registered endpoints for a tenant
   * 
   * Uses retry logic for each webhook delivery to handle transient failures.
   */
  static async sendCustomWebhook(tenantId: string, payload: any) {
    try {
      const webhooks = await prisma.webhook.findMany({
        where: { tenantId, isActive: true },
        select: { url: true, secret: true, id: true },
      });

      if (webhooks.length === 0) {
        logger.info(
          `[NotificationSender] No active webhooks found for tenant ${tenantId}`,
        );
        return true;
      }

      const promises = webhooks.map(async (webhook) => {
        try {
          const headers: any = {
            "Content-Type": "application/json",
            "User-Agent": "PricePilot-Webhook/1.0",
            "X-PricePilot-Event": payload.type || "notification",
          };

          // Basic security if secret provided (stored encrypted at rest)
          if (webhook.secret) {
            if (!isEncryptedString(webhook.secret)) {
              try {
                const encrypted = encryptForStorage(webhook.secret);
                await prisma.webhook.update({
                  where: { id: webhook.id },
                  data: { secret: encrypted },
                });
                logger.info(`[NotificationSender] Migrated plaintext webhook secret to encrypted (webhookId=${webhook.id})`);
              } catch (error) {
                logger.warn(`[NotificationSender] Failed to migrate webhook secret (webhookId=${webhook.id})`, {
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }

            try {
              headers["X-PricePilot-Secret"] = decryptForUse(webhook.secret);
            } catch (error) {
              // Don't send the header if we can't decrypt.
              logger.error(`[NotificationSender] Failed to decrypt webhook secret (webhookId=${webhook.id})`, {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // Use retry logic for webhook delivery
          await withRetry(
            async () => {
              return axios.post(webhook.url, payload, {
                headers,
                timeout: 8000,
              });
            },
            {
              ...RetryPresets.STANDARD,
              operationName: 'Custom Webhook',
              context: {
                tenantId,
                webhookId: webhook.id,
                url: webhook.url,
                eventType: payload.type,
              },
              onRetry: async (error, attempt, delay) => {
                logger.warn(`Custom webhook delivery failed, retrying`, {
                  webhookId: webhook.id,
                  url: webhook.url,
                  attempt,
                  delay: `${delay}ms`,
                  error: error instanceof Error ? error.message : String(error),
                });
              },
            }
          );

          logger.info(
            `[NotificationSender] Webhook successfully delivered to ${webhook.url}`,
          );
        } catch (err: any) {
          logger.warn(
            `[NotificationSender] Webhook delivery failed after retries for ${webhook.url}: ${err.message}`,
          );
        }
      });

      await Promise.allSettled(promises);
      return true;
    } catch (error) {
      logger.error("[NotificationSender] Failed to dispatch custom webhooks:", {
        error,
        tenantId,
      });
      return false;
    }
  }
}
