/**
 * User Satisfaction Service
 * 
 * Handles user feedback collection, satisfaction score calculation,
 * and feedback prompt management.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface FeedbackSubmission {
    tenantId: string;
    userId: string;
    rating: number;
    category: string;
    feature?: string;
    comment?: string;
    context?: Record<string, any>;
}

export interface SatisfactionScore {
    averageRating: number;
    totalResponses: number;
    nps: number;
    promoters: number;
    passives: number;
    detractors: number;
    ratingDistribution: {
        1: number;
        2: number;
        3: number;
        4: number;
        5: number;
    };
}

export class UserSatisfactionService {
    /**
     * Submit user feedback
     */
    static async submitFeedback(data: FeedbackSubmission): Promise<void> {
        try {
            // Validate rating
            if (data.rating < 1 || data.rating > 5) {
                throw new Error('Rating must be between 1 and 5');
            }

            // Determine sentiment based on rating
            const sentiment = this.determineSentiment(data.rating);

            // Create feedback record
            await prisma.userFeedback.create({
                data: {
                    tenantId: data.tenantId,
                    userId: data.userId,
                    rating: data.rating,
                    category: data.category as any,
                    feature: data.feature,
                    comment: data.comment,
                    sentiment,
                    context: data.context || {},
                },
            });

            // Update user feedback history
            await this.updateUserFeedbackHistory(data.userId, data.tenantId, data.rating);

            // Update daily satisfaction metrics
            await this.updateDailySatisfactionMetrics(data.tenantId);

            logger.info('User feedback submitted', {
                tenantId: data.tenantId,
                userId: data.userId,
                rating: data.rating,
                category: data.category,
            });
        } catch (error) {
            logger.error('Failed to submit user feedback', { error, data });
            throw error;
        }
    }

    /**
     * Get satisfaction score for a tenant or globally
     */
    static async getSatisfactionScore(
        tenantId?: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<SatisfactionScore> {
        try {
            const where: any = {};

            if (tenantId) {
                where.tenantId = tenantId;
            }

            if (startDate || endDate) {
                where.createdAt = {};
                if (startDate) where.createdAt.gte = startDate;
                if (endDate) where.createdAt.lte = endDate;
            }

            const feedbacks = await prisma.userFeedback.findMany({
                where,
                select: {
                    rating: true,
                },
            });

            if (feedbacks.length === 0) {
                return {
                    averageRating: 0,
                    totalResponses: 0,
                    nps: 0,
                    promoters: 0,
                    passives: 0,
                    detractors: 0,
                    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                };
            }

            // Calculate average rating
            const totalRating = feedbacks.reduce((sum, f) => sum + f.rating, 0);
            const averageRating = totalRating / feedbacks.length;

            // Calculate rating distribution
            const ratingDistribution = {
                1: feedbacks.filter(f => f.rating === 1).length,
                2: feedbacks.filter(f => f.rating === 2).length,
                3: feedbacks.filter(f => f.rating === 3).length,
                4: feedbacks.filter(f => f.rating === 4).length,
                5: feedbacks.filter(f => f.rating === 5).length,
            };

            // Calculate NPS (using 5-star scale mapped to 0-10)
            // 5 stars = promoters (9-10), 4 stars = passives (7-8), 1-3 stars = detractors (0-6)
            const promoters = ratingDistribution[5];
            const passives = ratingDistribution[4];
            const detractors = ratingDistribution[1] + ratingDistribution[2] + ratingDistribution[3];

            const nps = ((promoters - detractors) / feedbacks.length) * 100;

            return {
                averageRating: Math.round(averageRating * 100) / 100,
                totalResponses: feedbacks.length,
                nps: Math.round(nps * 100) / 100,
                promoters,
                passives,
                detractors,
                ratingDistribution,
            };
        } catch (error) {
            logger.error('Failed to get satisfaction score', { error, tenantId });
            throw error;
        }
    }

    /**
     * Get feedback by category
     */
    static async getFeedbackByCategory(
        tenantId?: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<Record<string, SatisfactionScore>> {
        try {
            const where: any = {};

            if (tenantId) {
                where.tenantId = tenantId;
            }

            if (startDate || endDate) {
                where.createdAt = {};
                if (startDate) where.createdAt.gte = startDate;
                if (endDate) where.createdAt.lte = endDate;
            }

            const feedbacks = await prisma.userFeedback.findMany({
                where,
                select: {
                    rating: true,
                    category: true,
                },
            });

            const categories = [...new Set(feedbacks.map(f => f.category))];
            const result: Record<string, SatisfactionScore> = {};

            for (const category of categories) {
                const categoryFeedbacks = feedbacks.filter(f => f.category === category);
                const totalRating = categoryFeedbacks.reduce((sum, f) => sum + f.rating, 0);
                const averageRating = totalRating / categoryFeedbacks.length;

                const ratingDistribution = {
                    1: categoryFeedbacks.filter(f => f.rating === 1).length,
                    2: categoryFeedbacks.filter(f => f.rating === 2).length,
                    3: categoryFeedbacks.filter(f => f.rating === 3).length,
                    4: categoryFeedbacks.filter(f => f.rating === 4).length,
                    5: categoryFeedbacks.filter(f => f.rating === 5).length,
                };

                const promoters = ratingDistribution[5];
                const passives = ratingDistribution[4];
                const detractors = ratingDistribution[1] + ratingDistribution[2] + ratingDistribution[3];
                const nps = ((promoters - detractors) / categoryFeedbacks.length) * 100;

                result[category] = {
                    averageRating: Math.round(averageRating * 100) / 100,
                    totalResponses: categoryFeedbacks.length,
                    nps: Math.round(nps * 100) / 100,
                    promoters,
                    passives,
                    detractors,
                    ratingDistribution,
                };
            }

            return result;
        } catch (error) {
            logger.error('Failed to get feedback by category', { error, tenantId });
            throw error;
        }
    }

    /**
     * Get recent feedback with comments
     */
    static async getRecentFeedback(
        tenantId?: string,
        limit: number = 50
    ): Promise<any[]> {
        try {
            const where: any = {};

            if (tenantId) {
                where.tenantId = tenantId;
            }

            const feedbacks = await prisma.userFeedback.findMany({
                where,
                orderBy: {
                    createdAt: 'desc',
                },
                take: limit,
            });

            return feedbacks;
        } catch (error) {
            logger.error('Failed to get recent feedback', { error, tenantId });
            throw error;
        }
    }

    /**
     * Check if user should be prompted for feedback
     */
    static async shouldPromptUser(userId: string, tenantId: string): Promise<boolean> {
        try {
            const history = await prisma.userFeedbackHistory.findUnique({
                where: {
                    userId_tenantId: {
                        userId,
                        tenantId,
                    },
                },
            });

            if (!history) {
                return true; // First time user, prompt them
            }

            // Don't prompt if they were prompted in the last 7 days
            if (history.lastPromptedAt) {
                const daysSinceLastPrompt = Math.floor(
                    (Date.now() - history.lastPromptedAt.getTime()) / (1000 * 60 * 60 * 24)
                );
                if (daysSinceLastPrompt < 7) {
                    return false;
                }
            }

            // Prompt if they haven't responded in a while
            if (history.responseCount === 0 && history.promptCount >= 3) {
                return false; // Stop prompting if they've ignored 3 times
            }

            return true;
        } catch (error) {
            logger.error('Failed to check if user should be prompted', { error, userId, tenantId });
            return false;
        }
    }

    /**
     * Record that user was prompted
     */
    static async recordPrompt(userId: string, tenantId: string): Promise<void> {
        try {
            await prisma.userFeedbackHistory.upsert({
                where: {
                    userId_tenantId: {
                        userId,
                        tenantId,
                    },
                },
                create: {
                    userId,
                    tenantId,
                    lastPromptedAt: new Date(),
                    promptCount: 1,
                    responseCount: 0,
                },
                update: {
                    lastPromptedAt: new Date(),
                    promptCount: {
                        increment: 1,
                    },
                },
            });
        } catch (error) {
            logger.error('Failed to record prompt', { error, userId, tenantId });
        }
    }

    /**
     * Update daily satisfaction metrics
     */
    private static async updateDailySatisfactionMetrics(tenantId: string): Promise<void> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Get all feedback for today
            const feedbacks = await prisma.userFeedback.findMany({
                where: {
                    tenantId,
                    createdAt: {
                        gte: today,
                        lt: tomorrow,
                    },
                },
                select: {
                    rating: true,
                    category: true,
                    feature: true,
                },
            });

            if (feedbacks.length === 0) return;

            // Calculate metrics
            const totalRating = feedbacks.reduce((sum, f) => sum + f.rating, 0);
            const averageRating = totalRating / feedbacks.length;

            const ratingCounts = {
                1: feedbacks.filter(f => f.rating === 1).length,
                2: feedbacks.filter(f => f.rating === 2).length,
                3: feedbacks.filter(f => f.rating === 3).length,
                4: feedbacks.filter(f => f.rating === 4).length,
                5: feedbacks.filter(f => f.rating === 5).length,
            };

            const promoters = ratingCounts[5];
            const passives = ratingCounts[4];
            const detractors = ratingCounts[1] + ratingCounts[2] + ratingCounts[3];
            const nps = ((promoters - detractors) / feedbacks.length) * 100;

            // Category breakdown
            const categoryBreakdown: Record<string, any> = {};
            const categories = [...new Set(feedbacks.map(f => f.category))];
            for (const category of categories) {
                const catFeedbacks = feedbacks.filter(f => f.category === category);
                const catTotal = catFeedbacks.reduce((sum, f) => sum + f.rating, 0);
                categoryBreakdown[category] = {
                    count: catFeedbacks.length,
                    average: catTotal / catFeedbacks.length,
                };
            }

            // Feature breakdown
            const featureBreakdown: Record<string, any> = {};
            const features = [...new Set(feedbacks.filter(f => f.feature).map(f => f.feature!))];
            for (const feature of features) {
                const featFeedbacks = feedbacks.filter(f => f.feature === feature);
                const featTotal = featFeedbacks.reduce((sum, f) => sum + f.rating, 0);
                featureBreakdown[feature] = {
                    count: featFeedbacks.length,
                    average: featTotal / featFeedbacks.length,
                };
            }

            // Upsert daily metric
            await prisma.satisfactionMetric.upsert({
                where: {
                    tenantId_date: {
                        tenantId,
                        date: today,
                    },
                },
                create: {
                    tenantId,
                    date: today,
                    totalResponses: feedbacks.length,
                    averageRating,
                    rating1Count: ratingCounts[1],
                    rating2Count: ratingCounts[2],
                    rating3Count: ratingCounts[3],
                    rating4Count: ratingCounts[4],
                    rating5Count: ratingCounts[5],
                    nps,
                    promoters,
                    passives,
                    detractors,
                    categoryBreakdown,
                    featureBreakdown,
                },
                update: {
                    totalResponses: feedbacks.length,
                    averageRating,
                    rating1Count: ratingCounts[1],
                    rating2Count: ratingCounts[2],
                    rating3Count: ratingCounts[3],
                    rating4Count: ratingCounts[4],
                    rating5Count: ratingCounts[5],
                    nps,
                    promoters,
                    passives,
                    detractors,
                    categoryBreakdown,
                    featureBreakdown,
                },
            });
        } catch (error) {
            logger.error('Failed to update daily satisfaction metrics', { error, tenantId });
        }
    }

    /**
     * Update user feedback history
     */
    private static async updateUserFeedbackHistory(
        userId: string,
        tenantId: string,
        rating: number
    ): Promise<void> {
        try {
            const existing = await prisma.userFeedbackHistory.findUnique({
                where: {
                    userId_tenantId: {
                        userId,
                        tenantId,
                    },
                },
            });

            if (existing) {
                const newResponseCount = existing.responseCount + 1;
                const currentTotal = existing.averageRating
                    ? parseFloat(existing.averageRating.toString()) * existing.responseCount
                    : 0;
                const newAverage = (currentTotal + rating) / newResponseCount;

                await prisma.userFeedbackHistory.update({
                    where: {
                        userId_tenantId: {
                            userId,
                            tenantId,
                        },
                    },
                    data: {
                        responseCount: newResponseCount,
                        lastResponseAt: new Date(),
                        averageRating: newAverage,
                    },
                });
            } else {
                await prisma.userFeedbackHistory.create({
                    data: {
                        userId,
                        tenantId,
                        responseCount: 1,
                        lastResponseAt: new Date(),
                        averageRating: rating,
                    },
                });
            }
        } catch (error) {
            logger.error('Failed to update user feedback history', { error, userId, tenantId });
        }
    }

    /**
     * Determine sentiment from rating
     */
    private static determineSentiment(rating: number): string {
        if (rating >= 4) return 'positive';
        if (rating === 3) return 'neutral';
        return 'negative';
    }

    /**
     * Get satisfaction trend over time
     */
    static async getSatisfactionTrend(
        tenantId?: string,
        days: number = 30
    ): Promise<any[]> {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            startDate.setHours(0, 0, 0, 0);

            const where: any = {
                date: {
                    gte: startDate,
                },
            };

            if (tenantId) {
                where.tenantId = tenantId;
            }

            const metrics = await prisma.satisfactionMetric.findMany({
                where,
                orderBy: {
                    date: 'asc',
                },
            });

            return metrics;
        } catch (error) {
            logger.error('Failed to get satisfaction trend', { error, tenantId });
            throw error;
        }
    }

    /**
     * Mark feedback as resolved
     */
    static async resolveFeedback(
        feedbackId: string,
        resolvedBy: string,
        resolutionNotes?: string
    ): Promise<void> {
        try {
            await prisma.userFeedback.update({
                where: { id: feedbackId },
                data: {
                    resolved: true,
                    resolvedAt: new Date(),
                    resolvedBy,
                    resolutionNotes,
                },
            });

            logger.info('Feedback resolved', { feedbackId, resolvedBy });
        } catch (error) {
            logger.error('Failed to resolve feedback', { error, feedbackId });
            throw error;
        }
    }
}
