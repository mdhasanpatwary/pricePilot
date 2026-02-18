import { prisma } from "@/lib/prisma";
import { ScrapingStrategy } from "./strategy-selector";

type StrategyRow = {
  strategy: string;
  total: bigint;
  successes: bigint;
  avg_execution_ms: number | null;
  last_used_at: Date | null;
};

export class StrategyPerformanceService {
  // Keep it bounded so a single refresh can't scan unbounded history.
  static readonly DEFAULT_WINDOW_HOURS = 24 * 7;

  static async refreshForSite(options: {
    tenantId: string;
    competitorWebsiteId: string;
    windowHours?: number;
  }): Promise<void> {
    const windowHours = options.windowHours ?? this.DEFAULT_WINDOW_HOURS;
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const rows = await prisma.$queryRaw<Array<StrategyRow>>`
      SELECT
        "strategy" AS strategy,
        COUNT(*)::bigint AS total,
        SUM(CASE WHEN "success" THEN 1 ELSE 0 END)::bigint AS successes,
        AVG(COALESCE("responseTimeMs", 0))::float8 AS avg_execution_ms,
        MAX("createdAt") AS last_used_at
      FROM "ScrapeAttempt"
      WHERE "tenantId" = ${options.tenantId}
        AND "competitorWebsiteId" = ${options.competitorWebsiteId}
        AND "createdAt" >= ${since}
      GROUP BY "strategy";
    `;

    if (rows.length === 0) return;

    for (const row of rows) {
      const total = Number(row.total);
      const successes = Number(row.successes);
      const successRate = total > 0 ? successes / total : 0;
      const avgExecutionTimeMs = Math.max(0, Math.round(row.avg_execution_ms ?? 0));

      await prisma.strategyPerformance.upsert({
        where: {
          tenantId_competitorWebsiteId_strategyType: {
            tenantId: options.tenantId,
            competitorWebsiteId: options.competitorWebsiteId,
            strategyType: row.strategy,
          },
        },
        create: {
          tenantId: options.tenantId,
          competitorWebsiteId: options.competitorWebsiteId,
          strategyType: row.strategy,
          successRate,
          avgExecutionTimeMs,
          lastUsedAt: row.last_used_at,
        },
        update: {
          successRate,
          avgExecutionTimeMs,
          lastUsedAt: row.last_used_at,
        },
      });
    }
  }

  static async getRankedStrategies(options: {
    tenantId: string;
    competitorWebsiteId: string;
    limit?: number;
  }): Promise<ScrapingStrategy[]> {
    const limit = Math.min(Math.max(options.limit ?? 5, 1), 10);

    const rows = await prisma.strategyPerformance.findMany({
      where: {
        tenantId: options.tenantId,
        competitorWebsiteId: options.competitorWebsiteId,
      },
      orderBy: [
        { successRate: "desc" },
        { avgExecutionTimeMs: "asc" },
        { lastUsedAt: "desc" },
      ],
      take: limit,
      select: {
        strategyType: true,
      },
    });

    return rows
      .map((r) => r.strategyType)
      .filter((s): s is ScrapingStrategy => Object.values(ScrapingStrategy).includes(s as any))
      .map((s) => s as ScrapingStrategy);
  }
}

