/**
 * Last Known Good Price Indicator Component
 * 
 * Displays an indicator when showing last known good price instead of current price.
 * Shows the age of the price and whether it's stale.
 * 
 * Requirements: 14.2, 14.3
 */

'use client';

import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    formatPriceAge,
    getStalenessIndicator,
    getStalenessColorClass,
} from '@/lib/utils/last-known-good-price';

interface LastKnownGoodIndicatorProps {
    priceTimestamp: Date;
    className?: string;
    showStalenessIndicator?: boolean;
}

/**
 * LastKnownGoodIndicator component
 * 
 * Displays age indicator and staleness warning for last known good prices.
 * 
 * @param priceTimestamp - Timestamp when price was last successfully scraped
 * @param className - Additional CSS classes
 * @param showStalenessIndicator - Whether to show staleness indicator badge
 */
export function LastKnownGoodIndicator({
    priceTimestamp,
    className,
    showStalenessIndicator = true,
}: LastKnownGoodIndicatorProps) {
    const age = formatPriceAge(priceTimestamp);
    const stalenessIndicator = getStalenessIndicator(priceTimestamp);
    const colorClass = getStalenessColorClass(priceTimestamp);
    const isStale = stalenessIndicator === 'Stale';

    return (
        <div className={cn('flex items-center gap-2', className)}>
            {/* Age indicator */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span className="font-medium">Last known: {age}</span>
            </div>

            {/* Staleness indicator badge */}
            {showStalenessIndicator && (
                <div
                    className={cn(
                        'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                        isStale
                            ? 'bg-danger/10 text-danger border border-danger/20'
                            : 'bg-muted text-muted-foreground border border-border'
                    )}
                >
                    {isStale && <AlertTriangle className="w-2.5 h-2.5" />}
                    <span className={colorClass}>{stalenessIndicator}</span>
                </div>
            )}
        </div>
    );
}

/**
 * Compact version for inline display
 */
export function LastKnownGoodBadge({
    priceTimestamp,
    className,
}: {
    priceTimestamp: Date;
    className?: string;
}) {
    const age = formatPriceAge(priceTimestamp);
    const isStale = getStalenessIndicator(priceTimestamp) === 'Stale';

    return (
        <div
            className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                isStale
                    ? 'bg-danger/10 text-danger border border-danger/20'
                    : 'bg-warning/10 text-warning border border-warning/20',
                className
            )}
        >
            <Clock className="w-2.5 h-2.5" />
            <span>{age}</span>
        </div>
    );
}

/**
 * Tooltip content for last known good price
 */
export function LastKnownGoodTooltip({ priceTimestamp }: { priceTimestamp: Date }) {
    const age = formatPriceAge(priceTimestamp);
    const stalenessIndicator = getStalenessIndicator(priceTimestamp);
    const isStale = stalenessIndicator === 'Stale';

    return (
        <div className="space-y-2 text-xs">
            <p className="font-semibold">Last Known Good Price</p>
            <p className="text-muted-foreground">
                This price was last successfully scraped {age}.
            </p>
            {isStale && (
                <p className="text-danger font-medium">
                    ⚠️ This price may be outdated. Current scraping is failing.
                </p>
            )}
        </div>
    );
}
