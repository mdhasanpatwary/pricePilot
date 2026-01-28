/**
 * Rate Limit Configuration Service
 * 
 * Manages plan-based rate limit multipliers, endpoint limits,
 * and alert thresholds for the rate limiting system.
 * 
 * Requirements: 2.3, 2.4, 3.5
 */

import { PlanType } from "@prisma/client";

/**
 * Plan-based rate limit multipliers
 * These multipliers are applied to base rate limits to adjust limits based on subscription tier
 */
export const PLAN_MULTIPLIERS: Record<PlanType, number> = {
  BASIC: 1.0,    // Base tier - no multiplier
  PREMIUM: 2.0,  // 2x the base limits
  PRO: 5.0,      // 5x the base limits
} as const;

/**
 * Base endpoint rate limits (requests per time window)
 * These are the base limits before plan multipliers are applied
 */
export const ENDPOINT_LIMITS = {
  auth: {
    requests: 5,
    window: "15 m",
    windowMs: 15 * 60 * 1000, // 15 minutes in milliseconds
    description: "Authentication endpoints (login, register)",
  },
  api: {
    requests: 100,
    window: "1 m",
    windowMs: 60 * 1000, // 1 minute in milliseconds
    description: "General API endpoints",
  },
  read: {
    requests: 200,
    window: "1 m",
    windowMs: 60 * 1000, // 1 minute in milliseconds
    description: "Read-only operations (GET requests)",
  },
  write: {
    requests: 30,
    window: "1 m",
    windowMs: 60 * 1000, // 1 minute in milliseconds
    description: "Write operations (POST, PUT, DELETE)",
  },
  sync: {
    requests: 5,
    window: "5 m",
    windowMs: 5 * 60 * 1000, // 5 minutes in milliseconds
    description: "Resource-intensive sync operations",
  },
  importExport: {
    requests: 10,
    window: "1 m",
    windowMs: 60 * 1000, // 1 minute in milliseconds
    description: "Import and export operations",
  },
} as const;

/**
 * Alert thresholds for rate limit violations
 * When violations exceed these thresholds, alerts are generated
 */
export const ALERT_THRESHOLDS = {
  violationsPerHour: 10,   // Alert if tenant exceeds 10 violations in 1 hour
  violationsPerDay: 100,   // Alert if tenant exceeds 100 violations in 24 hours
  violationRatePercent: 20, // Alert if violation rate exceeds 20% of total requests
} as const;

/**
 * Rate limiter type definitions
 */
export type RateLimiterType = keyof typeof ENDPOINT_LIMITS;

/**
 * Get the plan multiplier for a given plan type
 * 
 * @param planType - The subscription plan type
 * @returns The multiplier to apply to base rate limits
 * 
 * @example
 * ```typescript
 * const multiplier = getPlanMultiplier('PREMIUM'); // Returns 2.0
 * const effectiveLimit = baseLimit * multiplier;
 * ```
 */
export function getPlanMultiplier(planType: PlanType): number {
  return PLAN_MULTIPLIERS[planType];
}

/**
 * Calculate effective rate limit for a tenant based on their plan
 * 
 * @param limiterType - The type of rate limiter
 * @param planType - The tenant's subscription plan
 * @param customMultiplier - Optional custom multiplier set by admin (overrides plan multiplier)
 * @returns The effective rate limit (requests per window)
 * 
 * @example
 * ```typescript
 * // BASIC plan with read limiter: 200 * 1.0 = 200 requests/minute
 * const basicLimit = getEffectiveLimit('read', 'BASIC');
 * 
 * // PREMIUM plan with read limiter: 200 * 2.0 = 400 requests/minute
 * const premiumLimit = getEffectiveLimit('read', 'PREMIUM');
 * 
 * // Custom multiplier overrides plan multiplier: 200 * 3.5 = 700 requests/minute
 * const customLimit = getEffectiveLimit('read', 'BASIC', 3.5);
 * ```
 */
export function getEffectiveLimit(
  limiterType: RateLimiterType,
  planType: PlanType,
  customMultiplier?: number | null
): number {
  const baseLimit = ENDPOINT_LIMITS[limiterType].requests;
  const multiplier = customMultiplier ?? getPlanMultiplier(planType);
  return Math.floor(baseLimit * multiplier);
}

/**
 * Get the time window for a rate limiter in milliseconds
 * 
 * @param limiterType - The type of rate limiter
 * @returns The time window in milliseconds
 */
export function getWindowMs(limiterType: RateLimiterType): number {
  return ENDPOINT_LIMITS[limiterType].windowMs;
}

/**
 * Get the time window for a rate limiter as a human-readable string
 * 
 * @param limiterType - The type of rate limiter
 * @returns The time window as a string (e.g., "1 m", "15 m")
 */
export function getWindowString(limiterType: RateLimiterType): string {
  return ENDPOINT_LIMITS[limiterType].window;
}

/**
 * Get all rate limiter configurations
 * Useful for documentation and admin dashboards
 * 
 * @returns Array of rate limiter configurations with descriptions
 */
export function getAllLimiterConfigs() {
  return Object.entries(ENDPOINT_LIMITS).map(([type, config]) => ({
    type: type as RateLimiterType,
    ...config,
  }));
}

/**
 * Validate custom multiplier value
 * Custom multipliers must be between 0.1 and 100
 * 
 * @param multiplier - The multiplier value to validate
 * @returns True if valid, false otherwise
 */
export function isValidMultiplier(multiplier: number): boolean {
  return multiplier >= 0.1 && multiplier <= 100;
}

/**
 * Configuration export for use in other modules
 */
export const RateLimitConfig = {
  planMultipliers: PLAN_MULTIPLIERS,
  endpointLimits: ENDPOINT_LIMITS,
  alertThresholds: ALERT_THRESHOLDS,
  getPlanMultiplier,
  getEffectiveLimit,
  getWindowMs,
  getWindowString,
  getAllLimiterConfigs,
  isValidMultiplier,
} as const;
