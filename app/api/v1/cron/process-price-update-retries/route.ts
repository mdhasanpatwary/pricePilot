import { NextRequest, NextResponse } from "next/server";
import { priceUpdateMonitor } from "@/lib/services/price-update-monitor";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { withCronAuth } from "@/lib/middleware/cron-auth";

async function handlePOST(_req: NextRequest) {

/**
 * Process Price Update Retry Queue
 *
 * Cron job that processes failed price updates and retries them automatically.
 * Runs every 15 minutes to ensure high success rates.
 *
 * **Schedule:** Every 15 minutes
 * **Purpose:** Achieve >99% price update success rate
 *
 * **Process:**
 * 1. Get all tenants with pending retries
 * 2. Process retry queue for each tenant
 * 3. Log results and metrics
 *
 * @route POST /api/v1/cron/process-price-update-retries
 */
    try {

        logger.info("Starting price update retry queue processing");

        // Get all pending retries directly from the retry queue
        const pendingRetries = await prisma.priceUpdateRetryQueue.findMany({
            where: {
                nextRetryAt: { lte: new Date() },
                retryCount: { lt: 3 },
            },
            select: {
                tenantId: true,
            },
            distinct: ['tenantId'],
        });

        if (pendingRetries.length === 0) {
            logger.info("No pending retries found");
            return NextResponse.json({
                success: true,
                message: "No pending retries",
                processed: 0,
            });
        }

        // Get tenant details for the tenants with pending retries
        const tenantIds = pendingRetries.map(r => r.tenantId);
        const tenants = await prisma.tenant.findMany({
            where: {
                id: { in: tenantIds },
            },
            select: {
                id: true,
                companyName: true,
            },
        });

        logger.info(`Processing retries for ${tenants.length} tenants`);

        let totalProcessed = 0;

        for (const tenant of tenants) {
            try {
                const processed = await priceUpdateMonitor.processRetryQueue(tenant.id);
                totalProcessed += processed;

                logger.info(`Processed ${processed} retries for tenant ${tenant.companyName}`, {
                    tenantId: tenant.id,
                    processed,
                });
            } catch (error) {
                logger.error(`Failed to process retries for tenant ${tenant.companyName}`, {
                    error: error instanceof Error ? error.message : String(error),
                    tenantId: tenant.id,
                });
            }
        }

        logger.info(`Retry queue processing completed`, {
            tenantsProcessed: tenants.length,
            totalRetries: totalProcessed,
        });

        return NextResponse.json({
            success: true,
            message: `Processed ${totalProcessed} retries for ${tenants.length} tenants`,
            tenantsProcessed: tenants.length,
            totalRetries: totalProcessed,
        });
    } catch (error) {
        logger.error("Retry queue processing failed", {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    return withCronAuth(req, handlePOST);
}
