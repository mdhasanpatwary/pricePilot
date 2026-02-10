import { NextRequest, NextResponse } from "next/server";
import { cacheAlertingService } from "@/lib/services/cache-alerting";
import { logger } from "@/lib/logger";
import { getCachedSession } from "@/lib/auth/cached-session";

/**
 * GET /api/v1/admin/cache/alerts/config
 * Get current alert configuration
 */
export async function GET(_request: NextRequest) {
    try {
        // Check authentication
        const session = await getCachedSession();
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Check admin role
        if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json(
                { success: false, error: "Forbidden - Admin access required" },
                { status: 403 }
            );
        }

        // Get configuration
        const config = cacheAlertingService.getConfig();

        return NextResponse.json({
            success: true,
            data: { config },
        });
    } catch (error) {
        logger.error("[API] Error getting alert config", { error });
        return NextResponse.json(
            {
                success: false,
                error: "Failed to get alert configuration",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/v1/admin/cache/alerts/config
 * Update alert configuration
 * 
 * Body:
 * {
 *   "enabled": boolean,
 *   "hitRateThreshold": number,
 *   "memoryUsageThreshold": number,
 *   "responseTimeThreshold": number,
 *   "notificationChannels": string[]
 * }
 */
export async function PUT(request: NextRequest) {
    try {
        // Check authentication
        const session = await getCachedSession();
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Check admin role
        if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json(
                { success: false, error: "Forbidden - Admin access required" },
                { status: 403 }
            );
        }

        // Parse request body
        const body = await request.json();

        // Validate configuration
        const validChannels = ['log', 'email', 'slack', 'webhook'];
        if (body.notificationChannels) {
            const invalidChannels = body.notificationChannels.filter(
                (ch: string) => !validChannels.includes(ch)
            );
            if (invalidChannels.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Invalid notification channels: ${invalidChannels.join(', ')}`,
                    },
                    { status: 400 }
                );
            }
        }

        // Update configuration
        cacheAlertingService.updateConfig(body);

        logger.info("[API] Cache alert configuration updated", {
            userId: session.user.id,
            userEmail: session.user.email,
            config: body,
        });

        return NextResponse.json({
            success: true,
            message: "Alert configuration updated",
            data: {
                config: cacheAlertingService.getConfig(),
            },
        });
    } catch (error) {
        logger.error("[API] Error updating alert config", { error });
        return NextResponse.json(
            {
                success: false,
                error: "Failed to update alert configuration",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
