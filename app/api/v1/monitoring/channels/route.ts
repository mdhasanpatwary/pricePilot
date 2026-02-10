import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * Notification Channels API
 * 
 * Provides endpoints for managing notification channels (email, Slack).
 * 
 * Requirements: 4.5, 5.4
 */

// Validation schemas
const emailConfigSchema = z.object({
    recipients: z.array(z.string().email()),
    fromAddress: z.string().email().optional(),
    fromName: z.string().optional(),
});

const slackConfigSchema = z.object({
    webhookUrl: z.string().url(),
    channel: z.string(),
    username: z.string().optional(),
    iconEmoji: z.string().optional(),
});

const createChannelSchema = z.object({
    type: z.enum(["EMAIL", "SLACK"]),
    name: z.string().min(1).max(255),
    enabled: z.boolean().default(true),
    config: z.union([emailConfigSchema, slackConfigSchema]),
});

/**
 * GET /api/v1/monitoring/channels
 * List all notification channels
 */
async function handleGET(_request: NextRequest) {
    try {
        // Check authentication
        const session = await getCachedSession();
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

        // Fetch all channels
        const channels = await prisma.monitoringNotificationChannel.findMany({
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({
            success: true,
            data: { channels },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("Failed to fetch notification channels:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to fetch notification channels",
                },
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/v1/monitoring/channels
 * Create a new notification channel
 */
async function handlePOST(request: NextRequest) {
    try {
        // Check authentication
        const session = await getCachedSession();
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

        // Parse and validate request body
        const body = await request.json();
        const validation = createChannelSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Invalid channel configuration",
                        details: { fields: validation.error.flatten().fieldErrors },
                    },
                },
                { status: 422 }
            );
        }

        const { type, name, enabled, config } = validation.data;

        // Create channel
        const channel = await prisma.monitoringNotificationChannel.create({
            data: {
                type,
                name,
                enabled,
                config: config as any,
            },
        });

        return NextResponse.json(
            {
                success: true,
                data: { channel },
                meta: {
                    requestId: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Failed to create notification channel:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to create notification channel",
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, 'read', handleGET);
}

export async function POST(req: NextRequest) {
    return withRequestContextAndRateLimit(req, 'write', handlePOST);
}
