#!/usr/bin/env ts-node
/**
 * Daily Query Metrics Aggregation Script
 * 
 * Aggregates slow query data into daily performance metrics.
 * Should be run daily via cron job.
 * 
 * Requirements: 1.5
 * 
 * Usage:
 *   ts-node scripts/aggregate-query-metrics.ts [date]
 * 
 * If no date is provided, aggregates for yesterday.
 */

import { PrismaClient } from '@prisma/client';
import { getQueryAnalyzer } from '@/lib/services/query-analyzer';

async function main() {
    const prisma = new PrismaClient();
    const queryAnalyzer = getQueryAnalyzer(prisma);

    try {
        // Get date to aggregate (default to yesterday)
        let targetDate: Date;
        if (process.argv[2]) {
            targetDate = new Date(process.argv[2]);
        } else {
            targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - 1);
        }

        // Set to start of day
        targetDate.setUTCHours(0, 0, 0, 0);

        console.log(`Aggregating query metrics for ${targetDate.toISOString().split('T')[0]}...`);

        const startTime = Date.now();
        await queryAnalyzer.aggregateDailyMetrics(targetDate);
        const duration = Date.now() - startTime;

        console.log(`✓ Aggregation completed in ${duration}ms`);

        // Get summary of aggregated data
        const metrics = await prisma.queryPerformanceMetric.findMany({
            where: {
                date: targetDate,
            },
            select: {
                queryFingerprint: true,
                executionCount: true,
                avgExecutionTimeMs: true,
                maxExecutionTimeMs: true,
            },
            orderBy: {
                avgExecutionTimeMs: 'desc',
            },
            take: 10,
        });

        console.log(`\nTop 10 slowest queries for ${targetDate.toISOString().split('T')[0]}:`);
        console.log('─'.repeat(80));
        metrics.forEach((metric, index) => {
            console.log(`${index + 1}. ${metric.queryFingerprint}`);
            console.log(`   Executions: ${metric.executionCount}`);
            console.log(`   Avg Time: ${metric.avgExecutionTimeMs}ms`);
            console.log(`   Max Time: ${metric.maxExecutionTimeMs}ms`);
            console.log('');
        });

    } catch (error) {
        console.error('Error aggregating query metrics:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
