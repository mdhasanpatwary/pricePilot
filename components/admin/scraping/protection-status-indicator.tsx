'use client';

/**
 * Protection Status Indicator Component
 * 
 * Displays the current protection status for a competitor website
 * with color-coded indicators and detailed information.
 * 
 * Requirements: 10.1, 10.2, 10.6
 */

import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    CheckCircle,
    AlertTriangle,
    XCircle,
    Info,
} from 'lucide-react';

export type ProtectionStatus = 'healthy' | 'degraded' | 'blocked' | 'unknown';

export interface ProtectionStatusIndicatorProps {
    status: ProtectionStatus;
    successRate?: number;
    protectionType?: string;
    lastSuccessfulScrape?: Date | null;
    showDetails?: boolean;
}

export function ProtectionStatusIndicator({
    status,
    successRate,
    protectionType,
    lastSuccessfulScrape,
    showDetails = true,
}: ProtectionStatusIndicatorProps) {
    const getStatusConfig = () => {
        switch (status) {
            case 'healthy':
                return {
                    icon: CheckCircle,
                    label: 'Healthy',
                    variant: 'default' as const,
                    color: 'text-green-500',
                    description: 'Scraping is working normally',
                };
            case 'degraded':
                return {
                    icon: AlertTriangle,
                    label: 'Degraded',
                    variant: 'secondary' as const,
                    color: 'text-yellow-500',
                    description: 'Scraping is experiencing issues',
                };
            case 'blocked':
                return {
                    icon: XCircle,
                    label: 'Blocked',
                    variant: 'destructive' as const,
                    color: 'text-red-500',
                    description: 'Scraping is currently blocked',
                };
            default:
                return {
                    icon: Info,
                    label: 'Unknown',
                    variant: 'outline' as const,
                    color: 'text-gray-500',
                    description: 'Status unknown',
                };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    const getProtectionTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            ip_block: 'IP Block',
            rate_limit: 'Rate Limit',
            captcha: 'CAPTCHA',
            fake_data: 'Fake Data',
            redirect_block: 'Redirect Block',
            delayed_response: 'Delayed Response',
            empty_response: 'Empty Response',
            javascript_challenge: 'JavaScript Challenge',
            unknown: 'Unknown Protection',
        };
        return labels[type] || type;
    };

    const tooltipContent = (
        <div className="space-y-2">
            <div className="font-semibold">{config.description}</div>
            {successRate !== undefined && (
                <div className="text-sm">
                    Success Rate: {(successRate * 100).toFixed(1)}%
                </div>
            )}
            {protectionType && (
                <div className="text-sm">
                    Protection: {getProtectionTypeLabel(protectionType)}
                </div>
            )}
            {lastSuccessfulScrape && (
                <div className="text-sm">
                    Last Success: {new Date(lastSuccessfulScrape).toLocaleString()}
                </div>
            )}
        </div>
    );

    if (!showDetails) {
        return (
            <Badge variant={config.variant} className="flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {config.label}
            </Badge>
        );
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="inline-flex items-center gap-2 cursor-help">
                        <Badge variant={config.variant} className="flex items-center gap-1">
                            <Icon className="h-3 w-3" />
                            {config.label}
                        </Badge>
                        {successRate !== undefined && (
                            <span className="text-sm text-muted-foreground">
                                {(successRate * 100).toFixed(0)}%
                            </span>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent>{tooltipContent}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/**
 * Calculate protection status from success rate
 * 
 * @param successRate - Success rate (0-1)
 * @returns Protection status
 */
export function calculateProtectionStatus(successRate: number): ProtectionStatus {
    if (successRate >= 0.8) {
        return 'healthy';
    } else if (successRate >= 0.5) {
        return 'degraded';
    } else if (successRate > 0) {
        return 'blocked';
    } else {
        return 'unknown';
    }
}
