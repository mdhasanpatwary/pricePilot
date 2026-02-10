import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sessionTracker } from '@/lib/services/session-tracker';
import { metricsAggregator } from '@/lib/services/metrics-aggregator';
import { prisma } from '@/lib/prisma';
import { withRateLimit } from '@/lib/middleware/ratelimit';

/**
 * GET /api/v1/admin/debug/tenant/[id]
 * Get comprehensive debug view for a specific tenant
 *
 * Returns:
 * - Active sessions
 * - Recent errors grouped by type
 * - Resource usage
 * - Configuration
 * - Stale data indicators
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 9.1, 9.2, 9.3, 9.4, 9.5
 */
async function handleGET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Check if user is super admin or regular admin
        const user = session.user as any;
        const isAdmin = user.role === 'ADMIN' || user.isSuperAdmin === true;

        if (!isAdmin) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        const { id: tenantId } = await params;

        // Get tenant information
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                id: true,
                companyName: true,
                planType: true,
                createdAt: true,
            },
        });

        if (!tenant) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Tenant not found',
                },
                { status: 404 }
            );
        }

        // Get active sessions for this tenant
        const activeSessions = await sessionTracker.getActiveSessions(tenantId);

        // Get recent session history (last 24 hours)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const recentSessions = await sessionTracker.getSessionHistory({
            tenantId,
            startDate: oneDayAgo,
            limit: 50,
        });

        // Extract and group errors from recent sessions
        const errorsByType: Record<string, Array<{
            sessionId: string;
            timestamp: Date;
            message: string;
            siteUrl: string;
        }>> = {
            proxy_failure: [],
            challenge_failure: [],
            parsing_error: [],
            rate_limit: [],
            network_error: [],
            other: [],
        };

        recentSessions.forEach(session => {
            if (session.errors && session.errors.length > 0) {
                session.errors.forEach(error => {
                    // Categorize error by message content
                    let category = 'other';
                    const message = error.message.toLowerCase();

                    if (message.includes('proxy') || message.includes('connection')) {
                        category = 'proxy_failure';
                    } else if (message.includes('challenge') || message.includes('captcha') || message.includes('cloudflare')) {
                        category = 'challenge_failure';
                    } else if (message.includes('parse') || message.includes('extract')) {
                        category = 'parsing_error';
                    } else if (message.includes('rate limit') || message.includes('too many requests')) {
                        category = 'rate_limit';
                    } else if (message.includes('timeout') || message.includes('network')) {
                        category = 'network_error';
                    }

                    errorsByType[category].push({
                        sessionId: session.id,
                        timestamp: error.timestamp,
                        message: error.message,
                        siteUrl: session.siteUrl,
                    });
                });
            }
        });

        // Calculate error counts
        const errorCounts = Object.entries(errorsByType).map(([type, errors]) => ({
            type,
            count: errors.length,
            recentErrors: errors.slice(0, 5), // Top 5 most recent
        }));

        // Get tenant metrics
        let tenantMetrics;
        try {
            tenantMetrics = await metricsAggregator.getTenantMetrics(tenantId);
        } catch (error) {
            // If metrics fail, provide default values
            tenantMetrics = {
                tenantId,
                tenantName: tenant.companyName,
                activeSessions: activeSessions.length,
                successRate: 0,
                avgScrapeTime: 0,
                dataQualityScore: 0,
                resourceUsage: {
                    requestsToday: 0,
                    quotaLimit: 0,
                    quotaUsed: 0,
                },
            };
        }

        // Get sites for this tenant
        const sites = await prisma.site.findMany({
            where: { tenantId },
            select: {
                id: true,
                type: true,
                platform: true,
                baseUrl: true,
                lastSyncAt: true,
                createdAt: true,
            },
        });

        // Identify stale data (sites not synced in last 24 hours)
        const staleSites = sites.filter(site => {
            if (!site.lastSyncAt) return true;
            const hoursSinceLastSync = (Date.now() - site.lastSyncAt.getTime()) / (1000 * 60 * 60);
            return hoursSinceLastSync > 24;
        });

        // Calculate impact assessment
        const totalSessions = recentSessions.length;
        const failedSessions = recentSessions.filter(s => s.status === 'failed').length;
        const failureRate = totalSessions > 0 ? (failedSessions / totalSessions) * 100 : 0;

        const impactAssessment = {
            affectedSites: [...new Set(recentSessions.filter(s => s.status === 'failed').map(s => s.siteUrl))],
            staleSitesCount: staleSites.length,
            failureRate: Math.round(failureRate * 10) / 10,
            businessImpact: failureRate > 50 ? 'high' : failureRate > 20 ? 'medium' : 'low',
        };

        return NextResponse.json({
            success: true,
            data: {
                tenant: {
                    id: tenant.id,
                    name: tenant.companyName,
                    planType: tenant.planType,
                    createdAt: tenant.createdAt,
                },
                activeSessions: activeSessions.map(s => ({
                    id: s.id,
                    siteUrl: s.siteUrl,
                    targetUrl: s.targetUrl,
                    status: s.status,
                    currentStage: s.currentStage,
                    startTime: s.startTime,
                    proxyUsed: s.proxyUsed,
                })),
                recentErrors: errorCounts,
                metrics: tenantMetrics,
                configuration: {
                    sites: sites.map(site => ({
                        id: site.id,
                        type: site.type,
                        platform: site.platform,
                        baseUrl: site.baseUrl,
                        lastSyncAt: site.lastSyncAt,
                        isStale: staleSites.some(s => s.id === site.id),
                    })),
                },
                impactAssessment,
                staleSites: staleSites.map(s => ({
                    id: s.id,
                    type: s.type,
                    baseUrl: s.baseUrl,
                    lastSyncAt: s.lastSyncAt,
                    hoursSinceLastSync: s.lastSyncAt
                        ? Math.round((Date.now() - s.lastSyncAt.getTime()) / (1000 * 60 * 60))
                        : null,
                })),
            },
        });
    } catch (error) {
        console.error('[Tenant Debug API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch tenant debug information',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    return withRateLimit(req, "auth", (r) => handleGET(r, context));
}
