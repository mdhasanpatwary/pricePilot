/**
 * Proxy Health Dashboard
 * 
 * Admin panel page for monitoring proxy pool health and performance.
 * Displays real-time proxy statistics, health status, and performance metrics.
 * 
 * Features:
 * - Overview statistics (total, healthy, unhealthy proxies)
 * - Detailed proxy list with health indicators
 * - Time range filtering (24h, 7d, 30d)
 * - Manual refresh capability
 * - Success rate and response time metrics
 * 
 * @page /admin/proxy-health
 * @requires Admin role
 * @validates Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */
"use client";

import { useState, useEffect } from "react";
import {
    Server,
    CheckCircle,
    XCircle,
    RefreshCw,
    Clock,
    Activity,
    TrendingUp,
    AlertCircle,
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

interface ProxyData {
    url: string;
    type: "residential" | "datacenter" | "unknown";
    isHealthy: boolean;
    successCount: number;
    failureCount: number;
    successRate: number;
    avgResponseTime: number;
    lastChecked: string;
}

interface ProxyStats {
    totalProxies: number;
    healthyProxies: number;
    unhealthyProxies: number;
    avgSuccessRate: number;
    avgResponseTime: number;
}

interface ProxyHealthResponse {
    success: boolean;
    data: {
        stats: ProxyStats;
        proxies: ProxyData[];
        timeRange: string;
    };
}

export default function ProxyHealthDashboard() {
    const [data, setData] = useState<ProxyHealthResponse["data"] | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchProxyHealth = async (showRefreshing = false) => {
        if (showRefreshing) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const res = await fetch(
                `/api/v1/admin/proxy-health?timeRange=${timeRange}`
            );
            if (res.ok) {
                const json: ProxyHealthResponse = await res.json();
                setData(json.data);
                setLastUpdated(new Date());
            } else {
                console.error("Failed to fetch proxy health data");
            }
        } catch (error) {
            console.error("Error fetching proxy health:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchProxyHealth();
    }, [timeRange]);

    const handleRefresh = () => {
        fetchProxyHealth(true);
    };

    if (loading && !data) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-muted-foreground font-medium">
                        Loading proxy health data...
                    </p>
                </div>
            </div>
        );
    }

    const stats = data?.stats;
    const proxies = data?.proxies || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Proxy Health Monitor
                    </h1>
                    <p className="text-muted-foreground">
                        Monitor proxy pool status, health metrics, and performance data
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
                        </div>
                    )}
                    <Select
                        value={timeRange}
                        onValueChange={(value) =>
                            setTimeRange(value as "24h" | "7d" | "30d")
                        }
                        aria-label="Select time range for metrics"
                    >
                        <SelectTrigger className="w-[140px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24h">Last 24 Hours</SelectItem>
                            <SelectItem value="7d">Last 7 Days</SelectItem>
                            <SelectItem value="30d">Last 30 Days</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        variant="outline"
                        size="sm"
                        aria-label="Refresh proxy health data"
                    >
                        <RefreshCw
                            className={cn("w-4 h-4", refreshing && "animate-spin")}
                            aria-hidden="true"
                        />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Cards - Responsive: 1 col mobile, 2 col tablet, 5 col desktop */}
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Total Proxies
                            </p>
                            <Server className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-foreground">
                                {stats.totalProxies}
                            </span>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Healthy
                            </p>
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
                                {stats.healthyProxies}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {stats.totalProxies > 0
                                    ? Math.round(
                                        (stats.healthyProxies / stats.totalProxies) * 100
                                    )
                                    : 0}
                                %
                            </span>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Unhealthy
                            </p>
                            <XCircle className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-red-600 dark:text-red-500">
                                {stats.unhealthyProxies}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {stats.totalProxies > 0
                                    ? Math.round(
                                        (stats.unhealthyProxies / stats.totalProxies) * 100
                                    )
                                    : 0}
                                %
                            </span>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Avg Success Rate
                            </p>
                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-foreground">
                                {stats.avgSuccessRate.toFixed(1)}%
                            </span>
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
                            <span className="text-2xl font-bold text-foreground">
                                {stats.avgResponseTime}
                            </span>
                            <span className="text-xs text-muted-foreground">ms</span>
                        </div>
                    </Card>
                </div>
            )}

            {/* Proxy Table */}
            <Card>
                <div className="border-b bg-muted/50 px-6 py-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        Proxy Pool Details
                    </h3>
                </div>

                <div className="overflow-x-auto -mx-6 sm:mx-0">
                    <table className="w-full text-sm min-w-[800px]" role="table" aria-label="Proxy health status table">
                        <thead className="bg-muted/30 border-b border-border">
                            <tr role="row">
                                <th className="px-6 py-3 text-left font-medium text-muted-foreground" scope="col">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left font-medium text-muted-foreground" scope="col">
                                    Proxy URL
                                </th>
                                <th className="px-6 py-3 text-left font-medium text-muted-foreground" scope="col">
                                    Type
                                </th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground" scope="col">
                                    Success Count
                                </th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground" scope="col">
                                    Failure Count
                                </th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground" scope="col">
                                    Success Rate
                                </th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground" scope="col">
                                    Avg Response
                                </th>
                                <th className="px-6 py-3 text-left font-medium text-muted-foreground" scope="col">
                                    Last Checked
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card">
                            {proxies.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-6 py-12 text-center text-muted-foreground"
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <Server className="w-10 h-10 opacity-50" />
                                            <p className="font-medium">No proxies configured</p>
                                            <p className="text-xs">
                                                Add proxies to start monitoring their health
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                proxies.map((proxy, index) => (
                                    <tr
                                        key={index}
                                        role="row"
                                        tabIndex={0}
                                        className={cn(
                                            "hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset",
                                            !proxy.isHealthy && "bg-red-50/30 dark:bg-red-950/10"
                                        )}
                                        aria-label={`Proxy ${proxy.url}, status: ${proxy.isHealthy ? 'healthy' : 'unhealthy'}, success rate: ${proxy.successRate.toFixed(1)}%`}
                                    >
                                        <td className="px-6 py-4">
                                            {proxy.isHealthy ? (
                                                <Badge
                                                    variant="success"
                                                    className="flex items-center gap-1 w-fit"
                                                    role="status"
                                                    aria-label="Proxy status: healthy"
                                                >
                                                    <CheckCircle className="w-3 h-3" aria-hidden="true" />
                                                    Healthy
                                                    <span className="sr-only">This proxy is operating normally</span>
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="destructive"
                                                    className="flex items-center gap-1 w-fit"
                                                    role="status"
                                                    aria-label="Proxy status: critical"
                                                >
                                                    <AlertCircle className="w-3 h-3" aria-hidden="true" />
                                                    Critical
                                                    <span className="sr-only">This proxy is experiencing issues</span>
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                                {proxy.url}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className="capitalize">
                                                {proxy.type}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-emerald-600 dark:text-emerald-500">
                                            {proxy.successCount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-red-600 dark:text-red-500">
                                            {proxy.failureCount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={proxy.successRate} aria-valuemin={0} aria-valuemax={100} aria-label={`Success rate: ${proxy.successRate.toFixed(1)}%`}>
                                                    <div
                                                        className={cn(
                                                            "h-full transition-all",
                                                            proxy.successRate >= 80
                                                                ? "bg-emerald-500"
                                                                : proxy.successRate >= 50
                                                                    ? "bg-amber-500"
                                                                    : "bg-red-500"
                                                        )}
                                                        style={{ width: `${proxy.successRate}%` }}
                                                    />
                                                </div>
                                                <span className="font-mono text-xs w-12 text-right">
                                                    {proxy.successRate.toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            <span
                                                className={cn(
                                                    proxy.avgResponseTime < 1000
                                                        ? "text-emerald-600 dark:text-emerald-500"
                                                        : proxy.avgResponseTime < 3000
                                                            ? "text-amber-600 dark:text-amber-500"
                                                            : "text-red-600 dark:text-red-500"
                                                )}
                                            >
                                                {proxy.avgResponseTime}ms
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-muted-foreground">
                                            {new Date(proxy.lastChecked).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
