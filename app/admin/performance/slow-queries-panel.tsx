"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface SlowQuery {
    query: string;
    avgExecutionTime: number;
    maxExecutionTime: number;
    executionCount: number;
    lastExecuted: string;
    performanceRating: 'acceptable' | 'warning' | 'critical';
}

interface SlowQueriesData {
    healthStatus: 'healthy' | 'warning' | 'critical';
    queries: SlowQuery[];
    summary: {
        totalSlowQueries: number;
        avgExecutionTime: number;
        maxExecutionTime: number;
        timeRange: {
            start: string;
            end: string;
            days: number;
        };
    };
}

export function SlowQueriesPanel() {
    const [data, setData] = useState<SlowQueriesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/v1/admin/performance/slow-queries?limit=20&days=7');
            if (!res.ok) throw new Error('Failed to fetch slow queries');
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
        const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
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

    const getRatingBadge = (rating: string) => {
        switch (rating) {
            case 'acceptable': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Acceptable</Badge>;
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
                        <p className="text-sm text-muted-foreground">Loading slow queries...</p>
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
                        <CardTitle className="text-sm font-medium">Health Status</CardTitle>
                        {data && getHealthIcon(data.healthStatus)}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">{data?.healthStatus}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Slow Queries</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.summary.totalSlowQueries.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Last {data?.summary.timeRange.days} days</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Execution Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.summary.avgExecutionTime}ms</div>
                        <p className="text-xs text-muted-foreground">Across all queries</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Max Execution Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.summary.maxExecutionTime}ms</div>
                        <p className="text-xs text-muted-foreground">Slowest query</p>
                    </CardContent>
                </Card>
            </div>

            {/* Queries Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Slow Queries</CardTitle>
                            <CardDescription>Top 20 slowest queries by average execution time</CardDescription>
                        </div>
                        <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {data?.queries.map((query, index) => (
                            <div key={index} className="border rounded-lg p-4 space-y-2">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <code className="text-xs bg-muted p-2 rounded block overflow-x-auto">
                                            {query.query.length > 200 ? query.query.substring(0, 200) + '...' : query.query}
                                        </code>
                                    </div>
                                    {getRatingBadge(query.performanceRating)}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Avg Time:</span>
                                        <span className="ml-2 font-medium">{query.avgExecutionTime}ms</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Max Time:</span>
                                        <span className="ml-2 font-medium">{query.maxExecutionTime}ms</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Executions:</span>
                                        <span className="ml-2 font-medium">{query.executionCount.toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Last Run:</span>
                                        <span className="ml-2 font-medium">
                                            {new Date(query.lastExecuted).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
