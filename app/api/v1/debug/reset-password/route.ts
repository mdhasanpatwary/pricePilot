import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { withInternalGate } from '@/lib/middleware/internal-gate';
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

async function handlePOST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password required' },
                { status: 400 }
            );
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                name: true,
                isSuperAdmin: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { error: `User with email "${email}" not found` },
                { status: 404 }
            );
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(password, 10);

        // Update user
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                emailVerified: new Date(),
                isSuperAdmin: true,
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Password reset successfully',
            user: {
                email: user.email,
                name: user.name,
                isSuperAdmin: true,
                emailVerified: true,
            },
        });

    } catch (error) {
        console.error('Error resetting password:', error);
        return NextResponse.json(
            { error: 'Failed to reset password', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    return withInternalGate(req, (r) => withRequestContextAndRateLimit(r, "write", handlePOST));
}
