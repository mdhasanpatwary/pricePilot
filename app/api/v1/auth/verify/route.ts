import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditLog, getIpAddress } from "@/lib/audit";
import { withErrorHandling } from "@/lib/error-api";
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handleVerify(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Verification token is required" },
      { status: 400 },
    );
  }

  try {
    // Find user with this token
    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 },
      );
    }

    // Update user: verify email and remove token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
      },
    });

    // Record audit log
    await recordAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: "EMAIL_VERIFIED",
      entityId: user.id,
      ipAddress: getIpAddress(req),
    });

    return NextResponse.json({
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during verification" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "auth", withErrorHandling(handleVerify));
}
