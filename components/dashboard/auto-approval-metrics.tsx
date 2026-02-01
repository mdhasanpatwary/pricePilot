"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    TrendingUp,
    CheckCircle2,
    XCircle,
    BarChart3,
    RefreshCw,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-state";
import { Badge } from "@/components/ui/badge";

interface PerRuleMetric {
    ruleId: string;
    ruleName: string;
    triggerCount: number;
}

interface MetricsData {
    totalAutoApproved: number;
    totalNonMatching: number;
    totalEvaluated: number;
    autoApprovalPercentage: number;
    perRuleMetrics: PerRuleMetric[];
}

interface AutoApprovalMetricsProps {
    /**
     * Optional date range for metrics
     */
    startDate?: Date;
    endDate?: Date;
    /**
     * Optional callback when metrics are refreshed
     */
    onRefresh?: () => void;
}

/**
 * Auto-Approval Metrics Dashboard Component
 * 
 * Displays key metrics about auto-approval performance:
 * - Total auto-approvals
 * - Auto-approval percentage
 * - Top rules by trigger count
 * 
 * Requirements: 8.3, 8.4, 8.5
 */
export default function AutoApprovalMetrics({
    startDate,
    endDate,
    onRefresh,
}: AutoApprovalMetricsProps) {
    const [metrics, setMetrics] = useState<MetricsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchMetrics = async () => {
        try {
            setLoading(true);

            // Build query parameters
            const params = new URLSearchParams();
            if (startDate) {
                params.append("startDate", startDate.toISOString());
            }
            if (endDate) {
                params.append("endDate", endDate.toISOString());
            }

            const url = `/api/v1/auto-approval-rules/metrics${params.toString() ? `?${params.toString()}` : ""
                }`;

            const res = await fetch(url);

            if (!res.ok) {
                throw new Error("Failed to fetch metrics");
            }

            const data = await res.json();
            setMetrics(data.data);
        } catch (error) {
            console.error("Error fetching metrics:", error);
            toast.error("Failed to load auto-approval metrics");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate]);

    const handleRefresh = async () => {
        try {
            setRefreshing(true);
            await fetchMetrics();
            onRefresh?.();
            toast.success("Metrics refreshed");
        } catch (error) {
            console.error("Error refreshing metrics:", error);
        } finally {
            setRefreshing(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Auto-Approval Metrics</CardTitle>
                    <CardDescription>
                        Loading performance metrics...
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <LoadingSpinner message="Loading metrics..." />
                </CardContent>
            </Card>
        );
    }

    if (!metrics) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Auto-Approval Metrics</CardTitle>
                    <CardDescription>
                        Unable to load metrics
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        No metrics data available. Please try again later.
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Sort rules by trigger count (descending) for top rules display
    const topRules = [...metrics.perRuleMetrics]
        .sort((a, b) => b.triggerCount - a.triggerCount)
        .slice(0, 5);

    return (
        <div className="space-y-6">
            {/* Header with refresh button */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Auto-Approval Metrics</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Performance overview for the last 30 days
                    </p>
                </div>
                <Button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                >
                    <RefreshCw
                        className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                    />
                    Refresh
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                {/* Total Auto-Approved */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardDescription>Total Auto-Approved</CardDescription>
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {metrics.totalAutoApproved.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Price changes automatically approved
                        </p>
                    </CardContent>
                </Card>

                {/* Auto-Approval Percentage */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardDescription>Auto-Approval Rate</CardDescription>
                            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {metrics.autoApprovalPercentage.toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Of {metrics.totalEvaluated.toLocaleString()} changes evaluated
                        </p>
                    </CardContent>
                </Card>

                {/* Non-Matching Changes */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardDescription>Manual Review Required</CardDescription>
                            <XCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {metrics.totalNonMatching.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Changes that didn&apos;t match any rule
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Top Rules by Trigger Count */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        <CardTitle>Top Rules by Trigger Count</CardTitle>
                    </div>
                    <CardDescription>
                        Most frequently triggered auto-approval rules
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {topRules.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-sm text-muted-foreground">
                                No rules have been triggered yet
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {topRules.map((rule, index) => {
                                const percentage =
                                    metrics.totalAutoApproved > 0
                                        ? (rule.triggerCount / metrics.totalAutoApproved) * 100
                                        : 0;

                                return (
                                    <div key={rule.ruleId} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Badge
                                                    variant="outline"
                                                    className="font-mono w-8 h-8 flex items-center justify-center"
                                                >
                                                    {index + 1}
                                                </Badge>
                                                <div>
                                                    <p className="font-semibold text-sm">
                                                        {rule.ruleName}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {rule.triggerCount.toLocaleString()}{" "}
                                                        {rule.triggerCount === 1
                                                            ? "trigger"
                                                            : "triggers"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-sm">
                                                    {percentage.toFixed(1)}%
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    of total
                                                </p>
                                            </div>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="w-full bg-secondary rounded-full h-2">
                                            <div
                                                className="bg-primary rounded-full h-2 transition-all"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Additional Insights */}
            {metrics.totalEvaluated > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Insights</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 text-sm">
                            {metrics.autoApprovalPercentage >= 50 && (
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                                    <p>
                                        <span className="font-semibold">High automation rate:</span>{" "}
                                        Over half of your price changes are being auto-approved,
                                        reducing manual review workload.
                                    </p>
                                </div>
                            )}
                            {metrics.autoApprovalPercentage < 20 && (
                                <div className="flex items-start gap-2">
                                    <XCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                                    <p>
                                        <span className="font-semibold">Low automation rate:</span>{" "}
                                        Consider reviewing your rule conditions to increase
                                        auto-approval coverage.
                                    </p>
                                </div>
                            )}
                            {metrics.perRuleMetrics.length === 0 && (
                                <div className="flex items-start gap-2">
                                    <XCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                                    <p>
                                        <span className="font-semibold">No active rules:</span>{" "}
                                        Create auto-approval rules to start automating your price
                                        approval workflow.
                                    </p>
                                </div>
                            )}
                            {metrics.totalNonMatching > metrics.totalAutoApproved * 2 && (
                                <div className="flex items-start gap-2">
                                    <XCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                                    <p>
                                        <span className="font-semibold">
                                            Many non-matching changes:
                                        </span>{" "}
                                        Your rules may be too restrictive. Consider adjusting
                                        conditions to match more changes.
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
