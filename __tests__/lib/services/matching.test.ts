import { MatchingService } from '@/lib/services/matching';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
    },
    productMatch: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    systemConfig: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

describe('MatchingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runMatching', () => {
    it('should match products by exact SKU', async () => {
      const tenantId = 'test-tenant-123';

      const userProducts = [
        {
          id: 'user-1',
          sku: 'NIKE-AM-270',
          title: 'Nike Air Max 270',
          brand: 'Nike',
          model: '270',
          currentPrice: 150,
        },
      ];

      const competitorProducts = [
        {
          id: 'comp-1',
          sku: 'NIKE-AM-270',
          title: 'Nike Air Max 270 Black',
          brand: 'Nike',
          model: '270',
          currentPrice: 145,
        },
      ];

      (prisma.product.findMany as jest.Mock)
        .mockResolvedValueOnce(userProducts)
        .mockResolvedValueOnce(competitorProducts);

      (prisma.productMatch.create as jest.Mock).mockResolvedValue({
        id: 'match-1',
        userProductId: 'user-1',
        competitorProductId: 'comp-1',
        matchType: 'AUTO_SKU',
        confidenceScore: 1.0,
      });

      const result = await MatchingService.runMatching(tenantId);

      expect(result.totalMatches).toBe(1);
      expect(prisma.productMatch.create).toHaveBeenCalledWith({
        data: {
          userProductId: 'user-1',
          competitorProductId: 'comp-1',
          matchType: 'AUTO_SKU',
          confidenceScore: 1.0,
        },
      });
    });

    it('should match products by brand and model', async () => {
      const tenantId = 'test-tenant-123';

      const userProducts = [
        {
          id: 'user-1',
          sku: null,
          title: 'Adidas Ultraboost 22',
          brand: 'Adidas',
          model: '22',
          currentPrice: 180,
        },
      ];

      const competitorProducts = [
        {
          id: 'comp-1',
          sku: 'AD-UB-22',
          title: 'Adidas Ultraboost 22 White',
          brand: 'Adidas',
          model: '22',
          currentPrice: 175,
        },
      ];

      (prisma.product.findMany as jest.Mock)
        .mockResolvedValueOnce(userProducts)
        .mockResolvedValueOnce(competitorProducts);

      (prisma.productMatch.create as jest.Mock).mockResolvedValue({
        id: 'match-1',
        userProductId: 'user-1',
        competitorProductId: 'comp-1',
        matchType: 'AUTO_MODEL',
        confidenceScore: 0.9,
      });

      const result = await MatchingService.runMatching(tenantId);

      expect(result.totalMatches).toBe(1);
      expect(prisma.productMatch.create).toHaveBeenCalledWith({
        data: {
          userProductId: 'user-1',
          competitorProductId: 'comp-1',
          matchType: 'AUTO_MODEL',
          confidenceScore: 0.9,
        },
      });
    });

    it('should match products by title similarity', async () => {
      const tenantId = 'test-tenant-123';

      const userProducts = [
        {
          id: 'user-1',
          sku: null,
          title: 'Nike Air Max 270 Black',
          brand: null,
          model: null,
          currentPrice: 150,
        },
      ];

      const competitorProducts = [
        {
          id: 'comp-1',
          sku: null,
          title: 'Nike Air Max 270 Black Edition',
          brand: null,
          model: null,
          currentPrice: 145,
        },
      ];

      (prisma.product.findMany as jest.Mock)
        .mockResolvedValueOnce(userProducts)
        .mockResolvedValueOnce(competitorProducts);

      (prisma.productMatch.create as jest.Mock).mockResolvedValue({
        id: 'match-1',
        userProductId: 'user-1',
        competitorProductId: 'comp-1',
        matchType: 'AUTO_MODEL',
        confidenceScore: expect.any(Number),
      });

      const result = await MatchingService.runMatching(tenantId);

      expect(result.totalMatches).toBe(1);
      expect(prisma.productMatch.create).toHaveBeenCalled();
    });

    it('should not match products with low similarity', async () => {
      const tenantId = 'test-tenant-123';

      const userProducts = [
        {
          id: 'user-1',
          sku: null,
          title: 'Nike Air Max 270',
          brand: null,
          model: null,
          currentPrice: 150,
        },
      ];

      const competitorProducts = [
        {
          id: 'comp-1',
          sku: null,
          title: 'Adidas Ultraboost 22',
          brand: null,
          model: null,
          currentPrice: 180,
        },
      ];

      (prisma.product.findMany as jest.Mock)
        .mockResolvedValueOnce(userProducts)
        .mockResolvedValueOnce(competitorProducts);

      const result = await MatchingService.runMatching(tenantId);

      expect(result.totalMatches).toBe(0);
      expect(prisma.productMatch.create).not.toHaveBeenCalled();
    });
  });

  describe('refreshLowConfidenceMatches', () => {
    it('should refresh matches with confidence below threshold', async () => {
      const tenantId = 'test-tenant-123';

      const lowConfidenceMatches = [
        {
          id: 'match-1',
          confidenceScore: 0.65,
          userProduct: {
            id: 'user-1',
            sku: 'NIKE-AM-270',
            title: 'Nike Air Max 270',
            brand: 'Nike',
            model: '270',
            currentPrice: 150,
          },
          competitorProduct: {
            id: 'comp-1',
            currentPrice: 145,
          },
        },
      ];

      const competitorProducts = [
        {
          id: 'comp-2',
          sku: 'NIKE-AM-270',
          title: 'Nike Air Max 270 Exact Match',
          brand: 'Nike',
          model: '270',
          currentPrice: 148,
        },
      ];

      (prisma.productMatch.findMany as jest.Mock).mockResolvedValue(lowConfidenceMatches);
      (prisma.productMatch.delete as jest.Mock).mockResolvedValue({});
      (prisma.product.findMany as jest.Mock).mockResolvedValue(competitorProducts);
      (prisma.productMatch.create as jest.Mock).mockResolvedValue({});

      await MatchingService.refreshLowConfidenceMatches(tenantId);

      expect(prisma.productMatch.delete).toHaveBeenCalledWith({
        where: { id: 'match-1' },
      });
      expect(prisma.productMatch.create).toHaveBeenCalled();
    });
  });
});
