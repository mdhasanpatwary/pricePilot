/**
 * Scraping Metrics Dashboard
 * 
 * Admin panel page for comprehensive scraping performance monitoring.
 * Displays platform-wide and per-site metrics with trend analysis.
 * 
 * Features:
 * - Platform-wide summary (total requests, success rate, block rate)
 * - Per-site metrics with status indicators
 * - Success rate and block rate trend charts
 * - Time range filtering (24h, 7d, 30d)
 * - Data export (CSV/JSON)
 * - Drill-down to site details
 * 
 * @page /admin/scraping-metrics
 * @requires Admin role
 * @validates Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */
"use client";

import { useState, useEffect } from "react";
import {
    Activity,
    RefreshCw,
    Clock,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Download,
    ExternalLink,
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
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

interface ScrapingMetrics {
    site: string;
    tenant: string;
    totalRequests: number;
    successfulRequests: number;
    blockedRequests: number;
    successRate: number;
    blockRate: number;
    avgResponseTime: number;
    lastScrapeAt: Date | null;
}

interface MetricsSummary {
    totalRequests: number;
    avgSuccessRate: number;
    avgBlockRate: number;
    activeSites: number;
}

interface ScrapingMetricsResponse {
    success: boolean;
    data: {
        summary: MetricsSummary;
        sites: ScrapingMetrics[];
        timeRange: string;
    };
}

const CHART_COLORS = {
    successRate: "#10b981", // emerald-500
    blockRate: "#ef4444", // red-500
};

export default function ScrapingMetricsDashboard() {
    const [data, setData] = useState<ScrapingMetricsResponse["data"] | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchScrapingMetrics = async (showRefreshing = false) => {
        if (showRefreshing) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const res = await fetch(
                `/api/v1/admin/scraping-metrics?timeRange=${timeRange}`
            );
            if (res.ok) {
                const json: ScrapingMetricsResponse = await res.json();
                setData(json.data);
                setLastUpdated(new Date());
            } else {
                console.error("Failed to fetch scraping metrics data");
            }
        } catch (error) {
            console.error("Error fetching scraping metrics:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchScrapingMetrics();
    }, [timeRange]);

    const handleRefresh = () => {
        fetchScrapingMetrics(true);
    };

    const handleExport = (format: "csv" | "json") => {
        if (!data) return;

        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `scraping-metrics-${timestamp}.${format}`;

        if (format === "csv") {
            // Generate CSV
            const headers = [
                "Site",
                "Tenant",
                "Total Requests",
                "Successful Requests",
                "Blocked Requests",
                "Success Rate (%)",
                "Block Rate (%)",
                "Avg Response Time (ms)",
                "Last Scrape"
            ];

            const rows = data.sites.map(site => [
                site.site,
                site.tenant,
                site.totalRequests,
                site.successfulRequests,
                site.blockedRequests,
                site.successRate,
                site.blockRate,
                site.avgResponseTime,
                site.lastScrapeAt ? new Date(site.lastScrapeAt).toISOString() : "N/A"
            ]);

            const csvContent = [
                headers.join(","),
                ...rows.map(row => row.join(","))
            ].join("\n");

            const blob = new Blob([csvContent], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
        } else {
            // Generate JSON
            const jsonContent = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonContent], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
        }

        // Log export action
        console.log(`[Export] Scraping metrics exported as ${format.toUpperCase()} - ${filename}`);
    };

    if (loading && !data) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-muted-foreground font-medium">
                        Loading scraping metrics...
                    </p>
                </div>
            </div>
        );
    }

    const summary = data?.summary;
    const sites = data?.sites || [];

    // Prepare chart data for success and block rates
    const chartData = sites.slice(0, 15).map((site) => ({
        site: site.site.length > 20 ? site.site.substring(0, 20) + "..." : site.site,
        successRate: site.successRate,
        blockRate: site.blockRate,
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Scraping Metrics Dashboard
                    </h1>
                    <p className="text-muted-foreground">
                        Monitor scraping success rates, block rates, and performance metrics
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
                        aria-label="Refresh scraping metrics"
                    >
                        <RefreshCw
                            className={cn("w-4 h-4", refreshing && "animate-spin")}
                            aria-hidden="true"
                        />
                        Refresh
                    </Button>
                    <Select onValueChange={(value) => handleExport(value as "csv" | "json")} aria-label="Export data format">
                        <SelectTrigger className="w-[120px]">
                            <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                            Export
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="csv">Export CSV</SelectItem>
                            <SelectItem value="json">Export JSON</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Summary Stats Cards - Responsive: 1 col mobile, 2 col tablet, 4 col desktop */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Total Requests
                            </p>
                            <Activity className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-foreground">
                                {summary.totalRequests.toLocaleString()}
                            </span>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Avg Success Rate
                            </p>
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span
                                className={cn(
                                    "text-2xl font-bold",
                                    summary.avgSuccessRate >= 80
                                        ? "text-emerald-600 dark:text-emerald-500"
                                        : summary.avgSuccessRate >= 60
                                            ? "text-amber-600 dark:text-amber-500"
                                            : "text-red-600 dark:text-red-500"
                                )}
                            >
                                {summary.avgSuccessRate.toFixed(1)}%
                            </span>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Avg Block Rate
                            </p>
                            <TrendingDown className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span
                                className={cn(
                                    "text-2xl font-bold",
                                    summary.avgBlockRate <= 10
                                        ? "text-emerald-600 dark:text-emerald-500"
                                        : summary.avgBlockRate <= 30
                                            ? "text-amber-600 dark:text-amber-500"
                                            : "text-red-600 dark:text-red-500"
                                )}
                            >
                                {summary.avgBlockRate.toFixed(1)}%
                            </span>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Active Sites
                            </p>
                            <Activity className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-foreground">
                                {summary.activeSites}
                            </span>
                        </div>
                    </Card>
                </div>
            )}

            {/* Charts Row - Responsive: 1 col mobile/tablet, 2 col desktop */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Success Rate Trend Chart */}
                <Card>
                    <div className="border-b bg-muted/50 px-6 py-4">
                        <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Success Rate by Site (Top 15)
                        </h3>
                    </div>
                    <div className="p-6">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300} className="text-xs sm:text-sm">
                                <LineChart data={chartData} aria-label="Success rate trend chart">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="site"
                                        angle={-45}
                                        textAnchor="end"
                                        height={100}
                                        tick={{ fontSize: 11 }}
                                        aria-label="Site names"
                                    />
                                    <YAxis
                                        domain={[0, 100]}
                                        tick={{ fontSize: 12 }}
                                        label={{
                                            value: "Success Rate (%)",
                                            angle: -90,
                                            position: "insideLeft",
                                        }}
                                        aria-label="Success rate percentage"
                                    />
                                    <Tooltip />
                                    <Line
                                        type="monotone"
                                        dataKey="successRate"
                                        stroke={CHART_COLORS.successRate}
                                        strokeWidth={2}
                                        dot={{ fill: CHART_COLORS.successRate, r: 4 }}
                                        name="Success Rate"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                <div className="text-center">
                                    <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No success rate data available</p>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Block Rate Trend Chart */}
                <Card>
                    <div className="border-b bg-muted/50 px-6 py-4">
                        <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                            <TrendingDown className="w-4 h-4" />
                            Block Rate by Site (Top 15)
                        </h3>
                    </div>
                    <div className="p-6">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="site"
                                        angle={-45}
                                        textAnchor="end"
                                        height={100}
                                        tick={{ fontSize: 11 }}
                                    />
                                    <YAxis
                                        domain={[0, 100]}
                                        tick={{ fontSize: 12 }}
                                        label={{
                                            value: "Block Rate (%)",
                                            angle: -90,
                                            position: "insideLeft",
                                        }}
                                    />
                                    <Tooltip />
                                    <Line
                                        type="monotone"
                                        dataKey="blockRate"
                                        stroke={CHART_COLORS.blockRate}
                                        strokeWidth={2}
                                        dot={{ fill: CHART_COLORS.blockRate, r: 4 }}
                                        name="Block Rate"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                <div className="text-center">
                                    <TrendingDown className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No block rate data available</p>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Site Metrics Table */}
            <Card>
                <div className="border-b bg-muted/50 px-6 py-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Site Metrics and Status
                    </h3>
                </div>

                <div className="overflow-x-auto -mx-6 sm:mx-0">
                    <table className="w-full text-sm min-w-[1100px]">
                        <thead className="bg-muted/30 border-b border-border">
                            <tr>
                                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                                    Site
                                </th>
                                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                                    Tenant
                                </th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                    Total Requests
                                </th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                    Successful
                                </th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                    Blocked
                                </th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                    Success Rate
                                </th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                    Block Rate
                                </th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                    Avg Response
                                </th>
                                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                                    Last Scrape
                                </th>
                                <th className="px-6 py-3 text-center font-medium text-muted-foreground">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card">
                            {sites.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={11}
                                        className="px-6 py-12 text-center text-muted-foreground"
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <Activity className="w-10 h-10 opacity-50" />
                                            <p className="font-medium">No scraping metrics available</p>
                                            <p className="text-xs">
                                                Metrics will appear here once scraping activity begins
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                sites.map((site, index) => {
                                    const isHighBlockRate = site.blockRate > 30;
                                    const isLowSuccessRate = site.successRate < 60;
                                    const hasIssue = isHighBlockRate || isLowSuccessRate;

                                    return (
                                        <tr
                                            key={index}
                                            className={cn(
                                                "hover:bg-muted/50 transition-colors",
                                                hasIssue && "bg-red-50/30 dark:bg-red-950/10"
                                            )}
                                        >
                                            <td className="px-6 py-4">
                                                {hasIssue ? (
                                                    <Badge
                                                        variant="destructive"
                                                        className="flex items-center gap-1 w-fit"
                                                    >
                                                        <AlertCircle className="w-3 h-3" />
                                                        Critical
                                                    </Badge>
                                                ) : site.successRate >= 80 ? (
                                                    <Badge
                                                        variant="success"
                                                        className="flex items-center gap-1 w-fit"
                                                    >
                                                        <TrendingUp className="w-3 h-3" />
                                                        Healthy
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="warning"
                                                        className="flex items-center gap-1 w-fit"
                                                    >
                                                        <AlertCircle className="w-3 h-3" />
                                                        Degraded
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                                    {site.site}
                                                </code>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs">{site.tenant}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono">
                                                {site.totalRequests.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-emerald-600 dark:text-emerald-500">
                                                {site.successfulRequests.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-red-600 dark:text-red-500">
                                                {site.blockedRequests.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                "h-full transition-all",
                                                                site.successRate >= 80
                                                                    ? "bg-emerald-500"
                                                                    : site.successRate >= 60
                                                                        ? "bg-amber-500"
                                                                        : "bg-red-500"
                                                            )}
                                                            style={{ width: `${site.successRate}%` }}
                                                        />
                                                    </div>
                                                    <span className="font-mono text-xs w-12 text-right">
                                                        {site.successRate.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                "h-full transition-all",
                                                                site.blockRate <= 10
                                                                    ? "bg-emerald-500"
                                                                    : site.blockRate <= 30
                                                                        ? "bg-amber-500"
                                                                        : "bg-red-500"
                                                            )}
                                                            style={{ width: `${site.blockRate}%` }}
                                                        />
                                                    </div>
                                                    <span className="font-mono text-xs w-12 text-right">
                                                        {site.blockRate.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono">
                                                <span
                                                    className={cn(
                                                        site.avgResponseTime < 1000
                                                            ? "text-emerald-600 dark:text-emerald-500"
                                                            : site.avgResponseTime < 3000
                                                                ? "text-amber-600 dark:text-amber-500"
                                                                : "text-red-600 dark:text-red-500"
                                                    )}
                                                >
                                                    {site.avgResponseTime}ms
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-muted-foreground">
                                                {site.lastScrapeAt
                                                    ? new Date(site.lastScrapeAt).toLocaleString()
                                                    : "N/A"}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        // Future: drill-down to site details
                                                        console.log("View details for:", site.site);
                                                    }}
                                                    title="View site details"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
