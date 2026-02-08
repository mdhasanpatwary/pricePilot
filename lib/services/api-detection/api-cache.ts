/**
 * API Cache Component
 * 
 * Stores and retrieves discovered API patterns for reuse across scraping operations.
 * Implements caching with metrics tracking and automatic invalidation.
 */

import { prisma } from '@/lib/prisma';
import type { APIPattern } from '@/lib/types/api-detection';
import { ApiDetectionLogger } from './api-detection-logger';
import { ApiDetectionMetrics } from './api-detection-metrics';

/**
 * APICache class manages persistent storage of API patterns
 * with success/failure tracking and automatic invalidation
 */
export class APICache {
    /**
     * Maximum consecutive failures before automatic invalidation
     */
    private readonly MAX_CONSECUTIVE_FAILURES = 3;

    /**
     * Store API pattern for a competitor website
     * 
     * @param websiteId - Competitor website ID
     * @param pattern - Validated API pattern to store
     * @throws Error if database operation fails
     */
    async storePattern(websiteId: string, pattern: Omit<APIPattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
        try {
            // Prepare pattern data for storage as JSON
            const patternData = JSON.parse(JSON.stringify({
                url: pattern.url,
                method: pattern.method,
                headers: pattern.headers,
                queryParams: pattern.queryParams,
                bodyTemplate: pattern.bodyTemplate,
                responseFormat: pattern.responseFormat,
                dataPath: pattern.dataPath,
                fieldMappings: pattern.fieldMappings,
                paginationPattern: pattern.paginationPattern,
            }));

            // Upsert pattern (insert or update if exists)
            await prisma.apiPattern.upsert({
                where: {
                    competitorWebsiteId: websiteId,
                },
                create: {
                    tenantId: pattern.tenantId,
                    competitorWebsiteId: websiteId,
                    pattern: patternData,
                    confidenceScore: pattern.confidenceScore,
                    successCount: pattern.successCount || 0,
                    failureCount: pattern.failureCount || 0,
                    lastUsedAt: pattern.lastUsedAt || null,
                },
                update: {
                    pattern: patternData,
                    confidenceScore: pattern.confidenceScore,
                    updatedAt: new Date(),
                },
            });

            // Log cache operation
            ApiDetectionLogger.logCacheOperation({
                competitorWebsiteId: websiteId,
                operation: 'store',
                success: true,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Log failed cache operation
            ApiDetectionLogger.logCacheOperation({
                competitorWebsiteId: websiteId,
                operation: 'store',
                success: false,
                error: errorMessage,
            });

            throw new Error(`Failed to store API pattern: ${errorMessage}`);
        }
    }

    /**
     * Retrieve cached API pattern for a competitor website
     * 
     * @param websiteId - Competitor website ID
     * @returns Cached pattern or null if not found
     * @throws Error if database operation fails
     */
    async getPattern(websiteId: string): Promise<APIPattern | null> {
        try {
            const cached = await prisma.apiPattern.findUnique({
                where: {
                    competitorWebsiteId: websiteId,
                },
            });

            if (!cached) {
                // Log cache miss
                ApiDetectionLogger.logCacheOperation({
                    competitorWebsiteId: websiteId,
                    operation: 'miss',
                    success: true,
                });

                // Track cache miss metric
                const pattern = await prisma.apiPattern.findFirst({
                    where: { competitorWebsiteId: websiteId },
                    select: { tenantId: true },
                });

                if (pattern) {
                    await ApiDetectionMetrics.trackCache({
                        tenantId: pattern.tenantId,
                        competitorWebsiteId: websiteId,
                        hit: false,
                    });
                }

                return null;
            }

            // Log cache hit
            ApiDetectionLogger.logCacheOperation({
                competitorWebsiteId: websiteId,
                operation: 'hit',
                success: true,
            });

            // Track cache hit metric
            await ApiDetectionMetrics.trackCache({
                tenantId: cached.tenantId,
                competitorWebsiteId: websiteId,
                hit: true,
            });

            // Reconstruct APIPattern from database record
            const pattern = cached.pattern as any;

            return {
                id: cached.id,
                tenantId: cached.tenantId,
                competitorWebsiteId: cached.competitorWebsiteId,
                url: pattern.url,
                method: pattern.method,
                headers: pattern.headers || {},
                queryParams: pattern.queryParams || {},
                bodyTemplate: pattern.bodyTemplate,
                responseFormat: pattern.responseFormat,
                dataPath: pattern.dataPath,
                fieldMappings: pattern.fieldMappings || [],
                confidenceScore: cached.confidenceScore,
                paginationPattern: pattern.paginationPattern,
                successCount: cached.successCount,
                failureCount: cached.failureCount,
                lastUsedAt: cached.lastUsedAt || undefined,
                createdAt: cached.createdAt,
                updatedAt: cached.updatedAt,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Log failed cache operation
            ApiDetectionLogger.logCacheOperation({
                competitorWebsiteId: websiteId,
                operation: 'hit',
                success: false,
                error: errorMessage,
            });

            throw new Error(`Failed to retrieve API pattern: ${errorMessage}`);
        }
    }

    /**
     * Invalidate cached pattern (remove from database)
     * 
     * @param websiteId - Competitor website ID
     * @throws Error if database operation fails
     */
    async invalidatePattern(websiteId: string): Promise<void> {
        try {
            await prisma.apiPattern.delete({
                where: {
                    competitorWebsiteId: websiteId,
                },
            });

            // Log cache invalidation
            ApiDetectionLogger.logCacheOperation({
                competitorWebsiteId: websiteId,
                operation: 'invalidate',
                success: true,
            });
        } catch (error) {
            // If pattern doesn't exist, that's fine (already invalidated)
            if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
                ApiDetectionLogger.logCacheOperation({
                    competitorWebsiteId: websiteId,
                    operation: 'invalidate',
                    success: true,
                });
                return;
            }

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Log failed cache operation
            ApiDetectionLogger.logCacheOperation({
                competitorWebsiteId: websiteId,
                operation: 'invalidate',
                success: false,
                error: errorMessage,
            });

            throw new Error(`Failed to invalidate API pattern: ${errorMessage}`);
        }
    }

    /**
     * Update pattern success/failure metrics
     * 
     * @param websiteId - Competitor website ID
     * @param success - Whether extraction succeeded
     * @throws Error if database operation fails
     */
    async updateMetrics(websiteId: string, success: boolean): Promise<void> {
        try {
            const pattern = await prisma.apiPattern.findUnique({
                where: {
                    competitorWebsiteId: websiteId,
                },
            });

            if (!pattern) {
                // Pattern doesn't exist, nothing to update
                return;
            }

            // Calculate new metrics
            const newSuccessCount = success ? pattern.successCount + 1 : pattern.successCount;
            const newFailureCount = success ? 0 : pattern.failureCount + 1; // Reset on success

            // Check if we should auto-invalidate due to consecutive failures
            if (newFailureCount >= this.MAX_CONSECUTIVE_FAILURES) {
                await this.invalidatePattern(websiteId);
                return;
            }

            // Update metrics
            await prisma.apiPattern.update({
                where: {
                    competitorWebsiteId: websiteId,
                },
                data: {
                    successCount: newSuccessCount,
                    failureCount: newFailureCount,
                    lastUsedAt: new Date(),
                    updatedAt: new Date(),
                },
            });
        } catch (error) {
            throw new Error(`Failed to update API pattern metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get all cached patterns for a tenant
     * 
     * @param tenantId - Tenant ID
     * @returns Array of cached patterns
     * @throws Error if database operation fails
     */
    async getPatternsByTenant(tenantId: string): Promise<APIPattern[]> {
        try {
            const cached = await prisma.apiPattern.findMany({
                where: {
                    tenantId,
                },
                orderBy: {
                    lastUsedAt: 'desc',
                },
            });

            return cached.map(record => {
                const pattern = record.pattern as any;

                return {
                    id: record.id,
                    tenantId: record.tenantId,
                    competitorWebsiteId: record.competitorWebsiteId,
                    url: pattern.url,
                    method: pattern.method,
                    headers: pattern.headers || {},
                    queryParams: pattern.queryParams || {},
                    bodyTemplate: pattern.bodyTemplate,
                    responseFormat: pattern.responseFormat,
                    dataPath: pattern.dataPath,
                    fieldMappings: pattern.fieldMappings || [],
                    confidenceScore: record.confidenceScore,
                    paginationPattern: pattern.paginationPattern,
                    successCount: record.successCount,
                    failureCount: record.failureCount,
                    lastUsedAt: record.lastUsedAt || undefined,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt,
                };
            });
        } catch (error) {
            throw new Error(`Failed to retrieve patterns by tenant: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get cache statistics for monitoring
     * 
     * @param tenantId - Optional tenant ID to filter by
     * @returns Cache statistics
     */
    async getCacheStats(tenantId?: string): Promise<{
        totalPatterns: number;
        avgSuccessRate: number;
        avgConfidenceScore: number;
        patternsWithFailures: number;
    }> {
        try {
            const where = tenantId ? { tenantId } : {};

            const patterns = await prisma.apiPattern.findMany({
                where,
                select: {
                    successCount: true,
                    failureCount: true,
                    confidenceScore: true,
                },
            });

            if (patterns.length === 0) {
                return {
                    totalPatterns: 0,
                    avgSuccessRate: 0,
                    avgConfidenceScore: 0,
                    patternsWithFailures: 0,
                };
            }

            const totalPatterns = patterns.length;
            const totalSuccess = patterns.reduce((sum, p) => sum + p.successCount, 0);
            const totalAttempts = patterns.reduce((sum, p) => sum + p.successCount + p.failureCount, 0);
            const avgSuccessRate = totalAttempts > 0 ? totalSuccess / totalAttempts : 0;
            const avgConfidenceScore = patterns.reduce((sum, p) => sum + p.confidenceScore, 0) / totalPatterns;
            const patternsWithFailures = patterns.filter(p => p.failureCount > 0).length;

            return {
                totalPatterns,
                avgSuccessRate,
                avgConfidenceScore,
                patternsWithFailures,
            };
        } catch (error) {
            throw new Error(`Failed to get cache stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// Export singleton instance
export const apiCache = new APICache();
