import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import {
  adminDomainHealthQuerySchema,
  validateQuery,
  validationErrorResponse,
} from "@/lib/validation";
import { Prisma } from "@prisma/client";

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

    const parsed = validateQuery(request, adminDomainHealthQuerySchema);
    if (!parsed.success) return validationErrorResponse(parsed);

    const { timeRange, limit, offset } = parsed.data!;
    const startTime = getStartTime(timeRange);

    // Normalize baseUrl -> domain: strip scheme, path, and leading www.
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
        failureCount: bigint;
        blockCount: bigint;
        avgResponseTimeMs: number | null;
        lastStructureChangeAt: Date | null;
      }>
    >(Prisma.sql`
      WITH attempts AS (
        SELECT
          ${domainExpr} AS domain,
          a."success" AS success,
          a."failureType" AS "failureType",
          a."protectionDetected" AS "protectionDetected",
          a."responseTimeMs" AS "responseTimeMs",
          a."createdAt" AS "createdAt"
        FROM "ScrapeAttempt" a
        JOIN "Site" s ON s.id = a."competitorWebsiteId"
        WHERE a."createdAt" >= ${startTime}
      )
      SELECT
        att.domain AS domain,
        COUNT(*)::bigint AS "totalAttempts",
        SUM(CASE WHEN att.success THEN 1 ELSE 0 END)::bigint AS "successCount",
        SUM(CASE WHEN NOT att.success THEN 1 ELSE 0 END)::bigint AS "failureCount",
        SUM(CASE WHEN (att."protectionDetected" = TRUE OR att."failureType" = 'BOT_BLOCKED') THEN 1 ELSE 0 END)::bigint AS "blockCount",
        AVG(att."responseTimeMs")::double precision AS "avgResponseTimeMs",
        COALESCE(
          df."lastChangedAt",
          MAX(CASE WHEN att."failureType" = 'STRUCTURE_CHANGED' THEN att."createdAt" ELSE NULL END)
        ) AS "lastStructureChangeAt"
      FROM attempts att
      LEFT JOIN "DomainFingerprint" df ON df."domain" = att.domain
      GROUP BY att.domain, df."lastChangedAt"
      ORDER BY "totalAttempts" DESC, att.domain ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const domains = rows.map((r) => r.domain);

    const failures = domains.length
      ? await prisma.$queryRaw<
          Array<{ domain: string; failureType: string | null; count: bigint }>
        >(Prisma.sql`
          WITH attempts AS (
            SELECT
              ${domainExpr} AS domain,
              a."success" AS success,
              a."failureType" AS "failureType"
            FROM "ScrapeAttempt" a
            JOIN "Site" s ON s.id = a."competitorWebsiteId"
            WHERE a."createdAt" >= ${startTime}
          )
          SELECT
            att.domain AS domain,
            att."failureType"::text AS "failureType",
            COUNT(*)::bigint AS count
          FROM attempts att
          WHERE att.success = FALSE
            AND att.domain IN (${Prisma.join(domains)})
          GROUP BY att.domain, att."failureType"
          ORDER BY count DESC
        `)
      : [];

    const failureByDomain: Record<string, Array<{ failureType: string; count: number }>> =
      {};
    for (const f of failures) {
      const ft = (f.failureType || "UNKNOWN").toString();
      const count = Number(f.count);
      (failureByDomain[f.domain] ||= []).push({ failureType: ft, count });
    }

    const data = rows.map((r) => {
      const total = Number(r.totalAttempts);
      const success = Number(r.successCount);
      const block = Number(r.blockCount);
      const failureCountNum = Number(r.failureCount);
      const failureBreakdown = (failureByDomain[r.domain] || [])
        .sort((a, b) => b.count - a.count)
        .map((x) => ({
          failureType: x.failureType,
          count: x.count,
          pctOfFailures:
            Number.isFinite(total) && total > 0 && failureCountNum > 0
              ? Math.round((x.count / failureCountNum) * 1000) / 10
              : 0,
        }));

      return {
        domain: r.domain,
        totalAttempts: total,
        successRatePct: total > 0 ? Math.round((success / total) * 1000) / 10 : 0,
        blockRatePct: total > 0 ? Math.round((block / total) * 1000) / 10 : 0,
        avgResponseTimeMs: r.avgResponseTimeMs ? Math.round(r.avgResponseTimeMs) : null,
        lastStructureChangeAt: r.lastStructureChangeAt,
        failureBreakdown,
      };
    });

    const totalDistinct = await prisma.$queryRaw<
      Array<{ total: bigint }>
    >(Prisma.sql`
      SELECT COUNT(DISTINCT ${domainExpr})::bigint AS total
      FROM "ScrapeAttempt" a
      JOIN "Site" s ON s.id = a."competitorWebsiteId"
      WHERE a."createdAt" >= ${startTime}
    `);

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
    console.error("[Admin Domain Health API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch domain health metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", handleGET);
}
