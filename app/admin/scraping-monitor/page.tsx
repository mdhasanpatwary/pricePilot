"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Activity, Shield, Globe, Users, Layers, AlertTriangle, Gauge } from "lucide-react";
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

interface TenantConcurrencyConfig {
    maxPerTenant: number;
    leaseTtlMs: number;
}

interface TenantConcurrencySummary {
    tenantsWithActiveJobs: number;
    totalActiveJobs: number;
    saturatedTenants: number;
}

interface TenantConcurrencyRow {
    tenantId: string;
    tenantName: string;
    active: number;
    maxPerTenant: number;
    utilizationPct: number;
}

interface TenantConcurrencyResponse {
    config: TenantConcurrencyConfig;
    summary: TenantConcurrencySummary;
    tenants: TenantConcurrencyRow[];
}

interface EngineBreakdown {
    total: number;
    success: number;
    failed: number;
}

interface OperationSummary extends EngineBreakdown {
    byEngine: Record<string, EngineBreakdown>;
}

interface EngineMetricsResponse {
    config: {
        primaryEngine: string;
        discoveryUseBot: boolean;
        retryUseBot: boolean;
    };
    windowMinutes: number;
    totals: {
        total: number;
        success: number;
        failed: number;
        successRate: number;
        fallbackTotal: number;
        fallbackRate: number;
        fallbackByReason: Record<string, number>;
    };
    operations: {
        searchAndScrape: OperationSummary;
        scrapeByUrl: OperationSummary;
    };
    anonymous: {
        total: number;
        success: number;
        failed: number;
        protectionDetected: number;
        method: {
            api: number;
            html: number;
            unknown: number;
        };
    };
}

interface OpsAlert {
    id: string;
    severity: "info" | "warning" | "critical";
    metric: string;
    current: number;
    threshold: number;
    message: string;
}

interface OpsMetricsResponse {
    windowMinutes: number;
    metrics: {
        activeJobs: number;
        queueDepth: number;
        queueLatencyP95Ms: number;
        activeJobsLive: number;
        activeJobsByQueue: Record<string, number>;
        queueLatencyByQueue: Record<string, { avgMs: number; maxMs: number; p95ApproxMs: number; count: number }>;
        perTenantActiveJobCount: Array<{ tenantId: string; tenantName: string; activeJobs: number }>;
        browserPoolUsage: {
            totalBrowsers: number;
            inUseBrowsers: number;
            maxGlobalBrowsers: number;
            utilizationPct: number;
            healthy: boolean;
            healthReasons: string[];
            memoryRssMb?: number;
        };
        memoryUsage: {
            rssMb: number;
            heapUsedMb: number;
            heapTotalMb: number;
            externalMb: number;
            redisUsedMb: number;
        };
        blockRate: {
            total: number;
            blocked: number;
            blockRatePct: number;
            perDomain: Array<{ domain: string; total: number; blocked: number; blockRatePct: number }>;
        };
        retryRate: {
            enqueued: number;
            claimed: number;
            success: number;
            requeued: number;
            failed: number;
            retryRatePct: number;
            failureRatePct: number;
            totalOutcomes: number;
        };
    };
    alerts: OpsAlert[];
    overload: {
        overloaded: boolean;
        reasons: string[];
    };
}

export default function ScrapingMonitorPage() {
    const router = useRouter();
    const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
    const [proxies, setProxies] = useState<ProxyHealth[]>([]);
    const [tenantConcurrency, setTenantConcurrency] = useState<TenantConcurrencyResponse | null>(null);
    const [engineMetrics, setEngineMetrics] = useState<EngineMetricsResponse | null>(null);
    const [opsMetrics, setOpsMetrics] = useState<OpsMetricsResponse | null>(null);
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

            const [metricsRes, proxiesRes, tenantConcurrencyRes, engineMetricsRes, opsMetricsRes] = await Promise.all([
                fetch('/api/v1/scraping/metrics/summary'),
                fetch('/api/v1/scraping/proxies'),
                fetch('/api/v1/admin/scraping/tenant-concurrency'),
                fetch('/api/v1/admin/scraping/engine-metrics'),
                fetch('/api/v1/admin/scraping/ops-metrics'),
            ]);

            if (!metricsRes.ok) throw new Error('Failed to fetch metrics');
            if (!proxiesRes.ok) throw new Error('Failed to fetch proxies');
            if (!tenantConcurrencyRes.ok) throw new Error('Failed to fetch tenant concurrency');
            if (!engineMetricsRes.ok) throw new Error('Failed to fetch engine metrics');
            if (!opsMetricsRes.ok) throw new Error('Failed to fetch operational metrics');

            const [metricsData, proxiesData, tenantConcurrencyData, engineMetricsData, opsMetricsData] = await Promise.all([
                metricsRes.json(),
                proxiesRes.json(),
                tenantConcurrencyRes.json(),
                engineMetricsRes.json(),
                opsMetricsRes.json(),
            ]);

            setMetrics(metricsData.data);
            setTenantConcurrency(tenantConcurrencyData.data);
            setEngineMetrics(engineMetricsData.data);
            setOpsMetrics(opsMetricsData.data);

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
                        <Users className="h-5 w-5" />
                        Tenant Concurrency
                    </CardTitle>
                    <CardDescription>
                        Live worker-level per-tenant scrape concurrency usage
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {tenantConcurrency ? (
                        <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Tenants With Active Jobs</div>
                                    <div className="text-2xl font-bold">{tenantConcurrency.summary.tenantsWithActiveJobs}</div>
                                </div>
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Total Active Jobs</div>
                                    <div className="text-2xl font-bold">{tenantConcurrency.summary.totalActiveJobs}</div>
                                </div>
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Saturated Tenants</div>
                                    <div className="text-2xl font-bold">{tenantConcurrency.summary.saturatedTenants}</div>
                                </div>
                            </div>

                            {tenantConcurrency.tenants.length > 0 ? (
                                <div className="space-y-2">
                                    {tenantConcurrency.tenants.map((tenant) => (
                                        <div key={tenant.tenantId} className="flex items-center justify-between p-3 border rounded-lg">
                                            <div>
                                                <div className="font-medium">{tenant.tenantName}</div>
                                                <div className="text-xs text-muted-foreground">{tenant.tenantId}</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <div className="font-bold">{tenant.active} / {tenant.maxPerTenant}</div>
                                                    <div className="text-xs text-muted-foreground">{tenant.utilizationPct}% used</div>
                                                </div>
                                                {tenant.active >= tenant.maxPerTenant ? (
                                                    <Badge variant="destructive">Saturated</Badge>
                                                ) : (
                                                    <Badge variant="default">Available</Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-muted-foreground">
                                    No active tenant scrape counters
                                </div>
                            )}

                            <p className="text-xs text-muted-foreground">
                                Limit: {tenantConcurrency.config.maxPerTenant} concurrent scrape jobs per tenant
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            Tenant concurrency data unavailable
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Gauge className="h-5 w-5" />
                        Operational Visibility
                    </CardTitle>
                    <CardDescription>
                        Real-time queue, browser, memory, block and retry telemetry
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {opsMetrics ? (
                        <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Active Jobs</div>
                                    <div className="text-2xl font-bold">{opsMetrics.metrics.activeJobs}</div>
                                    <div className="text-xs text-muted-foreground">Live: {opsMetrics.metrics.activeJobsLive}</div>
                                </div>
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Queue Depth</div>
                                    <div className="text-2xl font-bold">{opsMetrics.metrics.queueDepth}</div>
                                    <div className="text-xs text-muted-foreground">P95: {opsMetrics.metrics.queueLatencyP95Ms}ms</div>
                                </div>
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Browser Utilization</div>
                                    <div className="text-2xl font-bold">{opsMetrics.metrics.browserPoolUsage.utilizationPct.toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">
                                        {opsMetrics.metrics.browserPoolUsage.totalBrowsers}/{opsMetrics.metrics.browserPoolUsage.maxGlobalBrowsers} browsers
                                    </div>
                                </div>
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Memory RSS</div>
                                    <div className="text-2xl font-bold">{opsMetrics.metrics.memoryUsage.rssMb.toFixed(1)}MB</div>
                                    <div className="text-xs text-muted-foreground">Redis: {opsMetrics.metrics.memoryUsage.redisUsedMb.toFixed(1)}MB</div>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Block Rate</div>
                                    <div className="text-2xl font-bold">{opsMetrics.metrics.blockRate.blockRatePct.toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">
                                        {opsMetrics.metrics.blockRate.blocked}/{opsMetrics.metrics.blockRate.total} blocked
                                    </div>
                                </div>
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Retry Rate</div>
                                    <div className="text-2xl font-bold">{opsMetrics.metrics.retryRate.retryRatePct.toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">
                                        failed: {opsMetrics.metrics.retryRate.failureRatePct.toFixed(1)}%
                                    </div>
                                </div>
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Overload State</div>
                                    <div className="text-2xl font-bold">
                                        {opsMetrics.overload.overloaded ? "ON" : "OFF"}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {opsMetrics.overload.reasons.join(", ") || "no overload signals"}
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground">Active jobs by tenant (top)</div>
                                    <div className="space-y-2">
                                        {opsMetrics.metrics.perTenantActiveJobCount.slice(0, 8).map((tenant) => (
                                            <div key={tenant.tenantId} className="flex items-center justify-between p-2 border rounded-md">
                                                <span className="text-sm">{tenant.tenantName}</span>
                                                <Badge variant="outline">{tenant.activeJobs}</Badge>
                                            </div>
                                        ))}
                                        {opsMetrics.metrics.perTenantActiveJobCount.length === 0 ? (
                                            <div className="text-xs text-muted-foreground p-2">No active tenant jobs</div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground">Highest block-rate domains</div>
                                    <div className="space-y-2">
                                        {opsMetrics.metrics.blockRate.perDomain.slice(0, 8).map((row) => (
                                            <div key={row.domain} className="flex items-center justify-between p-2 border rounded-md">
                                                <span className="text-xs font-mono">{row.domain}</span>
                                                <Badge variant={row.blockRatePct >= 30 ? "destructive" : "outline"}>
                                                    {row.blockRatePct.toFixed(1)}%
                                                </Badge>
                                            </div>
                                        ))}
                                        {opsMetrics.metrics.blockRate.perDomain.length === 0 ? (
                                            <div className="text-xs text-muted-foreground p-2">No domain block data yet</div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            {opsMetrics.alerts.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Operational Alerts
                                    </div>
                                    {opsMetrics.alerts.map((alert) => (
                                        <div key={alert.id} className="flex items-center justify-between p-2 border rounded-md">
                                            <div className="text-xs">{alert.message}</div>
                                            <Badge variant={alert.severity === "critical" ? "destructive" : "secondary"}>
                                                {alert.severity}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-muted-foreground">No operational alerts</div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            Operational metrics unavailable
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5" />
                        Unified Scraping Engine
                    </CardTitle>
                    <CardDescription>
                        Facade routing and fallback behavior over the last {engineMetrics?.windowMinutes ?? 60} minutes
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {engineMetrics ? (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">Primary: {engineMetrics.config.primaryEngine}</Badge>
                                <Badge variant={engineMetrics.config.discoveryUseBot ? "default" : "outline"}>
                                    Discovery bot: {engineMetrics.config.discoveryUseBot ? "on" : "off"}
                                </Badge>
                                <Badge variant={engineMetrics.config.retryUseBot ? "default" : "outline"}>
                                    Retry bot: {engineMetrics.config.retryUseBot ? "on" : "off"}
                                </Badge>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Total Facade Calls</div>
                                    <div className="text-2xl font-bold">{engineMetrics.totals.total}</div>
                                </div>
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Success Rate</div>
                                    <div className="text-2xl font-bold">{engineMetrics.totals.successRate.toFixed(1)}%</div>
                                </div>
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Fallback Rate</div>
                                    <div className="text-2xl font-bold">{engineMetrics.totals.fallbackRate.toFixed(1)}%</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {Object.entries(engineMetrics.operations).map(([operation, summary]) => (
                                    <div key={operation} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div>
                                            <div className="font-medium">{operation}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {summary.success} success / {summary.failed} failed
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold">{summary.total}</div>
                                            <div className="text-xs text-muted-foreground">
                                                legacy: {summary.byEngine.legacy?.total ?? 0} | bot: {summary.byEngine.bot?.total ?? 0}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {Object.keys(engineMetrics.totals.fallbackByReason || {}).length > 0 ? (
                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground">Fallback reasons</div>
                                    {Object.entries(engineMetrics.totals.fallbackByReason)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([reason, count]) => (
                                            <div key={reason} className="flex items-center justify-between p-2 border rounded-md">
                                                <span className="text-xs font-mono">{reason}</span>
                                                <Badge variant="outline">{count}</Badge>
                                            </div>
                                        ))}
                                </div>
                            ) : null}

                            <div className="space-y-2">
                                <div className="text-xs text-muted-foreground">Anonymous bot scrape telemetry</div>
                                <div className="grid gap-2 md:grid-cols-4">
                                    <div className="p-2 border rounded-md">
                                        <div className="text-xs text-muted-foreground">Total</div>
                                        <div className="font-bold">{engineMetrics.anonymous.total}</div>
                                    </div>
                                    <div className="p-2 border rounded-md">
                                        <div className="text-xs text-muted-foreground">Success</div>
                                        <div className="font-bold">{engineMetrics.anonymous.success}</div>
                                    </div>
                                    <div className="p-2 border rounded-md">
                                        <div className="text-xs text-muted-foreground">Failed</div>
                                        <div className="font-bold">{engineMetrics.anonymous.failed}</div>
                                    </div>
                                    <div className="p-2 border rounded-md">
                                        <div className="text-xs text-muted-foreground">Protection</div>
                                        <div className="font-bold">{engineMetrics.anonymous.protectionDetected}</div>
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    method api: {engineMetrics.anonymous.method.api} | html: {engineMetrics.anonymous.method.html} | unknown: {engineMetrics.anonymous.method.unknown}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            Unified engine metrics unavailable
                        </div>
                    )}
                </CardContent>
            </Card>

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
