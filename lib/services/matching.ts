import { prisma } from "@/lib/prisma";
import { MatchType } from "@prisma/client";

export class MatchingService {
  /**
   * Run matching logic for a specific tenant
   */
  static async runMatching(tenantId: string) {
    // 1. Get all user products that don't have matches yet
    const userProducts = await prisma.product.findMany({
      where: {
        tenantId,
        site: { type: "USER" },
        matchesAsUser: { none: {} },
      },
    });

    // 2. Get all competitor products for this tenant
    const competitorProducts = await prisma.product.findMany({
      where: {
        tenantId,
        site: { type: "COMPETITOR" },
      },
    });

    const matchesCreated = [];

    for (const up of userProducts) {
      // Pass 1: SKU Match
      if (up.sku) {
        const skuMatch = competitorProducts.find(cp => cp.sku === up.sku);
        if (skuMatch) {
          matchesCreated.push(await this.createMatch(up.id, skuMatch.id, "AUTO_SKU", 1.0));
          continue;
        }
      }

      // Pass 2: Brand + Model Match
      if (up.brand && up.model) {
        const modelMatch = competitorProducts.find(
          cp => cp.brand?.toLowerCase() === up.brand?.toLowerCase() &&
                cp.model?.toLowerCase() === up.model?.toLowerCase()
        );
        if (modelMatch) {
          matchesCreated.push(await this.createMatch(up.id, modelMatch.id, "AUTO_MODEL", 0.9));
          continue;
        }
      }

      // Pass 3: Fuzzy Title (Very simple mock for now)
      const fuzzyMatch = competitorProducts.find(
        cp => cp.title.toLowerCase().includes(up.title.toLowerCase()) ||
              up.title.toLowerCase().includes(cp.title.toLowerCase())
      );
      if (fuzzyMatch) {
        matchesCreated.push(await this.createMatch(up.id, fuzzyMatch.id, "AUTO_MODEL", 0.7));
      }
    }

    return {
      totalMatches: matchesCreated.length,
    };
  }

  private static async createMatch(
    userId: string,
    competitorId: string,
    type: MatchType,
    score: number
  ) {
    return prisma.productMatch.create({
      data: {
        userProductId: userId,
        competitorProductId: competitorId,
        matchType: type,
        confidenceScore: score,
      },
    });
  }
}
