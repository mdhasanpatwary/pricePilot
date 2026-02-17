"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import Image from "next/image";
import { toast } from "sonner";

interface PendingChange {
    id: string;
    currentPrice: string;
    recommendedPrice: string;
    reason: string;
    appliedRule: string | null;
    createdAt: string;
    expiresAt: string;
    autoApprovedBy: string | null;
    autoApprovedAt: string | null;
    product: {
        id: string;
        title: string;
        sku: string | null;
        imageUrl: string | null;
        site: {
            baseUrl: string;
            type: string;
        };
    };
}

export default function PriceApprovalsPage() {
    const [changes, setChanges] = useState<PendingChange[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [autoApprovalRules, setAutoApprovalRules] = useState<Record<string, string>>({});

    const fetchChanges = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/v1/price-approvals?status=PENDING");

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
                console.error("API Error:", res.status, errorData);

                if (res.status === 401) {
                    toast.error("Authentication Required", {
                        description: "Please log in to view price approvals",
                    });
                } else {
                    toast.error(errorData.error || "Failed to load pending price changes");
                }
                setChanges([]);
                return;
            }

            const data = await res.json();
            setChanges(data.changes || []);

            // Fetch auto-approval rule names for changes that were auto-approved
            const autoApprovedRuleIds = (data.changes || [])
                .filter((c: PendingChange) => c.autoApprovedBy)
                .map((c: PendingChange) => c.autoApprovedBy);

            if (autoApprovedRuleIds.length > 0) {
                const rulesRes = await fetch("/api/v1/auto-approval-rules");
                if (rulesRes.ok) {
                    const rulesData = await rulesRes.json();
                    const rulesMap: Record<string, string> = {};
                    rulesData.data.forEach((rule: any) => {
                        rulesMap[rule.id] = rule.name;
                    });
                    setAutoApprovalRules(rulesMap);
                }
            }
        } catch (error) {
            console.error("Fetch error:", error);
            toast.error("Failed to load pending price changes");
            setChanges([]);
        } finally {
            setLoading(false);
        }
    }, []); // Remove toast dependency

    useEffect(() => {
        fetchChanges();
    }, [fetchChanges]);

    const handleSelectAll = () => {
        if (selectedIds.size === changes.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(changes.map((c) => c.id)));
        }
    };

    const handleToggle = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleAction = async (action: "approve" | "reject", specificIds?: string[]) => {
        const idsToProcess = specificIds || Array.from(selectedIds);

        if (idsToProcess.length === 0) {
            toast.error("Please select at least one price change");
            return;
        }

        try {
            setProcessing(true);
            const res = await fetch("/api/v1/price-approvals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    changeIds: idsToProcess,
                }),
            });

            if (!res.ok) throw new Error("Failed to process");

            const data = await res.json();
            toast.success(data.message);

            setSelectedIds(new Set());
            await fetchChanges();
        } catch (error) {
            toast.error(`Failed to ${action} price changes`);
        } finally {
            setProcessing(false);
        }
    };

    const calculateChange = (current: string, recommended: string) => {
        const curr = parseFloat(current);
        const rec = parseFloat(recommended);
        const diff = rec - curr;
        const percent = ((diff / curr) * 100).toFixed(1);
        return { diff, percent };
    };

    if (loading) {
        return (
            <div className="container mx-auto p-6">
                <LoadingSpinner message="Loading pending price changes..." />
            </div>
        );
    }

    if (changes.length === 0) {
        return (
            <div className="container mx-auto p-6">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold">Price Approvals</h1>
                        <p className="text-muted-foreground mt-2">
                            Review and approve price changes before they are applied to your store
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => window.location.href = "/dashboard/price-approvals/history"}
                    >
                        View History
                    </Button>
                </div>
                <EmptyState
                    title="No Pending Changes"
                    description="All price changes have been reviewed. New changes will appear here after the next sync."
                />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Price Approvals</h1>
                    <p className="text-muted-foreground mt-2">
                        Review and approve {changes.length} pending price changes
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => window.location.href = "/dashboard/price-approvals/history"}
                >
                    View History
                </Button>
            </div>

            <div className="mb-4 flex gap-2">
                <Button
                    onClick={handleSelectAll}
                    variant="outline"
                    disabled={processing}
                >
                    {selectedIds.size === changes.length ? "Deselect All" : "Select All"}
                </Button>
                <Button
                    onClick={() => handleAction("approve")}
                    disabled={selectedIds.size === 0 || processing}
                    className="bg-green-600 hover:bg-green-700"
                >
                    Approve Selected ({selectedIds.size})
                </Button>
                <Button
                    onClick={() => handleAction("reject")}
                    disabled={selectedIds.size === 0 || processing}
                    variant="destructive"
                >
                    Reject Selected ({selectedIds.size})
                </Button>
            </div>

            <div className="space-y-4">
                {changes.map((change) => {
                    const { diff, percent } = calculateChange(
                        change.currentPrice,
                        change.recommendedPrice
                    );
                    const isIncrease = diff > 0;

                    return (
                        <Card key={change.id} className="p-4">
                            <div className="flex items-start gap-4">
                                <Checkbox
                                    checked={selectedIds.has(change.id)}
                                    onCheckedChange={() => handleToggle(change.id)}
                                    disabled={processing}
                                />

                                {change.product.imageUrl && (
                                    <Image
                                        src={change.product.imageUrl}
                                        alt={change.product.title}
                                        width={80}
                                        height={80}
                                        className="w-20 h-20 object-cover rounded"
                                    />
                                )}

                                <div className="flex-1">
                                    <h3 className="font-semibold">{change.product.title}</h3>
                                    {change.product.sku && (
                                        <p className="text-sm text-muted-foreground">
                                            SKU: {change.product.sku}
                                        </p>
                                    )}

                                    <div className="mt-2 flex items-center gap-4">
                                        <div>
                                            <span className="text-sm text-muted-foreground">
                                                Current:
                                            </span>
                                            <span className="ml-2 font-medium">
                                                ${parseFloat(change.currentPrice).toFixed(2)}
                                            </span>
                                        </div>
                                        <span className="text-muted-foreground">→</span>
                                        <div>
                                            <span className="text-sm text-muted-foreground">
                                                Recommended:
                                            </span>
                                            <span className="ml-2 font-medium">
                                                ${parseFloat(change.recommendedPrice).toFixed(2)}
                                            </span>
                                        </div>
                                        <Badge
                                            variant={isIncrease ? "destructive" : "default"}
                                            className={
                                                isIncrease
                                                    ? "bg-red-100 text-red-800"
                                                    : "bg-green-100 text-green-800"
                                            }
                                        >
                                            {isIncrease ? "+" : ""}
                                            {percent}%
                                        </Badge>
                                    </div>

                                    <div className="mt-2">
                                        <p className="text-sm">
                                            <span className="font-medium">Reason:</span>{" "}
                                            {change.reason}
                                        </p>
                                        {change.appliedRule && (
                                            <p className="text-sm text-muted-foreground">
                                                Rule: {change.appliedRule}
                                            </p>
                                        )}
                                        {change.autoApprovedBy && (
                                            <div className="mt-2">
                                                <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                    Auto-approved by: {autoApprovalRules[change.autoApprovedBy] || change.autoApprovedBy}
                                                </Badge>
                                                {change.autoApprovedAt && (
                                                    <span className="ml-2 text-xs text-muted-foreground">
                                                        on {new Date(change.autoApprovedAt).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-2 text-xs text-muted-foreground">
                                        Created: {new Date(change.createdAt).toLocaleString()} •
                                        Expires: {new Date(change.expiresAt).toLocaleString()}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        onClick={() => handleAction("approve", [change.id])}
                                        disabled={processing}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleAction("reject", [change.id])}
                                        disabled={processing}
                                    >
                                        Reject
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
