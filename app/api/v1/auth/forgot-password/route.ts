import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mailService } from "@/lib/mail";
import { recordAuditLog } from "@/lib/audit";
import {
  validateBody,
  validationErrorResponse,
  passwordResetRequestSchema,
} from "@/lib/validation";
import { withErrorHandling } from "@/lib/error-api";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import crypto from "crypto";

async function handleForgotPassword(req: NextRequest) {
  const validation = await validateBody(req, passwordResetRequestSchema);
  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  const { email } = validation.data!;

  // 1. Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return 200 even if user not found for security (prevent email enumeration)
  if (!user) {
    return NextResponse.json({
      message:
        "If an account exists with that email, a reset link has been sent.",
    });
  }

  // 2. Generate secure token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  const tokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

  // 3. Save to database
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: hashedToken,
      resetTokenExpires: tokenExpiry,
    },
  });

  // 4. Send email
  await mailService.sendPasswordResetEmail(email, resetToken);

  // 5. Audit log
  await recordAuditLog({
    tenantId: user.tenantId,
    userId: user.id,
    userEmail: user.email,
    action: "PASSWORD_RESET_REQUESTED",
    entityId: user.id,
  });

  return NextResponse.json({
    message:
      "If an account exists with that email, a reset link has been sent.",
  });
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "auth", withErrorHandling(handleForgotPassword));
}
