import { CacheInvalidationMiddleware } from "@/lib/middleware/cache-invalidation";
import { cacheLayer } from "@/lib/services/cache-layer";

// Mock dependencies
jest.mock("@/lib/services/cache-layer");
jest.mock("@/lib/logger");

describe("CacheInvalidationMiddleware", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("invalidateProduct() - Requirement 4.2", () => {
        it("should invalidate product and comparison caches", async () => {
            (cacheLayer.invalidate as jest.Mock).mockResolvedValue(2);

            await CacheInvalidationMiddleware.invalidateProduct(
                "tenant-123",
                "product-456"
            );

            expect(cacheLayer.invalidate).toHaveBeenCalledWith(
                "tenant:tenant-123:product:product-456:*"
            );
            expect(cacheLayer.invalidate).toHaveBeenCalledWith(
                "tenant:tenant-123:product-comparison:*"
            );
        });

        it("should handle errors gracefully", async () => {
            (cacheLayer.invalidate as jest.Mock).mockRejectedValue(
                new Error("Redis error")
            );

            await expect(
                CacheInvalidationMiddleware.invalidateProduct("tenant-123", "product-456")
            ).resolves.not.toThrow();
        });
    });

    describe("invalidateCompetitorProduct() - Requirement 4.2", () => {
        it("should invalidate competitor product caches", async () => {
            (cacheLayer.invalidate as jest.Mock).mockResolvedValue(1);

            await CacheInvalidationMiddleware.invalidateCompetitorProduct(
                "competitor-789"
            );

            expect(cacheLayer.invalidate).toHaveBeenCalledWith(
                "competitor:competitor-789:*"
            );
        });

        it("should handle errors gracefully", async () => {
            (cacheLayer.invalidate as jest.Mock).mockRejectedValue(
                new Error("Redis error")
            );

            await expect(
                CacheInvalidationMiddleware.invalidateCompetitorProduct("competitor-789")
            ).resolves.not.toThrow();
        });
    });

    describe("invalidatePriceUpdate() - Requirement 4.2", () => {
        it("should invalidate product and price history caches", async () => {
            (cacheLayer.invalidate as jest.Mock).mockResolvedValue(1);

            await CacheInvalidationMiddleware.invalidatePriceUpdate(
                "tenant-123",
                "product-456"
            );

            expect(cacheLayer.invalidate).toHaveBeenCalledWith(
                "tenant:tenant-123:product:product-456:*"
            );
            expect(cacheLayer.invalidate).toHaveBeenCalledWith(
                "tenant:tenant-123:product-comparison:*"
            );
            expect(cacheLayer.invalidate).toHaveBeenCalledWith(
                "product:product-456:price-history:*"
            );
        });

        it("should handle errors gracefully", async () => {
            (cacheLayer.invalidate as jest.Mock).mockRejectedValue(
                new Error("Redis error")
            );

            await expect(
                CacheInvalidationMiddleware.invalidatePriceUpdate(
                    "tenant-123",
                    "product-456"
                )
            ).resolves.not.toThrow();
        });
    });

    describe("invalidateProductMatch() - Requirement 4.2", () => {
        it("should invalidate user and competitor product caches", async () => {
            (cacheLayer.invalidate as jest.Mock).mockResolvedValue(1);

            await CacheInvalidationMiddleware.invalidateProductMatch(
                "tenant-123",
                "user-product-456",
                "competitor-product-789"
            );

            expect(cacheLayer.invalidate).toHaveBeenCalledWith(
                "tenant:tenant-123:product:user-product-456:*"
            );
            expect(cacheLayer.invalidate).toHaveBeenCalledWith(
                "tenant:tenant-123:product-comparison:*"
            );
            expect(cacheLayer.invalidate).toHaveBeenCalledWith(
                "competitor:competitor-product-789:*"
            );
        });

        it("should handle errors gracefully", async () => {
            (cacheLayer.invalidate as jest.Mock).mockRejectedValue(
                new Error("Redis error")
            );

            await expect(
                CacheInvalidationMiddleware.invalidateProductMatch(
                    "tenant-123",
                    "user-product-456",
                    "competitor-product-789"
                )
            ).resolves.not.toThrow();
        });
    });

    describe("invalidateTenant()", () => {
        it("should invalidate all tenant caches", async () => {
            (cacheLayer.invalidate as jest.Mock).mockResolvedValue(10);

            await CacheInvalidationMiddleware.invalidateTenant("tenant-123");

            expect(cacheLayer.invalidate).toHaveBeenCalledWith("tenant:tenant-123:*");
        });

        it("should handle errors gracefully", async () => {
            (cacheLayer.invalidate as jest.Mock).mockRejectedValue(
                new Error("Redis error")
            );

            await expect(
                CacheInvalidationMiddleware.invalidateTenant("tenant-123")
            ).resolves.not.toThrow();
        });
    });

    describe("invalidate() - Generic Handler", () => {
        it("should handle user_product entity type", async () => {
            (cacheLayer.invalidate as jest.Mock).mockResolvedValue(1);

            await CacheInvalidationMiddleware.invalidate({
                tenantId: "tenant-123",
                entityType: "user_product",
                entityId: "product-456",
                operation: "update",
            });

            expect(cacheLayer.invalidate).toHaveBeenCalledWith(
                "tenant:tenant-123:product:product-456:*"
            );
        });

        it("should handle competitor_product entity type", async () => {
            (cacheLayer.invalidate as jest.Mock).mockResolvedValue(1);

            await CacheInvalidationMiddleware.invalidate({
                tenantId: "tenant-123",
                entityType: "competitor_product",
                entityId: "competitor-789",
                operation: "update",
            });

            expect(cacheLayer.invalidate).toHaveBeenCalledWith(
                "competitor:competitor-789:*"
            );
        });

        it("should handle price_update entity type", async () => {
            (cacheLayer.invalidate as jest.Mock).mockResolvedValue(1);

            await CacheInvalidationMiddleware.invalidate({
                tenantId: "tenant-123",
                entityType: "price_update",
                entityId: "product-456",
                operation: "create",
            });

            expect(cacheLayer.invalidate).toHaveBeenCalledWith(
                "tenant:tenant-123:product:product-456:*"
            );
        });

        it("should handle product_match entity type", async () => {
            (cacheLayer.invalidate as jest.Mock).mockResolvedValue(1);

            await CacheInvalidationMiddleware.invalidate({
                tenantId: "tenant-123",
                entityType: "product_match",
                entityId: "user-456:competitor-789",
                operation: "create",
            });

            expect(cacheLayer.invalidate).toHaveBeenCalledWith(
                "tenant:tenant-123:product:user-456:*"
            );
            expect(cacheLayer.invalidate).toHaveBeenCalledWith(
                "competitor:competitor-789:*"
            );
        });

        it("should handle tenant entity type", async () => {
            (cacheLayer.invalidate as jest.Mock).mockResolvedValue(10);

            await CacheInvalidationMiddleware.invalidate({
                tenantId: "tenant-123",
                entityType: "tenant",
                entityId: "tenant-123",
                operation: "update",
            });

            expect(cacheLayer.invalidate).toHaveBeenCalledWith("tenant:tenant-123:*");
        });

        it("should handle unknown entity type gracefully", async () => {
            await expect(
                CacheInvalidationMiddleware.invalidate({
                    tenantId: "tenant-123",
                    entityType: "unknown_type",
                    entityId: "entity-123",
                    operation: "update",
                })
            ).resolves.not.toThrow();
        });

        it("should handle errors gracefully", async () => {
            (cacheLayer.invalidate as jest.Mock).mockRejectedValue(
                new Error("Redis error")
            );

            await expect(
                CacheInvalidationMiddleware.invalidate({
                    tenantId: "tenant-123",
                    entityType: "user_product",
                    entityId: "product-456",
                    operation: "update",
                })
            ).resolves.not.toThrow();
        });
    });

    describe("invalidateBatch()", () => {
        it("should invalidate multiple entities", async () => {
            (cacheLayer.invalidate as jest.Mock).mockResolvedValue(1);

            const contexts = [
                {
                    tenantId: "tenant-123",
                    entityType: "user_product",
                    entityId: "product-1",
                    operation: "update" as const,
                },
                {
                    tenantId: "tenant-123",
                    entityType: "user_product",
                    entityId: "product-2",
                    operation: "update" as const,
                },
                {
                    tenantId: "tenant-123",
                    entityType: "competitor_product",
                    entityId: "competitor-1",
                    operation: "update" as const,
                },
            ];

            await CacheInvalidationMiddleware.invalidateBatch(contexts);

            // Should call invalidate for each context
            // 2 user products * 2 calls each (product + comparison) + 1 competitor * 1 call = 5 calls
            expect(cacheLayer.invalidate).toHaveBeenCalledTimes(5);
        });

        it("should handle errors in batch gracefully", async () => {
            (cacheLayer.invalidate as jest.Mock).mockRejectedValue(
                new Error("Redis error")
            );

            const contexts = [
                {
                    tenantId: "tenant-123",
                    entityType: "user_product",
                    entityId: "product-1",
                    operation: "update" as const,
                },
            ];

            await expect(
                CacheInvalidationMiddleware.invalidateBatch(contexts)
            ).resolves.not.toThrow();
        });
    });
});
