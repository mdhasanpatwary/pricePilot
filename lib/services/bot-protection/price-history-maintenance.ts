/**
 * Price History Maintenance Service
 * 
 * Maintains price history during scraping failures by recording gaps
 * and preserving historical trends.
 * 
 * Requirements: 14.6
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Record price history gap
 * 
 * When scraping fails but we have a last known good price, we record
 * the last known good price in the history to maintain continuity.
 * This allows us to show gaps in data collection on charts.
 * 
 * Requirements: 14.6
 * 
 * @param competitorProductId - Competitor product ID
 * @param reason - Reason for the gap (e.g., "scraping_failed", "protection_detected")
 */
export async function recordPriceHistoryGap(
    competitorProductId: string,
    reason: string
): Promise<void> {
    try {
        // Get product with last known good price
        const product = await prisma.product.findUnique({
            where: { id: competitorProductId },
            select: {
                id: true,
                title: true,
                lastKnownGoodPrice: true,
                lastKnownGoodPriceAt: true,
            },
        });

        if (!product) {
            logger.warn('[PriceHistoryMaintenance] Product not found', {
                competitorProductId,
            });
            return;
        }

        // If we have a last known good price, record it in history
        // This maintains continuity and shows the gap
        if (product.lastKnownGoodPrice && product.lastKnownGoodPriceAt) {
            await prisma.priceHistory.create({
                data: {
                    productId: competitorProductId,
                    price: product.lastKnownGoodPrice,
                    recordedAt: new Date(),
                },
            });

            logger.info('[PriceHistoryMaintenance] Recorded price history gap', {
                competitorProductId,
                productTitle: product.title,
                lastKnownGoodPrice: product.lastKnownGoodPrice.toString(),
                reason,
            });
        } else {
            logger.debug('[PriceHistoryMaintenance] No last known good price to record', {
                competitorProductId,
                reason,
            });
        }
    } catch (error) {
        logger.error('[PriceHistoryMaintenance] Error recording price history gap', {
            competitorProductId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't throw - this is a non-critical operation
    }
}

/**
 * Get price history with gaps
 * 
 * Retrieves price history for a product, including information about gaps
 * in data collection.
 * 
 * Requirements: 14.6
 * 
 * @param competitorProductId - Competitor product ID
 * @param startDate - Start date for history (optional)
 * @param endDate - End date for history (optional)
 * @returns Price history with gap information
 */
export async function getPriceHistoryWithGaps(
    competitorProductId: string,
    startDate?: Date,
    endDate?: Date
): Promise<PriceHistoryPoint[]> {
    try {
        // Build where clause
        const where: any = {
            productId: competitorProductId,
        };

        if (startDate || endDate) {
            where.recordedAt = {};
            if (startDate) {
                where.recordedAt.gte = startDate;
            }
            if (endDate) {
                where.recordedAt.lte = endDate;
            }
        }

        // Fetch price history
        const history = await prisma.priceHistory.findMany({
            where,
            orderBy: {
                recordedAt: 'asc',
            },
            select: {
                id: true,
                price: true,
                recordedAt: true,
            },
        });

        // Convert to price history points with gap detection
        const points: PriceHistoryPoint[] = [];
        let previousTimestamp: Date | null = null;

        for (const record of history) {
            const point: PriceHistoryPoint = {
                id: record.id,
                price: Number(record.price),
                recordedAt: record.recordedAt,
                hasGapBefore: false,
            };

            // Detect gap (more than 2 days since last record)
            if (previousTimestamp) {
                const timeDiff = record.recordedAt.getTime() - previousTimestamp.getTime();
                const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

                if (daysDiff > 2) {
                    point.hasGapBefore = true;
                    point.gapDuration = Math.floor(daysDiff);
                }
            }

            points.push(point);
            previousTimestamp = record.recordedAt;
        }

        return points;
    } catch (error) {
        logger.error('[PriceHistoryMaintenance] Error getting price history with gaps', {
            competitorProductId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
    }
}

/**
 * Price history point with gap information
 */
export interface PriceHistoryPoint {
    id: string;
    price: number;
    recordedAt: Date;
    hasGapBefore: boolean;
    gapDuration?: number; // Duration of gap in days
}

/**
 * Get price history summary
 * 
 * Returns summary statistics about price history including gap information.
 * 
 * Requirements: 14.6
 * 
 * @param competitorProductId - Competitor product ID
 * @param days - Number of days to analyze (default: 30)
 * @returns Price history summary
 */
export async function getPriceHistorySummary(
    competitorProductId: string,
    days: number = 30
): Promise<PriceHistorySummary> {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const history = await getPriceHistoryWithGaps(competitorProductId, startDate);

        if (history.length === 0) {
            return {
                totalRecords: 0,
                gapCount: 0,
                totalGapDays: 0,
                averageGapDays: 0,
                dataCompleteness: 0,
                oldestRecord: null,
                newestRecord: null,
            };
        }

        // Calculate statistics
        const gapRecords = history.filter((p) => p.hasGapBefore);
        const totalGapDays = gapRecords.reduce((sum, p) => sum + (p.gapDuration || 0), 0);
        const averageGapDays = gapRecords.length > 0 ? totalGapDays / gapRecords.length : 0;

        // Calculate data completeness (percentage of days with data)
        const expectedRecords = days; // Assuming daily scraping
        const dataCompleteness = (history.length / expectedRecords) * 100;

        return {
            totalRecords: history.length,
            gapCount: gapRecords.length,
            totalGapDays,
            averageGapDays,
            dataCompleteness,
            oldestRecord: history[0].recordedAt,
            newestRecord: history[history.length - 1].recordedAt,
        };
    } catch (error) {
        logger.error('[PriceHistoryMaintenance] Error getting price history summary', {
            competitorProductId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return {
            totalRecords: 0,
            gapCount: 0,
            totalGapDays: 0,
            averageGapDays: 0,
            dataCompleteness: 0,
            oldestRecord: null,
            newestRecord: null,
        };
    }
}

/**
 * Price history summary
 */
export interface PriceHistorySummary {
    totalRecords: number;
    gapCount: number;
    totalGapDays: number;
    averageGapDays: number;
    dataCompleteness: number; // Percentage
    oldestRecord: Date | null;
    newestRecord: Date | null;
}
