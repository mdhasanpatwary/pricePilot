import { ScrapeFailureType } from "@prisma/client";

export type RefreshDecisionInput = {
  volatilityScore: number;
  inStock: boolean;
  consecutiveFailures: number;
  lastFailureType: ScrapeFailureType | null;
  domainPenaltyLevel: number;
};

export type RefreshDecision = {
  nextScrapeAt: Date;
  refreshIntervalMs: number;
  reason: string;
};

export type PriorityInput = {
  volatilityScore: number;
  consecutiveFailures: number;
  lastFailedAt: Date | null;
  inStock: boolean;
  businessPriority: number;
  domainPriorityPenalty: number;
};

export type PriorityDecision = {
  priorityScore: number;
  bullmqPriority: number; // smaller = higher priority
};

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export class ScrapeSchedulingService {
  static computeRefreshDecision(input: RefreshDecisionInput, now: Date = new Date()): RefreshDecision {
    const v = clamp(input.volatilityScore, 0, 1);

    // Base interval from volatility.
    // High: every few hours, Medium: daily, Stable: multi-day.
    let baseMs =
      v >= 0.7 ? 4 * 60 * 60 * 1000 :
      v >= 0.3 ? 24 * 60 * 60 * 1000 :
      72 * 60 * 60 * 1000;
    let reason = `volatility=${v.toFixed(2)}`;

    // Out-of-stock => low frequency.
    if (!input.inStock) {
      baseMs = Math.max(baseMs, 7 * 24 * 60 * 60 * 1000);
      reason = `${reason}; oos`;
    }

    // Recently failed => temporary higher priority, but respect failure type.
    if (input.consecutiveFailures > 0) {
      const f = Math.min(input.consecutiveFailures, 10);
      const backoffMs = Math.min(12 * 60 * 60 * 1000, 30 * 60 * 1000 * Math.pow(2, f - 1));

      if (input.lastFailureType === ScrapeFailureType.BOT_BLOCKED) {
        // Back off hard on blocks.
        baseMs = Math.max(baseMs, 6 * 60 * 60 * 1000, backoffMs);
        reason = `${reason}; blocked_backoff`;
      } else if (input.lastFailureType === ScrapeFailureType.TIMEOUT) {
        baseMs = Math.max(60 * 60 * 1000, Math.min(baseMs, backoffMs));
        reason = `${reason}; timeout_retry`;
      } else {
        // Parse/structure/navigation failures: retry sooner, but cap.
        baseMs = Math.min(baseMs, Math.max(30 * 60 * 1000, backoffMs));
        reason = `${reason}; retry(f=${f})`;
      }
    }

    // Adaptive throttling: penalty level increases the interval.
    if (input.domainPenaltyLevel > 0) {
      const penaltyMultiplier = 1 + Math.min(2, input.domainPenaltyLevel * 0.15);
      baseMs = Math.round(baseMs * penaltyMultiplier);
      reason = `${reason}; domain_penalty=${input.domainPenaltyLevel}`;
    }

    const refreshIntervalMs = clamp(baseMs, 15 * 60 * 1000, 30 * 24 * 60 * 60 * 1000);
    return {
      nextScrapeAt: new Date(now.getTime() + refreshIntervalMs),
      refreshIntervalMs,
      reason,
    };
  }

  static computePriority(input: PriorityInput): PriorityDecision {
    const v = clamp(input.volatilityScore, 0, 1);

    // Priority score in ~[0, 200+] range.
    const volatilityWeight = v * 100;
    const failureWeight = Math.min(60, Math.max(0, input.consecutiveFailures) * 15);
    const businessWeight = clamp(input.businessPriority, 0, 10) * 10;
    const oosPenalty = input.inStock ? 0 : 20;

    // Bonus for very recent failure (try again sooner), up to a cap.
    const recencyBonus = (() => {
      if (!input.lastFailedAt) return 0;
      const ageMs = Date.now() - input.lastFailedAt.getTime();
      if (ageMs < 0) return 0;
      if (ageMs <= 2 * 60 * 60 * 1000) return 25;
      if (ageMs <= 12 * 60 * 60 * 1000) return 10;
      return 0;
    })();

    const priorityScore =
      volatilityWeight +
      failureWeight +
      businessWeight +
      recencyBonus -
      oosPenalty -
      Math.max(0, input.domainPriorityPenalty);

    // BullMQ priority: 1 is highest. Keep within a safe band.
    const bullmqPriority = clamp(1000 - Math.round(priorityScore), 1, 1000);

    return {
      priorityScore,
      bullmqPriority,
    };
  }
}

