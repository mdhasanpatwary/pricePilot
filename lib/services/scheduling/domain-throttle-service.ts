import { getRedisConnection } from "@/lib/queue/connection";
import { ScrapeFailureType } from "@prisma/client";

export type DomainThrottleState = {
  penaltyLevel: number; // 0..10
  minIntervalMs: number;
  maxConcurrent: number;
  priorityPenalty: number;
  cooldownUntilMs?: number;
  updatedAtMs: number;
};

function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

export class DomainThrottleService {
  static normalizeDomain(domain: string): string {
    return (domain || "").trim().toLowerCase().replace(/^www\./, "");
  }

  static getKey(domain: string): string {
    return `pp:domain:throttle:${this.normalizeDomain(domain)}`;
  }

  static async get(domain: string): Promise<DomainThrottleState> {
    const redis = getRedisConnection();
    const key = this.getKey(domain);
    const raw = await redis.get(key);
    if (!raw) {
      return {
        penaltyLevel: 0,
        minIntervalMs: 1500,
        maxConcurrent: 2,
        priorityPenalty: 0,
        updatedAtMs: Date.now(),
      };
    }

    try {
      const parsed = JSON.parse(raw) as Partial<DomainThrottleState>;
      const penaltyLevel = clampInt(parsed.penaltyLevel ?? 0, 0, 10);
      const minIntervalMs = clampInt(parsed.minIntervalMs ?? 1500, 250, 60000);
      const maxConcurrent = clampInt(parsed.maxConcurrent ?? 2, 1, 5);
      const priorityPenalty = clampInt(parsed.priorityPenalty ?? 0, 0, 200);
      const cooldownUntilMs =
        typeof parsed.cooldownUntilMs === "number" ? parsed.cooldownUntilMs : undefined;

      return {
        penaltyLevel,
        minIntervalMs,
        maxConcurrent,
        priorityPenalty,
        cooldownUntilMs,
        updatedAtMs: typeof parsed.updatedAtMs === "number" ? parsed.updatedAtMs : Date.now(),
      };
    } catch {
      return {
        penaltyLevel: 0,
        minIntervalMs: 1500,
        maxConcurrent: 2,
        priorityPenalty: 0,
        updatedAtMs: Date.now(),
      };
    }
  }

  static async recordAttempt(params: {
    domain: string;
    success: boolean;
    failureType: ScrapeFailureType | null;
    statusCode: number | null;
  }): Promise<DomainThrottleState> {
    const redis = getRedisConnection();
    const domain = this.normalizeDomain(params.domain);
    const key = this.getKey(domain);

    const current = await this.get(domain);
    let level = current.penaltyLevel;
    let cooldownUntilMs = current.cooldownUntilMs;

    const isBlock =
      params.failureType === ScrapeFailureType.BOT_BLOCKED ||
      params.statusCode === 403 ||
      params.statusCode === 429;
    const isTimeout = params.failureType === ScrapeFailureType.TIMEOUT || params.statusCode === 408;

    if (params.success) {
      level = clampInt(level - 1, 0, 10);
    } else if (isBlock) {
      level = clampInt(level + 2, 0, 10);
      cooldownUntilMs = Date.now() + 15 * 60 * 1000; // 15 min cooldown on block spikes
    } else if (isTimeout) {
      level = clampInt(level + 1, 0, 10);
    } else {
      // Other failures slightly increase pressure.
      level = clampInt(level + 0, 0, 10);
    }

    const minIntervalMs = clampInt(1500 + level * 1500, 250, 60000);
    const maxConcurrent = level >= 6 ? 1 : 2;
    const priorityPenalty = clampInt(level * 12, 0, 200);

    const next: DomainThrottleState = {
      penaltyLevel: level,
      minIntervalMs,
      maxConcurrent,
      priorityPenalty,
      cooldownUntilMs,
      updatedAtMs: Date.now(),
    };

    // TTL keeps Redis clean even if domains disappear.
    await redis.set(key, JSON.stringify(next), "EX", 6 * 60 * 60);

    return next;
  }
}

