
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { recordAuditLog, getIpAddress } from "@/lib/audit";
import { z } from "zod";

const settingsSchema = z.object({
  searchQueryPattern: z.string().optional(),
});

async function handlePUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const siteId = params.id;

  try {
    const body = await req.json();
    const validation = settingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const { searchQueryPattern } = validation.data;

    // Verify ownership
    const site = await prisma.site.findFirst({
      where: { id: siteId, tenantId },
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    await prisma.site.update({
      where: { id: siteId },
      data: { searchQueryPattern },
    });

    await recordAuditLog({
      tenantId,
      userId: session.user.id,
      userEmail: session.user.email!,
      action: "UPDATE_COMPETITOR_SETTINGS",
      entityId: siteId,
      ipAddress: getIpAddress(req),
      details: { searchQueryPattern },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating site settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: { params: { id: string } }) {
  return withRateLimit(req, "write", (r) => handlePUT(r, context));
}
