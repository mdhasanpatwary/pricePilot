import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import {
  validateBody,
  validationErrorResponse,
  changePasswordSchema,
} from "@/lib/validation";
import { recordAuditLog, getIpAddress } from "@/lib/audit";
import { withErrorHandling } from "@/lib/error-api";
import { withRateLimit } from "@/lib/middleware/ratelimit";

const PASSWORD_HISTORY_LIMIT = 5; // Prevent reuse of last 5 passwords

async function handleChangePassword(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const tenantId = session.user.tenantId;

  const validation = await validateBody(req, changePasswordSchema);
  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  const { currentPassword, newPassword } = validation.data!;

  // 1. Fetch user to verify current password
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      passwordHistory: {
        orderBy: { createdAt: "desc" },
        take: PASSWORD_HISTORY_LIMIT,
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 2. Verify current password
  const isCurrentPasswordCorrect = await bcrypt.compare(
    currentPassword,
    user.passwordHash,
  );

  if (!isCurrentPasswordCorrect) {
    return NextResponse.json(
      { error: "Incorrect current password" },
      { status: 400 },
    );
  }

  // 3. Check against password history
  for (const history of user.passwordHistory) {
    const isReused = await bcrypt.compare(newPassword, history.passwordHash);
    if (isReused) {
      return NextResponse.json(
        {
          error: "You cannot reuse any of your last 5 passwords",
        },
        { status: 400 },
      );
    }
  }

  // 4. Update password and history in a transaction
  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    // Update user's current password
    await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        passwordUpdatedAt: new Date(),
      },
    });

    // Add to history
    await tx.passwordHistory.create({
      data: {
        userId,
        passwordHash: newPasswordHash,
      },
    });

    // Optional: Clean up old history beyond limit
    const historyCount = await tx.passwordHistory.count({
      where: { userId },
    });

    if (historyCount > PASSWORD_HISTORY_LIMIT) {
      const oldestHistory = await tx.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        take: historyCount - PASSWORD_HISTORY_LIMIT,
      });

      await tx.passwordHistory.deleteMany({
        where: {
          id: {
            in: oldestHistory.map((h) => h.id),
          },
        },
      });
    }
  });

  // 5. Audit Log
  await recordAuditLog({
    tenantId,
    userId,
    userEmail: session.user.email!,
    action: "CHANGE_PASSWORD",
    entityId: userId,
    ipAddress: getIpAddress(req),
    details: { success: true },
  });

  return NextResponse.json({ message: "Password updated successfully" });
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "auth", withErrorHandling(handleChangePassword));
}
