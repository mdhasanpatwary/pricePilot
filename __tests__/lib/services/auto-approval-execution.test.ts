import { AutoApprovalService } from "@/lib/services/auto-approval";
import { prisma } from "@/lib/prisma";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
    prisma: {
        pendingPriceChange: {
            findMany: jest.fn(),
            update: jest.fn(),
        },
        autoApprovalRule: {
            findMany: jest.fn(),
        },
        product: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        priceHistory: {
            create: jest.fn(),
        },
        tenantAuditLog: {
            create: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

describe("AutoApprovalService - Execution Logic", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("processAutoApprovals", () => {
        it("should process pending changes and return count of auto-approved changes", async () => {
            const tenantId = "tenant-123";
            const ruleId = "rule-123";
            const ruleName = "Test Rule";

            // Mock pending changes
            const pendingChanges = [
                {
                    id: "change-1",
                    productId: "product-1",
                    tenantId,
                    currentPrice: 100,
                    recommendedPrice: 95,
                    reason: "Competitor price lower",
                    appliedRule: "UNDERCUT",
                    status: "PENDING",
                    createdAt: new Date(),
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    product: {
                        id: "product-1",
                        title: "Test Product",
                        sku: "TEST-001",
                        currentPrice: 100,
                        category: "Electronics",
                        matchesAsUser: [
                            {
                                confidenceScore: 95,
                                competitorProduct: {
                                    currentPrice: 90,
                                },
                            },
                        ],
                    },
                },
            ];

            // Mock rules
            const rules = [
                {
                    id: ruleId,
                    name: ruleName,
                    tenantId,
                    enabled: true,
                    priority: 1,
                    conditions: {
                        maxPriceChange: 10,
                    },
                },
            ];

            (prisma.pendingPriceChange.findMany as jest.Mock).mockResolvedValue(
                pendingChanges
            );
            (prisma.autoApprovalRule.findMany as jest.Mock).mockResolvedValue(rules);
            (prisma.product.findUnique as jest.Mock).mockResolvedValue(
                pendingChanges[0].product
            );

            // Mock transaction
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                const tx = {
                    pendingPriceChange: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                    product: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                    priceHistory: {
                        create: jest.fn().mockResolvedValue({}),
                    },
                    tenantAuditLog: {
                        create: jest.fn().mockResolvedValue({}),
                    },
                };
                return callback(tx);
            });

            const count = await AutoApprovalService.processAutoApprovals(tenantId);

            expect(count).toBe(1);
            expect(prisma.pendingPriceChange.findMany).toHaveBeenCalledWith({
                where: {
                    tenantId,
                    status: "PENDING",
                },
                include: {
                    product: {
                        include: {
                            matchesAsUser: {
                                include: {
                                    competitorProduct: true,
                                },
                            },
                        },
                    },
                },
            });
        });

        it("should return 0 when no pending changes exist", async () => {
            const tenantId = "tenant-123";

            (prisma.pendingPriceChange.findMany as jest.Mock).mockResolvedValue([]);

            const count = await AutoApprovalService.processAutoApprovals(tenantId);

            expect(count).toBe(0);
        });

        it("should skip changes that don't match any rules", async () => {
            const tenantId = "tenant-123";

            const pendingChanges = [
                {
                    id: "change-1",
                    productId: "product-1",
                    tenantId,
                    currentPrice: 100,
                    recommendedPrice: 50, // Large change that won't match
                    reason: "Competitor price lower",
                    appliedRule: "UNDERCUT",
                    status: "PENDING",
                    createdAt: new Date(),
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    product: {
                        id: "product-1",
                        title: "Test Product",
                        sku: "TEST-001",
                        currentPrice: 100,
                        category: "Electronics",
                        matchesAsUser: [
                            {
                                confidenceScore: 95,
                                competitorProduct: {
                                    currentPrice: 50,
                                },
                            },
                        ],
                    },
                },
            ];

            const rules = [
                {
                    id: "rule-123",
                    name: "Small Changes Only",
                    tenantId,
                    enabled: true,
                    priority: 1,
                    conditions: {
                        maxPriceChange: 10, // Only allow changes up to $10
                    },
                },
            ];

            (prisma.pendingPriceChange.findMany as jest.Mock).mockResolvedValue(
                pendingChanges
            );
            (prisma.autoApprovalRule.findMany as jest.Mock).mockResolvedValue(rules);
            (prisma.product.findUnique as jest.Mock).mockResolvedValue(
                pendingChanges[0].product
            );

            const count = await AutoApprovalService.processAutoApprovals(tenantId);

            expect(count).toBe(0);
        });

        it("should continue processing other changes if one fails", async () => {
            const tenantId = "tenant-123";

            const pendingChanges = [
                {
                    id: "change-1",
                    productId: "product-1",
                    tenantId,
                    currentPrice: 100,
                    recommendedPrice: 95,
                    reason: "Competitor price lower",
                    appliedRule: "UNDERCUT",
                    status: "PENDING",
                    createdAt: new Date(),
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    product: {
                        id: "product-1",
                        title: "Test Product 1",
                        sku: "TEST-001",
                        currentPrice: 100,
                        category: "Electronics",
                        matchesAsUser: [
                            {
                                confidenceScore: 95,
                                competitorProduct: {
                                    currentPrice: 90,
                                },
                            },
                        ],
                    },
                },
                {
                    id: "change-2",
                    productId: "product-2",
                    tenantId,
                    currentPrice: 200,
                    recommendedPrice: 195,
                    reason: "Competitor price lower",
                    appliedRule: "UNDERCUT",
                    status: "PENDING",
                    createdAt: new Date(),
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    product: {
                        id: "product-2",
                        title: "Test Product 2",
                        sku: "TEST-002",
                        currentPrice: 200,
                        category: "Electronics",
                        matchesAsUser: [
                            {
                                confidenceScore: 95,
                                competitorProduct: {
                                    currentPrice: 190,
                                },
                            },
                        ],
                    },
                },
            ];

            const rules = [
                {
                    id: "rule-123",
                    name: "Test Rule",
                    tenantId,
                    enabled: true,
                    priority: 1,
                    conditions: {
                        maxPriceChange: 10,
                    },
                },
            ];

            (prisma.pendingPriceChange.findMany as jest.Mock).mockResolvedValue(
                pendingChanges
            );
            (prisma.autoApprovalRule.findMany as jest.Mock).mockResolvedValue(rules);
            (prisma.product.findUnique as jest.Mock).mockResolvedValue(
                pendingChanges[0].product
            );

            // Mock transaction to fail on first call, succeed on second
            let callCount = 0;
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                callCount++;
                if (callCount === 1) {
                    throw new Error("Transaction failed");
                }
                const tx = {
                    pendingPriceChange: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                    product: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                    priceHistory: {
                        create: jest.fn().mockResolvedValue({}),
                    },
                    tenantAuditLog: {
                        create: jest.fn().mockResolvedValue({}),
                    },
                };
                return callback(tx);
            });

            const count = await AutoApprovalService.processAutoApprovals(tenantId);

            // Should still process the second change even though first failed
            expect(count).toBe(1);
        });
    });
});
