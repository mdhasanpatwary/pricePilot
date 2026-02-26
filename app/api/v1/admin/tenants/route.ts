/**
 * Admin Tenants API
 *
 * Provides tenant list for admin operations.
 * Requires super admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

async function handleGET(_req: NextRequest) {

/**
 * GET /api/v1/admin/tenants
 *
 * List all tenants (super admin only)
 */
    try {
    const session = await getCachedSession();

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

async function handlePOST(req: NextRequest) {
  try {
    const session = await getCachedSession();

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

    const body = await req.json();
    const { name, planType } = body;

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        id: `tenant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        companyName: name,
        planType: planType || 'BASIC',
        updatedAt: new Date()
        // Add other fields as needed
      },
    });

    logger.info('Tenant created', {
      tenantId: tenant.id,
      name: tenant.companyName,
      createdBy: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    logger.error('Failed to create tenant', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create tenant',
        },
      },
      { status: 500 }
    );
  }
}

async function handlePATCH(req: NextRequest) {
  try {
    const session = await getCachedSession();

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

    const body = await req.json();
    const { id, reset, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    if (reset) {
      // Reset tenant data (implement as needed)
      logger.info('Tenant reset requested', { tenantId: id, by: session.user.id });
      // Add reset logic here
    }

    // Update tenant
    const tenant = await prisma.tenant.update({
      where: { id },
      data: updateData,
    });

    logger.info('Tenant updated', {
      tenantId: tenant.id,
      updatedBy: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    logger.error('Failed to update tenant', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update tenant',
        },
      },
      { status: 500 }
    );
  }
}

async function handleDELETE(req: NextRequest) {
  try {
    const session = await getCachedSession();

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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Tenant ID is required' } },
        { status: 400 }
      );
    }

    // Check if tenant exists first
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true, companyName: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
        { status: 404 }
      );
    }

    // Delete tenant and all related records in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete in order to respect foreign key constraints
      // Using try-catch for each group to handle missing models gracefully

      // Delete monitoring and alerts
      try {
        await tx.monitoringAlertRule.deleteMany({ where: { tenantId: id } });
        await tx.alertRule.deleteMany({ where: { tenantId: id } });
      } catch (e) {
        // Model might not exist
      }

      // Delete approval-related records
      try {
        await tx.approvalDelegation.deleteMany({ where: { tenantId: id } });
        await tx.autoApprovalMetric.deleteMany({ where: { tenantId: id } });
        await tx.autoApprovalRule.deleteMany({ where: { tenantId: id } });
        await tx.pendingPriceChange.deleteMany({ where: { tenantId: id } });
      } catch (e) {
        // Model might not exist
      }

      // Delete rate limiting records
      try {
        await tx.rateLimitCustomMultiplier.deleteMany({ where: { tenantId: id } });
        await tx.rateLimitBypass.deleteMany({ where: { tenantId: id } });
        await tx.rateLimitMetric.deleteMany({ where: { tenantId: id } });
      } catch (e) {
        // Model might not exist
      }

      // Delete products and related
      await tx.product.deleteMany({ where: { tenantId: id } });

      // Delete sites
      await tx.site.deleteMany({ where: { tenantId: id } });

      // Delete categories and brands
      try {
        await tx.category.deleteMany({ where: { tenantId: id } });
        await tx.brand.deleteMany({ where: { tenantId: id } });
      } catch (e) {
        // Model might not exist
      }

      // Delete scraping and operations
      try {
        await tx.scrapeRetry.deleteMany({ where: { tenantId: id } });
        await tx.bulkOperationSnapshot.deleteMany({ where: { tenantId: id } });
      } catch (e) {
        // Model might not exist
      }

      // Delete notifications and webhooks
      await tx.notification.deleteMany({ where: { tenantId: id } });
      await tx.webhook.deleteMany({ where: { tenantId: id } });

      // Delete audit logs
      await tx.tenantAuditLog.deleteMany({ where: { tenantId: id } });

      // Delete API keys
      try {
        await tx.apiKey.deleteMany({ where: { tenantId: id } });
      } catch (e) {
        // Model might not exist
      }

      // Delete pricing rules
      await tx.pricingRule.deleteMany({ where: { tenantId: id } });

      // Delete users
      await tx.user.deleteMany({ where: { tenantId: id } });

      // Finally, delete the tenant
      await tx.tenant.delete({ where: { id } });
    });

    logger.info('Tenant deleted successfully', {
      tenantId: id,
      tenantName: tenant.companyName,
      deletedBy: session.user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Tenant deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete tenant', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete tenant',
          details: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", handleGET);
}

export async function POST(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", handlePOST);
}

export async function PATCH(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", handlePATCH);
}

export async function DELETE(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", handleDELETE);
}
