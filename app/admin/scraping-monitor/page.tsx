"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Activity, Shield, Globe } from "lucide-react";
import { SiteStatusIndicator, formatRelativeTime } from "@/components/admin/scraping/site-status-indicator";

interface MetricsSummary {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    successRate: number;
    averageResponseTime: number;
    protectionTypeBreakdown: Record<string, number>;
    strategyBreakdown: Record<string, number>;
    siteMetrics: SiteMetrics[];
}

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

interface ProxyHealth {
    proxyId: string;
    host: string;
    port: number;
    globalSuccessRate: number;
    totalAttempts: number;
    isBlocked: boolean;
    lastSuccess?: string;
    lastFailure?: string;
}

export default function ScrapingMonitorPage() {
    const router = useRouter();
    const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
    const [proxies, setProxies] = useState<ProxyHealth[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            setError(null);

            // Fetch metrics summary
            const metricsRes = await fetch('/api/v1/scraping/metrics/summary');
            if (!metricsRes.ok) throw new Error('Failed to fetch metrics');
            const metricsData = await metricsRes.json();
            setMetrics(metricsData.data);

            // Fetch proxy health
            const proxiesRes = await fetch('/api/v1/scraping/proxies');
            if (!proxiesRes.ok) throw new Error('Failed to fetch proxies');
            const proxiesData = await proxiesRes.json();

            // Fetch health for each proxy
            const proxyHealthPromises = proxiesData.data.proxies.map(async (proxy: any) => {
                const healthRes = await fetch(`/api/v1/scraping/proxies/${proxy.id}/health`);
                if (!healthRes.ok) return null;
                const healthData = await healthRes.json();
                return {
                    proxyId: proxy.id,
                    host: proxy.host,
                    port: proxy.port,
                    ...healthData.data
                };
            });

            const proxyHealthData = await Promise.all(proxyHealthPromises);
            setProxies(proxyHealthData.filter(Boolean) as ProxyHealth[]);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
            healthy: "default",
            degraded: "secondary",
            blocked: "destructive"
        };
        return (
            <Badge variant={variants[status] || "outline"} className="capitalize">
                {status}
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Scraping Monitor</h1>
                    <p className="text-muted-foreground">
                        Real-time monitoring of competitor scraping health and performance
                    </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i}>
                            <CardHeader className="pb-2">
                                <Skeleton className="h-4 w-24" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-16" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Scraping Monitor</h1>
                    <p className="text-muted-foreground">
                        Real-time monitoring of competitor scraping health and performance
                    </p>
                </div>
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error Loading Data</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Scraping Monitor</h1>
                <p className="text-muted-foreground">
                    Real-time monitoring of competitor scraping health and performance
                </p>
            </div>

            {/* Overall Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Overall Success Rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-2xl font-bold">
                                {metrics?.successRate.toFixed(1)}%
                            </div>
                            {metrics && metrics.successRate >= 80 ? (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {metrics?.successfulAttempts} / {metrics?.totalAttempts} attempts
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Avg Response Time</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {metrics?.averageResponseTime.toFixed(0)}ms
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Across all sites
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Active Proxies</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {proxies.filter(p => !p.isBlocked).length} / {proxies.length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {proxies.filter(p => p.isBlocked).length} blocked
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Protection Detections</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {Object.values(metrics?.protectionTypeBreakdown || {}).reduce((a, b) => a + b, 0)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Total detections
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Per-Site Success Rates */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Competitor Site Health
                    </CardTitle>
                    <CardDescription>
                        Success rates and status for each competitor website
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {metrics?.siteMetrics && metrics.siteMetrics.length > 0 ? (
                        <div className="space-y-4">
                            {metrics.siteMetrics.map((site) => (
                                <div
                                    key={site.competitorWebsiteId}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                                    onClick={() => router.push(`/admin/scraping-monitor/${site.competitorWebsiteId}`)}
                                >
                                    <div className="flex items-center gap-3 flex-1">
                                        <SiteStatusIndicator
                                            status={site.currentStatus}
                                            successRate={site.successRate}
                                            lastSuccess={site.lastSuccess}
                                            lastFailure={site.lastFailure}
                                            showLabel={false}
                                            size="md"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium">{site.siteName}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {site.totalAttempts} attempts • {site.averageResponseTime.toFixed(0)}ms avg
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-2xl font-bold">{site.successRate.toFixed(1)}%</div>
                                            <div className="text-xs text-muted-foreground">
                                                Last: {formatRelativeTime(site.lastSuccess || site.lastFailure)}
                                            </div>
                                        </div>
                                        {getStatusBadge(site.currentStatus)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No site metrics available
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Protection Type Classifications */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Protection Type Breakdown
                    </CardTitle>
                    <CardDescription>
                        Recent bot protection mechanisms detected
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {metrics?.protectionTypeBreakdown && Object.keys(metrics.protectionTypeBreakdown).length > 0 ? (
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {Object.entries(metrics.protectionTypeBreakdown).map(([type, count]) => (
                                <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                                    <span className="text-sm font-medium capitalize">
                                        {type.replace(/_/g, ' ')}
                                    </span>
                                    <Badge variant="secondary">{count}</Badge>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No protection types detected
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Proxy Health Statistics */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Proxy Health
                    </CardTitle>
                    <CardDescription>
                        Health and performance metrics for each proxy
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {proxies.length > 0 ? (
                        <div className="space-y-3">
                            {proxies.map((proxy) => (
                                <div
                                    key={proxy.proxyId}
                                    className="flex items-center justify-between p-3 border rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        {proxy.isBlocked ? (
                                            <XCircle className="h-4 w-4 text-red-500" />
                                        ) : (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        )}
                                        <div>
                                            <div className="font-medium text-sm">
                                                {proxy.host}:{proxy.port}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {proxy.totalAttempts} attempts
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="font-bold">{proxy.globalSuccessRate.toFixed(1)}%</div>
                                            <div className="text-xs text-muted-foreground">
                                                {formatRelativeTime(proxy.lastSuccess)}
                                            </div>
                                        </div>
                                        {proxy.isBlocked ? (
                                            <Badge variant="destructive">Blocked</Badge>
                                        ) : (
                                            <Badge variant="default">Active</Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No proxies configured
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
