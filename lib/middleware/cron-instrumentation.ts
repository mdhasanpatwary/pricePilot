/**
 * Cron Instrumentation Middleware
 * 
 * Reusable wrapper for cron job routes that records execution duration
 * and handles common cron job requirements.
 */

import { NextRequest, NextResponse } from "next/server";
import { metricsCollector } from "@/lib/services/monitoring/metrics-collector";
import { logger } from "@/lib/logger";

/**
 * Wrap a cron job handler with duration tracking
 * 
 * @param jobKey - Unique key for the cron job (e.g., 'cleanup-sessions')
 * @param handler - The async handler for the cron job
 * @returns A wrapped handler that tracks duration
 */
export function withCronInstrumentation(
    jobKey: string,
    handler: (req: NextRequest) => Promise<NextResponse>
) {
    return async (req: NextRequest): Promise<NextResponse> => {
        const startTime = Date.now();

        try {
            const response = await handler(req);

            const durationMs = Date.now() - startTime;

            // Record duration to MetricsCollector (Phase 6)
            void metricsCollector.recordCronDuration(jobKey, durationMs).catch(err => {
                logger.error(`[CronMetrics] Failed to record duration for ${jobKey}`, err);
            });

            return response;
        } catch (error) {
            const durationMs = Date.now() - startTime;

            // Still record duration even on failure
            void metricsCollector.recordCronDuration(jobKey, durationMs).catch(() => { });

            logger.error(`[CronInstrumentation] Error in ${jobKey}:`, {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    };
}
