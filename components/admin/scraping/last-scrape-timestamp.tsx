'use client';

/**
 * Last Scrape Timestamp Component
 * 
 * Displays the last successful scrape timestamp with age indicator.
 * Highlights when data is stale based on configurable threshold.
 * 
 * Requirements: 10.4
 */

import { Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface LastScrapeTimestampProps {
    lastSuccessfulScrape?: Date | string | null;
    stalenessThresholdHours?: number;
    showIcon?: boolean;
    showLabel?: boolean;
    className?: string;
}

export function LastScrapeTimestamp({
    lastSuccessfulScrape,
    stalenessThresholdHours = 24,
    showIcon = true,
    showLabel = true,
    className = ''
}: LastScrapeTimestampProps) {
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update current time every minute to keep "ago" text fresh
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute

        return () => clearInterval(interval);
    }, []);

    if (!lastSuccessfulScrape) {
        return (
            <div className={`flex items-center gap-2 text-gray-500 dark:text-gray-400 ${className}`}>
                {showIcon && <AlertCircle className="h-4 w-4" />}
                <span className="text-sm">
                    {showLabel && 'Last check: '}Never checked
                </span>
            </div>
        );
    }

    const scrapeDate = typeof lastSuccessfulScrape === 'string'
        ? new Date(lastSuccessfulScrape)
        : lastSuccessfulScrape;

    const ageInfo = calculateAgeInfo(scrapeDate, currentTime, stalenessThresholdHours);

    const colorClasses = ageInfo.isStale
        ? 'text-red-600 dark:text-red-400'
        : ageInfo.isWarning
            ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-green-600 dark:text-green-400';

    const Icon = ageInfo.isStale || ageInfo.isWarning ? AlertCircle : CheckCircle;

    return (
        <div className={`flex items-center gap-2 ${colorClasses} ${className}`}>
            {showIcon && <Icon className="h-4 w-4" />}
            <span className="text-sm">
                {showLabel && 'Last check: '}
                {ageInfo.displayText}
            </span>
        </div>
    );
}

/**
 * Detailed version with full timestamp and staleness warning
 */
interface DetailedLastScrapeProps {
    lastSuccessfulScrape?: Date | string | null;
    stalenessThresholdHours?: number;
    className?: string;
}

export function DetailedLastScrape({
    lastSuccessfulScrape,
    stalenessThresholdHours = 24,
    className = ''
}: DetailedLastScrapeProps) {
    if (!lastSuccessfulScrape) {
        return (
            <div className={`rounded-lg border border-gray-200 dark:border-gray-700 p-3 ${className}`}>
                <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            No Price Data Available
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            This product has not been successfully scraped yet.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const scrapeDate = typeof lastSuccessfulScrape === 'string'
        ? new Date(lastSuccessfulScrape)
        : lastSuccessfulScrape;

    const ageInfo = calculateAgeInfo(scrapeDate, new Date(), stalenessThresholdHours);

    const colorClasses = ageInfo.isStale
        ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20'
        : ageInfo.isWarning
            ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20'
            : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20';

    const iconColorClasses = ageInfo.isStale
        ? 'text-red-600 dark:text-red-400'
        : ageInfo.isWarning
            ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-green-600 dark:text-green-400';

    const textColorClasses = ageInfo.isStale
        ? 'text-red-900 dark:text-red-100'
        : ageInfo.isWarning
            ? 'text-yellow-900 dark:text-yellow-100'
            : 'text-green-900 dark:text-green-100';

    const Icon = ageInfo.isStale || ageInfo.isWarning ? AlertCircle : CheckCircle;

    return (
        <div className={`rounded-lg border p-3 ${colorClasses} ${className}`}>
            <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconColorClasses}`} />
                <div className="flex-1">
                    <p className={`text-sm font-medium ${textColorClasses}`}>
                        {ageInfo.isStale ? 'Price Data is Stale' : ageInfo.isWarning ? 'Price Data May Be Outdated' : 'Price Data is Current'}
                    </p>
                    <p className={`text-xs mt-1 ${textColorClasses} opacity-80`}>
                        Last successful check: {ageInfo.displayText}
                    </p>
                    <p className={`text-xs mt-0.5 ${textColorClasses} opacity-60`}>
                        {scrapeDate.toLocaleString()}
                    </p>
                    {ageInfo.isStale && (
                        <p className={`text-xs mt-2 pt-2 border-t ${textColorClasses} opacity-75 border-red-200 dark:border-red-800`}>
                            ⚠️ This price is more than {stalenessThresholdHours} hours old and may not be accurate.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Compact badge version for table cells
 */
interface LastScrapeBadgeProps {
    lastSuccessfulScrape?: Date | string | null;
    stalenessThresholdHours?: number;
    className?: string;
}

export function LastScrapeBadge({
    lastSuccessfulScrape,
    stalenessThresholdHours = 24,
    className = ''
}: LastScrapeBadgeProps) {
    if (!lastSuccessfulScrape) {
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 ${className}`}>
                <Clock className="h-3 w-3" />
                Never
            </span>
        );
    }

    const scrapeDate = typeof lastSuccessfulScrape === 'string'
        ? new Date(lastSuccessfulScrape)
        : lastSuccessfulScrape;

    const ageInfo = calculateAgeInfo(scrapeDate, new Date(), stalenessThresholdHours);

    const badgeClasses = ageInfo.isStale
        ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'
        : ageInfo.isWarning
            ? 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300'
            : 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300';

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${badgeClasses} ${className}`}>
            <Clock className="h-3 w-3" />
            {ageInfo.shortText}
        </span>
    );
}

/**
 * Calculate age information for a scrape timestamp
 */
interface AgeInfo {
    displayText: string;
    shortText: string;
    ageHours: number;
    isStale: boolean;
    isWarning: boolean;
}

function calculateAgeInfo(
    scrapeDate: Date,
    currentTime: Date,
    stalenessThresholdHours: number
): AgeInfo {
    const diffMs = currentTime.getTime() - scrapeDate.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    const isStale = diffHours >= stalenessThresholdHours;
    const isWarning = diffHours >= (stalenessThresholdHours * 0.75); // Warning at 75% of threshold

    let displayText: string;
    let shortText: string;

    if (diffMinutes < 1) {
        displayText = 'just now';
        shortText = 'now';
    } else if (diffMinutes < 60) {
        displayText = `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
        shortText = `${diffMinutes}m`;
    } else if (diffHours < 24) {
        displayText = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        shortText = `${diffHours}h`;
    } else if (diffDays < 7) {
        displayText = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        shortText = `${diffDays}d`;
    } else {
        displayText = scrapeDate.toLocaleDateString();
        shortText = `${Math.floor(diffDays / 7)}w`;
    }

    return {
        displayText,
        shortText,
        ageHours: diffHours,
        isStale,
        isWarning
    };
}
