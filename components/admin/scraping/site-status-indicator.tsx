"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type SiteStatus = 'healthy' | 'degraded' | 'blocked' | 'unknown';

interface SiteStatusIndicatorProps {
    status: SiteStatus;
    successRate: number;
    lastSuccess?: string;
    lastFailure?: string;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

/**
 * Calculate site status based on success rate
 * - healthy: success rate >= 80%
 * - degraded: 50% <= success rate < 80%
 * - blocked: success rate < 50%
 */
export function calculateSiteStatus(successRate: number): SiteStatus {
    if (successRate >= 80) return 'healthy';
    if (successRate >= 50) return 'degraded';
    if (successRate >= 0) return 'blocked';
    return 'unknown';
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp?: string): string {
    if (!timestamp) return 'Never';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;

    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
}

export function SiteStatusIndicator({
    status,
    successRate,
    lastSuccess,
    lastFailure,
    showLabel = true,
    size = 'md'
}: SiteStatusIndicatorProps) {
    const sizeClasses = {
        sm: 'h-3 w-3',
        md: 'h-4 w-4',
        lg: 'h-5 w-5'
    };

    const getStatusConfig = () => {
        switch (status) {
            case 'healthy':
                return {
                    icon: CheckCircle2,
                    color: 'text-green-500',
                    bgColor: 'bg-green-500/10',
                    label: 'Healthy',
                    description: 'Scraping is working well',
                    badgeVariant: 'default' as const
                };
            case 'degraded':
                return {
                    icon: AlertCircle,
                    color: 'text-yellow-500',
                    bgColor: 'bg-yellow-500/10',
                    label: 'Degraded',
                    description: 'Scraping is experiencing issues',
                    badgeVariant: 'secondary' as const
                };
            case 'blocked':
                return {
                    icon: XCircle,
                    color: 'text-red-500',
                    bgColor: 'bg-red-500/10',
                    label: 'Blocked',
                    description: 'Scraping is mostly failing',
                    badgeVariant: 'destructive' as const
                };
            default:
                return {
                    icon: Clock,
                    color: 'text-gray-500',
                    bgColor: 'bg-gray-500/10',
                    label: 'Unknown',
                    description: 'No data available',
                    badgeVariant: 'outline' as const
                };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    const tooltipContent = (
        <div className="space-y-1">
            <div className="font-semibold">{config.label}</div>
            <div className="text-xs">{config.description}</div>
            <div className="text-xs pt-1 border-t border-border/50">
                Success Rate: {successRate.toFixed(1)}%
            </div>
            {lastSuccess && (
                <div className="text-xs">
                    Last Success: {formatRelativeTime(lastSuccess)}
                </div>
            )}
            {lastFailure && (
                <div className="text-xs">
                    Last Failure: {formatRelativeTime(lastFailure)}
                </div>
            )}
        </div>
    );

    if (showLabel) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                            <div className={`rounded-full p-1 ${config.bgColor}`}>
                                <Icon className={`${sizeClasses[size]} ${config.color}`} />
                            </div>
                            <Badge variant={config.badgeVariant} className="capitalize">
                                {config.label}
                            </Badge>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        {tooltipContent}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={`rounded-full p-1 ${config.bgColor} cursor-help`}>
                        <Icon className={`${sizeClasses[size]} ${config.color}`} />
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    {tooltipContent}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/**
 * Compact status indicator for tables
 */
export function CompactSiteStatusIndicator({
    status,
    successRate
}: {
    status: SiteStatus;
    successRate: number;
}) {
    const config = {
        healthy: { color: 'bg-green-500', label: 'Healthy' },
        degraded: { color: 'bg-yellow-500', label: 'Degraded' },
        blocked: { color: 'bg-red-500', label: 'Blocked' },
        unknown: { color: 'bg-gray-500', label: 'Unknown' }
    }[status];

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-help">
                        <div className={`h-2 w-2 rounded-full ${config.color}`} />
                        <span className="text-sm font-medium">{successRate.toFixed(1)}%</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <div className="text-xs">
                        Status: {config.label}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
