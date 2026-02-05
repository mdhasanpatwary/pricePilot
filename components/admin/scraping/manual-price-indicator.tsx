'use client';

/**
 * Manual Price Indicator Component
 * 
 * Displays a distinct indicator for manually entered prices,
 * showing who entered the price and when it was entered.
 * 
 * Requirements: 13.3, 13.4
 */

import { Edit3, User, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface ManualPriceIndicatorProps {
    enteredBy?: string;
    enteredAt?: Date | string;
    userName?: string;
    variant?: 'badge' | 'inline' | 'detailed';
    className?: string;
}

export function ManualPriceIndicator({
    enteredBy: _enteredBy,
    enteredAt,
    userName,
    variant = 'badge',
    className = '',
}: ManualPriceIndicatorProps) {
    const enteredDate = enteredAt ? new Date(enteredAt) : null;
    const timeAgo = enteredDate ? formatDistanceToNow(enteredDate, { addSuffix: true }) : null;

    if (variant === 'badge') {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge
                            variant="secondary"
                            className={`gap-1 cursor-help ${className}`}
                        >
                            <Edit3 className="h-3 w-3" />
                            Manual
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <div className="space-y-1 text-xs">
                            <p className="font-semibold">Manually Entered Price</p>
                            {userName && (
                                <p className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {userName}
                                </p>
                            )}
                            {timeAgo && (
                                <p className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {timeAgo}
                                </p>
                            )}
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    if (variant === 'inline') {
        return (
            <span className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
                <Edit3 className="h-3 w-3" />
                <span>Manual</span>
                {timeAgo && (
                    <span className="text-muted-foreground/70">• {timeAgo}</span>
                )}
            </span>
        );
    }

    // Detailed variant
    return (
        <div className={`rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-3 ${className}`}>
            <div className="flex items-start gap-2">
                <Edit3 className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                        Manually Entered Price
                    </p>
                    <div className="text-xs text-blue-800 dark:text-blue-200 space-y-0.5">
                        {userName && (
                            <p className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                Entered by {userName}
                            </p>
                        )}
                        {timeAgo && (
                            <p className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {timeAgo}
                            </p>
                        )}
                        <p className="text-blue-700 dark:text-blue-300 mt-1">
                            This price will be automatically replaced when scraping succeeds.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Compact icon-only indicator for table cells
 */
interface CompactManualPriceIndicatorProps {
    className?: string;
}

export function CompactManualPriceIndicator({
    className = '',
}: CompactManualPriceIndicatorProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={`inline-flex items-center justify-center ${className}`}>
                        <Edit3 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p className="text-xs">Manually entered price</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
