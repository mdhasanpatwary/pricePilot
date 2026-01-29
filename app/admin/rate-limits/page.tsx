"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Shield,
    AlertTriangle,
    TrendingUp,
    Users,
    RefreshCw,
    Search,
    Filter,
    Clock,
    Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TenantStatus {
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
}

interface Summary {
    totalTenants: number;
    tenantsWithViolations: number;
    tenantsWithBypasses: number;
    tenantsWithCustomMultipliers: number;
}

export default function RateLimitDashboard() {
    const router = useRouter();
    const [tenants, setTenants] = useState<TenantStatus[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [planFilter, setPlanFilter] = useState<string>("all");
    const [violationFilter, setViolationFilter] = useState<string>("all");

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/v1/admin/rate-limits");
            if (res.ok) {
                const data = await res.json();
                setTenants(data.data.tenants);
                setSummary(data.data.summary);
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error("Failed to fetch rate limit data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        // Auto-refresh every 30 seconds
        const interval = setInterval(() => {
            fetchData();
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchData]);

    // Filter tenants based on search and filters
    const filteredTenants = tenants.filter((tenant) => {
        const matchesSearch =
            searchQuery === "" ||
            tenant.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tenant.tenantId.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesPlan =
            planFilter === "all" || tenant.planType === planFilter;

        const matchesViolation =
            violationFilter === "all" ||
            (violationFilter === "with" && tenant.recentViolations > 0) ||
            (violationFilter === "without" && tenant.recentViolations === 0);

        return matchesSearch && matchesPlan && matchesViolation;
    });

    const handleRefresh = () => {
        setLoading(true);
        fetchData();
    };

    if (loading && !summary) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-muted-foreground">Loading rate limits...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground">
                        Rate Limit Management
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Monitor and manage rate limits across all tenants
                    </p>
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
                        <RefreshCw
                            className={cn("w-4 h-4", loading && "animate-spin")}
                        />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Total Tenants
                            </CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary.totalTenants}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Active in system
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                With Violations
                            </CardTitle>
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {summary.tenantsWithViolations}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Recent rate limit hits
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Active Bypasses
                            </CardTitle>
                            <Shield className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {summary.tenantsWithBypasses}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Temporarily unlimited
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Custom Multipliers
                            </CardTitle>
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {summary.tenantsWithCustomMultipliers}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Custom rate limits
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by tenant name or ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <Select value={planFilter} onValueChange={setPlanFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <Filter className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="Plan Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Plans</SelectItem>
                                <SelectItem value="BASIC">Basic</SelectItem>
                                <SelectItem value="PREMIUM">Premium</SelectItem>
                                <SelectItem value="PRO">Pro</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={violationFilter} onValueChange={setViolationFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="Violations" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Tenants</SelectItem>
                                <SelectItem value="with">With Violations</SelectItem>
                                <SelectItem value="without">No Violations</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Tenants Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Tenant Rate Limit Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tenant</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Multiplier</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Violations</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTenants.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        <p className="text-muted-foreground">
                                            {searchQuery || planFilter !== "all" || violationFilter !== "all"
                                                ? "No tenants match your filters"
                                                : "No tenants found"}
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredTenants.map((tenant) => (
                                    <TableRow key={tenant.tenantId}>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{tenant.companyName}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {tenant.tenantId}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    tenant.planType === "PRO"
                                                        ? "default"
                                                        : tenant.planType === "PREMIUM"
                                                            ? "secondary"
                                                            : "outline"
                                                }
                                            >
                                                {tenant.planType}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">
                                                    {tenant.effectiveMultiplier}x
                                                </span>
                                                {tenant.customMultiplier && (
                                                    <Badge variant="warning" className="text-xs">
                                                        Custom
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {tenant.bypassActive ? (
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="success">
                                                        <Shield className="w-3 h-3 mr-1" />
                                                        Bypass Active
                                                    </Badge>
                                                    {tenant.bypassExpiresAt && (
                                                        <span className="text-xs text-muted-foreground">
                                                            <Clock className="w-3 h-3 inline mr-1" />
                                                            {new Date(tenant.bypassExpiresAt).toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <Badge variant="outline">
                                                    <Zap className="w-3 h-3 mr-1" />
                                                    Rate Limited
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {tenant.recentViolations > 0 ? (
                                                <Badge variant="destructive">
                                                    {tenant.recentViolations}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">0</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    router.push(`/admin/rate-limits/${tenant.tenantId}`)
                                                }
                                            >
                                                View Details
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
