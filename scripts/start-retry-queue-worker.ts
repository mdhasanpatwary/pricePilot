#!/usr/bin/env ts-node

/**
 * Retry Queue Worker
 * 
 * Background worker that processes the retry queue for failed scraping requests.
 * This script should be run as a separate process or scheduled job.
 * 
 * Usage:
 *   ts-node scripts/start-retry-queue-worker.ts
 * 
 * Or with custom interval (in milliseconds):
 *   ts-node scripts/start-retry-queue-worker.ts 30000
 */

import { RetryQueueProcessor } from '@/lib/services/retry-queue-processor';
import { logger } from '@/lib/logger';

async function main() {
    // Get processing interval from command line args (default: 60000ms = 1 minute)
    const intervalMs = parseInt(process.argv[2] || '60000', 10);

    logger.info(`[RetryQueueWorker] Starting retry queue worker with interval ${intervalMs}ms`);

    const processor = RetryQueueProcessor.getInstance();

    // Start the processor
    await processor.start(intervalMs);

    // Handle graceful shutdown
    const shutdown = async () => {
        logger.info('[RetryQueueWorker] Shutting down...');
        await processor.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    logger.info('[RetryQueueWorker] Worker started successfully. Press Ctrl+C to stop.');
}

main().catch((error) => {
    logger.error('[RetryQueueWorker] Fatal error:', { error });
    process.exit(1);
});
