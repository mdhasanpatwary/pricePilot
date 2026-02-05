'use client';

/**
 * Scraping Error Message Component
 * 
 * Displays user-friendly error messages when scraping fails,
 * with actionable suggestions based on the protection type.
 * 
 * Requirements: 10.1, 10.2
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    AlertCircle,
    Shield,
    Clock,
    RefreshCw,
    ExternalLink,
} from 'lucide-react';

export interface ScrapingErrorMessageProps {
    protectionType: string;
    errorMessage?: string;
    lastAttemptAt?: Date | null;
    onRetry?: () => void;
    onViewLogs?: () => void;
}

export function ScrapingErrorMessage({
    protectionType,
    errorMessage,
    lastAttemptAt,
    onRetry,
    onViewLogs,
}: ScrapingErrorMessageProps) {
    const getErrorConfig = () => {
        switch (protectionType) {
            case 'ip_block':
                return {
                    title: 'IP Address Blocked',
                    message: 'The competitor site is blocking our IP addresses. We are automatically rotating proxies and will retry shortly.',
                    suggestion: 'Prices will be updated once we find a working proxy.',
                    icon: Shield,
                    variant: 'destructive' as const,
                };
            case 'rate_limit':
                return {
                    title: 'Rate Limit Exceeded',
                    message: 'The competitor site is rate limiting our requests. We are waiting for the cooldown period to expire.',
                    suggestion: 'Scraping will resume automatically after the rate limit resets.',
                    icon: Clock,
                    variant: 'default' as const,
                };
            case 'captcha':
                return {
                    title: 'CAPTCHA Challenge Detected',
                    message: 'The competitor site requires CAPTCHA verification. Our automated system cannot bypass this protection.',
                    suggestion: 'Manual intervention may be required. Consider entering prices manually or contacting support.',
                    icon: Shield,
                    variant: 'destructive' as const,
                };
            case 'fake_data':
                return {
                    title: 'Fake Data Detected',
                    message: 'The competitor site is serving fake or placeholder prices. We are using advanced scraping methods to retrieve real data.',
                    suggestion: 'This may take longer than usual. Please check back later.',
                    icon: AlertCircle,
                    variant: 'default' as const,
                };
            case 'redirect_block':
                return {
                    title: 'Access Redirected',
                    message: 'The competitor site is redirecting our requests to error pages. We are adjusting our scraping strategy.',
                    suggestion: 'Prices will be updated once we bypass the redirect protection.',
                    icon: Shield,
                    variant: 'default' as const,
                };
            case 'delayed_response':
                return {
                    title: 'Slow Response',
                    message: 'The competitor site is taking too long to respond. This may be a temporary issue or an anti-bot measure.',
                    suggestion: 'We are increasing timeout thresholds and will retry.',
                    icon: Clock,
                    variant: 'default' as const,
                };
            case 'empty_response':
                return {
                    title: 'Empty Response',
                    message: 'The competitor site returned an empty response. This may indicate a temporary outage or protection mechanism.',
                    suggestion: 'We will retry automatically. If the issue persists, the site may be down.',
                    icon: AlertCircle,
                    variant: 'default' as const,
                };
            case 'javascript_challenge':
                return {
                    title: 'JavaScript Challenge',
                    message: 'The competitor site requires JavaScript execution to load prices. We are using a headless browser to handle this.',
                    suggestion: 'This may take longer than usual but should succeed automatically.',
                    icon: Shield,
                    variant: 'default' as const,
                };
            default:
                return {
                    title: 'Scraping Failed',
                    message: errorMessage || 'Unable to retrieve price data from the competitor site.',
                    suggestion: 'We are investigating the issue and will retry automatically.',
                    icon: AlertCircle,
                    variant: 'default' as const,
                };
        }
    };

    const config = getErrorConfig();
    const Icon = config.icon;

    return (
        <Alert variant={config.variant}>
            <Icon className="h-4 w-4" />
            <AlertTitle>{config.title}</AlertTitle>
            <AlertDescription className="space-y-3">
                <div>{config.message}</div>
                <div className="text-sm italic">{config.suggestion}</div>
                {lastAttemptAt && (
                    <div className="text-sm text-muted-foreground">
                        Last attempt: {new Date(lastAttemptAt).toLocaleString()}
                    </div>
                )}
                <div className="flex gap-2 mt-2">
                    {onRetry && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRetry}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className="h-3 w-3" />
                            Retry Now
                        </Button>
                    )}
                    {onViewLogs && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onViewLogs}
                            className="flex items-center gap-2"
                        >
                            <ExternalLink className="h-3 w-3" />
                            View Logs
                        </Button>
                    )}
                </div>
            </AlertDescription>
        </Alert>
    );
}
