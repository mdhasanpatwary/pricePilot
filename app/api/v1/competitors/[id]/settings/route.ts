
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getIpAddress } from "@/lib/audit";
import { z } from "zod";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

const settingsSchema = z.object({
  searchQueryPattern: z.string().optional(),
});

async function handlePUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCachedSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { id: siteId } = await params;

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
      select: { id: true },
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    await prisma.site.updateMany({
      where: { id: siteId, tenantId },
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

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withRequestContextAndRateLimit(req, "write", (r) => handlePUT(r, context));
}
