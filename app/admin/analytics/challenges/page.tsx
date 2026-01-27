/**
 * Challenge Analytics Dashboard
 * 
 * Admin panel page for detailed challenge detection and solving analytics.
 * Displays solve rates per challenge type, average solve times,
 * and challenge distribution across sites.
 * 
 * Features:
 * - Overall solve rate and challenge count metrics
 * - Solve rate per challenge type breakdown
 * - Average solve time per challenge type
 * - Challenges by site distribution
 * - Time range selection (1h, 24h, 7d)
 * - Visual charts and tables
 * 
 * @page /admin/analytics/challenges
 * @requires Admin role
 * @validates Requirements 5.6, 10.3
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
    BarChart3,
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
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

interface ChallengeAnalytics {
    timeRange: string;
    totalChallenges: number;
    solvedChallenges: number;
    failedChallenges: number;
    solveRate: number;
    avgSolveTime: number;
    challengesByType: Array<{
        type: string;
        count: number;
        solveRate: number;
        avgSolveTime: number;
    }>;
    challengesBySite: Array<{
        site: string;
        count: number;
        solveRate: number;
    }>;
}

const CHART_COLORS = [
    "#10b981", // emerald-500
    "#3b82f6", // blue-500
    "#f59e0b", // amber-500
    "#ef4444", // red-500
    "#8b5cf6", // violet-500
    "#ec4899", // pink-500
    "#06b6d4", // cyan-500
    "#f97316", // orange-500
];

export default function ChallengeAnalyticsDashboard() {
    const [analytics, setAnalytics] = useState<ChallengeAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d">("24h");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Fetch challenge analytics
    const fetchChallengeAnalytics = async (showRefreshing = false) => {
        if (showRefreshing) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const res = await fetch(
                `/api/v1/analytics/challenges?timeRange=${timeRange}`
            );
            if (res.ok) {
                const json = await res.json();
                setAnalytics(json.data);
                setLastUpdated(new Date());
            } else {
                console.error("Failed to fetch challenge analytics");
            }
        } catch (error) {
            console.error("Error fetching challenge analytics:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchChallengeAnalytics();
    }, [timeRange]);

    const handleRefresh = () => {
        fetchChallengeAnalytics(true);
    };

    if (loading && !analytics) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-muted-foreground font-medium">
                        Loading challenge analytics...
                    </p>
                </div>
            </div>
        );
    }

    // Prepare pie chart data for challenge types
    const challengeTypeData =
        analytics?.challengesByType.map((ct) => ({
            name: ct.type,
            value: ct.count,
        })) || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Challenge Analytics Dashboard
                    </h1>
                    <p className="text-muted-foreground">
                        Detailed challenge detection and solving metrics across all sites
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
                    <Button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        variant="outline"
                        size="sm"
                        aria-label="Refresh challenge analytics"
                    >
                        <RefreshCw
                            className={cn("w-4 h-4", refreshing && "animate-spin")}
                            aria-hidden="true"
                        />
                        Refresh
                    </Button>
                </div>
            </div>

            {analytics && analytics.totalChallenges > 0 ? (
                <>
                    {/* Summary Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="p-5">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Total Challenges
                                </p>
                                <Shield className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-foreground">
                                    {analytics.totalChallenges.toLocaleString()}
                                </span>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                                {analytics.solvedChallenges.toLocaleString()} solved,{" "}
                                {analytics.failedChallenges.toLocaleString()} failed
                            </div>
                        </Card>

                        <Card className="p-5">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Overall Solve Rate
                                </p>
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span
                                    className={cn(
                                        "text-2xl font-bold",
                                        analytics.solveRate >= 80
                                            ? "text-emerald-600 dark:text-emerald-500"
                                            : analytics.solveRate >= 60
                                                ? "text-amber-600 dark:text-amber-500"
                                                : "text-red-600 dark:text-red-500"
                                    )}
                                >
                                    {analytics.solveRate.toFixed(1)}%
                                </span>
                            </div>
                            <div className="mt-2">
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full transition-all",
                                            analytics.solveRate >= 80
                                                ? "bg-emerald-500"
                                                : analytics.solveRate >= 60
                                                    ? "bg-amber-500"
                                                    : "bg-red-500"
                                        )}
                                        style={{ width: `${analytics.solveRate}%` }}
                                    />
                                </div>
                            </div>
                        </Card>

                        <Card className="p-5">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Avg Solve Time
                                </p>
                                <Clock className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-foreground">
                                    {(analytics.avgSolveTime / 1000).toFixed(1)}
                                </span>
                                <span className="text-xs text-muted-foreground">sec</span>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                                {analytics.avgSolveTime.toLocaleString()}ms average
                            </div>
                        </Card>

                        <Card className="p-5">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Challenge Types
                                </p>
                                <PieChartIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-foreground">
                                    {analytics.challengesByType.length}
                                </span>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                                Different challenge types detected
                            </div>
                        </Card>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Challenge Type Distribution Pie Chart */}
                        <Card>
                            <div className="border-b bg-muted/50 px-6 py-4">
                                <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                                    <PieChartIcon className="w-4 h-4" />
                                    Challenge Type Distribution
                                </h3>
                            </div>
                            <div className="p-6">
                                {challengeTypeData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={challengeTypeData}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={(entry) => {
                                                    const percent = entry.percent || 0;
                                                    return `${entry.name}: ${(
                                                        percent * 100
                                                    ).toFixed(0)}%`;
                                                }}
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {challengeTypeData.map((_, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={
                                                            CHART_COLORS[
                                                            index % CHART_COLORS.length
                                                            ]
                                                        }
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
                                            <p className="text-sm">No challenge type data</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Solve Rate by Challenge Type Bar Chart */}
                        <Card>
                            <div className="border-b bg-muted/50 px-6 py-4">
                                <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" />
                                    Solve Rate by Challenge Type
                                </h3>
                            </div>
                            <div className="p-6">
                                {analytics.challengesByType.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={analytics.challengesByType}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis
                                                dataKey="type"
                                                tick={{ fontSize: 11 }}
                                                angle={-45}
                                                textAnchor="end"
                                                height={80}
                                            />
                                            <YAxis
                                                domain={[0, 100]}
                                                tick={{ fontSize: 12 }}
                                                label={{
                                                    value: "Solve Rate (%)",
                                                    angle: -90,
                                                    position: "insideLeft",
                                                }}
                                            />
                                            <Tooltip />
                                            <Bar
                                                dataKey="solveRate"
                                                fill="#10b981"
                                                name="Solve Rate"
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                        <div className="text-center">
                                            <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">No solve rate data</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Challenge Type Details Table */}
                    <Card>
                        <div className="border-b bg-muted/50 px-6 py-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                Challenge Type Details
                            </h3>
                        </div>

                        <div className="overflow-x-auto -mx-6 sm:mx-0">
                            <table className="w-full text-sm min-w-[700px]">
                                <thead className="bg-muted/30 border-b border-border">
                                    <tr>
                                        <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                                            Challenge Type
                                        </th>
                                        <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                            Count
                                        </th>
                                        <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                            Solve Rate
                                        </th>
                                        <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                            Avg Solve Time
                                        </th>
                                        <th className="px-6 py-3 text-center font-medium text-muted-foreground">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border bg-card">
                                    {analytics.challengesByType.map((challenge, index) => (
                                        <tr
                                            key={index}
                                            className={cn(
                                                "hover:bg-muted/50 transition-colors",
                                                challenge.solveRate < 70 &&
                                                "bg-amber-50/30 dark:bg-amber-950/10"
                                            )}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="capitalize">
                                                        {challenge.type}
                                                    </Badge>
                                                    {challenge.solveRate < 70 && (
                                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono">
                                                {challenge.count.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                "h-full transition-all",
                                                                challenge.solveRate >= 80
                                                                    ? "bg-emerald-500"
                                                                    : challenge.solveRate >= 60
                                                                        ? "bg-amber-500"
                                                                        : "bg-red-500"
                                                            )}
                                                            style={{
                                                                width: `${challenge.solveRate}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="font-mono text-xs w-12 text-right">
                                                        {challenge.solveRate.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono">
                                                {(challenge.avgSolveTime / 1000).toFixed(2)}s
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {challenge.solveRate >= 80 ? (
                                                    <Badge variant="success">Excellent</Badge>
                                                ) : challenge.solveRate >= 60 ? (
                                                    <Badge variant="warning">Fair</Badge>
                                                ) : (
                                                    <Badge variant="destructive">Poor</Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Challenges by Site Chart */}
                    <Card>
                        <div className="border-b bg-muted/50 px-6 py-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Challenges by Site
                            </h3>
                        </div>
                        <div className="p-6">
                            {analytics.challengesBySite && analytics.challengesBySite.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={analytics.challengesBySite}>
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
                                                value: "Challenge Count",
                                                angle: -90,
                                                position: "insideLeft",
                                            }}
                                        />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="count" fill="#3b82f6" name="Challenges" />
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

                    {/* Challenges by Site Table */}
                    <Card>
                        <div className="border-b bg-muted/50 px-6 py-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                Site Challenge Statistics
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
                                            Challenge Count
                                        </th>
                                        <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                                            Solve Rate
                                        </th>
                                        <th className="px-6 py-3 text-center font-medium text-muted-foreground">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border bg-card">
                                    {analytics.challengesBySite.map((site, index) => (
                                        <tr
                                            key={index}
                                            className={cn(
                                                "hover:bg-muted/50 transition-colors",
                                                site.solveRate < 70 &&
                                                "bg-amber-50/30 dark:bg-amber-950/10"
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
                                            <td className="px-6 py-4 text-center">
                                                {site.solveRate >= 80 ? (
                                                    <Badge variant="success">Good</Badge>
                                                ) : site.solveRate >= 60 ? (
                                                    <Badge variant="warning">Fair</Badge>
                                                ) : (
                                                    <Badge variant="destructive">Poor</Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            ) : (
                <Card className="p-12">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <Shield className="w-12 h-12 text-muted-foreground opacity-50" />
                        <div>
                            <p className="font-semibold text-foreground mb-1">
                                No challenge data available
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Challenge analytics will appear here once anti-bot challenges are
                                detected during scraping
                            </p>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}
