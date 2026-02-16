import { prisma } from "@/lib/prisma";
import { MatchType } from "@prisma/client";
import { compareTwoStrings } from "string-similarity";
import { SystemConfigService } from "@/lib/config";
import { ValidationError, NotFoundError, AppError } from "@/lib/utils/error-handler";
import { CacheEnhancedService } from "./cache-enhanced";
import { logger } from "@/lib/logger";

interface LiteProduct {
  id: string;
  sku: string | null;
  brand: string | null;
  model: string | null;
  title: string;
  specifications?: any;
}

// Synonyms map for tech jargon normalization
const TECH_SYNONYMS: Record<string, string> = {
  "generation": "gen",
  "notebook": "laptop",
  "wireless": "bt",
  "bluetooth": "bt",
  "memory": "ram",
  "storage": "rom",
  "cellular": "4g",
  "lte": "4g",
  "pro max": "promax", // remove space for easier matching
  "ultra hd": "4k",
  "uhd": "4k",
};

interface MatchingIndices {
  skuMap: Map<string, LiteProduct>;
  modelMap: Map<string, LiteProduct>; // brand:model -> product
  productsByBrand: Map<string, LiteProduct[]>; // brand -> products list
  allProducts: LiteProduct[];
}

/**
 * Advanced Product Matching Service
 * Uses multi-pass strategy: SKU → Brand/Model → Semantic Similarity
 *
 * Integrated with CacheEnhancedService for performance optimization
 * Requirements: 1.1, 1.6
 */
export class MatchingService {
  // Tweakable constants
  private static SIMILARITY_THRESHOLD = 0.65;
  private static HIGH_CONFIDENCE = 0.9;
  private static MEDIUM_CONFIDENCE = 0.75;
  private static BATCH_SIZE = 50; // Process user products in small batches

  // Cache service instance
  private static cacheService: CacheEnhancedService;

  // TTL for matching operations
  // Requirement 2.9.4: Cache competitor products with 1 hour TTL
  private static readonly MATCHING_TTL = 900; // 15 minutes for match results



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
   * Initialize cache service
   * Requirement 1.1: Cache infrastructure integration
   */
  private static initializeCacheService(): void {
    if (!this.cacheService) {
      this.cacheService = new CacheEnhancedService();
    }
  }

  /**
   * Run matching logic for a specific tenant
   * Integrated with caching for performance optimization
   * Requirement 1.1: Cache infrastructure integration
   * Requirement 1.6: Graceful degradation on cache failure
   */
  static async runMatching(tenantId: string) {
    try {
      // Initialize cache service
      this.initializeCacheService();

      // Validate input
      if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
        throw new ValidationError(
          'Invalid matching request',
          { tenantId: ['Tenant ID is required and must be a valid string'] },
          { context: { operation: 'runMatching' } }
        );
      }

      // Try to get cached result
      try {
        const cacheKey = `runMatching:${tenantId}`;
        const cached = await this.cacheService.getCachedMatches(tenantId, cacheKey);
        if (cached) {
          logger.debug('[MatchingService] Returning cached matching result', { tenantId });
          return cached;
        }
      } catch (cacheError) {
        // Log cache error but continue with database query
        // Requirement 1.6: Graceful degradation
        logger.warn('[MatchingService] Cache read failed, falling back to database', {
          tenantId,
          error: cacheError
        });
      }

      // Load dynamic thresholds
      this.SIMILARITY_THRESHOLD = await SystemConfigService.get("MATCHING_SIMILARITY_THRESHOLD", 0.65);
      this.HIGH_CONFIDENCE = 0.9; // We keep these as internal logic constants unless requested otherwise
      this.MEDIUM_CONFIDENCE = 0.75;

      // 1. Get all competitor products (Reference Catalog)
      // We load these into memory to build indices. Assuming specific tenant catalog < 50k items.
      const competitorProducts = await prisma.product.findMany({
        where: {
          tenantId,
          Site: { type: "COMPETITOR" },
        },
      });

      // Build Blocking Indices (O(M))
      const indices = this.buildIndices(competitorProducts as LiteProduct[]);

      const matchesCreated = [];
      let processedCount = 0;
      let totalProcessed = 0;

      // 2. Process User Products in Batches (O(N) with batched DB access)
      while (true) {
        const userProducts = await prisma.product.findMany({
          where: {
            tenantId,
            Site: { type: "USER" },
            matchesAsUser: { none: {} },
          },
          take: this.BATCH_SIZE,
          skip: processedCount,
        });

        if (userProducts.length === 0) break;

        const matchesToCreate: Array<{
          userProductId: string;
          competitorProductId: string;
          matchType: MatchType;
          confidenceScore: number;
        }> = [];

        for (const up of userProducts) {
          const match = await this.findBestMatch(
            up as LiteProduct,
            indices,
            tenantId,
          );

          if (match) {
            matchesToCreate.push({
              userProductId: up.id,
              competitorProductId: match.product.id,
              matchType: match.type,
              confidenceScore: match.confidence,
            });
          }
        }

        // Batch persist matches
        if (matchesToCreate.length > 0) {
          const created = await prisma.productMatch.createMany({
            data: matchesToCreate,
            skipDuplicates: true,
          });
          matchesCreated.push(...Array(created.count).fill(null));
        }

        processedCount += userProducts.length;
        totalProcessed += userProducts.length;

        // Yield to event loop to prevent blocking main thread
        await new Promise(resolve => setTimeout(resolve, 10));
      }


      const result = {
        totalMatches: matchesCreated.length,
        processed: totalProcessed
      };

      // Cache the result
      try {
        const cacheKey = `runMatching:${tenantId}`;
        await this.cacheService.cacheMatches(tenantId, cacheKey, result, this.MATCHING_TTL);
      } catch (cacheError) {
        // Log cache error but don't fail the operation
        logger.warn('[MatchingService] Cache write failed', {
          tenantId,
          error: cacheError
        });
      }

      return result;
    } catch (error) {
      // If already an AppError, re-throw with additional context
      if (error instanceof AppError) {
        error.context.tenantId = error.context.tenantId || tenantId;
        error.context.operation = error.context.operation || 'runMatching';
        throw error;
      }

      // Wrap unexpected errors
      throw new AppError(
        'Unexpected error during product matching',
        500,
        'MATCHING_ERROR',
        {
          cause: error as Error,
          context: { tenantId, operation: 'runMatching' }
        }
      );
    }
  }

  /**
   * Find the best match for a user product
   * Integrated with caching for performance optimization
   * Requirement 1.1: Cache infrastructure integration
   * Requirement 1.6: Graceful degradation on cache failure
   */
  private static async findBestMatch(
    userProduct: LiteProduct,
    indices: MatchingIndices,
    tenantId: string,
  ): Promise<{
    product: LiteProduct;
    type: MatchType;
    confidence: number;
  } | null> {
    try {
      // Validate user product
      if (!userProduct || !userProduct.id) {
        throw new ValidationError(
          'Invalid user product for matching',
          { userProduct: ['User product must have a valid ID'] },
          {
            context: {
              tenantId,
              operation: 'findBestMatch',
              metadata: { userProductId: userProduct?.id }
            }
          }
        );
      }

      // Validate competitor products indices (basic check)
      if (!indices || !indices.allProducts) {
        throw new ValidationError(
          'Invalid matching indices',
          { indices: ['Indices must be initialized'] },
          {
            context: {
              tenantId,
              operation: 'findBestMatch',
              metadata: { userProductId: userProduct.id }
            }
          }
        );
      }

      // Try to get cached match result
      try {
        const cached = await this.cacheService.getCachedMatches(tenantId, userProduct.id);
        if (cached) {
          logger.debug('[MatchingService] Returning cached match', {
            tenantId,
            productId: userProduct.id
          });
          return cached as any;
        }
      } catch (cacheError) {
        // Log cache error but continue with matching logic
        // Requirement 1.6: Graceful degradation
        logger.warn('[MatchingService] Cache read failed for findBestMatch, continuing with matching', {
          tenantId,
          productId: userProduct.id,
          error: cacheError
        });
      }

      // Perform matching logic
      const matchResult = await this.performMatching(userProduct, indices, tenantId);

      // Cache the result if found
      if (matchResult) {
        try {
          await this.cacheService.cacheMatches(
            tenantId,
            userProduct.id,
            matchResult,
            this.MATCHING_TTL
          );
        } catch (cacheError) {
          // Log cache error but don't fail the operation
          // Requirement 1.6: Graceful degradation
          logger.warn('[MatchingService] Cache write failed for findBestMatch', {
            tenantId,
            productId: userProduct.id,
            error: cacheError
          });
        }
      }

      return matchResult;
    } catch (error) {
      // If already an AppError, re-throw with additional context
      if (error instanceof AppError) {
        error.context.tenantId = error.context.tenantId || tenantId;
        error.context.operation = error.context.operation || 'findBestMatch';
        error.context.metadata = {
          ...error.context.metadata,
          userProductId: userProduct?.id,
        };
        throw error;
      }

      // Wrap unexpected errors
      throw new AppError(
        'Unexpected error finding product match',
        500,
        'MATCHING_ERROR',
        {
          cause: error as Error,
          context: {
            tenantId,
            operation: 'findBestMatch',
            metadata: { userProductId: userProduct?.id }
          }
        }
      );
    }
  }

  /**
   * Build blocking indices for O(1) lookups
   */
  private static buildIndices(products: LiteProduct[]): MatchingIndices {
    const indices: MatchingIndices = {
      skuMap: new Map(),
      modelMap: new Map(),
      productsByBrand: new Map(),
      allProducts: products
    };

    for (const p of products) {
      // SKU Map
      if (p.sku) {
        indices.skuMap.set(p.sku.toLowerCase(), p);
      }

      // Brand+Model Map
      if (p.brand && p.model) {
        const key = `${p.brand.toLowerCase()}:${p.model.toLowerCase()}`;
        indices.modelMap.set(key, p);
      }

      // Brand Map (Blocking for fuzzy search)
      if (p.brand) {
        const brandKey = p.brand.toLowerCase();
        if (!indices.productsByBrand.has(brandKey)) {
          indices.productsByBrand.set(brandKey, []);
        }
        indices.productsByBrand.get(brandKey)!.push(p);
      }
    }

    return indices;
  }

  /**
   * Perform the actual matching logic (extracted from findBestMatch)
   * This method contains the core matching algorithm
   */
  private static async performMatching(
    userProduct: LiteProduct,
    indices: MatchingIndices,
    tenantId: string,
  ): Promise<{
    product: LiteProduct;
    type: MatchType;
    confidence: number;
  } | null> {
    try {

      // Pass 1: Exact SKU Match (O(1) Lookup)
      const userSku = userProduct.sku;
      if (userSku) {
        const skuMatch = indices.skuMap.get(userSku.toLowerCase());
        if (skuMatch) {
          return {
            product: skuMatch,
            type: "AUTO_SKU",
            confidence: 1.0,
          };
        }
      }

      // Pass 2: Brand + Model Match (O(1) Lookup)
      if (userProduct.brand && userProduct.model) {
        const key = `${userProduct.brand.toLowerCase()}:${userProduct.model.toLowerCase()}`;
        const modelMatch = indices.modelMap.get(key);
        if (modelMatch) {
          return {
            product: modelMatch,
            type: "AUTO_MODEL",
            confidence: this.HIGH_CONFIDENCE,
          };
        }
      }

      // Prepare Candidates for Fuzzy Matching (Blocking Strategy)
      // If user product has a brand, ONLY compare with products of same brand (Blocking)
      // If no brand, fallback to all products (Expensive, but necessary if data is poor)
      let candidates = indices.allProducts;
      if (userProduct.brand) {
        const brandKey = userProduct.brand.toLowerCase();
        if (indices.productsByBrand.has(brandKey)) {
          candidates = indices.productsByBrand.get(brandKey)!;
        }
      }

      // Pass 1.5: Regex-based Model Pattern Match
      const userModel = this.extractModelNumber(userProduct.title);
      if (userModel) {
        const regexMatch = candidates.find((cp) => {
          const cpModel = this.extractModelNumber(cp.title);
          return cpModel && cpModel === userModel && userModel.length > 3;
        });

        if (regexMatch) {
          return {
            product: regexMatch,
            type: "AUTO_MODEL",
            confidence: 0.95,
          };
        }
      }

      // Pass 1.8: Specification Match
      if (userProduct.specifications) {
        const bestSpecMatch = candidates
          .map((cp) => ({
            product: cp,
            score: this.compareSpecifications(userProduct, cp),
          }))
          .filter((m) => m.score > 0.8)
          .sort((a, b) => b.score - a.score)[0];

        if (bestSpecMatch) {
          return {
            product: bestSpecMatch.product,
            type: "AUTO_MODEL",
            confidence: 0.85 + (bestSpecMatch.score * 0.1),
          };
        }
      }

      // Pass 3: Semantic Title Similarity (Levenshtein Distance)
      const titleMatches = candidates
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
    } catch (error) {
      // Wrap unexpected errors in performMatching
      throw new AppError(
        'Unexpected error in matching algorithm',
        500,
        'MATCHING_ERROR',
        {
          cause: error as Error,
          context: {
            tenantId,
            operation: 'performMatching',
            metadata: { userProductId: userProduct?.id }
          }
        }
      );
    }
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
    }).map(word => TECH_SYNONYMS[word] || word);

    return words.join(" ");
  }

  /**
   * Compare technical specifications between two products
   * Returns a score between 0 and 1
   */
  private static compareSpecifications(p1: LiteProduct, p2: LiteProduct): number {
    if (!p1.specifications || !p2.specifications) return 0;

    // Normalize to simple key-value maps
    const s1 = typeof p1.specifications === 'string' ? JSON.parse(p1.specifications) : p1.specifications;
    const s2 = typeof p2.specifications === 'string' ? JSON.parse(p2.specifications) : p2.specifications;

    if (!s1 || !s2) return 0;

    let matches = 0;
    let comparisons = 0;

    // Critical Tech Keys to compare
    const keys = ['ram', 'memory', 'storage', 'capacity', 'color', 'processor', 'cpu', 'gpu'];

    for (const key of keys) {
      // Find matching keys in both objects (fuzzy key search)
      const v1 = this.findValueByKey(s1, key);
      const v2 = this.findValueByKey(s2, key);

      if (v1 && v2) {
        comparisons++;
        // Simple inclusion/equality check
        if (this.fuzzyValueMatch(v1, v2)) {
          matches++;
        } else {
          // If critical specs differ (e.g. 8GB vs 16GB), huge penalty
          matches -= 2;
        }
      }
    }

    if (comparisons === 0) return 0;

    // Return score. Note: matches can be negative, floor at 0.
    return Math.max(0, matches / comparisons);
  }

  // Helper to find value by fuzzy key
  private static findValueByKey(specs: any, searchKey: string): string | null {
    const foundKey = Object.keys(specs).find(k => k.toLowerCase().includes(searchKey));
    return foundKey ? String(specs[foundKey]) : null;
  }

  // Helper for value matching (e.g. "8GB" == "8 GB")
  private static fuzzyValueMatch(v1: string, v2: string): boolean {
    const n1 = v1.toLowerCase().replace(/\s/g, '');
    const n2 = v2.toLowerCase().replace(/\s/g, '');
    return n1.includes(n2) || n2.includes(n1);
  }

  /**
   * Extract model number pattern key from title
   * Matches patterns like: KRS-82, G304, S23-Ultra, iPhone 15
   */
  private static extractModelNumber(title: string): string | null {
    // 1. Alphanumeric with hyphen (Tech style: A4TECH-KRS-82, KRS-83)
    const techRegex = /\b[A-Z0-9]{2,}-[A-Z0-9]{2,}\b/i;
    const match1 = title.match(techRegex);
    if (match1) return match1[0].toUpperCase();

    // 2. Standalone alphanumeric model codes (common in GPUs, Phones: RTX4090, S24)
    // Avoids strictly numeric (sizes) or pure alpha (words) unless mixed
    const modelCodeRegex = /\b(?=[A-Z]+[0-9]|[0-9]+[A-Z])[A-Z0-9]{4,}\b/i;
    const match2 = title.match(modelCodeRegex);
    if (match2) return match2[0].toUpperCase();

    return null;
  }

  /**
   * Create a product match record
   */
  private static async createMatch(
    userId: string,
    competitorId: string,
    type: MatchType,
    score: number,
    tenantId: string,
  ) {
    try {
      // Validate input
      if (!userId || typeof userId !== 'string') {
        throw new ValidationError(
          'Invalid user product ID',
          { userId: ['User product ID is required and must be a valid string'] },
          { context: { tenantId, operation: 'createMatch' } }
        );
      }

      if (!competitorId || typeof competitorId !== 'string') {
        throw new ValidationError(
          'Invalid competitor product ID',
          { competitorId: ['Competitor product ID is required and must be a valid string'] },
          { context: { tenantId, operation: 'createMatch' } }
        );
      }

      // Verify user product exists
      const userProduct = await prisma.product.findUnique({
        where: { id: userId },
      });

      if (!userProduct) {
        throw new NotFoundError(
          'Product',
          userId,
          {
            context: {
              tenantId,
              operation: 'createMatch',
              metadata: { productType: 'user' }
            }
          }
        );
      }

      // Verify competitor product exists
      const competitorProduct = await prisma.product.findUnique({
        where: { id: competitorId },
      });

      if (!competitorProduct) {
        throw new NotFoundError(
          'Product',
          competitorId,
          {
            context: {
              tenantId,
              operation: 'createMatch',
              metadata: { productType: 'competitor' }
            }
          }
        );
      }

      return prisma.productMatch.create({
        data: {
          userProductId: userId,
          competitorProductId: competitorId,
          matchType: type,
          confidenceScore: score,
        },
      });
    } catch (error) {
      // If already an AppError, re-throw with additional context
      if (error instanceof AppError) {
        error.context.tenantId = error.context.tenantId || tenantId;
        error.context.operation = error.context.operation || 'createMatch';
        error.context.metadata = {
          ...error.context.metadata,
          userProductId: userId,
          competitorProductId: competitorId,
        };
        throw error;
      }

      // Wrap unexpected errors
      throw new AppError(
        'Unexpected error creating product match',
        500,
        'MATCHING_ERROR',
        {
          cause: error as Error,
          context: {
            tenantId,
            operation: 'createMatch',
            metadata: { userProductId: userId, competitorProductId: competitorId }
          }
        }
      );
    }
  }

  /**
   * Re-run matching for products with low confidence scores
   */
  static async refreshLowConfidenceMatches(tenantId: string) {
    try {
      // Validate input
      if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
        throw new ValidationError(
          'Invalid refresh request',
          { tenantId: ['Tenant ID is required and must be a valid string'] },
          { context: { operation: 'refreshLowConfidenceMatches' } }
        );
      }

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

      // Pre-load reference catalog and build indices once
      const competitorProducts = await prisma.product.findMany({
        where: {
          tenantId,
          Site: { type: "COMPETITOR" },
        },
      });

      const indices = this.buildIndices(competitorProducts as LiteProduct[]);

      for (const match of lowConfidenceMatches) {
        // Delete old low-confidence match
        await prisma.productMatch.delete({ where: { id: match.id } });

        // Try to find a better match
        const betterMatch = await this.findBestMatch(
          match.userProduct,
          indices,
          tenantId,
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
            tenantId,
          );
        }
      }
    } catch (error) {
      // If already an AppError, re-throw with additional context
      if (error instanceof AppError) {
        error.context.tenantId = error.context.tenantId || tenantId;
        error.context.operation = error.context.operation || 'refreshLowConfidenceMatches';
        throw error;
      }

      // Wrap unexpected errors
      throw new AppError(
        'Unexpected error refreshing low confidence matches',
        500,
        'MATCHING_ERROR',
        {
          cause: error as Error,
          context: { tenantId, operation: 'refreshLowConfidenceMatches' }
        }
      );
    }
  }
}
