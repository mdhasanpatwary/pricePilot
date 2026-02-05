"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, History, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ConfigChange {
    field: string;
    oldValue: any;
    newValue: any;
}

interface HistoryEntry {
    id: string;
    timestamp: string;
    userEmail: string;
    userId: string;
    oldConfig: any;
    newConfig: any;
    changes: ConfigChange[];
}

interface ScrapingConfigHistoryProps {
    competitorWebsiteId: string;
    competitorWebsiteUrl: string;
}

export function ScrapingConfigHistory({
    competitorWebsiteId,
    competitorWebsiteUrl,
}: ScrapingConfigHistoryProps) {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [revertDialogOpen, setRevertDialogOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
    const [reverting, setReverting] = useState(false);

    const fetchHistory = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(
                `/api/v1/scraping/configs/${competitorWebsiteId}/history`
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || "Failed to fetch history");
            }

            setHistory(data.data.history);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }, [competitorWebsiteId]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const toggleRow = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    const handleRevert = async () => {
        if (!selectedEntry) return;

        try {
            setReverting(true);
            setError(null);

            const response = await fetch(
                `/api/v1/scraping/configs/${competitorWebsiteId}/history`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        historyId: selectedEntry.id,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || "Failed to revert configuration");
            }

            // Refresh history
            await fetchHistory();
            setRevertDialogOpen(false);
            setSelectedEntry(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setReverting(false);
        }
    };

    const formatValue = (value: any): string => {
        if (value === null || value === undefined) {
            return "Not set";
        }
        if (typeof value === "boolean") {
            return value ? "Yes" : "No";
        }
        if (Array.isArray(value)) {
            return value.length > 0 ? value.join(", ") : "Empty";
        }
        return String(value);
    };

    const getFieldLabel = (field: string): string => {
        const labels: Record<string, string> = {
            preferredStrategy: "Preferred Strategy",
            requiresJavascript: "Requires JavaScript",
            proxyRequired: "Proxy Required",
            baseDelayMs: "Base Delay (ms)",
            maxDelayMs: "Max Delay (ms)",
            backoffMultiplier: "Backoff Multiplier",
            maxRetries: "Max Retries",
            timeoutMs: "Timeout (ms)",
            priceSelectors: "Price Selectors",
            currencySelector: "Currency Selector",
            fallbackRegex: "Fallback Regex",
        };
        return labels[field] || field;
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Configuration History</CardTitle>
                    <CardDescription>Loading history...</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        <div>
                            <CardTitle>Configuration History</CardTitle>
                            <CardDescription className="mt-1">
                                {competitorWebsiteUrl}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {history.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No configuration changes recorded yet
                        </div>
                    ) : (
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12"></TableHead>
                                        <TableHead>Timestamp</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Changes</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.map((entry) => (
                                        <>
                                            <TableRow key={entry.id}>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleRow(entry.id)}
                                                    >
                                                        {expandedRows.has(entry.id) ? (
                                                            <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="text-sm">
                                                            {new Date(entry.timestamp).toLocaleString()}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {formatDistanceToNow(new Date(entry.timestamp), {
                                                                addSuffix: true,
                                                            })}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">{entry.userEmail}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">
                                                        {entry.changes.length} field
                                                        {entry.changes.length !== 1 ? "s" : ""} changed
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedEntry(entry);
                                                            setRevertDialogOpen(true);
                                                        }}
                                                        disabled={!entry.oldConfig}
                                                    >
                                                        <RotateCcw className="h-4 w-4 mr-2" />
                                                        Revert
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                            {expandedRows.has(entry.id) && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="bg-muted/50">
                                                        <div className="p-4 space-y-3">
                                                            <div className="font-semibold text-sm">
                                                                Changes:
                                                            </div>
                                                            {entry.changes.length === 0 ? (
                                                                <div className="text-sm text-muted-foreground">
                                                                    No specific changes recorded
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {entry.changes.map((change, idx) => (
                                                                        <div
                                                                            key={idx}
                                                                            className="grid grid-cols-3 gap-4 text-sm"
                                                                        >
                                                                            <div className="font-medium">
                                                                                {getFieldLabel(change.field)}
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-muted-foreground">
                                                                                    From:{" "}
                                                                                </span>
                                                                                <span className="text-destructive">
                                                                                    {formatValue(change.oldValue)}
                                                                                </span>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-muted-foreground">
                                                                                    To:{" "}
                                                                                </span>
                                                                                <span className="text-green-600 dark:text-green-400">
                                                                                    {formatValue(change.newValue)}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Revert Configuration</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to revert to this previous configuration?
                        </DialogDescription>
                    </DialogHeader>
                    {selectedEntry && (
                        <div className="space-y-2">
                            <div className="text-sm">
                                <span className="font-semibold">Timestamp: </span>
                                {new Date(selectedEntry.timestamp).toLocaleString()}
                            </div>
                            <div className="text-sm">
                                <span className="font-semibold">Changed by: </span>
                                {selectedEntry.userEmail}
                            </div>
                            <div className="text-sm">
                                <span className="font-semibold">Changes: </span>
                                {selectedEntry.changes.length} field
                                {selectedEntry.changes.length !== 1 ? "s" : ""}
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRevertDialogOpen(false)}
                            disabled={reverting}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleRevert} disabled={reverting}>
                            {reverting ? "Reverting..." : "Revert Configuration"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
