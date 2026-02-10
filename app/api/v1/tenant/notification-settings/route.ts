import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";
import {
  validateBody,
  validationErrorResponse,
  notificationSettingsSchema,
} from "@/lib/validation";

async function handleGET(_req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { slackEnabled: true, slackWebhookUrl: true },
    });

    return NextResponse.json(tenant);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch tenant settings" },
      { status: 500 },
    );
  }
}

async function handlePATCH(req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Validate request body
    const validation = await validateBody(req, notificationSettingsSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { slackEnabled, slackWebhookUrl } = validation.data!;

    const tenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        slackEnabled,
        slackWebhookUrl: slackWebhookUrl === "" ? null : slackWebhookUrl,
      },
      select: { slackEnabled: true, slackWebhookUrl: true },
    });

    return NextResponse.json(tenant);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update tenant settings" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", handleGET);
}

export async function PATCH(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", handlePATCH);
}
