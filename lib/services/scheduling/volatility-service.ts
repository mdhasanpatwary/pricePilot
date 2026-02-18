import { prisma } from "@/lib/prisma";

export type VolatilitySnapshot = {
  volatilityScore: number;
  lastPriceChangeAt: Date | null;
  priceChangeCount30d: number;
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export class VolatilityService {
  /**
   * Compute 30d price-change volatility for a product from PriceHistory.
   *
   * Definition:
   * - A "price change" is when a PriceHistory.price differs from the previous recorded price.
   * - volatilityScore is a smooth function of change-count (higher frequency => higher score).
   */
  static async computeFromPriceHistory(productId: string): Promise<VolatilitySnapshot> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows = await prisma.$queryRaw<
      Array<{
        price_change_count_30d: bigint;
        last_price_change_at: Date | null;
      }>
    >`
      WITH ordered AS (
        SELECT
          "recordedAt",
          "price",
          LAG("price") OVER (ORDER BY "recordedAt") AS prev_price
        FROM "PriceHistory"
        WHERE "productId" = ${productId}
          AND "recordedAt" >= ${since}
      ),
      diffs AS (
        SELECT
          "recordedAt",
          CASE
            WHEN prev_price IS NULL THEN 0
            WHEN "price" IS DISTINCT FROM prev_price THEN 1
            ELSE 0
          END AS changed
        FROM ordered
      )
      SELECT
        SUM(changed)::bigint AS price_change_count_30d,
        MAX(CASE WHEN changed = 1 THEN "recordedAt" ELSE NULL END) AS last_price_change_at
      FROM diffs;
    `;

    const changeCount = rows[0]?.price_change_count_30d
      ? Number(rows[0].price_change_count_30d)
      : 0;
    const lastPriceChangeAt = rows[0]?.last_price_change_at ?? null;

    // Smoothly map counts -> [0,1].
    // 0 changes => 0
    // ~3 changes => ~0.65
    // >=10 changes => ~0.97
    const score = clamp01(1 - Math.exp(-0.35 * Math.max(0, changeCount)));

    return {
      volatilityScore: score,
      lastPriceChangeAt,
      priceChangeCount30d: Math.max(0, Math.floor(changeCount)),
    };
  }

  static async upsertForProduct(productId: string): Promise<VolatilitySnapshot> {
    const computed = await this.computeFromPriceHistory(productId);

    await prisma.productVolatility.upsert({
      where: { productId },
      create: {
        productId,
        volatilityScore: computed.volatilityScore,
        lastPriceChangeAt: computed.lastPriceChangeAt ?? undefined,
        priceChangeCount30d: computed.priceChangeCount30d,
      },
      update: {
        volatilityScore: computed.volatilityScore,
        lastPriceChangeAt: computed.lastPriceChangeAt ?? undefined,
        priceChangeCount30d: computed.priceChangeCount30d,
      },
      select: { id: true },
    });

    return computed;
  }
}

