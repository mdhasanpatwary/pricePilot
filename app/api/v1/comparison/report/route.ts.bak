/**
 * Comparison Report API Endpoint
 * 
 * Provides product comparison data with caching
 * Requirements: 8.2 - Cache GET requests for comparison reports (TTL: 5 minutes)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import { withErrorHandling } from "@/lib/middleware/global-error-handler";
import { withCache } from "@/lib/middleware/api-cache";
import { UnauthorizedError } from "@/lib/utils/error-handler";
import { ComparisonService } from "@/lib/services/comparison";

async function handleGET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        throw new UnauthorizedError('Authentication required to access comparison report');
    }

    const tenantId = session.user.tenantId;

    // Parse query parameters for filters
    const searchParams = req.nextUrl.searchParams;
    const filters = {
        status: searchParams.get("status") || undefined,
        page: parseInt(searchParams.get("page") || "1"),
        limit: parseInt(searchParams.get("limit") || "20"),
        sortBy: searchParams.get("sortBy") || undefined,
        sortOrder: (searchParams.get("sortOrder") || "asc") as "asc" | "desc",
    };

    // Get comparison report using the comparison service
    const comparisonService = new ComparisonService();
    const report = await comparisonService.getComparisonReport(tenantId, filters);

    return NextResponse.json(report);
}

export async function GET(req: NextRequest) {
    // Apply caching with 5-minute TTL (300 seconds)
    const cachedHandler = withCache(
        (req) => withRateLimit(req, "read", withErrorHandling(handleGET)),
        {
            ttl: 300, // 5 minutes
            keyPrefix: 'api:comparison:report',
            varyBy: ['status', 'page', 'limit', 'sortBy', 'sortOrder'],
            tenantIsolated: true,
        }
    );

    return cachedHandler(req);
}
