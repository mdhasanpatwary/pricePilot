/**
 * Admin Rate Limit Management Service
 * 
 * Provides administrative functions for managing rate limits across tenants,
 * including temporary bypasses, custom multipliers, and status monitoring.
 * All admin actions are audited for security and compliance.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { prisma } from "@/lib/prisma";
import { PlanType } from "@prisma/client";
import { recordAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { 
  getPlanMultiplier, 
  getEffectiveLimit, 
  isValidMultiplier,
  RateLimiterType,
  ENDPOINT_LIMITS 
} from "./rate-limit-config";
import { getTenantMetrics, getRecentViolations } from "./rate-limit-metrics";

/**
 * Rate limit status for a single tenant
 */
export interface TenantRateLimitStatus {
  tenantId: string;
  companyName: string;
  planType: PlanType;
  effectiveMultiplier: number;
  bypassActive: boolean;
  bypassExpiresAt?: Date;
  bypassReason?: string;
  customMultiplier?: number;
  customMultiplierReason?: string;
  recentViolations: number;
  currentUsage: {
    [limiterType: string]: {
      limit: number;
      window: string;
    };
  };
}

/**
 * Detailed status including metrics and violation history
 */
export interface DetailedTenantStatus extends TenantRateLimitStatus {
  metrics: {
    last24Hours: {
      totalHits: number;
      totalViolations: number;
      violationRate: number;
    };
    last7Days: {
      totalHits: number;
      totalViolations: number;
      violationRate: number;
    };
  };
  recentViolationDetails: Array<{
    timestamp: Date;
    limiterType: string;
    endpoint: string;
    identifier: string;
    violationCount: number;
  }>;
}

/**
 * Set a temporary bypass for a tenant
 * 
 * Allows a tenant to bypass rate limiting for a specified duration.
 * This is useful for special circumstances like data migrations, bulk operations,
 * or resolving customer issues. All bypasses are audited.
 * 
 * @param tenantId - The tenant to bypass rate limits for
 * @param adminUserId - The admin user setting the bypass
 * @param durationMinutes - How long the bypass should last (in minutes)
 * @param reason - Explanation for why the bypass is needed
 * @param ipAddress - Optional IP address of the admin for audit trail
 * @returns The created bypass record
 * 
 * Requirements: 4.3, 4.5
 * 
 * @example
 * ```typescript
 * await setBypass(
 *   'tenant-123',
 *   'admin-456',
 *   60,
 *   'Data migration in progress',
 *   '192.168.1.1'
 * );
 * ```
 */
export async function setBypass(
  tenantId: string,
  adminUserId: string,
  durationMinutes: number,
  reason: string,
  ipAddress?: string
): Promise<void> {
  try {
    // Validate inputs
    if (durationMinutes <= 0 || durationMinutes > 1440) {
      throw new Error("Duration must be between 1 and 1440 minutes (24 hours)");
    }

    if (!reason || reason.trim().length < 10) {
      throw new Error("Reason must be at least 10 characters");
    }

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, companyName: true },
    });

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    // Get admin user for audit log
    const adminUser = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { email: true, isSuperAdmin: true },
    });

    if (!adminUser || !adminUser.isSuperAdmin) {
      throw new Error("Only super admins can set rate limit bypasses");
    }

    // Deactivate any existing active bypasses for this tenant
    await prisma.rateLimitBypass.updateMany({
      where: {
        tenantId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // Create new bypass
    const bypass = await prisma.rateLimitBypass.create({
      data: {
        tenantId,
        setBy: adminUserId,
        reason: reason.trim(),
        expiresAt,
        isActive: true,
      },
    });

    // Create audit log
    await recordAuditLog({
      tenantId,
      userId: adminUserId,
      userEmail: adminUser.email,
      action: "SET_RATE_LIMIT_BYPASS",
      entityId: bypass.id,
      details: {
        durationMinutes,
        expiresAt: expiresAt.toISOString(),
        reason: reason.trim(),
        companyName: tenant.companyName,
      },
      ipAddress,
    });

    logger.info("[RateLimitAdmin] Bypass set successfully:", {
      tenantId,
      adminUserId,
      durationMinutes,
      expiresAt,
    });
  } catch (error) {
    logger.error("[RateLimitAdmin] Failed to set bypass:", {
      error,
      tenantId,
      adminUserId,
    });
    throw error;
  }
}

/**
 * Set a custom multiplier for a tenant
 * 
 * Allows overriding the plan-based multiplier with a custom value.
 * This is useful for special pricing arrangements or temporary adjustments.
 * Custom multipliers must be between 0.1 and 100.
 * 
 * @param tenantId - The tenant to set custom multiplier for
 * @param adminUserId - The admin user setting the multiplier
 * @param multiplier - The custom multiplier value (0.1 to 100)
 * @param reason - Explanation for the custom multiplier
 * @param ipAddress - Optional IP address of the admin for audit trail
 * @returns The created or updated custom multiplier record
 * 
 * Requirements: 4.4, 4.5
 * 
 * @example
 * ```typescript
 * await setCustomMultiplier(
 *   'tenant-123',
 *   'admin-456',
 *   3.5,
 *   'Special enterprise agreement',
 *   '192.168.1.1'
 * );
 * ```
 */
export async function setCustomMultiplier(
  tenantId: string,
  adminUserId: string,
  multiplier: number,
  reason: string,
  ipAddress?: string
): Promise<void> {
  try {
    // Validate multiplier
    if (!isValidMultiplier(multiplier)) {
      throw new Error("Multiplier must be between 0.1 and 100");
    }

    if (!reason || reason.trim().length < 10) {
      throw new Error("Reason must be at least 10 characters");
    }

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, companyName: true, planType: true },
    });

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    // Get admin user for audit log
    const adminUser = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { email: true, isSuperAdmin: true },
    });

    if (!adminUser || !adminUser.isSuperAdmin) {
      throw new Error("Only super admins can set custom multipliers");
    }

    // Check if custom multiplier already exists
    const existing = await prisma.rateLimitCustomMultiplier.findUnique({
      where: { tenantId },
    });

    let customMultiplierRecord;

    if (existing) {
      // Update existing
      customMultiplierRecord = await prisma.rateLimitCustomMultiplier.update({
        where: { tenantId },
        data: {
          multiplier,
          setBy: adminUserId,
          reason: reason.trim(),
        },
      });
    } else {
      // Create new
      customMultiplierRecord = await prisma.rateLimitCustomMultiplier.create({
        data: {
          tenantId,
          multiplier,
          setBy: adminUserId,
          reason: reason.trim(),
        },
      });
    }

    // Create audit log
    await recordAuditLog({
      tenantId,
      userId: adminUserId,
      userEmail: adminUser.email,
      action: "SET_CUSTOM_RATE_LIMIT_MULTIPLIER",
      entityId: customMultiplierRecord.id,
      details: {
        multiplier,
        reason: reason.trim(),
        companyName: tenant.companyName,
        planType: tenant.planType,
        planMultiplier: getPlanMultiplier(tenant.planType),
        previousMultiplier: existing?.multiplier,
      },
      ipAddress,
    });

    logger.info("[RateLimitAdmin] Custom multiplier set successfully:", {
      tenantId,
      adminUserId,
      multiplier,
    });
  } catch (error) {
    logger.error("[RateLimitAdmin] Failed to set custom multiplier:", {
      error,
      tenantId,
      adminUserId,
    });
    throw error;
  }
}

/**
 * Remove a custom multiplier for a tenant
 * 
 * Removes the custom multiplier, reverting to plan-based multiplier.
 * 
 * @param tenantId - The tenant to remove custom multiplier from
 * @param adminUserId - The admin user removing the multiplier
 * @param reason - Explanation for removing the custom multiplier
 * @param ipAddress - Optional IP address of the admin for audit trail
 * 
 * Requirements: 4.4, 4.5
 */
export async function removeCustomMultiplier(
  tenantId: string,
  adminUserId: string,
  reason: string,
  ipAddress?: string
): Promise<void> {
  try {
    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, companyName: true, planType: true },
    });

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    // Get admin user for audit log
    const adminUser = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { email: true, isSuperAdmin: true },
    });

    if (!adminUser || !adminUser.isSuperAdmin) {
      throw new Error("Only super admins can remove custom multipliers");
    }

    // Get existing custom multiplier
    const existing = await prisma.rateLimitCustomMultiplier.findUnique({
      where: { tenantId },
    });

    if (!existing) {
      throw new Error("No custom multiplier found for this tenant");
    }

    // Delete custom multiplier
    await prisma.rateLimitCustomMultiplier.delete({
      where: { tenantId },
    });

    // Create audit log
    await recordAuditLog({
      tenantId,
      userId: adminUserId,
      userEmail: adminUser.email,
      action: "REMOVE_CUSTOM_RATE_LIMIT_MULTIPLIER",
      entityId: existing.id,
      details: {
        reason: reason.trim(),
        companyName: tenant.companyName,
        planType: tenant.planType,
        removedMultiplier: existing.multiplier,
        revertingToPlanMultiplier: getPlanMultiplier(tenant.planType),
      },
      ipAddress,
    });

    logger.info("[RateLimitAdmin] Custom multiplier removed successfully:", {
      tenantId,
      adminUserId,
    });
  } catch (error) {
    logger.error("[RateLimitAdmin] Failed to remove custom multiplier:", {
      error,
      tenantId,
      adminUserId,
    });
    throw error;
  }
}

/**
 * Check if a tenant has an active bypass
 * 
 * This function checks if a tenant currently has an active rate limit bypass.
 * It automatically deactivates expired bypasses.
 * 
 * @param tenantId - The tenant to check
 * @returns True if the tenant has an active bypass, false otherwise
 * 
 * Requirements: 4.3, 4.6
 * 
 * @example
 * ```typescript
 * const hasBypass = await checkBypass('tenant-123');
 * if (hasBypass) {
 *   // Skip rate limiting
 * }
 * ```
 */
export async function checkBypass(tenantId: string): Promise<boolean> {
  try {
    const now = new Date();

    // Find active bypass
    const bypass = await prisma.rateLimitBypass.findFirst({
      where: {
        tenantId,
        isActive: true,
        expiresAt: {
          gt: now,
        },
      },
    });

    // Deactivate expired bypasses (cleanup)
    await prisma.rateLimitBypass.updateMany({
      where: {
        tenantId,
        isActive: true,
        expiresAt: {
          lte: now,
        },
      },
      data: {
        isActive: false,
      },
    });

    return !!bypass;
  } catch (error) {
    logger.error("[RateLimitAdmin] Failed to check bypass:", {
      error,
      tenantId,
    });
    // Fail closed - if we can't check, don't bypass
    return false;
  }
}

/**
 * Get custom multiplier for a tenant
 * 
 * Retrieves the custom multiplier if one is set for the tenant.
 * Returns null if no custom multiplier exists.
 * 
 * @param tenantId - The tenant to get custom multiplier for
 * @returns The custom multiplier value, or null if not set
 * 
 * Requirements: 4.4
 * 
 * @example
 * ```typescript
 * const customMultiplier = await getCustomMultiplier('tenant-123');
 * const effectiveMultiplier = customMultiplier ?? getPlanMultiplier(planType);
 * ```
 */
export async function getCustomMultiplier(
  tenantId: string
): Promise<number | null> {
  try {
    const customMultiplier = await prisma.rateLimitCustomMultiplier.findUnique({
      where: { tenantId },
      select: { multiplier: true },
    });

    return customMultiplier?.multiplier ?? null;
  } catch (error) {
    logger.error("[RateLimitAdmin] Failed to get custom multiplier:", {
      error,
      tenantId,
    });
    return null;
  }
}

/**
 * Get rate limit status for all tenants
 * 
 * Returns a summary of rate limit status for all tenants in the system.
 * This is used for the admin dashboard overview.
 * 
 * @returns Array of tenant rate limit statuses
 * 
 * Requirements: 4.1
 * 
 * @example
 * ```typescript
 * const allStatuses = await getAllTenantsStatus();
 * console.log(`${allStatuses.length} tenants in system`);
 * ```
 */
export async function getAllTenantsStatus(): Promise<TenantRateLimitStatus[]> {
  try {
    // Get all tenants with their rate limit configurations
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        companyName: true,
        planType: true,
        rateLimitBypasses: {
          where: {
            isActive: true,
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        rateLimitCustomMultiplier: true,
      },
      orderBy: {
        companyName: "asc",
      },
    });

    // Get recent violations for each tenant (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const violationCounts = await prisma.rateLimitMetric.groupBy({
      by: ["tenantId"],
      where: {
        timestamp: {
          gte: oneDayAgo,
        },
        violationCount: {
          gt: 0,
        },
      },
      _sum: {
        violationCount: true,
      },
    });

    const violationMap = new Map(
      violationCounts.map((v) => [v.tenantId, v._sum.violationCount ?? 0])
    );

    // Build status for each tenant
    const statuses: TenantRateLimitStatus[] = tenants.map((tenant) => {
      const bypass = tenant.rateLimitBypasses[0];
      const customMultiplier = tenant.rateLimitCustomMultiplier;
      
      const effectiveMultiplier = customMultiplier?.multiplier 
        ?? getPlanMultiplier(tenant.planType);

      // Calculate current usage limits
      const currentUsage: TenantRateLimitStatus["currentUsage"] = {};
      
      for (const [limiterType, config] of Object.entries(ENDPOINT_LIMITS)) {
        currentUsage[limiterType] = {
          limit: getEffectiveLimit(
            limiterType as RateLimiterType,
            tenant.planType,
            customMultiplier?.multiplier
          ),
          window: config.window,
        };
      }

      return {
        tenantId: tenant.id,
        companyName: tenant.companyName,
        planType: tenant.planType,
        effectiveMultiplier,
        bypassActive: !!bypass,
        bypassExpiresAt: bypass?.expiresAt,
        bypassReason: bypass?.reason,
        customMultiplier: customMultiplier?.multiplier,
        customMultiplierReason: customMultiplier?.reason,
        recentViolations: violationMap.get(tenant.id) ?? 0,
        currentUsage,
      };
    });

    return statuses;
  } catch (error) {
    logger.error("[RateLimitAdmin] Failed to get all tenants status:", {
      error,
    });
    return [];
  }
}

/**
 * Get detailed rate limit status for a specific tenant
 * 
 * Returns comprehensive rate limit information for a single tenant,
 * including metrics, violation history, and current configuration.
 * 
 * @param tenantId - The tenant to get detailed status for
 * @returns Detailed tenant status with metrics and violation history
 * 
 * Requirements: 4.2
 * 
 * @example
 * ```typescript
 * const status = await getTenantStatus('tenant-123');
 * console.log(`Violations in last 24h: ${status.metrics.last24Hours.totalViolations}`);
 * ```
 */
export async function getTenantStatus(
  tenantId: string
): Promise<DetailedTenantStatus> {
  try {
    // Get basic tenant info
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        companyName: true,
        planType: true,
        rateLimitBypasses: {
          where: {
            isActive: true,
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        rateLimitCustomMultiplier: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const bypass = tenant.rateLimitBypasses[0];
    const customMultiplier = tenant.rateLimitCustomMultiplier;
    
    const effectiveMultiplier = customMultiplier?.multiplier 
      ?? getPlanMultiplier(tenant.planType);

    // Calculate current usage limits
    const currentUsage: TenantRateLimitStatus["currentUsage"] = {};
    
    for (const [limiterType, config] of Object.entries(ENDPOINT_LIMITS)) {
      currentUsage[limiterType] = {
        limit: getEffectiveLimit(
          limiterType as RateLimiterType,
          tenant.planType,
          customMultiplier?.multiplier
        ),
        window: config.window,
      };
    }

    // Get metrics for last 24 hours
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const metrics24h = await getTenantMetrics(tenantId, oneDayAgo, now);

    // Get metrics for last 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const metrics7d = await getTenantMetrics(tenantId, sevenDaysAgo, now);

    // Get recent violation details
    const recentViolationDetails = await getRecentViolations(tenantId, 20);

    // Calculate violation rates
    const total24h = metrics24h.totalHits + metrics24h.totalViolations;
    const violationRate24h = total24h > 0 
      ? (metrics24h.totalViolations / total24h) * 100 
      : 0;

    const total7d = metrics7d.totalHits + metrics7d.totalViolations;
    const violationRate7d = total7d > 0 
      ? (metrics7d.totalViolations / total7d) * 100 
      : 0;

    return {
      tenantId: tenant.id,
      companyName: tenant.companyName,
      planType: tenant.planType,
      effectiveMultiplier,
      bypassActive: !!bypass,
      bypassExpiresAt: bypass?.expiresAt,
      bypassReason: bypass?.reason,
      customMultiplier: customMultiplier?.multiplier,
      customMultiplierReason: customMultiplier?.reason,
      recentViolations: metrics24h.totalViolations,
      currentUsage,
      metrics: {
        last24Hours: {
          totalHits: metrics24h.totalHits,
          totalViolations: metrics24h.totalViolations,
          violationRate: violationRate24h,
        },
        last7Days: {
          totalHits: metrics7d.totalHits,
          totalViolations: metrics7d.totalViolations,
          violationRate: violationRate7d,
        },
      },
      recentViolationDetails,
    };
  } catch (error) {
    logger.error("[RateLimitAdmin] Failed to get tenant status:", {
      error,
      tenantId,
    });
    throw error;
  }
}

/**
 * Export all functions for use in other modules
 */
export const RateLimitAdmin = {
  setBypass,
  setCustomMultiplier,
  removeCustomMultiplier,
  checkBypass,
  getCustomMultiplier,
  getAllTenantsStatus,
  getTenantStatus,
} as const;
