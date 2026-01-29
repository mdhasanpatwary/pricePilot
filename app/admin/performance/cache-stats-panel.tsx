"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface Alert {
    level: 'warning' | 'critical';
    message: string;
    recommendation: string;
}

interface CacheStatsData {
    cacheHealth: 'healthy' | 'warning' | 'critical';
    performance: {
        hitRate: number;
        missRate: number;
        totalRequests: number;
        hitRatePercent: number;
        missRatePercent: number;
        hitRateStatus: 'good' | 'acceptable' | 'poor';
    };
    memory: {
        usedBytes: number;
        usedMB: number;
        usedGB: number;
        status: 'good' | 'warning' | 'critical';
    };
    keys: {
        total: number;
        evictions: number;
        evictionRate: number;
    };
    alerts: Alert[];
}

export function CacheStatsPanel() {
    const [data, setData] = useState<CacheStatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/v1/admin/performance/cache-stats');
            if (!res.ok) throw new Error('Failed to fetch cache stats');
            const result = await res.json();
            setData(result.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, []);

    const getHealthIcon = (status: string) => {
        switch (status) {
            case 'healthy': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            case 'critical': return <XCircle className="w-5 h-5 text-red-500" />;
            default: return null;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'good': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Good</Badge>;
            case 'acceptable': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Acceptable</Badge>;
            case 'poor': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Poor</Badge>;
            case 'warning': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Warning</Badge>;
            case 'critical': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Critical</Badge>;
            default: return null;
        }
    };

    if (loading && !data) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading cache stats...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-2">
                        <XCircle className="w-6 h-6 text-red-500" />
                        <p className="text-sm text-red-600">{error}</p>
                        <Button onClick={fetchData} variant="outline" size="sm">
                            Retry
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cache Health</CardTitle>
                        {data && getHealthIcon(data.cacheHealth)}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">{data?.cacheHealth}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
                        {data && getStatusBadge(data.performance.hitRateStatus)}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.performance.hitRatePercent.toFixed(1)}%</div>
                        <Progress
                            value={data?.performance.hitRatePercent}
                            className="mt-2"
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                        {data && getStatusBadge(data.memory.status)}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.memory.usedMB.toFixed(0)} MB</div>
                        <p className="text-xs text-muted-foreground">{data?.memory.usedGB.toFixed(2)} GB</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Keys</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.keys.total.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">{data?.keys.evictions} evictions</p>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Details */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Cache Performance</CardTitle>
                            <CardDescription>Hit rates, memory usage, and key statistics</CardDescription>
                        </div>
                        <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Hit/Miss Breakdown */}
                    <div>
                        <h4 className="text-sm font-medium mb-4">Request Breakdown</h4>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Cache Hits</span>
                                    <span className="font-medium">{data?.performance.hitRate.toLocaleString()}</span>
                                </div>
                                <Progress
                                    value={data?.performance.hitRatePercent}
                                    className="h-2"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {data?.performance.hitRatePercent.toFixed(1)}% of requests
                                </p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Cache Misses</span>
                                    <span className="font-medium">{data?.performance.missRate.toLocaleString()}</span>
                                </div>
                                <Progress
                                    value={data?.performance.missRatePercent}
                                    className="h-2"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {data?.performance.missRatePercent.toFixed(1)}% of requests
                                </p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Requests</span>
                                    <span className="font-medium">{data?.performance.totalRequests.toLocaleString()}</span>
                                </div>
                                <Progress
                                    value={100}
                                    className="h-2"
                                />
                                <p className="text-xs text-muted-foreground">
                                    All cache operations
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Key Statistics */}
                    <div>
                        <h4 className="text-sm font-medium mb-4">Key Statistics</h4>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="border rounded-lg p-4">
                                <div className="text-2xl font-bold">{data?.keys.total.toLocaleString()}</div>
                                <p className="text-sm text-muted-foreground mt-1">Total Keys</p>
                            </div>
                            <div className="border rounded-lg p-4">
                                <div className="text-2xl font-bold">{data?.keys.evictions.toLocaleString()}</div>
                                <p className="text-sm text-muted-foreground mt-1">Evictions</p>
                            </div>
                            <div className="border rounded-lg p-4">
                                <div className="text-2xl font-bold">{data?.keys.evictionRate.toFixed(2)}%</div>
                                <p className="text-sm text-muted-foreground mt-1">Eviction Rate</p>
                            </div>
                        </div>
                    </div>

                    {/* Memory Details */}
                    <div>
                        <h4 className="text-sm font-medium mb-4">Memory Usage</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Used Memory</span>
                                <span className="text-sm font-medium">
                                    {data?.memory.usedMB.toFixed(2)} MB ({data?.memory.usedGB.toFixed(2)} GB)
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Memory Status</span>
                                {data && getStatusBadge(data.memory.status)}
                            </div>
                        </div>
                    </div>

                    {/* Alerts */}
                    {data && data.alerts.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium mb-4">Alerts</h4>
                            <div className="space-y-3">
                                {data.alerts.map((alert, index) => (
                                    <div
                                        key={index}
                                        className={`border rounded-lg p-4 ${alert.level === 'critical'
                                                ? 'border-red-200 bg-red-50'
                                                : 'border-yellow-200 bg-yellow-50'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {alert.level === 'critical' ? (
                                                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium">{alert.message}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {alert.recommendation}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
