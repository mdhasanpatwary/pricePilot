import { NextRequest, NextResponse } from "next/server";
import { rateLimiters, getRateLimitIdentifier, checkRateLimit } from "@/lib/ratelimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PlanType } from "@prisma/client";
import { 
  getPlanMultiplier, 
  getEffectiveLimit, 
  RateLimiterType
} from "@/lib/services/rate-limit-config";
import { checkBypass, getCustomMultiplier } from "@/lib/services/rate-limit-admin";
import { recordHit, recordViolation } from "@/lib/services/rate-limit-metrics";
import { logger } from "@/lib/logger";

/**
 * Rate limit middleware wrapper for Next.js API routes with tenant-based limits
 * 
 * This middleware:
 * - Extracts tenant and plan information from session
 * - Checks for admin bypasses
 * - Applies plan-based multipliers to base limits
 * - Tracks metrics for monitoring
 * - Generates alerts on threshold violations
 * 
 * Usage: export async function POST(req: NextRequest) { return withRateLimit(req, 'auth', handler); }
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 3.1, 3.2, 3.3, 4.3, 4.4, 8.7
 */
export async function withRateLimit(
  req: NextRequest,
  limiterType: keyof typeof rateLimiters,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Get user session if available
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    const tenantId = session?.user?.tenantId || null;

    // Get tenant information for plan-based limits
    let planType: PlanType = "BASIC";
    let effectiveMultiplier = 1.0;
    let bypassActive = false;

    if (tenantId) {
      // Check if tenant has an active bypass
      bypassActive = await checkBypass(tenantId);

      if (bypassActive) {
        // Bypass active - skip rate limiting
        logger.info("[RateLimit] Bypass active, skipping rate limit", {
          tenantId,
          limiterType,
        });

        // Execute handler without rate limiting
        const response = await handler(req);

        // Still add headers to indicate bypass
        response.headers.set("X-RateLimit-Bypass", "true");

        return response;
      }

      // Get tenant plan and custom multiplier
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { planType: true },
      });

      if (tenant) {
        planType = tenant.planType;

        // Check for custom multiplier (overrides plan multiplier)
        const customMultiplier = await getCustomMultiplier(tenantId);
        effectiveMultiplier = customMultiplier ?? getPlanMultiplier(planType);
      }
    }

    // Get identifier for rate limiting (include plan info for better tracking)
    const baseIdentifier = getRateLimitIdentifier(req, userId);
    const identifier = tenantId 
      ? `${baseIdentifier}:tenant:${tenantId}:plan:${planType}` 
      : baseIdentifier;

    // Get the appropriate rate limiter
    const limiter = rateLimiters[limiterType];

    // Calculate effective limit based on plan multiplier
    const effectiveLimit = tenantId 
      ? getEffectiveLimit(limiterType as RateLimiterType, planType, effectiveMultiplier !== getPlanMultiplier(planType) ? effectiveMultiplier : null)
      : undefined;

    // Check rate limit
    const { success, limit, remaining, reset } = await checkRateLimit(limiter, identifier);

    // Adjust limit and remaining based on effective multiplier if tenant exists
    const adjustedLimit = effectiveLimit ?? limit;
    const adjustedRemaining = effectiveLimit 
      ? Math.floor(remaining * effectiveMultiplier) 
      : remaining;

    if (!success) {
      // Record violation asynchronously (non-blocking)
      if (tenantId) {
        recordViolation(
          tenantId,
          limiterType as RateLimiterType,
          baseIdentifier,
          req.nextUrl.pathname
        ).catch((error) => {
          logger.error("[RateLimit] Failed to record violation:", { error });
        });
      }

      // Return 429 with enhanced error response
      return createEnhancedRateLimitResponse(
        adjustedLimit,
        adjustedRemaining,
        reset,
        limiterType
      );
    }

    // Record hit asynchronously (non-blocking)
    if (tenantId) {
      recordHit(
        tenantId,
        limiterType as RateLimiterType,
        baseIdentifier,
        req.nextUrl.pathname
      ).catch((error) => {
        logger.error("[RateLimit] Failed to record hit:", { error });
      });
    }

    // Execute handler
    const response = await handler(req);

    // Add rate limit headers to successful responses
    response.headers.set("X-RateLimit-Limit", adjustedLimit.toString());
    response.headers.set("X-RateLimit-Remaining", adjustedRemaining.toString());
    response.headers.set("X-RateLimit-Reset", reset.toString());
    
    // Add plan information for debugging
    if (tenantId) {
      response.headers.set("X-RateLimit-Plan", planType);
      response.headers.set("X-RateLimit-Multiplier", effectiveMultiplier.toString());
    }

    return response;
  } catch (error) {
    // If rate limiting fails, log but don't block the request (fail open)
    logger.error("[RateLimit] Error checking rate limit:", { error });
    return handler(req);
  }
}

/**
 * Create enhanced rate limit response with limiter type information
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */
function createEnhancedRateLimitResponse(
  limit: number,
  remaining: number,
  reset: number,
  limiterType: string
): NextResponse {
  const retryAfter = Math.ceil((reset - Date.now()) / 1000);

  return new NextResponse(
    JSON.stringify({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Rate limit exceeded. Please try again later.",
        details: {
          limiterType,
          retryAfter,
        },
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
        "Retry-After": retryAfter.toString(),
        "X-RateLimit-Type": limiterType,
      },
    }
  );
}

/**
 * Determine rate limiter type based on HTTP method and path
 */
export function getRateLimiterType(method: string, pathname: string): keyof typeof rateLimiters {
  // Auth endpoints - strict rate limiting
  if (pathname.includes("/auth/") || pathname.includes("/register")) {
    return "auth";
  }

  // Sync operations - very strict
  if (pathname.includes("/sync") || pathname.includes("/competitors/sync")) {
    return "sync";
  }

  // Import/Export - moderate
  if (pathname.includes("/import") || pathname.includes("/export")) {
    return "importExport";
  }

  // Write operations (POST, PUT, DELETE)
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    return "write";
  }

  // Read operations (GET)
  if (method === "GET") {
    return "read";
  }

  // Default to general API rate limit
  return "api";
}

