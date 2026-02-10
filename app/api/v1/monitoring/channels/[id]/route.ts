import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

/**
 * Notification Channel Detail API
 * 
 * Provides endpoints for managing individual notification channels.
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

const updateChannelSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    enabled: z.boolean().optional(),
    config: z.union([emailConfigSchema, slackConfigSchema]).optional(),
});

/**
 * GET /api/v1/monitoring/channels/:id
 * Get a specific notification channel
 */
async function handleGET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

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

        const channel = await prisma.monitoringNotificationChannel.findUnique({
            where: { id },
        });

        if (!channel) {
            return NextResponse.json(
                { success: false, error: { code: "NOT_FOUND", message: "Channel not found" } },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: { channel },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("Failed to fetch notification channel:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to fetch notification channel",
                },
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/v1/monitoring/channels/:id
 * Update a notification channel
 */
async function handlePUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

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
        const validation = updateChannelSchema.safeParse(body);

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

        // Check if channel exists
        const existingChannel = await prisma.monitoringNotificationChannel.findUnique({
            where: { id },
        });

        if (!existingChannel) {
            return NextResponse.json(
                { success: false, error: { code: "NOT_FOUND", message: "Channel not found" } },
                { status: 404 }
            );
        }

        // Update channel
        const channel = await prisma.monitoringNotificationChannel.update({
            where: { id },
            data: {
                ...(validation.data.name && { name: validation.data.name }),
                ...(validation.data.enabled !== undefined && { enabled: validation.data.enabled }),
                ...(validation.data.config && { config: validation.data.config as any }),
            },
        });

        return NextResponse.json({
            success: true,
            data: { channel },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("Failed to update notification channel:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to update notification channel",
                },
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/v1/monitoring/channels/:id
 * Delete a notification channel
 */
async function handleDELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

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

        // Check if channel exists
        const existingChannel = await prisma.monitoringNotificationChannel.findUnique({
            where: { id },
        });

        if (!existingChannel) {
            return NextResponse.json(
                { success: false, error: { code: "NOT_FOUND", message: "Channel not found" } },
                { status: 404 }
            );
        }

        // Delete channel
        await prisma.monitoringNotificationChannel.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            data: { message: "Channel deleted successfully" },
            meta: {
                requestId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("Failed to delete notification channel:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to delete notification channel",
                },
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    return withRequestContextAndRateLimit(req, 'read', (r) => handleGET(r, context));
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    return withRequestContextAndRateLimit(req, 'write', (r) => handlePUT(r, context));
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    return withRequestContextAndRateLimit(req, 'write', (r) => handleDELETE(r, context));
}
