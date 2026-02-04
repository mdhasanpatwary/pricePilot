"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle, Info, XCircle, Clock, Filter, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
 * Admin Alerts Page
 * 
 * Displays all scraping alerts with filtering and management capabilities.
 * 
 * Requirements: 11.5, 12.1
 */
export default function AlertsPage() {
    const router = useRouter();
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [severityFilter, setSeverityFilter] = useState<string>('all');
    const [acknowledgedFilter, setAcknowledgedFilter] = useState<string>('all');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchAlerts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [severityFilter, acknowledgedFilter]);

    const fetchAlerts = async () => {
        try {
            setRefreshing(true);
            const params = new URLSearchParams();
            if (severityFilter !== 'all') params.append('severity', severityFilter);
            if (acknowledgedFilter !== 'all') params.append('acknowledged', acknowledgedFilter);

            const res = await fetch(`/api/v1/scraping/alerts?${params.toString()}`);
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
            setRefreshing(false);
        }
    };

    const handleAcknowledge = async (alertId: string) => {
        try {
            const res = await fetch(`/api/v1/scraping/alerts/${alertId}/acknowledge`, {
                method: 'POST',
            });
            if (!res.ok) {
                throw new Error('Failed to acknowledge alert');
            }
            // Refresh alerts
            await fetchAlerts();
        } catch (err) {
            console.error('Failed to acknowledge alert:', err);
        }
    };

    const handleDismiss = async (alertId: string) => {
        try {
            const res = await fetch(`/api/v1/scraping/alerts/${alertId}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                throw new Error('Failed to dismiss alert');
            }
            // Refresh alerts
            await fetchAlerts();
        } catch (err) {
            console.error('Failed to dismiss alert:', err);
        }
    };

    const handleViewLogs = (alert: Alert) => {
        if (alert.competitorWebsiteId) {
            router.push(`/admin/scraping-monitor/${alert.competitorWebsiteId}`);
        }
    };

    const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;
    const criticalCount = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">Scraping Alerts</h1>
                <p className="text-sm text-muted-foreground">
                    Monitor and manage scraping alerts across all competitor sites
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Total Alerts</p>
                            <p className="text-2xl font-semibold text-foreground">{alerts.length}</p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Active Alerts</p>
                            <p className="text-2xl font-semibold text-foreground">{unacknowledgedCount}</p>
                        </div>
                        <XCircle className="w-8 h-8 text-amber-500/30" />
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Critical Alerts</p>
                            <p className="text-2xl font-semibold text-red-600 dark:text-red-400">{criticalCount}</p>
                        </div>
                        <XCircle className="w-8 h-8 text-red-500/30" />
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex items-center gap-4">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <div className="flex items-center gap-2 flex-1">
                        <Select value={severityFilter} onValueChange={setSeverityFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Severity" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Severities</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="warning">Warning</SelectItem>
                                <SelectItem value="info">Info</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={acknowledgedFilter} onValueChange={setAcknowledgedFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Alerts</SelectItem>
                                <SelectItem value="false">Active Only</SelectItem>
                                <SelectItem value="true">Acknowledged Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchAlerts}
                        disabled={refreshing}
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </Card>

            {/* Alerts List */}
            {error ? (
                <Card className="p-6">
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                        <p className="text-sm">{error}</p>
                    </div>
                </Card>
            ) : alerts.length === 0 ? (
                <Card className="p-6">
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                        <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
                        <p className="text-sm font-medium">No Alerts Found</p>
                        <p className="text-xs mt-1">All systems operating normally</p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-3">
                    {alerts.map((alert) => {
                        const Icon = getSeverityIcon(alert.severity);
                        const colors = getSeverityColors(alert.severity);

                        return (
                            <Card key={alert.id} className={cn("p-5", colors.bg, colors.border)}>
                                <div className="flex items-start gap-4">
                                    <Icon className={cn("w-6 h-6 mt-0.5 shrink-0", colors.icon)} />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div>
                                                <h3 className="text-base font-semibold text-foreground mb-1">
                                                    {alert.title}
                                                </h3>
                                                <Badge className={cn("text-[10px] px-2 py-0.5", colors.badge)}>
                                                    {alert.severity.toUpperCase()}
                                                </Badge>
                                            </div>
                                            {alert.acknowledged && (
                                                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                                    <CheckCircle className="w-4 h-4" />
                                                    <span>Acknowledged</span>
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-sm text-muted-foreground mb-3">
                                            {alert.message}
                                        </p>

                                        {/* Metadata */}
                                        {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                                            <div className="mb-3 p-3 bg-background/50 rounded-md">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    {alert.metadata.successRate !== undefined && (
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">Success Rate</p>
                                                            <p className="text-sm font-medium text-foreground">
                                                                {alert.metadata.successRate.toFixed(1)}%
                                                            </p>
                                                        </div>
                                                    )}
                                                    {alert.metadata.recentAttempts !== undefined && (
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">Recent Attempts</p>
                                                            <p className="text-sm font-medium text-foreground">
                                                                {alert.metadata.recentAttempts}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {alert.metadata.blockedProxies !== undefined && (
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">Blocked Proxies</p>
                                                            <p className="text-sm font-medium text-foreground">
                                                                {alert.metadata.blockedProxies} / {alert.metadata.totalProxies}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {alert.metadata.recentCaptchas !== undefined && (
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">CAPTCHA Detections</p>
                                                            <p className="text-sm font-medium text-foreground">
                                                                {alert.metadata.recentCaptchas}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Footer */}
                                        <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/50">
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{formatRelativeTime(alert.timestamp)}</span>
                                                </div>
                                                {alert.competitorSiteName && (
                                                    <>
                                                        <span className="text-muted-foreground/60">•</span>
                                                        <span className="truncate max-w-[300px]">
                                                            {alert.competitorSiteName}
                                                        </span>
                                                    </>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {alert.competitorWebsiteId && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleViewLogs(alert)}
                                                    >
                                                        View Logs
                                                    </Button>
                                                )}
                                                {!alert.acknowledged && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleAcknowledge(alert.id)}
                                                    >
                                                        Acknowledge
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDismiss(alert.id)}
                                                >
                                                    Dismiss
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
