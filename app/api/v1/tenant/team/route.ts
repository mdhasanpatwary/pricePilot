import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/error-api";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";
import {
  validateBody,
  addUserSchema,
  updateUserSchema,
  validationErrorResponse,
} from "@/lib/validation";
import bcrypt from "bcryptjs";
import { recordAuditLog, getIpAddress } from "@/lib/audit";

/**
 * GET /api/v1/tenant/team
 * List all team members for the current tenant
 */
async function getTeamMembers(req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.max(1, parseInt(searchParams.get("limit") || "10"));
  const skip = (page - 1) * limit;

  const [members, totalCount] = await Promise.all([
    (prisma as any).user.findMany({
      where: { tenantId: session.user.tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        emailVerified: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    (prisma as any).user.count({
      where: { tenantId: session.user.tenantId },
    }),
  ]);

  return NextResponse.json({
    data: members,
    meta: {
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      limit,
    },
  });
}

/**
 * POST /api/v1/tenant/team
 * Add a new team member
 */
async function addTeamMember(req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only admins can add team members" },
      { status: 403 },
    );
  }

  const validation = await validateBody(req, addUserSchema);
  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  const { email, password, name, role } = validation.data!;

  // Check if user already exists
  const existingUser = await (prisma as any).user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = await (prisma as any).user.create({
    data: {
      email,
      passwordHash,
      name,
      role: role as any,
      tenantId: session.user.tenantId,
      emailVerified: new Date(), // Auto-verify internally added users
    },
  });

  await recordAuditLog({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    userEmail: session.user.email!,
    action: "ADD_TEAM_MEMBER",
    entityId: newUser.id,
    ipAddress: getIpAddress(req),
    details: { email, role, name },
  });

  return NextResponse.json({
    id: (newUser as any).id,
    email: (newUser as any).email,
    name: (newUser as any).name,
    role: (newUser as any).role,
  });
}

/**
 * PATCH /api/v1/tenant/team
 * Update a team member's role or details
 */
async function updateTeamMember(req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only admins can update team members" },
      { status: 403 },
    );
  }

  const validation = await validateBody(req, updateUserSchema);
  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  const { id, name, role, password } = validation.data!;

  // Check if user belongs to same tenant
  const targetUser = await (prisma as any).user.findUnique({
    where: { id, tenantId: session.user.tenantId },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updateData: any = {};
  if (name) updateData.name = name;
  if (role) updateData.role = role as any;
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
    action: "UPDATE_TEAM_MEMBER",
    entityId: id,
    ipAddress: getIpAddress(req),
    details: { role, name: name ? "Updated" : "Unchanged" },
  });

  return NextResponse.json({
    id: (updatedUser as any).id,
    email: (updatedUser as any).email,
    name: (updatedUser as any).name,
    role: (updatedUser as any).role,
  });
}

/**
 * DELETE /api/v1/tenant/team
 * Remove a team member
 */
async function deleteTeamMember(req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only admins can remove team members" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 },
    );
  }

  // Check if user belongs to same tenant
  const targetUser = await (prisma as any).user.findUnique({
    where: { id, tenantId: session.user.tenantId },
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
    action: "DELETE_TEAM_MEMBER",
    entityId: id,
    ipAddress: getIpAddress(req),
    details: { email: targetUser.email },
  });

  return NextResponse.json({ message: "Team member removed successfully" });
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", withErrorHandling(getTeamMembers));
}

export async function POST(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", withErrorHandling(addTeamMember));
}

export async function PATCH(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", withErrorHandling(updateTeamMember));
}

export async function DELETE(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", withErrorHandling(deleteTeamMember));
}
