/**
 * Security Dashboard API
 *
 * Provides comprehensive security metrics and incident information
 * for the security dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { incidentPreventionService } from '@/lib/services/security/incident-prevention';
import { securityMonitoringService } from '@/lib/services/monitoring/security-monitoring';

/**
 * GET /api/v1/security/dashboard
 *
 * Get security dashboard data including incidents, blocked IPs, and statistics
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const timeWindow = parseInt(searchParams.get('timeWindow') || '86400000'); // 24 hours default

        // Get security statistics
        const stats = await incidentPreventionService.getSecurityStats(timeWindow);

        // Get recent incidents
        const incidents = await incidentPreventionService.getIncidents(timeWindow);

        // Get recent security events
        const events = await securityMonitoringService.getSecurityEvents(timeWindow);

        return NextResponse.json({
            success: true,
            data: {
                stats,
                incidents: incidents.slice(0, 50), // Limit to 50 most recent
                events: events.slice(0, 100), // Limit to 100 most recent
                timeWindow,
            },
        });
    } catch (error) {
        console.error('Security dashboard error:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to fetch security dashboard data',
                },
            },
            { status: 500 }
        );
    }
}
