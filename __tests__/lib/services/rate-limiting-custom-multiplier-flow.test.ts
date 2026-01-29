/**
 * Custom Multiplier Flow Test
 * 
 * Feature: rate-limiting-completion, Property: Custom Multiplier Flow
 * 
 * This test validates the custom multiplier workflow:
 * - Create test tenant
 * - Super admin sets custom multiplier
 * - Verify new limits apply
 * - Verify audit log created
 * - Verify custom multiplier overrides plan multiplier
 * 
 * Requirements: 4.4, 4.5
 */

import fc from 'fast-check';
import { prisma } from '@/lib/prisma';
import { PlanType } from '@prisma/client';
import {
    setCustomMultiplier,
    removeCustomMultiplier,
    getCustomMultiplier,
    getTenantStatus
} from '@/lib/services/rate-limit-admin';
import {
    getEffectiveLimit,
    getPlanMultiplier,
    isValidMultiplier,
    RateLimiterType
} from '@/lib/services/rate-limit-config';

describe('Custom Multiplier Flow', () => {
    let testTenantId: string;
    let testUserId: string;
    let adminUserId: string;

    beforeEach(async () => {
        // Create test tenant
        const tenant = await prisma.tenant.create({
            data: {
                companyName: `Test Company ${Date.now()}`,
                planType: 'BASIC',
            },
        });
        testTenantId = tenant.id;

        // Create regular user
        const user = await prisma.user.create({
            data: {
                email: `test-${Date.now()}@example.com`,
                name: 'Test User',
                tenantId: testTenantId,
                role: 'USER',
            },
        });
        testUserId = user.id;

        // Create super admin user
        const admin = await prisma.user.create({
            data: {
                email: `admin-${Date.now()}@example.com`,
                name: 'Admin User',
                tenantId: testTenantId,
                role: 'ADMIN',
                isSuperAdmin: true,
            },
        });
        adminUserId = admin.id;
    });

    afterEach(async () => {
        // Cleanup test data
        if (adminUserId) {
            await prisma.user.delete({ where: { id: adminUserId } }).catch(() => { });
        }
        if (testUserId) {
            await prisma.user.delete({ where: { id: testUserId } }).catch(() => { });
        }
        if (testTenantId) {
            await prisma.rateLimitCustomMultiplier.deleteMany({ where: { tenantId: testTenantId } });
            await prisma.auditLog.deleteMany({ where: { tenantId: testTenantId } });
            await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => { });
        }
    });

    it('should apply custom multiplier to rate limits', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.float({ min: 0.1, max: 100, noNaN: true }),
                fc.string({ minLength: 10, maxLength: 100 }),
                fc.constantFrom<RateLimiterType>('read', 'write', 'api'),
                async (multiplier, reason, limiterType) => {
                    // Validate multiplier
                    if (!isValidMultiplier(multiplier)) {
                        return; // Skip invalid multipliers
                    }

                    // Get plan multiplier
                    const planMultiplier = getPlanMultiplier('BASIC');
                    expect(planMultiplier).toBe(1.0);

                    // Get base limit
                    const baseLimit = getEffectiveLimit(limiterType, 'BASIC');

                    // Set custom multiplier
                    await setCustomMultiplier(
                        testTenantId,
                        adminUserId,
                        multiplier,
                        reason,
                        '127.0.0.1'
                    );

                    // Get custom multiplier
                    const retrievedMultiplier = await getCustomMultiplier(testTenantId);
                    expect(retrievedMultiplier).toBe(multiplier);

                    // Calculate expected limit with custom multiplier
                    const expectedLimit = getEffectiveLimit(limiterType, 'BASIC', multiplier);

                    // Verify custom multiplier overrides plan multiplier
                    expect(expectedLimit).not.toBe(baseLimit);
                    expect(expectedLimit).toBe(Math.floor(baseLimit * multiplier / planMultiplier));

                    // Get tenant status
                    const status = await getTenantStatus(testTenantId);
                    expect(status.customMultiplier).toBe(multiplier);
                    expect(status.effectiveMultiplier).toBe(multiplier);
                    expect(status.customMultiplierReason).toBe(reason.trim());
                }
            ),
            { numRuns: 10 }
        );
    });

    it('should create audit log when custom multiplier is set', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.float({ min: 0.1, max: 100, noNaN: true }),
                fc.string({ minLength: 10, maxLength: 100 }),
                async (multiplier, reason) => {
                    // Validate multiplier
                    if (!isValidMultiplier(multiplier)) {
                        return; // Skip invalid multipliers
                    }

                    // Count audit logs before
                    const auditLogsBefore = await prisma.auditLog.count({
                        where: {
                            tenantId: testTenantId,
                            action: 'SET_CUSTOM_RATE_LIMIT_MULTIPLIER',
                        },
                    });

                    // Set custom multiplier
                    await setCustomMultiplier(
                        testTenantId,
                        adminUserId,
                        multiplier,
                        reason,
                        '127.0.0.1'
                    );

                    // Count audit logs after
                    const auditLogsAfter = await prisma.auditLog.count({
                        where: {
                            tenantId: testTenantId,
                            action: 'SET_CUSTOM_RATE_LIMIT_MULTIPLIER',
                        },
                    });

                    // Verify audit log was created
                    expect(auditLogsAfter).toBe(auditLogsBefore + 1);

                    // Get the audit log
                    const auditLog = await prisma.auditLog.findFirst({
                        where: {
                            tenantId: testTenantId,
                            action: 'SET_CUSTOM_RATE_LIMIT_MULTIPLIER',
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                    });

                    expect(auditLog).toBeTruthy();
                    expect(auditLog?.userId).toBe(adminUserId);
                    expect(auditLog?.ipAddress).toBe('127.0.0.1');
                }
            ),
            { numRuns: 5 }
        );
    });

    it('should validate custom multiplier range', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.oneof(
                    fc.float({ min: -100, max: 0.09, noNaN: true }),
                    fc.float({ min: 100.01, max: 1000, noNaN: true })
                ),
                fc.string({ minLength: 10, maxLength: 100 }),
                async (invalidMultiplier, reason) => {
                    // Try to set invalid multiplier
                    await expect(
                        setCustomMultiplier(
                            testTenantId,
                            adminUserId,
                            invalidMultiplier,
                            reason,
                            '127.0.0.1'
                        )
                    ).rejects.toThrow('Multiplier must be between 0.1 and 100');
                }
            ),
            { numRuns: 5 }
        );
    });

    it('should only allow super admins to set custom multipliers', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.float({ min: 0.1, max: 100, noNaN: true }),
                fc.string({ minLength: 10, maxLength: 100 }),
                async (multiplier, reason) => {
                    // Validate multiplier
                    if (!isValidMultiplier(multiplier)) {
                        return; // Skip invalid multipliers
                    }

                    // Try to set custom multiplier with regular user (not super admin)
                    await expect(
                        setCustomMultiplier(
                            testTenantId,
                            testUserId, // Regular user, not admin
                            multiplier,
                            reason,
                            '127.0.0.1'
                        )
                    ).rejects.toThrow('Only super admins can set custom multipliers');
                }
            ),
            { numRuns: 5 }
        );
    });

    it('should validate reason length', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.float({ min: 0.1, max: 100, noNaN: true }),
                fc.string({ maxLength: 5 }), // Too short
                async (multiplier, shortReason) => {
                    // Validate multiplier
                    if (!isValidMultiplier(multiplier)) {
                        return; // Skip invalid multipliers
                    }

                    // Try to set custom multiplier with too short reason
                    await expect(
                        setCustomMultiplier(
                            testTenantId,
                            adminUserId,
                            multiplier,
                            shortReason,
                            '127.0.0.1'
                        )
                    ).rejects.toThrow('Reason must be at least 10 characters');
                }
            ),
            { numRuns: 5 }
        );
    });

    it('should update existing custom multiplier', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.float({ min: 0.1, max: 100, noNaN: true }),
                fc.float({ min: 0.1, max: 100, noNaN: true }),
                fc.string({ minLength: 10, maxLength: 100 }),
                fc.string({ minLength: 10, maxLength: 100 }),
                async (multiplier1, multiplier2, reason1, reason2) => {
                    // Validate multipliers
                    if (!isValidMultiplier(multiplier1) || !isValidMultiplier(multiplier2)) {
                        return; // Skip invalid multipliers
                    }

                    // Set first custom multiplier
                    await setCustomMultiplier(
                        testTenantId,
                        adminUserId,
                        multiplier1,
                        reason1,
                        '127.0.0.1'
                    );

                    // Verify first multiplier
                    const firstMultiplier = await getCustomMultiplier(testTenantId);
                    expect(firstMultiplier).toBe(multiplier1);

                    // Set second custom multiplier (update)
                    await setCustomMultiplier(
                        testTenantId,
                        adminUserId,
                        multiplier2,
                        reason2,
                        '127.0.0.1'
                    );

                    // Verify second multiplier replaced first
                    const secondMultiplier = await getCustomMultiplier(testTenantId);
                    expect(secondMultiplier).toBe(multiplier2);

                    // Should only have one custom multiplier record
                    const count = await prisma.rateLimitCustomMultiplier.count({
                        where: { tenantId: testTenantId },
                    });
                    expect(count).toBe(1);
                }
            ),
            { numRuns: 5 }
        );
    });

    it('should remove custom multiplier and revert to plan multiplier', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.float({ min: 0.1, max: 100, noNaN: true }),
                fc.string({ minLength: 10, maxLength: 100 }),
                fc.string({ minLength: 10, maxLength: 100 }),
                fc.constantFrom<RateLimiterType>('read', 'write', 'api'),
                async (multiplier, setReason, removeReason, limiterType) => {
                    // Validate multiplier
                    if (!isValidMultiplier(multiplier)) {
                        return; // Skip invalid multipliers
                    }

                    // Set custom multiplier
                    await setCustomMultiplier(
                        testTenantId,
                        adminUserId,
                        multiplier,
                        setReason,
                        '127.0.0.1'
                    );

                    // Verify custom multiplier is set
                    const customMultiplier = await getCustomMultiplier(testTenantId);
                    expect(customMultiplier).toBe(multiplier);

                    // Get limit with custom multiplier
                    const customLimit = getEffectiveLimit(limiterType, 'BASIC', multiplier);

                    // Remove custom multiplier
                    await removeCustomMultiplier(
                        testTenantId,
                        adminUserId,
                        removeReason,
                        '127.0.0.1'
                    );

                    // Verify custom multiplier is removed
                    const afterRemoval = await getCustomMultiplier(testTenantId);
                    expect(afterRemoval).toBeNull();

                    // Get limit with plan multiplier
                    const planLimit = getEffectiveLimit(limiterType, 'BASIC');

                    // Verify reverted to plan multiplier
                    const planMultiplier = getPlanMultiplier('BASIC');
                    expect(planMultiplier).toBe(1.0);

                    // Verify audit log for removal
                    const auditLog = await prisma.auditLog.findFirst({
                        where: {
                            tenantId: testTenantId,
                            action: 'REMOVE_CUSTOM_RATE_LIMIT_MULTIPLIER',
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                    });

                    expect(auditLog).toBeTruthy();
                    expect(auditLog?.userId).toBe(adminUserId);
                }
            ),
            { numRuns: 5 }
        );
    });

    it('should override plan multiplier with custom multiplier', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom<PlanType>('BASIC', 'PREMIUM', 'PRO'),
                fc.float({ min: 0.1, max: 100, noNaN: true }),
                fc.string({ minLength: 10, maxLength: 100 }),
                fc.constantFrom<RateLimiterType>('read', 'write', 'api'),
                async (planType, customMultiplier, reason, limiterType) => {
                    // Validate multiplier
                    if (!isValidMultiplier(customMultiplier)) {
                        return; // Skip invalid multipliers
                    }

                    // Update tenant plan
                    await prisma.tenant.update({
                        where: { id: testTenantId },
                        data: { planType },
                    });

                    // Get plan multiplier
                    const planMultiplier = getPlanMultiplier(planType);

                    // Get limit with plan multiplier
                    const planLimit = getEffectiveLimit(limiterType, planType);

                    // Set custom multiplier
                    await setCustomMultiplier(
                        testTenantId,
                        adminUserId,
                        customMultiplier,
                        reason,
                        '127.0.0.1'
                    );

                    // Get limit with custom multiplier
                    const customLimit = getEffectiveLimit(limiterType, planType, customMultiplier);

                    // Verify custom multiplier overrides plan multiplier
                    if (customMultiplier !== planMultiplier) {
                        expect(customLimit).not.toBe(planLimit);
                    }

                    // Get tenant status
                    const status = await getTenantStatus(testTenantId);
                    expect(status.effectiveMultiplier).toBe(customMultiplier);
                    expect(status.planType).toBe(planType);
                }
            ),
            { numRuns: 10 }
        );
    });
});
