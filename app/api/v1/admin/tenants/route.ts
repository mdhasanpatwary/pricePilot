/**
 * Admin Tenants API
 * 
 * Provides tenant list for admin operations.
 * Requires super admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/v1/admin/tenants
 * 
 * List all tenants (super admin only)
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check if user is super admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    });

    if (!user?.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Super admin access required' } },
        { status: 403 }
      );
    }

    // Fetch all tenants
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        companyName: true,
        planType: true,
        createdAt: true,
      },
      orderBy: {
        companyName: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      data: tenants,
    });
  } catch (error) {
    logger.error('Failed to fetch tenants', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch tenants',
        },
      },
      { status: 500 }
    );
  }
}
