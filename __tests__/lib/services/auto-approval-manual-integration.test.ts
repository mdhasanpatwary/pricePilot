/**
 * Integration tests for auto-approval and manual approval workflow
 * 
 * These tests verify that:
 * 1. Manual approval buttons work for PENDING changes
 * 2. Manually approved changes are skipped by auto-approval
 * 3. Manual approval workflow continues to function with auto-approval enabled
 * 
 * Requirements: 10.1, 10.2, 10.3
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { prisma } from "@/lib/prisma";
import { AutoApprovalService } from "@/lib/services/auto-approval";
import { RulesEngine } from "@/lib/services/rules-engine";

describe("Auto-Approval and Manual Approval Integration", () => {
    let testTenantId: string;
    let testProductId: string;
    let testSiteId: string;
    let testRuleId: string;

    beforeEach(async () => {
        // Create test tenant
        const tenant = await prisma.tenant.create({
            data: {
                companyName: "Test Company",
                planType: "BASIC",
            },
        });
        testTenantId = tenant.id;

        // Create test site
        const site = await prisma.site.create({
            data: {
                tenantId: testTenantId,
                type: "USER",
                platform: "GENERIC",
                baseUrl: "https://test.com",
            },
        });
        testSiteId = site.id;

        // Create test product
        const product = await prisma.product.create({
            data: {
                tenantId: testTenantId,
                siteId: testSiteId,
                title: "Test Product",
                sku: "TEST-001",
                currentPrice: 100,
                inStock: true,
            },
        });
        testProductId = product.id;

        // Create auto-approval rule
        const rule = await prisma.autoApprovalRule.create({
            data: {
                tenantId: testTenantId,
                name: "Test Rule",
                enabled: true,
                priority: 1,
                conditions: {
                    maxPriceChange: 10,
                },
            },
        });
        testRuleId = rule.id;
    });

    afterEach(async () => {
        // Clean up test data
        await prisma.autoApprovalRule.deleteMany({
            where: { tenantId: testTenantId },
        });
        await prisma.pendingPriceChange.deleteMany({
            where: { tenantId: testTenantId },
        });
        await prisma.product.deleteMany({
            where: { tenantId: testTenantId },
        });
        await prisma.site.deleteMany({
            where: { tenantId: testTenantId },
        });
        await prisma.tenant.delete({
            where: { id: testTenantId },
        });
    });

    it("should allow manual approval of PENDING changes (Requirement 10.1)", async () => {
        // Create a pending price change
        const change = await prisma.pendingPriceChange.create({
            data: {
                tenantId: testTenantId,
                productId: testProductId,
                currentPrice: 100,
                recommendedPrice: 95,
                reason: "Test reason",
                status: "PENDING",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        // Manually approve the change
        const result = await RulesEngine.applyApprovedChanges(
            [change.id],
            "test@example.com"
        );

        // Verify manual approval succeeded
        expect(result.updated).toBe(1);
        expect(result.failed).toBe(0);

        // Verify change status is APPROVED
        const updatedChange = await prisma.pendingPriceChange.findUnique({
            where: { id: change.id },
        });
        expect(updatedChange?.status).toBe("APPROVED");
        expect(updatedChange?.reviewedBy).toBe("test@example.com");
    });

    it("should skip manually approved changes during auto-approval (Requirement 10.2)", async () => {
        // Create a pending price change
        const change = await prisma.pendingPriceChange.create({
            data: {
                tenantId: testTenantId,
                productId: testProductId,
                currentPrice: 100,
                recommendedPrice: 95,
                reason: "Test reason",
                status: "PENDING",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        // Manually approve the change first
        await RulesEngine.applyApprovedChanges([change.id], "test@example.com");

        // Run auto-approval process
        const autoApprovedCount = await AutoApprovalService.processAutoApprovals(
            testTenantId
        );

        // Verify auto-approval skipped the manually approved change
        expect(autoApprovedCount).toBe(0);

        // Verify change is still manually approved (not auto-approved)
        const updatedChange = await prisma.pendingPriceChange.findUnique({
            where: { id: change.id },
        });
        expect(updatedChange?.status).toBe("APPROVED");
        expect(updatedChange?.reviewedBy).toBe("test@example.com");
        expect(updatedChange?.autoApprovedBy).toBeNull();
    });

    it("should skip manually rejected changes during auto-approval (Requirement 10.3)", async () => {
        // Create a pending price change
        const change = await prisma.pendingPriceChange.create({
            data: {
                tenantId: testTenantId,
                productId: testProductId,
                currentPrice: 100,
                recommendedPrice: 95,
                reason: "Test reason",
                status: "PENDING",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        // Manually reject the change first
        await RulesEngine.rejectPendingChanges([change.id], "test@example.com");

        // Run auto-approval process
        const autoApprovedCount = await AutoApprovalService.processAutoApprovals(
            testTenantId
        );

        // Verify auto-approval skipped the manually rejected change
        expect(autoApprovedCount).toBe(0);

        // Verify change is still rejected (not auto-approved)
        const updatedChange = await prisma.pendingPriceChange.findUnique({
            where: { id: change.id },
        });
        expect(updatedChange?.status).toBe("REJECTED");
        expect(updatedChange?.reviewedBy).toBe("test@example.com");
        expect(updatedChange?.autoApprovedBy).toBeNull();
    });

    it("should allow manual approval to work alongside auto-approval", async () => {
        // Create two pending price changes
        const change1 = await prisma.pendingPriceChange.create({
            data: {
                tenantId: testTenantId,
                productId: testProductId,
                currentPrice: 100,
                recommendedPrice: 95,
                reason: "Test reason 1",
                status: "PENDING",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        // Create another product for second change
        const product2 = await prisma.product.create({
            data: {
                tenantId: testTenantId,
                siteId: testSiteId,
                title: "Test Product 2",
                sku: "TEST-002",
                currentPrice: 200,
                inStock: true,
            },
        });

        const change2 = await prisma.pendingPriceChange.create({
            data: {
                tenantId: testTenantId,
                productId: product2.id,
                currentPrice: 200,
                recommendedPrice: 195,
                reason: "Test reason 2",
                status: "PENDING",
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        // Manually approve first change
        await RulesEngine.applyApprovedChanges([change1.id], "test@example.com");

        // Run auto-approval process (should only process change2)
        const autoApprovedCount = await AutoApprovalService.processAutoApprovals(
            testTenantId
        );

        // Verify auto-approval processed only the second change
        expect(autoApprovedCount).toBe(1);

        // Verify first change is manually approved
        const updatedChange1 = await prisma.pendingPriceChange.findUnique({
            where: { id: change1.id },
        });
        expect(updatedChange1?.status).toBe("APPROVED");
        expect(updatedChange1?.reviewedBy).toBe("test@example.com");
        expect(updatedChange1?.autoApprovedBy).toBeNull();

        // Verify second change is auto-approved
        const updatedChange2 = await prisma.pendingPriceChange.findUnique({
            where: { id: change2.id },
        });
        expect(updatedChange2?.status).toBe("APPROVED");
        expect(updatedChange2?.reviewedBy).toBe("system:auto-approval");
        expect(updatedChange2?.autoApprovedBy).toBe(testRuleId);
    });
});
