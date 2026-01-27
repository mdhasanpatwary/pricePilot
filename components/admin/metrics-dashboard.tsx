"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Activity,
    Clock,
    AlertCircle,
    CheckCircle2,
    TrendingUp,
    TrendingDown,
    Globe,
    Shield,
    BarChart3,
    RefreshCw,
    Filter,
    Users,
    Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DashboardMetrics,
    FailureStats,
    TimeSeriesData,
} from "@/lib/types/admin-dashboard";
import { ExportButton } from "./export-button";
import { metricsCache, analyticsCache } from "@/lib/utils/cache";
import { usePagination } from "@/lib/hooks/usePagination";
import { Pagination } from "@/components/ui/pagination";

interface MetricsDashboardProps {
    refreshInterval?: number; // default: 10000ms
}

// Metric card component
function MetricCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    color,
}: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ComponentType<{ className?: string }>;
    trend?: { value: number; isPositive: boolean };
    color: string;
}) {
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">{title}</p>
                    <p className="text-3xl font-bold text-foreground mb-1">{value}</p>
                    {subtitle && (
                        <p className="text-xs text-muted-foreground">{subtitle}</p>
                    )}
                    {trend && (
                        <div className="flex items-center gap-1 mt-2">
                            {trend.isPositive ? (
                                <TrendingUp className="w-3 h-3 text-green-500" />
                            ) : (
                                <TrendingDown className="w-3 h-3 text-red-500" />
                            )}
                            <span
                                className={cn(
                                    "text-xs font-medium",
                                    trend.isPositive ? "text-green-500" : "text-red-500"
                                )}
                            >
                                {Math.abs(trend.value).toFixed(1)}%
                            </span>
                        </div>
                    )}
                </div>
                <div
                    className={cn(
                        "flex items-center justify-center w-12 h-12 rounded-lg",
                        color
                    )}
                >
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </Card>
    );
}

// Proxy health table component
function ProxyHealthTable({ proxies }: { proxies: any[] }) {
    const [sortBy, setSortBy] = useState<"successRate" | "responseTime" | "requests">(
        "successRate"
    );
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    const sortedProxies = [...proxies].sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

    // Add pagination
    const pagination = usePagination(sortedProxies, {
        pageSize: 10,
    });

    const toggleSort = (column: typeof sortBy) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortBy(column);
            setSortOrder("desc");
        }
    };

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="border-b">
                        <tr>
                            <th className="text-left p-3 font-medium">Proxy</th>
                            <th className="text-left p-3 font-medium">Type</th>
                            <th className="text-left p-3 font-medium">Status</th>
                            <th
                                className="text-right p-3 font-medium cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleSort("successRate")}
                            >
                                Success Rate {sortBy === "successRate" && (sortOrder === "asc" ? "↑" : "↓")}
                            </th>
                            <th
                                className="text-right p-3 font-medium cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleSort("responseTime")}
                            >
                                Avg Response {sortBy === "responseTime" && (sortOrder === "asc" ? "↑" : "↓")}
                            </th>
                            <th
                                className="text-right p-3 font-medium cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleSort("requests")}
                            >
                                Requests {sortBy === "requests" && (sortOrder === "asc" ? "↑" : "↓")}
                            </th>
                            <th className="text-right p-3 font-medium">Last Check</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {pagination.paginatedData.map((proxy, index) => (
                            <tr key={index} className="hover:bg-muted/50">
                                <td className="p-3">
                                    <code className="text-xs">{proxy.url}</code>
                                </td>
                                <td className="p-3">
                                    <Badge variant="outline" className="text-xs">
                                        {proxy.type}
                                    </Badge>
                                </td>
                                <td className="p-3">
                                    <Badge
                                        variant={
                                            proxy.status === "healthy"
                                                ? "default"
                                                : proxy.status === "degraded"
                                                    ? "secondary"
                                                    : "destructive"
                                        }
                                        className="text-xs"
                                    >
                                        {proxy.status}
                                    </Badge>
                                </td>
                                <td className="p-3 text-right">
                                    <span
                                        className={cn(
                                            "font-medium",
                                            proxy.successRate >= 80
                                                ? "text-green-500"
                                                : proxy.successRate >= 50
                                                    ? "text-yellow-500"
                                                    : "text-red-500"
                                        )}
                                    >
                                        {proxy.successRate.toFixed(1)}%
                                    </span>
                                </td>
                                <td className="p-3 text-right">{proxy.responseTime}ms</td>
                                <td className="p-3 text-right">{proxy.requests}</td>
                                <td className="p-3 text-right text-xs text-muted-foreground">
                                    {proxy.lastCheck}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {sortedProxies.length > 10 && (
                <Pagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    pageSize={pagination.pageSize}
                    totalItems={pagination.totalItems}
                    onPageChange={pagination.goToPage}
                    onPageSizeChange={pagination.setPageSize}
                    pageSizeOptions={[10, 25, 50]}
                />
            )}
        </div>
    );
}

// Challenge statistics component
function ChallengeStatistics({ challenges }: { challenges: any[] }) {
    const totalChallenges = challenges.reduce((sum, c) => sum + c.count, 0);

    return (
        <div className="space-y-4">
            {challenges.map((challenge, index) => {
                const percentage = totalChallenges > 0 ? (challenge.count / totalChallenges) * 100 : 0;
                return (
                    <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline">{challenge.type}</Badge>
                                <span className="text-sm text-muted-foreground">
                                    {challenge.count} occurrences
                                </span>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium">
                                    {challenge.solveRate.toFixed(1)}% solved
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Avg: {challenge.avgSolveTime}ms
                                </p>
                            </div>
                        </div>
                        <Progress value={percentage} className="h-2" />
                    </div>
                );
            })}
        </div>
    );
}

// Time series chart component (simplified)
function TimeSeriesChart({ data }: { data: TimeSeriesData }) {
    if (!data || !data.dataPoints || data.dataPoints.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p className="text-sm">No data available</p>
            </div>
        );
    }

    const maxValue = Math.max(...data.dataPoints.map((d) => d.value));
    const minValue = Math.min(...data.dataPoints.map((d) => d.value));
    const range = maxValue - minValue || 1;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Max: {maxValue}</span>
                <span className="text-muted-foreground">Min: {minValue}</span>
            </div>
            <div className="relative h-48 flex items-end gap-1">
                {data.dataPoints.map((point, index) => {
                    const height = ((point.value - minValue) / range) * 100;
                    return (
                        <div
                            key={index}
                            className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t relative group"
                            style={{ height: `${Math.max(height, 5)}%` }}
                        >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
                                <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                    <p className="font-medium">{point.value}</p>
                                    <p className="text-muted-foreground">
                                        {new Date(point.timestamp).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                    {new Date(data.dataPoints[0].timestamp).toLocaleTimeString()}
                </span>
                <span>
                    {new Date(
                        data.dataPoints[data.dataPoints.length - 1].timestamp
                    ).toLocaleTimeString()}
                </span>
            </div>
        </div>
    );
}

// Top failures component
function TopFailures({ failures }: { failures: FailureStats[] }) {
    return (
        <div className="space-y-3">
            {failures.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground py-8">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <p className="text-sm">No failures detected</p>
                </div>
            ) : (
                failures.map((failure, index) => (
                    <Card key={index} className="p-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm font-medium truncate">
                                        {failure.identifier}
                                    </span>
                                    <Badge variant="destructive" className="text-xs">
                                        {failure.failureRate.toFixed(1)}%
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span>
                                        {failure.failedRequests} / {failure.totalRequests} failed
                                    </span>
                                    <span>•</span>
                                    <span>
                                        Last: {new Date(failure.lastFailure).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10">
                                <AlertCircle className="w-4 h-4 text-red-500" />
                            </div>
                        </div>
                    </Card>
                ))
            )}
        </div>
    );
}

// Main MetricsDashboard component
export default function MetricsDashboard({
    refreshInterval = 10000,
}: MetricsDashboardProps) {
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [proxyHealth, setProxyHealth] = useState<any[]>([]);
    const [challengeStats, setChallengeStats] = useState<any[]>([]);
    const [topSiteFailures, setTopSiteFailures] = useState<FailureStats[]>([]);
    const [topProxyFailures, setTopProxyFailures] = useState<FailureStats[]>([]);
    const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d">("24h");

    // Fetch dashboard metrics
    const fetchMetrics = useCallback(async () => {
        try {
            // Try cache first
            const cacheKey = "dashboard-metrics";
            const cached = metricsCache.get(cacheKey);
            if (cached) {
                setMetrics(cached);
                setError(null);
                return;
            }

            const response = await fetch("/api/v1/admin/metrics/dashboard");
            if (!response.ok) {
                throw new Error("Failed to fetch metrics");
            }

            const data = await response.json();
            if (data.success) {
                setMetrics(data.data);
                metricsCache.set(cacheKey, data.data);
                setError(null);
            } else {
                throw new Error(data.error || "Unknown error");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch metrics");
        }
    }, []);

    // Fetch proxy analytics
    const fetchProxyAnalytics = useCallback(async () => {
        try {
            const cacheKey = `proxy-analytics-${timeRange}`;
            const cached = analyticsCache.get(cacheKey);
            if (cached) {
                setProxyHealth(cached.proxyHealth || []);
                setTopProxyFailures(cached.topFailures || []);
                return;
            }

            const response = await fetch(
                `/api/v1/admin/analytics/proxies?timeRange=${timeRange}`
            );
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setProxyHealth(data.data.proxyHealth || []);
                    setTopProxyFailures(data.data.topFailures || []);
                    analyticsCache.set(cacheKey, data.data);
                }
            }
        } catch (err) {
            console.error("Failed to fetch proxy analytics:", err);
        }
    }, [timeRange]);

    // Fetch challenge analytics
    const fetchChallengeAnalytics = useCallback(async () => {
        try {
            const cacheKey = `challenge-analytics-${timeRange}`;
            const cached = analyticsCache.get(cacheKey);
            if (cached) {
                setChallengeStats(cached.challengeStats || []);
                return;
            }

            const response = await fetch(
                `/api/v1/admin/analytics/challenges?timeRange=${timeRange}`
            );
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setChallengeStats(data.data.challengeStats || []);
                    analyticsCache.set(cacheKey, data.data);
                }
            }
        } catch (err) {
            console.error("Failed to fetch challenge analytics:", err);
        }
    }, [timeRange]);

    // Fetch site analytics
    const fetchSiteAnalytics = useCallback(async () => {
        try {
            const cacheKey = `site-analytics-${timeRange}`;
            const cached = analyticsCache.get(cacheKey);
            if (cached) {
                setTopSiteFailures(cached.topFailures || []);
                setTimeSeriesData(cached.timeSeries || null);
                return;
            }

            const response = await fetch(
                `/api/v1/admin/analytics/sites?timeRange=${timeRange}`
            );
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setTopSiteFailures(data.data.topFailures || []);
                    setTimeSeriesData(data.data.timeSeries || null);
                    analyticsCache.set(cacheKey, data.data);
                }
            }
        } catch (err) {
            console.error("Failed to fetch site analytics:", err);
        }
    }, [timeRange]);

    // Fetch all data
    const fetchAllData = useCallback(async () => {
        await Promise.all([
            fetchMetrics(),
            fetchProxyAnalytics(),
            fetchChallengeAnalytics(),
            fetchSiteAnalytics(),
        ]);
        setLastUpdate(new Date());
        setLoading(false);
    }, [fetchMetrics, fetchProxyAnalytics, fetchChallengeAnalytics, fetchSiteAnalytics]);

    // Initial fetch and auto-refresh
    useEffect(() => {
        fetchAllData();
        const interval = setInterval(fetchAllData, refreshInterval);
        return () => clearInterval(interval);
    }, [fetchAllData, refreshInterval]);

    if (loading && !metrics) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error && !metrics) {
        return (
            <Card className="p-6 bg-red-500/10 border-red-500/20">
                <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-sm text-red-500">{error}</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Metrics Dashboard</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Last updated: {lastUpdate.toLocaleTimeString()}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1h">Last Hour</SelectItem>
                                <SelectItem value="24h">Last 24h</SelectItem>
                                <SelectItem value="7d">Last 7 Days</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchAllData}>
                        <RefreshCw
                            className={cn("w-4 h-4 mr-2", loading && "animate-spin")}
                        />
                        Refresh
                    </Button>
                    <ExportButton
                        type="analytics"
                        filters={{ timeRange }}
                        label="Export"
                        variant="outline"
                        size="sm"
                    />
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <Card className="p-4 bg-red-500/10 border-red-500/20">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <p className="text-sm text-red-500">{error}</p>
                    </div>
                </Card>
            )}

            {/* Platform Metrics */}
            {metrics && (
                <>
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Platform Overview</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <MetricCard
                                title="Active Sessions"
                                value={metrics.platform.activeSessions}
                                icon={Activity}
                                color="bg-blue-500/10 text-blue-500"
                            />
                            <MetricCard
                                title="Requests/Min"
                                value={metrics.platform.requestsPerMinute.toFixed(1)}
                                icon={Zap}
                                color="bg-purple-500/10 text-purple-500"
                            />
                            <MetricCard
                                title="Avg Duration"
                                value={`${metrics.platform.avgSessionDuration.toFixed(1)}s`}
                                icon={Clock}
                                color="bg-orange-500/10 text-orange-500"
                            />
                            <MetricCard
                                title="Total Tenants"
                                value={metrics.platform.totalTenants}
                                subtitle={`${metrics.platform.activeTenants} active`}
                                icon={Users}
                                color="bg-green-500/10 text-green-500"
                            />
                            <MetricCard
                                title="Success Rate"
                                value={`${metrics.scraping.successRate.toFixed(1)}%`}
                                icon={CheckCircle2}
                                color="bg-emerald-500/10 text-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Scraping Metrics */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Scraping Performance</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard
                                title="Block Rate"
                                value={`${metrics.scraping.blockRate.toFixed(1)}%`}
                                icon={Shield}
                                color="bg-red-500/10 text-red-500"
                            />
                            <MetricCard
                                title="Challenge Rate"
                                value={`${metrics.scraping.challengeRate.toFixed(1)}%`}
                                icon={AlertCircle}
                                color="bg-yellow-500/10 text-yellow-500"
                            />
                            <MetricCard
                                title="Avg Response"
                                value={`${metrics.scraping.avgResponseTime.toFixed(0)}ms`}
                                icon={Clock}
                                color="bg-purple-500/10 text-purple-500"
                            />
                            <MetricCard
                                title="Requests (24h)"
                                value={metrics.scraping.requestsLast24h}
                                icon={BarChart3}
                                color="bg-blue-500/10 text-blue-500"
                            />
                        </div>
                    </div>

                    {/* Proxy Metrics */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Proxy Pool Status</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard
                                title="Total Proxies"
                                value={metrics.proxies.totalProxies}
                                subtitle={`${metrics.proxies.healthyProxies} healthy`}
                                icon={Globe}
                                color="bg-blue-500/10 text-blue-500"
                            />
                            <MetricCard
                                title="Avg Success Rate"
                                value={`${metrics.proxies.avgSuccessRate.toFixed(1)}%`}
                                icon={CheckCircle2}
                                color="bg-green-500/10 text-green-500"
                            />
                            <MetricCard
                                title="Avg Response"
                                value={`${metrics.proxies.avgResponseTime.toFixed(0)}ms`}
                                icon={Clock}
                                color="bg-purple-500/10 text-purple-500"
                            />
                            <MetricCard
                                title="Health Score"
                                value={`${((metrics.proxies.healthyProxies / Math.max(metrics.proxies.totalProxies, 1)) * 100).toFixed(0)}%`}
                                icon={Activity}
                                color="bg-emerald-500/10 text-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Challenge Metrics */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Challenge Detection</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <MetricCard
                                title="Total Challenges"
                                value={metrics.challenges.totalChallenges}
                                icon={Shield}
                                color="bg-yellow-500/10 text-yellow-500"
                            />
                            <MetricCard
                                title="Solve Rate"
                                value={`${metrics.challenges.solveRate.toFixed(1)}%`}
                                icon={CheckCircle2}
                                color="bg-green-500/10 text-green-500"
                            />
                            <MetricCard
                                title="Avg Solve Time"
                                value={`${metrics.challenges.avgSolveTime.toFixed(0)}ms`}
                                icon={Clock}
                                color="bg-purple-500/10 text-purple-500"
                            />
                        </div>
                    </div>
                </>
            )}

            {/* Tabbed Analytics */}
            <Tabs defaultValue="proxies" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="proxies">Proxy Health</TabsTrigger>
                    <TabsTrigger value="challenges">Challenges</TabsTrigger>
                    <TabsTrigger value="failures">Top Failures</TabsTrigger>
                    <TabsTrigger value="trends">Trends</TabsTrigger>
                </TabsList>

                {/* Proxy Health Tab */}
                <TabsContent value="proxies">
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">
                            Proxy Health Details ({proxyHealth.length} proxies)
                        </h3>
                        {proxyHealth.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Globe className="w-12 h-12 mx-auto opacity-50 mb-2" />
                                <p className="text-sm">No proxy data available</p>
                            </div>
                        ) : (
                            <ProxyHealthTable proxies={proxyHealth} />
                        )}
                    </Card>
                </TabsContent>

                {/* Challenges Tab */}
                <TabsContent value="challenges">
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Challenge Statistics</h3>
                        {challengeStats.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Shield className="w-12 h-12 mx-auto opacity-50 mb-2" />
                                <p className="text-sm">No challenge data available</p>
                            </div>
                        ) : (
                            <ChallengeStatistics challenges={challengeStats} />
                        )}
                    </Card>
                </TabsContent>

                {/* Top Failures Tab */}
                <TabsContent value="failures">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold mb-4">Top Failing Sites</h3>
                            <ScrollArea className="h-96">
                                <TopFailures failures={topSiteFailures} />
                            </ScrollArea>
                        </Card>
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold mb-4">Top Failing Proxies</h3>
                            <ScrollArea className="h-96">
                                <TopFailures failures={topProxyFailures} />
                            </ScrollArea>
                        </Card>
                    </div>
                </TabsContent>

                {/* Trends Tab */}
                <TabsContent value="trends">
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Request Volume Trends</h3>
                        {timeSeriesData ? (
                            <TimeSeriesChart data={timeSeriesData} />
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <BarChart3 className="w-12 h-12 mx-auto opacity-50 mb-2" />
                                <p className="text-sm">No trend data available</p>
                            </div>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
