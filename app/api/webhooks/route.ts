import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { z } from "zod";
import {
  validateBody,
  validateQuery,
  validationErrorResponse,
  createWebhookSchema,
  uuidSchema,
} from "@/lib/validation";

async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const webhooks = await prisma.webhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(webhooks);
  } catch (error) {
    console.error("Failed to fetch webhooks:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const validation = await validateBody(req, createWebhookSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { url, secret } = validation.data!;

    const webhook = await prisma.webhook.create({
      data: {
        tenantId,
        url,
        secret,
      },
    });

    return NextResponse.json(webhook);
  } catch (error) {
    console.error("Failed to create webhook:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

async function handleDELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

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
  return withRateLimit(req, "read", handleGET);
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "write", handlePOST);
}

export async function DELETE(req: NextRequest) {
  return withRateLimit(req, "write", handleDELETE);
}
