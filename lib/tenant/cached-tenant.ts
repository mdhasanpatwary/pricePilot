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
    competitorLimit: number;
    storeLimit: number;
    currency: string;
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
                competitorLimit: true,
                storeLimit: true,
                currency: true,
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
                competitorLimit: true,
                storeLimit: true,
                currency: true,
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

/**
 * Detect tenant currency with caching
 *
 * Check products -> sites -> tenant for currency setting.
 * Cached per request to avoid multiple queries.
 */
export async function getTenantCurrency(tenantId: string): Promise<string> {
    const cacheKey = `tenant-currency:${tenantId}`;

    // Use cached value
    if (hasRequestContext()) {
        return getOrSetRequestCache(cacheKey, async () => {
            // 1. Check products
            const anyUserProduct = await prisma.product.findFirst({
                where: { tenantId, Site: { type: "USER" } },
                select: { currency: true },
                orderBy: { createdAt: "desc" },
            });
            if (anyUserProduct?.currency) return anyUserProduct.currency;

            // 2. Check sites
            const userSite = await prisma.site.findFirst({
                where: { tenantId, type: "USER" },
                orderBy: { createdAt: "desc" },
                select: { currency: true },
            });
            if (userSite?.currency) return userSite.currency;

            // 3. Fallback to tenant default
            const tenant = await getCachedTenant(tenantId);
            return tenant?.currency || "USD";
        });
    }

    // Fallback (no cache context)
    // 1. Check products
    const anyUserProduct = await prisma.product.findFirst({
        where: { tenantId, Site: { type: "USER" } },
        select: { currency: true },
        orderBy: { createdAt: "desc" },
    });
    if (anyUserProduct?.currency) return anyUserProduct.currency;

    // 2. Check sites
    const userSite = await prisma.site.findFirst({
        where: { tenantId, type: "USER" },
        orderBy: { createdAt: "desc" },
        select: { currency: true },
    });
    if (userSite?.currency) return userSite.currency;

    // 3. Fallback to tenant default
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { currency: true },
    });
    return tenant?.currency || "USD";
}
