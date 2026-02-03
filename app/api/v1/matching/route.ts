import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { withRateLimit } from "@/lib/middleware/ratelimit";
import {
  validateBody,
  validationErrorResponse,
  matchApprovalSchema,
} from "@/lib/validation";
import { recordAuditLog, getIpAddress } from "@/lib/audit";
import { CacheInvalidationService } from "@/lib/services/cache-invalidation";
import { sanitizeProductMatch } from "@/lib/middleware/sanitize-response";

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get("q") || "";

  try {
    // Optimized: Query ProductMatch directly instead of fetching all Products
    // This allows efficient filtering and avoids loading the entire catalog
    const matches = await prisma.productMatch.findMany({
      where: {
        status: "PENDING",
        userProduct: {
          tenantId: tenantId, // Ensure tenancy scope
        },
        OR: q
          ? [
            // Use insensitive search for various fields
            { userProduct: { title: { contains: q, mode: "insensitive" } } },
            { userProduct: { sku: { contains: q, mode: "insensitive" } } },
            { competitorProduct: { title: { contains: q, mode: "insensitive" } } },
            { competitorProduct: { sku: { contains: q, mode: "insensitive" } } },
            // Search by competitor site name (through relation)
            { competitorProduct: { site: { baseUrl: { contains: q, mode: "insensitive" } } } },
          ]
          : undefined,
      },
      include: {
        userProduct: {
          include: { site: true },
        },
        competitorProduct: {
          include: { site: true },
        },
      },
      orderBy: {
        confidenceScore: "desc", // Show high confidence matches first
      },
      take: 100, // Limit results for performance
    });

    const formattedMatches = matches.map((m) => {
      let siteName = "Unknown";
      try {
        siteName = m.competitorProduct.site.baseUrl
          ? new URL(m.competitorProduct.site.baseUrl).hostname.replace(
            "www.",
            "",
          )
          : "Unknown";
      } catch (e) { }

      return {
        id: m.id,
        confidence: parseFloat(m.confidenceScore.toString()),
        matchType: m.matchType,
        status: m.status,
        product: {
          id: m.userProduct.id,
          title: m.userProduct.title,
          sku: m.userProduct.sku,
          price: parseFloat(m.userProduct.currentPrice.toString()),
          url: m.userProduct.url,
          image: (m.userProduct as any).imageUrl,
          site: m.userProduct.site.baseUrl,
        },
        competitor: {
          id: m.competitorProduct.id,
          title: m.competitorProduct.title,
          sku: m.competitorProduct.sku,
          price: parseFloat(m.competitorProduct.currentPrice.toString()),
          url: m.competitorProduct.url || m.competitorProduct.site.baseUrl,
          image: (m.competitorProduct as any).imageUrl,
          site: m.competitorProduct.site.baseUrl,
          siteName,
        },
      };
    });

    // Sanitize product matches to prevent XSS attacks
    // Requirement 2.7.3: XSS prevention for competitor product data
    const sanitizedMatches = formattedMatches.map(sanitizeProductMatch);

    return NextResponse.json(sanitizedMatches);
  } catch (error) {
    console.error("Match fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 },
    );
  }
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const validation = await validateBody(req, matchApprovalSchema);
    if (!validation.success) {
      return validationErrorResponse(validation);
    }
    const { matchId, action } = validation.data!;
    console.log(`[MATCHING_POST] Action: ${action} for ID: ${matchId}`);
    console.log(
      `[MATCHING_POST] Session User:`,
      JSON.stringify(session.user, null, 2),
    );

    // Fetch match info for audit log
    const matchInfo = await prisma.productMatch.findUnique({
      where: { id: matchId },
      include: {
        userProduct: { select: { id: true, title: true } },
        competitorProduct: { select: { title: true } },
      },
    });

    if (action === "APPROVE") {
      await prisma.productMatch.update({
        where: { id: matchId },
        data: { status: "APPROVED" },
      });
    } else if (action === "REJECT") {
      await prisma.productMatch.update({
        where: { id: matchId },
        data: { status: "REJECTED" },
      });
    }

    // Invalidate cache after match approval/rejection
    // Requirement 2.3: Match update invalidation
    if (matchInfo) {
      try {
        const cacheInvalidation = new CacheInvalidationService();
        await cacheInvalidation.onMatchUpdate(
          session.user.tenantId,
          matchInfo.userProduct.id
        );
      } catch (cacheError) {
        // Log cache invalidation error but don't fail the operation
        console.error('[MatchingRoute] Cache invalidation failed:', cacheError);
      }
    }

    // Create Audit Log
    console.log(`[MATCHING_POST] Recording audit log...`);
    const userId = session.user.id || (session.user as any).sub;

    if (!userId) {
      console.error(
        `[MATCHING_POST] CRITICAL: Cannot record audit log because userId is missing from session!`,
        JSON.stringify(session.user, null, 2),
      );
    } else {
      await recordAuditLog({
        tenantId: session.user.tenantId,
        userId: userId,
        userEmail: session.user.email!,
        action: `${action}_MATCH`,
        entityId: matchId,
        ipAddress: getIpAddress(req),
        details: {
          matchId,
          action,
          productTitle: matchInfo?.userProduct?.title,
          competitorTitle: matchInfo?.competitorProduct?.title,
        },
      });
      console.log(`[MATCHING_POST] Audit log sequence finished.`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MATCHING_POST] Error:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, "read", handleGET);
}

export async function POST(req: NextRequest) {
  return withRateLimit(req, "write", handlePOST);
}
