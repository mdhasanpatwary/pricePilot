import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncOrchestrator } from "@/lib/services/sync-orchestrator";
import { withErrorHandling } from "@/lib/middleware/global-error-handler";
import {
  validateBody,
  validationErrorResponse,
  createCompetitorSchema,
} from "@/lib/validation";
import { recordAuditLog, getIpAddress } from "@/lib/audit";
import { UnauthorizedError, NotFoundError, ForbiddenError, ValidationError } from "@/lib/utils/error-handler";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getOrSetRequestCache } from "@/lib/cache/request-cache";
import { getCachedTenant } from "@/lib/tenant/cached-tenant";
import {
  getCursorPaginationParams,
  paginateCursor
} from "@/lib/utils/pagination";
import { withCache } from "@/lib/middleware/api-cache";
import { withDbRetry } from "@/lib/utils/db-retry";
import { metricsCollector } from "@/lib/services/monitoring/metrics-collector";
import { logger } from "@/lib/logger";

import { toSiteDTO } from "@/lib/dtos/site.dto";

async function handleGET(req: NextRequest) {
  const startTime = Date.now();
  const session = await getCachedSession();

  if (!session?.user) {
    throw new UnauthorizedError('Authentication required to access competitors');
  }

  const tenantId = session.user.tenantId;

  // Get pagination parameters
  const searchParams = req.nextUrl.searchParams;
  const paginationParams = getCursorPaginationParams(searchParams);

  // Use cursor-based pagination - retry on transient failures
  const paginatedResult = await withDbRetry(() => paginateCursor(
    prisma.site,
    {
      tenantId,
      type: "COMPETITOR",
    },
    {
      ...paginationParams,
      sortBy: paginationParams.sortBy || 'id',
      sortOrder: paginationParams.sortOrder || 'desc'
    },
    {
      _count: {
        select: { Product: true },
      },
    }
  ), { operationName: 'ListCompetitors' });

  const competitorsList = paginatedResult.data;

  // 1. Fetch total user products count once (request-scoped cache)
  const totalUserProducts = await getOrSetRequestCache(
    `totalUserProducts:${tenantId}`,
    () => prisma.product.count({
      where: {
        tenantId,
        Site: { type: "USER" }
      }
    })
  );

  // 2. Optimization: Fetch per-site matched counts in DB to avoid large raw row transfers
  const competitorIds = competitorsList.map((c: any) => c.id);

  type SiteMatchCountRow = { siteId: string; matchedCount: number | bigint };
  let siteMatchCountMap = new Map<string, number>();

  if (competitorIds.length > 0) {
    const matchCounts = await withDbRetry(() => prisma.$queryRaw<SiteMatchCountRow[]>`
      SELECT
        cp."siteId",
        COUNT(DISTINCT pm."userProductId") AS "matchedCount"
      FROM "ProductMatch" pm
      INNER JOIN "Product" cp ON cp.id = pm."competitorProductId"
      INNER JOIN "Product" up ON up.id = pm."userProductId"
      INNER JOIN "Site" s ON s.id = up."siteId"
      WHERE cp."siteId" = ANY(${competitorIds}::text[])
        AND up."tenantId" = ${tenantId}
        AND s.type = 'USER'
      GROUP BY cp."siteId"
    `, { operationName: 'FetchCompetitorMatchCountsRaw' });

    siteMatchCountMap = new Map(
      matchCounts.map((row) => [
        row.siteId,
        Number(typeof row.matchedCount === "bigint" ? row.matchedCount : row.matchedCount ?? 0),
      ])
    );
  }

  const formattedCompetitors = competitorsList.map((site: any) => {
    const matchedCount = siteMatchCountMap.get(site.id) || 0;

    return toSiteDTO(site, {
      matchedProductsCount: matchedCount,
      totalScrapedProductsCount: site._count.Product,
      totalUserProductsCount: totalUserProducts
    });
  });

  const response = {
    competitors: formattedCompetitors,
    pagination: paginatedResult.pagination,
  };

  // Record metrics
  const duration = Date.now() - startTime;
  metricsCollector.recordResponseTime("/api/v1/competitors", duration, tenantId).catch(err =>
    logger.warn('Failed to record response time metric', { error: err })
  );

  return NextResponse.json(response);
}

async function handlePOST(req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    throw new UnauthorizedError('Authentication required to create competitors');
  }

  const tenantId = session.user.tenantId;

  // Validate and sanitize input
  const validation = await validateBody(req, createCompetitorSchema);

  if (!validation.success) {
    return validationErrorResponse(validation);
  }

  const { name, baseUrl, searchQueryPattern } = validation.data!;

  // Fetch tenant limits
  const tenant = await getCachedTenant(tenantId);

  if (!tenant) {
    throw new NotFoundError('Tenant', tenantId);
  }

  // Check for existing integration (Dynamic Limit)
  const existingCount = await prisma.site.count({
    where: {
      tenantId,
      type: "COMPETITOR",
    },
  });

  if (existingCount >= tenant.competitorLimit) {
    throw new ForbiddenError(
      `Competitor tracking limit reached (${tenant.competitorLimit}). Please upgrade your plan to track more sites.`
    );
  }

  const site = await prisma.site.create({
    data: {
      baseUrl,
      type: "COMPETITOR",
      tenantId,
      isSyncing: true, // Start as syncing immediately so UI picks it up
      syncLastAction: "Initializing crawler...",
      searchQueryPattern,
    },
  });

  await recordAuditLog({
    tenantId,
    userId: session.user.id,
    userEmail: session.user.email!,
    action: "CREATE_COMPETITOR",
    entityId: site.id,
    ipAddress: getIpAddress(req),
    details: { name, baseUrl },
  });

  // Trigger auto-fetch immediately in background (Asynchronous & Non-blocking)
  SyncOrchestrator.dispatchSiteSync(site.id, true).catch((error) => {
    console.error(
      `[API] Auto-fetch failed for new site ${site.id}:`,
      error,
    );
  });

  // Return standardized DTO
  return NextResponse.json(toSiteDTO(site));
}

async function handleDELETE(req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    throw new UnauthorizedError('Authentication required to delete competitors');
  }

  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    throw new ValidationError('Invalid request', { id: ['ID is required'] });
  }

  await prisma.site.delete({
    where: {
      id,
      tenantId,
    },
  });

  // Invalidate product list cache for this tenant
  const { invalidateCache } = await import("@/lib/middleware/api-cache");
  await invalidateCache(`api:products:*:${tenantId}:*`).catch(err =>
    console.error("Cache invalidation error:", err)
  );

  await recordAuditLog({
    tenantId,
    userId: session.user.id,
    userEmail: session.user.email!,
    action: "DELETE_COMPETITOR",
    entityId: id,
    ipAddress: getIpAddress(req),
  });

  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(
    req,
    "read",
    withCache(withErrorHandling(handleGET), {
      ttl: 30, // 30s cache for medium dataset as requested
      keyPrefix: "api:competitors",
      tenantIsolated: true,
      varyBy: ["cursor", "limit", "sortBy", "sortOrder"],
      // Bypass cache if any competitor is currently syncing for real-time progress updates
      bypass: async (_req, tenantId) => {
        if (!tenantId) return false;

        // Fast check: Is any competitor syncing?
        const syncingSite = await prisma.site.findFirst({
          where: {
            tenantId,
            type: "COMPETITOR",
            isSyncing: true,
          },
          select: { id: true },
        });

        return !!syncingSite;
      },
    })
  );
}

export async function POST(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", withErrorHandling(handlePOST));
}

export async function DELETE(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", withErrorHandling(handleDELETE));
}
