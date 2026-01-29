import { cacheLayer } from "@/lib/services/cache-layer";
import { logger } from "@/lib/logger";

/**
 * Cache Invalidation Middleware
 * 
 * Hooks into database update operations to automatically invalidate
 * related cache entries, ensuring data consistency.
 * 
 * Requirements: 4.2, 4.3
 */

export interface InvalidationContext {
    tenantId: string;
    entityType: string;
    entityId: string;
    operation: "create" | "update" | "delete";
}

export class CacheInvalidationMiddleware {
    /**
     * Invalidate cache after product update
     * Requirement 4.2: Cache invalidation on updates
     */
    static async invalidateProduct(
        tenantId: string,
        productId: string
    ): Promise<void> {
        try {
            // Invalidate specific product caches
            await cacheLayer.invalidate(`tenant:${tenantId}:product:${productId}:*`);

            // Invalidate product comparison caches (they include this product)
            await cacheLayer.invalidate(`tenant:${tenantId}:product-comparison:*`);

            // Invalidate products list cache (new pattern)
            await cacheLayer.invalidate(`products:${tenantId}:*`);

            logger.debug("[CacheInvalidation] Product cache invalidated", {
                tenantId,
                productId,
            });
        } catch (error) {
            logger.error("[CacheInvalidation] Error invalidating product cache", {
                tenantId,
                productId,
                error,
            });
        }
    }

    /**
     * Invalidate cache after competitor product update
     * Requirement 4.2: Cache invalidation on updates
     */
    static async invalidateCompetitorProduct(
        competitorId: string
    ): Promise<void> {
        try {
            // Invalidate competitor product caches
            await cacheLayer.invalidate(`competitor:${competitorId}:*`);

            logger.debug("[CacheInvalidation] Competitor product cache invalidated", {
                competitorId,
            });
        } catch (error) {
            logger.error(
                "[CacheInvalidation] Error invalidating competitor product cache",
                {
                    competitorId,
                    error,
                }
            );
        }
    }

    /**
     * Invalidate cache after price update
     * Requirement 4.2: Cache invalidation on updates
     */
    static async invalidatePriceUpdate(
        tenantId: string,
        productId: string
    ): Promise<void> {
        try {
            // Invalidate product caches
            await this.invalidateProduct(tenantId, productId);

            // Invalidate price history caches
            await cacheLayer.invalidate(`product:${productId}:price-history:*`);

            logger.debug("[CacheInvalidation] Price update cache invalidated", {
                tenantId,
                productId,
            });
        } catch (error) {
            logger.error("[CacheInvalidation] Error invalidating price cache", {
                tenantId,
                productId,
                error,
            });
        }
    }

    /**
     * Invalidate cache after product match update
     * Requirement 4.2: Cache invalidation on updates
     */
    static async invalidateProductMatch(
        tenantId: string,
        userProductId: string,
        competitorProductId: string
    ): Promise<void> {
        try {
            // Invalidate user product caches
            await this.invalidateProduct(tenantId, userProductId);

            // Invalidate competitor product caches
            await this.invalidateCompetitorProduct(competitorProductId);

            logger.debug("[CacheInvalidation] Product match cache invalidated", {
                tenantId,
                userProductId,
                competitorProductId,
            });
        } catch (error) {
            logger.error("[CacheInvalidation] Error invalidating match cache", {
                tenantId,
                userProductId,
                competitorProductId,
                error,
            });
        }
    }

    /**
     * Invalidate all caches for a tenant
     * Useful for bulk operations or tenant-wide changes
     */
    static async invalidateTenant(tenantId: string): Promise<void> {
        try {
            // Invalidate all tenant-specific caches
            await cacheLayer.invalidate(`tenant:${tenantId}:*`);

            logger.info("[CacheInvalidation] Tenant cache invalidated", {
                tenantId,
            });
        } catch (error) {
            logger.error("[CacheInvalidation] Error invalidating tenant cache", {
                tenantId,
                error,
            });
        }
    }

    /**
     * Generic invalidation handler based on context
     * Requirement 4.2: Cache invalidation on updates
     */
    static async invalidate(context: InvalidationContext): Promise<void> {
        const { tenantId, entityType, entityId, operation } = context;

        try {
            switch (entityType) {
                case "user_product":
                    await this.invalidateProduct(tenantId, entityId);
                    break;

                case "competitor_product":
                    await this.invalidateCompetitorProduct(entityId);
                    break;

                case "price_update":
                    await this.invalidatePriceUpdate(tenantId, entityId);
                    break;

                case "product_match":
                    // For product matches, entityId should be in format "userProductId:competitorProductId"
                    const [userProductId, competitorProductId] = entityId.split(":");
                    await this.invalidateProductMatch(
                        tenantId,
                        userProductId,
                        competitorProductId
                    );
                    break;

                case "tenant":
                    await this.invalidateTenant(tenantId);
                    break;

                default:
                    logger.warn("[CacheInvalidation] Unknown entity type", {
                        entityType,
                        tenantId,
                        entityId,
                    });
            }

            logger.debug("[CacheInvalidation] Cache invalidated", {
                tenantId,
                entityType,
                entityId,
                operation,
            });
        } catch (error) {
            logger.error("[CacheInvalidation] Error in generic invalidation", {
                context,
                error,
            });
        }
    }

    /**
     * Batch invalidation for multiple entities
     * Useful for bulk operations
     */
    static async invalidateBatch(
        contexts: InvalidationContext[]
    ): Promise<void> {
        try {
            await Promise.all(contexts.map((context) => this.invalidate(context)));

            logger.info("[CacheInvalidation] Batch invalidation completed", {
                count: contexts.length,
            });
        } catch (error) {
            logger.error("[CacheInvalidation] Error in batch invalidation", {
                count: contexts.length,
                error,
            });
        }
    }
}

/**
 * Prisma middleware extension for automatic cache invalidation
 * 
 * Usage:
 * import { prisma } from '@/lib/prisma';
 * import { setupCacheInvalidation } from '@/lib/middleware/cache-invalidation';
 * 
 * setupCacheInvalidation(prisma);
 */
export function setupCacheInvalidation(prisma: any): void {
    prisma.$use(async (params: any, next: any) => {
        const result = await next(params);

        // Only invalidate on write operations
        if (
            params.action === "create" ||
            params.action === "update" ||
            params.action === "updateMany" ||
            params.action === "delete" ||
            params.action === "deleteMany"
        ) {
            // Extract tenant ID from where clause or data
            const tenantId =
                params.args?.where?.tenantId ||
                params.args?.data?.tenantId ||
                result?.tenantId;

            if (tenantId) {
                const context: InvalidationContext = {
                    tenantId,
                    entityType: params.model?.toLowerCase() || "unknown",
                    entityId: params.args?.where?.id || result?.id || "unknown",
                    operation:
                        params.action === "create"
                            ? "create"
                            : params.action === "delete" || params.action === "deleteMany"
                                ? "delete"
                                : "update",
                };

                // Fire and forget - don't block the database operation
                CacheInvalidationMiddleware.invalidate(context).catch((error) => {
                    logger.error("[CacheInvalidation] Middleware error", {
                        context,
                        error,
                    });
                });
            }
        }

        return result;
    });

    logger.info("[CacheInvalidation] Prisma middleware registered");
}
