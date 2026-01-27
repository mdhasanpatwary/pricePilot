/**
 * Enhanced RealTimeMonitor with improved error handling and loading states
 * This is an example of how to use the new error handling utilities
 */

"use client";

import { useState, useCallback } from "react";
import {
    Activity,
    Clock,
    AlertCircle,
    CheckCircle2,
    Loader2,
    XCircle,
    Pause,
    Filter,
    RefreshCw,
    Eye,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
    ScrapingSessionData,
    SessionStatus,
    SessionStage,
} from "@/lib/types/admin-dashboard";
import LifecycleVisualizer from "./lifecycle-visualizer";
import SessionControlPanel from "./session-control-panel";
import { ExportButton } from "./export-button";
import { useFetch } from "@/lib/hooks/useFetch";
import { LoadingSpinner } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { safeArray, safeRelativeTime } from "@/lib/utils/graceful-degradation";
import { toast } from "sonner";

interface RealTimeMonitorProps {
    refreshInterval?: number;
    tenantFilter?: string;
    showControls?: boolean;
}

// Status indicator component
function StatusIndicator({ status }: { status: SessionStatus }) {
    const statusConfig = {
        initializing: {
            icon: Loader2,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            label: "Initializing",
            animate: true,
        },
        running: {
            icon: Activity,
            color: "text-green-500",
            bg: "bg-green-500/10",
            label: "Running",
            animate: true,
        },
        waiting_challenge: {
            icon: Pause,
            color: "text-yellow-500",
            bg: "bg-yellow-500/10",
            label: "Challenge",
            animate: false,
        },
        completed: {
            icon: CheckCircle2,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            label: "Completed",
            animate: false,
        },
        failed: {
            icon: XCircle,
            color: "text-red-500",
            bg: "bg-red-500/10",
            label: "Failed",
            animate: false,
        },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
        <div className={cn("flex items-center gap-2 px-2 py-1 rounded-md", config.bg)}>
            <Icon
                className={cn("w-4 h-4", config.color, config.animate && "animate-spin")}
            />
            <span className={cn("text-xs font-medium", config.color)}>
                {config.label}
            </span>
        </div>
    );
}

// Lifecycle stage visualization component
function LifecycleStage({ stage }: { stage: SessionStage }) {
    const stages: SessionStage[] = [
        "proxy_selection",
        "navigation",
        "challenge_detection",
        "challenge_solving",
        "data_extraction",
        "validation",
    ];

    const stageLabels: Record<SessionStage, string> = {
        proxy_selection: "Proxy",
        navigation: "Navigate",
        challenge_detection: "Detect",
        challenge_solving: "Solve",
        data_extraction: "Extract",
        validation: "Validate",
    };

    const currentIndex = stages.indexOf(stage);

    return (
        <div className="flex items-center gap-1">
            {stages.map((s, index) => (
                <div key={s} className="flex items-center">
                    <div
                        className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                            index <= currentIndex
                                ? "bg-primary/20 text-primary"
                                : "bg-muted text-muted-foreground"
                        )}
                    >
                        {stageLabels[s]}
                    </div>
                    {index < stages.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-muted-foreground mx-0.5" />
                    )}
                </div>
            ))}
        </div>
    );
}

// Session detail modal component
function SessionDetailModal({
    session,
    open,
    onOpenChange,
}: {
    session: ScrapingSessionData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    if (!session) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Session Details
                        <StatusIndicator status={session.status} />
                    </DialogTitle>
                    <DialogDescription>
                        {session.tenantName} • {session.siteUrl}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[75vh] pr-4">
                    <LifecycleVisualizer session={session} />
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

export default function RealTimeMonitorEnhanced({
    refreshInterval = 5000,
    tenantFilter,
    showControls = false,
}: RealTimeMonitorProps) {
    const [selectedTenant, setSelectedTenant] = useState<string>(tenantFilter || "all");
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const [selectedSession, setSelectedSession] = useState<ScrapingSessionData | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    // Build API URL with filters
    const buildUrl = useCallback(() => {
        const params = new URLSearchParams();
        if (selectedTenant && selectedTenant !== "all") {
            params.append("tenantId", selectedTenant);
        }
        if (selectedStatus && selectedStatus !== "all") {
            params.append("status", selectedStatus);
        }
        return `/api/v1/admin/sessions?${params.toString()}`;
    }, [selectedTenant, selectedStatus]);

    // Use the useFetch hook with automatic retry and error handling
    const {
        data: sessionData,
        loading,
        error,
        refetch,
    } = useFetch<{ sessions: ScrapingSessionData[]; summary: any }>(
        buildUrl(),
        {
            refetchInterval: refreshInterval,
            retries: 2,
            showErrorToast: false, // We'll handle errors manually
            onSuccess: () => {
                setLastUpdate(new Date());
            },
            onError: (err) => {
                // Only show toast on error, not on every retry
                console.error("Failed to fetch sessions:", err);
            },
        }
    );

    const sessions = safeArray<ScrapingSessionData>(sessionData?.sessions, []);
    const statusCounts = sessionData?.summary?.statusCounts || {};

    // Handle session click
    const handleSessionClick = (session: ScrapingSessionData) => {
        setSelectedSession(session);
        setIsDetailModalOpen(true);
    };

    // Manual refresh with toast feedback
    const handleManualRefresh = async () => {
        try {
            await refetch();
            toast.success("Sessions refreshed");
        } catch (err) {
            toast.error("Failed to refresh sessions");
        }
    };

    // Get unique tenants from sessions
    const uniqueTenants = Array.from(
        new Set(sessions.map((s) => s.tenantId))
    ).map((id) => {
        const session = sessions.find((s) => s.tenantId === id);
        return { id, name: session?.tenantName || id };
    });

    return (
        <div className="space-y-6">
            {/* Header with filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">
                        Real-Time Session Monitor
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Last updated: {lastUpdate.toLocaleTimeString()}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <ExportButton
                        type="sessions"
                        filters={{
                            tenantId: selectedTenant !== "all" ? selectedTenant : undefined,
                            status: selectedStatus !== "all" ? selectedStatus : undefined,
                        }}
                        label="Export Sessions"
                        variant="outline"
                        size="sm"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManualRefresh}
                        disabled={loading}
                    >
                        <RefreshCw
                            className={cn("w-4 h-4 mr-2", loading && "animate-spin")}
                        />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Session Control Panel */}
            {showControls && (
                <SessionControlPanel
                    sessions={sessions}
                    onOperationComplete={refetch}
                />
            )}

            {/* Filters */}
            <Card className="p-4">
                <div className="flex items-center gap-4">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Tenant:</span>
                            <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Tenants</SelectItem>
                                    {uniqueTenants.map((tenant) => (
                                        <SelectItem key={tenant.id} value={tenant.id}>
                                            {tenant.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Status:</span>
                            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                <SelectTrigger className="w-[180px]">
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
                </div>
            </Card>

            {/* Status Summary */}
            {Object.keys(statusCounts).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {Object.entries(statusCounts).map(([status, count]) => (
                        <Card key={status} className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase">
                                        {status.replace("_", " ")}
                                    </p>
                                    <p className="text-2xl font-bold mt-1">{count as number}</p>
                                </div>
                                <StatusIndicator status={status as SessionStatus} />
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Error State */}
            {error && (
                <Card className="p-4 bg-red-500/10 border-red-500/20">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <p className="text-sm text-red-500">{error}</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleManualRefresh}
                        >
                            Retry
                        </Button>
                    </div>
                </Card>
            )}

            {/* Sessions List */}
            <Card>
                <div className="p-4 border-b border-border">
                    <h3 className="text-lg font-semibold">
                        Active Sessions ({sessions.length})
                    </h3>
                </div>

                {loading && sessions.length === 0 ? (
                    <LoadingSpinner message="Loading sessions..." />
                ) : sessions.length === 0 ? (
                    <EmptyState
                        icon={Activity}
                        title="No active sessions found"
                        description="There are currently no scraping sessions matching your filters."
                        action={{
                            label: "Refresh",
                            onClick: handleManualRefresh,
                        }}
                    />
                ) : (
                    <div className="divide-y divide-border">
                        {sessions.map((session) => (
                            <div
                                key={session.id}
                                className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => handleSessionClick(session)}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex items-center gap-3">
                                            <StatusIndicator status={session.status} />
                                            <span className="text-sm font-medium text-foreground">
                                                {session.tenantName}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {session.siteUrl}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Clock className="w-3 h-3" />
                                            <span>{safeRelativeTime(session.startTime)}</span>
                                            {session.proxyUsed && (
                                                <>
                                                    <span>•</span>
                                                    <span className="font-mono">{session.proxyUsed}</span>
                                                </>
                                            )}
                                            {session.challengeType && (
                                                <>
                                                    <span>•</span>
                                                    <AlertCircle className="w-3 h-3 text-yellow-500" />
                                                    <span className="text-yellow-500">
                                                        {session.challengeType}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        <LifecycleStage stage={session.currentStage} />

                                        {session.errors && session.errors.length > 0 && (
                                            <div className="flex items-center gap-2 text-xs text-red-500">
                                                <XCircle className="w-3 h-3" />
                                                <span>{session.errors.length} error(s)</span>
                                            </div>
                                        )}
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

            {/* Session Detail Modal */}
            <SessionDetailModal
                session={selectedSession}
                open={isDetailModalOpen}
                onOpenChange={setIsDetailModalOpen}
            />
        </div>
    );
}
