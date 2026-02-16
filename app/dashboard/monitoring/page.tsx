"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Database,
    Globe,
    Server,
    TrendingDown,
    TrendingUp,
    XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    AreaChart,
    Area,
} from "recharts";

/**
 * Monitoring Dashboard Page
 *
 * Displays real-time system health metrics including:
 * - System health status with color indicators
 * - Error rate chart with historical trend
 * - Response time metrics (avg, p95, p99)
 * - Scraping metrics
 * - Price update metrics
 * - Active alerts with severity badges
 * - Resource utilization
 *
 * Features:
 * - 30-second auto-refresh
 * - Admin role guard
 * - Real-time metric updates
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */

interface SystemHealth {
    status: "healthy" | "degraded" | "critical";
    errorRate: number;
    avgResponseTime: number;
    activeAlerts: number;
    lastUpdated: string;
    components: Array<{
        name: string;
        status: "healthy" | "degraded" | "critical";
        message?: string;
    }>;
}

interface MetricDataPoint {
    timestamp: number;
    value: number;
    labels?: Record<string, string>;
}

interface MetricData {
    metricType: string;
    timeWindow: number;
    dataPoints: MetricDataPoint[];
    aggregates: {
        count: number;
        sum: number;
        avg: number;
        min: number;
        max: number;
        p50?: number;
        p95?: number;
        p99?: number;
    };
}

interface Alert {
    ruleId: string;
    ruleName: string;
    severity: "CRITICAL" | "WARNING" | "INFO";
    triggeredAt: string;
    metricValue: number;
    threshold: number;
    tenantId?: string | null;
    context: Record<string, any>;
}

export default function MonitoringDashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
    const [errorRateHistory, setErrorRateHistory] = useState<MetricData | null>(null);
    const [responseTimeHistory, setResponseTimeHistory] = useState<MetricData | null>(null);
    const [scrapingMetrics, setScrapingMetrics] = useState<MetricData | null>(null);
    const [priceUpdateMetrics, setPriceUpdateMetrics] = useState<MetricData | null>(null);
    const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
    const [resolvedAlerts, setResolvedAlerts] = useState<Alert[]>([]);
    const [endpointMetrics, setEndpointMetrics] = useState<Record<string, any> | null>(null);
    const [syncMetrics, setSyncMetrics] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
    const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);

    // Check admin access
    useEffect(() => {
        if (status === "loading") return;

        if (!session?.user) {
            router.push("/auth/login");
            return;
        }

        const isAdmin = session.user.role === "ADMIN" || session.user.isSuperAdmin === true;
        if (!isAdmin) {
            router.push("/dashboard");
            return;
        }
    }, [session, status, router]);

    // Fetch tenants list for super admins
    useEffect(() => {
        if (session?.user?.isSuperAdmin) {
            fetch("/api/v1/admin/tenants")
                .then((res) => res.json())
                .then((data) => {
                    if (data.success) {
                        setTenants(data.data.tenants || []);
                    }
                })
                .catch((error) => {
                    console.error("Failed to fetch tenants:", error);
                });
        }
    }, [session]);

    // Fetch all monitoring data
    const fetchMonitoringData = useCallback(async () => {
        try {
            // Build query params with optional tenant filter
            const tenantParam = selectedTenantId ? `&tenantId=${selectedTenantId}` : "";

            // Fetch system health
            const healthRes = await fetch("/api/v1/monitoring/health");
            if (healthRes.ok) {
                const healthData = await healthRes.json();
                setSystemHealth(healthData.data);
            }

            // Fetch error rate history (last 1 hour)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const now = new Date().toISOString();

            const errorRateRes = await fetch(
                `/api/v1/monitoring/metrics?metricType=error&startTime=${oneHourAgo}&endTime=${now}&granularity=5m${tenantParam}`
            );
            if (errorRateRes.ok) {
                const errorData = await errorRateRes.json();
                setErrorRateHistory(errorData.data);
            }

            // Fetch endpoint metrics (response time)
            const endpointRes = await fetch(
                `/api/v1/monitoring/metrics/by-endpoint?metricType=response_time&startTime=${oneHourAgo}&endTime=${now}${tenantParam}`
            );
            if (endpointRes.ok) {
                const data = await endpointRes.json();
                setEndpointMetrics(data.data);
            }

            // Fetch sync metrics
            const syncRes = await fetch(
                `/api/v1/monitoring/metrics/sync?startTime=${oneHourAgo}&endTime=${now}${tenantParam}`
            );
            if (syncRes.ok) {
                const data = await syncRes.json();
                setSyncMetrics(data.data);
            }

            // Fetch response time history
            const responseTimeRes = await fetch(
                `/api/v1/monitoring/metrics?metricType=response_time&startTime=${oneHourAgo}&endTime=${now}&granularity=5m${tenantParam}`
            );
            if (responseTimeRes.ok) {
                const responseData = await responseTimeRes.json();
                setResponseTimeHistory(responseData.data);
            }

            // Fetch scraping metrics
            const scrapingRes = await fetch(
                `/api/v1/monitoring/metrics?metricType=scraping_success&startTime=${oneHourAgo}&endTime=${now}&granularity=5m${tenantParam}`
            );
            if (scrapingRes.ok) {
                const scrapingData = await scrapingRes.json();
                setScrapingMetrics(scrapingData.data);
            }

            // Fetch price update metrics
            const priceUpdateRes = await fetch(
                `/api/v1/monitoring/metrics?metricType=price_update&startTime=${oneHourAgo}&endTime=${now}&granularity=5m${tenantParam}`
            );
            if (priceUpdateRes.ok) {
                const priceData = await priceUpdateRes.json();
                setPriceUpdateMetrics(priceData.data);
            }

            // Fetch active alerts
            const alertsRes = await fetch(`/api/v1/monitoring/alerts${tenantParam ? `?tenantId=${selectedTenantId}` : ""}`);
            if (alertsRes.ok) {
                const alertsData = await alertsRes.json();
                setActiveAlerts(alertsData.data.alerts || []);
            }

            // Fetch recently resolved alerts (last 24 hours)
            const resolvedAlertsRes = await fetch(`/api/v1/monitoring/alerts/history?limit=20${tenantParam ? `&tenantId=${selectedTenantId}` : ""}`);
            if (resolvedAlertsRes.ok) {
                const resolvedData = await resolvedAlertsRes.json();
                // Filter to only show resolved alerts
                const resolved = (resolvedData.data.alerts || []).filter((alert: any) => alert.resolvedAt);
                setResolvedAlerts(resolved);
            }

            setLastRefresh(new Date());
        } catch (error) {
            console.error("Failed to fetch monitoring data:", error);
        } finally {
            setLoading(false);
        }
    }, [selectedTenantId]);

    // Initial fetch
    useEffect(() => {
        if (session?.user && (session.user.role === "ADMIN" || session.user.isSuperAdmin)) {
            fetchMonitoringData();
        }
    }, [session, fetchMonitoringData]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!session?.user) return;

        const interval = setInterval(() => {
            fetchMonitoringData();
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [session, fetchMonitoringData]);

    // Format chart data
    const formatChartData = (metricData: MetricData | null) => {
        if (!metricData) return [];

        return metricData.dataPoints.map((point) => ({
            time: new Date(point.timestamp).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
            }),
            value: point.value,
        }));
    };

    // Get status color
    const getStatusColor = (status: "healthy" | "degraded" | "critical") => {
        switch (status) {
            case "healthy":
                return "text-success";
            case "degraded":
                return "text-warning";
            case "critical":
                return "text-danger";
            default:
                return "text-muted-foreground";
        }
    };

    // Get status icon
    const getStatusIcon = (status: "healthy" | "degraded" | "critical") => {
        switch (status) {
            case "healthy":
                return <CheckCircle2 className="w-5 h-5" />;
            case "degraded":
                return <AlertTriangle className="w-5 h-5" />;
            case "critical":
                return <XCircle className="w-5 h-5" />;
            default:
                return <Activity className="w-5 h-5" />;
        }
    };

    // Get severity badge variant
    const getSeverityVariant = (severity: string) => {
        switch (severity) {
            case "CRITICAL":
                return "destructive";
            case "WARNING":
                return "default";
            case "INFO":
                return "secondary";
            default:
                return "outline";
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="h-8 w-64 mb-2" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-96" />
                    <Skeleton className="h-96" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>
                    <p className="text-muted-foreground mt-1">
                        Real-time system health and performance metrics
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Tenant Filter (Super Admin Only) */}
                    {session?.user?.isSuperAdmin && tenants.length > 0 && (
                        <Select
                            value={selectedTenantId || "all"}
                            onValueChange={(value) => setSelectedTenantId(value === "all" ? null : value)}
                        >
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="All Tenants" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Tenants</SelectItem>
                                {tenants.map((tenant) => (
                                    <SelectItem key={tenant.id} value={tenant.id}>
                                        {tenant.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>

            {/* System Health Status */}
            {systemHealth && (
                <Card className="border-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <span className={cn("flex items-center gap-2", getStatusColor(systemHealth.status))}>
                                    {getStatusIcon(systemHealth.status)}
                                    System Status: {systemHealth.status.toUpperCase()}
                                </span>
                            </CardTitle>
                            <Badge variant={systemHealth.status === "healthy" ? "default" : "destructive"}>
                                {systemHealth.activeAlerts} Active Alerts
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {systemHealth.components.map((component) => (
                                <div
                                    key={component.name}
                                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                                >
                                    <span className={cn("flex-shrink-0", getStatusColor(component.status))}>
                                        {getStatusIcon(component.status)}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{component.name}</p>
                                        {component.message && (
                                            <p className="text-xs text-muted-foreground truncate">
                                                {component.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Sync Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="col-span-1 md:col-span-4 bg-muted/10">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Sync Activity (Last hour)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                             <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs uppercase">Active</span>
                                <span className="text-2xl font-bold text-primary">{syncMetrics?.active || 0}</span>
                             </div>
                             <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs uppercase">Queued</span>
                                <span className="text-2xl font-bold">{syncMetrics?.queued || 0}</span>
                             </div>
                             <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs uppercase">Completed</span>
                                <span className="text-2xl font-bold text-success">{syncMetrics?.completed || 0}</span>
                             </div>
                             <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs uppercase">Failed</span>
                                <span className="text-2xl font-bold text-destructive">{syncMetrics?.failed || 0}</span>
                             </div>
                             <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs uppercase">Avg Duration</span>
                                <span className="text-2xl font-bold">{(syncMetrics?.avgDuration / 1000 || 0).toFixed(1)}s</span>
                             </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Error Rate */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Error Rate
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">
                                {systemHealth?.errorRate.toFixed(2)}%
                            </span>
                            <span className="text-sm text-muted-foreground">last 5m</span>
                        </div>
                        {systemHealth && systemHealth.errorRate > 1 && (
                            <div className="flex items-center gap-1 mt-2 text-danger text-sm">
                                <TrendingUp className="w-4 h-4" />
                                <span>Above threshold</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Avg Response Time */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Avg Response Time
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">
                                {systemHealth?.avgResponseTime.toFixed(0)}
                            </span>
                            <span className="text-sm text-muted-foreground">ms</span>
                        </div>
                        {responseTimeHistory?.aggregates && (
                            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                                <span>p95: {responseTimeHistory.aggregates.p95?.toFixed(0)}ms</span>
                                <span>•</span>
                                <span>p99: {responseTimeHistory.aggregates.p99?.toFixed(0)}ms</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Scraping Success Rate */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Scraping Success
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">
                                {scrapingMetrics?.aggregates && scrapingMetrics.aggregates.count > 0
                                    ? ((scrapingMetrics.aggregates.sum / scrapingMetrics.aggregates.count) * 100).toFixed(1)
                                    : "0.0"}%
                            </span>
                            <span className="text-sm text-muted-foreground">success</span>
                        </div>
                        {scrapingMetrics?.aggregates && (
                            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                                <span>{scrapingMetrics.aggregates.count} requests</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Price Update Success */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Price Updates
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">
                                {priceUpdateMetrics?.aggregates && priceUpdateMetrics.aggregates.count > 0
                                    ? ((priceUpdateMetrics.aggregates.sum / priceUpdateMetrics.aggregates.count) * 100).toFixed(1)
                                    : "0.0"}%
                            </span>
                            <span className="text-sm text-muted-foreground">success</span>
                        </div>
                        {priceUpdateMetrics?.aggregates && (
                            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                                <span>{priceUpdateMetrics.aggregates.count} updates</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Error Rate Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingDown className="w-5 h-5" />
                            Error Rate Trend
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">Last hour</p>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={formatChartData(errorRateHistory)}>
                                    <defs>
                                        <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--danger))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--danger))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis
                                        dataKey="time"
                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                    />
                                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: "0.5rem",
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke="hsl(var(--danger))"
                                        strokeWidth={2}
                                        fill="url(#errorGradient)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Response Time Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="w-5 h-5" />
                            Response Time Trend
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">Last hour</p>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={formatChartData(responseTimeHistory)}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis
                                        dataKey="time"
                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                    />
                                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: "0.5rem",
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top Slowest Endpoints Table */}
            {endpointMetrics && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Top Slowest Endpoints (Last hour)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Endpoint</TableHead>
                                    <TableHead>Requests</TableHead>
                                    <TableHead>Avg Latency</TableHead>
                                    <TableHead>P95 Latency</TableHead>
                                    <TableHead>P99 Latency</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(endpointMetrics)
                                    .sort(([, a], [, b]) => b.p95 - a.p95)
                                    .slice(0, 5)
                                    .map(([endpoint, metrics]) => (
                                        <TableRow key={endpoint}>
                                            <TableCell className="font-medium text-xs font-mono">{endpoint}</TableCell>
                                            <TableCell>{metrics.count}</TableCell>
                                            <TableCell>{metrics.avg.toFixed(0)}ms</TableCell>
                                            <TableCell className="text-warning">{metrics.p95?.toFixed(0)}ms</TableCell>
                                            <TableCell className="text-destructive">{metrics.p99?.toFixed(0)}ms</TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Active Alerts */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Active Alerts ({activeAlerts.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {activeAlerts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-success" />
                            <p>No active alerts</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Alert</TableHead>
                                    <TableHead>Severity</TableHead>
                                    <TableHead>Metric Value</TableHead>
                                    <TableHead>Threshold</TableHead>
                                    <TableHead>Triggered</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activeAlerts.map((alert, index) => (
                                    <TableRow key={`${alert.ruleId}-${index}`}>
                                        <TableCell className="font-medium">{alert.ruleName}</TableCell>
                                        <TableCell>
                                            <Badge variant={getSeverityVariant(alert.severity)}>
                                                {alert.severity}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{alert.metricValue.toFixed(2)}</TableCell>
                                        <TableCell>{alert.threshold.toFixed(2)}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {new Date(alert.triggeredAt).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Recently Resolved Alerts */}
            {resolvedAlerts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-success" />
                            Recently Resolved Alerts ({resolvedAlerts.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Alert</TableHead>
                                    <TableHead>Severity</TableHead>
                                    <TableHead>Triggered</TableHead>
                                    <TableHead>Resolved</TableHead>
                                    <TableHead>Duration</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {resolvedAlerts.map((alert: any, index) => {
                                    const triggeredTime = new Date(alert.triggeredAt);
                                    const resolvedTime = new Date(alert.resolvedAt);
                                    const durationMs = resolvedTime.getTime() - triggeredTime.getTime();
                                    const durationMinutes = Math.floor(durationMs / 60000);
                                    const durationHours = Math.floor(durationMinutes / 60);
                                    const remainingMinutes = durationMinutes % 60;

                                    const durationText = durationHours > 0
                                        ? `${durationHours}h ${remainingMinutes}m`
                                        : `${durationMinutes}m`;

                                    return (
                                        <TableRow key={`${alert.ruleId}-${index}`}>
                                            <TableCell className="font-medium">{alert.ruleName}</TableCell>
                                            <TableCell>
                                                <Badge variant={getSeverityVariant(alert.severity)}>
                                                    {alert.severity}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {triggeredTime.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-success">
                                                {resolvedTime.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {durationText}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Resource Utilization */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Database className="w-4 h-4" />
                            Database
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Connections</span>
                                <span className="font-medium">
                                    {systemHealth?.components.find((c) => c.name === "Database")?.status === "healthy"
                                        ? "Healthy"
                                        : "Degraded"}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Server className="w-4 h-4" />
                            Redis Cache
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Status</span>
                                <span className="font-medium">
                                    {systemHealth?.components.find((c) => c.name === "Redis")?.status === "healthy"
                                        ? "Healthy"
                                        : "Degraded"}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            External APIs
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Status</span>
                                <span className="font-medium">
                                    {systemHealth?.components.find((c) => c.name === "External APIs")?.status === "healthy"
                                        ? "Healthy"
                                        : "Degraded"}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
