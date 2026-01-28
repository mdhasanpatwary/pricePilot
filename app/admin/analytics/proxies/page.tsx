/**
 * Proxy Analytics Dashboard
 * 
 * Admin panel page for detailed proxy performance analytics.
 * Displays proxy performance metrics, success rates, response times,
 * and site-level breakdowns for individual proxies.
 * 
 * Features:
 * - Proxy selection dropdown
 * - Success rate and response time metrics
 * - Request volume by site breakdown
 * - Performance comparison table
 * - Time range selection (1h, 24h, 7d)
 * - Highlight underperforming proxies (success rate < 50%)
 * 
 * @page /admin/analytics/proxies
 * @requires Admin role
 * @validates Requirements 5.5, 11.1, 11.2, 11.3, 11.4, 11.5
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Server,
    RefreshCw,
    Clock,
    TrendingUp,
    Activity,
    AlertCircle,
    BarChart3,
    CheckCircle,
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
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

interface ProxyAnalytics {
    proxy: string;
    proxyType: "residential" | "datacenter" | "unknown";
    timeRange: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    avgResponseTime: number;
    requestsBySite: Array<{
        site: string;
        count: number;
        successRate: number;
    }>;
}

interface ProxyOption {
    url: string;
    type: string;
    isHealthy: boolean;
}

export default function ProxyAnalyticsDashboard() {
    const [analytics, setAnalytics] = useState<ProxyAnalytics | null>(null);
    const [proxies, setProxies] = useState<ProxyOption[]>([]);
    const [selectedProxy, setSelectedProxy] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d">("24h");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Fetch available proxies
    const fetchProxies = useCallback(async () => {
        try {
            const res = await fetch("/api/v1/admin/proxy-health?timeRange=24h");
            if (res.ok) {
                const json = await res.json();
                const proxyList = json.data?.proxies || [];
                setProxies(proxyList);
                if (proxyList.length > 0 && !selectedProxy) {
                    setSelectedProxy(proxyList[0].url);
                }
            }
        } catch (error) {
            console.error("Error fetching proxies:", error);
        }
    }, [selectedProxy]);

    // Fetch proxy analytics
    const fetchProxyAnalytics = useCallback(async (showRefreshing = false) => {
        if (!selectedProxy) return;

        if (showRefreshing) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const encodedProxy = encodeURIComponent(selectedProxy);
            const res = await fetch(
                `/api/v1/analytics/proxies/${encodedProxy}?timeRange=${timeRange}`
            );
            if (res.ok) {
                const json = await res.json();
                setAnalytics(json.data);
                setLastUpdated(new Date());
            } else {
                console.error("Failed to fetch proxy analytics");
            }
        } catch (error) {
            console.error("Error fetching proxy analytics:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedProxy, timeRange]);

    useEffect(() => {
        fetchProxies();
    }, [fetchProxies]);

    useEffect(() => {
        if (selectedProxy) {
            fetchProxyAnalytics();
        }
    }, [selectedProxy, timeRange, fetchProxyAnalytics]);

    const handleRefresh = () => {
        fetchProxyAnalytics(true);
    };

    if (loading && !analytics) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-muted-foreground font-medium">
                        Loading proxy analytics...
                    </p>
                </div>
            </div>
        );
    }

    if (!selectedProxy || proxies.length === 0) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center">
                    <Server className="w-12 h-12 text-muted-foreground opacity-50" />
                    <div>
                        <p className="font-semibold text-foreground mb-1">
                            No proxies available
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Proxy analytics will appear here once proxies are configured
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const isUnderperforming = analytics && analytics.successRate < 50;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Proxy Analytics Dashboard
                    </h1>
                    <p className="text-muted-foreground">
                        Detailed performance metrics and site-level breakdown for individual proxies
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
                        aria-label="Refresh proxy analytics"
                    >
                        <RefreshCw
                            className={cn("w-4 h-4", refreshing && "animate-spin")}
                            aria-hidden="true"
                        />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Proxy and Time Range Selection */}
            <Card className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Filters:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">
                                Proxy:
                            </label>
                            <Select
                                value={selectedProxy}
                                onValueChange={setSelectedProxy}
                            >
                                <SelectTrigger className="w-[280px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {proxies.map((proxy) => (
                                        <SelectItem key={proxy.url} value={proxy.url}>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs">
                                                    {proxy.url}
                                                </span>
                                                {!proxy.isHealthy && (
                                                    <Badge variant="destructive" className="text-[10px]">
                                                        Unhealthy
                                                    </Badge>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">
                                Time Range:
                            </label>
                            <Select
                                value={timeRange}
                                onValueChange={(value) =>
                                    setTimeRange(value as "1h" | "24h" | "7d")
                                }
                            >
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1h">Last Hour</SelectItem>
                                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                                    <SelectItem value="7d">Last 7 Days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </Card>

            {analytics && (
                <>
                    {/* Performance Warning Banner */}
                    {isUnderperforming && (
                        <Card className="p-4 border-red-500 bg-red-50/50 dark:bg-red-950/20">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                                        Underperforming Proxy Detected
                                    </h4>
                                    <p className="text-sm text-red-800 dark:text-red-200">
                                        This proxy has a success rate below 50% and may need attention.
                                        Consider replacing or investigating the cause of failures.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Summary Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <Card className="p-5">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Proxy Type
                                </p>
                                <Server className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <Badge
                                    variant={
                                        analytics.proxyType === "residential"
                                            ? "default"
                                            : "outline"
                                    }
                                    className="text-sm capitalize"
                                >
                                    {analytics.proxyType}
                                </Badge>
                            </div>
                        </Card>

                        <Card className="p-5">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Total Requests
                                </p>
                                <Activity className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-foreground">
                                    {analytics.totalRequests.toLocaleString()}
                                </span>
                            </div>
                        </Card>

                        <Card className="p-5">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Success Rate
                                </p>
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span
                                    className={cn(
                                        "text-2xl font-bold",
                                        analytics.successRate >= 80
                                            ? "text-emerald-600 dark:text-emerald-500"
                                            : analytics.successRate >= 50
                                                ? "text-amber-600 dark:text-amber-500"
                                                : "text-red-600 dark:text-red-500"
                                    )}
                                >
                                    {analytics.successRate.toFixed(1)}%
                                </span>
                            </div>
                            <div className="mt-2">
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full transition-all",
                                            analytics.successRate >= 80
                                                ? "bg-emerald-500"
                                                : analytics.successRate >= 50
                                                    ? "bg-amber-500"
                                                    : "bg-red-500"
                                        )}
                                        style={{ width: `${analytics.successRate}%` }}
                                    />
                                </div>
                            </div>
                        </Card>

                        <Card className="p-5">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Avg Response Time
                                </p>
                                <Activity className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span
                                    className={cn(
                                        "text-2xl font-bold",
                                        analytics.avgResponseTime < 1000
                                            ? "text-emerald-600 dark:text-emerald-500"
                                            : analytics.avgResponseTime < 3000
                                                ? "text-amber-600 dark:text-amber-500"
                                                : "text-red-600 dark:text-red-500"
                                    )}
                                >
                                    {analytics.avgResponseTime}
                                </span>
                                <span className="text-xs text-muted-foreground">ms</span>
                            </div>
                        </Card>

                        <Card className="p-5">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Failed Requests
                                </p>
                                <AlertCircle className="w-4 h-4 text-red-500" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-red-600 dark:text-red-500">
                                    {analytics.failedRequests.toLocaleString()}
                                </span>
                            </div>
                        </Card>
                    </div>

                    {/* Requests by Site Chart */}
                    <Card>
                        <div className="border-b bg-muted/50 px-6 py-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Request Volume by Site
                            </h3>
                        </div>
                        <div className="p-6">
                            {analytics.requestsBySite && analytics.requestsBySite.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={analytics.requestsBySite}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="site"
                                            tick={{ fontSize: 11 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={100}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 12 }}
                                            label={{
                                                value: "Request Count",
                                                angle: -90,
                                                position: "insideLeft",
                                            }}
                                        />
                                        <Tooltip />
                                        <Legend />
                                        <Bar
                                            dataKey="count"
                                            fill="#3b82f6"
                                            name="Requests"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                    <div className="text-center">
                                        <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No site data available</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Site Performance Table */}
                    <Card>
                        <div className="border-b bg-muted/50 px-6 py-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                                <Server className="w-4 h-4" />
                                Performance by Site
                            </h3>
                        </div>

                        <div className="overflow-x-auto -mx-6 sm:mx-0">
                            <table className="w-full text-sm min-w-[600px]">
                                <thead className="bg-muted/30 border-b border-border">
                                    <tr>
                                        <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                                            Site
                                        </th>
                                        <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                            Request Count
                                        </th>
                                        <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                            Success Rate
                                        </th>
                                        <th className="px-6 py-3 text-center font-medium text-muted-foreground">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border bg-card">
                                    {analytics.requestsBySite && analytics.requestsBySite.length > 0 ? (
                                        analytics.requestsBySite.map((site, index) => (
                                            <tr
                                                key={index}
                                                className={cn(
                                                    "hover:bg-muted/50 transition-colors",
                                                    site.successRate < 50 &&
                                                    "bg-red-50/30 dark:bg-red-950/10"
                                                )}
                                            >
                                                <td className="px-6 py-4">
                                                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                                        {site.site}
                                                    </code>
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono">
                                                    {site.count.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className={cn(
                                                                    "h-full transition-all",
                                                                    site.successRate >= 80
                                                                        ? "bg-emerald-500"
                                                                        : site.successRate >= 50
                                                                            ? "bg-amber-500"
                                                                            : "bg-red-500"
                                                                )}
                                                                style={{
                                                                    width: `${site.successRate}%`,
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="font-mono text-xs w-12 text-right">
                                                            {site.successRate.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {site.successRate >= 80 ? (
                                                        <Badge
                                                            variant="success"
                                                            className="flex items-center gap-1 w-fit mx-auto"
                                                        >
                                                            <CheckCircle className="w-3 h-3" />
                                                            Good
                                                        </Badge>
                                                    ) : site.successRate >= 50 ? (
                                                        <Badge
                                                            variant="warning"
                                                            className="flex items-center gap-1 w-fit mx-auto"
                                                        >
                                                            <AlertCircle className="w-3 h-3" />
                                                            Fair
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="destructive"
                                                            className="flex items-center gap-1 w-fit mx-auto"
                                                        >
                                                            <AlertCircle className="w-3 h-3" />
                                                            Poor
                                                        </Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="px-6 py-12 text-center text-muted-foreground"
                                            >
                                                <div className="flex flex-col items-center gap-2">
                                                    <Server className="w-10 h-10 opacity-50" />
                                                    <p className="font-medium">No site data available</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Summary Info */}
                    <Card className="p-5">
                        <h3 className="font-semibold text-sm uppercase tracking-wider mb-4">
                            Summary Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <span className="text-sm text-muted-foreground">
                                    Successful Requests
                                </span>
                                <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-500">
                                    {analytics.successfulRequests.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <span className="text-sm text-muted-foreground">
                                    Sites Served
                                </span>
                                <span className="text-lg font-bold font-mono">
                                    {analytics.requestsBySite?.length || 0}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <span className="text-sm text-muted-foreground">
                                    Time Range
                                </span>
                                <Badge variant="outline" className="text-xs">
                                    {analytics.timeRange === "1h"
                                        ? "Last Hour"
                                        : analytics.timeRange === "24h"
                                            ? "Last 24 Hours"
                                            : "Last 7 Days"}
                                </Badge>
                            </div>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}
