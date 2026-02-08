"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, Clock, Database, AlertCircle } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface WebsiteMetrics {
    competitorWebsiteId: string;
    websiteName: string;
    websiteUrl: string;
    detectionSuccessRate: number;
    averageDetectionTimeMs: number;
    averageExtractionTimeMs: number;
    totalProductsExtracted: number;
    cacheHitRate: number;
    fallbackRate: number;
}

interface AggregatedMetrics {
    totalWebsites: number;
    averageSuccessRate: number;
    averageDetectionTime: number;
    averageExtractionTime: number;
    totalProductsExtracted: number;
    averageCacheHitRate: number;
    averageFallbackRate: number;
}

export function ApiDetectionMetricsContent() {
    const [loading, setLoading] = useState(true);
    const [websiteMetrics, setWebsiteMetrics] = useState<WebsiteMetrics[]>([]);
    const [aggregated, setAggregated] = useState<AggregatedMetrics | null>(null);
    const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");

    useEffect(() => {
        fetchMetrics();
    }, [dateRange]);

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/v1/admin/api-detection/metrics?range=${dateRange}`);
            if (response.ok) {
                const data = await response.json();
                setWebsiteMetrics(data.websiteMetrics || []);
                setAggregated(data.aggregated || null);
            }
        } catch (error) {
            console.error("Failed to fetch metrics:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (ms: number) => {
        if (ms < 1000) return `${Math.round(ms)}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatPercentage = (value: number) => {
        return `${value.toFixed(1)}%`;
    };

    const getSuccessRateBadge = (rate: number) => {
        if (rate >= 80) return <Badge className="bg-green-500">Excellent</Badge>;
        if (rate >= 60) return <Badge className="bg-yellow-500">Good</Badge>;
        if (rate >= 40) return <Badge className="bg-orange-500">Fair</Badge>;
        return <Badge className="bg-red-500">Poor</Badge>;
    };

    const getCacheHitRateBadge = (rate: number) => {
        if (rate >= 80) return <Badge className="bg-green-500">High</Badge>;
        if (rate >= 50) return <Badge className="bg-yellow-500">Medium</Badge>;
        return <Badge className="bg-orange-500">Low</Badge>;
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <p className="text-xs text-muted-foreground font-medium">Loading metrics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with date range selector */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant={dateRange === "7d" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDateRange("7d")}
                    >
                        Last 7 Days
                    </Button>
                    <Button
                        variant={dateRange === "30d" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDateRange("30d")}
                    >
                        Last 30 Days
                    </Button>
                    <Button
                        variant={dateRange === "90d" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDateRange("90d")}
                    >
                        Last 90 Days
                    </Button>
                </div>
                <Button variant="outline" size="sm" onClick={fetchMetrics}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Aggregated metrics cards */}
            {aggregated && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Detection Success Rate</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatPercentage(aggregated.averageSuccessRate)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Across {aggregated.totalWebsites} websites
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Avg Detection Time</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatTime(aggregated.averageDetectionTime)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Time to discover APIs
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                            <Database className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatPercentage(aggregated.averageCacheHitRate)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Patterns reused from cache
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Fallback Rate</CardTitle>
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatPercentage(aggregated.averageFallbackRate)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Fell back to HTML scraping
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Per-website metrics table */}
            <Card>
                <CardHeader>
                    <CardTitle>Detection Metrics by Website</CardTitle>
                    <CardDescription>
                        Detailed API detection performance for each competitor website
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {websiteMetrics.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Database className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-sm text-muted-foreground">
                                No API detection metrics available for the selected period
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Website</TableHead>
                                        <TableHead>Success Rate</TableHead>
                                        <TableHead>Detection Time</TableHead>
                                        <TableHead>Extraction Time</TableHead>
                                        <TableHead>Products</TableHead>
                                        <TableHead>Cache Hit Rate</TableHead>
                                        <TableHead>Fallback Rate</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {websiteMetrics.map((metric) => (
                                        <TableRow key={metric.competitorWebsiteId}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{metric.websiteName}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {metric.websiteUrl}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span>{formatPercentage(metric.detectionSuccessRate)}</span>
                                                    {getSuccessRateBadge(metric.detectionSuccessRate)}
                                                </div>
                                            </TableCell>
                                            <TableCell>{formatTime(metric.averageDetectionTimeMs)}</TableCell>
                                            <TableCell>{formatTime(metric.averageExtractionTimeMs)}</TableCell>
                                            <TableCell>{metric.totalProductsExtracted.toLocaleString()}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span>{formatPercentage(metric.cacheHitRate)}</span>
                                                    {getCacheHitRateBadge(metric.cacheHitRate)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={metric.fallbackRate > 50 ? "text-orange-500" : ""}>
                                                    {formatPercentage(metric.fallbackRate)}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Additional insights */}
            {aggregated && (
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Performance Insights</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Total Products Extracted</span>
                                <span className="font-medium">
                                    {aggregated.totalProductsExtracted.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Avg Extraction Time</span>
                                <span className="font-medium">
                                    {formatTime(aggregated.averageExtractionTime)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Websites Monitored</span>
                                <span className="font-medium">{aggregated.totalWebsites}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Efficiency Metrics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Cache Efficiency</span>
                                <span className="font-medium">
                                    {formatPercentage(aggregated.averageCacheHitRate)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">API Detection Success</span>
                                <span className="font-medium">
                                    {formatPercentage(aggregated.averageSuccessRate)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">HTML Fallback Usage</span>
                                <span className="font-medium">
                                    {formatPercentage(aggregated.averageFallbackRate)}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
