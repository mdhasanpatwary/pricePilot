import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import {
  validateBody,
  validationErrorResponse,
  updateNotificationPreferencesSchema,
} from "@/lib/validation";

async function handleGET(_req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailNotifications: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 },
    );
  }
}

async function handlePATCH(req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Validate input
    const validation = await validateBody(req, updateNotificationPreferencesSchema);
    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { emailNotifications } = validation.data!;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { emailNotifications },
      select: { emailNotifications: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update preferences" },
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
