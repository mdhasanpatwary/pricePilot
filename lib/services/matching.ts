import { prisma } from "@/lib/prisma";
import { MatchType } from "@prisma/client";
import { compareTwoStrings } from "string-similarity";

/**
 * Advanced Product Matching Service
 * Uses multi-pass strategy: SKU → Brand/Model → Semantic Similarity
 */
export class MatchingService {
  private static readonly SIMILARITY_THRESHOLD = 0.65; // 65% similarity required
  private static readonly HIGH_CONFIDENCE = 0.9;
  private static readonly MEDIUM_CONFIDENCE = 0.75;
  private static readonly LOW_CONFIDENCE = 0.6;

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
      const match = await this.findBestMatch(up, competitorProducts);

      if (match) {
        matchesCreated.push(
          await this.createMatch(
            up.id,
            match.product.id,
            match.type,
            match.confidence
          )
        );
      }
    }

    return {
      totalMatches: matchesCreated.length,
    };
  }

  /**
   * Find the best match for a user product
   */
  private static async findBestMatch(
    userProduct: any,
    competitorProducts: any[]
  ): Promise<{ product: any; type: MatchType; confidence: number } | null> {
    // Pass 1: Exact SKU Match (Highest Confidence)
    if (userProduct.sku) {
      const skuMatch = competitorProducts.find(
        (cp) => cp.sku && cp.sku.toLowerCase() === userProduct.sku.toLowerCase()
      );
      if (skuMatch) {
        return {
          product: skuMatch,
          type: "AUTO_SKU",
          confidence: 1.0,
        };
      }
    }

    // Pass 2: Brand + Model Match (High Confidence)
    if (userProduct.brand && userProduct.model) {
      const modelMatch = competitorProducts.find(
        (cp) =>
          cp.brand?.toLowerCase() === userProduct.brand?.toLowerCase() &&
          cp.model?.toLowerCase() === userProduct.model?.toLowerCase()
      );
      if (modelMatch) {
        return {
          product: modelMatch,
          type: "AUTO_MODEL",
          confidence: this.HIGH_CONFIDENCE,
        };
      }
    }

    // Pass 3: Semantic Title Similarity (Levenshtein Distance)
    const titleMatches = competitorProducts
      .map((cp) => ({
        product: cp,
        similarity: this.calculateTitleSimilarity(userProduct.title, cp.title),
      }))
      .filter((m) => m.similarity >= this.SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity);

    if (titleMatches.length > 0) {
      const bestMatch = titleMatches[0];
      return {
        product: bestMatch.product,
        type: "AUTO_MODEL",
        confidence: bestMatch.similarity,
      };
    }

    return null;
  }

  /**
   * Calculate title similarity using Levenshtein distance
   */
  private static calculateTitleSimilarity(title1: string, title2: string): number {
    const normalized1 = this.normalizeTitle(title1);
    const normalized2 = this.normalizeTitle(title2);

    return compareTwoStrings(normalized1, normalized2);
  }

  /**
   * Normalize product title for comparison
   */
  private static normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, "") // Remove special characters
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  /**
   * Create a product match record
   */
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

  /**
   * Re-run matching for products with low confidence scores
   */
  static async refreshLowConfidenceMatches(tenantId: string) {
    const lowConfidenceMatches = await prisma.productMatch.findMany({
      where: {
        userProduct: { tenantId },
        confidenceScore: { lt: this.MEDIUM_CONFIDENCE },
      },
      include: {
        userProduct: true,
        competitorProduct: true,
      },
    });

    for (const match of lowConfidenceMatches) {
      // Delete old low-confidence match
      await prisma.productMatch.delete({ where: { id: match.id } });

      // Try to find a better match
      const competitorProducts = await prisma.product.findMany({
        where: {
          tenantId,
          site: { type: "COMPETITOR" },
        },
      });

      const betterMatch = await this.findBestMatch(
        match.userProduct,
        competitorProducts
      );

      if (betterMatch && betterMatch.confidence > parseFloat(match.confidenceScore.toString())) {
        await this.createMatch(
          match.userProduct.id,
          betterMatch.product.id,
          betterMatch.type,
          betterMatch.confidence
        );
      }
    }
  }
}
