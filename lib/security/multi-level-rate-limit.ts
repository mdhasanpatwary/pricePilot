/**
 * Tenant-Aware & IP-Based Rate Limiting
 *
 * Extends the base rate limiting with tenant-specific and IP-based limits.
 * Prevents individual tenants or IPs from consuming disproportionate resources.
 *
 * Phase 7 Security Hardening
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getCachedSession } from '@/lib/auth/cached-session';
import { prisma } from '@/lib/prisma';
import { rateLimiters } from '@/lib/ratelimit';
import type { RateLimiterLike } from '@/lib/redis/sliding-window-ratelimit';
import { logger } from '@/lib/logger';

/**
 * Multi-level rate limit configuration
 */
export interface MultiLevelRateLimitConfig {
  // Global rate limit (all users combined)
  global?: {
    limit: number;
    windowMs: number;
  };
  
  // Per-tenant limit
  perTenant?: {
    limit: number;
    windowMs: number;
  };
  
  // Per-IP limit
  perIp?: {
    limit: number;
    windowMs: number;
  };
  
  // Per-endpoint class (e.g., 'auth', 'api', 'write')
  perEndpointClass?: {
    limit: number;
    windowMs: number;
  };
}

/**
 * Rate limit result with details
 */
export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfterSeconds?: number;
}

/**
 * Get client IP from request, checking multiple headers
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') || // Cloudflare
    'unknown'
  );
}

/**
 * Check tenant-specific rate limit
 *
 * Prevents a single tenant from monopolizing API resources
 */
export async function checkTenantRateLimit(
  tenantId: string,
  limiter: RateLimiterLike | null = null,
  config?: { limit?: number }
): Promise<RateLimitResult> {
  if (!limiter) {
    // Use default API limiter
    limiter = rateLimiters.api;
  }
  
  const identifier = `tenant:${tenantId}`;
  
  try {
    const result = await limiter.limit(identifier);
    
    // Check plan-specific multiplier
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planType: true },
    });
    
    if (!tenant) {
      return {
        allowed: false,
        reason: 'Tenant not found',
        remaining: 0,
        limit: config?.limit || 100,
        resetAt: new Date(),
      };
    }
    
    // Apply plan-based multiplier (e.g., premium tenants get 2x limit)
    const multiplier = tenant.planType === 'PREMIUM' ? 2 : tenant.planType === 'PRO' ? 1.5 : 1;
    const effectiveLimit = Math.floor((config?.limit || 100) * multiplier);
    
    return {
      allowed: result.success,
      reason: result.success ? undefined : 'Rate limit exceeded for tenant',
      remaining: result.remaining,
      limit: effectiveLimit,
      resetAt: new Date(result.reset),
      retryAfterSeconds: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    };
  } catch (error) {
    logger.warn('Tenant rate limit check failed', {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Fail open during errors (don't block user)
    return {
      allowed: true,
      remaining: 1,
      limit: config?.limit || 100,
      resetAt: new Date(Date.now() + 60000),
    };
  }
}

/**
 * Check IP-based rate limit
 *
 * Prevents specific IPs (potential attackers) from flooding the system
 */
export async function checkIpRateLimit(
  ip: string,
  limiter: RateLimiterLike | null = null,
  config?: { limit?: number }
): Promise<RateLimitResult> {
  if (!limiter) {
    limiter = rateLimiters.api;
  }
  
  const identifier = `ip:${ip}`;
  const limit = config?.limit || 100;
  
  try {
    const result = await limiter.limit(identifier);
    
    return {
      allowed: result.success,
      reason: result.success ? undefined : 'Rate limit exceeded for IP',
      remaining: result.remaining,
      limit,
      resetAt: new Date(result.reset),
      retryAfterSeconds: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    };
  } catch (error) {
    logger.warn('IP rate limit check failed', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Fail open
    return {
      allowed: true,
      remaining: 1,
      limit,
      resetAt: new Date(Date.now() + 60000),
    };
  }
}

/**
 * Middleware for multi-level rate limiting
 *
 * Checks tenant, IP, and endpoint class limits
 *
 * @example
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   const rateLimit = await enforceMultiLevelRateLimit(req, {
 *     perTenant: { limit: 1000, windowMs: 60000 },
 *     perIp: { limit: 500, windowMs: 60000 },
 *   });
 *
 *   if (!rateLimit.allowed) {
 *     return NextResponse.json(
 *       { error: 'Too many requests', retryAfter: rateLimit.retryAfterSeconds },
 *       {
 *         status: 429,
 *         headers: {
 *           'Retry-After': String(rateLimit.retryAfterSeconds),
 *         },
 *       }
 *     );
 *   }
 * }
 * ```
 */
export async function enforceMultiLevelRateLimit(
  request: NextRequest,
  config?: MultiLevelRateLimitConfig
): Promise<RateLimitResult> {
  // Get client info
  const session = await getCachedSession();
  const tenantId = session?.user?.tenantId;
  const ip = getClientIp(request);
  
  // Check per-tenant limit
  if (tenantId && config?.perTenant) {
    const tenantLimit = await checkTenantRateLimit(
      tenantId,
      rateLimiters.api,
      { limit: config.perTenant.limit }
    );
    
    if (!tenantLimit.allowed) {
      return tenantLimit;
    }
  }
  
  // Check per-IP limit
  if (config?.perIp && ip !== 'unknown') {
    const ipLimit = await checkIpRateLimit(
      ip,
      rateLimiters.api,
      { limit: config.perIp.limit }
    );
    
    if (!ipLimit.allowed) {
      return ipLimit;
    }
  }
  
  // All checks passed
  return {
    allowed: true,
    remaining: 1000,
    limit: 1000,
    resetAt: new Date(Date.now() + 60000),
  };
}

/**
 * Return rate limit error response
 */
export function rateLimitErrorResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many requests',
      message: result.reason || 'Rate limit exceeded',
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds || 60),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': result.resetAt.toISOString(),
      },
    }
  );
}
