/**
 * Challenge Detection Dashboard
 * 
 * Admin panel page for monitoring anti-bot challenge detection and solve rates.
 * Displays challenge statistics, solve rates, and trends across all sites.
 * 
 * Features:
 * - Summary statistics (total challenges, average solve rate, most common type)
 * - Per-site challenge breakdown
 * - Challenge type distribution (pie chart)
 * - Solve rate trends (line chart)
 * - Warning indicators for low solve rates
 * - Time range filtering (24h, 7d, 30d)
 * 
 * @page /admin/challenge-stats
 * @requires Admin role
 * @validates Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */
"use client";

import { useState, useEffect } from "react";
import {
    Shield,
    RefreshCw,
    Clock,
    TrendingUp,
    AlertTriangle,
    PieChart as PieChartIcon,
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
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";

interface ChallengeTypeStats {
    type: string;
    count: number;
    solveRate: number;
}

interface ChallengeStats {
    site: string;
    totalChallenges: number;
    solvedChallenges: number;
    failedChallenges: number;
    solveRate: number;
    challengeTypes: ChallengeTypeStats[];
}

interface ChallengeSummary {
    totalChallenges: number;
    avgSolveRate: number;
    mostCommonType: string;
    sitesWithIssues: number;
}

interface ChallengeStatsResponse {
    success: boolean;
    data: {
        summary: ChallengeSummary;
        sites: ChallengeStats[];
        timeRange: string;
    };
}

const CHART_COLORS = [
    "#10b981", // emerald-500
    "#3b82f6", // blue-500
    "#f59e0b", // amber-500
    "#ef4444", // red-500
    "#8b5cf6", // violet-500
    "#ec4899", // pink-500
];

export default function ChallengeStatsDashboard() {
    const [data, setData] = useState<ChallengeStatsResponse["data"] | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchChallengeStats = async (showRefreshing = false) => {
        if (showRefreshing) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const res = await fetch(
                `/api/v1/admin/challenge-stats?timeRange=${timeRange}`
            );
            if (res.ok) {
                const json: ChallengeStatsResponse = await res.json();
                setData(json.data);
                setLastUpdated(new Date());
            } else {
                console.error("Failed to fetch challenge stats data");
            }
        } catch (error) {
            console.error("Error fetching challenge stats:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchChallengeStats();
    }, [timeRange]);

    const handleRefresh = () => {
        fetchChallengeStats(true);
    };

    if (loading && !data) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-muted-foreground font-medium">
                        Loading challenge statistics...
                    </p>
                </div>
            </div>
        );
    }

    const summary = data?.summary;
    const sites = data?.sites || [];

    // Prepare pie chart data for challenge types
    const challengeTypeData = sites.reduce((acc, site) => {
        site.challengeTypes.forEach((ct) => {
            const existing = acc.find((item) => item.name === ct.type);
            if (existing) {
                existing.value += ct.count;
            } else {
                acc.push({ name: ct.type, value: ct.count });
            }
        });
        return acc;
    }, [] as { name: string; value: number }[]);

    // Prepare line chart data for solve rates
    const solveRateTrendData = sites.slice(0, 10).map((site) => ({
        site: site.site.length > 20 ? site.site.substring(0, 20) + "..." : site.site,
        solveRate: site.solveRate,
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Challenge Detection Statistics
                    </h1>
                    <p className="text-muted-foreground">
                        Monitor challenge detection rates, solve rates, and challenge types
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
                        aria-label="Refresh challenge statistics"
                    >
                        <RefreshCw
                            className={cn("w-4 h-4", refreshing && "animate-spin")}
                            aria-hidden="true"
                        />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Summary Stats Cards - Responsive: 1 col mobile, 2 col tablet, 4 col desktop */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Total Challenges
                            </p>
                            <Shield className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-foreground">
                                {summary.totalChallenges.toLocaleString()}
                            </span>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Avg Solve Rate
                            </p>
                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span
                                className={cn(
                                    "text-2xl font-bold",
                                    summary.avgSolveRate >= 80
                                        ? "text-emerald-600 dark:text-emerald-500"
                                        : summary.avgSolveRate >= 60
                                            ? "text-amber-600 dark:text-amber-500"
                                            : "text-red-600 dark:text-red-500"
                                )}
                            >
                                {summary.avgSolveRate.toFixed(1)}%
                            </span>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Most Common Type
                            </p>
                            <PieChartIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold text-foreground">
                                {summary.mostCommonType}
                            </span>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Sites with Issues
                            </p>
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span
                                className={cn(
                                    "text-2xl font-bold",
                                    summary.sitesWithIssues === 0
                                        ? "text-emerald-600 dark:text-emerald-500"
                                        : "text-amber-600 dark:text-amber-500"
                                )}
                            >
                                {summary.sitesWithIssues}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                / {sites.length} sites
                            </span>
                        </div>
                    </Card>
                </div>
            )}

            {/* Charts Row - Responsive: 1 col mobile/tablet, 2 col desktop */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Challenge Type Pie Chart */}
                <Card>
                    <div className="border-b bg-muted/50 px-6 py-4">
                        <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                            <PieChartIcon className="w-4 h-4" />
                            Challenge Type Distribution
                        </h3>
                    </div>
                    <div className="p-6">
                        {challengeTypeData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300} className="text-xs sm:text-sm">
                                <PieChart>
                                    <Pie
                                        data={challengeTypeData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={(entry) => {
                                            const percent = entry.percent || 0;
                                            return `${entry.name}: ${(percent * 100).toFixed(0)}%`;
                                        }}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                        aria-label="Challenge type distribution chart"
                                    >
                                        {challengeTypeData.map((_, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                <div className="text-center">
                                    <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No challenge data available</p>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Solve Rate Trend Line Chart */}
                <Card>
                    <div className="border-b bg-muted/50 px-6 py-4">
                        <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Solve Rate by Site (Top 10)
                        </h3>
                    </div>
                    <div className="p-6">
                        {solveRateTrendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300} className="text-xs sm:text-sm">
                                <LineChart data={solveRateTrendData} aria-label="Solve rate trend chart">
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
                                            value: "Solve Rate (%)",
                                            angle: -90,
                                            position: "insideLeft",
                                        }}
                                        aria-label="Solve rate percentage"
                                    />
                                    <Tooltip />
                                    <Line
                                        type="monotone"
                                        dataKey="solveRate"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        dot={{ fill: "#10b981", r: 4 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                <div className="text-center">
                                    <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No solve rate data available</p>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Site Challenge Stats Table */}
            <Card>
                <div className="border-b bg-muted/50 px-6 py-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Challenge Statistics by Site
                    </h3>
                </div>

                <div className="overflow-x-auto -mx-6 sm:mx-0">
                    <table className="w-full text-sm min-w-[900px]">
                        <thead className="bg-muted/30 border-b border-border">
                            <tr>
                                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                                    Site
                                </th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                    Total Challenges
                                </th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                    Solved
                                </th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                    Failed
                                </th>
                                <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                    Solve Rate
                                </th>
                                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                                    Challenge Types
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card">
                            {sites.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-6 py-12 text-center text-muted-foreground"
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <Shield className="w-10 h-10 opacity-50" />
                                            <p className="font-medium">No challenge data available</p>
                                            <p className="text-xs">
                                                Challenge statistics will appear here once scraping encounters anti-bot measures
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                sites.map((site, index) => (
                                    <tr
                                        key={index}
                                        className={cn(
                                            "hover:bg-muted/50 transition-colors",
                                            site.solveRate < 70 &&
                                            "bg-amber-50/30 dark:bg-amber-950/10"
                                        )}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                                    {site.site}
                                                </code>
                                                {site.solveRate < 70 && (
                                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            {site.totalChallenges.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-emerald-600 dark:text-emerald-500">
                                            {site.solvedChallenges.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-red-600 dark:text-red-500">
                                            {site.failedChallenges.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full transition-all",
                                                            site.solveRate >= 80
                                                                ? "bg-emerald-500"
                                                                : site.solveRate >= 60
                                                                    ? "bg-amber-500"
                                                                    : "bg-red-500"
                                                        )}
                                                        style={{ width: `${site.solveRate}%` }}
                                                    />
                                                </div>
                                                <span className="font-mono text-xs w-12 text-right">
                                                    {site.solveRate.toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {site.challengeTypes.map((ct, ctIndex) => (
                                                    <Badge
                                                        key={ctIndex}
                                                        variant="outline"
                                                        className="text-xs"
                                                    >
                                                        {ct.type}: {ct.count} ({ct.solveRate.toFixed(0)}%)
                                                    </Badge>
                                                ))}
                                            </div>
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
