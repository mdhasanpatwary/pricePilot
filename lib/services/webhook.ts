import { prisma } from "@/lib/prisma";
import axios from "axios";
import crypto from "crypto";

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
   * Send the actual HTTP POST request
   */
  private static async sendWebhook(webhook: { url: string; secret: string | null }, event: string, payload: unknown) {
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

    if (webhook.secret) {
      const signature = crypto
        .createHmac("sha256", webhook.secret)
        .update(`${timestamp}.${body}`)
        .digest("hex");
      headers["X-PricePilot-Signature"] = signature;
    }

    try {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[WebhookService] Dispatching ${event} to ${webhook.url}`);
      }
      await axios.post(webhook.url, body, { headers, timeout: 5000 });
    } catch (error) {
      const err = error as any; // Standard axios error access
      if (process.env.NODE_ENV !== 'test') {
        console.error(
          `[WebhookService] Failed to send webhook to ${webhook.url}:`,
          err.message
        );
      }
    }
  }
}
