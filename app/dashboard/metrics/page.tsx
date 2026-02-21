/**
 * Tenant Metrics Dashboard
 * 
 * Tenant panel page for monitoring scraping performance for configured sites.
 * Displays tenant-specific metrics, site health, and actionable recommendations.
 * 
 * Features:
 * - Overview cards (success rate, block rate, total requests)
 * - Per-site health status cards
 * - Challenge detection summary
 * - Actionable recommendations for issues
 * - Time range filtering (24h, 7d, 30d)
 * - Status legend
 * 
 * @page /dashboard/metrics
 * @requires Tenant authentication
 * @validates Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
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
    CheckCircle2,
    Shield,
    Zap,
    AlertTriangle,
    Info,
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

interface TenantSiteMetrics {
    domain: string;
    successRate: number;
    blockRate: number;
    lastSync: Date | null;
    status: 'healthy' | 'degraded' | 'critical';
    challenges: {
        detected: number;
        solved: number;
    };
}

interface TenantMetrics {
    overallSuccessRate: number;
    overallBlockRate: number;
    totalRequests: number;
    avgResponseTime: number;
    sites: TenantSiteMetrics[];
}

interface TenantMetricsResponse {
    success: boolean;
    data: TenantMetrics & {
        timeRange: string;
    };
}

interface Recommendation {
    type: 'error' | 'warning' | 'info';
    site: string;
    message: string;
    action: string;
}

export default function TenantMetricsDashboard() {
    const [data, setData] = useState<TenantMetricsResponse["data"] | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const AUTO_REFRESH_MS = Number.parseInt(
        process.env.NEXT_PUBLIC_TENANT_METRICS_POLL_MS || "30000",
        10,
    );

    const fetchTenantMetrics = useCallback(async (mode: "initial" | "manual" | "auto" = "initial") => {
        if (mode === "manual") {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const res = await fetch(
                `/api/v1/tenant/scraping-metrics?timeRange=${timeRange}&_ts=${Date.now()}`,
                {
                    cache: "no-store",
                    headers: {
                        "Cache-Control": "no-cache",
                        Pragma: "no-cache",
                    },
                }
            );
            if (res.ok) {
                const json: TenantMetricsResponse = await res.json();
                setData(json.data);
                setLastUpdated(new Date());
            } else {
                console.error("Failed to fetch tenant metrics data");
            }
        } catch (error) {
            console.error("Error fetching tenant metrics:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [timeRange]);

    useEffect(() => {
        fetchTenantMetrics("initial");
    }, [fetchTenantMetrics]);

    const handleRefresh = () => {
        fetchTenantMetrics("manual");
    };

    // Auto-refresh to keep metrics dynamic (polling + refresh-on-focus)
    useEffect(() => {
        const intervalMs = Number.isFinite(AUTO_REFRESH_MS) ? Math.max(5000, AUTO_REFRESH_MS) : 30000;
        const interval = window.setInterval(() => {
            if (document.visibilityState !== "visible") return;
            // Avoid overlapping refresh states; let manual refresh take priority.
            if (refreshing) return;
            fetchTenantMetrics("auto");
        }, intervalMs);

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                fetchTenantMetrics("auto");
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [AUTO_REFRESH_MS, fetchTenantMetrics, refreshing]);

    // Generate recommendations based on metrics
    const getRecommendations = (): Recommendation[] => {
        if (!data) return [];

        const recommendations: Recommendation[] = [];

        data.sites.forEach(site => {
            if (site.status === 'critical') {
                if (site.blockRate > 50) {
                    recommendations.push({
                        type: 'error',
                        site: site.domain,
                        message: `Very high block rate (${site.blockRate.toFixed(1)}%)`,
                        action: 'Consider increasing delays or adjusting scraping patterns'
                    });
                }
                if (site.successRate < 50) {
                    recommendations.push({
                        type: 'error',
                        site: site.domain,
                        message: `Low success rate (${site.successRate.toFixed(1)}%)`,
                        action: 'Review site configuration and proxy health'
                    });
                }
            } else if (site.status === 'degraded') {
                if (site.blockRate > 20) {
                    recommendations.push({
                        type: 'warning',
                        site: site.domain,
                        message: `Elevated block rate (${site.blockRate.toFixed(1)}%)`,
                        action: 'Consider adjusting request delays'
                    });
                }
            }

            // Challenge-related recommendations
            if (site.challenges.detected > 0) {
                const solveRate = (site.challenges.solved / site.challenges.detected) * 100;
                if (solveRate < 70) {
                    recommendations.push({
                        type: 'warning',
                        site: site.domain,
                        message: `Low challenge solve rate (${solveRate.toFixed(1)}%)`,
                        action: 'Challenges may be affecting scraping success'
                    });
                }
            }
        });

        // Add info recommendations for healthy sites
        if (recommendations.length === 0 && data.sites.length > 0) {
            recommendations.push({
                type: 'info',
                site: 'All sites',
                message: 'All sites are operating normally',
                action: 'Continue monitoring for any changes'
            });
        }

        return recommendations;
    };

    const recommendations = getRecommendations();
    const hasRequests = (data?.totalRequests || 0) > 0;

    // Calculate challenge statistics
    const totalChallenges = data?.sites.reduce((sum, site) => sum + site.challenges.detected, 0) || 0;
    const solvedChallenges = data?.sites.reduce((sum, site) => sum + site.challenges.solved, 0) || 0;
    const challengeSolveRate = totalChallenges > 0 ? (solvedChallenges / totalChallenges) * 100 : 0;

    if (loading && !data) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-muted-foreground font-medium">
                        Loading your metrics...
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
                        Scraping Metrics
                    </h1>
                    <p className="text-muted-foreground">
                        Monitor your competitor tracking performance and site health
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
                        aria-label="Refresh tenant metrics"
                    >
                        <RefreshCw
                            className={cn("w-4 h-4", refreshing && "animate-spin")}
                            aria-hidden="true"
                        />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Overview Cards - Responsive: 1 col mobile, 2 col tablet, 4 col desktop */}
            {data && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
                                    !hasRequests
                                        ? "text-muted-foreground"
                                        : data.overallSuccessRate >= 80
                                        ? "text-emerald-600 dark:text-emerald-500"
                                        : data.overallSuccessRate >= 60
                                            ? "text-amber-600 dark:text-amber-500"
                                            : "text-red-600 dark:text-red-500"
                                )}
                            >
                                {hasRequests ? `${data.overallSuccessRate.toFixed(1)}%` : "N/A"}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {!hasRequests
                                ? "No scrape attempts in selected range"
                                : data.overallSuccessRate >= 80
                                    ? "Excellent"
                                    : data.overallSuccessRate >= 60
                                        ? "Good"
                                        : "Needs attention"}
                        </p>
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
                                    !hasRequests
                                        ? "text-muted-foreground"
                                        : data.overallBlockRate <= 10
                                        ? "text-emerald-600 dark:text-emerald-500"
                                        : data.overallBlockRate <= 30
                                            ? "text-amber-600 dark:text-amber-500"
                                            : "text-red-600 dark:text-red-500"
                                )}
                            >
                                {hasRequests ? `${data.overallBlockRate.toFixed(1)}%` : "N/A"}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {!hasRequests
                                ? "No scrape attempts in selected range"
                                : data.overallBlockRate <= 10
                                    ? "Excellent"
                                    : data.overallBlockRate <= 30
                                        ? "Acceptable"
                                        : "High"}
                        </p>
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
                                {data.totalRequests.toLocaleString()}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Last {timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : '30 days'}
                        </p>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Avg Response Time
                            </p>
                            <Zap className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span
                                className={cn(
                                    "text-2xl font-bold",
                                    data.avgResponseTime < 1000
                                        ? "text-emerald-600 dark:text-emerald-500"
                                        : data.avgResponseTime < 3000
                                            ? "text-amber-600 dark:text-amber-500"
                                            : "text-red-600 dark:text-red-500"
                                )}
                            >
                                {data.avgResponseTime}ms
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {data.avgResponseTime < 1000 ? "Fast" : data.avgResponseTime < 3000 ? "Normal" : "Slow"}
                        </p>
                    </Card>
                </div>
            )}

            {/* Challenge Detection Summary */}
            {data && totalChallenges > 0 && (
                <Card>
                    <div className="border-b bg-muted/50 px-6 py-4">
                        <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Challenge Detection Summary
                        </h3>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                    Challenges Detected
                                </p>
                                <p className="text-2xl font-bold">{totalChallenges}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                    Challenges Solved
                                </p>
                                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
                                    {solvedChallenges}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                    Solve Rate
                                </p>
                                <p
                                    className={cn(
                                        "text-2xl font-bold",
                                        challengeSolveRate >= 80
                                            ? "text-emerald-600 dark:text-emerald-500"
                                            : challengeSolveRate >= 60
                                                ? "text-amber-600 dark:text-amber-500"
                                                : "text-red-600 dark:text-red-500"
                                    )}
                                >
                                    {challengeSolveRate.toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Recommendations Panel */}
            {recommendations.length > 0 && (
                <Card>
                    <div className="border-b bg-muted/50 px-6 py-4">
                        <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Recommendations
                        </h3>
                    </div>
                    <div className="p-6 space-y-3">
                        {recommendations.map((rec, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "flex gap-3 p-4 rounded-lg border",
                                    rec.type === 'error' && "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900",
                                    rec.type === 'warning' && "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900",
                                    rec.type === 'info' && "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
                                )}
                            >
                                <div className="flex-shrink-0 mt-0.5">
                                    {rec.type === 'error' && (
                                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500" />
                                    )}
                                    {rec.type === 'warning' && (
                                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                                    )}
                                    {rec.type === 'info' && (
                                        <Info className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <p className="font-medium text-sm">
                                            {rec.site}
                                        </p>
                                        <Badge
                                            variant={
                                                rec.type === 'error' ? 'destructive' :
                                                    rec.type === 'warning' ? 'warning' : 'default'
                                            }
                                            className="text-xs"
                                        >
                                            {rec.type}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-1">
                                        {rec.message}
                                    </p>
                                    <p className="text-xs text-muted-foreground italic">
                                        → {rec.action}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Site Health Status Cards */}
            {data && data.sites.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Site Health Status</h2>
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                <span className="text-muted-foreground">Healthy</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                <span className="text-muted-foreground">Degraded</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <span className="text-muted-foreground">Critical</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.sites.map((site, index) => (
                            <Card key={index} className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono block truncate">
                                            {site.domain}
                                        </code>
                                    </div>
                                    <Badge
                                        variant={
                                            site.status === 'healthy' ? 'success' :
                                                site.status === 'degraded' ? 'warning' : 'destructive'
                                        }
                                        className="ml-2 flex-shrink-0"
                                        role="status"
                                        aria-label={`Site status: ${site.status}`}
                                    >
                                        {site.status === 'healthy' && <CheckCircle2 className="w-3 h-3 mr-1" aria-hidden="true" />}
                                        {site.status === 'degraded' && <AlertTriangle className="w-3 h-3 mr-1" aria-hidden="true" />}
                                        {site.status === 'critical' && <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />}
                                        {site.status}
                                        <span className="sr-only">
                                            {site.status === 'healthy' && ' - Operating normally'}
                                            {site.status === 'degraded' && ' - Performance issues detected'}
                                            {site.status === 'critical' && ' - Immediate attention required'}
                                        </span>
                                    </Badge>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="text-muted-foreground">Success Rate</span>
                                            <span className="font-mono font-medium">{site.successRate.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
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
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="text-muted-foreground">Block Rate</span>
                                            <span className="font-mono font-medium">{site.blockRate.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
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
                                    </div>

                                    {site.challenges.detected > 0 && (
                                        <div className="pt-2 border-t border-border">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Challenges</span>
                                                <span className="font-mono">
                                                    {site.challenges.solved}/{site.challenges.detected}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2 border-t border-border">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">Last Sync</span>
                                            <span className="text-muted-foreground">
                                                {site.lastSync
                                                    ? new Date(site.lastSync).toLocaleString()
                                                    : "Never"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {data && data.sites.length === 0 && (
                <Card className="p-12">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <Activity className="w-12 h-12 text-muted-foreground opacity-50" />
                        <div>
                            <h3 className="font-semibold text-lg mb-1">No Sites Configured</h3>
                            <p className="text-sm text-muted-foreground">
                                Add competitor sites to start tracking their prices and products
                            </p>
                        </div>
                        <Button className="mt-2" asChild>
                            <a href="/dashboard/competitors">Add Competitors</a>
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
}
