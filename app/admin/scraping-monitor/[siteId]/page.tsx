"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Eye, Clock, AlertTriangle } from "lucide-react";
import { SiteStatusIndicator, formatRelativeTime } from "@/components/admin/scraping/site-status-indicator";
import { TrendChart, TimeRange } from "@/components/admin/scraping/trend-chart";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface SiteMetrics {
    competitorWebsiteId: string;
    siteName: string;
    successRate: number;
    totalAttempts: number;
    averageResponseTime: number;
    lastSuccess?: string;
    lastFailure?: string;
    currentStatus: 'healthy' | 'degraded' | 'blocked';
}

interface ScrapeAttempt {
    id: string;
    url: string;
    strategy: string;
    success: boolean;
    protectionDetected: boolean;
    protectionType?: string;
    statusCode: number;
    responseTime: number;
    errorMessage?: string;
    attemptNumber: number;
    timestamp: string;
}

interface ProtectionDetection {
    id: string;
    protectionType: string;
    confidence: number;
    indicators: string[];
    reasoning: string;
    timestamp: string;
}

interface TrendDataPoint {
    timestamp: string;
    successRate: number;
    avgResponseTime: number;
    totalAttempts: number;
    protectionDetections: number;
}

export default function SiteDetailPage() {
    const params = useParams();
    const router = useRouter();
    const siteId = params.siteId as string;

    const [siteMetrics, setSiteMetrics] = useState<SiteMetrics | null>(null);
    const [attempts, setAttempts] = useState<ScrapeAttempt[]>([]);
    const [detections, setDetections] = useState<ProtectionDetection[]>([]);
    const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
    const [timeRange, setTimeRange] = useState<TimeRange>('24h');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const [metricsRes, attemptsRes, detectionsRes] = await Promise.all([
                fetch(`/api/v1/scraping/metrics/sites/${siteId}`),
                fetch(`/api/v1/scraping/attempts?competitorWebsiteId=${siteId}&limit=50`),
                fetch(`/api/v1/scraping/detections?competitorWebsiteId=${siteId}&limit=20`)
            ]);

            if (!metricsRes.ok) throw new Error('Failed to fetch metrics');
            if (!attemptsRes.ok) throw new Error('Failed to fetch attempts');
            if (!detectionsRes.ok) throw new Error('Failed to fetch detections');

            const metricsData = await metricsRes.json();
            const attemptsData = await attemptsRes.json();
            const detectionsData = await detectionsRes.json();

            setSiteMetrics(metricsData.data);
            setAttempts(attemptsData.data.attempts);
            setDetections(detectionsData.data.detections);
            setTrendData(generateTrendData(attemptsData.data.attempts, timeRange));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    }, [siteId, timeRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const generateTrendData = (attempts: ScrapeAttempt[], range: TimeRange): TrendDataPoint[] => {
        const now = new Date();
        const buckets: Map<string, { success: number; total: number; responseTime: number; protections: number }> = new Map();

        const bucketSize = range === '24h' ? 60 * 60 * 1000 : range === '7d' ? 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        const numBuckets = range === '24h' ? 24 : range === '7d' ? 7 : 30;

        for (let i = 0; i < numBuckets; i++) {
            const bucketTime = new Date(now.getTime() - (numBuckets - i) * bucketSize);
            const key = bucketTime.toISOString();
            buckets.set(key, { success: 0, total: 0, responseTime: 0, protections: 0 });
        }

        attempts.forEach(attempt => {
            const attemptTime = new Date(attempt.timestamp);
            const bucketIndex = Math.floor((now.getTime() - attemptTime.getTime()) / bucketSize);
            if (bucketIndex >= 0 && bucketIndex < numBuckets) {
                const bucketTime = new Date(now.getTime() - bucketIndex * bucketSize);
                const key = bucketTime.toISOString();
                const bucket = buckets.get(key);
                if (bucket) {
                    bucket.total++;
                    if (attempt.success) bucket.success++;
                    bucket.responseTime += attempt.responseTime;
                    if (attempt.protectionDetected) bucket.protections++;
                }
            }
        });

        return Array.from(buckets.entries()).map(([timestamp, data]) => ({
            timestamp,
            successRate: data.total > 0 ? (data.success / data.total) * 100 : 0,
            avgResponseTime: data.total > 0 ? data.responseTime / data.total : 0,
            totalAttempts: data.total,
            protectionDetections: data.protections
        }));
    };

    const getStrategyBadge = (strategy: string) => {
        const variants: Record<string, "default" | "secondary" | "outline"> = {
            http_client: "outline",
            http_with_proxy: "secondary",
            headless_browser: "default",
            headless_with_proxy: "default",
            stealth_browser: "default"
        };
        return (
            <Badge variant={variants[strategy] || "outline"} className="text-xs">
                {strategy.replace(/_/g, ' ')}
            </Badge>
        );
    };

    const getProtectionTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            ip_block: "destructive",
            rate_limit: "secondary",
            captcha: "destructive",
            fake_data: "secondary",
            redirect_block: "secondary",
            delayed_response: "outline",
            empty_response: "outline"
        };
        return (
            <Badge variant={colors[type] as any || "outline"} className="text-xs">
                {type.replace(/_/g, ' ')}
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                </div>
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (error || !siteMetrics) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                </div>
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error Loading Data</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">{error || 'Site not found'}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{siteMetrics.siteName}</h1>
                        <p className="text-sm text-muted-foreground">Detailed scraping logs and metrics</p>
                    </div>
                </div>
                <SiteStatusIndicator
                    status={siteMetrics.currentStatus}
                    successRate={siteMetrics.successRate}
                    lastSuccess={siteMetrics.lastSuccess}
                    lastFailure={siteMetrics.lastFailure}
                    showLabel={true}
                    size="lg"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Success Rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{siteMetrics.successRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {siteMetrics.totalAttempts} total attempts
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Avg Response Time</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{siteMetrics.averageResponseTime.toFixed(0)}ms</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Last Success</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-medium">
                            {formatRelativeTime(siteMetrics.lastSuccess)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Last Failure</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-medium">
                            {formatRelativeTime(siteMetrics.lastFailure)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <TrendChart
                data={trendData}
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
                title={`${siteMetrics.siteName} Trends`}
                description="Historical performance metrics over time"
            />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Protection Type History
                    </CardTitle>
                    <CardDescription>
                        Recent bot protection detections for this site
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {detections.length > 0 ? (
                        <div className="space-y-3">
                            {detections.map((detection) => (
                                <div key={detection.id} className="flex items-start justify-between p-3 border rounded-lg">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            {getProtectionTypeBadge(detection.protectionType)}
                                            <span className="text-xs text-muted-foreground">
                                                {formatRelativeTime(detection.timestamp)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{detection.reasoning}</p>
                                        {detection.indicators.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {detection.indicators.map((indicator, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                        {indicator}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <Badge variant="secondary" className="ml-2">
                                        {detection.confidence.toFixed(0)}%
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No protection detections recorded
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Recent Scrape Attempts
                    </CardTitle>
                    <CardDescription>
                        Detailed log of recent scraping attempts
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {attempts.length > 0 ? (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Timestamp</TableHead>
                                        <TableHead>Strategy</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Response Time</TableHead>
                                        <TableHead>Protection</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {attempts.slice(0, 50).map((attempt) => (
                                        <TableRow key={attempt.id}>
                                            <TableCell className="text-sm">
                                                {formatRelativeTime(attempt.timestamp)}
                                            </TableCell>
                                            <TableCell>
                                                {getStrategyBadge(attempt.strategy)}
                                            </TableCell>
                                            <TableCell>
                                                {attempt.success ? (
                                                    <Badge variant="default" className="text-xs">Success</Badge>
                                                ) : (
                                                    <Badge variant="destructive" className="text-xs">Failed</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {attempt.responseTime}ms
                                            </TableCell>
                                            <TableCell>
                                                {attempt.protectionDetected && attempt.protectionType ? (
                                                    getProtectionTypeBadge(attempt.protectionType)
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">None</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No scrape attempts recorded
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
