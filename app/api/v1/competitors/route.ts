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
import {
  getCursorPaginationParams,
  paginateCursor
} from "@/lib/utils/pagination";

async function handleGET(req: NextRequest) {
  const session = await getCachedSession();

  if (!session?.user) {
    throw new UnauthorizedError('Authentication required to access competitors');
  }

  const tenantId = session.user.tenantId;

  // Get pagination parameters
  const searchParams = req.nextUrl.searchParams;
  const paginationParams = getCursorPaginationParams(searchParams);

  // Use cursor-based pagination
  // We use `site.id` as the default cursor since it's unique and indexed
  const paginatedResult = await paginateCursor(
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
      SyncLog: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    }
  );

  const competitors = paginatedResult.data;

  // Fetch total user products count once for accurate comparison
  const totalUserProducts = await prisma.product.count({
    where: {
      tenantId,
      Site: { type: "USER" }
    }
  });

  const formattedCompetitors = await Promise.all(competitors
    .map(async (site: any) => {
      try {
        let name = "Unknown";
        try {
          const urlObj = new URL(
            site.baseUrl.startsWith("http")
              ? site.baseUrl
              : `https://${site.baseUrl}`,
          );
          const hostname = urlObj.hostname;
          const cleanHostname = hostname.replace(/^www\./, "");
          const parts = cleanHostname.split(".");
          const rawName = parts.length > 1 ? parts[0] : cleanHostname;
          name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        } catch (e) {
          console.error(
            `Invalid baseUrl for site ${site.id}: ${site.baseUrl}`,
          );
        }

        // Calculate count of UNIQUE user products that have at least one match on THIS competitor site
        const matchedUserProductsCount = await prisma.product.count({
          where: {
            tenantId,
            Site: { type: 'USER' },
            matchesAsUser: {
              some: {
                competitorProduct: { siteId: site.id }
              }
            }
          }
        });

        return {
          id: site.id,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          url: site.baseUrl,
          products: matchedUserProductsCount, // Shows how many of OUR products have matches
          totalScraped: site._count.Product, // Keep total count for internal reference if needed
          status: site.isSyncing
            ? "SYNCING"
            : matchedUserProductsCount > 0
              ? "ACTIVE"
              : site.lastSyncAt
                ? "NO MATCHES"
                : "PENDING",
          health: totalUserProducts > 0
            ? Math.round((matchedUserProductsCount / totalUserProducts) * 100)
            : 0,
          isSyncing: site.isSyncing,
          syncTotal: site.syncTotal,
          syncProcessed: site.syncProcessed,
          syncLastAction: site.syncLastAction,
          syncStartedAt: site.syncStartedAt,
          totalUserProducts: totalUserProducts,
          isAdvancedProtected: site.isAdvancedProtected || false,
          searchQueryPattern: site.searchQueryPattern,
          logs: site.SyncLog || [],
        };
      } catch (e) {
        console.error(`Error formatting site ${site.id}:`, e);
        return null;
      }
    }));

  return NextResponse.json({
    competitors: formattedCompetitors.filter(Boolean),
    pagination: paginatedResult.pagination,
  });
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
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

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

  // Trigger auto-fetch immediately in background (with slight delay for DB propagation)
  setTimeout(() => {
    // Pass true to force sync even though isSyncing is already true
    SyncOrchestrator.processSiteSync(site.id, true).catch((error) => {
      console.error(
        `[API] Auto-fetch failed for new site ${site.id}:`,
        error,
      );
    });
  }, 500);

  return NextResponse.json(site);
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
  return withRequestContextAndRateLimit(req, "read", withErrorHandling(handleGET));
}

export async function POST(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", withErrorHandling(handlePOST));
}

export async function DELETE(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "write", withErrorHandling(handleDELETE));
}
