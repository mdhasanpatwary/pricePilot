import { prisma } from "@/lib/prisma";
import { AutoApprovalService } from "@/lib/services/auto-approval";
import type { PendingPriceChange, Product, Tenant, User } from "@prisma/client";

describe("AutoApprovalService - shouldAutoApprove", () => {
    let tenant: Tenant;
    let user: User;
    let product: Product;
    let pendingChange: PendingPriceChange;

    beforeEach(async () => {
        // Create test tenant
        tenant = await prisma.tenant.create({
            data: {
                companyName: "Test Company",
                planType: "BASIC",
            },
        });

        // Create test user
        user = await prisma.user.create({
            data: {
                email: `test-${Date.now()}@example.com`,
                name: "Test User",
                passwordHash: "hashed",
                tenantId: tenant.id,
            },
        });

        // Create test site
        const site = await prisma.site.create({
            data: {
                tenantId: tenant.id,
                type: "USER",
                platform: "GENERIC",
                baseUrl: "https://example.com",
            },
        });

        // Create test product
        product = await prisma.product.create({
            data: {
                tenantId: tenant.id,
                siteId: site.id,
                title: "Test Product",
                sku: "TEST-001",
                currentPrice: 100.0,
                category: "Electronics",
            },
        });

        // Create pending price change
        pendingChange = await prisma.pendingPriceChange.create({
            data: {
                tenantId: tenant.id,
                productId: product.id,
                currentPrice: 100.0,
                recommendedPrice: 95.0,
                reason: "Competitor price lower",
                appliedRule: "UNDERCUT",
                status: "PENDING",
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
    });

    afterEach(async () => {
        // Clean up in reverse order of dependencies
        await prisma.pendingPriceChange.deleteMany({
            where: { tenantId: tenant.id },
        });
        await prisma.product.deleteMany({
            where: { tenantId: tenant.id },
        });
        await prisma.site.deleteMany({
            where: { tenantId: tenant.id },
        });
        await prisma.autoApprovalRule.deleteMany({
            where: { tenantId: tenant.id },
        });
        await prisma.user.deleteMany({
            where: { tenantId: tenant.id },
        });
        await prisma.tenant.delete({
            where: { id: tenant.id },
        });
    });

    it("should return not approved when no rules exist", async () => {
        const result = await AutoApprovalService.shouldAutoApprove(
            pendingChange,
            tenant.id
        );

        expect(result.approved).toBe(false);
        expect(result.reason).toBe("No enabled auto-approval rules found");
        expect(result.ruleId).toBeUndefined();
        expect(result.ruleName).toBeUndefined();
    });

    it("should return not approved when change status is not PENDING", async () => {
        // Update change to APPROVED
        const approvedChange = await prisma.pendingPriceChange.update({
            where: { id: pendingChange.id },
            data: { status: "APPROVED" },
        });

        const result = await AutoApprovalService.shouldAutoApprove(
            approvedChange,
            tenant.id
        );

        expect(result.approved).toBe(false);
        expect(result.reason).toBe("Change status is APPROVED, not PENDING");
    });

    it("should skip disabled rules", async () => {
        // Create a disabled rule that would match
        await prisma.autoApprovalRule.create({
            data: {
                tenantId: tenant.id,
                name: "Disabled Rule",
                enabled: false,
                priority: 1,
                conditions: {
                    maxPriceChange: 10.0,
                },
            },
        });

        const result = await AutoApprovalService.shouldAutoApprove(
            pendingChange,
            tenant.id
        );

        expect(result.approved).toBe(false);
        expect(result.reason).toBe("No enabled auto-approval rules found");
    });

    it("should approve when rule matches", async () => {
        // Create a rule that matches (price change is $5, which is <= $10)
        const rule = await prisma.autoApprovalRule.create({
            data: {
                tenantId: tenant.id,
                name: "Small Price Changes",
                enabled: true,
                priority: 1,
                conditions: {
                    maxPriceChange: 10.0,
                },
            },
        });

        const result = await AutoApprovalService.shouldAutoApprove(
            pendingChange,
            tenant.id
        );

        expect(result.approved).toBe(true);
        expect(result.ruleId).toBe(rule.id);
        expect(result.ruleName).toBe("Small Price Changes");
        expect(result.reason).toBe("Auto-approved by rule: Small Price Changes");
    });

    it("should evaluate rules in priority order (short-circuit)", async () => {
        // Create two rules with different priorities
        const lowPriorityRule = await prisma.autoApprovalRule.create({
            data: {
                tenantId: tenant.id,
                name: "Low Priority Rule",
                enabled: true,
                priority: 1,
                conditions: {
                    maxPriceChange: 10.0,
                },
            },
        });

        await prisma.autoApprovalRule.create({
            data: {
                tenantId: tenant.id,
                name: "High Priority Rule",
                enabled: true,
                priority: 2,
                conditions: {
                    maxPriceChange: 10.0,
                },
            },
        });

        const result = await AutoApprovalService.shouldAutoApprove(
            pendingChange,
            tenant.id
        );

        // Should match the first rule (lower priority number)
        expect(result.approved).toBe(true);
        expect(result.ruleId).toBe(lowPriorityRule.id);
        expect(result.ruleName).toBe("Low Priority Rule");
    });

    it("should return not approved when no rules match", async () => {
        // Create a rule that doesn't match (price change is $5, which is > $2)
        await prisma.autoApprovalRule.create({
            data: {
                tenantId: tenant.id,
                name: "Very Small Changes Only",
                enabled: true,
                priority: 1,
                conditions: {
                    maxPriceChange: 2.0,
                },
            },
        });

        const result = await AutoApprovalService.shouldAutoApprove(
            pendingChange,
            tenant.id
        );

        expect(result.approved).toBe(false);
        expect(result.reason).toBe("No auto-approval rules matched");
    });

    it("should validate tenant ID", async () => {
        await expect(
            AutoApprovalService.shouldAutoApprove(pendingChange, "")
        ).rejects.toThrow("Invalid tenant ID");
    });

    it("should validate pending change", async () => {
        await expect(
            AutoApprovalService.shouldAutoApprove(null as any, tenant.id)
        ).rejects.toThrow("Invalid pending price change");
    });
});
