import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { chaosSimulator, ChaosScenarioConfig } from "@/lib/testing/chaos-simulator";
import {
    simulateRedisUnavailable,
    simulateWorkerCrash,
    simulateBrowserCrash,
    simulateNetworkTimeoutFlood,
    simulateAntiBotSpike,
    simulateHighScaleTenant
} from "@/lib/testing/failure-scenarios";
import { withSecurity } from "@/lib/middleware/security-middleware";

/**
 * TRIGGER CHAOS
 * POST /api/v1/admin/chaos/inject
 */
async function injectChaosHandler(req: NextRequest) {
    try {
        const body = await req.json();
        const config = body as ChaosScenarioConfig;

        if (!config.type || !config.durationMs) {
            return NextResponse.json({ error: "Missing type or durationMs" }, { status: 400 });
        }

        // Start chaos in background (not awaiting the simulation itself as it runs for durationMs)
        let promise;
        switch (config.type) {
            case "redis-unavailable":
                promise = simulateRedisUnavailable(config);
                break;
            case "worker-crash":
                promise = simulateWorkerCrash(config);
                break;
            case "browser-crash":
                promise = simulateBrowserCrash(config);
                break;
            case "network-timeout":
                promise = simulateNetworkTimeoutFlood(config);
                break;
            case "anti-bot-spike":
                promise = simulateAntiBotSpike(config);
                break;
            case "high-scale-tenant":
                promise = simulateHighScaleTenant(config);
                break;
            case "db-unavailable":
                // This is handled by the middleware injection in instrumented-prisma.ts
                // We just need to set the state via injectChaos
                await chaosSimulator.injectChaos(config);
                return NextResponse.json({ message: "Chaos scenario injected (Prisma/DB)", config });
            default:
                return NextResponse.json({ error: `Unknown scenario: ${config.type}` }, { status: 400 });
        }

        // For non-DB scenarios, we use the specific simulate functions
        // which internally call injectChaos and then run the simulation logic
        // We don't await the promise here if we want to return immediately, 
        // but simulate functions in failure-scenarios.ts actually await the duration.
        // So let's run them without awaiting to return a 202.
        promise.catch(err => logger.error("Chaos simulation failed", { err }));

        return NextResponse.json({ message: `Chaos scenario ${config.type} initiated`, config }, { status: 202 });
    } catch (error) {
        logger.error("Failed to inject chaos", { error });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * STOP CHAOS
 * POST /api/v1/admin/chaos/stop
 */
async function stopChaosHandler() {
    try {
        await chaosSimulator.stopChaos();
        return NextResponse.json({ message: "Chaos scenario stopped" });
    } catch (error) {
        logger.error("Failed to stop chaos", { error });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * GET CHAOS STATUS
 * GET /api/v1/admin/chaos/status
 */
async function getChaosStatusHandler() {
    try {
        const active = await chaosSimulator.isChaosModeActive();
        const scenario = await chaosSimulator.getActiveScenario();

        // Get metrics for the last scenario
        const lastMetrics = scenario ? await chaosSimulator.getMetrics(scenario) : [];

        return NextResponse.json({
            active,
            scenario,
            metricsCount: lastMetrics.length,
            lastEvent: lastMetrics[lastMetrics.length - 1] || null
        });
    } catch (error) {
        logger.error("Failed to get chaos status", { error });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export const POST = withSecurity(async (req: NextRequest) => {
    const url = new URL(req.url);
    if (url.pathname.endsWith("/inject")) {
        return injectChaosHandler(req);
    } else if (url.pathname.endsWith("/stop")) {
        return stopChaosHandler();
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
});

export const GET = withSecurity(getChaosStatusHandler);
