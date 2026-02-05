/**
 * Documentation Analytics Service
 * 
 * Provides analytics tracking and metrics aggregation for the dual documentation system.
 * Tracks page views, search queries, and user feedback while respecting privacy (no PII).
 */

import { prisma } from '@/lib/prisma';
import { DocumentationType } from '@prisma/client';
import type {
    TimeRange,
    PageMetric,
    SearchMetric,
    BounceRateMetric,
    RelatedPageMetric,
    FeedbackSummary,
    FeedbackComment,
} from './types';

/**
 * Analytics Service
 * 
 * Handles all analytics tracking and metrics aggregation for documentation.
 */
export class AnalyticsService {
    /**
     * Convert portal type string to Prisma enum
     */
    private toDocumentationType(type: 'tenant' | 'admin'): DocumentationType {
        return type === 'tenant' ? DocumentationType.TENANT : DocumentationType.ADMIN;
    }

    /**
     * Track a page view event
     * 
     * Records when a user views a documentation page. Only stores user ID (pseudonymous),
     * no personally identifiable information.
     * 
     * @param documentId - ID of the document being viewed
     * @param type - Portal type ('tenant' or 'admin')
     * @param userId - Optional user ID (pseudonymous identifier)
     * @param sessionId - Optional session ID for tracking user journeys
     * @param timeOnPage - Optional time spent on page in seconds
     */
    async trackPageView(
        documentId: string,
        type: 'tenant' | 'admin',
        userId?: string,
        sessionId?: string,
        timeOnPage?: number
    ): Promise<void> {
        try {
            await prisma.documentationPageView.create({
                data: {
                    documentId,
                    type: this.toDocumentationType(type),
                    userId,
                    sessionId,
                    timeOnPage,
                    viewedAt: new Date(),
                },
            });
        } catch (error) {
            // Log error but don't throw - analytics failures shouldn't break page rendering
            console.error('Failed to track page view:', error);
        }
    }

    /**
     * Track a search query
     * 
     * Records search queries to understand what users are looking for and improve
     * search relevance over time.
     * 
     * @param query - The search query text
     * @param type - Portal type ('tenant' or 'admin')
     * @param resultsCount - Number of results returned
     * @param clickedResultId - Optional ID of result that was clicked
     */
    async trackSearch(
        query: string,
        type: 'tenant' | 'admin',
        resultsCount: number,
        clickedResultId?: string
    ): Promise<void> {
        try {
            await prisma.documentationSearch.create({
                data: {
                    query,
                    type: this.toDocumentationType(type),
                    resultsCount,
                    clickedResultId,
                    searchedAt: new Date(),
                },
            });
        } catch (error) {
            console.error('Failed to track search:', error);
        }
    }

    /**
     * Track user feedback on a documentation page
     * 
     * Records user ratings and comments to identify documentation quality issues.
     * Only stores user ID (pseudonymous), no PII.
     * 
     * @param documentId - ID of the document being rated
     * @param rating - Rating from 1-5
     * @param comment - Optional feedback comment
     * @param userId - Optional user ID (pseudonymous identifier)
     */
    async trackFeedback(
        documentId: string,
        rating: number,
        comment?: string,
        userId?: string
    ): Promise<void> {
        // Validate rating is in valid range
        if (rating < 1 || rating > 5) {
            throw new Error('Rating must be between 1 and 5');
        }

        try {
            await prisma.documentationFeedback.create({
                data: {
                    documentId,
                    rating,
                    comment,
                    userId,
                    createdAt: new Date(),
                },
            });
        } catch (error) {
            console.error('Failed to track feedback:', error);
            throw error; // Throw for feedback since user expects confirmation
        }
    }

    /**
     * Get popular pages by view count
     * 
     * Returns the most viewed documentation pages within a time range.
     * 
     * @param type - Portal type ('tenant' or 'admin')
     * @param timeRange - Time range for metrics
     * @param limit - Maximum number of results (default: 10)
     * @returns Array of page metrics sorted by view count
     */
    async getPopularPages(
        type: 'tenant' | 'admin',
        timeRange: TimeRange,
        limit: number = 10
    ): Promise<PageMetric[]> {
        try {
            const docType = this.toDocumentationType(type);

            // Aggregate page views within time range
            const pageViews = await prisma.documentationPageView.groupBy({
                by: ['documentId'],
                where: {
                    type: docType,
                    viewedAt: {
                        gte: timeRange.start,
                        lte: timeRange.end,
                    },
                },
                _count: {
                    id: true,
                },
                _avg: {
                    timeOnPage: true,
                },
                orderBy: {
                    _count: {
                        id: 'desc',
                    },
                },
                take: limit,
            });

            // Get unique visitors count for each document
            const metrics: PageMetric[] = [];

            for (const view of pageViews) {
                // Get document details
                const document = await prisma.documentationDocument.findUnique({
                    where: { id: view.documentId },
                    select: { title: true, slug: true },
                });

                if (!document) continue;

                // Count unique visitors (by userId and sessionId)
                const uniqueVisitors = await prisma.documentationPageView.groupBy({
                    by: ['userId', 'sessionId'],
                    where: {
                        documentId: view.documentId,
                        type: docType,
                        viewedAt: {
                            gte: timeRange.start,
                            lte: timeRange.end,
                        },
                    },
                });

                metrics.push({
                    documentId: view.documentId,
                    title: document.title,
                    slug: document.slug,
                    views: view._count.id,
                    uniqueVisitors: uniqueVisitors.length,
                    avgTimeOnPage: view._avg.timeOnPage || 0,
                });
            }

            return metrics;
        } catch (error) {
            console.error('Failed to get popular pages:', error);
            return [];
        }
    }

    /**
     * Get search metrics
     * 
     * Analyzes search patterns to understand what users are searching for and
     * how successful searches are.
     * 
     * @param type - Portal type ('tenant' or 'admin')
     * @param timeRange - Time range for metrics
     * @param limit - Maximum number of results (default: 20)
     * @returns Array of search metrics
     */
    async getSearchMetrics(
        type: 'tenant' | 'admin',
        timeRange: TimeRange,
        limit: number = 20
    ): Promise<SearchMetric[]> {
        try {
            const docType = this.toDocumentationType(type);

            // Aggregate searches by query
            const searches = await prisma.documentationSearch.groupBy({
                by: ['query'],
                where: {
                    type: docType,
                    searchedAt: {
                        gte: timeRange.start,
                        lte: timeRange.end,
                    },
                },
                _count: {
                    id: true,
                },
                _avg: {
                    resultsCount: true,
                },
                orderBy: {
                    _count: {
                        id: 'desc',
                    },
                },
                take: limit,
            });

            // Calculate click-through rate for each query
            const metrics: SearchMetric[] = [];

            for (const search of searches) {
                // Count searches with clicks
                const searchesWithClicks = await prisma.documentationSearch.count({
                    where: {
                        query: search.query,
                        type: docType,
                        searchedAt: {
                            gte: timeRange.start,
                            lte: timeRange.end,
                        },
                        clickedResultId: {
                            not: null,
                        },
                    },
                });

                const clickThroughRate = search._count.id > 0
                    ? (searchesWithClicks / search._count.id) * 100
                    : 0;

                metrics.push({
                    query: search.query,
                    searchCount: search._count.id,
                    avgResultsCount: search._avg.resultsCount || 0,
                    clickThroughRate,
                });
            }

            return metrics;
        } catch (error) {
            console.error('Failed to get search metrics:', error);
            return [];
        }
    }

    /**
     * Calculate bounce rates for documentation pages
     * 
     * A "bounce" is when a user views a page for less than 10 seconds or
     * doesn't view any other pages in the same session.
     * 
     * @param type - Portal type ('tenant' or 'admin')
     * @param timeRange - Time range for metrics
     * @param limit - Maximum number of results (default: 20)
     * @returns Array of bounce rate metrics
     */
    async getBounceRates(
        type: 'tenant' | 'admin',
        timeRange: TimeRange,
        limit: number = 20
    ): Promise<BounceRateMetric[]> {
        try {
            const docType = this.toDocumentationType(type);

            // Get all page views in time range
            const pageViews = await prisma.documentationPageView.findMany({
                where: {
                    type: docType,
                    viewedAt: {
                        gte: timeRange.start,
                        lte: timeRange.end,
                    },
                },
                select: {
                    documentId: true,
                    sessionId: true,
                    timeOnPage: true,
                },
            });

            // Group by document and calculate bounce rate
            const documentStats = new Map<string, { total: number; bounces: number }>();

            for (const view of pageViews) {
                const stats = documentStats.get(view.documentId) || { total: 0, bounces: 0 };
                stats.total++;

                // Count as bounce if time on page < 10 seconds or no session tracking
                if (!view.timeOnPage || view.timeOnPage < 10) {
                    stats.bounces++;
                } else if (view.sessionId) {
                    // Check if this was the only page viewed in the session
                    const sessionPageCount = pageViews.filter(
                        (v) => v.sessionId === view.sessionId
                    ).length;

                    if (sessionPageCount === 1) {
                        stats.bounces++;
                    }
                }

                documentStats.set(view.documentId, stats);
            }

            // Convert to metrics array
            const metrics: BounceRateMetric[] = [];

            for (const [documentId, stats] of documentStats.entries()) {
                const document = await prisma.documentationDocument.findUnique({
                    where: { id: documentId },
                    select: { title: true },
                });

                if (!document) continue;

                const bounceRate = stats.total > 0
                    ? (stats.bounces / stats.total) * 100
                    : 0;

                metrics.push({
                    documentId,
                    title: document.title,
                    bounceRate,
                    views: stats.total,
                });
            }

            // Sort by bounce rate descending and limit
            return metrics
                .sort((a, b) => b.bounceRate - a.bounceRate)
                .slice(0, limit);
        } catch (error) {
            console.error('Failed to get bounce rates:', error);
            return [];
        }
    }

    /**
     * Get related pages based on co-occurrence patterns
     * 
     * Identifies pages that are frequently viewed together in the same session.
     * 
     * @param documentId - ID of the document to find related pages for
     * @param limit - Maximum number of results (default: 5)
     * @returns Array of related page metrics
     */
    async getRelatedPages(
        documentId: string,
        limit: number = 5
    ): Promise<RelatedPageMetric[]> {
        try {
            // Get all sessions that viewed this document
            const sessions = await prisma.documentationPageView.findMany({
                where: { documentId },
                select: { sessionId: true },
                distinct: ['sessionId'],
            });

            const sessionIds = sessions
                .map((s) => s.sessionId)
                .filter((id): id is string => id !== null);

            if (sessionIds.length === 0) {
                return [];
            }

            // Get all other pages viewed in those sessions
            const coOccurrences = await prisma.documentationPageView.groupBy({
                by: ['documentId'],
                where: {
                    sessionId: {
                        in: sessionIds,
                    },
                    documentId: {
                        not: documentId, // Exclude the current document
                    },
                },
                _count: {
                    id: true,
                },
                orderBy: {
                    _count: {
                        id: 'desc',
                    },
                },
                take: limit,
            });

            // Get document details
            const metrics: RelatedPageMetric[] = [];

            for (const occurrence of coOccurrences) {
                const document = await prisma.documentationDocument.findUnique({
                    where: { id: occurrence.documentId },
                    select: { title: true },
                });

                if (!document) continue;

                metrics.push({
                    documentId: occurrence.documentId,
                    title: document.title,
                    coOccurrenceCount: occurrence._count.id,
                });
            }

            return metrics;
        } catch (error) {
            console.error('Failed to get related pages:', error);
            return [];
        }
    }

    /**
     * Get feedback summary for a documentation page
     * 
     * Aggregates user feedback ratings and recent comments.
     * 
     * @param documentId - ID of the document
     * @param recentCommentsLimit - Number of recent comments to include (default: 5)
     * @returns Feedback summary with ratings and comments
     */
    async getFeedbackSummary(
        documentId: string,
        recentCommentsLimit: number = 5
    ): Promise<FeedbackSummary> {
        try {
            // Get all feedback for this document
            const feedback = await prisma.documentationFeedback.findMany({
                where: { documentId },
                select: {
                    rating: true,
                    comment: true,
                    createdAt: true,
                },
            });

            if (feedback.length === 0) {
                return {
                    documentId,
                    averageRating: 0,
                    totalFeedback: 0,
                    ratingDistribution: {},
                    recentComments: [],
                };
            }

            // Calculate average rating
            const totalRating = feedback.reduce((sum, f) => sum + f.rating, 0);
            const averageRating = totalRating / feedback.length;

            // Calculate rating distribution
            const ratingDistribution: Record<number, number> = {
                1: 0,
                2: 0,
                3: 0,
                4: 0,
                5: 0,
            };

            for (const f of feedback) {
                ratingDistribution[f.rating]++;
            }

            // Get recent comments (with text)
            const recentComments: FeedbackComment[] = feedback
                .filter((f) => f.comment && f.comment.trim().length > 0)
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                .slice(0, recentCommentsLimit)
                .map((f) => ({
                    rating: f.rating,
                    comment: f.comment!,
                    createdAt: f.createdAt,
                }));

            return {
                documentId,
                averageRating,
                totalFeedback: feedback.length,
                ratingDistribution,
                recentComments,
            };
        } catch (error) {
            console.error('Failed to get feedback summary:', error);
            return {
                documentId,
                averageRating: 0,
                totalFeedback: 0,
                ratingDistribution: {},
                recentComments: [],
            };
        }
    }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
