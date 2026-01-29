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

interface ConnectionPoolData {
    poolHealth: 'healthy' | 'warning' | 'critical';
    connections: {
        total: number;
        active: number;
        idle: number;
        waiting: number;
        utilizationPercent: number;
        efficiency: number;
    };
    health: {
        healthy: boolean;
        primaryReachable: boolean;
        replicasReachable: number;
        avgResponseTime: number;
        responseTimeStatus: 'good' | 'acceptable' | 'slow';
    };
    alerts: Alert[];
}

export function ConnectionPoolPanel() {
    const [data, setData] = useState<ConnectionPoolData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/v1/admin/performance/pool-stats');
            if (!res.ok) throw new Error('Failed to fetch pool stats');
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

    const getResponseTimeBadge = (status: string) => {
        switch (status) {
            case 'good': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Good</Badge>;
            case 'acceptable': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Acceptable</Badge>;
            case 'slow': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Slow</Badge>;
            default: return null;
        }
    };

    if (loading && !data) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading pool stats...</p>
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
                        <CardTitle className="text-sm font-medium">Pool Health</CardTitle>
                        {data && getHealthIcon(data.poolHealth)}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">{data?.poolHealth}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Connections</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.connections.total}</div>
                        <p className="text-xs text-muted-foreground">
                            {data?.connections.active} active, {data?.connections.idle} idle
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Utilization</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.connections.utilizationPercent.toFixed(1)}%</div>
                        <Progress
                            value={data?.connections.utilizationPercent}
                            className="mt-2"
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                        {data && getResponseTimeBadge(data.health.responseTimeStatus)}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.health.avgResponseTime}ms</div>
                    </CardContent>
                </Card>
            </div>

            {/* Connection Details */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Connection Pool Details</CardTitle>
                            <CardDescription>Real-time connection pool metrics and health status</CardDescription>
                        </div>
                        <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Connection Breakdown */}
                    <div>
                        <h4 className="text-sm font-medium mb-4">Connection Breakdown</h4>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Active Connections</span>
                                    <span className="font-medium">{data?.connections.active}</span>
                                </div>
                                <Progress
                                    value={(data?.connections.active || 0) / (data?.connections.total || 1) * 100}
                                    className="h-2"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Idle Connections</span>
                                    <span className="font-medium">{data?.connections.idle}</span>
                                </div>
                                <Progress
                                    value={(data?.connections.idle || 0) / (data?.connections.total || 1) * 100}
                                    className="h-2"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Waiting Requests</span>
                                    <span className="font-medium">{data?.connections.waiting}</span>
                                </div>
                                <Progress
                                    value={Math.min((data?.connections.waiting || 0) / 10 * 100, 100)}
                                    className="h-2"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Efficiency</span>
                                    <span className="font-medium">{data?.connections.efficiency.toFixed(1)}%</span>
                                </div>
                                <Progress
                                    value={data?.connections.efficiency}
                                    className="h-2"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Health Status */}
                    <div>
                        <h4 className="text-sm font-medium mb-4">Health Status</h4>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="flex items-center gap-2">
                                {data?.health.healthy ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className="text-sm">Pool Healthy</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {data?.health.primaryReachable ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className="text-sm">Primary Reachable</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span className="text-sm">{data?.health.replicasReachable} Replicas Reachable</span>
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
