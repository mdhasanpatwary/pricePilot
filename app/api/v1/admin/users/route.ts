import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withErrorHandling } from "@/lib/error-api";
import {
  validateBody,
  validationErrorResponse,
  updateUserSchema,
} from "@/lib/validation";
import { getCursorPaginationParams } from "@/lib/utils/pagination";
import { recordAuditLog, getIpAddress } from "@/lib/audit";
import bcrypt from "bcryptjs";

/**
 * GET /api/v1/admin/users
 * Fetch all users across all tenants
 */
async function handleGET(_req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    cursor,
    limit,
    sortBy = "id",
    sortOrder = "desc",
  } = getCursorPaginationParams(new URL(_req.url).searchParams);

  const { paginateCursor } = await import("@/lib/utils/pagination");

  const result = await paginateCursor(
    (prisma as any).user,
    {},
    { cursor, limit, sortBy, sortOrder },
    {
      include: {
        tenant: {
          select: { companyName: true },
        },
        _count: {
          select: { sessions: true },
        },
      },
    }
  );

  const { decryptForUse } = await import("@/lib/services/encryption/field-encryption");
  const formattedUsers = result.data.map((u: any) => ({
    id: u.id,
    email: u.email,
    name: u.name ? decryptForUse(u.name) : null,
    role: u.role,
    tenantName: u.tenant.companyName,
    tenantId: u.tenantId,
    activeSessions: u._count.sessions,
    createdAt: u.createdAt.toISOString(),
    isSuperAdmin: u.isSuperAdmin,
  }));

  return NextResponse.json({
    data: formattedUsers,
    pagination: result.pagination,
  });
}

/**
 * PATCH /api/v1/admin/users
 * Update user details or role
 */
async function handlePATCH(req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validation = await validateBody(req, updateUserSchema);
  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  const { id, name, role, password } = validation.data!;

  const { encryptForStorage } = await import("@/lib/services/encryption/field-encryption");
  const updateData: any = {};
  if (name !== undefined) updateData.name = name ? encryptForStorage(name) : null;
  if (role !== undefined) updateData.role = role as any;
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 12);
    updateData.passwordUpdatedAt = new Date();
  }

  const updatedUser = await (prisma as any).user.update({
    where: { id },
    data: updateData,
  });

  await recordAuditLog({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    userEmail: session.user.email!,
    action: "ADMIN_UPDATE_USER",
    entityId: id,
    ipAddress: getIpAddress(req),
    details: { role, name, targetEmail: (updatedUser as any).email },
  });

  return NextResponse.json({
    id: (updatedUser as any).id,
    email: (updatedUser as any).email,
    name: (updatedUser as any).name,
    role: (updatedUser as any).role,
  });
}

/**
 * DELETE /api/v1/admin/users
 * Delete a user
 */
async function handleDELETE(req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete yourself" },
      { status: 400 },
    );
  }

  const targetUser = await (prisma as any).user.findUnique({
    where: { id },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await (prisma as any).user.delete({
    where: { id },
  });

  await recordAuditLog({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    userEmail: session.user.email!,
    action: "ADMIN_DELETE_USER",
    entityId: id,
    ipAddress: getIpAddress(req),
    details: { email: (targetUser as any).email },
  });

  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", withErrorHandling(handleGET));
}

export async function PATCH(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", withErrorHandling(handlePATCH));
}

export async function DELETE(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", withErrorHandling(handleDELETE));
}
