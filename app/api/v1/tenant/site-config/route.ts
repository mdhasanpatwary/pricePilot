import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";

interface TenantSiteConfig {
    siteId: string;
    domain: string;
    sessionWarmup: boolean;
    delays: {
        min: number;
        max: number;
    };
    allowedRanges: {
        minDelay: number;
        maxDelay: number;
    };
}

/**
 * GET /api/v1/tenant/site-config
 * Get site configurations for tenant's sites
 * 
 * Requirements: 11.1, 11.5
 */
async function handleGET(_request: NextRequest) {
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

        // Fetch tenant to get plan type
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { planType: true }
        });

        if (!tenant) {
            return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
        }

        // Define allowed ranges based on plan type
        // BASIC: 1000-5000ms, PREMIUM: 500-3000ms, PRO: 100-2000ms
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

        // Fetch tenant's sites
        const tenantSites = await prisma.site.findMany({
            where: {
                tenantId: tenantId
            },
            select: {
                id: true,
                baseUrl: true
            }
        });

        // Fetch site profiles for tenant's sites
        const siteProfiles = await prisma.siteProfile.findMany({
            where: {
                domain: {
                    in: tenantSites.map(site => site.baseUrl)
                }
            }
        });

        // Create a map of site profiles by domain
        const profileMap = new Map<string, typeof siteProfiles[0]>(
            siteProfiles.map(profile => [profile.domain, profile])
        );

        // Build site configurations
        const siteConfigs: TenantSiteConfig[] = tenantSites.map(site => {
            const profile = profileMap.get(site.baseUrl);

            return {
                siteId: site.id,
                domain: site.baseUrl,
                sessionWarmup: profile?.sessionWarmupEnabled ?? false,
                delays: {
                    min: profile?.minDelay ?? 1000,
                    max: profile?.maxDelay ?? 3000
                },
                allowedRanges
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                sites: siteConfigs,
                planType: tenant.planType
            }
        });

    } catch (error) {
        console.error("[TenantSiteConfig GET] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch site configurations",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextAndRateLimit(req, 'read', () => handleGET(req));
}
