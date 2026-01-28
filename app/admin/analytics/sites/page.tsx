/**
 * Site Analytics Dashboard
 * 
 * Admin panel page for detailed site-level scraping analytics.
 * Displays success rates, block rates, challenge rates, request volume trends,
 * and top failure reasons for individual sites.
 * 
 * Features:
 * - Site selection dropdown
 * - Success rate, block rate, challenge rate metrics
 * - Request volume over time chart
 * - Top failure reasons breakdown
 * - Time range selection (1h, 24h, 7d)
 * - Real-time data refresh
 * 
 * @page /admin/analytics/sites
 * @requires Admin role
 * @validates Requirements 5.2, 5.3, 5.4
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Activity,
    RefreshCw,
    Clock,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    BarChart3,
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
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

interface SiteAnalytics {
    site: string;
    timeRange: string;
    totalRequests: number;
    successfulRequests: number;
    blockedRequests: number;
    challengedRequests: number;
    successRate: number;
    blockRate: number;
    challengeRate: number;
    avgResponseTime: number;
    requestsByHour: Array<{ hour: string; count: number }>;
    topFailureReasons: Array<{ reason: string; count: number }>;
}

interface SiteOption {
    site: string;
    tenant: string;
}

export default function SiteAnalyticsDashboard() {
    const [analytics, setAnalytics] = useState<SiteAnalytics | null>(null);
    const [sites, setSites] = useState<SiteOption[]>([]);
    const [selectedSite, setSelectedSite] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d">("24h");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Fetch available sites
    const fetchSites = useCallback(async () => {
        try {
            const res = await fetch("/api/v1/admin/scraping-metrics?timeRange=24h");
            if (res.ok) {
                const json = await res.json();
                const siteList = json.data?.sites || [];
                setSites(siteList);
                if (siteList.length > 0 && !selectedSite) {
                    setSelectedSite(siteList[0].site);
                }
            }
        } catch (error) {
            console.error("Error fetching sites:", error);
        }
    }, [selectedSite]);

    // Fetch site analytics
    const fetchSiteAnalytics = useCallback(async (showRefreshing = false) => {
        if (!selectedSite) return;

        if (showRefreshing) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const encodedSite = encodeURIComponent(selectedSite);
            const res = await fetch(
                `/api/v1/analytics/sites/${encodedSite}?timeRange=${timeRange}`
            );
            if (res.ok) {
                const json = await res.json();
                setAnalytics(json.data);
                setLastUpdated(new Date());
            } else {
                console.error("Failed to fetch site analytics");
            }
        } catch (error) {
            console.error("Error fetching site analytics:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedSite, timeRange]);

    useEffect(() => {
        fetchSites();
    }, [fetchSites]);

    useEffect(() => {
        if (selectedSite) {
            fetchSiteAnalytics();
        }
    }, [selectedSite, timeRange, fetchSiteAnalytics]);

    const handleRefresh = () => {
        fetchSiteAnalytics(true);
    };

    if (loading && !analytics) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-muted-foreground font-medium">
                        Loading site analytics...
                    </p>
                </div>
            </div>
        );
    }

    if (!selectedSite || sites.length === 0) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center">
                    <Activity className="w-12 h-12 text-muted-foreground opacity-50" />
                    <div>
                        <p className="font-semibold text-foreground mb-1">
                            No sites available
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Site analytics will appear here once scraping activity begins
                        </p>
                    </div>
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
                        Site Analytics Dashboard
                    </h1>
                    <p className="text-muted-foreground">
                        Detailed scraping performance metrics and trends for individual sites
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
                        aria-label="Refresh site analytics"
                    >
                        <RefreshCw
                            className={cn("w-4 h-4", refreshing && "animate-spin")}
                            aria-hidden="true"
                        />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Site and Time Range Selection */}
            <Card className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Filters:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">
                                Site:
                            </label>
                            <Select
                                value={selectedSite}
                                onValueChange={setSelectedSite}
                            >
                                <SelectTrigger className="w-[240px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {sites.map((site) => (
                                        <SelectItem key={site.site} value={site.site}>
                                            {site.site}
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
                    {/* Summary Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                            <div className="mt-2 text-xs text-muted-foreground">
                                {analytics.successfulRequests.toLocaleString()} successful,{" "}
                                {analytics.blockedRequests.toLocaleString()} blocked
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
                                            : analytics.successRate >= 60
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
                                                : analytics.successRate >= 60
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
                                    Block Rate
                                </p>
                                <TrendingDown className="w-4 h-4 text-red-500" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span
                                    className={cn(
                                        "text-2xl font-bold",
                                        analytics.blockRate <= 10
                                            ? "text-emerald-600 dark:text-emerald-500"
                                            : analytics.blockRate <= 30
                                                ? "text-amber-600 dark:text-amber-500"
                                                : "text-red-600 dark:text-red-500"
                                    )}
                                >
                                    {analytics.blockRate.toFixed(1)}%
                                </span>
                            </div>
                            <div className="mt-2">
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full transition-all",
                                            analytics.blockRate <= 10
                                                ? "bg-emerald-500"
                                                : analytics.blockRate <= 30
                                                    ? "bg-amber-500"
                                                    : "bg-red-500"
                                        )}
                                        style={{ width: `${analytics.blockRate}%` }}
                                    />
                                </div>
                            </div>
                        </Card>

                        <Card className="p-5">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Challenge Rate
                                </p>
                                <AlertCircle className="w-4 h-4 text-amber-500" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-foreground">
                                    {analytics.challengeRate.toFixed(1)}%
                                </span>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                                {analytics.challengedRequests.toLocaleString()} challenges detected
                            </div>
                        </Card>
                    </div>

                    {/* Request Volume Over Time Chart */}
                    <Card>
                        <div className="border-b bg-muted/50 px-6 py-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Request Volume Over Time
                            </h3>
                        </div>
                        <div className="p-6">
                            {analytics.requestsByHour && analytics.requestsByHour.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={analytics.requestsByHour}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="hour"
                                            tick={{ fontSize: 11 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={80}
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
                                        <Line
                                            type="monotone"
                                            dataKey="count"
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            dot={{ fill: "#3b82f6", r: 4 }}
                                            name="Requests"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                    <div className="text-center">
                                        <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No request volume data available</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Top Failure Reasons */}
                    <Card>
                        <div className="border-b bg-muted/50 px-6 py-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                                <XCircle className="w-4 h-4" />
                                Top Failure Reasons
                            </h3>
                        </div>
                        <div className="p-6">
                            {analytics.topFailureReasons && analytics.topFailureReasons.length > 0 ? (
                                <div className="space-y-4">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart
                                            data={analytics.topFailureReasons}
                                            layout="vertical"
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" tick={{ fontSize: 12 }} />
                                            <YAxis
                                                dataKey="reason"
                                                type="category"
                                                width={150}
                                                tick={{ fontSize: 11 }}
                                            />
                                            <Tooltip />
                                            <Bar
                                                dataKey="count"
                                                fill="#ef4444"
                                                name="Failure Count"
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>

                                    <div className="space-y-2">
                                        {analytics.topFailureReasons.map((failure, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Badge variant="destructive" className="text-xs">
                                                        #{index + 1}
                                                    </Badge>
                                                    <span className="text-sm font-medium">
                                                        {failure.reason}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-mono text-muted-foreground">
                                                        {failure.count.toLocaleString()} failures
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        (
                                                        {(
                                                            (failure.count / analytics.totalRequests) *
                                                            100
                                                        ).toFixed(1)}
                                                        %)
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                                    <div className="text-center">
                                        <XCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No failure data available</p>
                                        <p className="text-xs mt-1">
                                            All requests completed successfully
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Additional Metrics */}
                    <Card className="p-5">
                        <h3 className="font-semibold text-sm uppercase tracking-wider mb-4">
                            Additional Metrics
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <span className="text-sm text-muted-foreground">
                                    Average Response Time
                                </span>
                                <span
                                    className={cn(
                                        "text-lg font-bold font-mono",
                                        analytics.avgResponseTime < 1000
                                            ? "text-emerald-600 dark:text-emerald-500"
                                            : analytics.avgResponseTime < 3000
                                                ? "text-amber-600 dark:text-amber-500"
                                                : "text-red-600 dark:text-red-500"
                                    )}
                                >
                                    {analytics.avgResponseTime}ms
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
