import { AutoApprovalService } from "@/lib/services/auto-approval";
import { prisma } from "@/lib/prisma";
import { mailService } from "@/lib/mail";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
    prisma: {
        pendingPriceChange: {
            findMany: jest.fn(),
            update: jest.fn(),
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
        autoApprovalRule: {
            findMany: jest.fn(),
        },
        autoApprovalMetric: {
            upsert: jest.fn(),
            findMany: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

jest.mock("@/lib/mail", () => ({
    mailService: {
        sendAutoApprovalNotification: jest.fn(),
    },
}));

describe("AutoApprovalService - Metrics Tracking", () => {
    const mockTenantId = "tenant-123";
    const mockRuleId = "rule-123";
    const mockRuleName = "Test Rule";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("processAutoApprovals - metrics tracking", () => {
        it("should track per-rule trigger count when changes are auto-approved", async () => {
            // Mock pending changes
            const mockPendingChanges = [
                {
                    id: "change-1",
                    productId: "product-1",
                    tenantId: mockTenantId,
                    currentPrice: 100,
                    recommendedPrice: 95,
                    status: "PENDING",
                    appliedRule: "UNDERCUT",
                    product: {
                        id: "product-1",
                        title: "Product 1",
                        sku: "SKU-1",
                        category: "Electronics",
                        matchesAsUser: [
                            {
                                confidenceScore: 90,
                                competitorProduct: {},
                            },
                        ],
                    },
                },
            ];

            // Mock rules
            const mockRules = [
                {
                    id: mockRuleId,
                    name: mockRuleName,
                    enabled: true,
                    priority: 1,
                    conditions: {
                        maxPriceChange: 10,
                    },
                },
            ];

            (prisma.pendingPriceChange.findMany as jest.Mock).mockResolvedValue(
                mockPendingChanges
            );
            (prisma.autoApprovalRule.findMany as jest.Mock).mockResolvedValue(mockRules);
            (prisma.product.findUnique as jest.Mock).mockResolvedValue(
                mockPendingChanges[0].product
            );

            // Mock transaction
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback({
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
                });
            });

            // Process auto-approvals
            await AutoApprovalService.processAutoApprovals(mockTenantId);

            // Verify metrics were recorded
            expect(prisma.autoApprovalMetric.upsert).toHaveBeenCalled();

            // Check that per-rule metrics were recorded
            const upsertCalls = (prisma.autoApprovalMetric.upsert as jest.Mock).mock.calls;
            const ruleMetricCall = upsertCalls.find(
                (call) => call[0].where.tenantId_ruleId_date.ruleId === mockRuleId
            );

            expect(ruleMetricCall).toBeDefined();
            expect(ruleMetricCall[0].create.triggerCount).toBe(1);
            expect(ruleMetricCall[0].create.ruleName).toBe(mockRuleName);
        });

        it("should track non-matching changes count", async () => {
            // Mock pending changes that don't match any rules
            const mockPendingChanges = [
                {
                    id: "change-1",
                    productId: "product-1",
                    tenantId: mockTenantId,
                    currentPrice: 100,
                    recommendedPrice: 50, // Large change that won't match
                    status: "PENDING",
                    appliedRule: "UNDERCUT",
                    product: {
                        id: "product-1",
                        title: "Product 1",
                        sku: "SKU-1",
                        category: "Electronics",
                        matchesAsUser: [
                            {
                                confidenceScore: 90,
                                competitorProduct: {},
                            },
                        ],
                    },
                },
            ];

            // Mock rules with strict conditions
            const mockRules = [
                {
                    id: mockRuleId,
                    name: mockRuleName,
                    enabled: true,
                    priority: 1,
                    conditions: {
                        maxPriceChange: 5, // Won't match the 50 change
                    },
                },
            ];

            (prisma.pendingPriceChange.findMany as jest.Mock).mockResolvedValue(
                mockPendingChanges
            );
            (prisma.autoApprovalRule.findMany as jest.Mock).mockResolvedValue(mockRules);
            (prisma.product.findUnique as jest.Mock).mockResolvedValue(
                mockPendingChanges[0].product
            );

            // Process auto-approvals
            await AutoApprovalService.processAutoApprovals(mockTenantId);

            // Verify non-matching metrics were recorded
            const upsertCalls = (prisma.autoApprovalMetric.upsert as jest.Mock).mock.calls;
            const nonMatchingCall = upsertCalls.find(
                (call) => call[0].where.tenantId_ruleId_date.ruleId === null
            );

            expect(nonMatchingCall).toBeDefined();
            expect(nonMatchingCall[0].create.nonMatchingCount).toBe(1);
        });

        it("should track total evaluated count", async () => {
            // Mock multiple pending changes
            const mockPendingChanges = [
                {
                    id: "change-1",
                    productId: "product-1",
                    tenantId: mockTenantId,
                    currentPrice: 100,
                    recommendedPrice: 95,
                    status: "PENDING",
                    appliedRule: "UNDERCUT",
                    product: {
                        id: "product-1",
                        title: "Product 1",
                        sku: "SKU-1",
                        category: "Electronics",
                        matchesAsUser: [
                            {
                                confidenceScore: 90,
                                competitorProduct: {},
                            },
                        ],
                    },
                },
                {
                    id: "change-2",
                    productId: "product-2",
                    tenantId: mockTenantId,
                    currentPrice: 200,
                    recommendedPrice: 195,
                    status: "PENDING",
                    appliedRule: "UNDERCUT",
                    product: {
                        id: "product-2",
                        title: "Product 2",
                        sku: "SKU-2",
                        category: "Electronics",
                        matchesAsUser: [
                            {
                                confidenceScore: 90,
                                competitorProduct: {},
                            },
                        ],
                    },
                },
            ];

            // Mock rules
            const mockRules = [
                {
                    id: mockRuleId,
                    name: mockRuleName,
                    enabled: true,
                    priority: 1,
                    conditions: {
                        maxPriceChange: 10,
                    },
                },
            ];

            (prisma.pendingPriceChange.findMany as jest.Mock).mockResolvedValue(
                mockPendingChanges
            );
            (prisma.autoApprovalRule.findMany as jest.Mock).mockResolvedValue(mockRules);
            (prisma.product.findUnique as jest.Mock).mockImplementation((args) => {
                const change = mockPendingChanges.find((c) => c.productId === args.where.id);
                return Promise.resolve(change?.product);
            });

            // Mock transaction
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback({
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
                });
            });

            // Process auto-approvals
            await AutoApprovalService.processAutoApprovals(mockTenantId);

            // Verify total evaluated count
            const upsertCalls = (prisma.autoApprovalMetric.upsert as jest.Mock).mock.calls;
            const ruleMetricCall = upsertCalls.find(
                (call) => call[0].where.tenantId_ruleId_date.ruleId === mockRuleId
            );

            expect(ruleMetricCall).toBeDefined();
            expect(ruleMetricCall[0].create.totalEvaluated).toBe(2);
        });
    });

    describe("getMetrics", () => {
        it("should calculate auto-approval percentage correctly", async () => {
            // Mock metrics data
            const mockMetrics = [
                {
                    id: "metric-1",
                    tenantId: mockTenantId,
                    ruleId: mockRuleId,
                    ruleName: mockRuleName,
                    triggerCount: 75,
                    nonMatchingCount: 0,
                    totalEvaluated: 100,
                    date: new Date(),
                },
                {
                    id: "metric-2",
                    tenantId: mockTenantId,
                    ruleId: null,
                    ruleName: null,
                    triggerCount: 0,
                    nonMatchingCount: 25,
                    totalEvaluated: 100,
                    date: new Date(),
                },
            ];

            (prisma.autoApprovalMetric.findMany as jest.Mock).mockResolvedValue(mockMetrics);

            // Get metrics
            const result = await AutoApprovalService.getMetrics(mockTenantId);

            // Verify calculations
            expect(result.totalAutoApproved).toBe(75);
            expect(result.totalNonMatching).toBe(25);
            expect(result.totalEvaluated).toBe(200);
            expect(result.autoApprovalPercentage).toBe(37.5); // 75/200 * 100
        });

        it("should return per-rule metrics", async () => {
            // Mock metrics data with multiple rules
            const mockMetrics = [
                {
                    id: "metric-1",
                    tenantId: mockTenantId,
                    ruleId: "rule-1",
                    ruleName: "Rule 1",
                    triggerCount: 50,
                    nonMatchingCount: 0,
                    totalEvaluated: 100,
                    date: new Date(),
                },
                {
                    id: "metric-2",
                    tenantId: mockTenantId,
                    ruleId: "rule-2",
                    ruleName: "Rule 2",
                    triggerCount: 30,
                    nonMatchingCount: 0,
                    totalEvaluated: 100,
                    date: new Date(),
                },
            ];

            (prisma.autoApprovalMetric.findMany as jest.Mock).mockResolvedValue(mockMetrics);

            // Get metrics
            const result = await AutoApprovalService.getMetrics(mockTenantId);

            // Verify per-rule metrics
            expect(result.perRuleMetrics).toHaveLength(2);
            expect(result.perRuleMetrics[0]).toEqual({
                ruleId: "rule-1",
                ruleName: "Rule 1",
                triggerCount: 50,
            });
            expect(result.perRuleMetrics[1]).toEqual({
                ruleId: "rule-2",
                ruleName: "Rule 2",
                triggerCount: 30,
            });
        });

        it("should handle zero evaluated changes", async () => {
            // Mock empty metrics
            (prisma.autoApprovalMetric.findMany as jest.Mock).mockResolvedValue([]);

            // Get metrics
            const result = await AutoApprovalService.getMetrics(mockTenantId);

            // Verify zero percentage
            expect(result.totalAutoApproved).toBe(0);
            expect(result.totalNonMatching).toBe(0);
            expect(result.totalEvaluated).toBe(0);
            expect(result.autoApprovalPercentage).toBe(0);
        });
    });
});
