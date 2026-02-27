import { NextRequest, NextResponse } from "next/server";
import { getDeadLetterQueue } from "@/lib/queue/client";
import { metricsCollector } from "@/lib/services/monitoring/metrics-collector";
import { withCronInstrumentation } from "@/lib/middleware/cron-instrumentation";
import { withRequestContextOnly } from "@/lib/middleware/with-request-context";

async function handleGET(req: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        console.log("📦 Monitoring DLQ length...");
        const dlq = getDeadLetterQueue();
        const counts = await dlq.getJobCounts();
        const total = Object.values(counts).reduce((sum, v) => sum + (v || 0), 0);

        console.log(`Dead-letter queue '${dlq.name}' contains ${total} entries`);

        // Record DLQ length to MetricsCollector (Phase 6)
        await metricsCollector.recordDLQLength(dlq.name, total);

        return NextResponse.json({
            success: true,
            queueName: dlq.name,
            length: total,
        });
    } catch (error) {
        console.error('[MonitorDLQ] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to monitor DLQ',
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return withRequestContextOnly(req, withCronInstrumentation('monitor-dlq', handleGET));
}
