/**
 * Job Priority Calculation for Fair-Share Multi-Tenant Queueing
 *
 * Objectives:
 * - Ensure small jobs (delta syncs) have higher priority than large batch jobs.
 * - Allow high-tier tenants to have higher baseline priority.
 * - Support manual boosts for urgent/on-demand requests.
 *
 * BullMQ Priority: 1 is the highest priority, higher numbers are lower priority.
 */

export interface PriorityFactors {
  tenantTier: "FREE" | "STANDARD" | "PREMIUM" | "ENTERPRISE";
  jobSize: number; // Number of items in the job
  manualBoost?: number; // 0 (standard) to 5 (extreme boost)
}

const TIER_WEIGHTS = {
  ENTERPRISE: 10,
  PREMIUM: 30,
  STANDARD: 50,
  FREE: 100,
};

/**
 * Calculates BullMQ priority (1 = highest, >1 = lower)
 */
export function calculateJobPriority(factors: PriorityFactors): number {
  const { tenantTier, jobSize, manualBoost = 0 } = factors;

  // 1. Base Tier Priority (lower value = higher priority)
  let baseWeight = TIER_WEIGHTS[tenantTier] || TIER_WEIGHTS.FREE;

  // 2. Size Penalty (larger jobs get lower priority)
  // small (< 50): -10 (boost)
  // medium (50-500): +0
  // large (> 500): +50 (penalty)
  let sizeWeight = 0;
  if (jobSize < 50) {
    sizeWeight = -10;
  } else if (jobSize > 500) {
    sizeWeight = 50;
  }

  // 3. Manual Boost (increases priority, so subtracts from weight)
  const boostWeight = manualBoost * 15;

  // Calculate final priority
  // We ensure it never goes below 1
  const priority = Math.max(1, baseWeight + sizeWeight - boostWeight);

  return Math.floor(priority);
}
