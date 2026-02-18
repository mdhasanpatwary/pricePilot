import { prisma } from "@/lib/prisma";
import axios from "axios";
import crypto from "crypto";
import { withRetry, RetryPresets } from "@/lib/utils/retry";
import { logger } from "@/lib/logger";
import {
  decryptForUse,
  encryptForStorage,
  isEncryptedString,
} from "@/lib/services/encryption/field-encryption";

export class WebhookService {
  /**
   * Dispatch a webhook event for a specific tenant
   */
  static async dispatch(tenantId: string, event: string, payload: unknown) {
    const webhooks = await prisma.webhook.findMany({
      where: {
        tenantId,
        isActive: true,
      },
    });

    for (const webhook of webhooks) {
      await this.sendWebhook(webhook, event, payload);
    }
  }

  /**
   * Send the actual HTTP POST request with retry logic
   * 
   * Webhooks are retried up to 3 times with exponential backoff
   * to handle transient network failures and temporary service unavailability.
   */
  private static async sendWebhook(
    webhook: { id: string; url: string; secret: string | null },
    event: string,
    payload: unknown
  ) {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      id: crypto.randomUUID(),
      event,
      timestamp,
      data: payload,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-PricePilot-Event": event,
      "X-PricePilot-Timestamp": timestamp.toString(),
    };

    let secretForUse: string | null = null;
    if (webhook.secret) {
      // Best-effort migration: if a plaintext secret exists, encrypt it so we don't keep storing plaintext.
      if (!isEncryptedString(webhook.secret)) {
        try {
          const encrypted = encryptForStorage(webhook.secret);
          await prisma.webhook.update({
            where: { id: webhook.id },
            data: { secret: encrypted },
          });
          logger.info(`[WebhookService] Migrated plaintext webhook secret to encrypted (webhookId=${webhook.id})`);
        } catch (error) {
          // If encryption isn't configured we still allow sending; we just can't migrate.
          logger.warn(`[WebhookService] Failed to migrate webhook secret (webhookId=${webhook.id})`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      try {
        secretForUse = decryptForUse(webhook.secret);
      } catch (error) {
        // Don't send an invalid signature if we can't decrypt.
        logger.error(`[WebhookService] Failed to decrypt webhook secret (webhookId=${webhook.id})`, {
          error: error instanceof Error ? error.message : String(error),
        });
        secretForUse = null;
      }
    }

    if (secretForUse) {
      const signature = crypto
        .createHmac("sha256", secretForUse)
        .update(`${timestamp}.${body}`)
        .digest("hex");
      headers["X-PricePilot-Signature"] = signature;
    }

    try {
      if (process.env.NODE_ENV !== 'test') {
        logger.info(`Dispatching webhook ${event} to ${webhook.url}`);
      }

      // Use retry logic for webhook delivery
      await withRetry(
        async () => {
          return axios.post(webhook.url, body, {
            headers,
            timeout: 5000
          });
        },
        {
          ...RetryPresets.STANDARD,
          operationName: 'Webhook Delivery',
          context: {
            url: webhook.url,
            event,
          },
          onRetry: async (error, attempt, delay) => {
            if (process.env.NODE_ENV !== 'test') {
              logger.warn(`Webhook delivery to ${webhook.url} failed, retrying`, {
                event,
                attempt,
                delay: `${delay}ms`,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          },
        }
      );

      if (process.env.NODE_ENV !== 'test') {
        logger.info(`Webhook ${event} successfully delivered to ${webhook.url}`);
      }
    } catch (error) {
      const err = error as any;
      if (process.env.NODE_ENV !== 'test') {
        logger.error(`Failed to send webhook to ${webhook.url} after retries`, {
          event,
          error: err.message,
          url: webhook.url,
        });
      }
      // Don't throw - webhook failures should not break the main flow
    }
  }
}
