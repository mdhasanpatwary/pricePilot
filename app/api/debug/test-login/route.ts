import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password } = body;

        const user = await prisma.user.findUnique({
            where: { email },
            include: { Tenant: true }
        });

        if (!user) {
            return NextResponse.json({
                success: false,
                error: 'User not found'
            });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        return NextResponse.json({
            success: true,
            userFound: true,
            passwordValid: isValid,
            user: {
                email: user.email,
                emailVerified: !!user.emailVerified,
                tenant: user.Tenant?.companyName
            }
        });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
