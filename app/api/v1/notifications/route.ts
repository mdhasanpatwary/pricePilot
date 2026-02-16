import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCachedSession } from "@/lib/auth/cached-session";
import {
  withRequestContextAndRateLimit,
  withRequestContextOnly,
} from "@/lib/middleware/with-request-context";
import { withCache, invalidateCache } from "@/lib/middleware/api-cache";
import {
  validateBody,
  validationErrorResponse,
  markNotificationReadSchema,
  deleteNotificationSchema,
} from "@/lib/validation";

async function handleGET(req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const unreadOnly = searchParams.get("unread") === "true";
  const includeMeta = searchParams.get("includeMeta") === "true";

  const where: any = {
    tenantId: session.user.tenantId,
  };

  if (unreadOnly) {
    where.isRead = false;
  }

  try {
    const notifications = await (prisma as any).notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    if (!includeMeta) {
      return NextResponse.json({ notifications });
    }

    const totalCount = await (prisma as any).notification.count({ where });

    return NextResponse.json({
      notifications,
      meta: {
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}

async function invalidateNotificationCache(tenantId: string) {
  await invalidateCache(`api:notifications:/api/v1/notifications:${tenantId}*`).catch((error) => {
    console.error("Notification cache invalidation error:", error);
  });
}

async function handlePATCH(req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Validate input
    const validation = await validateBody(req, markNotificationReadSchema);
    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { id, all } = validation.data!;

    if (all) {
      await (prisma as any).notification.updateMany({
        where: { tenantId: session.user.tenantId, isRead: false },
        data: { isRead: true },
      });
    } else if (id) {
      await (prisma as any).notification.update({
        where: { id, tenantId: session.user.tenantId },
        data: { isRead: true },
      });
    }

    await invalidateNotificationCache(session.user.tenantId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 },
    );
  }
}

async function handleDELETE(req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Validate input
    const validation = await validateBody(req, deleteNotificationSchema);
    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { id, all } = validation.data!;

    if (all) {
      await (prisma as any).notification.deleteMany({
        where: { tenantId: session.user.tenantId },
      });
    } else if (id) {
      await (prisma as any).notification.delete({
        where: { id, tenantId: session.user.tenantId },
      });
    }

    await invalidateNotificationCache(session.user.tenantId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRequestContextOnly(
    req,
    withCache(handleGET, {
      ttl: 120,
      keyPrefix: "api:notifications",
      tenantIsolated: true,
      varyBy: ["page", "limit", "unread", "includeMeta"],
    })
  );
}

export async function PATCH(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", handlePATCH);
}

export async function DELETE(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", handleDELETE);
}
