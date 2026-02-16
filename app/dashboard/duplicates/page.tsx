"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
    Copy,
    ShieldAlert,
    Trash2,
    CheckCircle2,
    ExternalLink,
    Zap
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DuplicateDetectionPage() {
    const searchParams = useSearchParams();
    const impersonateId = searchParams.get("tenantId");

    const [isLoading, setIsLoading] = useState(true);
    const [groups, setGroups] = useState<any[]>([]);

    const fetchDuplicates = useCallback(async () => {
        setIsLoading(true);
        try {
            const query = impersonateId ? `?tenantId=${impersonateId}` : "";
            const res = await fetch(`/api/v1/analytics/duplicates${query}`);

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
                console.error("API Error:", res.status, errorData);

                if (res.status === 401) {
                    toast.error("Authentication required. Please log in.");
                } else if (res.status === 400) {
                    toast.error(errorData.error || "Invalid request");
                } else {
                    toast.error(errorData.error || "Failed to detect duplicates");
                }
                setGroups([]);
                return;
            }

            const data = await res.json();
            setGroups(data.groups || []);
        } catch (e) {
            console.error("Fetch error:", e);
            toast.error("Network error during detection");
            setGroups([]);
        } finally {
            setIsLoading(false);
        }
    }, [impersonateId]);

    useEffect(() => {
        fetchDuplicates();
    }, [fetchDuplicates]);

    const [isMerging, setIsMerging] = useState<string | null>(null);

    const getSiteName = (item: any): string => {
        const explicitName = item?.site?.name;
        if (explicitName) return explicitName;

        const baseUrl = item?.site?.baseUrl || item?.Site?.baseUrl;
        if (!baseUrl) return "Unknown";

        try {
            return new URL(baseUrl).hostname.replace(/^www\./, "");
        } catch {
            return baseUrl;
        }
    };

    const handleMerge = async (group: any) => {
        setIsMerging(group.anchor.id);
        try {
            const res = await fetch("/api/v1/analytics/duplicates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    anchorId: group.anchor.id,
                    duplicateIds: group.duplicates.map((d: any) => d.id)
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
                console.error("Merge error:", res.status, errorData);

                if (res.status === 401) {
                    toast.error("Authentication required. Please log in.");
                } else {
                    toast.error(errorData.error || "Merge operation failed");
                }
                return;
            }

            const data = await res.json();
            toast.success(data.message || "Duplicates merged successfully. Marketplace intelligence unified.");
            fetchDuplicates(); // Refresh catalog
        } catch (e) {
            console.error("Network error:", e);
            toast.error("Network error during merge");
        } finally {
            setIsMerging(null);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Duplicate Detection</h2>
                    <p className="text-muted-foreground text-sm">
                        Identify and manage redundant listings across your catalog.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={fetchDuplicates} disabled={isLoading}>
                        <Zap className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                        Scan for Duplicates
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-40 w-full rounded-xl" />
                    ))}
                </div>
            ) : groups.length === 0 ? (
                <Card className="p-20 flex flex-col items-center justify-center text-center space-y-4 border-dashed">
                    <div className="w-16 h-16 rounded-full bg-success/5 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-success" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Catalog is Clean</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            No high-confidence duplicate products detected in your current catalog.
                        </p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-6">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-4">
                        <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div className="text-sm text-amber-900">
                            <p className="font-bold">Heuristic Duplicates Found</p>
                            <p className="opacity-80">We found {groups.length} groups of products that appear to be identical based on SKU or Title similarity. Managing these helps optimize your pricing credits.</p>
                        </div>
                    </div>

                    {groups.map((group, idx) => (
                        <Card key={idx} className="overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md">
                            <div className="p-6 bg-muted/20 border-b border-border flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Badge variant="secondary" className="font-black">Master Entry</Badge>
                                    <span className="text-sm font-bold truncate max-w-md">{group.anchor.title}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{getSiteName(group.anchor)}</span>
                                    <Button
                                        size="sm"
                                        onClick={() => handleMerge(group)}
                                        className="h-8"
                                        disabled={isMerging === group.anchor.id}
                                    >
                                        {isMerging === group.anchor.id ? "Merging..." : "Merge Duplicates"}
                                    </Button>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                {group.duplicates.map((dup: any) => (
                                    <div key={dup.id} className="flex flex-col md:flex-row items-center justify-between p-4 bg-background border border-border rounded-lg gap-4 group">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                                <Copy className="w-4 h-4 text-muted-foreground/50" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold">{dup.title}</span>
                                                    <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                                                        {Math.round(dup.score * 100)}% Match
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{getSiteName(dup)}</span>
                                                    <span className="text-[10px] text-muted-foreground">•</span>
                                                    <span className="text-[10px] font-bold text-muted-foreground">{dup.reason}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right mr-4">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Price</p>
                                                <p className="text-sm font-black">
                                                    {formatCurrency(Number(dup.currentPrice ?? 0), group.anchor.currency || "USD")}
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <ExternalLink className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
