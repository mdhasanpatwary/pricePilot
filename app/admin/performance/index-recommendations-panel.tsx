"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Copy } from "lucide-react";

interface IndexSuggestion {
    tableName: string;
    columns: string[];
    reason: string;
    estimatedImpact: 'high' | 'medium' | 'low';
    createStatement: string;
}

interface UnusedIndex {
    indexName: string;
    tableName: string;
    sizeBytes: number;
    sizeMB: string;
    lastUsed: string | null;
    dropStatement: string;
}

interface IndexRecommendationsData {
    healthStatus: 'healthy' | 'warning' | 'critical';
    suggestions: {
        high: IndexSuggestion[];
        medium: IndexSuggestion[];
        low: IndexSuggestion[];
    };
    unusedIndexes: UnusedIndex[];
    statistics: {
        totalIndexes: number;
        totalIndexSizeMB: string;
        unusedIndexCount: number;
        unusedIndexSizeMB: string;
        fragmentedIndexes: number;
        potentialSavingsMB: string;
    };
    summary: {
        totalSuggestions: number;
        highImpactCount: number;
        mediumImpactCount: number;
        lowImpactCount: number;
    };
}

export function IndexRecommendationsPanel() {
    const [data, setData] = useState<IndexRecommendationsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/v1/admin/performance/index-recommendations');
            if (!res.ok) throw new Error('Failed to fetch index recommendations');
            const result = await res.json();
            setData(result.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(id);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const getHealthIcon = (status: string) => {
        switch (status) {
            case 'healthy': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            case 'critical': return <XCircle className="w-5 h-5 text-red-500" />;
            default: return null;
        }
    };

    const getImpactBadge = (impact: string) => {
        switch (impact) {
            case 'high': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">High Impact</Badge>;
            case 'medium': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Medium Impact</Badge>;
            case 'low': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Low Impact</Badge>;
            default: return null;
        }
    };

    if (loading && !data) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading index recommendations...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-2">
                        <XCircle className="w-6 h-6 text-red-500" />
                        <p className="text-sm text-red-600">{error}</p>
                        <Button onClick={fetchData} variant="outline" size="sm">
                            Retry
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const renderSuggestions = (suggestions: IndexSuggestion[], impact: string) => (
        <div className="space-y-4">
            {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                    No {impact} impact suggestions at this time
                </p>
            ) : (
                suggestions.map((suggestion, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h4 className="font-medium">{suggestion.tableName}</h4>
                                <p className="text-sm text-muted-foreground mt-1">{suggestion.reason}</p>
                            </div>
                            {getImpactBadge(suggestion.estimatedImpact)}
                        </div>
                        <div className="text-sm">
                            <span className="text-muted-foreground">Columns:</span>
                            <span className="ml-2 font-mono">{suggestion.columns.join(', ')}</span>
                        </div>
                        <div className="relative">
                            <code className="text-xs bg-muted p-3 rounded block overflow-x-auto">
                                {suggestion.createStatement}
                            </code>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="absolute top-2 right-2"
                                onClick={() => copyToClipboard(suggestion.createStatement, `${suggestion.tableName}-${index}`)}
                            >
                                {copiedIndex === `${suggestion.tableName}-${index}` ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Health Status</CardTitle>
                        {data && getHealthIcon(data.healthStatus)}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">{data?.healthStatus}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Indexes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.statistics.totalIndexes}</div>
                        <p className="text-xs text-muted-foreground">{data?.statistics.totalIndexSizeMB} MB</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Unused Indexes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.statistics.unusedIndexCount}</div>
                        <p className="text-xs text-muted-foreground">{data?.statistics.unusedIndexSizeMB} MB wasted</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Fragmented</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.statistics.fragmentedIndexes}</div>
                        <p className="text-xs text-muted-foreground">Need rebuilding</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recommendations */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Index Recommendations</CardTitle>
                            <CardDescription>
                                {data?.summary.totalSuggestions} suggestions ({data?.summary.highImpactCount} high, {data?.summary.mediumImpactCount} medium, {data?.summary.lowImpactCount} low)
                            </CardDescription>
                        </div>
                        <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="high">
                        <TabsList>
                            <TabsTrigger value="high">
                                High Impact ({data?.summary.highImpactCount})
                            </TabsTrigger>
                            <TabsTrigger value="medium">
                                Medium Impact ({data?.summary.mediumImpactCount})
                            </TabsTrigger>
                            <TabsTrigger value="low">
                                Low Impact ({data?.summary.lowImpactCount})
                            </TabsTrigger>
                            <TabsTrigger value="unused">
                                Unused ({data?.statistics.unusedIndexCount})
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="high" className="mt-4">
                            {data && renderSuggestions(data.suggestions.high, 'high')}
                        </TabsContent>
                        <TabsContent value="medium" className="mt-4">
                            {data && renderSuggestions(data.suggestions.medium, 'medium')}
                        </TabsContent>
                        <TabsContent value="low" className="mt-4">
                            {data && renderSuggestions(data.suggestions.low, 'low')}
                        </TabsContent>
                        <TabsContent value="unused" className="mt-4">
                            <div className="space-y-4">
                                {data?.unusedIndexes.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        No unused indexes found
                                    </p>
                                ) : (
                                    data?.unusedIndexes.map((index, i) => (
                                        <div key={i} className="border rounded-lg p-4 space-y-3">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <h4 className="font-medium">{index.indexName}</h4>
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        Table: {index.tableName}
                                                    </p>
                                                </div>
                                                <Badge variant="outline">{index.sizeMB} MB</Badge>
                                            </div>
                                            <div className="text-sm">
                                                <span className="text-muted-foreground">Last Used:</span>
                                                <span className="ml-2">
                                                    {index.lastUsed ? new Date(index.lastUsed).toLocaleString() : 'Never'}
                                                </span>
                                            </div>
                                            <div className="relative">
                                                <code className="text-xs bg-muted p-3 rounded block overflow-x-auto">
                                                    {index.dropStatement}
                                                </code>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="absolute top-2 right-2"
                                                    onClick={() => copyToClipboard(index.dropStatement, `unused-${i}`)}
                                                >
                                                    {copiedIndex === `unused-${i}` ? (
                                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <Copy className="w-4 h-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
