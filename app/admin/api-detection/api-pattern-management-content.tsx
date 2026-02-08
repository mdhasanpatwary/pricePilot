"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2, Play, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

interface ApiPattern {
    id: string;
    competitorWebsiteId: string;
    websiteName: string;
    websiteUrl: string;
    pattern: {
        url: string;
        method: string;
        responseFormat: string;
        dataPath: string;
    };
    confidenceScore: number;
    successCount: number;
    failureCount: number;
    lastUsedAt: string | null;
    createdAt: string;
}

export function ApiPatternManagementContent() {
    const [loading, setLoading] = useState(true);
    const [patterns, setPatterns] = useState<ApiPattern[]>([]);
    const [selectedPattern, setSelectedPattern] = useState<ApiPattern | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetchPatterns();
    }, []);

    const fetchPatterns = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/v1/admin/api-detection/patterns");
            if (response.ok) {
                const data = await response.json();
                setPatterns(data.patterns || []);
            }
        } catch (error) {
            console.error("Failed to fetch patterns:", error);
            toast({
                title: "Error",
                description: "Failed to load API patterns",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleInvalidate = async (pattern: ApiPattern) => {
        setActionLoading(pattern.id);
        try {
            const response = await fetch(
                `/api/v1/competitors/${pattern.competitorWebsiteId}/api-pattern`,
                {
                    method: "DELETE",
                }
            );

            if (response.ok) {
                toast({
                    title: "Success",
                    description: "API pattern invalidated successfully",
                });
                fetchPatterns();
            } else {
                throw new Error("Failed to invalidate pattern");
            }
        } catch (error) {
            console.error("Failed to invalidate pattern:", error);
            toast({
                title: "Error",
                description: "Failed to invalidate API pattern",
                variant: "destructive",
            });
        } finally {
            setActionLoading(null);
            setShowDeleteDialog(false);
        }
    };

    const handleRedetect = async (pattern: ApiPattern) => {
        setActionLoading(pattern.id);
        try {
            const response = await fetch(
                `/api/v1/competitors/${pattern.competitorWebsiteId}/detect-api`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ forceDetection: true }),
                }
            );

            if (response.ok) {
                toast({
                    title: "Success",
                    description: "API re-detection started successfully",
                });
                fetchPatterns();
            } else {
                throw new Error("Failed to trigger re-detection");
            }
        } catch (error) {
            console.error("Failed to trigger re-detection:", error);
            toast({
                title: "Error",
                description: "Failed to trigger API re-detection",
                variant: "destructive",
            });
        } finally {
            setActionLoading(null);
        }
    };

    const getConfidenceBadge = (score: number) => {
        if (score >= 80) return <Badge className="bg-green-500">High</Badge>;
        if (score >= 60) return <Badge className="bg-yellow-500">Medium</Badge>;
        return <Badge className="bg-orange-500">Low</Badge>;
    };

    const getHealthBadge = (successCount: number, failureCount: number) => {
        const total = successCount + failureCount;
        if (total === 0) return <Badge variant="outline">No Data</Badge>;

        const successRate = (successCount / total) * 100;
        if (successRate >= 80) return <Badge className="bg-green-500">Healthy</Badge>;
        if (successRate >= 50) return <Badge className="bg-yellow-500">Degraded</Badge>;
        return <Badge className="bg-red-500">Failing</Badge>;
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "Never";
        const date = new Date(dateString);
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <p className="text-xs text-muted-foreground font-medium">Loading patterns...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Cached API Patterns</h3>
                    <p className="text-sm text-muted-foreground">
                        Manage discovered API patterns for competitor websites
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchPatterns}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Patterns table */}
            <Card>
                <CardHeader>
                    <CardTitle>API Patterns</CardTitle>
                    <CardDescription>
                        View and manage cached API patterns with confidence scores and usage metrics
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {patterns.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-sm text-muted-foreground">
                                No cached API patterns found
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                                Patterns will appear here after successful API detection
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Website</TableHead>
                                        <TableHead>API Endpoint</TableHead>
                                        <TableHead>Confidence</TableHead>
                                        <TableHead>Health</TableHead>
                                        <TableHead>Usage</TableHead>
                                        <TableHead>Last Used</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {patterns.map((pattern) => (
                                        <TableRow key={pattern.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{pattern.websiteName}</span>
                                                    <a
                                                        href={pattern.websiteUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                                                    >
                                                        {pattern.websiteUrl}
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-mono">
                                                        {pattern.pattern.method} {pattern.pattern.url}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        Format: {pattern.pattern.responseFormat}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span>{pattern.confidenceScore}%</span>
                                                    {getConfidenceBadge(pattern.confidenceScore)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getHealthBadge(pattern.successCount, pattern.failureCount)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="flex items-center gap-1 text-green-600">
                                                        <CheckCircle className="w-3 h-3" />
                                                        {pattern.successCount}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-red-600">
                                                        <XCircle className="w-3 h-3" />
                                                        {pattern.failureCount}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm">
                                                    {formatDate(pattern.lastUsedAt)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleRedetect(pattern)}
                                                        disabled={actionLoading === pattern.id}
                                                    >
                                                        <Play className="w-3 h-3 mr-1" />
                                                        Re-detect
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedPattern(pattern);
                                                            setShowDeleteDialog(true);
                                                        }}
                                                        disabled={actionLoading === pattern.id}
                                                    >
                                                        <Trash2 className="w-3 h-3 mr-1" />
                                                        Invalidate
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete confirmation dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Invalidate API Pattern?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the cached API pattern for{" "}
                            <span className="font-medium">{selectedPattern?.websiteName}</span>.
                            The next scraping operation will trigger a new API detection.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => selectedPattern && handleInvalidate(selectedPattern)}
                        >
                            Invalidate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
