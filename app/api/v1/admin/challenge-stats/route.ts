import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/middleware/ratelimit";

interface ChallengeTypeStats {
    type: string;
    count: number;
    solveRate: number;
}

interface ChallengeStats {
    site: string;
    totalChallenges: number;
    solvedChallenges: number;
    failedChallenges: number;
    solveRate: number;
    challengeTypes: ChallengeTypeStats[];
}

interface ChallengeSummary {
    totalChallenges: number;
    avgSolveRate: number;
    mostCommonType: string;
    sitesWithIssues: number;
}

/**
 * GET /api/v1/admin/challenge-stats
 * Get challenge detection and solve statistics with optional time range filtering
 * 
 * Query Parameters:
 * - timeRange: '24h' | '7d' | '30d' (optional, default: '24h')
 * 
 * Requirements: 8.2, 2.1, 2.2, 2.3, 2.5, 2.6
 */
async function handleGET(request: NextRequest) {
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

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const timeRange = searchParams.get('timeRange') || '24h';

        // Validate time range
        if (!['24h', '7d', '30d'].includes(timeRange)) {
            return NextResponse.json(
                { error: "Invalid time range. Must be '24h', '7d', or '30d'" },
                { status: 400 }
            );
        }

        // Calculate start time based on time range
        const now = new Date();
        const startTime = new Date(now);

        switch (timeRange) {
            case '24h':
                startTime.setHours(now.getHours() - 24);
                break;
            case '7d':
                startTime.setDate(now.getDate() - 7);
                break;
            case '30d':
                startTime.setDate(now.getDate() - 30);
                break;
        }

        // Fetch challenge attempts from database for the time range
        const challengeAttempts = await prisma.challengeAttempt.findMany({
            where: {
                timestamp: {
                    gte: startTime
                }
            },
            orderBy: {
                timestamp: 'desc'
            }
        });

        // Group by site and calculate statistics
        const siteStatsMap = new Map<string, {
            totalChallenges: number;
            solvedChallenges: number;
            failedChallenges: number;
            challengeTypeMap: Map<string, { count: number; solved: number }>;
        }>();

        for (const attempt of challengeAttempts) {
            if (!siteStatsMap.has(attempt.site)) {
                siteStatsMap.set(attempt.site, {
                    totalChallenges: 0,
                    solvedChallenges: 0,
                    failedChallenges: 0,
                    challengeTypeMap: new Map()
                });
            }

            const siteStats = siteStatsMap.get(attempt.site)!;
            siteStats.totalChallenges++;

            if (attempt.solved) {
                siteStats.solvedChallenges++;
            } else {
                siteStats.failedChallenges++;
            }

            // Track by challenge type
            if (!siteStats.challengeTypeMap.has(attempt.challengeType)) {
                siteStats.challengeTypeMap.set(attempt.challengeType, {
                    count: 0,
                    solved: 0
                });
            }

            const typeStats = siteStats.challengeTypeMap.get(attempt.challengeType)!;
            typeStats.count++;
            if (attempt.solved) {
                typeStats.solved++;
            }
        }

        // Format site statistics
        const sites: ChallengeStats[] = Array.from(siteStatsMap.entries()).map(([site, stats]) => {
            const solveRate = stats.totalChallenges > 0
                ? (stats.solvedChallenges / stats.totalChallenges) * 100
                : 0;

            const challengeTypes: ChallengeTypeStats[] = Array.from(stats.challengeTypeMap.entries()).map(
                ([type, typeStats]) => ({
                    type,
                    count: typeStats.count,
                    solveRate: typeStats.count > 0
                        ? Math.round((typeStats.solved / typeStats.count) * 1000) / 10 // Round to 1 decimal
                        : 0
                })
            );

            return {
                site,
                totalChallenges: stats.totalChallenges,
                solvedChallenges: stats.solvedChallenges,
                failedChallenges: stats.failedChallenges,
                solveRate: Math.round(solveRate * 10) / 10, // Round to 1 decimal
                challengeTypes
            };
        });

        // Sort sites by total challenges (descending)
        sites.sort((a, b) => b.totalChallenges - a.totalChallenges);

        // Calculate aggregate statistics
        const totalChallenges = challengeAttempts.length;
        const avgSolveRate = sites.length > 0
            ? sites.reduce((sum, s) => sum + s.solveRate, 0) / sites.length
            : 0;

        // Find most common challenge type
        const challengeTypeCounts = new Map<string, number>();
        for (const attempt of challengeAttempts) {
            challengeTypeCounts.set(
                attempt.challengeType,
                (challengeTypeCounts.get(attempt.challengeType) || 0) + 1
            );
        }

        let mostCommonType = 'None';
        let maxCount = 0;
        for (const [type, count] of challengeTypeCounts.entries()) {
            if (count > maxCount) {
                maxCount = count;
                mostCommonType = type;
            }
        }

        // Count sites with low solve rate (below 70%)
        const sitesWithIssues = sites.filter(s => s.solveRate < 70).length;

        const summary: ChallengeSummary = {
            totalChallenges,
            avgSolveRate: Math.round(avgSolveRate * 10) / 10,
            mostCommonType,
            sitesWithIssues
        };

        return NextResponse.json({
            success: true,
            data: {
                summary,
                sites,
                timeRange
            }
        });

    } catch (error) {
        console.error("[ChallengeStats API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch challenge statistics",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', handleGET);
}
