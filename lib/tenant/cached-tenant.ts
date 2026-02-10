/**
 * Cached Tenant Lookup
 * 
 * Provides request-scoped caching for tenant database lookups.
 * Eliminates duplicate tenant queries within the same request.
 * 
 * Usage:
 * ```typescript
 * import { getCachedTenant } from '@/lib/tenant/cached-tenant';
 * 
 * const tenant = await getCachedTenant(tenantId);
 * ```
 */

import { prisma } from "@/lib/prisma";
import { PlanType } from "@prisma/client";
import { getOrSetRequestCache, hasRequestContext } from "@/lib/cache/request-cache";

/**
 * Tenant data structure for caching
 */
export interface CachedTenantData {
    id: string;
    planType: PlanType;
    companyName: string;
}

/**
 * Get tenant with request-scoped caching
 * 
 * First call fetches from database and caches result.
 * Subsequent calls within same request return cached value.
 * 
 * Falls back to direct query if no request context exists.
 * 
 * @param tenantId - Tenant ID to lookup
 * @returns Tenant data or null if not found
 * 
 * @example
 * ```typescript
 * // First call - fetches from database
 * const tenant1 = await getCachedTenant(tenantId);
 * 
 * // Second call - returns cached value (no database query)
 * const tenant2 = await getCachedTenant(tenantId);
 * ```
 */
export async function getCachedTenant(
    tenantId: string
): Promise<CachedTenantData | null> {
    const cacheKey = `tenant:${tenantId}`;

    // Fallback to direct query if no request context
    if (!hasRequestContext()) {
        return prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                id: true,
                planType: true,
                companyName: true,
            },
        });
    }

    // Use cached value or fetch and cache
    return getOrSetRequestCache(cacheKey, async () => {
        return prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                id: true,
                planType: true,
                companyName: true,
            },
        });
    });
}

/**
 * Get tenant plan type with caching
 * 
 * Convenience helper to extract plan type without accessing full tenant object.
 * 
 * @param tenantId - Tenant ID to lookup
 * @returns Plan type or null if tenant not found
 */
export async function getCachedTenantPlan(
    tenantId: string
): Promise<PlanType | null> {
    const tenant = await getCachedTenant(tenantId);
    return tenant?.planType || null;
}

/**
 * Get tenant company name with caching
 * 
 * @param tenantId - Tenant ID to lookup
 * @returns Company name or null if tenant not found
 */
export async function getCachedTenantName(
    tenantId: string
): Promise<string | null> {
    const tenant = await getCachedTenant(tenantId);
    return tenant?.companyName || null;
}
