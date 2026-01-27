"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Activity,
    Clock,
    AlertCircle,
    CheckCircle2,
    XCircle,
    TrendingUp,
    TrendingDown,
    Database,
    Settings,
    AlertTriangle,
    RefreshCw,
    Eye,
    Filter,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LifecycleVisualizer from "./lifecycle-visualizer";
import { ScrapingSessionData } from "@/lib/types/admin-dashboard";
import { ExportButton } from "./export-button";

interface TenantDebugViewProps {
    tenantId: string;
    refreshInterval?: number; // default: 10000ms
}

// Type definitions for tenant debug data
interface TenantDebugData {
    tenant: {
        id: string;
        name: string;
        planType: string;
        createdAt: Date;
    };
    activeSessions: Array<{
        id: string;
        siteUrl: string;
        targetUrl: string;
        status: string;
        currentStage: string;
        startTime: Date;
        proxyUsed: string | null;
    }>;
    recentErrors: Array<{
        type: string;
        count: number;
        recentErrors: Array<{
            sessionId: string;
            timestamp: Date;
            message: string;
            siteUrl: string;
        }>;
    }>;
    metrics: {
        tenantId: string;
        tenantName: string;
        activeSessions: number;
        successRate: number;
        avgScrapeTime: number;
        dataQualityScore: number;
        resourceUsage: {
            requestsToday: number;
            quotaLimit: number;
            quotaUsed: number;
        };
    };
    configuration: {
        sites: Array<{
            id: string;
            type: string;
            platform: string;
            baseUrl: string;
            lastSyncAt: Date | null;
            isStale: boolean;
        }>;
    };
    impactAssessment: {
        affectedSites: string[];
        staleSitesCount: number;
        failureRate: number;
        businessImpact: "high" | "medium" | "low";
    };
    staleSites: Array<{
        id: string;
        type: string;
        baseUrl: string;
        lastSyncAt: Date | null;
        hoursSinceLastSync: number | null;
    }>;
}

// Error type badge component
function ErrorTypeBadge({ type, count }: { type: string; count: number }) {
    const typeConfig: Record<string, { color: string; label: string; icon: any }> = {
        proxy_failure: {
            color: "text-red-500 bg-red-500/10 border-red-500/20",
            label: "Proxy Failure",
            icon: AlertCircle,
        },
        challenge_failure: {
            color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
            label: "Challenge Failure",
            icon: AlertTriangle,
        },
        parsing_error: {
            color: "text-orange-500 bg-orange-500/10 border-orange-500/20",
            label: "Parsing Error",
            icon: XCircle,
        },
        rate_limit: {
            color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
            label: "Rate Limit",
            icon: Clock,
        },
        network_error: {
            color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
            label: "Network Error",
            icon: Activity,
        },
        other: {
            color: "text-gray-500 bg-gray-500/10 border-gray-500/20",
            label: "Other",
            icon: AlertCircle,
        },
    };

    const config = typeConfig[type] || typeConfig.other;
    const Icon = config.icon;

    return (
        <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", config.color)}>
            <Icon className="w-4 h-4" />
            <div className="flex-1">
                <p className="text-xs font-medium">{config.label}</p>
                <p className="text-xs opacity-70">{count} occurrence{count !== 1 ? 's' : ''}</p>
            </div>
        </div>
    );
}

// Impact indicator component
function ImpactIndicator({ impact }: { impact: "high" | "medium" | "low" }) {
    const config = {
        high: {
            color: "text-red-500 bg-red-500/10 border-red-500/20",
            icon: TrendingDown,
            label: "High Impact",
        },
        medium: {
            color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
            icon: Activity,
            label: "Medium Impact",
        },
        low: {
            color: "text-green-500 bg-green-500/10 border-green-500/20",
            icon: TrendingUp,
            label: "Low Impact",
        },
    };

    const impactConfig = config[impact];
    const Icon = impactConfig.icon;

    return (
        <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md border", impactConfig.color)}>
            <Icon className="w-4 h-4" />
            <span className="text-xs font-medium">{impactConfig.label}</span>
        </div>
    );
}

// Session detail modal component
function SessionDetailModal({
    sessionId,
    open,
    onOpenChange,
}: {
    sessionId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [session, setSession] = useState<ScrapingSessionData | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (sessionId && open) {
            const loadSession = async () => {
                setLoading(true);
                try {
                    const res = await fetch(`/api/v1/admin/sessions/${sessionId}`);
                    const data = await res.json();
                    if (data.success) {
                        setSession(data.data);
                    }
                } catch (err) {
                    console.error("Failed to fetch session:", err);
                } finally {
                    setLoading(false);
                }
            };
            loadSession();
        }
    }, [sessionId, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Session Details</DialogTitle>
                    <DialogDescription>
                        {session ? `${session.tenantName} • ${session.siteUrl}` : "Loading..."}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[75vh] pr-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : session ? (
                        <LifecycleVisualizer session={session} />
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            Failed to load session details
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

// Main TenantDebugView component
export default function TenantDebugView({
    tenantId,
    refreshInterval = 10000,
}: TenantDebugViewProps) {
    const [data, setData] = useState<TenantDebugData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [sessionFilter, setSessionFilter] = useState<string>("all");
    const [expandedErrorTypes, setExpandedErrorTypes] = useState<Set<string>>(new Set());

    // Fetch tenant debug data
    const fetchData = useCallback(async () => {
        try {
            const response = await fetch(`/api/v1/admin/debug/tenant/${tenantId}`);
            if (!response.ok) {
                throw new Error("Failed to fetch tenant debug data");
            }

            const result = await response.json();
            if (result.success) {
                setData(result.data);
                setLastUpdate(new Date());
                setError(null);
            } else {
                throw new Error(result.error || "Unknown error");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch data");
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    // Initial fetch and auto-refresh
    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, refreshInterval);
        return () => clearInterval(interval);
    }, [fetchData, refreshInterval]);

    // Handle session click
    const handleSessionClick = (sessionId: string) => {
        setSelectedSessionId(sessionId);
        setIsDetailModalOpen(true);
    };

    // Toggle error type expansion
    const toggleErrorType = (type: string) => {
        setExpandedErrorTypes((prev) => {
            const next = new Set(prev);
            if (next.has(type)) {
                next.delete(type);
            } else {
                next.add(type);
            }
            return next;
        });
    };

    // Format time helper
    const formatTime = (date: Date | null) => {
        if (!date) return "Never";
        const now = new Date();
        const diff = now.getTime() - new Date(date).getTime();
        if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <Card className="p-6 bg-red-500/10 border-red-500/20">
                <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-sm text-red-500">{error || "No data available"}</p>
                </div>
            </Card>
        );
    }

    // Filter sessions
    const filteredSessions =
        sessionFilter === "all"
            ? data.activeSessions
            : data.activeSessions.filter((s) => s.status === sessionFilter);

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">
                        {data.tenant.name} - Debug View
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Last updated: {lastUpdate.toLocaleTimeString()} • Plan: {data.tenant.planType}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <ExportButton
                        type="errors"
                        filters={{ tenantId }}
                        label="Export Errors"
                        variant="outline"
                        size="sm"
                    />
                    <Button variant="outline" size="sm" onClick={fetchData}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Impact Assessment */}
            <Card className="p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-4">
                            Impact Assessment
                        </h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Failure Rate</p>
                                <p className="text-2xl font-bold text-foreground">
                                    {data.impactAssessment.failureRate}%
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Affected Sites</p>
                                <p className="text-2xl font-bold text-foreground">
                                    {data.impactAssessment.affectedSites.length}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Stale Sites</p>
                                <p className="text-2xl font-bold text-foreground">
                                    {data.impactAssessment.staleSitesCount}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Business Impact</p>
                                <ImpactIndicator impact={data.impactAssessment.businessImpact} />
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Metrics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10">
                            <Activity className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Active Sessions</p>
                            <p className="text-2xl font-bold">{data.metrics.activeSessions}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Success Rate</p>
                            <p className="text-2xl font-bold">{data.metrics.successRate.toFixed(1)}%</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10">
                            <Clock className="w-5 h-5 text-purple-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Avg Scrape Time</p>
                            <p className="text-2xl font-bold">{data.metrics.avgScrapeTime.toFixed(1)}s</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-500/10">
                            <Database className="w-5 h-5 text-orange-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Data Quality</p>
                            <p className="text-2xl font-bold">{data.metrics.dataQualityScore.toFixed(1)}%</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Resource Usage */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Resource Usage</h3>
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Requests Today</span>
                            <span className="text-sm font-medium">
                                {data.metrics.resourceUsage.requestsToday} /{" "}
                                {data.metrics.resourceUsage.quotaLimit}
                            </span>
                        </div>
                        <Progress
                            value={
                                (data.metrics.resourceUsage.requestsToday /
                                    Math.max(data.metrics.resourceUsage.quotaLimit, 1)) *
                                100
                            }
                            className="h-2"
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Quota Used</span>
                            <span className="text-sm font-medium">
                                {data.metrics.resourceUsage.quotaUsed.toFixed(1)}%
                            </span>
                        </div>
                        <Progress value={data.metrics.resourceUsage.quotaUsed} className="h-2" />
                    </div>
                </div>
            </Card>

            {/* Tabbed Content */}
            <Tabs defaultValue="sessions" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="sessions">
                        Sessions
                        {data.activeSessions.length > 0 && (
                            <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                                {data.activeSessions.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="errors">
                        Errors
                        {data.recentErrors.reduce((sum, e) => sum + e.count, 0) > 0 && (
                            <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                                {data.recentErrors.reduce((sum, e) => sum + e.count, 0)}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="configuration">Configuration</TabsTrigger>
                    <TabsTrigger value="stale-data">
                        Stale Data
                        {data.staleSites.length > 0 && (
                            <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                                {data.staleSites.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* Sessions Tab */}
                <TabsContent value="sessions" className="space-y-4">
                    <Card>
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Active Sessions</h3>
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-muted-foreground" />
                                <Select value={sessionFilter} onValueChange={setSessionFilter}>
                                    <SelectTrigger className="w-[150px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="initializing">Initializing</SelectItem>
                                        <SelectItem value="running">Running</SelectItem>
                                        <SelectItem value="waiting_challenge">Challenge</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="failed">Failed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {filteredSessions.length === 0 ? (
                            <div className="p-12 text-center">
                                <Activity className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                                <p className="text-sm text-muted-foreground mt-2">
                                    No sessions found
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {filteredSessions.map((session) => (
                                    <div
                                        key={session.id}
                                        className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                                        onClick={() => handleSessionClick(session.id)}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <Badge
                                                        variant={
                                                            session.status === "completed"
                                                                ? "default"
                                                                : session.status === "failed"
                                                                    ? "destructive"
                                                                    : "secondary"
                                                        }
                                                        className="capitalize"
                                                    >
                                                        {session.status.replace("_", " ")}
                                                    </Badge>
                                                    <span className="text-sm font-medium">
                                                        {session.siteUrl}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{formatTime(session.startTime)}</span>
                                                    {session.proxyUsed && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="font-mono">
                                                                {session.proxyUsed}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>

                                                <p className="text-xs text-muted-foreground truncate">
                                                    {session.targetUrl}
                                                </p>
                                            </div>

                                            <Button variant="ghost" size="sm">
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>

                {/* Errors Tab */}
                <TabsContent value="errors" className="space-y-4">
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-foreground mb-4">
                            Recent Errors (Grouped by Type)
                        </h3>

                        {data.recentErrors.length === 0 ||
                            data.recentErrors.every((e) => e.count === 0) ? (
                            <div className="flex items-center gap-3 text-muted-foreground py-8">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                <p className="text-sm">No errors detected in recent sessions</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data.recentErrors
                                    .filter((errorGroup) => errorGroup.count > 0)
                                    .map((errorGroup) => (
                                        <div key={errorGroup.type} className="space-y-2">
                                            <button
                                                onClick={() => toggleErrorType(errorGroup.type)}
                                                className="w-full"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <ErrorTypeBadge
                                                        type={errorGroup.type}
                                                        count={errorGroup.count}
                                                    />
                                                    {expandedErrorTypes.has(errorGroup.type) ? (
                                                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                    )}
                                                </div>
                                            </button>

                                            {expandedErrorTypes.has(errorGroup.type) && (
                                                <div className="ml-4 space-y-2 mt-2">
                                                    {errorGroup.recentErrors.map((error, idx) => (
                                                        <Card
                                                            key={idx}
                                                            className="p-3 bg-muted/50 border-muted"
                                                        >
                                                            <div className="space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-xs font-medium text-foreground">
                                                                        {error.message}
                                                                    </p>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="text-xs"
                                                                    >
                                                                        {formatTime(error.timestamp)}
                                                                    </Badge>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Site: {error.siteUrl}
                                                                </p>
                                                                <button
                                                                    onClick={() =>
                                                                        handleSessionClick(
                                                                            error.sessionId
                                                                        )
                                                                    }
                                                                    className="text-xs text-primary hover:underline"
                                                                >
                                                                    View session details →
                                                                </button>
                                                            </div>
                                                        </Card>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>

                {/* Configuration Tab */}
                <TabsContent value="configuration" className="space-y-4">
                    <Card className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Settings className="w-5 h-5 text-muted-foreground" />
                            <h3 className="text-lg font-semibold text-foreground">
                                Site Configuration
                            </h3>
                        </div>

                        {data.configuration.sites.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p className="text-sm">No sites configured</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data.configuration.sites.map((site) => (
                                    <Card
                                        key={site.id}
                                        className={cn(
                                            "p-4",
                                            site.isStale && "border-yellow-500/50 bg-yellow-500/5"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="capitalize">
                                                        {site.type}
                                                    </Badge>
                                                    <Badge variant="secondary" className="capitalize">
                                                        {site.platform}
                                                    </Badge>
                                                    {site.isStale && (
                                                        <Badge
                                                            variant="destructive"
                                                            className="flex items-center gap-1"
                                                        >
                                                            <AlertTriangle className="w-3 h-3" />
                                                            Stale
                                                        </Badge>
                                                    )}
                                                </div>

                                                <p className="text-sm font-medium text-foreground">
                                                    {site.baseUrl}
                                                </p>

                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Clock className="w-3 h-3" />
                                                    <span>
                                                        Last sync: {formatTime(site.lastSyncAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>

                {/* Stale Data Tab */}
                <TabsContent value="stale-data" className="space-y-4">
                    <Card className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                            <h3 className="text-lg font-semibold text-foreground">
                                Stale Data Highlights
                            </h3>
                        </div>

                        {data.staleSites.length === 0 ? (
                            <div className="flex items-center gap-3 text-muted-foreground py-8">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                <p className="text-sm">All sites are up to date</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data.staleSites.map((site) => (
                                    <Card
                                        key={site.id}
                                        className="p-4 border-yellow-500/50 bg-yellow-500/5"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="capitalize">
                                                        {site.type}
                                                    </Badge>
                                                    <Badge
                                                        variant="destructive"
                                                        className="flex items-center gap-1"
                                                    >
                                                        <AlertTriangle className="w-3 h-3" />
                                                        {site.hoursSinceLastSync
                                                            ? `${site.hoursSinceLastSync}h stale`
                                                            : "Never synced"}
                                                    </Badge>
                                                </div>

                                                <p className="text-sm font-medium text-foreground">
                                                    {site.baseUrl}
                                                </p>

                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Clock className="w-3 h-3" />
                                                    <span>
                                                        Last sync: {formatTime(site.lastSyncAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Session Detail Modal */}
            <SessionDetailModal
                sessionId={selectedSessionId}
                open={isDetailModalOpen}
                onOpenChange={setIsDetailModalOpen}
            />
        </div>
    );
}
