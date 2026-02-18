import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import {
  validateBody,
  validateQuery,
  validationErrorResponse,
  createWebhookSchema,
  uuidSchema,
} from "@/lib/validation";
import { encryptForStorage } from "@/lib/services/encryption/field-encryption";

async function handleGET(_req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const webhooks = await prisma.webhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    // Never return the stored secret (encrypted or plaintext) back to clients.
    const redacted = webhooks.map((w) => ({
      ...w,
      secret: w.secret ? "***" : null,
    }));
    return NextResponse.json(redacted);
  } catch (error) {
    console.error("Failed to fetch webhooks:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

async function handlePOST(req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const validation = await validateBody(req, createWebhookSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { url, secret, isActive } = validation.data!;

    let secretEncrypted: string | null = null;
    if (secret) {
      // Hard-fail if encryption isn't configured; never store plaintext silently.
      try {
        secretEncrypted = encryptForStorage(secret);
      } catch (error) {
        console.error("Failed to encrypt webhook secret:", error);
        return NextResponse.json(
          { error: "Encryption is not configured" },
          { status: 500 },
        );
      }
    }

    const webhook = await prisma.webhook.create({
      data: {
        tenantId,
        url,
        secret: secretEncrypted,
        isActive,
      },
    });

    return NextResponse.json({
      ...webhook,
      secret: webhook.secret ? "***" : null,
    });
  } catch (error) {
    console.error("Failed to create webhook:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

async function handleDELETE(req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paramValidation = validateQuery(req, z.object({ id: uuidSchema }));

  if (!paramValidation.success) {
    return validationErrorResponse(paramValidation);
  }

  const { id } = paramValidation.data!;

  try {
    // Verify ownership before delete if not already handled by DB constraints or logic
    // Actually, we should check if this webhook belongs to the tenant
    const webhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!webhook || webhook.tenantId !== session.user.tenantId) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    await prisma.webhook.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete webhook:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", handleGET);
}

export async function POST(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", handlePOST);
}

export async function DELETE(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", handleDELETE);
}
