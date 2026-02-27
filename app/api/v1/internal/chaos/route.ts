/**
 * Chaos Simulation API Endpoints
 *
 * Internal-only endpoints for injecting failure scenarios and monitoring results.
 * Requires INTERNAL_MODE=true in production.
 *
 * Routes:
 * POST   /api/v1/internal/chaos/inject - Start a chaos scenario
 * POST   /api/v1/internal/chaos/stop - Stop active scenario
 * GET    /api/v1/internal/chaos/[chaosId]/status - Check scenario status
 * GET    /api/v1/internal/chaos/[chaosId]/results - Get scenario results
 * GET    /api/v1/internal/chaos/metrics/[scenario] - Get metrics for scenario
 * DELETE /api/v1/internal/chaos/metrics/[scenario] - Clear metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { withInternalGate } from "@/lib/middleware/internal-gate";
import { logger } from "@/lib/logger";
import {
  chaosSimulator,
  ChaosScenarioConfig,
  ChaosScenarioType,
} from "@/lib/testing/chaos-simulator";
import {
  simulateRedisUnavailable,
  simulateWorkerCrash,
  simulateBrowserCrash,
  simulateNetworkTimeoutFlood,
  simulateAntiBotSpike,
  simulateHighScaleTenant,
  simulateDbUnavailable,
} from "@/lib/testing/failure-scenarios";

// Map scenario types to handler functions
const SCENARIO_HANDLERS: Record<
  ChaosScenarioType,
  (config: ChaosScenarioConfig) => Promise<any>
> = {
  "redis-unavailable": simulateRedisUnavailable,
  "worker-crash": simulateWorkerCrash,
  "browser-crash": simulateBrowserCrash,
  "network-timeout": simulateNetworkTimeoutFlood,
  "anti-bot-spike": simulateAntiBotSpike,
  "high-scale-tenant": simulateHighScaleTenant,
  "db-unavailable": simulateDbUnavailable,
};

/**
 * POST /api/v1/internal/chaos/inject
 * Inject a chaos scenario
 */
export async function POST(req: NextRequest) {
  return withInternalGate(req, async () => {
    try {
      const body = await req.json();
      const config: ChaosScenarioConfig = {
        type: body.type,
        durationMs: body.durationMs || 10000,
        tenantId: body.tenantId,
        severity: body.severity || "medium",
        failCriteria: body.failCriteria || [],
      };

      // Validate scenario type
      if (!SCENARIO_HANDLERS[config.type]) {
        return NextResponse.json(
          { error: `Unknown scenario type: ${config.type}` },
          { status: 400 }
        );
      }

      // Check if chaos is already active
      const isActive = await chaosSimulator.isChaosModeActive();
      if (isActive) {
        return NextResponse.json(
          {
            error: "Chaos scenario already active",
            activeScenario: await chaosSimulator.getActiveScenario(),
          },
          { status: 409 }
        );
      }

      // Inject chaos and run scenario
      await chaosSimulator.injectChaos(config);

      const chaosId = `chaos-${Date.now()}`;
      const handler = SCENARIO_HANDLERS[config.type];

      // Run scenario in background
      handler(config)
        .then((result) => {
          // Store result
          chaosSimulator.recordMetrics(config.type, result).catch((error) => {
            logger.error("Failed to record chaos metrics", { error });
          });
        })
        .catch((error) => {
          logger.error("Chaos scenario failed", { error, type: config.type });
        })
        .finally(() => {
          setTimeout(() => {
            chaosSimulator.stopChaos().catch((error) => {
              logger.error("Failed to stop chaos", { error });
            });
          }, config.durationMs);
        });

      return NextResponse.json(
        {
          chaosId,
          scenario: config.type,
          durationMs: config.durationMs,
          startedAt: new Date(),
        },
        { status: 200 }
      );
    } catch (error) {
      logger.error("Failed to inject chaos", { error });
      return NextResponse.json(
        { error: "Failed to inject chaos scenario" },
        { status: 500 }
      );
    }
  });
}
