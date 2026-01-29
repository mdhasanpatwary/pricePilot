/**
 * Archive Audit Logs API
 * 
 * Provides read-only access to archived audit log records.
 * Supports filtering by tenant and date range.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { ArchiveManager } from '@/lib/services/archive-manager';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();
const archiveManager = new ArchiveManager(prisma);

/**
 * GET /api/v1/admin/performance/archive/audit-logs
 * 
 * Query archived audit log records
 * 
 * Query Parameters:
 * - tenantId: Filter by tenant ID
 * - startDate: Filter by start date (ISO 8601)
 * - endDate: Filter by end date (ISO 8601)
 * - limit: Number of records to return (default: 100, max: 1000)
 * - offset: Number of records to skip (default: 0)
 */
export async function GET(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                { status: 401 }
            );
        }

        // Check admin role
        if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
                { status: 403 }
            );
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const tenantId = searchParams.get('tenantId') || undefined;
        const startDateStr = searchParams.get('startDate');
        const endDateStr = searchParams.get('endDate');
        const limitStr = searchParams.get('limit');
        const offsetStr = searchParams.get('offset');

        // Validate and parse dates
        let startDate: Date | undefined;
        let endDate: Date | undefined;

        if (startDateStr) {
            startDate = new Date(startDateStr);
            if (isNaN(startDate.getTime())) {
                return NextResponse.json(
                    { success: false, error: { code: 'INVALID_DATE', message: 'Invalid startDate format' } },
                    { status: 400 }
                );
            }
        }

        if (endDateStr) {
            endDate = new Date(endDateStr);
            if (isNaN(endDate.getTime())) {
                return NextResponse.json(
                    { success: false, error: { code: 'INVALID_DATE', message: 'Invalid endDate format' } },
                    { status: 400 }
                );
            }
        }

        // Parse and validate limit
        let limit = 100;
        if (limitStr) {
            limit = parseInt(limitStr, 10);
            if (isNaN(limit) || limit < 1 || limit > 1000) {
                return NextResponse.json(
                    { success: false, error: { code: 'INVALID_LIMIT', message: 'Limit must be between 1 and 1000' } },
                    { status: 400 }
                );
            }
        }

        // Parse and validate offset
        let offset = 0;
        if (offsetStr) {
            offset = parseInt(offsetStr, 10);
            if (isNaN(offset) || offset < 0) {
                return NextResponse.json(
                    { success: false, error: { code: 'INVALID_OFFSET', message: 'Offset must be non-negative' } },
                    { status: 400 }
                );
            }
        }

        // Query archive
        const results = await archiveManager.queryAuditLogsArchive({
            tenantId,
            startDate,
            endDate,
            limit,
            offset,
        });

        logger.info('Audit logs archive queried', {
            userId: session.user.id,
            filters: { tenantId, startDate, endDate, limit, offset },
            resultCount: results.length,
        });

        return NextResponse.json({
            success: true,
            data: {
                records: results,
                count: results.length,
                limit,
                offset,
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error('Failed to query audit logs archive', { error });
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to query archive',
                },
            },
            { status: 500 }
        );
    }
}
