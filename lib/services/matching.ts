import { prisma } from "@/lib/prisma";
import { MatchType } from "@prisma/client";
import { compareTwoStrings } from "string-similarity";
import { SystemConfigService } from "@/lib/config";

interface LiteProduct {
  id: string;
  sku: string | null;
  brand: string | null;
  model: string | null;
  title: string;
}

/**
 * Advanced Product Matching Service
 * Uses multi-pass strategy: SKU → Brand/Model → Semantic Similarity
 */
export class MatchingService {
  // These will be loaded dynamically in runMatching
  private static SIMILARITY_THRESHOLD = 0.65;
  private static HIGH_CONFIDENCE = 0.9;
  private static MEDIUM_CONFIDENCE = 0.75;


  // Common e-commerce noise to strip during matching
  private static readonly NOISE_WORDS = [
    "new",
    "hot",
    "deal",
    "cheap",
    "best",
    "sale",
    "official",
    "original",
    "fast",
    "shipping",
    "free",
    "discount",
    "promo",
  ];

  private static readonly COLORS = [
    "red",
    "blue",
    "green",
    "black",
    "white",
    "yellow",
    "orange",
    "purple",
    "grey",
    "gray",
    "silver",
    "gold",
    "pink",
    "navy",
    "maroon",
  ];

  /**
   * Run matching logic for a specific tenant
   */
  static async runMatching(tenantId: string) {
    // Load dynamic thresholds
    this.SIMILARITY_THRESHOLD = await SystemConfigService.get("MATCHING_SIMILARITY_THRESHOLD", 0.65);
    this.HIGH_CONFIDENCE = 0.9; // We keep these as internal logic constants unless requested otherwise
    this.MEDIUM_CONFIDENCE = 0.75;

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
      const match = await this.findBestMatch(
        up as LiteProduct,
        competitorProducts as LiteProduct[],
      );

      if (match) {
        matchesCreated.push(
          await this.createMatch(
            up.id,
            match.product.id,
            match.type,
            match.confidence,
          ),
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
    userProduct: LiteProduct,
    competitorProducts: LiteProduct[],
  ): Promise<{
    product: LiteProduct;
    type: MatchType;
    confidence: number;
  } | null> {
    // Pass 1: Exact SKU Match (Highest Confidence)
    const userSku = userProduct.sku;
    if (userSku) {
      const skuMatch = competitorProducts.find(
        (cp) => cp.sku && cp.sku.toLowerCase() === userSku.toLowerCase(),
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
          cp.model?.toLowerCase() === userProduct.model?.toLowerCase(),
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
  private static calculateTitleSimilarity(
    title1: string,
    title2: string,
  ): number {
    const normalized1 = this.normalizeTitle(title1);
    const normalized2 = this.normalizeTitle(title2);

    const words1 = new Set(normalized1.split(" "));
    const words2 = new Set(normalized2.split(" "));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    const wordScore = intersection.size / union.size;

    // 2. String similarity score (Dice's Coefficient)
    const diceScore = compareTwoStrings(normalized1, normalized2);

    // 3. Weighted average (Dice is better for typos, Jaccard better for word-set matches)
    return wordScore * 0.4 + diceScore * 0.6;
  }

  /**
   * Normalize product title for comparison
   */
  private static normalizeTitle(title: string): string {
    let cleaned = title
      .toLowerCase()
      .replace(/[^\w\s]/g, " ") // Replace punctuation with space
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    // Strip common noise words and colors
    const words = cleaned.split(" ").filter((word) => {
      return !this.NOISE_WORDS.includes(word) && !this.COLORS.includes(word);
    });

    return words.join(" ");
  }

  /**
   * Create a product match record
   */
  private static async createMatch(
    userId: string,
    competitorId: string,
    type: MatchType,
    score: number,
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
        competitorProducts,
      );

      if (
        betterMatch &&
        betterMatch.confidence > parseFloat(match.confidenceScore.toString())
      ) {
        await this.createMatch(
          match.userProduct.id,
          betterMatch.product.id,
          betterMatch.type,
          betterMatch.confidence,
        );
      }
    }
  }
}
