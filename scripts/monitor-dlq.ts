import { getDeadLetterQueue } from "../lib/queue/client";
import { OperationalMetricsService } from "../lib/services/observability/operational-metrics";

/**
 * Simple one-off script to sample dead-letter queue length and report a metric.
 * Intended to be run periodically via cron/worker or as part of a monitoring pipeline.
 */

async function run() {
  console.log("📦 Monitoring DLQ length...");
  const dlq = getDeadLetterQueue();
  const counts = await dlq.getJobCounts();
  const total = Object.values(counts).reduce((sum, v) => sum + (v || 0), 0);
  console.log(`Dead-letter queue '${dlq.name}' contains ${total} entries`);

  try {
    await OperationalMetricsService.recordDLQLength(dlq.name, total);
    console.log("Metric recorded successfully.");
  } catch (err) {
    console.error("Failed to record DLQ metric", err);
  }
}

if (require.main === module) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
