import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationRouter } from "@/lib/services/monitoring/notification-router";
import { withRateLimit } from "@/lib/middleware/ratelimit";

/**
 * Test Notification Channel API
 * 
 * Provides endpoint for testing notification channel delivery.
 * 
 * Requirements: 4.5, 5.4, 10.1
 */

/**
 * POST /api/v1/monitoring/channels/:id/test
 * Send a test notification through the specified channel
 */
async function handlePOST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
                { status: 401 }
            );
        }

        // Check admin role
        const isAdmin = session.user.role === "ADMIN" || session.user.isSuperAdmin === true;
        if (!isAdmin) {
            return NextResponse.json(
                { success: false, error: { code: "FORBIDDEN", message: "Admin access required" } },
                { status: 403 }
            );
        }

        // Check if channel exists
        const channel = await prisma.monitoringNotificationChannel.findUnique({
            where: { id },
        });

        if (!channel) {
            return NextResponse.json(
                { success: false, error: { code: "NOT_FOUND", message: "Channel not found" } },
                { status: 404 }
            );
        }

        // Send test notification
        const router = new NotificationRouter();
        const success = await router.testNotification(id);

        return NextResponse.json({
            success: true,
            data: {
                channelId: id,
                channelName: channel.name,
                channelType: channel.type,
                testSent: success,
                message: success
                    ? "Test notification sent successfully"
                    : "Test notification failed - check channel configuration",
            },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("Failed to send test notification:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to send test notification",
                },
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    return withRateLimit(req, 'write', (r) => handlePOST(r, context));
}
