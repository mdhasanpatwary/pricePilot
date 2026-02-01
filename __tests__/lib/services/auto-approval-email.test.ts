import { AutoApprovalService } from "@/lib/services/auto-approval";
import { prisma } from "@/lib/prisma";
import { mailService } from "@/lib/mail";

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

// Mock the mail service
jest.mock("@/lib/mail", () => ({
    mailService: {
        sendAutoApprovalNotification: jest.fn(),
    },
}));

describe("AutoApprovalService - Email Notifications", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should send email notification when changes are auto-approved", async () => {
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
                reviewedAt: null,
                reviewedBy: null,
                expiresAt: new Date(Date.now() + 86400000),
                autoApprovedBy: null,
                autoApprovedAt: null,
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
                                id: "comp-1",
                                title: "Competitor Product",
                                currentPrice: 90,
                            },
                        },
                    ],
                },
            },
        ];

        // Mock enabled rules
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
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ];

        // Mock product
        const product = {
            id: "product-1",
            title: "Test Product",
            sku: "TEST-001",
            currentPrice: 100,
            category: "Electronics",
            matchesAsUser: [
                {
                    confidenceScore: 95,
                    competitorProduct: {
                        id: "comp-1",
                        title: "Competitor Product",
                        currentPrice: 90,
                    },
                },
            ],
        };

        // Setup mocks
        (prisma.pendingPriceChange.findMany as jest.Mock).mockResolvedValue(
            pendingChanges
        );
        (prisma.autoApprovalRule.findMany as jest.Mock).mockResolvedValue(rules);
        (prisma.product.findUnique as jest.Mock).mockResolvedValue(product);
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
        const count = await AutoApprovalService.processAutoApprovals(tenantId);

        // Verify email was sent
        expect(count).toBe(1);
        expect(mailService.sendAutoApprovalNotification).toHaveBeenCalledWith(
            tenantId,
            1,
            [ruleName]
        );
    });

    it("should not send email notification when no changes are auto-approved", async () => {
        const tenantId = "tenant-123";

        // Mock pending changes that don't match any rules
        const pendingChanges = [
            {
                id: "change-1",
                productId: "product-1",
                tenantId,
                currentPrice: 100,
                recommendedPrice: 90, // Change of 10
                reason: "Competitor price lower",
                appliedRule: "UNDERCUT",
                status: "PENDING",
                createdAt: new Date(),
                reviewedAt: null,
                reviewedBy: null,
                expiresAt: new Date(Date.now() + 86400000),
                autoApprovedBy: null,
                autoApprovedAt: null,
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
                                id: "comp-1",
                                title: "Competitor Product",
                                currentPrice: 90,
                            },
                        },
                    ],
                },
            },
        ];

        // Mock strict rule that won't match
        const rules = [
            {
                id: "rule-123",
                name: "Strict Rule",
                tenantId,
                enabled: true,
                priority: 1,
                conditions: {
                    maxPriceChange: 1, // Very strict - won't match change of 10
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ];

        // Mock product
        const product = {
            id: "product-1",
            title: "Test Product",
            sku: "TEST-001",
            currentPrice: 100,
            category: "Electronics",
            matchesAsUser: [
                {
                    confidenceScore: 95,
                    competitorProduct: {
                        id: "comp-1",
                        title: "Competitor Product",
                        currentPrice: 90,
                    },
                },
            ],
        };

        // Setup mocks
        (prisma.pendingPriceChange.findMany as jest.Mock).mockResolvedValue(
            pendingChanges
        );
        (prisma.autoApprovalRule.findMany as jest.Mock).mockResolvedValue(rules);
        (prisma.product.findUnique as jest.Mock).mockResolvedValue(product);

        // Process auto-approvals
        const count = await AutoApprovalService.processAutoApprovals(tenantId);

        // Verify no email was sent
        expect(count).toBe(0);
        expect(mailService.sendAutoApprovalNotification).not.toHaveBeenCalled();
    });

    it("should collect multiple rule names when multiple rules trigger", async () => {
        const tenantId = "tenant-123";

        // Mock pending changes
        const pendingChanges = [
            {
                id: "change-1",
                productId: "product-1",
                tenantId,
                currentPrice: 100,
                recommendedPrice: 95, // Matches Rule 1
                reason: "Competitor price lower",
                appliedRule: "UNDERCUT",
                status: "PENDING",
                createdAt: new Date(),
                reviewedAt: null,
                reviewedBy: null,
                expiresAt: new Date(Date.now() + 86400000),
                autoApprovedBy: null,
                autoApprovedAt: null,
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
                                id: "comp-1",
                                title: "Competitor Product",
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
                recommendedPrice: 185, // Matches Rule 2
                reason: "Competitor price lower",
                appliedRule: "UNDERCUT",
                status: "PENDING",
                createdAt: new Date(),
                reviewedAt: null,
                reviewedBy: null,
                expiresAt: new Date(Date.now() + 86400000),
                autoApprovedBy: null,
                autoApprovedAt: null,
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
                                id: "comp-2",
                                title: "Competitor Product 2",
                                currentPrice: 180,
                            },
                        },
                    ],
                },
            },
        ];

        // Mock rules
        const rules = [
            {
                id: "rule-1",
                name: "Rule 1",
                tenantId,
                enabled: true,
                priority: 1,
                conditions: {
                    maxPriceChange: 10,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: "rule-2",
                name: "Rule 2",
                tenantId,
                enabled: true,
                priority: 2,
                conditions: {
                    maxPriceChange: 20,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ];

        // Setup mocks
        (prisma.pendingPriceChange.findMany as jest.Mock).mockResolvedValue(
            pendingChanges
        );
        (prisma.autoApprovalRule.findMany as jest.Mock).mockResolvedValue(rules);
        (prisma.product.findUnique as jest.Mock)
            .mockResolvedValueOnce({
                id: "product-1",
                title: "Test Product 1",
                sku: "TEST-001",
                currentPrice: 100,
                category: "Electronics",
                matchesAsUser: [
                    {
                        confidenceScore: 95,
                        competitorProduct: {
                            id: "comp-1",
                            title: "Competitor Product",
                            currentPrice: 90,
                        },
                    },
                ],
            })
            .mockResolvedValueOnce({
                id: "product-2",
                title: "Test Product 2",
                sku: "TEST-002",
                currentPrice: 200,
                category: "Electronics",
                matchesAsUser: [
                    {
                        confidenceScore: 95,
                        competitorProduct: {
                            id: "comp-2",
                            title: "Competitor Product 2",
                            currentPrice: 180,
                        },
                    },
                ],
            });
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
        const count = await AutoApprovalService.processAutoApprovals(tenantId);

        // Verify email was sent with both rule names
        expect(count).toBe(2);
        expect(mailService.sendAutoApprovalNotification).toHaveBeenCalledWith(
            tenantId,
            2,
            expect.arrayContaining(["Rule 1", "Rule 2"])
        );
    });
});
