/**
 * Chaos Simulator Framework
 *
 * Orchestrates controlled failure injection for system resilience testing.
 * Supports Redis, worker, browser, network, and traffic chaos scenarios.
 */

import { logger } from "@/lib/logger";
import { getRedisConnection } from "@/lib/redis";

export type ChaosScenarioType =
  | "redis-unavailable"
  | "db-unavailable"
  | "worker-crash"
  | "browser-crash"
  | "network-timeout"
  | "anti-bot-spike"
  | "high-scale-tenant";

export interface ChaosScenarioConfig {
  type: ChaosScenarioType;
  durationMs: number;
  tenantId?: string;
  severity?: "low" | "medium" | "high"; // Impact on system
  failCriteria?: string[]; // Expected behaviors that indicate failure
}

export interface ChaosResult {
  scenario: ChaosScenarioType;
  durationMs: number;
  startedAt: Date;
  endedAt: Date;
  passed: boolean;
  failureReasons: string[];
  metrics: {
    jobsCompleted: number;
    jobsFailed: number;
    jobsTimeout: number;
    errorsEncountered: string[];
    recoveryDuration?: number;
  };
}

const CHAOS_STATE_KEY = "pp:chaos:active";
const CHAOS_METRICS_KEY = "pp:chaos:metrics";

export class ChaosSimulator {
  private isActive = false;

  /**
   * Check if chaos is currently active
   */
  async isChaosModeActive(): Promise<boolean> {
    try {
      const redis = getRedisConnection();
      const active = await redis.get(CHAOS_STATE_KEY);
      return active === "true";
    } catch (error) {
      logger.error("Failed to check chaos mode", { error });
      return false;
    }
  }

  /**
   * Get active scenario type
   */
  async getActiveScenario(): Promise<ChaosScenarioType | null> {
    try {
      const redis = getRedisConnection();
      const scenario = await redis.get(`${CHAOS_STATE_KEY}:type`);
      return (scenario as ChaosScenarioType) || null;
    } catch (error) {
      logger.error("Failed to get active scenario", { error });
      return null;
    }
  }

  /**
   * Inject a chaos scenario
   */
  async injectChaos(config: ChaosScenarioConfig): Promise<void> {
    try {
      const redis = getRedisConnection();

      // Check if chaos is already active
      if (this.isActive) {
        throw new Error("Chaos scenario already active");
      }

      this.isActive = true;

      // Set chaos flags in Redis
      await redis.setex(CHAOS_STATE_KEY, Math.ceil(config.durationMs / 1000), "true");
      await redis.setex(`${CHAOS_STATE_KEY}:type`, Math.ceil(config.durationMs / 1000), config.type);
      await redis.setex(
        `${CHAOS_STATE_KEY}:severity`,
        Math.ceil(config.durationMs / 1000),
        config.severity || "medium"
      );

      if (config.tenantId) {
        await redis.setex(
          `${CHAOS_STATE_KEY}:tenant`,
          Math.ceil(config.durationMs / 1000),
          config.tenantId
        );
      }

      logger.warn("Chaos scenario injected", {
        type: config.type,
        durationMs: config.durationMs,
        severity: config.severity,
      });

      // Auto-cleanup after duration
      setTimeout(() => {
        this.stopChaos().catch((error) => {
          logger.error("Failed to stop chaos scenario", { error });
        });
      }, config.durationMs);
    } catch (error) {
      logger.error("Failed to inject chaos", { error, config });
      this.isActive = false;
      throw error;
    }
  }

  /**
   * Stop active chaos scenario
   */
  async stopChaos(): Promise<void> {
    try {
      const redis = getRedisConnection();

      // Clear chaos flags
      await redis.del(CHAOS_STATE_KEY);
      await redis.del(`${CHAOS_STATE_KEY}:type`);
      await redis.del(`${CHAOS_STATE_KEY}:severity`);
      await redis.del(`${CHAOS_STATE_KEY}:tenant`);

      this.isActive = false;

      logger.info("Chaos scenario stopped");
    } catch (error) {
      logger.error("Failed to stop chaos", { error });
      throw error;
    }
  }

  /**
   * Record chaos metrics
   */
  async recordMetrics(scenarioType: ChaosScenarioType, metrics: Record<string, any>): Promise<void> {
    try {
      const redis = getRedisConnection();
      const timestamp = Date.now();
      const key = `${CHAOS_METRICS_KEY}:${scenarioType}:${timestamp}`;

      await redis.setex(key, 24 * 60 * 60, JSON.stringify({
        timestamp,
        ...metrics,
      }));

      logger.debug("Chaos metrics recorded", { scenario: scenarioType, metrics });
    } catch (error) {
      logger.error("Failed to record chaos metrics", { error });
    }
  }

  /**
   * Get metrics for a specific scenario
   */
  async getMetrics(scenarioType: ChaosScenarioType): Promise<any[]> {
    try {
      const redis = getRedisConnection();
      const pattern = `${CHAOS_METRICS_KEY}:${scenarioType}:*`;

      // Use SCAN for non-blocking iteration
      const keys: string[] = [];
      let cursor = "0";

      do {
        const [nextCursor, matchedKeys] = await redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100
        );
        keys.push(...matchedKeys);
        cursor = nextCursor;
      } while (cursor !== "0");

      const metrics: any[] = [];
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          metrics.push(JSON.parse(data));
        }
      }

      return metrics.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      logger.error("Failed to get chaos metrics", { error });
      return [];
    }
  }

  /**
   * Evaluate chaos scenario results against criteria
   */
  evaluateResults(config: ChaosScenarioConfig, result: ChaosResult): boolean {
    const failures: string[] = [];

    // Check for required successful behaviors
    if (config.failCriteria) {
      for (const criterion of config.failCriteria) {
        if (criterion === "zero-data-loss") {
          if (result.metrics.jobsFailed > 0) {
            failures.push("Expected zero job failures, but some jobs failed");
          }
        } else if (criterion === "no-hanging-jobs") {
          if (result.metrics.jobsTimeout > 0) {
            failures.push("Hanging jobs detected: jobs did not complete within timeout");
          }
        } else if (criterion === "graceful-degradation") {
          if (result.metrics.jobsCompleted === 0 && result.metrics.jobsFailed === 0) {
            failures.push("No graceful degradation: system appeared completely non-responsive");
          }
        } else if (criterion === "recovery-within-60s") {
          if (result.metrics.recoveryDuration && result.metrics.recoveryDuration > 60000) {
            failures.push(`Recovery took ${result.metrics.recoveryDuration}ms, exceeding 60s threshold`);
          }
        } else if (criterion === "sub-second-latency") {
          // Evaluated during scenario
        }
      }
    }

    result.failureReasons = failures;
    result.passed = failures.length === 0;

    return result.passed;
  }

  /**
   * Check if system is recovering from chaos
   */
  async isSystemRecovering(): Promise<boolean> {
    try {
      const redis = getRedisConnection();

      // Attempt Redis ping
      const pingResult = await redis.ping();
      if (pingResult !== "PONG") {
        return false;
      }

      // Check queue health
      const queueSize = await redis.llen("pp:queue:scraper");
      const dlqSize = await redis.llen("pp:dlq:scraper");

      // System is recovering if queues are not growing unboundedly
      const growthRate = dlqSize / (queueSize + 1); // Avoid division by zero
      return growthRate < 0.5; // Less than 50% DLQ rate
    } catch (error) {
      logger.debug("System not yet recovering", { error: (error as Error).message });
      return false;
    }
  }
}

export const chaosSimulator = new ChaosSimulator();

/**
 * Decorator for chaos-aware functions
 * Throws exception if matching chaos scenario is active
 */
export function chaosAware(scenario: ChaosScenarioType) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const isActive = await chaosSimulator.isChaosModeActive();
      const activeScenario = await chaosSimulator.getActiveScenario();

      if (isActive && activeScenario === scenario) {
        throw new Error(`Chaos scenario active: ${scenario}`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Wrapper function for chaos-aware operations
 */
export async function withChaosAwareness<T>(
  scenario: ChaosScenarioType,
  fn: () => Promise<T>
): Promise<T> {
  const isActive = await chaosSimulator.isChaosModeActive();
  const activeScenario = await chaosSimulator.getActiveScenario();

  if (isActive && activeScenario === scenario) {
    throw new Error(`Chaos scenario active: ${scenario}`);
  }

  return fn();
}
