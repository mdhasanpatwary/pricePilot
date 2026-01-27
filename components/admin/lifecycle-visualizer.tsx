"use client";

import { useState } from "react";
import {
    Activity,
    Clock,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Globe,
    Shield,
    Database,
    CheckSquare,
    AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ScrapingSessionData,
    SessionStage,
    SessionStatus,
} from "@/lib/types/admin-dashboard";

interface LifecycleVisualizerProps {
    session: ScrapingSessionData;
    className?: string;
}

// Stage configuration with icons, colors, and labels
const STAGE_CONFIG: Record<
    SessionStage,
    {
        icon: React.ComponentType<{ className?: string }>;
        label: string;
        description: string;
        color: string;
        bgColor: string;
    }
> = {
    proxy_selection: {
        icon: Globe,
        label: "Proxy Selection",
        description: "Selecting optimal proxy for the request",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
    },
    navigation: {
        icon: Activity,
        label: "Navigation",
        description: "Navigating to target URL",
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
    },
    challenge_detection: {
        icon: Shield,
        label: "Challenge Detection",
        description: "Detecting anti-bot challenges",
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
    },
    challenge_solving: {
        icon: AlertTriangle,
        label: "Challenge Solving",
        description: "Solving detected challenges",
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
    },
    data_extraction: {
        icon: Database,
        label: "Data Extraction",
        description: "Extracting data from page",
        color: "text-green-500",
        bgColor: "bg-green-500/10",
    },
    validation: {
        icon: CheckSquare,
        label: "Validation",
        description: "Validating extracted data",
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
    },
};

// Stage order for timeline
const STAGE_ORDER: SessionStage[] = [
    "proxy_selection",
    "navigation",
    "challenge_detection",
    "challenge_solving",
    "data_extraction",
    "validation",
];

// Format duration helper
function formatDuration(ms: number): string {
    if (ms === 0) return "0ms";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
}

// Format timestamp helper
function formatTimestamp(date: Date): string {
    return new Date(date).toLocaleTimeString();
}

// Stage Timeline Component
function StageTimeline({
    currentStage,
    status,
}: {
    currentStage: SessionStage;
    status: SessionStatus;
}) {
    const currentIndex = STAGE_ORDER.indexOf(currentStage);
    const isCompleted = status === "completed";
    const isFailed = status === "failed";

    return (
        <div className="relative">
            <div className="flex items-center justify-between">
                {STAGE_ORDER.map((stage, index) => {
                    const config = STAGE_CONFIG[stage];
                    const Icon = config.icon;
                    const isPast = index < currentIndex;
                    const isCurrent = index === currentIndex;

                    // Determine stage state
                    let stageState: "completed" | "current" | "failed" | "pending" =
                        "pending";
                    if (isPast || (isCurrent && isCompleted)) {
                        stageState = "completed";
                    } else if (isCurrent) {
                        stageState = isFailed ? "failed" : "current";
                    }

                    return (
                        <div key={stage} className="flex items-center flex-1">
                            <div className="flex flex-col items-center flex-1">
                                {/* Stage Icon */}
                                <div
                                    className={cn(
                                        "relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all",
                                        stageState === "completed" &&
                                        "bg-green-500/20 border-green-500",
                                        stageState === "current" &&
                                        "bg-primary/20 border-primary animate-pulse",
                                        stageState === "failed" &&
                                        "bg-red-500/20 border-red-500",
                                        stageState === "pending" &&
                                        "bg-muted border-muted-foreground/20"
                                    )}
                                >
                                    {stageState === "completed" ? (
                                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                                    ) : stageState === "failed" ? (
                                        <XCircle className="w-6 h-6 text-red-500" />
                                    ) : stageState === "current" ? (
                                        <Icon className={cn("w-6 h-6", config.color)} />
                                    ) : (
                                        <Icon className="w-6 h-6 text-muted-foreground" />
                                    )}
                                </div>

                                {/* Stage Label */}
                                <div className="mt-2 text-center">
                                    <p
                                        className={cn(
                                            "text-xs font-medium",
                                            stageState === "completed" && "text-green-500",
                                            stageState === "current" && "text-primary",
                                            stageState === "failed" && "text-red-500",
                                            stageState === "pending" &&
                                            "text-muted-foreground"
                                        )}
                                    >
                                        {config.label}
                                    </p>
                                </div>
                            </div>

                            {/* Connector Line */}
                            {index < STAGE_ORDER.length - 1 && (
                                <div
                                    className={cn(
                                        "h-0.5 flex-1 transition-all",
                                        isPast || (isCurrent && isCompleted)
                                            ? "bg-green-500"
                                            : "bg-muted-foreground/20"
                                    )}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Stage Detail Panel Component
function StageDetailPanel({ session }: { session: ScrapingSessionData }) {
    const config = STAGE_CONFIG[session.currentStage];
    const Icon = config.icon;

    return (
        <Card className={cn("p-6", config.bgColor)}>
            <div className="flex items-start gap-4">
                <div
                    className={cn(
                        "flex items-center justify-center w-12 h-12 rounded-lg",
                        config.bgColor
                    )}
                >
                    <Icon className={cn("w-6 h-6", config.color)} />
                </div>

                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">
                        {config.label}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {config.description}
                    </p>

                    {/* Stage-specific details */}
                    <div className="mt-4 space-y-3">
                        {session.currentStage === "proxy_selection" && session.proxyUsed && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Selected Proxy:</span>
                                <code className="px-2 py-1 bg-background rounded text-xs font-mono">
                                    {session.proxyUsed}
                                </code>
                            </div>
                        )}

                        {session.currentStage === "navigation" && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-muted-foreground">Target URL:</span>
                                    <code className="px-2 py-1 bg-background rounded text-xs font-mono truncate max-w-md">
                                        {session.targetUrl}
                                    </code>
                                </div>
                                {session.userAgent && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-muted-foreground">
                                            User Agent:
                                        </span>
                                        <code className="px-2 py-1 bg-background rounded text-xs font-mono truncate max-w-md">
                                            {session.userAgent}
                                        </code>
                                    </div>
                                )}
                            </div>
                        )}

                        {(session.currentStage === "challenge_detection" ||
                            session.currentStage === "challenge_solving") &&
                            session.challengeType && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                                        <span className="text-sm font-medium">
                                            Challenge Type: {session.challengeType}
                                        </span>
                                    </div>
                                    {session.challengeStatus && (
                                        <Badge variant="outline" className="capitalize">
                                            {session.challengeStatus.replace("_", " ")}
                                        </Badge>
                                    )}
                                </div>
                            )}

                        {session.currentStage === "data_extraction" && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Progress:</span>
                                <div className="flex-1 max-w-xs">
                                    <Progress
                                        value={
                                            (session.requestsCompleted /
                                                Math.max(session.requestsTotal, 1)) *
                                            100
                                        }
                                        className="h-2"
                                    />
                                </div>
                                <span className="text-xs font-medium">
                                    {session.requestsCompleted} / {session.requestsTotal}
                                </span>
                            </div>
                        )}

                        {session.currentStage === "validation" &&
                            session.extractedData && (
                                <div className="text-sm">
                                    <span className="text-muted-foreground">
                                        Data extracted successfully
                                    </span>
                                </div>
                            )}
                    </div>
                </div>
            </div>
        </Card>
    );
}

// Metrics Display Component
function MetricsDisplay({ session }: { session: ScrapingSessionData }) {
    const metrics = [
        {
            label: "Navigation Time",
            value: session.metrics.navigationTime,
            icon: Activity,
            color: "text-purple-500",
        },
        {
            label: "Challenge Solve Time",
            value: session.metrics.challengeSolveTime,
            icon: Shield,
            color: "text-orange-500",
        },
        {
            label: "Extraction Time",
            value: session.metrics.extractionTime,
            icon: Database,
            color: "text-green-500",
        },
        {
            label: "Total Time",
            value: session.metrics.totalTime,
            icon: Clock,
            color: "text-blue-500",
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                    <Card key={metric.label} className="p-4">
                        <div className="flex items-center gap-3">
                            <div
                                className={cn(
                                    "flex items-center justify-center w-10 h-10 rounded-lg bg-muted"
                                )}
                            >
                                <Icon className={cn("w-5 h-5", metric.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground truncate">
                                    {metric.label}
                                </p>
                                <p className="text-lg font-semibold mt-0.5">
                                    {formatDuration(metric.value)}
                                </p>
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}

// Error Display Component
function ErrorDisplay({ session }: { session: ScrapingSessionData }) {
    if (!session.errors || session.errors.length === 0) {
        return (
            <Card className="p-6">
                <div className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <p className="text-sm">No errors detected</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {session.errors.map((error, index) => (
                <Card key={index} className="p-4 bg-red-500/5 border-red-500/20">
                    <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-red-500">
                                    {error.message}
                                </p>
                                <Badge variant="outline" className="text-xs">
                                    Error #{index + 1}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {formatTimestamp(error.timestamp)}
                            </p>
                            {error.stack && (
                                <details className="mt-3">
                                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                        View stack trace
                                    </summary>
                                    <pre className="mt-2 p-3 bg-background rounded-lg text-xs overflow-x-auto">
                                        {error.stack}
                                    </pre>
                                </details>
                            )}
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

// Main LifecycleVisualizer Component
export default function LifecycleVisualizer({
    session,
    className,
}: LifecycleVisualizerProps) {
    const [activeTab, setActiveTab] = useState("overview");

    return (
        <div className={cn("space-y-6", className)}>
            {/* Stage Timeline */}
            <Card className="p-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-foreground">
                            Lifecycle Progress
                        </h3>
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
                            {session.status === "waiting_challenge"
                                ? "Challenge"
                                : session.status.replace("_", " ")}
                        </Badge>
                    </div>
                    <StageTimeline
                        currentStage={session.currentStage}
                        status={session.status}
                    />
                </div>
            </Card>

            {/* Current Stage Detail */}
            <StageDetailPanel session={session} />

            {/* Tabbed Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="metrics">Metrics</TabsTrigger>
                    <TabsTrigger value="errors">
                        Errors
                        {session.errors && session.errors.length > 0 && (
                            <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                                {session.errors.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-4">
                    <Card className="p-6">
                        <h4 className="text-sm font-semibold text-foreground mb-4">
                            Session Information
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground">Session ID</span>
                                <p className="font-mono text-xs mt-1 break-all">
                                    {session.id}
                                </p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Tenant</span>
                                <p className="font-medium mt-1">{session.tenantName}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Site</span>
                                <p className="font-medium mt-1">{session.siteUrl}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Started</span>
                                <p className="font-medium mt-1">
                                    {formatTimestamp(session.startTime)}
                                </p>
                            </div>
                            {session.endTime && (
                                <div>
                                    <span className="text-muted-foreground">Ended</span>
                                    <p className="font-medium mt-1">
                                        {formatTimestamp(session.endTime)}
                                    </p>
                                </div>
                            )}
                            <div>
                                <span className="text-muted-foreground">Requests</span>
                                <p className="font-medium mt-1">
                                    {session.requestsCompleted} / {session.requestsTotal}
                                </p>
                            </div>
                        </div>
                    </Card>

                    {session.extractedData && (
                        <Card className="p-6">
                            <h4 className="text-sm font-semibold text-foreground mb-4">
                                Extracted Data
                            </h4>
                            <pre className="text-xs p-4 bg-muted rounded-lg overflow-x-auto">
                                {JSON.stringify(session.extractedData, null, 2)}
                            </pre>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="metrics" className="mt-4">
                    <MetricsDisplay session={session} />
                </TabsContent>

                <TabsContent value="errors" className="mt-4">
                    <ErrorDisplay session={session} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
