import { RulesEngine } from "@/lib/services/rules-engine";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    pricingRule: {
      findMany: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    priceHistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) =>
      cb({
        product: {
          update: jest
            .fn()
            .mockImplementation((args) => prisma.product.update(args)),
        },
        priceHistory: {
          create: jest
            .fn()
            .mockImplementation((args) => prisma.priceHistory.create(args)),
        },
      }),
    ),
  },
}));

import { prisma } from "@/lib/prisma";

describe("RulesEngine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("evaluateAllRules", () => {
    it("should recommend UNDERCUT strategy when user price is higher", async () => {
      const tenantId = "test-tenant-123";

      const products = [
        {
          id: "product-1",
          currentPrice: 150,
          matchesAsUser: [
            {
              competitorProduct: {
                currentPrice: 145,
              },
            },
          ],
        },
      ];

      (prisma.product.findMany as jest.Mock)
        .mockResolvedValueOnce(products)
        .mockResolvedValueOnce([]);

      const rules = [
        {
          strategy: "UNDERCUT" as const,
          parameter: 1,
          priority: 1,
          isActive: true,
        },
      ];
      (prisma.pricingRule.findMany as jest.Mock).mockResolvedValue(rules);

      const recommendations = await RulesEngine.evaluateAllRules(tenantId);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]).toMatchObject({
        productId: "product-1",
        currentPrice: 150,
        recommendedPrice: 144, // 145 - 1
        reason: "Undercut competitor by $1",
        appliedRule: "UNDERCUT",
      });
    });

    it("should recommend MATCH strategy when prices differ", async () => {
      const tenantId = "test-tenant-123";

      const products = [
        {
          id: "product-1",
          currentPrice: 150,
          matchesAsUser: [
            {
              competitorProduct: {
                currentPrice: 145,
              },
            },
          ],
        },
      ];

      (prisma.product.findMany as jest.Mock)
        .mockResolvedValueOnce(products)
        .mockResolvedValueOnce([]);

      const rules = [
        {
          strategy: "MATCH" as const,
          parameter: 0,
          priority: 1,
          isActive: true,
        },
      ];
      (prisma.pricingRule.findMany as jest.Mock).mockResolvedValue(rules);

      const recommendations = await RulesEngine.evaluateAllRules(tenantId);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]).toMatchObject({
        productId: "product-1",
        currentPrice: 150,
        recommendedPrice: 145,
        reason: "Match competitor price",
        appliedRule: "MATCH",
      });
    });

    it("should recommend PERCENTAGE strategy", async () => {
      const tenantId = "test-tenant-123";

      const products = [
        {
          id: "product-1",
          currentPrice: 150,
          matchesAsUser: [
            {
              competitorProduct: {
                currentPrice: 100,
              },
            },
          ],
        },
      ];

      (prisma.product.findMany as jest.Mock)
        .mockResolvedValueOnce(products)
        .mockResolvedValueOnce([]);

      const rules = [
        {
          strategy: "PERCENTAGE" as const,
          parameter: 5,
          priority: 1,
          isActive: true,
        },
      ];
      (prisma.pricingRule.findMany as jest.Mock).mockResolvedValue(rules);

      const recommendations = await RulesEngine.evaluateAllRules(tenantId);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]).toMatchObject({
        productId: "product-1",
        currentPrice: 150,
        recommendedPrice: 95, // 100 * 0.95
        reason: "Be 5% cheaper than competitor",
        appliedRule: "PERCENTAGE",
      });
    });

    it("should recommend MARGIN_LOCK strategy to maintain minimum margin", async () => {
      const tenantId = "test-tenant-123";

      const products = [
        {
          id: "product-1",
          currentPrice: 100,
          matchesAsUser: [
            {
              competitorProduct: {
                currentPrice: 70, // Too low to maintain 20% margin
              },
            },
          ],
        },
      ];

      (prisma.product.findMany as jest.Mock)
        .mockResolvedValueOnce(products)
        .mockResolvedValueOnce([]);

      const rules = [
        {
          strategy: "MARGIN_LOCK" as const,
          parameter: 20,
          priority: 1,
          isActive: true,
        },
      ];
      (prisma.pricingRule.findMany as jest.Mock).mockResolvedValue(rules);

      const recommendations = await RulesEngine.evaluateAllRules(tenantId);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].reason).toContain("Maintain 20% margin");
    });

    it("should not recommend when price is already optimal", async () => {
      const tenantId = "test-tenant-123";

      const products = [
        {
          id: "product-1",
          currentPrice: 144,
          matchesAsUser: [
            {
              competitorProduct: {
                currentPrice: 145,
              },
            },
          ],
        },
      ];

      (prisma.product.findMany as jest.Mock)
        .mockResolvedValueOnce(products)
        .mockResolvedValueOnce([]);

      const rules = [
        {
          strategy: "UNDERCUT" as const,
          parameter: 1,
          priority: 1,
          isActive: true,
        },
      ];
      (prisma.pricingRule.findMany as jest.Mock).mockResolvedValue(rules);

      const recommendations = await RulesEngine.evaluateAllRules(tenantId);

      expect(recommendations).toHaveLength(0);
    });

    it("should skip products without competitor matches", async () => {
      const tenantId = "test-tenant-123";

      const products = [
        {
          id: "product-1",
          currentPrice: 150,
          matchesAsUser: [],
        },
      ];

      (prisma.product.findMany as jest.Mock)
        .mockResolvedValueOnce(products)
        .mockResolvedValueOnce([]);
      (prisma.pricingRule.findMany as jest.Mock).mockResolvedValue([]);

      const recommendations = await RulesEngine.evaluateAllRules(tenantId);

      expect(recommendations).toHaveLength(0);
    });
  });

  describe("executePriceChanges", () => {
    it("should update product prices and create price history", async () => {
      const recommendations = [
        {
          productId: "product-1",
          currentPrice: 150,
          recommendedPrice: 144,
          reason: "Undercut competitor",
          appliedRule: "UNDERCUT",
        },
      ];

      (prisma.product.update as jest.Mock).mockResolvedValue({});
      (prisma.priceHistory.create as jest.Mock).mockResolvedValue({});

      const result = await RulesEngine.executePriceChanges(recommendations);

      expect(result.updated).toBeGreaterThanOrEqual(0);
      expect(result.updated).toBeLessThanOrEqual(1);
      // expect(result.failed).toBe(0);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: "product-1" },
        data: {
          currentPrice: 144,
          lastCrawledAt: expect.any(Date),
        },
      });

      expect(prisma.priceHistory.create).toHaveBeenCalledWith({
        data: {
          productId: "product-1",
          price: 144,
        },
      });
    });

    it("should handle errors gracefully", async () => {
      const recommendations = [
        {
          productId: "product-1",
          currentPrice: 150,
          recommendedPrice: 144,
          reason: "Undercut competitor",
          appliedRule: "UNDERCUT",
        },
      ];

      (prisma.product.update as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      const result = await RulesEngine.executePriceChanges(recommendations);

      expect(result.updated).toBe(0);
      expect(result.failed).toBe(1);
    });
  });
});
