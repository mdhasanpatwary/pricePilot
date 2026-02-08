/**
 * Debug endpoint to list all users
 * DELETE THIS IN PRODUCTION!
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest) {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                isSuperAdmin: true,
                emailVerified: true,
                passwordHash: true,
                tenantId: true,
                createdAt: true,
            },
        });

        return NextResponse.json({
            success: true,
            count: users.length,
            users: users.map(u => ({
                id: u.id,
                email: u.email,
                name: u.name,
                isSuperAdmin: u.isSuperAdmin,
                emailVerified: u.emailVerified ? 'Yes' : 'No',
                hasPassword: u.passwordHash ? 'Yes' : 'No',
                tenantId: u.tenantId,
                createdAt: u.createdAt,
            })),
        });

    } catch (error) {
        console.error('Error listing users:', error);
        return NextResponse.json(
            { error: 'Failed to list users', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
