import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { withErrorHandling } from "@/lib/error-api";
import {
  validateBody,
  validationErrorResponse,
  updateUserSchema,
} from "@/lib/validation";
import { recordAuditLog, getIpAddress } from "@/lib/audit";
import bcrypt from "bcryptjs";

/**
 * GET /api/v1/admin/users
 * Fetch all users across all tenants
 */
async function handleGET(_req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await (prisma as any).user.findMany({
    include: {
      tenant: {
        select: { companyName: true },
      },
      _count: {
        select: { sessions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formattedUsers = users.map((u: any) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    tenantName: u.tenant.companyName,
    tenantId: u.tenantId,
    activeSessions: u._count.sessions,
    createdAt: u.createdAt.toISOString(),
    isSuperAdmin: u.isSuperAdmin,
  }));

  return NextResponse.json(formattedUsers);
}

/**
 * PATCH /api/v1/admin/users
 * Update user details or role
 */
async function handlePATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validation = await validateBody(req, updateUserSchema);
  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  const { id, name, role, password } = validation.data!;

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
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
  const session = await getServerSession(authOptions);

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
  return withRateLimit(req, "read", withErrorHandling(handleGET));
}

export async function PATCH(req: NextRequest) {
  return withRateLimit(req, "write", withErrorHandling(handlePATCH));
}

export async function DELETE(req: NextRequest) {
  return withRateLimit(req, "write", withErrorHandling(handleDELETE));
}
