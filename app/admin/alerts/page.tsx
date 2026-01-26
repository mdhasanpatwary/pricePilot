"use client";

import { useState, useEffect } from "react";
import {
    AlertTriangle,
    AlertCircle,
    Info,
    CheckCircle,
    RefreshCw,
    Clock,
    Server,
    Filter,
    XCircle,
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

interface Alert {
    id: string;
    severity: "critical" | "warning" | "info";
    type: string;
    message: string;
    site: string | null;
    proxyUrl: string | null;
    acknowledged: boolean;
    acknowledgedAt: string | null;
    createdAt: string;
}

interface AlertsResponse {
    alerts: Alert[];
    unacknowledgedCount: number;
}

export default function AlertsPage() {
    const [data, setData] = useState<AlertsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [severityFilter, setSeverityFilter] = useState<string>("all");
    const [acknowledgedFilter, setAcknowledgedFilter] = useState<string>("all");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [acknowledgingIds, setAcknowledgingIds] = useState<Set<string>>(
        new Set()
    );

    const fetchAlerts = async (showRefreshing = false) => {
        if (showRefreshing) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const params = new URLSearchParams();
            if (severityFilter !== "all") {
                params.append("severity", severityFilter);
            }
            if (acknowledgedFilter !== "all") {
                params.append(
                    "acknowledged",
                    acknowledgedFilter === "acknowledged" ? "true" : "false"
                );
            }

            const res = await fetch(`/api/v1/admin/alerts?${params.toString()}`);
            if (res.ok) {
                const json: AlertsResponse = await res.json();
                setData(json);
                setLastUpdated(new Date());
            } else {
                console.error("Failed to fetch alerts");
            }
        } catch (error) {
            console.error("Error fetching alerts:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, [severityFilter, acknowledgedFilter]);

    const handleRefresh = () => {
        fetchAlerts(true);
    };

    const handleAcknowledge = async (alertId: string) => {
        setAcknowledgingIds((prev) => new Set(prev).add(alertId));

        try {
            const res = await fetch(`/api/v1/admin/alerts/${alertId}/acknowledge`, {
                method: "POST",
            });

            if (res.ok) {
                // Update the alert in the local state
                setData((prevData) => {
                    if (!prevData) return prevData;
                    return {
                        ...prevData,
                        alerts: prevData.alerts.map((alert) =>
                            alert.id === alertId
                                ? {
                                    ...alert,
                                    acknowledged: true,
                                    acknowledgedAt: new Date().toISOString(),
                                }
                                : alert
                        ),
                        unacknowledgedCount: Math.max(
                            0,
                            prevData.unacknowledgedCount - 1
                        ),
                    };
                });
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
            case "critical":
                return <XCircle className="w-4 h-4" />;
            case "warning":
                return <AlertTriangle className="w-4 h-4" />;
            case "info":
                return <Info className="w-4 h-4" />;
            default:
                return <AlertCircle className="w-4 h-4" />;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "critical":
                return "text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-950/20";
            case "warning":
                return "text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/20";
            case "info":
                return "text-blue-600 dark:text-blue-500 bg-blue-50 dark:bg-blue-950/20";
            default:
                return "text-muted-foreground bg-muted";
        }
    };

    const getSeverityBadgeVariant = (
        severity: string
    ): "destructive" | "warning" | "default" => {
        switch (severity) {
            case "critical":
                return "destructive";
            case "warning":
                return "warning";
            default:
                return "default";
        }
    };

    if (loading && !data) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-muted-foreground font-medium">
                        Loading alerts...
                    </p>
                </div>
            </div>
        );
    }

    const alerts = data?.alerts || [];
    const unacknowledgedCount = data?.unacknowledgedCount || 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        System Alerts
                    </h1>
                    <p className="text-muted-foreground">
                        Monitor and manage critical system alerts and notifications
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
                        aria-label="Refresh alerts"
                    >
                        <RefreshCw
                            className={cn("w-4 h-4", refreshing && "animate-spin")}
                            aria-hidden="true"
                        />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Card */}
            <Card className="p-5" role="status" aria-live="polite" aria-atomic="true">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            Unacknowledged Alerts
                        </p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-foreground">
                                {unacknowledgedCount}
                            </span>
                            <span className="text-sm text-muted-foreground">
                                require attention
                            </span>
                        </div>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                        <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-500" />
                    </div>
                </div>
            </Card>

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
                                    <SelectItem value="critical">Critical</SelectItem>
                                    <SelectItem value="warning">Warning</SelectItem>
                                    <SelectItem value="info">Info</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">
                                Status:
                            </label>
                            <Select
                                value={acknowledgedFilter}
                                onValueChange={setAcknowledgedFilter}
                            >
                                <SelectTrigger className="w-[140px] h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Alerts</SelectItem>
                                    <SelectItem value="unacknowledged">
                                        Unacknowledged
                                    </SelectItem>
                                    <SelectItem value="acknowledged">
                                        Acknowledged
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Alerts List */}
            <div className="space-y-3">
                {alerts.length === 0 ? (
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
                                    {severityFilter !== "all" ||
                                        acknowledgedFilter !== "all"
                                        ? "Try adjusting your filters to see more alerts"
                                        : "All systems are operating normally"}
                                </p>
                            </div>
                        </div>
                    </Card>
                ) : (
                    alerts.map((alert) => (
                        <Card
                            key={alert.id}
                            className={cn(
                                "p-5 transition-all focus-within:ring-2 focus-within:ring-primary",
                                !alert.acknowledged &&
                                "border-l-4",
                                alert.severity === "critical" &&
                                !alert.acknowledged &&
                                "border-l-red-500",
                                alert.severity === "warning" &&
                                !alert.acknowledged &&
                                "border-l-amber-500",
                                alert.severity === "info" &&
                                !alert.acknowledged &&
                                "border-l-blue-500"
                            )}
                            role="article"
                            aria-label={`${alert.severity} alert: ${alert.message}`}
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
                                                {alert.type.replace(/_/g, " ")}
                                            </span>
                                        </div>
                                        {alert.acknowledged && (
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] gap-1"
                                            >
                                                <CheckCircle className="w-3 h-3" />
                                                Acknowledged
                                            </Badge>
                                        )}
                                    </div>

                                    <p className="text-sm font-medium text-foreground mb-3">
                                        {alert.message}
                                    </p>

                                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                        {alert.site && (
                                            <div className="flex items-center gap-1.5">
                                                <Server className="w-3.5 h-3.5" />
                                                <span>Site: {alert.site}</span>
                                            </div>
                                        )}
                                        {alert.proxyUrl && (
                                            <div className="flex items-center gap-1.5">
                                                <Server className="w-3.5 h-3.5" />
                                                <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">
                                                    {alert.proxyUrl}
                                                </code>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>
                                                {new Date(alert.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    {alert.acknowledgedAt && (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            Acknowledged at{" "}
                                            {new Date(
                                                alert.acknowledgedAt
                                            ).toLocaleString()}
                                        </div>
                                    )}
                                </div>

                                {/* Action Button */}
                                {!alert.acknowledged && (
                                    <Button
                                        onClick={() => handleAcknowledge(alert.id)}
                                        disabled={acknowledgingIds.has(alert.id)}
                                        size="sm"
                                        variant="outline"
                                        className="shrink-0"
                                        aria-label={`Acknowledge ${alert.severity} alert: ${alert.message}`}
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
