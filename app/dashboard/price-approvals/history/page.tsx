"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

/**
 * Approval History Page
 *
 * Displays a searchable and filterable history of all price approvals
 * including approver, timestamp, and reason.
 *
 * Requirements: 2.10.5
 */

interface ApprovalHistoryEntry {
    id: string;
    userId: string;
    userEmail: string;
    action: string;
    entityId: string;
    details: {
        productId?: string;
        productTitle?: string;
        productSku?: string;
        oldPrice?: string;
        newPrice?: string;
        reason?: string;
        ruleId?: string;
        ruleName?: string;
        changeCount?: number;
        delegatedFrom?: string;
        delegatedFromName?: string;
    } | null;
    ipAddress: string | null;
    createdAt: string;
}

interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export default function ApprovalHistoryPage() {
    const { data: session } = useSession();
    const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter state
    const [actionFilter, setActionFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Fetch approval history
    const fetchHistory = useCallback(async (page: number = 1) => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                page: page.toString(),
                limit: pagination.limit.toString(),
            });

            if (actionFilter && actionFilter !== "all") {
                params.append("action", actionFilter);
            }

            if (searchQuery) {
                params.append("search", searchQuery);
            }

            if (startDate) {
                params.append("startDate", new Date(startDate).toISOString());
            }

            if (endDate) {
                params.append("endDate", new Date(endDate).toISOString());
            }

            const response = await fetch(`/api/v1/price-approvals/history?${params}`);

            if (!response.ok) {
                throw new Error("Failed to fetch approval history");
            }

            const data = await response.json();
            setHistory(data.history);
            setPagination(data.pagination);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }, [actionFilter, searchQuery, startDate, endDate, pagination.limit]);

    // Initial load
    useEffect(() => {
        if (session?.user) {
            fetchHistory();
        }
    }, [session, fetchHistory]);

    // Apply filters
    const handleApplyFilters = () => {
        fetchHistory(1);
    };

    // Reset filters
    const handleResetFilters = () => {
        setActionFilter("all");
        setSearchQuery("");
        setStartDate("");
        setEndDate("");
        fetchHistory(1);
    };

    // Export to CSV
    const handleExport = () => {
        const csv = [
            ["Date", "Action", "User", "Product", "Old Price", "New Price", "Reason"].join(","),
            ...history.map((entry) => [
                format(new Date(entry.createdAt), "yyyy-MM-dd HH:mm:ss"),
                entry.action,
                entry.userEmail,
                entry.details?.productTitle || entry.details?.productSku || "N/A",
                entry.details?.oldPrice || "N/A",
                entry.details?.newPrice || "N/A",
                entry.details?.reason || entry.details?.ruleName || "N/A",
            ].join(",")),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `approval-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Get action badge variant
    const getActionBadge = (action: string) => {
        if (action.includes("APPROVE")) {
            return <Badge variant="default" className="bg-green-600">Approved</Badge>;
        } else if (action.includes("REJECT")) {
            return <Badge variant="destructive">Rejected</Badge>;
        } else if (action.includes("AUTO")) {
            return <Badge variant="secondary">Auto-Approved</Badge>;
        }
        return <Badge variant="outline">{action}</Badge>;
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Approval History</h1>
                    <p className="text-muted-foreground">
                        View and search all price approval actions
                    </p>
                </div>
                <Button onClick={handleExport} disabled={history.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filters
                    </CardTitle>
                    <CardDescription>
                        Filter and search approval history
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="action-filter">Action Type</Label>
                            <Select value={actionFilter} onValueChange={setActionFilter}>
                                <SelectTrigger id="action-filter">
                                    <SelectValue placeholder="All actions" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Actions</SelectItem>
                                    <SelectItem value="APPROVE_PRICE">Manual Approval</SelectItem>
                                    <SelectItem value="REJECT_PRICE">Manual Rejection</SelectItem>
                                    <SelectItem value="AUTO_APPROVE_PRICE">Auto-Approval</SelectItem>
                                    <SelectItem value="APPROVE_PRICE_VIA_DELEGATION">Delegated Approval</SelectItem>
                                    <SelectItem value="BULK_PRICE_APPROVAL">Bulk Approval</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="search">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="search"
                                    placeholder="Search by user, product..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="start-date">Start Date</Label>
                            <Input
                                id="start-date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="end-date">End Date</Label>
                            <Input
                                id="end-date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={handleApplyFilters}>
                            Apply Filters
                        </Button>
                        <Button variant="outline" onClick={handleResetFilters}>
                            Reset
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* History Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Approval History</CardTitle>
                    <CardDescription>
                        {pagination.total} total entries
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Loading...</div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-600">{error}</div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No approval history found
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date & Time</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Approver</TableHead>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Price Change</TableHead>
                                            <TableHead>Reason</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {history.map((entry) => (
                                            <TableRow key={entry.id}>
                                                <TableCell className="whitespace-nowrap">
                                                    {format(new Date(entry.createdAt), "MMM dd, yyyy HH:mm")}
                                                </TableCell>
                                                <TableCell>
                                                    {getActionBadge(entry.action)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="font-medium">{entry.userEmail}</div>
                                                        {entry.details?.delegatedFromName && (
                                                            <div className="text-xs text-muted-foreground">
                                                                via {entry.details.delegatedFromName}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        {entry.details?.productTitle && (
                                                            <div className="font-medium max-w-xs truncate">
                                                                {entry.details.productTitle}
                                                            </div>
                                                        )}
                                                        {entry.details?.productSku && (
                                                            <div className="text-xs text-muted-foreground">
                                                                SKU: {entry.details.productSku}
                                                            </div>
                                                        )}
                                                        {entry.details?.changeCount && (
                                                            <div className="text-xs text-muted-foreground">
                                                                {entry.details.changeCount} products
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {entry.details?.oldPrice && entry.details?.newPrice ? (
                                                        <div className="space-y-1">
                                                            <div className="text-xs text-muted-foreground line-through">
                                                                ${entry.details.oldPrice}
                                                            </div>
                                                            <div className="font-medium">
                                                                ${entry.details.newPrice}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">N/A</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="max-w-xs truncate">
                                                        {entry.details?.reason ||
                                                            entry.details?.ruleName ||
                                                            "Manual approval"}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between mt-4">
                                <div className="text-sm text-muted-foreground">
                                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                                    {pagination.total} entries
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fetchHistory(pagination.page - 1)}
                                        disabled={!pagination.hasPrev}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fetchHistory(pagination.page + 1)}
                                        disabled={!pagination.hasNext}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
