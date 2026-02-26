/**
 * Password Change API Endpoint
 *
 * Handles password changes with session invalidation
 * Requirements: 2.7.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { SessionManager } from '@/lib/utils/session-manager';
import { z } from 'zod';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from '@/lib/middleware/with-request-context';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

async function handlePOST(req: NextRequest) {
  try {
    // Session is guaranteed by withRequestContextAndRateLimit
    const session = await getCachedSession(); // Still need to get session for user ID
    if (!session?.user?.id) {
      // This case should ideally be handled by the middleware, but as a fallback
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = changePasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        },
        { status: 422 }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        passwordHash: true,
        PasswordHistory: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Check last 5 passwords
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Check if new password was used recently
    for (const oldPassword of user.PasswordHistory) {
      const isReused = await bcrypt.compare(newPassword, oldPassword.passwordHash);
      if (isReused) {
        return NextResponse.json(
          {
            success: false,
            error: 'Password was used recently. Please choose a different password.',
          },
          { status: 400 }
        );
      }
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password and invalidate all sessions in a transaction
    await prisma.$transaction(async (tx) => {
      // Update user password
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          passwordUpdatedAt: new Date(),
        },
      });

      // Add old password to history
      await tx.passwordHistory.create({
        data: {
          userId: user.id,
          passwordHash: user.passwordHash,
        },
      });

      // Clean up old password history (keep only last 5)
      const allHistory = await tx.passwordHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        skip: 5,
      });

      if (allHistory.length > 0) {
        await tx.passwordHistory.deleteMany({
          where: {
            id: {
              in: allHistory.map((h) => h.id),
            },
          },
        });
      }

      // Create audit log
      await tx.tenantAuditLog.create({
        data: {
          tenantId: session.user.tenantId,
          userId: user.id,
          userEmail: session.user.email || 'unknown',
          action: 'PASSWORD_CHANGED',
          entityId: user.id,
          details: JSON.stringify({
            timestamp: new Date().toISOString(),
            ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
          }),
        },
      });
    });

    // Invalidate all user sessions (force re-login)
    await SessionManager.invalidateAllUserSessions(user.id);

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
    });
  } catch (error) {
    console.error('[ChangePassword] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to change password',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "write", handlePOST);
}
