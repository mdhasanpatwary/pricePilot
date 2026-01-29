"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    ArrowLeft,
    Shield,
    AlertTriangle,
    TrendingUp,
    Clock,
    Zap,
    RefreshCw,
    Settings,
    Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface TenantDetail {
    tenantId: string;
    companyName: string;
    planType: "BASIC" | "PREMIUM" | "PRO";
    effectiveMultiplier: number;
    bypassActive: boolean;
    bypassExpiresAt?: string;
    bypassReason?: string;
    customMultiplier?: number;
    customMultiplierReason?: string;
    recentViolations: number;
    currentUsage: {
        [key: string]: {
            limit: number;
            window: string;
        };
    };
    metrics: {
        last24Hours: {
            totalHits: number;
            totalViolations: number;
            violationRate: number;
        };
        last7Days: {
            totalHits: number;
            totalViolations: number;
            violationRate: number;
        };
    };
    recentViolationDetails: Array<{
        timestamp: string;
        limiterType: string;
        endpoint: string;
        identifier: string;
        violationCount: number;
    }>;
}

export default function TenantRateLimitDetail() {
    const router = useRouter();
    const params = useParams();
    const tenantId = params.tenantId as string;

    const [tenant, setTenant] = useState<TenantDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Dialog states
    const [bypassDialogOpen, setBypassDialogOpen] = useState(false);
    const [multiplierDialogOpen, setMultiplierDialogOpen] = useState(false);
    const [bypassDuration, setBypassDuration] = useState("60");
    const [bypassReason, setBypassReason] = useState("");
    const [customMultiplier, setCustomMultiplier] = useState("");
    const [multiplierReason, setMultiplierReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`/api/v1/admin/rate-limits/${tenantId}`);
            if (res.ok) {
                const data = await res.json();
                setTenant(data.data);
                setLastUpdated(new Date());
            } else if (res.status === 404) {
                router.push("/admin/rate-limits");
            }
        } catch (error) {
            console.error("Failed to fetch tenant data:", error);
        } finally {
            setLoading(false);
        }
    }, [tenantId, router]);

    useEffect(() => {
        fetchData();

        // Auto-refresh every 30 seconds
        const interval = setInterval(() => {
            fetchData();
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchData]);

    const handleRefresh = () => {
        setLoading(true);
        fetchData();
    };

    const handleSetBypass = async () => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/v1/admin/rate-limits/${tenantId}/bypass`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    durationMinutes: parseInt(bypassDuration, 10),
                    reason: bypassReason,
                }),
            });

            if (res.ok) {
                setBypassDialogOpen(false);
                setBypassDuration("60");
                setBypassReason("");
                fetchData();
            } else {
                const data = await res.json();
                alert(data.error?.message || "Failed to set bypass");
            }
        } catch (error) {
            alert("Failed to set bypass");
        } finally {
            setActionLoading(false);
        }
    };

    const handleSetMultiplier = async () => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/v1/admin/rate-limits/${tenantId}/multiplier`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    multiplier: parseFloat(customMultiplier),
                    reason: multiplierReason,
                }),
            });

            if (res.ok) {
                setMultiplierDialogOpen(false);
                setCustomMultiplier("");
                setMultiplierReason("");
                fetchData();
            } else {
                const data = await res.json();
                alert(data.error?.message || "Failed to set multiplier");
            }
        } catch (error) {
            alert("Failed to set multiplier");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading && !tenant) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-muted-foreground">Loading tenant details...</p>
                </div>
            </div>
        );
    }

    if (!tenant) {
        return null;
    }

    const limiterTypes = Object.keys(tenant.currentUsage);

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/admin/rate-limits")}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">
                            {tenant.companyName}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Tenant ID: {tenant.tenantId}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {lastUpdated && (
                        <span className="text-xs text-muted-foreground">
                            Updated {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={loading}
                    >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Plan Type</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{tenant.planType}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {tenant.effectiveMultiplier}x multiplier
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Status</CardTitle>
                        {tenant.bypassActive ? (
                            <Shield className="h-4 w-4 text-emerald-500" />
                        ) : (
                            <Zap className="h-4 w-4 text-blue-500" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {tenant.bypassActive ? "Bypass" : "Limited"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {tenant.bypassActive && tenant.bypassExpiresAt
                                ? `Expires ${new Date(tenant.bypassExpiresAt).toLocaleString()}`
                                : "Rate limiting active"}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">24h Violations</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {tenant.metrics.last24Hours.totalViolations}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {tenant.metrics.last24Hours.violationRate.toFixed(1)}% rate
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">7d Violations</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {tenant.metrics.last7Days.totalViolations}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {tenant.metrics.last7Days.violationRate.toFixed(1)}% rate
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
                <Button
                    variant="outline"
                    onClick={() => setBypassDialogOpen(true)}
                    disabled={tenant.bypassActive}
                >
                    <Shield className="w-4 h-4 mr-2" />
                    Set Bypass
                </Button>
                <Button variant="outline" onClick={() => setMultiplierDialogOpen(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Set Custom Multiplier
                </Button>
            </div>

            {/* Current Configuration */}
            {(tenant.bypassActive || tenant.customMultiplier) && (
                <Card>
                    <CardHeader>
                        <CardTitle>Current Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {tenant.bypassActive && (
                            <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-500 mt-0.5" />
                                <div className="flex-1">
                                    <div className="font-medium text-emerald-900 dark:text-emerald-100">
                                        Bypass Active
                                    </div>
                                    <div className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                                        {tenant.bypassReason || "No reason provided"}
                                    </div>
                                    {tenant.bypassExpiresAt && (
                                        <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Expires: {new Date(tenant.bypassExpiresAt).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {tenant.customMultiplier && (
                            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <Settings className="w-5 h-5 text-blue-600 dark:text-blue-500 mt-0.5" />
                                <div className="flex-1">
                                    <div className="font-medium text-blue-900 dark:text-blue-100">
                                        Custom Multiplier: {tenant.customMultiplier}x
                                    </div>
                                    <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                        {tenant.customMultiplierReason || "No reason provided"}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Rate Limits by Type */}
            <Card>
                <CardHeader>
                    <CardTitle>Rate Limits by Type</CardTitle>
                    <CardDescription>
                        Current limits for each limiter type based on plan and multipliers
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {limiterTypes.map((type) => {
                            const usage = tenant.currentUsage[type];
                            return (
                                <div
                                    key={type}
                                    className="p-4 border border-border rounded-lg bg-muted/30"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium uppercase">{type}</span>
                                        <Badge variant="outline">{usage.window}</Badge>
                                    </div>
                                    <div className="text-2xl font-bold">{usage.limit}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        requests per window
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Recent Violations */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Violations</CardTitle>
                    <CardDescription>
                        Last 20 rate limit violations for this tenant
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {tenant.recentViolationDetails.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No recent violations
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Timestamp</TableHead>
                                    <TableHead>Limiter Type</TableHead>
                                    <TableHead>Endpoint</TableHead>
                                    <TableHead>Identifier</TableHead>
                                    <TableHead>Count</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tenant.recentViolationDetails.map((violation, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="text-xs">
                                            {new Date(violation.timestamp).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{violation.limiterType}</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs font-mono">
                                            {violation.endpoint}
                                        </TableCell>
                                        <TableCell className="text-xs">{violation.identifier}</TableCell>
                                        <TableCell>
                                            <Badge variant="destructive">{violation.violationCount}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Bypass Dialog */}
            <Dialog open={bypassDialogOpen} onOpenChange={setBypassDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Set Rate Limit Bypass</DialogTitle>
                        <DialogDescription>
                            Temporarily disable rate limiting for this tenant. The bypass will
                            automatically expire after the specified duration.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="duration">Duration (minutes)</Label>
                            <Input
                                id="duration"
                                type="number"
                                min="1"
                                max="10080"
                                value={bypassDuration}
                                onChange={(e) => setBypassDuration(e.target.value)}
                                placeholder="60"
                            />
                            <p className="text-xs text-muted-foreground">
                                Maximum: 7 days (10080 minutes)
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reason">Reason</Label>
                            <Textarea
                                id="reason"
                                value={bypassReason}
                                onChange={(e) => setBypassReason(e.target.value)}
                                placeholder="Explain why this bypass is needed..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setBypassDialogOpen(false)}
                            disabled={actionLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSetBypass}
                            disabled={actionLoading || !bypassDuration || !bypassReason}
                        >
                            {actionLoading ? "Setting..." : "Set Bypass"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Multiplier Dialog */}
            <Dialog open={multiplierDialogOpen} onOpenChange={setMultiplierDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Set Custom Multiplier</DialogTitle>
                        <DialogDescription>
                            Override the plan-based multiplier with a custom value. This will
                            adjust all rate limits for this tenant.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="multiplier">Multiplier</Label>
                            <Input
                                id="multiplier"
                                type="number"
                                min="0.1"
                                max="100"
                                step="0.1"
                                value={customMultiplier}
                                onChange={(e) => setCustomMultiplier(e.target.value)}
                                placeholder="2.0"
                            />
                            <p className="text-xs text-muted-foreground">
                                Range: 0.1 to 100 (current plan: {tenant.effectiveMultiplier}x)
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="multiplier-reason">Reason</Label>
                            <Textarea
                                id="multiplier-reason"
                                value={multiplierReason}
                                onChange={(e) => setMultiplierReason(e.target.value)}
                                placeholder="Explain why this custom multiplier is needed..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setMultiplierDialogOpen(false)}
                            disabled={actionLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSetMultiplier}
                            disabled={
                                actionLoading || !customMultiplier || !multiplierReason
                            }
                        >
                            {actionLoading ? "Setting..." : "Set Multiplier"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
