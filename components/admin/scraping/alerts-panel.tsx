"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Info, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/**
 * Alert severity levels
 */
type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Alert types for different scraping issues
 */
type AlertType =
    | 'success_rate_drop'
    | 'captcha_detected'
    | 'all_proxies_blocked'
    | 'site_blocked'
    | 'high_failure_rate'
    | 'scraping_recovered';

/**
 * Alert interface
 */
interface Alert {
    id: string;
    tenantId: string;
    severity: AlertSeverity;
    type: AlertType;
    title: string;
    message: string;
    competitorWebsiteId?: string;
    competitorSiteName?: string;
    metadata: Record<string, any>;
    timestamp: Date;
    acknowledged: boolean;
}

/**
 * Props for AlertsPanel component
 */
interface AlertsPanelProps {
    className?: string;
    maxAlerts?: number;
    onAlertClick?: (alert: Alert) => void;
}

/**
 * Get icon for alert severity
 */
function getSeverityIcon(severity: AlertSeverity) {
    switch (severity) {
        case 'critical':
            return XCircle;
        case 'warning':
            return AlertTriangle;
        case 'info':
            return Info;
        default:
            return Info;
    }
}

/**
 * Get color classes for alert severity
 */
function getSeverityColors(severity: AlertSeverity) {
    switch (severity) {
        case 'critical':
            return {
                bg: 'bg-red-50 dark:bg-red-950/20',
                border: 'border-red-200 dark:border-red-900',
                icon: 'text-red-600 dark:text-red-400',
                badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
            };
        case 'warning':
            return {
                bg: 'bg-amber-50 dark:bg-amber-950/20',
                border: 'border-amber-200 dark:border-amber-900',
                icon: 'text-amber-600 dark:text-amber-400',
                badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
            };
        case 'info':
            return {
                bg: 'bg-blue-50 dark:bg-blue-950/20',
                border: 'border-blue-200 dark:border-blue-900',
                icon: 'text-blue-600 dark:text-blue-400',
                badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
            };
        default:
            return {
                bg: 'bg-gray-50 dark:bg-gray-950/20',
                border: 'border-gray-200 dark:border-gray-900',
                icon: 'text-gray-600 dark:text-gray-400',
                badge: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300',
            };
    }
}

/**
 * Format timestamp as relative time
 */
function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
}

/**
 * AlertsPanel Component
 * 
 * Displays recent scraping alerts with severity color coding and details.
 * 
 * Requirements: 11.5
 */
export function AlertsPanel({ className, maxAlerts = 10, onAlertClick }: AlertsPanelProps) {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchAlerts();
        // Poll for new alerts every 30 seconds
        const interval = setInterval(fetchAlerts, 30000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [maxAlerts]);

    const fetchAlerts = async () => {
        try {
            const res = await fetch(`/api/v1/scraping/alerts?limit=${maxAlerts}`);
            if (!res.ok) {
                throw new Error('Failed to fetch alerts');
            }
            const data = await res.json();
            setAlerts(data.data.alerts || []);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch alerts:', err);
            setError('Failed to load alerts');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card className={cn("p-6", className)}>
                <div className="flex items-center justify-center h-32">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className={cn("p-6", className)}>
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                    <p className="text-sm">{error}</p>
                </div>
            </Card>
        );
    }

    if (alerts.length === 0) {
        return (
            <Card className={cn("p-6", className)}>
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
                    <p className="text-sm font-medium">No Active Alerts</p>
                    <p className="text-xs mt-1">All systems operating normally</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className={cn("p-6", className)}>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Recent Alerts</h3>
                    <Badge variant="outline" className="text-xs">
                        {alerts.filter((a) => !a.acknowledged).length} Active
                    </Badge>
                </div>

                <div className="space-y-3">
                    {alerts.map((alert) => {
                        const Icon = getSeverityIcon(alert.severity);
                        const colors = getSeverityColors(alert.severity);

                        return (
                            <div
                                key={alert.id}
                                onClick={() => onAlertClick?.(alert)}
                                className={cn(
                                    "p-4 rounded-lg border transition-all cursor-pointer",
                                    colors.bg,
                                    colors.border,
                                    "hover:shadow-sm",
                                    alert.acknowledged && "opacity-60"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", colors.icon)} />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h4 className="text-sm font-medium text-foreground line-clamp-1">
                                                {alert.title}
                                            </h4>
                                            <Badge className={cn("text-[10px] px-1.5 py-0 shrink-0", colors.badge)}>
                                                {alert.severity.toUpperCase()}
                                            </Badge>
                                        </div>

                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                            {alert.message}
                                        </p>

                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                <span>{formatRelativeTime(alert.timestamp)}</span>
                                            </div>

                                            {alert.competitorSiteName && (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-muted-foreground/60">•</span>
                                                    <span className="truncate max-w-[200px]">
                                                        {alert.competitorSiteName}
                                                    </span>
                                                </div>
                                            )}

                                            {alert.acknowledged && (
                                                <div className="flex items-center gap-1 ml-auto">
                                                    <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                                                    <span className="text-green-600 dark:text-green-400">
                                                        Acknowledged
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Display key metadata */}
                                        {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-border/50">
                                                <div className="flex flex-wrap gap-2">
                                                    {alert.metadata.successRate !== undefined && (
                                                        <span className="text-xs text-muted-foreground">
                                                            Success Rate: <strong>{alert.metadata.successRate.toFixed(1)}%</strong>
                                                        </span>
                                                    )}
                                                    {alert.metadata.recentAttempts !== undefined && (
                                                        <span className="text-xs text-muted-foreground">
                                                            Attempts: <strong>{alert.metadata.recentAttempts}</strong>
                                                        </span>
                                                    )}
                                                    {alert.metadata.blockedProxies !== undefined && (
                                                        <span className="text-xs text-muted-foreground">
                                                            Blocked: <strong>{alert.metadata.blockedProxies}/{alert.metadata.totalProxies}</strong>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
}
