import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";

async function handleGET(_req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        storeLimit: true,
        competitorLimit: true,
        planType: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Failed to fetch tenant limits:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", handleGET);
}
