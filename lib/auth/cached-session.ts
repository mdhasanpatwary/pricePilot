/**
 * Cached Session Lookup
 * 
 * Provides request-scoped caching for NextAuth session lookups.
 * Eliminates duplicate session queries within the same request.
 * 
 * Usage:
 * ```typescript
 * import { getCachedSession } from '@/lib/auth/cached-session';
 * 
 * const session = await getCachedSession();
 * ```
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrSetRequestCache, hasRequestContext } from "@/lib/cache/request-cache";

const SESSION_CACHE_KEY = "auth:session";

/**
 * Get session with request-scoped caching
 * 
 * First call fetches from database and caches result.
 * Subsequent calls within same request return cached value.
 * 
 * Falls back to direct query if no request context exists.
 * 
 * @returns Session object or null if not authenticated
 * 
 * @example
 * ```typescript
 * // First call - fetches from database
 * const session1 = await getCachedSession();
 * 
 * // Second call - returns cached value (no database query)
 * const session2 = await getCachedSession();
 * ```
 */
export async function getCachedSession() {
    // Fallback to direct query if no request context
    if (!hasRequestContext()) {
        return getServerSession(authOptions);
    }

    // Use cached value or fetch and cache
    return getOrSetRequestCache(SESSION_CACHE_KEY, async () => {
        return await getServerSession(authOptions);
    });
}

/**
 * Get user ID from cached session
 * 
 * Convenience helper to extract user ID without accessing session object.
 * 
 * @returns User ID or null if not authenticated
 */
export async function getCachedUserId(): Promise<string | null> {
    const session = await getCachedSession();
    return session?.user?.id || null;
}

/**
 * Get tenant ID from cached session
 * 
 * Convenience helper to extract tenant ID without accessing session object.
 * 
 * @returns Tenant ID or null if not authenticated
 */
export async function getCachedTenantId(): Promise<string | null> {
    const session = await getCachedSession();
    return session?.user?.tenantId || null;
}

/**
 * Check if user is super admin from cached session
 * 
 * @returns True if user is super admin, false otherwise
 */
export async function isCachedSuperAdmin(): Promise<boolean> {
    const session = await getCachedSession();
    return session?.user?.isSuperAdmin || false;
}

/**
 * Get user role from cached session
 * 
 * @returns User role or null if not authenticated
 */
export async function getCachedUserRole(): Promise<string | null> {
    const session = await getCachedSession();
    return session?.user?.role || null;
}
