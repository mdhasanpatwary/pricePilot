import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/error-api";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";

/**
 * GET /api/v1/tenant/sessions
 * Returns all active sessions for the logged-in user
 */
async function getSessions() {
  const session = await getCachedSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await (prisma as any).session.findMany({
    where: { userId: session.user.id },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      sessionToken: true,
      expires: true,
      userAgent: true,
      ipAddress: true,
      lastUsedAt: true,
    },
  });

  // Map to identify current session
  const mappedSessions = sessions.map((s: any) => ({
    ...s,
    isCurrent: s.sessionToken === session.user.sessionId,
    // Hide token for security
    sessionToken: undefined,
  }));

  return NextResponse.json(mappedSessions);
}

/**
 * DELETE /api/v1/tenant/sessions
 * Revokes a specific session
 */
async function revokeSession(req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Session ID is required" },
      { status: 400 },
    );
  }

  // Ensure user owns the session before deleting
  const targetSession = await (prisma as any).session.findFirst({
    where: {
      id: sessionId,
      userId: session.user.id,
    },
  });

  if (!targetSession) {
    return NextResponse.json(
      { error: "Session not found or unauthorized" },
      { status: 404 },
    );
  }

  await (prisma as any).session.delete({
    where: { id: sessionId },
  });

  return NextResponse.json({ message: "Session revoked successfully" });
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "api", withErrorHandling(getSessions));
}

export async function DELETE(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "api", withErrorHandling(revokeSession));
}
