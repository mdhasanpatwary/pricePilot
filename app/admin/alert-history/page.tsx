"use client";

import { useState, useEffect, useCallback } from "react";
import {
    AlertTriangle,
    Info,
    CheckCircle,
    RefreshCw,
    Clock,
    Filter,
    XCircle,
    Bell,
    BellOff,
    TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface MonitoringAlert {
    id: string;
    ruleId: string;
    ruleName: string;
    severity: "CRITICAL" | "WARNING" | "INFO";
    triggeredAt: string;
    resolvedAt: string | null;
    metricValue: number;
    threshold: number;
    tenantId: string | null;
    context: any;
    notificationsSent: any;
    acknowledgedAt: string | null;
    acknowledgedBy: string | null;
}

interface AlertHistoryResponse {
    success: boolean;
    data: {
        alerts: MonitoringAlert[];
        count: number;
        limit: number;
    };
}

export default function AlertHistoryPage() {
    const [data, setData] = useState<MonitoringAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [severityFilter, setSeverityFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [acknowledgingIds, setAcknowledgingIds] = useState<Set<string>>(
        new Set()
    );

    const fetchAlertHistory = useCallback(async (showRefreshing = false) => {
        if (showRefreshing) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const params = new URLSearchParams();
            params.append("limit", "100");

            const res = await fetch(`/api/v1/monitoring/alerts/history?${params.toString()}`);
            if (res.ok) {
                const json: AlertHistoryResponse = await res.json();
                setData(json.data.alerts);
                setLastUpdated(new Date());
            } else {
                console.error("Failed to fetch alert history");
            }
        } catch (error) {
            console.error("Error fetching alert history:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchAlertHistory();
    }, [fetchAlertHistory]);

    const handleRefresh = () => {
        fetchAlertHistory(true);
    };

    const handleAcknowledge = async (alertId: string) => {
        setAcknowledgingIds((prev) => new Set(prev).add(alertId));

        try {
            const res = await fetch(`/api/v1/monitoring/alerts/${alertId}/acknowledge`, {
                method: "POST",
            });

            if (res.ok) {
                // Update the alert in the local state
                setData((prevData) =>
                    prevData.map((alert) =>
                        alert.id === alertId
                            ? {
                                ...alert,
                                acknowledgedAt: new Date().toISOString(),
                                acknowledgedBy: "current-user", // This would come from session
                            }
                            : alert
                    )
                );
            } else {
                console.error("Failed to acknowledge alert");
            }
        } catch (error) {
            console.error("Error acknowledging alert:", error);
        } finally {
            setAcknowledgingIds((prev) => {
                const newSet = new Set(prev);
                newSet.delete(alertId);
                return newSet;
            });
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case "CRITICAL":
                return <XCircle className="w-4 h-4" />;
            case "WARNING":
                return <AlertTriangle className="w-4 h-4" />;
            case "INFO":
                return <Info className="w-4 h-4" />;
            default:
                return <Bell className="w-4 h-4" />;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "CRITICAL":
                return "text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-950/20";
            case "WARNING":
                return "text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/20";
            case "INFO":
                return "text-blue-600 dark:text-blue-500 bg-blue-50 dark:bg-blue-950/20";
            default:
                return "text-muted-foreground bg-muted";
        }
    };

    const getSeverityBadgeVariant = (
        severity: string
    ): "destructive" | "warning" | "default" => {
        switch (severity) {
            case "CRITICAL":
                return "destructive";
            case "WARNING":
                return "warning";
            default:
                return "default";
        }
    };

    // Apply filters
    const filteredAlerts = data.filter((alert) => {
        if (severityFilter !== "all" && alert.severity !== severityFilter) {
            return false;
        }
        if (statusFilter === "active" && alert.resolvedAt !== null) {
            return false;
        }
        if (statusFilter === "resolved" && alert.resolvedAt === null) {
            return false;
        }
        if (statusFilter === "acknowledged" && alert.acknowledgedAt === null) {
            return false;
        }
        if (statusFilter === "unacknowledged" && alert.acknowledgedAt !== null) {
            return false;
        }
        return true;
    });

    // Calculate stats
    const activeAlerts = data.filter((a) => a.resolvedAt === null).length;
    const criticalAlerts = data.filter((a) => a.severity === "CRITICAL" && a.resolvedAt === null).length;
    const unacknowledgedAlerts = data.filter((a) => a.acknowledgedAt === null && a.resolvedAt === null).length;

    if (loading && data.length === 0) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-muted-foreground font-medium">
                        Loading alert history...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Alert History
                    </h1>
                    <p className="text-muted-foreground">
                        View and manage monitoring alert history and notifications
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
                        </div>
                    )}
                    <Button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        variant="outline"
                        size="sm"
                        aria-label="Refresh alert history"
                    >
                        <RefreshCw
                            className={cn("w-4 h-4", refreshing && "animate-spin")}
                            aria-hidden="true"
                        />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                Active Alerts
                            </p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-foreground">
                                    {activeAlerts}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    unresolved
                                </span>
                            </div>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                            <Bell className="w-8 h-8 text-blue-600 dark:text-blue-500" />
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                Critical Alerts
                            </p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-foreground">
                                    {criticalAlerts}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    require attention
                                </span>
                            </div>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                            <XCircle className="w-8 h-8 text-red-600 dark:text-red-500" />
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                Unacknowledged
                            </p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-foreground">
                                    {unacknowledgedAlerts}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    need review
                                </span>
                            </div>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                            <BellOff className="w-8 h-8 text-amber-600 dark:text-amber-500" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Filters:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">
                                Severity:
                            </label>
                            <Select
                                value={severityFilter}
                                onValueChange={setSeverityFilter}
                            >
                                <SelectTrigger className="w-[140px] h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Severities</SelectItem>
                                    <SelectItem value="CRITICAL">Critical</SelectItem>
                                    <SelectItem value="WARNING">Warning</SelectItem>
                                    <SelectItem value="INFO">Info</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">
                                Status:
                            </label>
                            <Select
                                value={statusFilter}
                                onValueChange={setStatusFilter}
                            >
                                <SelectTrigger className="w-[160px] h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Alerts</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="resolved">Resolved</SelectItem>
                                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                                    <SelectItem value="unacknowledged">Unacknowledged</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Alerts List */}
            <div className="space-y-3">
                {filteredAlerts.length === 0 ? (
                    <Card className="p-12">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="p-3 bg-muted rounded-full">
                                <CheckCircle className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="font-semibold text-foreground mb-1">
                                    No alerts found
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {severityFilter !== "all" || statusFilter !== "all"
                                        ? "Try adjusting your filters to see more alerts"
                                        : "No monitoring alerts have been triggered yet"}
                                </p>
                            </div>
                        </div>
                    </Card>
                ) : (
                    filteredAlerts.map((alert) => (
                        <Card
                            key={alert.id}
                            className={cn(
                                "p-5 transition-all focus-within:ring-2 focus-within:ring-primary",
                                !alert.resolvedAt && "border-l-4",
                                alert.severity === "CRITICAL" &&
                                !alert.resolvedAt &&
                                "border-l-red-500",
                                alert.severity === "WARNING" &&
                                !alert.resolvedAt &&
                                "border-l-amber-500",
                                alert.severity === "INFO" &&
                                !alert.resolvedAt &&
                                "border-l-blue-500"
                            )}
                            role="article"
                            aria-label={`${alert.severity} alert: ${alert.ruleName}`}
                        >
                            <div className="flex items-start gap-4">
                                {/* Severity Icon */}
                                <div
                                    className={cn(
                                        "p-2 rounded-lg shrink-0",
                                        getSeverityColor(alert.severity)
                                    )}
                                >
                                    {getSeverityIcon(alert.severity)}
                                </div>

                                {/* Alert Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4 mb-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge
                                                variant={getSeverityBadgeVariant(
                                                    alert.severity
                                                )}
                                                className="uppercase text-[10px]"
                                                role="status"
                                                aria-label={`Severity: ${alert.severity}`}
                                            >
                                                {alert.severity}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {alert.ruleName}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {alert.resolvedAt && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] gap-1 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400"
                                                >
                                                    <CheckCircle className="w-3 h-3" />
                                                    Resolved
                                                </Badge>
                                            )}
                                            {alert.acknowledgedAt && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] gap-1"
                                                >
                                                    <CheckCircle className="w-3 h-3" />
                                                    Acknowledged
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-3">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm font-medium text-foreground">
                                                Metric Value: {alert.metricValue.toFixed(2)}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                (Threshold: {alert.threshold.toFixed(2)})
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>
                                                Triggered: {new Date(alert.triggeredAt).toLocaleString()}
                                            </span>
                                        </div>
                                        {alert.resolvedAt && (
                                            <div className="flex items-center gap-1.5">
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                <span>
                                                    Resolved: {new Date(alert.resolvedAt).toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {alert.acknowledgedAt && (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            Acknowledged at{" "}
                                            {new Date(alert.acknowledgedAt).toLocaleString()}
                                            {alert.acknowledgedBy && ` by ${alert.acknowledgedBy}`}
                                        </div>
                                    )}

                                    {alert.notificationsSent && (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            Notifications sent: {JSON.stringify(alert.notificationsSent).length > 50
                                                ? "Multiple channels"
                                                : JSON.stringify(alert.notificationsSent)}
                                        </div>
                                    )}
                                </div>

                                {/* Action Button */}
                                {!alert.acknowledgedAt && !alert.resolvedAt && (
                                    <Button
                                        onClick={() => handleAcknowledge(alert.id)}
                                        disabled={acknowledgingIds.has(alert.id)}
                                        size="sm"
                                        variant="outline"
                                        className="shrink-0"
                                        aria-label={`Acknowledge ${alert.severity} alert: ${alert.ruleName}`}
                                    >
                                        {acknowledgingIds.has(alert.id) ? (
                                            <>
                                                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                                                Acknowledging...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                                                Acknowledge
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
