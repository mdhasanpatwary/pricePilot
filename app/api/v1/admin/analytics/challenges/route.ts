import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withRateLimit } from '@/lib/middleware/ratelimit';

/**
 * GET /api/v1/admin/analytics/challenges
 * Get challenge analytics including detection rates, solve rates, and trends
 *
 * Query Parameters:
 * - timeRange: Time range for analytics (1h, 24h, 7d) - default: 24h
 * - challengeType: Filter by specific challenge type (optional)
 * - siteUrl: Filter by specific site URL (optional)
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
async function handleGET(request: NextRequest) {
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

        // Parse query parameters
        const searchParams = request.nextUrl.searchParams;
        const timeRange = (searchParams.get('timeRange') || '24h') as '1h' | '24h' | '7d';
        const challengeType = searchParams.get('challengeType') || undefined;
        const siteUrl = searchParams.get('siteUrl') || undefined;

        // Validate time range
        if (!['1h', '24h', '7d'].includes(timeRange)) {
            return NextResponse.json(
                { error: 'Invalid time range. Must be 1h, 24h, or 7d' },
                { status: 400 }
            );
        }

        // Calculate start time based on range
        const now = new Date();
        const startTime = new Date(now);
        if (timeRange === '1h') {
            startTime.setHours(now.getHours() - 1);
        } else if (timeRange === '24h') {
            startTime.setHours(now.getHours() - 24);
        } else {
            startTime.setDate(now.getDate() - 7);
        }

        // Build where clause for filters
        const whereClause: any = {
            timestamp: { gte: startTime },
        };

        if (challengeType) {
            whereClause.challengeType = challengeType;
        }

        if (siteUrl) {
            whereClause.site = siteUrl;
        }

        // Get challenge attempts
        const challenges = await prisma.challengeAttempt.findMany({
            where: whereClause,
            select: {
                challengeType: true,
                site: true,
                solved: true,
                duration: true,
                timestamp: true,
            },
            orderBy: {
                timestamp: 'desc',
            },
        });

        // Calculate overall statistics
        const totalChallenges = challenges.length;
        const solvedChallenges = challenges.filter(c => c.solved).length;
        const failedChallenges = totalChallenges - solvedChallenges;
        const solveRate = totalChallenges > 0 ? solvedChallenges / totalChallenges : 0;

        // Calculate average solve time (only for solved challenges)
        const solvedDurations = challenges.filter(c => c.solved).map(c => c.duration);
        const avgSolveTime = solvedDurations.length > 0
            ? solvedDurations.reduce((sum, d) => sum + d, 0) / solvedDurations.length
            : 0;

        // Group by challenge type
        const byType = new Map<string, { total: number; solved: number; avgDuration: number }>();
        for (const challenge of challenges) {
            const type = challenge.challengeType || 'unknown';
            const existing = byType.get(type) || { total: 0, solved: 0, avgDuration: 0 };
            existing.total++;
            if (challenge.solved) {
                existing.solved++;
                existing.avgDuration = (existing.avgDuration * (existing.solved - 1) + challenge.duration) / existing.solved;
            }
            byType.set(type, existing);
        }

        const challengesByType = Array.from(byType.entries()).map(([type, stats]) => ({
            challengeType: type,
            totalAttempts: stats.total,
            solvedAttempts: stats.solved,
            failedAttempts: stats.total - stats.solved,
            solveRate: stats.total > 0 ? stats.solved / stats.total : 0,
            avgSolveTime: stats.avgDuration,
        }));

        // Group by site
        const bySite = new Map<string, { total: number; solved: number; avgDuration: number }>();
        for (const challenge of challenges) {
            const site = challenge.site || 'unknown';
            const existing = bySite.get(site) || { total: 0, solved: 0, avgDuration: 0 };
            existing.total++;
            if (challenge.solved) {
                existing.solved++;
                existing.avgDuration = (existing.avgDuration * (existing.solved - 1) + challenge.duration) / existing.solved;
            }
            bySite.set(site, existing);
        }

        const challengesBySite = Array.from(bySite.entries())
            .map(([site, stats]) => ({
                siteUrl: site,
                totalAttempts: stats.total,
                solvedAttempts: stats.solved,
                failedAttempts: stats.total - stats.solved,
                solveRate: stats.total > 0 ? stats.solved / stats.total : 0,
                avgSolveTime: stats.avgDuration,
            }))
            .sort((a, b) => b.totalAttempts - a.totalAttempts)
            .slice(0, 10); // Top 10 sites

        // Create time-series data
        const intervalMs = timeRange === '1h' ? 300000 : timeRange === '24h' ? 3600000 : 86400000; // 5min, 1h, 1d
        const timeSeriesMap = new Map<number, { total: number; solved: number }>();

        for (const challenge of challenges) {
            const intervalKey = Math.floor(challenge.timestamp.getTime() / intervalMs) * intervalMs;
            const existing = timeSeriesMap.get(intervalKey) || { total: 0, solved: 0 };
            existing.total++;
            if (challenge.solved) {
                existing.solved++;
            }
            timeSeriesMap.set(intervalKey, existing);
        }

        const timeSeries = Array.from(timeSeriesMap.entries())
            .map(([timestamp, data]) => ({
                timestamp: new Date(timestamp),
                totalChallenges: data.total,
                solvedChallenges: data.solved,
                solveRate: data.total > 0 ? data.solved / data.total : 0,
            }))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Identify unknown challenge types (for flagging)
        const knownTypes = ['cloudflare', 'recaptcha', 'hcaptcha', 'funcaptcha', 'turnstile'];
        const unknownChallenges = challengesByType
            .filter(c => !knownTypes.includes(c.challengeType.toLowerCase()))
            .map(c => ({
                challengeType: c.challengeType,
                occurrences: c.totalAttempts,
                firstSeen: challenges.find(ch => ch.challengeType === c.challengeType)?.timestamp,
                lastSeen: challenges.reverse().find(ch => ch.challengeType === c.challengeType)?.timestamp,
            }));

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    totalChallenges,
                    solvedChallenges,
                    failedChallenges,
                    solveRate,
                    avgSolveTime,
                },
                byType: challengesByType,
                bySite: challengesBySite,
                timeSeries,
                unknownChallenges,
                timeRange,
            },
        });
    } catch (error) {
        console.error('[Challenge Analytics API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch challenge analytics',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}


export async function GET(req: NextRequest) {
    return withRateLimit(req, 'read', handleGET);
}
