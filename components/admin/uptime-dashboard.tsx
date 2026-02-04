/**
 * Uptime Dashboard Component
 *
 * Displays system uptime statistics and SLA compliance information.
 * Shows current status, uptime percentages, downtime incidents, and
 * historical trends.
 *
 * Features:
 * - Current system status indicator
 * - Uptime percentage for multiple time periods
 * - SLA compliance status (99.9% target)
 * - Downtime incident history
 * - Visual uptime trend chart
 *
 * @module components/admin/uptime-dashboard
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle, TrendingUp, Clock } from 'lucide-react';

interface UptimeStats {
    period: string;
    totalMinutes: number;
    uptimeMinutes: number;
    downtimeMinutes: number;
    uptimePercentage: number;
    slaCompliant: boolean;
    incidents: number;
    avgResponseTime: number;
}

interface DowntimeIncident {
    id: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    reason?: string;
    resolved: boolean;
}

interface UptimeData {
    currentStatus: 'UP' | 'DOWN' | 'DEGRADED';
    stats: UptimeStats;
    periods: {
        last24Hours: UptimeStats;
        last7Days: UptimeStats;
        last30Days: UptimeStats;
    };
    slaTarget: number;
    slaCompliant: boolean;
    incidents?: DowntimeIncident[];
}

export function UptimeDashboard() {
    const [uptimeData, setUptimeData] = useState<UptimeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showIncidents, setShowIncidents] = useState(false);

    useEffect(() => {
        fetchUptimeData();
        // Refresh every 60 seconds
        const interval = setInterval(fetchUptimeData, 60000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showIncidents]);

    async function fetchUptimeData() {
        try {
            const response = await fetch(
                `/api/v1/monitoring/uptime?period=30&includeIncidents=${showIncidents}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch uptime data');
            }

            const result = await response.json();
            setUptimeData(result.data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>System Uptime</CardTitle>
                    <CardDescription>Loading uptime statistics...</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (error || !uptimeData) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>System Uptime</CardTitle>
                    <CardDescription>Error loading uptime data</CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error || 'Failed to load uptime data'}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'UP':
                return <CheckCircle2 className="h-5 w-5 text-green-500" />;
            case 'DOWN':
                return <XCircle className="h-5 w-5 text-red-500" />;
            case 'DEGRADED':
                return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            default:
                return null;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'UP':
                return <Badge className="bg-green-500">Operational</Badge>;
            case 'DOWN':
                return <Badge variant="destructive">Down</Badge>;
            case 'DEGRADED':
                return <Badge className="bg-yellow-500">Degraded</Badge>;
            default:
                return <Badge variant="secondary">Unknown</Badge>;
        }
    };

    const formatUptime = (percentage: number) => {
        return percentage.toFixed(3) + '%';
    };

    const formatDuration = (minutes: number) => {
        if (minutes < 60) {
            return `${minutes}m`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    return (
        <div className="space-y-6">
            {/* Current Status */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>System Status</CardTitle>
                            <CardDescription>Current operational status</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            {getStatusIcon(uptimeData.currentStatus)}
                            {getStatusBadge(uptimeData.currentStatus)}
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* SLA Compliance */}
            <Card>
                <CardHeader>
                    <CardTitle>SLA Compliance</CardTitle>
                    <CardDescription>
                        Target: {uptimeData.slaTarget}% uptime (max 43.2 minutes downtime per month)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {uptimeData.slaCompliant ? (
                            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <AlertTitle className="text-green-700 dark:text-green-300">
                                    SLA Compliant
                                </AlertTitle>
                                <AlertDescription className="text-green-600 dark:text-green-400">
                                    System is meeting the 99.9% uptime target for the last 30 days.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Alert variant="destructive">
                                <XCircle className="h-4 w-4" />
                                <AlertTitle>SLA Not Met</AlertTitle>
                                <AlertDescription>
                                    System uptime is below the 99.9% target. Current: {formatUptime(uptimeData.stats.uptimePercentage)}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Uptime Statistics */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Last 24 Hours</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="text-2xl font-bold">
                                {formatUptime(uptimeData.periods.last24Hours.uptimePercentage)}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>
                                    {formatDuration(uptimeData.periods.last24Hours.downtimeMinutes)} downtime
                                </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {uptimeData.periods.last24Hours.incidents} incidents
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Last 7 Days</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="text-2xl font-bold">
                                {formatUptime(uptimeData.periods.last7Days.uptimePercentage)}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>
                                    {formatDuration(uptimeData.periods.last7Days.downtimeMinutes)} downtime
                                </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {uptimeData.periods.last7Days.incidents} incidents
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Last 30 Days</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="text-2xl font-bold">
                                {formatUptime(uptimeData.periods.last30Days.uptimePercentage)}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>
                                    {formatDuration(uptimeData.periods.last30Days.downtimeMinutes)} downtime
                                </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {uptimeData.periods.last30Days.incidents} incidents
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Metrics */}
            <Card>
                <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                    <CardDescription>Average response time and availability</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-muted-foreground">
                                Average Response Time
                            </div>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-blue-500" />
                                <span className="text-2xl font-bold">
                                    {uptimeData.stats.avgResponseTime.toFixed(0)}ms
                                </span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-muted-foreground">
                                Total Uptime (30 days)
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-2xl font-bold">
                                    {formatDuration(uptimeData.stats.uptimeMinutes)}
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Downtime Incidents */}
            {showIncidents && uptimeData.incidents && uptimeData.incidents.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Downtime Incidents</CardTitle>
                        <CardDescription>Last 30 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {uptimeData.incidents.map((incident) => (
                                <div
                                    key={incident.id}
                                    className="flex items-start justify-between border-b pb-4 last:border-0"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            {incident.resolved ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-red-500" />
                                            )}
                                            <span className="font-medium">
                                                {incident.resolved ? 'Resolved' : 'Ongoing'}
                                            </span>
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Started: {new Date(incident.startTime).toLocaleString()}
                                        </div>
                                        {incident.endTime && (
                                            <div className="text-sm text-muted-foreground">
                                                Ended: {new Date(incident.endTime).toLocaleString()}
                                            </div>
                                        )}
                                        {incident.reason && (
                                            <div className="text-sm text-muted-foreground">
                                                Reason: {incident.reason}
                                            </div>
                                        )}
                                    </div>
                                    {incident.duration && (
                                        <Badge variant="outline">
                                            {formatDuration(incident.duration)}
                                        </Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Toggle Incidents */}
            <div className="flex justify-center">
                <button
                    onClick={() => setShowIncidents(!showIncidents)}
                    className="text-sm text-blue-500 hover:text-blue-600 underline"
                >
                    {showIncidents ? 'Hide' : 'Show'} Downtime Incidents
                </button>
            </div>
        </div>
    );
}
