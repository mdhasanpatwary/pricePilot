/**
 * API Detection Metrics Tracker
 * 
 * Tracks and stores metrics for API detection operations including:
 * - Detection time and success rates
 * - Extraction time and product counts
 * - Cache hit rates
 * - Fallback rates
 * 
 * Requirements: 9.3
 */

import { prisma } from '@/lib/prisma';

export interface DetectionMetrics {
    tenantId: string;
    competitorWebsiteId: string;
    detectionTimeMs: number;
    success: boolean;
}

export interface ExtractionMetrics {
    tenantId: string;
    competitorWebsiteId: string;
    extractionTimeMs: number;
    productCount: number;
    success: boolean;
}

export interface CacheMetrics {
    tenantId: string;
    competitorWebsiteId: string;
    hit: boolean;
}

export interface FallbackMetrics {
    tenantId: string;
    competitorWebsiteId: string;
}

/**
 * API Detection Metrics Tracker
 * 
 * Aggregates and stores daily metrics for API detection operations
 */
export class ApiDetectionMetrics {
    /**
     * Track a detection attempt
     * 
     * @param metrics - Detection metrics
     */
    static async trackDetection(metrics: DetectionMetrics): Promise<void> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            await prisma.apiDetectionMetric.upsert({
                where: {
                    tenantId_competitorWebsiteId_date: {
                        tenantId: metrics.tenantId,
                        competitorWebsiteId: metrics.competitorWebsiteId,
                        date: today,
                    },
                },
                create: {
                    tenantId: metrics.tenantId,
                    competitorWebsiteId: metrics.competitorWebsiteId,
                    date: today,
                    detectionAttempts: 1,
                    successfulDetections: metrics.success ? 1 : 0,
                    failedDetections: metrics.success ? 0 : 1,
                    totalDetectionTimeMs: BigInt(metrics.detectionTimeMs),
                },
                update: {
                    detectionAttempts: { increment: 1 },
                    successfulDetections: metrics.success ? { increment: 1 } : undefined,
                    failedDetections: metrics.success ? undefined : { increment: 1 },
                    totalDetectionTimeMs: { increment: BigInt(metrics.detectionTimeMs) },
                    updatedAt: new Date(),
                },
            });
        } catch (error) {
            // Log error but don't throw - metrics tracking should not break the main flow
            console.error('Failed to track detection metrics:', error);
        }
    }

    /**
     * Track an extraction attempt
     * 
     * @param metrics - Extraction metrics
     */
    static async trackExtraction(metrics: ExtractionMetrics): Promise<void> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            await prisma.apiDetectionMetric.upsert({
                where: {
                    tenantId_competitorWebsiteId_date: {
                        tenantId: metrics.tenantId,
                        competitorWebsiteId: metrics.competitorWebsiteId,
                        date: today,
                    },
                },
                create: {
                    tenantId: metrics.tenantId,
                    competitorWebsiteId: metrics.competitorWebsiteId,
                    date: today,
                    totalExtractionTimeMs: BigInt(metrics.extractionTimeMs),
                    totalProductsExtracted: metrics.productCount,
                },
                update: {
                    totalExtractionTimeMs: { increment: BigInt(metrics.extractionTimeMs) },
                    totalProductsExtracted: { increment: metrics.productCount },
                    updatedAt: new Date(),
                },
            });
        } catch (error) {
            console.error('Failed to track extraction metrics:', error);
        }
    }

    /**
     * Track a cache operation
     * 
     * @param metrics - Cache metrics
     */
    static async trackCache(metrics: CacheMetrics): Promise<void> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            await prisma.apiDetectionMetric.upsert({
                where: {
                    tenantId_competitorWebsiteId_date: {
                        tenantId: metrics.tenantId,
                        competitorWebsiteId: metrics.competitorWebsiteId,
                        date: today,
                    },
                },
                create: {
                    tenantId: metrics.tenantId,
                    competitorWebsiteId: metrics.competitorWebsiteId,
                    date: today,
                    cacheHits: metrics.hit ? 1 : 0,
                    cacheMisses: metrics.hit ? 0 : 1,
                },
                update: {
                    cacheHits: metrics.hit ? { increment: 1 } : undefined,
                    cacheMisses: metrics.hit ? undefined : { increment: 1 },
                    updatedAt: new Date(),
                },
            });
        } catch (error) {
            console.error('Failed to track cache metrics:', error);
        }
    }

    /**
     * Track a fallback event
     * 
     * @param metrics - Fallback metrics
     */
    static async trackFallback(metrics: FallbackMetrics): Promise<void> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            await prisma.apiDetectionMetric.upsert({
                where: {
                    tenantId_competitorWebsiteId_date: {
                        tenantId: metrics.tenantId,
                        competitorWebsiteId: metrics.competitorWebsiteId,
                        date: today,
                    },
                },
                create: {
                    tenantId: metrics.tenantId,
                    competitorWebsiteId: metrics.competitorWebsiteId,
                    date: today,
                    fallbackCount: 1,
                },
                update: {
                    fallbackCount: { increment: 1 },
                    updatedAt: new Date(),
                },
            });
        } catch (error) {
            console.error('Failed to track fallback metrics:', error);
        }
    }

    /**
     * Get metrics for a specific competitor website
     * 
     * @param tenantId - Tenant ID
     * @param competitorWebsiteId - Competitor website ID
     * @param startDate - Start date for metrics
     * @param endDate - End date for metrics
     * @returns Aggregated metrics
     */
    static async getMetrics(
        tenantId: string,
        competitorWebsiteId: string,
        startDate: Date,
        endDate: Date
    ): Promise<{
        detectionSuccessRate: number;
        averageDetectionTimeMs: number;
        averageExtractionTimeMs: number;
        totalProductsExtracted: number;
        cacheHitRate: number;
        fallbackRate: number;
    }> {
        try {
            const metrics = await prisma.apiDetectionMetric.findMany({
                where: {
                    tenantId,
                    competitorWebsiteId,
                    date: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
            });

            if (metrics.length === 0) {
                return {
                    detectionSuccessRate: 0,
                    averageDetectionTimeMs: 0,
                    averageExtractionTimeMs: 0,
                    totalProductsExtracted: 0,
                    cacheHitRate: 0,
                    fallbackRate: 0,
                };
            }

            const totals = metrics.reduce(
                (acc, m) => ({
                    detectionAttempts: acc.detectionAttempts + m.detectionAttempts,
                    successfulDetections: acc.successfulDetections + m.successfulDetections,
                    totalDetectionTimeMs: acc.totalDetectionTimeMs + Number(m.totalDetectionTimeMs),
                    totalExtractionTimeMs: acc.totalExtractionTimeMs + Number(m.totalExtractionTimeMs),
                    totalProductsExtracted: acc.totalProductsExtracted + m.totalProductsExtracted,
                    cacheHits: acc.cacheHits + m.cacheHits,
                    cacheMisses: acc.cacheMisses + m.cacheMisses,
                    fallbackCount: acc.fallbackCount + m.fallbackCount,
                }),
                {
                    detectionAttempts: 0,
                    successfulDetections: 0,
                    totalDetectionTimeMs: 0,
                    totalExtractionTimeMs: 0,
                    totalProductsExtracted: 0,
                    cacheHits: 0,
                    cacheMisses: 0,
                    fallbackCount: 0,
                }
            );

            const detectionSuccessRate =
                totals.detectionAttempts > 0
                    ? (totals.successfulDetections / totals.detectionAttempts) * 100
                    : 0;

            const averageDetectionTimeMs =
                totals.successfulDetections > 0
                    ? totals.totalDetectionTimeMs / totals.successfulDetections
                    : 0;

            const averageExtractionTimeMs =
                totals.successfulDetections > 0
                    ? totals.totalExtractionTimeMs / totals.successfulDetections
                    : 0;

            const totalCacheOperations = totals.cacheHits + totals.cacheMisses;
            const cacheHitRate =
                totalCacheOperations > 0 ? (totals.cacheHits / totalCacheOperations) * 100 : 0;

            const fallbackRate =
                totals.detectionAttempts > 0
                    ? (totals.fallbackCount / totals.detectionAttempts) * 100
                    : 0;

            return {
                detectionSuccessRate,
                averageDetectionTimeMs,
                averageExtractionTimeMs,
                totalProductsExtracted: totals.totalProductsExtracted,
                cacheHitRate,
                fallbackRate,
            };
        } catch (error) {
            console.error('Failed to get metrics:', error);
            return {
                detectionSuccessRate: 0,
                averageDetectionTimeMs: 0,
                averageExtractionTimeMs: 0,
                totalProductsExtracted: 0,
                cacheHitRate: 0,
                fallbackRate: 0,
            };
        }
    }

    /**
     * Get metrics for all competitor websites for a tenant
     * 
     * @param tenantId - Tenant ID
     * @param startDate - Start date for metrics
     * @param endDate - End date for metrics
     * @returns Array of metrics per website
     */
    static async getTenantMetrics(
        tenantId: string,
        startDate: Date,
        endDate: Date
    ): Promise<
        Array<{
            competitorWebsiteId: string;
            detectionSuccessRate: number;
            averageDetectionTimeMs: number;
            averageExtractionTimeMs: number;
            totalProductsExtracted: number;
            cacheHitRate: number;
            fallbackRate: number;
        }>
    > {
        try {
            const metrics = await prisma.apiDetectionMetric.findMany({
                where: {
                    tenantId,
                    date: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
            });

            // Group by competitor website
            const grouped = metrics.reduce((acc, m) => {
                if (!acc[m.competitorWebsiteId]) {
                    acc[m.competitorWebsiteId] = [];
                }
                acc[m.competitorWebsiteId].push(m);
                return acc;
            }, {} as Record<string, typeof metrics>);

            // Calculate metrics for each website
            return Object.entries(grouped).map(([competitorWebsiteId, websiteMetrics]) => {
                const totals = websiteMetrics.reduce(
                    (acc, m) => ({
                        detectionAttempts: acc.detectionAttempts + m.detectionAttempts,
                        successfulDetections: acc.successfulDetections + m.successfulDetections,
                        totalDetectionTimeMs: acc.totalDetectionTimeMs + Number(m.totalDetectionTimeMs),
                        totalExtractionTimeMs: acc.totalExtractionTimeMs + Number(m.totalExtractionTimeMs),
                        totalProductsExtracted: acc.totalProductsExtracted + m.totalProductsExtracted,
                        cacheHits: acc.cacheHits + m.cacheHits,
                        cacheMisses: acc.cacheMisses + m.cacheMisses,
                        fallbackCount: acc.fallbackCount + m.fallbackCount,
                    }),
                    {
                        detectionAttempts: 0,
                        successfulDetections: 0,
                        totalDetectionTimeMs: 0,
                        totalExtractionTimeMs: 0,
                        totalProductsExtracted: 0,
                        cacheHits: 0,
                        cacheMisses: 0,
                        fallbackCount: 0,
                    }
                );

                const detectionSuccessRate =
                    totals.detectionAttempts > 0
                        ? (totals.successfulDetections / totals.detectionAttempts) * 100
                        : 0;

                const averageDetectionTimeMs =
                    totals.successfulDetections > 0
                        ? totals.totalDetectionTimeMs / totals.successfulDetections
                        : 0;

                const averageExtractionTimeMs =
                    totals.successfulDetections > 0
                        ? totals.totalExtractionTimeMs / totals.successfulDetections
                        : 0;

                const totalCacheOperations = totals.cacheHits + totals.cacheMisses;
                const cacheHitRate =
                    totalCacheOperations > 0 ? (totals.cacheHits / totalCacheOperations) * 100 : 0;

                const fallbackRate =
                    totals.detectionAttempts > 0
                        ? (totals.fallbackCount / totals.detectionAttempts) * 100
                        : 0;

                return {
                    competitorWebsiteId,
                    detectionSuccessRate,
                    averageDetectionTimeMs,
                    averageExtractionTimeMs,
                    totalProductsExtracted: totals.totalProductsExtracted,
                    cacheHitRate,
                    fallbackRate,
                };
            });
        } catch (error) {
            console.error('Failed to get tenant metrics:', error);
            return [];
        }
    }
}
