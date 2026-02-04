'use client';

/**
 * Satisfaction Dashboard Component
 * 
 * Displays comprehensive user satisfaction metrics
 */

import { useState, useEffect } from 'react';
import { Star, TrendingUp, TrendingDown, Users, MessageSquare, Calendar } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SatisfactionScore {
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

export function SatisfactionDashboard() {
    const [score, setScore] = useState<SatisfactionScore | null>(null);
    const [trend, setTrend] = useState<any[]>([]);
    const [categoryBreakdown, setCategoryBreakdown] = useState<Record<string, SatisfactionScore>>({});
    const [recentFeedback, setRecentFeedback] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState(30);

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeRange]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [scoreRes, trendRes, categoryRes, feedbackRes] = await Promise.all([
                fetch('/api/v1/feedback/score?global=true'),
                fetch(`/api/v1/feedback/trend?days=${timeRange}&global=true`),
                fetch('/api/v1/feedback/by-category?global=true'),
                fetch('/api/v1/feedback/recent?limit=20&global=true'),
            ]);

            const [scoreData, trendData, categoryData, feedbackData] = await Promise.all([
                scoreRes.json(),
                trendRes.json(),
                categoryRes.json(),
                feedbackRes.json(),
            ]);

            if (scoreData.success) setScore(scoreData.data);
            if (trendData.success) setTrend(trendData.data);
            if (categoryData.success) setCategoryBreakdown(categoryData.data);
            if (feedbackData.success) setRecentFeedback(feedbackData.data);
        } catch (error) {
            console.error('Failed to load satisfaction data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-600 dark:text-gray-400">Loading satisfaction data...</div>
            </div>
        );
    }

    if (!score) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-600 dark:text-gray-400">No satisfaction data available</div>
            </div>
        );
    }

    const ratingDistributionData = Object.entries(score.ratingDistribution).map(([rating, count]) => ({
        rating: `${rating} ⭐`,
        count,
    }));

    const categoryData = Object.entries(categoryBreakdown).map(([category, data]) => ({
        category: category.replace(/_/g, ' '),
        rating: data.averageRating,
        responses: data.totalResponses,
    }));

    const trendData = trend.map((item) => ({
        date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        rating: parseFloat(item.averageRating),
        responses: item.totalResponses,
    }));

    const isPositiveTrend = trend.length >= 2 &&
        parseFloat(trend[trend.length - 1].averageRating) > parseFloat(trend[0].averageRating);

    return (
        <div className="space-y-6">
            {/* Time Range Selector */}
            <div className="flex gap-2">
                {[7, 30, 90].map((days) => (
                    <button
                        key={days}
                        onClick={() => setTimeRange(days)}
                        className={`px-4 py-2 rounded-lg transition-colors ${timeRange === days
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
                        {days} Days
                    </button>
                ))}
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Average Rating</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                {score.averageRating.toFixed(2)}
                            </p>
                            <div className="flex items-center mt-2">
                                {[...Array(5)].map((_, i) => (
                                    <Star
                                        key={i}
                                        className={`w-4 h-4 ${i < Math.round(score.averageRating)
                                            ? 'fill-yellow-400 text-yellow-400'
                                            : 'text-gray-300 dark:text-gray-600'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className={`p-3 rounded-full ${score.averageRating >= 4.5 ? 'bg-green-100 dark:bg-green-900' : 'bg-yellow-100 dark:bg-yellow-900'
                            }`}>
                            <Star className={`w-6 h-6 ${score.averageRating >= 4.5 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
                                }`} />
                        </div>
                    </div>
                    {score.averageRating >= 4.5 ? (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-2">✓ Target achieved!</p>
                    ) : (
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                            {(4.5 - score.averageRating).toFixed(2)} points to target
                        </p>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Responses</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                {score.totalResponses}
                            </p>
                        </div>
                        <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        Feedback submissions
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Net Promoter Score</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                {score.nps.toFixed(0)}
                            </p>
                        </div>
                        <div className={`p-3 rounded-full ${score.nps >= 50 ? 'bg-green-100 dark:bg-green-900' :
                            score.nps >= 0 ? 'bg-yellow-100 dark:bg-yellow-900' :
                                'bg-red-100 dark:bg-red-900'
                            }`}>
                            {isPositiveTrend ? (
                                <TrendingUp className={`w-6 h-6 ${score.nps >= 50 ? 'text-green-600 dark:text-green-400' :
                                    'text-yellow-600 dark:text-yellow-400'
                                    }`} />
                            ) : (
                                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                            )}
                        </div>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs">
                        <span className="text-green-600 dark:text-green-400">
                            {score.promoters} promoters
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                            {score.passives} passives
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                            {score.detractors} detractors
                        </span>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Trend</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                {isPositiveTrend ? '+' : '-'}
                                {trend.length >= 2 ?
                                    Math.abs(parseFloat(trend[trend.length - 1].averageRating) - parseFloat(trend[0].averageRating)).toFixed(2) :
                                    '0.00'
                                }
                            </p>
                        </div>
                        <div className={`p-3 rounded-full ${isPositiveTrend ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                            }`}>
                            <Calendar className={`w-6 h-6 ${isPositiveTrend ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                }`} />
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        Last {timeRange} days
                    </p>
                </div>
            </div>

            {/* Satisfaction Trend Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Satisfaction Trend
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" stroke="#9CA3AF" />
                        <YAxis domain={[0, 5]} stroke="#9CA3AF" />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1F2937',
                                border: '1px solid #374151',
                                borderRadius: '8px'
                            }}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="rating"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            name="Average Rating"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Rating Distribution and Category Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Rating Distribution
                    </h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={ratingDistributionData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="rating" stroke="#9CA3AF" />
                            <YAxis stroke="#9CA3AF" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1F2937',
                                    border: '1px solid #374151',
                                    borderRadius: '8px'
                                }}
                            />
                            <Bar dataKey="count" fill="#3B82F6" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Category Breakdown
                    </h2>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {categoryData.map((item) => (
                            <div key={item.category} className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                                        {item.category}
                                    </p>
                                    <div className="flex items-center gap-1 mt-1">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className={`w-3 h-3 ${i < Math.round(item.rating)
                                                    ? 'fill-yellow-400 text-yellow-400'
                                                    : 'text-gray-300 dark:text-gray-600'
                                                    }`}
                                            />
                                        ))}
                                        <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                                            {item.rating.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {item.responses} responses
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Feedback */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Recent Feedback
                    </h2>
                    <MessageSquare className="w-5 h-5 text-gray-400" />
                </div>
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {recentFeedback.map((feedback) => (
                        <div
                            key={feedback.id}
                            className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    className={`w-4 h-4 ${i < feedback.rating
                                                        ? 'fill-yellow-400 text-yellow-400'
                                                        : 'text-gray-300 dark:text-gray-600'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {feedback.category.replace(/_/g, ' ')}
                                        </span>
                                        {feedback.feature && (
                                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                                {feedback.feature}
                                            </span>
                                        )}
                                    </div>
                                    {feedback.comment && (
                                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                                            {feedback.comment}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        <span>{feedback.tenant?.companyName || 'Unknown'}</span>
                                        <span>
                                            {new Date(feedback.createdAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
