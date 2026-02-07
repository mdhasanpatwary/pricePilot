"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Database,
    Zap,
    Globe,
    Shield,
    RefreshCw,
    Play,
    Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SystemAlertData, AlertSeverity } from "@/lib/types/admin-dashboard";
import { ExportButton } from "./export-button";

interface SystemHealthMonitorProps {
    refreshInterval?: number; // default: 30000ms (30 seconds)
}

interface SystemHealth {
    overall: {
        status: "healthy" | "degraded" | "unhealthy";
        message: string;
    };
    database: ComponentHealth;
    redis: ComponentHealth;
    browserPool: ComponentHealth;
    circuitBreakers: ComponentHealth;
    timestamp: Date;
}

interface ComponentHealth {
    status: "healthy" | "degraded" | "unhealthy";
    message: string;
    details?: any;
}

interface DiagnosticResult {
    timestamp: Date;
    totalTime: number;
    healthCheck: SystemHealth;
    database: DiagnosticCategory;
    redis: DiagnosticCategory;
    connectivity: DiagnosticCategory;
    performance: DiagnosticCategory;
}

interface DiagnosticCategory {
    overall: "passed" | "failed" | "warning";
    tests: DiagnosticTest[];
}

interface DiagnosticTest {
    name: string;
    status: "passed" | "failed" | "warning";
    duration?: number;
    error?: string;
    message?: string;
    details?: any;
}

export function SystemHealthMonitor({
    refreshInterval = 30000,
}: SystemHealthMonitorProps) {
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [alerts, setAlerts] = useState<SystemAlertData[]>([]);
    const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [runningDiagnostics, setRunningDiagnostics] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    // Fetch system health
    const fetchHealth = useCallback(async () => {
        try {
            const response = await fetch("/api/v1/admin/health");

            // Handle authentication errors gracefully
            if (response.status === 401) {
                console.warn("Health check: Authentication required");
                setLoading(false);
                return;
            }

            if (!response.ok) {
                console.error("Health check failed:", response.status, response.statusText);
                setLoading(false);
                return;
            }

            const data = await response.json();
            if (data.success && data.data) {
                setHealth({
                    ...data.data,
                    timestamp: new Date(data.data.timestamp),
                });
            }
            setLastRefresh(new Date());
        } catch (error) {
            console.error("Error fetching health:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch alerts
    const fetchAlerts = useCallback(async () => {
        try {
            const response = await fetch("/api/v1/admin/alerts?acknowledged=false");

            // Handle authentication errors gracefully
            if (response.status === 401) {
                console.warn("Alerts check: Authentication required");
                return;
            }

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    setAlerts(data.data);
                }
            }
        } catch (error) {
            console.error("Error fetching alerts:", error);
        }
    }, []);

    // Run diagnostics
    const runDiagnostics = useCallback(async () => {
        setRunningDiagnostics(true);
        try {
            const response = await fetch("/api/v1/admin/diagnostics", {
                method: "POST",
            });

            if (!response.ok) throw new Error("Failed to run diagnostics");

            const data = await response.json();
            if (data.success && data.data) {
                setDiagnostics({
                    ...data.data,
                    timestamp: new Date(data.data.timestamp),
                });
            }
        } catch (error) {
            console.error("Error running diagnostics:", error);
        } finally {
            setRunningDiagnostics(false);
        }
    }, []);

    // Acknowledge alert
    const acknowledgeAlert = useCallback(async (alertId: string) => {
        try {
            const response = await fetch(`/api/v1/admin/alerts/${alertId}/acknowledge`, {
                method: "POST",
            });

            if (response.ok) {
                // Refresh alerts
                fetchAlerts();
            }
        } catch (error) {
            console.error("Error acknowledging alert:", error);
        }
    }, [fetchAlerts]);

    // Initial load and auto-refresh
    useEffect(() => {
        fetchHealth();
        fetchAlerts();

        const interval = setInterval(() => {
            fetchHealth();
            fetchAlerts();
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [fetchHealth, fetchAlerts, refreshInterval]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Loading system health...</p>
                </div>
            </div>
        );
    }

    // Show message if not authenticated or no health data
    if (!health) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                        Unable to Load System Health
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Please ensure you are logged in and have admin access.
                    </p>
                    <Button onClick={fetchHealth} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">System Health Monitor</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Last updated: {lastRefresh.toLocaleTimeString()}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ExportButton
                        type="analytics"
                        filters={{ type: "health" }}
                        label="Export Health"
                        variant="outline"
                        size="sm"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchHealth}
                        disabled={loading}
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={runDiagnostics}
                        disabled={runningDiagnostics}
                    >
                        <Play className={cn("w-4 h-4 mr-2", runningDiagnostics && "animate-pulse")} />
                        Run Diagnostics
                    </Button>
                </div>
            </div>

            {/* Overall Status */}
            {health && (
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div
                            className={cn(
                                "flex items-center justify-center w-16 h-16 rounded-full",
                                health.overall.status === "healthy" && "bg-green-100 dark:bg-green-900/20",
                                health.overall.status === "degraded" && "bg-yellow-100 dark:bg-yellow-900/20",
                                health.overall.status === "unhealthy" && "bg-red-100 dark:bg-red-900/20"
                            )}
                        >
                            {health.overall.status === "healthy" && (
                                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                            )}
                            {health.overall.status === "degraded" && (
                                <AlertTriangle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                            )}
                            {health.overall.status === "unhealthy" && (
                                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold text-foreground">
                                {health.overall.status === "healthy" && "All Systems Operational"}
                                {health.overall.status === "degraded" && "System Degraded"}
                                {health.overall.status === "unhealthy" && "System Unhealthy"}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {health.overall.message}
                            </p>
                        </div>
                        <StatusBadge status={health.overall.status} />
                    </div>
                </Card>
            )}

            <Tabs defaultValue="components" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="components">Components</TabsTrigger>
                    <TabsTrigger value="alerts">
                        Alerts
                        {alerts.length > 0 && (
                            <Badge variant="destructive" className="ml-2">
                                {alerts.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
                </TabsList>

                {/* Components Tab */}
                <TabsContent value="components" className="space-y-4">
                    {health && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ComponentCard
                                name="Database"
                                icon={Database}
                                health={health.database}
                            />
                            <ComponentCard
                                name="Redis Cache"
                                icon={Zap}
                                health={health.redis}
                            />
                            <ComponentCard
                                name="Browser Pool"
                                icon={Globe}
                                health={health.browserPool}
                            />
                            <ComponentCard
                                name="Circuit Breakers"
                                icon={Shield}
                                health={health.circuitBreakers}
                            />
                        </div>
                    )}
                </TabsContent>

                {/* Alerts Tab */}
                <TabsContent value="alerts" className="space-y-4">
                    {alerts.length === 0 ? (
                        <Card className="p-8">
                            <div className="text-center">
                                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-foreground mb-2">
                                    No Active Alerts
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    All systems are running smoothly
                                </p>
                            </div>
                        </Card>
                    ) : (
                        <ScrollArea className="h-[600px]">
                            <div className="space-y-3">
                                {alerts.map((alert) => (
                                    <AlertCard
                                        key={alert.id}
                                        alert={alert}
                                        onAcknowledge={acknowledgeAlert}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </TabsContent>

                {/* Diagnostics Tab */}
                <TabsContent value="diagnostics" className="space-y-4">
                    {!diagnostics ? (
                        <Card className="p-8">
                            <div className="text-center">
                                <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-foreground mb-2">
                                    No Diagnostics Run Yet
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Click &quot;Run Diagnostics&quot; to perform a comprehensive system check
                                </p>
                                <Button onClick={runDiagnostics} disabled={runningDiagnostics}>
                                    <Play className="w-4 h-4 mr-2" />
                                    Run Diagnostics
                                </Button>
                            </div>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {/* Diagnostics Summary */}
                            <Card className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-foreground">
                                            Diagnostic Results
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Completed in {diagnostics.totalTime}ms at{" "}
                                            {diagnostics.timestamp.toLocaleString()}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={runDiagnostics}
                                        disabled={runningDiagnostics}
                                    >
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Re-run
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <DiagnosticSummaryCard
                                        title="Database"
                                        status={diagnostics.database.overall}
                                        testCount={diagnostics.database.tests.length}
                                    />
                                    <DiagnosticSummaryCard
                                        title="Redis"
                                        status={diagnostics.redis.overall}
                                        testCount={diagnostics.redis.tests.length}
                                    />
                                    <DiagnosticSummaryCard
                                        title="Connectivity"
                                        status={diagnostics.connectivity.overall}
                                        testCount={diagnostics.connectivity.tests.length}
                                    />
                                    <DiagnosticSummaryCard
                                        title="Performance"
                                        status={diagnostics.performance.overall}
                                        testCount={diagnostics.performance.tests.length}
                                    />
                                </div>
                            </Card>

                            {/* Detailed Test Results */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DiagnosticCategoryCard
                                    title="Database Tests"
                                    category={diagnostics.database}
                                />
                                <DiagnosticCategoryCard
                                    title="Redis Tests"
                                    category={diagnostics.redis}
                                />
                                <DiagnosticCategoryCard
                                    title="Connectivity Tests"
                                    category={diagnostics.connectivity}
                                />
                                <DiagnosticCategoryCard
                                    title="Performance Tests"
                                    category={diagnostics.performance}
                                />
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Component Card
function ComponentCard({
    name,
    icon: Icon,
    health,
}: {
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    health: ComponentHealth;
}) {
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div
                        className={cn(
                            "flex items-center justify-center w-10 h-10 rounded-lg",
                            health.status === "healthy" && "bg-green-100 dark:bg-green-900/20",
                            health.status === "degraded" && "bg-yellow-100 dark:bg-yellow-900/20",
                            health.status === "unhealthy" && "bg-red-100 dark:bg-red-900/20"
                        )}
                    >
                        <Icon
                            className={cn(
                                "w-5 h-5",
                                health.status === "healthy" && "text-green-600 dark:text-green-400",
                                health.status === "degraded" && "text-yellow-600 dark:text-yellow-400",
                                health.status === "unhealthy" && "text-red-600 dark:text-red-400"
                            )}
                        />
                    </div>
                    <div>
                        <h4 className="font-semibold text-foreground">{name}</h4>
                        <p className="text-xs text-muted-foreground">{health.message}</p>
                    </div>
                </div>
                <StatusBadge status={health.status} />
            </div>

            {health.details && (
                <div className="mt-4 pt-4 border-t border-border">
                    <div className="space-y-2">
                        {health.details.responseTime !== undefined && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Response Time</span>
                                <span className="font-medium text-foreground">
                                    {health.details.responseTime}ms
                                </span>
                            </div>
                        )}
                        {health.details.inUse !== undefined && health.details.total !== undefined && (
                            <>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Usage</span>
                                    <span className="font-medium text-foreground">
                                        {health.details.inUse} / {health.details.total}
                                    </span>
                                </div>
                                <Progress
                                    value={(health.details.inUse / health.details.total) * 100}
                                    className="h-2"
                                />
                            </>
                        )}
                        {health.details.openBreakers !== undefined && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Open Breakers</span>
                                <span className="font-medium text-foreground">
                                    {health.details.openBreakers.length}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
}

// Alert Card
function AlertCard({
    alert,
    onAcknowledge,
}: {
    alert: SystemAlertData;
    onAcknowledge: (id: string) => void;
}) {
    return (
        <Card className="p-4">
            <div className="flex items-start gap-4">
                <div
                    className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0",
                        alert.severity === "critical" && "bg-red-100 dark:bg-red-900/20",
                        alert.severity === "warning" && "bg-yellow-100 dark:bg-yellow-900/20",
                        alert.severity === "info" && "bg-blue-100 dark:bg-blue-900/20"
                    )}
                >
                    <AlertCircle
                        className={cn(
                            "w-5 h-5",
                            alert.severity === "critical" && "text-red-600 dark:text-red-400",
                            alert.severity === "warning" && "text-yellow-600 dark:text-yellow-400",
                            alert.severity === "info" && "text-blue-600 dark:text-blue-400"
                        )}
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                            <h4 className="font-semibold text-foreground">{alert.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                        </div>
                        <SeverityBadge severity={alert.severity} />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {new Date(alert.createdAt).toLocaleString()}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAcknowledge(alert.id)}
                        >
                            Acknowledge
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}

// Diagnostic Summary Card
function DiagnosticSummaryCard({
    title,
    status,
    testCount,
}: {
    title: string;
    status: "passed" | "failed" | "warning";
    testCount: number;
}) {
    return (
        <div className="p-4 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{title}</span>
                {status === "passed" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                {status === "warning" && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                {status === "failed" && <XCircle className="w-4 h-4 text-red-500" />}
            </div>
            <p className="text-xs text-muted-foreground">{testCount} tests</p>
        </div>
    );
}

// Diagnostic Category Card
function DiagnosticCategoryCard({
    title,
    category,
}: {
    title: string;
    category: DiagnosticCategory;
}) {
    return (
        <Card className="p-6">
            <h4 className="font-semibold text-foreground mb-4">{title}</h4>
            <div className="space-y-3">
                {category.tests.map((test, index) => (
                    <div key={index} className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                            {test.status === "passed" && (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                            {test.status === "warning" && (
                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            )}
                            {test.status === "failed" && (
                                <XCircle className="w-4 h-4 text-red-500" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{test.name}</p>
                            {test.duration !== undefined && (
                                <p className="text-xs text-muted-foreground">
                                    {test.duration}ms
                                </p>
                            )}
                            {test.message && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {test.message}
                                </p>
                            )}
                            {test.error && (
                                <p className="text-xs text-red-500 mt-1">{test.error}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}

// Status Badge
function StatusBadge({ status }: { status: "healthy" | "degraded" | "unhealthy" }) {
    return (
        <Badge
            variant={
                status === "healthy"
                    ? "default"
                    : status === "degraded"
                        ? "secondary"
                        : "destructive"
            }
            className={cn(
                status === "healthy" && "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
                status === "degraded" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
            )}
        >
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
    );
}

// Severity Badge
function SeverityBadge({ severity }: { severity: AlertSeverity }) {
    return (
        <Badge
            variant={
                severity === "critical"
                    ? "destructive"
                    : severity === "warning"
                        ? "secondary"
                        : "default"
            }
            className={cn(
                severity === "warning" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
                severity === "info" && "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
            )}
        >
            {severity.charAt(0).toUpperCase() + severity.slice(1)}
        </Badge>
    );
}
