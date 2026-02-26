import { NextRequest, NextResponse } from 'next/server';
import { withRequestContext } from '@/lib/cache/request-cache';
import { logger } from '@/lib/logger';

/**
 * Middleware for Cron Jobs
 *
 * 1. Establishes request context (caching)
 * 2. Verifies CRON_SECRET
 */
export async function withCronAuth(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
    return withRequestContext(async () => {
        const authHeader = req.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

        if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
            logger.warn('Unauthorized cron attempt', {
                path: req.nextUrl.pathname,
                authHeader: authHeader ? 'present' : 'missing',
                secretConfigured: !!process.env.CRON_SECRET
            });

            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Invalid cron secret',
                    },
                },
                { status: 401 }
            );
        }

        return handler(req);
    });
}
