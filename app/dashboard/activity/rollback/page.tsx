"use client";

import { useState, useEffect } from "react";
import { Undo2, AlertCircle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RollbackHistoryEntry {
    id: string;
    type: "SINGLE" | "BULK";
    timestamp: string;
    userId: string;
    userEmail: string;
    details: {
        productId?: string;
        productTitle?: string;
        oldPrice?: string;
        newPrice?: string;
        productCount?: number;
        operation?: string;
        snapshotId?: string;
    };
}

export default function RollbackHistoryPage() {
    const [history, setHistory] = useState<RollbackHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/v1/price-update/rollback/history?limit=50");

            if (!res.ok) {
                throw new Error("Failed to fetch rollback history");
            }

            const data = await res.json();

            if (data.success) {
                setHistory(data.data.history);
            } else {
                throw new Error(data.error?.message || "Failed to fetch rollback history");
            }
        } catch (err) {
            console.error("Failed to load rollback history", err);
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const getTypeBadge = (type: "SINGLE" | "BULK") => {
        if (type === "SINGLE") {
            return (
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                    Single
                </Badge>
            );
        }
        return (
            <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                Bulk
            </Badge>
        );
    };

    const renderDetails = (entry: RollbackHistoryEntry) => {
        if (entry.type === "SINGLE") {
            return (
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-foreground line-clamp-1">
                        {entry.details.productTitle || "Product"}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="line-through">${entry.details.oldPrice}</span>
                        <span>→</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                            ${entry.details.newPrice}
                        </span>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-foreground">
                    Bulk Operation Rollback
                </span>
                <span className="text-xs text-muted-foreground">
                    {entry.details.productCount} products reverted
                </span>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="space-y-8 animate-in fade-in duration-500 pb-20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-4 w-96" />
                    </div>
                </div>

                <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={i}
                            className="px-6 py-6 border-b border-border/50 grid grid-cols-4 gap-4 items-center"
                        >
                            <Skeleton className="h-6 w-20 rounded-full" />
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                            <Skeleton className="h-3 w-28" />
                            <div className="flex flex-col gap-1 items-end">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-8 animate-in fade-in duration-500 pb-20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-bold tracking-tight">Rollback History</h1>
                        <p className="text-muted-foreground text-sm font-medium">
                            View all price rollback operations
                        </p>
                    </div>
                </div>

                <Card className="p-8">
                    <div className="flex flex-col items-center justify-center text-center gap-4">
                        <AlertCircle className="w-12 h-12 text-destructive" />
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Failed to Load History</h3>
                            <p className="text-sm text-muted-foreground mb-4">{error}</p>
                            <button
                                onClick={() => fetchHistory()}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Undo2 className="w-6 h-6" />
                        Rollback History
                    </h1>
                    <p className="text-muted-foreground text-sm font-medium">
                        View all price rollback operations and their details
                    </p>
                </div>
                <button
                    onClick={() => fetchHistory(true)}
                    className="p-2 hover:bg-muted border border-border rounded-lg transition-colors group"
                    title="Refresh history"
                >
                    <RefreshCw className="w-4 h-4 text-muted-foreground group-active:rotate-180 transition-transform" />
                </button>
            </div>

            {history.length === 0 ? (
                <Card className="p-12">
                    <div className="flex flex-col items-center justify-center text-center gap-4 opacity-50 grayscale">
                        <CheckCircle2 className="w-16 h-16" />
                        <div>
                            <h3 className="text-lg font-semibold mb-2">No Rollbacks Yet</h3>
                            <p className="text-sm text-muted-foreground">
                                Rollback operations will appear here when you undo price changes
                            </p>
                        </div>
                    </div>
                </Card>
            ) : (
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/50 border-b border-border">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                        Type
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                        Details
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                        Performed By
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right">
                                        Timestamp
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {history.map((entry) => (
                                    <tr
                                        key={entry.id}
                                        className="hover:bg-muted/20 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            {getTypeBadge(entry.type)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {renderDetails(entry)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">
                                                    {entry.userEmail.split("@")[0]}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {entry.userEmail}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className="text-xs font-semibold">
                                                    {format(new Date(entry.timestamp), "MMM dd, yyyy")}
                                                </span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {format(new Date(entry.timestamp), "HH:mm:ss")}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
