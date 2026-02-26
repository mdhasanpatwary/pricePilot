/**
 * Archive Statistics API
 *
 * Provides statistics about archived data including record counts,
 * storage size, and oldest archived records.
 */

import { NextRequest, NextResponse } from 'next/server';
import { optimizedPrisma } from '@/lib/database/optimized-prisma';
import { ArchiveManager } from '@/lib/services/archive-manager';
import { logger } from '@/lib/logger';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from '@/lib/middleware/with-request-context';

const archiveManager = new ArchiveManager(optimizedPrisma);

async function handleGET(_request: NextRequest) {

/**
 * GET /api/v1/admin/performance/archive/stats
 *
 * Get archive statistics
 *
 * Returns:
 * - priceHistoryArchived: Number of archived price history records
 * - auditLogsArchived: Number of archived audit log records
 * - totalArchiveSizeBytes: Total size of archive tables in bytes
 * - oldestArchivedRecord: Date of oldest archived record
 */
    try {
        // Check authentication
        const session = await getCachedSession();
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

        // Get archive statistics
        const stats = await archiveManager.getArchiveStats();

        logger.info('Archive stats retrieved', {
            userId: session.user.id,
            stats,
        });

        return NextResponse.json({
            success: true,
            data: stats,
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error('Failed to get archive stats', { error });
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to get archive statistics',
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "read", handleGET);
}
