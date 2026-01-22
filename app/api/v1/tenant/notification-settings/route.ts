import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
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
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slackEnabled, slackWebhookUrl } = await req.json();

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
  return withRateLimit(req, "read", handleGET);
}

export async function PATCH(req: NextRequest) {
  return withRateLimit(req, "write", handlePATCH);
}
