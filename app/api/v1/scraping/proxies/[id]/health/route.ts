/**
 * Proxy Health API Endpoint
 *
 * Provides detailed health information for a specific proxy.
 *
 * Requirements: 2.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProxyManager } from '@/lib/services/bot-protection/proxy-manager';
import { logger } from '@/lib/logger';
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

async function handleGET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {

/**
 * GET /api/v1/scraping/proxies/:id/health
 *
 * Get detailed health information for a specific proxy
 *
 * Returns:
 * - Global success rate
 * - Site-specific success rates
 * - Last success/failure timestamps
 * - Blocked status and cooldown info
 */
    let proxyId: string | undefined;
    try {
        const session = await getCachedSession();
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                { status: 401 }
            );
        }

        if (session.user.role !== 'admin') {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
                { status: 403 }
            );
        }

        const { id } = await params;
        proxyId = id;

        const proxyManager = new ProxyManager();

        try {
            const health = await proxyManager.getProxyHealth(id);

            // Convert Map to object for JSON serialization
            const siteSpecificRates: Record<string, number> = {};
            health.siteSpecificRates.forEach((rate, siteId) => {
                siteSpecificRates[siteId] = rate;
            });

            return NextResponse.json({
                success: true,
                data: {
                    health: {
                        proxyId: health.proxyId,
                        globalSuccessRate: health.globalSuccessRate,
                        siteSpecificRates,
                        lastSuccess: health.lastSuccess,
                        lastFailure: health.lastFailure,
                        isBlocked: health.isBlocked,
                        cooldownUntil: health.cooldownUntil,
                    },
                },
                meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
            });
        } catch (error: any) {
            if (error.message?.includes('not found')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: { code: 'NOT_FOUND', message: 'Proxy not found' },
                        meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
                    },
                    { status: 404 }
                );
            }
            throw error;
        }
    } catch (error) {
        logger.error('Error fetching proxy health', { error, proxyId });
        return NextResponse.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch proxy health' },
                meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    return withRequestContextAndRateLimit(req, "auth", (r) => handleGET(r, context));
}
