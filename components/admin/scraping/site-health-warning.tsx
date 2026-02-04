'use client';

/**
 * Site Health Warning Component
 * 
 * Displays warning indicators for competitor sites with low success rates.
 * Provides explanations and links to monitoring dashboard.
 * 
 * Requirements: 10.3
 */

import { AlertTriangle, TrendingDown, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export type SiteHealthStatus = 'healthy' | 'degraded' | 'blocked';

interface SiteHealthWarningProps {
    siteId: string;
    siteName: string;
    status: SiteHealthStatus;
    successRate: number;
    lastSuccessfulScrape?: Date;
    className?: string;
}

export function SiteHealthWarning({
    siteId,
    siteName,
    status,
    successRate,
    lastSuccessfulScrape,
    className = ''
}: SiteHealthWarningProps) {
    // Only show warning for degraded or blocked sites
    if (status === 'healthy') {
        return null;
    }

    const isBlocked = status === 'blocked';

    const colorClasses = isBlocked
        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
        : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800';

    const iconColorClasses = isBlocked
        ? 'text-red-600 dark:text-red-400'
        : 'text-yellow-600 dark:text-yellow-400';

    const textColorClasses = isBlocked
        ? 'text-red-900 dark:text-red-100'
        : 'text-yellow-900 dark:text-yellow-100';

    const title = isBlocked
        ? `${siteName} is Currently Blocked`
        : `${siteName} Has Reduced Availability`;

    const message = isBlocked
        ? `This competitor site is blocking our price checks (${successRate.toFixed(1)}% success rate). Price data may be outdated or unavailable.`
        : `This competitor site is experiencing issues with automated price checks (${successRate.toFixed(1)}% success rate). Some prices may be delayed.`;

    const timeSinceSuccess = lastSuccessfulScrape
        ? formatTimeSince(lastSuccessfulScrape)
        : null;

    return (
        <div
            className={`rounded-lg border p-4 ${colorClasses} ${className}`}
            role="alert"
        >
            <div className="flex gap-3">
                <div className="flex-shrink-0">
                    {isBlocked ? (
                        <AlertTriangle className={`h-5 w-5 ${iconColorClasses}`} />
                    ) : (
                        <TrendingDown className={`h-5 w-5 ${iconColorClasses}`} />
                    )}
                </div>

                <div className="flex-1 space-y-2">
                    <div>
                        <h4 className={`font-semibold ${textColorClasses}`}>
                            {title}
                        </h4>
                        <p className={`text-sm mt-1 ${textColorClasses} opacity-90`}>
                            {message}
                        </p>
                        {timeSinceSuccess && (
                            <p className={`text-xs mt-1 ${textColorClasses} opacity-75`}>
                                Last successful price check: {timeSinceSuccess}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-4 pt-2">
                        <Link
                            href={`/admin/scraping-monitor/${siteId}`}
                            className={`text-sm font-medium inline-flex items-center gap-1 hover:underline ${textColorClasses}`}
                        >
                            View Monitoring Dashboard
                            <ExternalLink className="h-3 w-3" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Compact warning badge for inline display
 */
interface SiteHealthBadgeProps {
    status: SiteHealthStatus;
    successRate: number;
    className?: string;
}

export function SiteHealthBadge({
    status,
    successRate,
    className = ''
}: SiteHealthBadgeProps) {
    if (status === 'healthy') {
        return null;
    }

    const isBlocked = status === 'blocked';

    const badgeClasses = isBlocked
        ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
        : 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';

    const label = isBlocked ? 'Blocked' : 'Degraded';

    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${badgeClasses} ${className}`}
            title={`Success rate: ${successRate.toFixed(1)}%`}
        >
            <AlertTriangle className="h-3 w-3" />
            {label}
        </span>
    );
}

/**
 * Site health indicator icon (for compact displays)
 */
interface SiteHealthIconProps {
    status: SiteHealthStatus;
    successRate: number;
    showTooltip?: boolean;
    className?: string;
}

export function SiteHealthIcon({
    status,
    successRate,
    showTooltip = true,
    className = ''
}: SiteHealthIconProps) {
    if (status === 'healthy') {
        return null;
    }

    const isBlocked = status === 'blocked';
    const iconColorClasses = isBlocked
        ? 'text-red-600 dark:text-red-400'
        : 'text-yellow-600 dark:text-yellow-400';

    const tooltip = showTooltip
        ? `${isBlocked ? 'Blocked' : 'Degraded'} - ${successRate.toFixed(1)}% success rate`
        : undefined;

    return (
        <span title={tooltip}>
            <AlertTriangle
                className={`h-4 w-4 ${iconColorClasses} ${className}`}
            />
        </span>
    );
}

/**
 * Format time since last successful scrape
 */
function formatTimeSince(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
        return 'just now';
    } else if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString();
    }
}

/**
 * Calculate site health status from success rate
 */
export function calculateSiteHealthStatus(successRate: number): SiteHealthStatus {
    if (successRate >= 80) {
        return 'healthy';
    } else if (successRate >= 50) {
        return 'degraded';
    } else {
        return 'blocked';
    }
}
