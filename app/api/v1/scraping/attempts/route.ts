/**
 * GET /api/v1/scraping/attempts
 *
 * Query scrape attempt logs with filtering and pagination.
 * Supports filtering by competitor site, product, date range, protection type,
 * strategy, success status, and protection detection status.
 *
 * Requirements: 8.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCachedSession } from "@/lib/auth/cached-session";
import { scrapeFailureTypeSchema } from "@/lib/validation/schemas";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

async function handleGET(request: NextRequest) {

    try {
        // Authenticate user
        const session = await getCachedSession();
        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required',
                    },
                },
                { status: 401 }
            );
        }

        const tenantId = session.user.tenantId;
        if (!tenantId) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Tenant context required',
                    },
                },
                { status: 403 }
            );
        }

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;

        const competitorWebsiteId = searchParams.get('competitorWebsiteId') || undefined;
        const competitorProductId = searchParams.get('competitorProductId') || undefined;
        const protectionType = searchParams.get('protectionType') || undefined;
        const strategy = searchParams.get('strategy') || undefined;
        const failureTypeParam = searchParams.get('failureType')?.trim() || undefined;

        const failureType = failureTypeParam
            ? (() => {
                const parsed = scrapeFailureTypeSchema.safeParse(failureTypeParam);
                return parsed.success ? parsed.data : null;
            })()
            : undefined;

        if (failureTypeParam && failureType === null) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_FAILURE_TYPE',
                        message: `Invalid failureType. Must be one of: ${scrapeFailureTypeSchema.options.join(', ')}`,
                    },
                },
                { status: 400 }
            );
        }

        // Parse boolean parameters
        const successParam = searchParams.get('success');
        const success = successParam !== null ? successParam === 'true' : undefined;

        const protectionDetectedParam = searchParams.get('protectionDetected');
        const protectionDetected = protectionDetectedParam !== null
            ? protectionDetectedParam === 'true'
            : undefined;

        // Parse date parameters
        const startDateParam = searchParams.get('startDate');
        const startDate = startDateParam ? new Date(startDateParam) : undefined;

        const endDateParam = searchParams.get('endDate');
        const endDate = endDateParam ? new Date(endDateParam) : undefined;

        // Validate dates
        if (startDate && isNaN(startDate.getTime())) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_DATE',
                        message: 'Invalid startDate format. Use ISO 8601 format.',
                    },
                },
                { status: 400 }
            );
        }

        if (endDate && isNaN(endDate.getTime())) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_DATE',
                        message: 'Invalid endDate format. Use ISO 8601 format.',
                    },
                },
                { status: 400 }
            );
        }

        // Parse pagination parameters
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : 100;

        const offsetParam = searchParams.get('offset');
        const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

        // Validate pagination
        if (isNaN(limit) || limit < 1 || limit > 1000) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_LIMIT',
                        message: 'Limit must be between 1 and 1000',
                    },
                },
                { status: 400 }
            );
        }

        if (isNaN(offset) || offset < 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_OFFSET',
                        message: 'Offset must be non-negative',
                    },
                },
                { status: 400 }
            );
        }

        // Parse sorting parameters
        const orderByParam = searchParams.get('orderBy');
        const orderBy = orderByParam as 'createdAt' | 'responseTimeMs' | 'attemptNumber' | undefined;

        const orderDirectionParam = searchParams.get('orderDirection');
        const orderDirection = orderDirectionParam as 'asc' | 'desc' | undefined;

        // Validate orderBy
        if (orderBy && !['createdAt', 'responseTimeMs', 'attemptNumber'].includes(orderBy)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_ORDER_BY',
                        message: 'orderBy must be one of: createdAt, responseTimeMs, attemptNumber',
                    },
                },
                { status: 400 }
            );
        }

        // Validate orderDirection
        if (orderDirection && !['asc', 'desc'].includes(orderDirection)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_ORDER_DIRECTION',
                        message: 'orderDirection must be one of: asc, desc',
                    },
                },
                { status: 400 }
            );
        }

        // Query logs (dynamic import)
        const { LoggingService } = await import('@/lib/services/bot-protection/logging-service');
        const loggingService = new LoggingService();
        let result;
        try {
            result = await loggingService.queryLogs({
                tenantId,
                competitorWebsiteId,
                competitorProductId,
                protectionType,
                failureType: failureType || undefined,
                strategy,
                success,
                protectionDetected,
                startDate,
                endDate,
                limit,
                offset,
                orderBy,
                orderDirection,
            });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes('SCHEMA_OUT_OF_DATE: ScrapeAttempt.failureType column is missing')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'SCHEMA_OUT_OF_DATE',
                            message: 'Database schema is missing ScrapeAttempt.failureType. Apply the Prisma migration before using failureType filtering.',
                            details: 'Your DATABASE_URL currently points at a Neon pooler host (-pooler). Prisma migrations/db push typically require a direct (non-pooler) connection URL.',
                        },
                    },
                    { status: 409 }
                );
            }
            throw error;
        }

        return NextResponse.json(
            {
                success: true,
                data: {
                    attempts: result.logs,
                    pagination: {
                        total: result.total,
                        limit: result.limit,
                        offset: result.offset,
                        hasMore: result.hasMore,
                    },
                },
                meta: {
                    requestId: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Failed to query scrape attempts:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to query scrape attempts',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, "read", handleGET);
}
