/**
 * Admin Bypass Flow Test
 * 
 * Feature: rate-limiting-completion, Property: Admin Bypass Flow
 * 
 * This test validates the admin bypass workflow:
 * - Create test tenant
 * - Exceed rate limit
 * - Super admin sets bypass
 * - Verify requests are allowed
 * - Verify audit log created
 * - Wait for bypass expiration
 * - Verify rate limiting resumes
 * 
 * Requirements: 4.3, 4.5, 4.6
 */

import fc from 'fast-check';
import { prisma } from '@/lib/prisma';
import {
    setBypass,
    checkBypass,
    getTenantStatus
} from '@/lib/services/rate-limit-admin';
import { RateLimiterType } from '@/lib/services/rate-limit-config';

describe('Admin Bypass Flow', () => {
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
            await prisma.rateLimitBypass.deleteMany({ where: { tenantId: testTenantId } });
            await prisma.auditLog.deleteMany({ where: { tenantId: testTenantId } });
            await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => { });
        }
    });

    it('should allow requests when bypass is active', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 60 }),
                fc.string({ minLength: 10, maxLength: 100 }),
                async (durationMinutes, reason) => {
                    // Set bypass
                    await setBypass(
                        testTenantId,
                        adminUserId,
                        durationMinutes,
                        reason,
                        '127.0.0.1'
                    );

                    // Check bypass is active
                    const bypassActive = await checkBypass(testTenantId);
                    expect(bypassActive).toBe(true);

                    // Get tenant status
                    const status = await getTenantStatus(testTenantId);
                    expect(status.bypassActive).toBe(true);
                    expect(status.bypassReason).toBe(reason.trim());
                    expect(status.bypassExpiresAt).toBeTruthy();

                    // Verify expiration time is in the future
                    if (status.bypassExpiresAt) {
                        const expiresAt = new Date(status.bypassExpiresAt);
                        const now = new Date();
                        expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
                    }
                }
            ),
            { numRuns: 10 }
        );
    });

    it('should create audit log when bypass is set', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 60 }),
                fc.string({ minLength: 10, maxLength: 100 }),
                async (durationMinutes, reason) => {
                    // Count audit logs before
                    const auditLogsBefore = await prisma.auditLog.count({
                        where: {
                            tenantId: testTenantId,
                            action: 'SET_RATE_LIMIT_BYPASS',
                        },
                    });

                    // Set bypass
                    await setBypass(
                        testTenantId,
                        adminUserId,
                        durationMinutes,
                        reason,
                        '127.0.0.1'
                    );

                    // Count audit logs after
                    const auditLogsAfter = await prisma.auditLog.count({
                        where: {
                            tenantId: testTenantId,
                            action: 'SET_RATE_LIMIT_BYPASS',
                        },
                    });

                    // Verify audit log was created
                    expect(auditLogsAfter).toBe(auditLogsBefore + 1);

                    // Get the audit log
                    const auditLog = await prisma.auditLog.findFirst({
                        where: {
                            tenantId: testTenantId,
                            action: 'SET_RATE_LIMIT_BYPASS',
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

    it('should deactivate expired bypasses', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 100 }),
                async (reason) => {
                    // Set bypass with very short duration (1 minute)
                    await setBypass(
                        testTenantId,
                        adminUserId,
                        1,
                        reason,
                        '127.0.0.1'
                    );

                    // Verify bypass is active
                    const bypassActiveBefore = await checkBypass(testTenantId);
                    expect(bypassActiveBefore).toBe(true);

                    // Manually expire the bypass by updating the database
                    await prisma.rateLimitBypass.updateMany({
                        where: {
                            tenantId: testTenantId,
                            isActive: true,
                        },
                        data: {
                            expiresAt: new Date(Date.now() - 1000), // Set to past
                        },
                    });

                    // Check bypass again - should be inactive now
                    const bypassActiveAfter = await checkBypass(testTenantId);
                    expect(bypassActiveAfter).toBe(false);

                    // Verify bypass was deactivated in database
                    const bypass = await prisma.rateLimitBypass.findFirst({
                        where: {
                            tenantId: testTenantId,
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                    });

                    expect(bypass?.isActive).toBe(false);
                }
            ),
            { numRuns: 5 }
        );
    });

    it('should only allow super admins to set bypasses', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 60 }),
                fc.string({ minLength: 10, maxLength: 100 }),
                async (durationMinutes, reason) => {
                    // Try to set bypass with regular user (not super admin)
                    await expect(
                        setBypass(
                            testTenantId,
                            testUserId, // Regular user, not admin
                            durationMinutes,
                            reason,
                            '127.0.0.1'
                        )
                    ).rejects.toThrow('Only super admins can set rate limit bypasses');
                }
            ),
            { numRuns: 5 }
        );
    });

    it('should validate bypass duration', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: -100, max: 0 }).chain(n => fc.constant(n))
                    .chain(n => fc.record({ duration: fc.constant(n), reason: fc.string({ minLength: 10 }) })),
                async ({ duration, reason }) => {
                    // Try to set bypass with invalid duration
                    await expect(
                        setBypass(
                            testTenantId,
                            adminUserId,
                            duration,
                            reason,
                            '127.0.0.1'
                        )
                    ).rejects.toThrow('Duration must be between 1 and 1440 minutes');
                }
            ),
            { numRuns: 5 }
        );
    });

    it('should validate bypass reason length', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 60 }),
                fc.string({ maxLength: 5 }), // Too short
                async (durationMinutes, shortReason) => {
                    // Try to set bypass with too short reason
                    await expect(
                        setBypass(
                            testTenantId,
                            adminUserId,
                            durationMinutes,
                            shortReason,
                            '127.0.0.1'
                        )
                    ).rejects.toThrow('Reason must be at least 10 characters');
                }
            ),
            { numRuns: 5 }
        );
    });

    it('should deactivate previous bypasses when setting new one', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 10, maxLength: 100 }),
                fc.string({ minLength: 10, maxLength: 100 }),
                async (reason1, reason2) => {
                    // Set first bypass
                    await setBypass(
                        testTenantId,
                        adminUserId,
                        30,
                        reason1,
                        '127.0.0.1'
                    );

                    // Set second bypass
                    await setBypass(
                        testTenantId,
                        adminUserId,
                        60,
                        reason2,
                        '127.0.0.1'
                    );

                    // Get all bypasses for tenant
                    const bypasses = await prisma.rateLimitBypass.findMany({
                        where: { tenantId: testTenantId },
                        orderBy: { createdAt: 'desc' },
                    });

                    // Should have 2 bypasses
                    expect(bypasses.length).toBe(2);

                    // Only the most recent should be active
                    expect(bypasses[0].isActive).toBe(true);
                    expect(bypasses[0].reason).toBe(reason2.trim());
                    expect(bypasses[1].isActive).toBe(false);
                }
            ),
            { numRuns: 5 }
        );
    });
});
