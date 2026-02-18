import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import {
  adminScrapeCostQuerySchema,
  validateQuery,
  validationErrorResponse,
} from "@/lib/validation";

type TimeRange = "24h" | "7d" | "30d";

function getStartTime(timeRange: TimeRange): Date {
  const now = new Date();
  const start = new Date(now);
  if (timeRange === "24h") start.setHours(now.getHours() - 24);
  else if (timeRange === "7d") start.setDate(now.getDate() - 7);
  else start.setDate(now.getDate() - 30);
  return start;
}

async function handleGET(request: NextRequest) {
  try {
    const session = await getCachedSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const isAdmin = user.role === "ADMIN" || user.isSuperAdmin === true;
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 401 },
      );
    }

    const parsed = validateQuery(request, adminScrapeCostQuerySchema);
    if (!parsed.success) return validationErrorResponse(parsed);

    const { timeRange, limit, offset } = parsed.data!;
    const startTime = getStartTime(timeRange);

    const domainExpr = Prisma.sql`
      regexp_replace(
        split_part(regexp_replace(s."baseUrl", '^https?://', ''), '/', 1),
        '^www\\.',
        ''
      )
    `;

    const rows = await prisma.$queryRaw<
      Array<{
        domain: string;
        totalAttempts: bigint;
        successCount: bigint;
        proxyUsedAttempts: bigint;
        retryAttempts: bigint;
        contextCreations: bigint;
        avgResponseTimeMs: number | null;
        totalResponseTimeMs: number | null;
      }>
    >(Prisma.sql`
      WITH attempts AS (
        SELECT
          ${domainExpr} AS domain,
          a."success" AS success,
          a."proxyId" AS "proxyId",
          a."attemptNumber" AS "attemptNumber",
          a."contextCreated" AS "contextCreated",
          a."responseTimeMs" AS "responseTimeMs"
        FROM "ScrapeAttempt" a
        JOIN "Site" s ON s.id = a."competitorWebsiteId"
        WHERE a."createdAt" >= ${startTime}
      )
      SELECT
        att.domain AS domain,
        COUNT(*)::bigint AS "totalAttempts",
        SUM(CASE WHEN att.success THEN 1 ELSE 0 END)::bigint AS "successCount",
        SUM(CASE WHEN att."proxyId" IS NOT NULL THEN 1 ELSE 0 END)::bigint AS "proxyUsedAttempts",
        SUM(CASE WHEN att."attemptNumber" > 1 THEN 1 ELSE 0 END)::bigint AS "retryAttempts",
        SUM(CASE WHEN att."contextCreated" = TRUE THEN 1 ELSE 0 END)::bigint AS "contextCreations",
        AVG(att."responseTimeMs")::double precision AS "avgResponseTimeMs",
        SUM(COALESCE(att."responseTimeMs", 0))::double precision AS "totalResponseTimeMs"
      FROM attempts att
      GROUP BY att.domain
      ORDER BY "totalAttempts" DESC, att.domain ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const data = rows.map((r) => {
      const totalAttempts = Number(r.totalAttempts);
      const successCount = Number(r.successCount);
      const proxyUsedAttempts = Number(r.proxyUsedAttempts);
      const retryAttempts = Number(r.retryAttempts);
      const contextCreations = Number(r.contextCreations);
      const totalResponseTimeMs = r.totalResponseTimeMs ? Math.round(r.totalResponseTimeMs) : 0;

      const successRatePct =
        totalAttempts > 0 ? Math.round((successCount / totalAttempts) * 1000) / 10 : 0;
      const proxyUsageRatePct =
        totalAttempts > 0 ? Math.round((proxyUsedAttempts / totalAttempts) * 1000) / 10 : 0;
      const retryRatePct =
        totalAttempts > 0 ? Math.round((retryAttempts / totalAttempts) * 1000) / 10 : 0;
      const contextCreationRatePct =
        totalAttempts > 0 ? Math.round((contextCreations / totalAttempts) * 1000) / 10 : 0;

      return {
        domain: r.domain,
        totalAttempts,
        successCount,
        successRatePct,
        avgTimeMs: r.avgResponseTimeMs ? Math.round(r.avgResponseTimeMs) : null,
        proxyUsageRatePct,
        retryRatePct,
        contextCreationRatePct,
        costPerSuccessfulScrape: {
          timeMs: successCount > 0 ? Math.round(totalResponseTimeMs / successCount) : null,
          attempts: successCount > 0 ? Math.round((totalAttempts / successCount) * 100) / 100 : null,
          retries: successCount > 0 ? Math.round((retryAttempts / successCount) * 100) / 100 : null,
          proxyAttempts:
            successCount > 0
              ? Math.round((proxyUsedAttempts / successCount) * 100) / 100
              : null,
          contextCreations:
            successCount > 0
              ? Math.round((contextCreations / successCount) * 100) / 100
              : null,
        },
      };
    });

    const totalDistinct = await prisma.$queryRaw<Array<{ total: bigint }>>(
      Prisma.sql`
        SELECT COUNT(DISTINCT ${domainExpr})::bigint AS total
        FROM "ScrapeAttempt" a
        JOIN "Site" s ON s.id = a."competitorWebsiteId"
        WHERE a."createdAt" >= ${startTime}
      `,
    );

    const total =
      totalDistinct[0]?.total !== undefined ? Number(totalDistinct[0].total) : 0;

    return NextResponse.json({
      success: true,
      data: {
        domains: data,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        timeRange,
      },
    });
  } catch (error) {
    console.error("[Admin Scrape Cost API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch scrape cost metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", handleGET);
}

