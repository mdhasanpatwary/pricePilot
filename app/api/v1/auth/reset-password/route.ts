import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  validateBody,
  validationErrorResponse,
  passwordResetSchema,
} from "@/lib/validation";
import { recordAuditLog, getIpAddress } from "@/lib/audit";
import { withErrorHandling } from "@/lib/error-api";
import { withRateLimit } from "@/lib/middleware/ratelimit";

const PASSWORD_HISTORY_LIMIT = 5;

async function handleResetPassword(req: NextRequest) {
  const validation = await validateBody(req, passwordResetSchema);
  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  const { token, password } = validation.data!;

  // 1. Hash the incoming token to match what's in DB
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // 2. Find user with valid token and not expired
  const user = await prisma.user.findFirst({
    where: {
      resetToken: hashedToken,
      resetTokenExpires: {
        gt: new Date(),
      },
    },
    include: {
      PasswordHistory: {
        orderBy: { createdAt: "desc" },
        take: PASSWORD_HISTORY_LIMIT,
      },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Invalid or expired reset token" },
      { status: 400 },
    );
  }

  // 3. Check against password history
  for (const history of user.PasswordHistory) {
    const isReused = await bcrypt.compare(password, history.passwordHash);
    if (isReused) {
      return NextResponse.json(
        {
          error: "You cannot reuse any of your last 5 passwords",
        },
        { status: 400 },
      );
    }
  }

  // 4. Update password and clear token in a transaction
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    // Update user
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordUpdatedAt: new Date(),
        resetToken: null,
        resetTokenExpires: null,
        // Resetting the password also verifies the email as a byproduct of proof-of-access
        emailVerified: user.emailVerified || new Date(),
      },
    });

    // Add to history
    await tx.passwordHistory.create({
      data: {
        userId: user.id,
        passwordHash,
      },
    });

    // Clean up old history
    const historyCount = await tx.passwordHistory.count({
      where: { userId: user.id },
    });

    if (historyCount > PASSWORD_HISTORY_LIMIT) {
      const oldestHistory = await tx.passwordHistory.findMany({
        where: { userId: user.id },
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
    tenantId: user.tenantId,
    userId: user.id,
    userEmail: user.email,
    action: "CHANGE_PASSWORD",
    entityId: user.id,
    ipAddress: getIpAddress(req),
    details: { method: "password_reset" },
  });

  return NextResponse.json({
    message: "Password has been reset successfully. You can now log in.",
  });
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "auth", withErrorHandling(handleResetPassword));
}
