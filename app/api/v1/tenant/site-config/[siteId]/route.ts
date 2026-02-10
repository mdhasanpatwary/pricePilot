import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

interface UpdateSiteConfigRequest {
    sessionWarmup: boolean;
    delays: {
        min: number;
        max: number;
    };
}

/**
 * PATCH /api/v1/tenant/site-config/:siteId
 * Update site configuration for a tenant's site
 * 
 * Requirements: 11.3, 11.4, 11.6
 */
async function handlePATCH(
    request: NextRequest,
    { params }: { params: Promise<{ siteId: string }> }
) {
    try {
        // Authenticate and get tenant ID
        const session = await getCachedSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const tenantId = session.user.tenantId;
        if (!tenantId) {
            return NextResponse.json({ error: "Tenant ID not found" }, { status: 400 });
        }

        const { siteId } = await params;

        // Verify site ownership
        const site = await prisma.site.findUnique({
            where: { id: siteId },
            select: {
                id: true,
                tenantId: true,
                baseUrl: true
            }
        });

        if (!site) {
            return NextResponse.json({ error: "Site not found" }, { status: 404 });
        }

        if (site.tenantId !== tenantId) {
            return NextResponse.json(
                { error: "Forbidden: You do not own this site" },
                { status: 403 }
            );
        }

        // Parse request body
        const body: UpdateSiteConfigRequest = await request.json();

        // Validate request body structure
        if (typeof body.sessionWarmup !== 'boolean') {
            return NextResponse.json(
                { error: "Invalid request: sessionWarmup must be a boolean" },
                { status: 400 }
            );
        }

        if (!body.delays || typeof body.delays.min !== 'number' || typeof body.delays.max !== 'number') {
            return NextResponse.json(
                { error: "Invalid request: delays must contain min and max numbers" },
                { status: 400 }
            );
        }

        // Fetch tenant to get plan type
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { planType: true }
        });

        if (!tenant) {
            return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
        }

        // Define allowed ranges based on plan type
        let allowedRanges = {
            minDelay: 1000,
            maxDelay: 5000
        };

        switch (tenant.planType) {
            case 'PREMIUM':
                allowedRanges = { minDelay: 500, maxDelay: 3000 };
                break;
            case 'PRO':
                allowedRanges = { minDelay: 100, maxDelay: 2000 };
                break;
            case 'BASIC':
            default:
                allowedRanges = { minDelay: 1000, maxDelay: 5000 };
                break;
        }

        // Validate settings against plan limits
        const errors: string[] = [];

        if (body.delays.min < allowedRanges.minDelay) {
            errors.push(`Minimum delay must be at least ${allowedRanges.minDelay}ms for your plan`);
        }

        if (body.delays.max > allowedRanges.maxDelay) {
            errors.push(`Maximum delay cannot exceed ${allowedRanges.maxDelay}ms for your plan`);
        }

        // Validate delay ranges
        if (body.delays.min > body.delays.max) {
            errors.push("Minimum delay cannot be greater than maximum delay");
        }

        if (body.delays.min < 0 || body.delays.max < 0) {
            errors.push("Delay values must be non-negative");
        }

        if (errors.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Validation failed",
                    errors
                },
                { status: 400 }
            );
        }

        // Update or create site profile
        const siteProfile = await prisma.siteProfile.upsert({
            where: {
                domain: site.baseUrl
            },
            update: {
                sessionWarmupEnabled: body.sessionWarmup,
                minDelay: body.delays.min,
                maxDelay: body.delays.max,
                updatedAt: new Date()
            },
            create: {
                domain: site.baseUrl,
                sessionWarmupEnabled: body.sessionWarmup,
                minDelay: body.delays.min,
                maxDelay: body.delays.max,
                // Use defaults for other fields
                requestsPerMinute: 10,
                concurrentRequests: 2,
                delayMultiplier: 1.0,
                sessionWarmupPaths: [],
                referrerChainEnabled: true
            }
        });

        // Return updated configuration
        return NextResponse.json({
            success: true,
            data: {
                siteId: site.id,
                domain: site.baseUrl,
                sessionWarmup: siteProfile.sessionWarmupEnabled,
                delays: {
                    min: siteProfile.minDelay,
                    max: siteProfile.maxDelay
                },
                allowedRanges
            }
        });

    } catch (error) {
        console.error("[TenantSiteConfig PATCH] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to update site configuration",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ siteId: string }> }
) {
    return withRequestContextAndRateLimit(req, 'write', () => handlePATCH(req, context));
}
