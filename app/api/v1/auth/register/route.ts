import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { recordAuditLog, getIpAddress } from "@/lib/audit";
import {
  validateBody,
  validationErrorResponse,
  registerSchema,
} from "@/lib/validation";

async function handleRegister(req: NextRequest) {
  try {
    // Validate and sanitize input
    const validation = await validateBody(req, registerSchema);

    if (!validation.success) {
      return validationErrorResponse(validation);
    }

    const { email, password, companyName } = validation.data!;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 },
      );
    }

    // Hash password with strong cost factor
    const passwordHash = await bcrypt.hash(password, 12);

    // Create Tenant and User in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          companyName,
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          tenantId: tenant.id,
          role: "ADMIN",
        },
      });

      return { user, tenant };
    });

    await recordAuditLog({
      tenantId: result.tenant.id,
      userId: result.user.id,
      userEmail: result.user.email,
      action: "USER_REGISTRATION",
      entityId: result.user.id,
      ipAddress: getIpAddress(req),
      details: { companyName, email },
    });

    return NextResponse.json(
      { message: "User registered successfully", userId: result.user.id },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "auth", handleRegister);
}
