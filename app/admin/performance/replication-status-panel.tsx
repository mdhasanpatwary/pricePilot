"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, GitBranch } from "lucide-react";

interface Replica {
    id: string;
    healthy: boolean;
    lagSeconds: number;
    lagStatus: 'good' | 'warning' | 'critical';
    lastCheck: string;
}

interface ReplicationStatusData {
    overallStatus: 'healthy' | 'warning' | 'critical';
    replicas: Replica[];
    routing: {
        primaryQueries: number;
        replicaQueries: number;
        totalQueries: number;
        replicaQueryPercent: string;
        failoverCount: number;
    };
    metrics: {
        totalReplicas: number;
        healthyReplicas: number;
        unhealthyReplicas: number;
        avgReplicationLag: number;
        maxReplicationLag: number;
        minReplicationLag: number;
    };
}

export function ReplicationStatusPanel() {
    const [data, setData] = useState<ReplicationStatusData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/v1/admin/performance/replication-status');
            if (!res.ok) throw new Error('Failed to fetch replication status');
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
        const interval = setInterval(fetchData, 15000); // Refresh every 15 seconds
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

    const getLagBadge = (status: string) => {
        switch (status) {
            case 'good': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Good</Badge>;
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
                        <p className="text-sm text-muted-foreground">Loading replication status...</p>
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
                        <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
                        {data && getHealthIcon(data.overallStatus)}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">{data?.overallStatus}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Healthy Replicas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {data?.metrics.healthyReplicas} / {data?.metrics.totalReplicas}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {data?.metrics.unhealthyReplicas} unhealthy
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Replication Lag</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.metrics.avgReplicationLag.toFixed(2)}s</div>
                        <p className="text-xs text-muted-foreground">
                            Max: {data?.metrics.maxReplicationLag}s
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Replica Queries</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.routing.replicaQueryPercent}%</div>
                        <p className="text-xs text-muted-foreground">
                            {data?.routing.replicaQueries.toLocaleString()} queries
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Replica Details */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Read Replicas</CardTitle>
                            <CardDescription>Individual replica health and replication lag status</CardDescription>
                        </div>
                        <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {data?.replicas.map((replica, index) => (
                            <div key={index} className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <GitBranch className="w-5 h-5 text-muted-foreground" />
                                        <div>
                                            <h4 className="font-medium">{replica.id}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Last checked: {new Date(replica.lastCheck).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getLagBadge(replica.lagStatus)}
                                        {replica.healthy ? (
                                            <CheckCircle className="w-5 h-5 text-green-500" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-500" />
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Status:</span>
                                        <span className="ml-2 font-medium">
                                            {replica.healthy ? 'Healthy' : 'Unhealthy'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Lag:</span>
                                        <span className="ml-2 font-medium">{replica.lagSeconds}s</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Lag Status:</span>
                                        <span className="ml-2 font-medium capitalize">{replica.lagStatus}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {data?.replicas.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No read replicas configured
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Query Routing Stats */}
            <Card>
                <CardHeader>
                    <CardTitle>Query Routing Statistics</CardTitle>
                    <CardDescription>Distribution of queries between primary and replicas</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="border rounded-lg p-4">
                                <div className="text-2xl font-bold">{data?.routing.totalQueries.toLocaleString()}</div>
                                <p className="text-sm text-muted-foreground mt-1">Total Queries</p>
                            </div>
                            <div className="border rounded-lg p-4">
                                <div className="text-2xl font-bold">{data?.routing.primaryQueries.toLocaleString()}</div>
                                <p className="text-sm text-muted-foreground mt-1">Primary Queries</p>
                            </div>
                            <div className="border rounded-lg p-4">
                                <div className="text-2xl font-bold">{data?.routing.replicaQueries.toLocaleString()}</div>
                                <p className="text-sm text-muted-foreground mt-1">Replica Queries</p>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-muted-foreground">Replica Query Distribution</span>
                                <span className="font-medium">{data?.routing.replicaQueryPercent}%</span>
                            </div>
                            <div className="h-4 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 transition-all"
                                    style={{ width: `${data?.routing.replicaQueryPercent}%` }}
                                />
                            </div>
                        </div>

                        {data && data.routing.failoverCount > 0 && (
                            <div className="border-l-4 border-yellow-500 bg-yellow-50 p-4 rounded">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium">
                                            {data.routing.failoverCount} failover{data.routing.failoverCount !== 1 ? 's' : ''} detected
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Queries were routed to primary due to replica unavailability or high lag
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
