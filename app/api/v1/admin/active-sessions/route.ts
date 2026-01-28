import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

interface ActiveSession {
    id: string;
    site: string;
    tenant: string;
    startTime: Date;
    requestsCompleted: number;
    requestsTotal: number;
    status: 'running' | 'waiting_challenge' | 'completed' | 'failed';
    currentProxy: string | null;
    challengeType: string | null;
    challengeStatus: 'waiting' | 'solved' | 'failed' | null;
}

interface MonitorStats {
    activeSessions: number;
    requestsPerMinute: number;
    avgSessionDuration: number;
}

/**
 * GET /api/v1/admin/active-sessions
 * Get real-time scraping session data
 * 
 * Requirements: 8.9, 7.1, 7.2, 7.3, 7.4, 7.7
 */
async function handleGET() {
    try {
        // Authentication check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is super admin or regular admin
        const user = session.user as any;
        const isAdmin = user.role === "ADMIN" || user.isSuperAdmin === true;
        
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
        }

        // Fetch active scraping sessions (sites that are currently syncing)
        const activeSites = await prisma.site.findMany({
            where: {
                isSyncing: true
            },
            include: {
                tenant: {
                    select: {
                        companyName: true
                    }
                }
            },
            orderBy: {
                syncStartedAt: 'desc'
            }
        });

        // Get recent challenge attempts for active sites (last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentChallenges = await (prisma as any).challengeAttempt.findMany({
            where: {
                timestamp: {
                    gte: fiveMinutesAgo
                }
            },
            orderBy: {
                timestamp: 'desc'
            }
        });

        // Create a map of site to most recent challenge
        const siteChallengeMap = new Map<string, {
            type: string;
            solved: boolean;
            timestamp: Date;
        }>();

        for (const challenge of recentChallenges) {
            if (!siteChallengeMap.has(challenge.site)) {
                siteChallengeMap.set(challenge.site, {
                    type: challenge.challengeType,
                    solved: challenge.solved,
                    timestamp: challenge.timestamp
                });
            }
        }

        // Create a map of proxy usage by site (approximate)
        // Since we don't have direct site-to-proxy mapping in real-time,
        // we'll use the most recently used proxy as a best guess
        const proxyUsageMap = new Map<string, string>();

        // Get proxy health to show current proxy status
        const proxyHealth = await (prisma as any).proxyHealth.findMany({
            where: {
                isHealthy: true
            },
            orderBy: {
                lastChecked: 'desc'
            },
            take: 10 // Get top 10 healthy proxies
        });

        // Distribute proxies across active sites (round-robin approximation)
        const healthyProxies = proxyHealth.map((p: any) => p.proxyUrl);
        activeSites.forEach((site, index) => {
            if (healthyProxies.length > 0) {
                proxyUsageMap.set(site.baseUrl, healthyProxies[index % healthyProxies.length]);
            }
        });

        // Format active sessions
        const sessions: ActiveSession[] = activeSites.map((site) => {
            const challenge = siteChallengeMap.get(site.baseUrl);
            const currentProxy = proxyUsageMap.get(site.baseUrl) || null;

            // Determine session status
            let status: ActiveSession['status'] = 'running';
            let challengeType: string | null = null;
            let challengeStatus: ActiveSession['challengeStatus'] = null;

            if (challenge) {
                // Check if challenge is recent (within last 2 minutes)
                const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
                if (challenge.timestamp > twoMinutesAgo) {
                    challengeType = challenge.type;
                    if (challenge.solved) {
                        challengeStatus = 'solved';
                        status = 'running'; // Continue running after solving
                    } else {
                        challengeStatus = 'waiting';
                        status = 'waiting_challenge';
                    }
                }
            }

            return {
                id: site.id,
                site: site.baseUrl,
                tenant: site.tenant.companyName,
                startTime: site.syncStartedAt || site.updatedAt,
                requestsCompleted: site.syncProcessed,
                requestsTotal: site.syncTotal,
                status,
                currentProxy,
                challengeType,
                challengeStatus
            };
        });

        // Calculate aggregate statistics
        const activeSessions = sessions.length;

        // Calculate requests per minute based on recent activity
        let requestsPerMinute = 0;
        if (activeSessions > 0) {
            // Get scraping metrics from the last minute
            const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
            const recentMetrics = await (prisma as any).scrapingMetrics.findMany({
                where: {
                    timestamp: {
                        gte: oneMinuteAgo
                    }
                }
            });

            const totalRecentRequests = recentMetrics.reduce(
                (sum: number, m: any) => sum + m.totalRequests,
                0
            );
            requestsPerMinute = totalRecentRequests;
        }

        // Calculate average session duration
        let avgSessionDuration = 0;
        if (activeSessions > 0) {
            const now = Date.now();
            const totalDuration = sessions.reduce((sum, s) => {
                const startTime = new Date(s.startTime).getTime();
                return sum + (now - startTime);
            }, 0);
            avgSessionDuration = Math.round(totalDuration / activeSessions / 1000); // Convert to seconds
        }

        const stats: MonitorStats = {
            activeSessions,
            requestsPerMinute,
            avgSessionDuration
        };

        return NextResponse.json({
            success: true,
            data: {
                stats,
                sessions
            }
        });

    } catch (error) {
        console.error("[ActiveSessions API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch active sessions",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', handleGET);
}
