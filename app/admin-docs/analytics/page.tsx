import { analyticsService } from '@/lib/documentation/analytics';
import Link from 'next/link';
import type { PageMetric, SearchMetric, BounceRateMetric } from '@/lib/documentation/types';

export const metadata = {
    title: 'Documentation Analytics - PricePilot Admin',
    description: 'Analytics and insights for documentation usage',
};

export default async function AnalyticsPage() {
    // Define time range for analytics (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const timeRange = {
        start: thirtyDaysAgo,
        end: now,
    };

    // Fetch analytics data for both tenant and admin documentation
    // Handle gracefully if database tables don't exist yet
    let tenantPopularPages: PageMetric[] = [];
    let adminPopularPages: PageMetric[] = [];
    let tenantSearchMetrics: SearchMetric[] = [];
    let adminSearchMetrics: SearchMetric[] = [];
    let tenantBounceRates: BounceRateMetric[] = [];
    let adminBounceRates: BounceRateMetric[] = [];

    try {
        [
            tenantPopularPages,
            adminPopularPages,
            tenantSearchMetrics,
            adminSearchMetrics,
            tenantBounceRates,
            adminBounceRates,
        ] = await Promise.all([
            analyticsService.getPopularPages('tenant', timeRange),
            analyticsService.getPopularPages('admin', timeRange),
            analyticsService.getSearchMetrics('tenant', timeRange),
            analyticsService.getSearchMetrics('admin', timeRange),
            analyticsService.getBounceRates('tenant', timeRange),
            analyticsService.getBounceRates('admin', timeRange),
        ]);
    } catch (error) {
        console.error('Failed to fetch analytics data:', error);
        // Continue with empty arrays - the UI will show "no data" messages
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    Documentation Analytics
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Usage metrics and insights for the last 30 days
                </p>
            </div>

            {/* Tenant Documentation Analytics */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    Tenant Documentation
                </h2>

                {/* Popular Pages */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Most Popular Pages
                    </h3>
                    {tenantPopularPages.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Page
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Views
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Unique Visitors
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Avg. Time
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {tenantPopularPages.slice(0, 10).map((page) => (
                                        <tr key={page.documentId}>
                                            <td className="px-4 py-3 text-sm">
                                                <Link
                                                    href={`/docs/${page.slug}`}
                                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                    {page.title}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {page.views.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {page.uniqueVisitors.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {Math.round(page.avgTimeOnPage)}s
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-500">No page views recorded yet.</p>
                    )}
                </div>

                {/* Search Metrics */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Top Search Queries
                    </h3>
                    {tenantSearchMetrics.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Query
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Searches
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Avg. Results
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            CTR
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {tenantSearchMetrics.slice(0, 10).map((metric) => (
                                        <tr key={metric.query}>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {metric.query}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {metric.searchCount.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {metric.avgResultsCount.toFixed(1)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {(metric.clickThroughRate * 100).toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-500">No search queries recorded yet.</p>
                    )}
                </div>

                {/* Bounce Rates */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Pages with High Bounce Rates
                    </h3>
                    {tenantBounceRates.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Page
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Bounce Rate
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Views
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {tenantBounceRates
                                        .filter((page) => page.bounceRate > 0.5)
                                        .slice(0, 10)
                                        .map((page) => (
                                            <tr key={page.documentId}>
                                                <td className="px-4 py-3 text-sm">
                                                    <Link
                                                        href={`/docs/${page.documentId}`}
                                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                                    >
                                                        {page.title}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${page.bounceRate > 0.7
                                                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                            }`}
                                                    >
                                                        {(page.bounceRate * 100).toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                    {page.views.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-500">No bounce rate data available yet.</p>
                    )}
                </div>
            </section>

            {/* Admin Documentation Analytics */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    Admin Documentation
                </h2>

                {/* Popular Pages */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Most Popular Pages
                    </h3>
                    {adminPopularPages.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Page
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Views
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Unique Visitors
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Avg. Time
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {adminPopularPages.slice(0, 10).map((page) => (
                                        <tr key={page.documentId}>
                                            <td className="px-4 py-3 text-sm">
                                                <Link
                                                    href={`/admin-docs/${page.slug}`}
                                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                    {page.title}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {page.views.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {page.uniqueVisitors.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {Math.round(page.avgTimeOnPage)}s
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-500">No page views recorded yet.</p>
                    )}
                </div>

                {/* Search Metrics */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Top Search Queries
                    </h3>
                    {adminSearchMetrics.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Query
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Searches
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Avg. Results
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            CTR
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {adminSearchMetrics.slice(0, 10).map((metric) => (
                                        <tr key={metric.query}>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {metric.query}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {metric.searchCount.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {metric.avgResultsCount.toFixed(1)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                {(metric.clickThroughRate * 100).toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-500">No search queries recorded yet.</p>
                    )}
                </div>

                {/* Bounce Rates */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Pages with High Bounce Rates
                    </h3>
                    {adminBounceRates.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Page
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Bounce Rate
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Views
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {adminBounceRates
                                        .filter((page) => page.bounceRate > 0.5)
                                        .slice(0, 10)
                                        .map((page) => (
                                            <tr key={page.documentId}>
                                                <td className="px-4 py-3 text-sm">
                                                    <Link
                                                        href={`/admin-docs/${page.documentId}`}
                                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                                    >
                                                        {page.title}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${page.bounceRate > 0.7
                                                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                            }`}
                                                    >
                                                        {(page.bounceRate * 100).toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                                    {page.views.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-500">No bounce rate data available yet.</p>
                    )}
                </div>
            </section>
        </div>
    );
}
