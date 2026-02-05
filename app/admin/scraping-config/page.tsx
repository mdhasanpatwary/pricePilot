"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Settings, Clock, Zap, Shield } from "lucide-react";
import { ScrapingConfigEditor } from "@/components/admin/scraping/scraping-config-editor";
import { ScrapingConfigHistory } from "@/components/admin/scraping/scraping-config-history";

interface ScrapingConfig {
    preferredStrategy: string;
    requiresJavascript: boolean;
    proxyRequired: boolean;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    maxRetries: number;
    timeoutMs: number;
    priceSelectors: string[];
    currencySelector: string | null;
    fallbackRegex: string | null;
    createdAt: string;
    updatedAt: string;
}

interface SiteConfig {
    competitorWebsiteId: string;
    competitorWebsiteUrl: string;
    config: ScrapingConfig | null;
}

export default function ScrapingConfigPage() {
    const [configs, setConfigs] = useState<SiteConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSite, setSelectedSite] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch("/api/v1/scraping/configs");
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || "Failed to fetch configurations");
            }

            setConfigs(data.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const getStrategyBadge = (strategy: string) => {
        const variants: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
            http_client: { label: "HTTP Client", variant: "default" },
            http_with_proxy: { label: "HTTP + Proxy", variant: "secondary" },
            headless_browser: { label: "Headless Browser", variant: "outline" },
            headless_with_proxy: { label: "Headless + Proxy", variant: "outline" },
            stealth_browser: { label: "Stealth Browser", variant: "outline" },
        };

        const config = variants[strategy] || { label: strategy, variant: "default" as const };
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    if (loading) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Scraping Configuration</h1>
                    <p className="text-muted-foreground mt-2">
                        Configure scraping behavior for each competitor website
                    </p>
                </div>

                <div className="grid gap-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-6 w-64" />
                                <Skeleton className="h-4 w-48 mt-2" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-20 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto p-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (selectedSite) {
        const siteConfig = configs.find((c) => c.competitorWebsiteId === selectedSite);
        if (!siteConfig) {
            return null;
        }

        if (showHistory) {
            return (
                <div className="container mx-auto p-6">
                    <Button
                        variant="ghost"
                        onClick={() => setShowHistory(false)}
                        className="mb-4"
                    >
                        ← Back to Editor
                    </Button>
                    <ScrapingConfigHistory
                        competitorWebsiteId={selectedSite}
                        competitorWebsiteUrl={siteConfig.competitorWebsiteUrl}
                    />
                </div>
            );
        }

        return (
            <div className="container mx-auto p-6">
                <Button
                    variant="ghost"
                    onClick={() => setSelectedSite(null)}
                    className="mb-4"
                >
                    ← Back to List
                </Button>
                <ScrapingConfigEditor
                    competitorWebsiteId={selectedSite}
                    competitorWebsiteUrl={siteConfig.competitorWebsiteUrl}
                    initialConfig={siteConfig.config}
                    onSave={() => {
                        fetchConfigs();
                        setSelectedSite(null);
                    }}
                    onViewHistory={() => setShowHistory(true)}
                />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Scraping Configuration</h1>
                <p className="text-muted-foreground mt-2">
                    Configure scraping behavior for each competitor website
                </p>
            </div>

            {configs.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                            No competitor websites configured yet.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {configs.map((siteConfig) => (
                        <Card key={siteConfig.competitorWebsiteId} className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <CardTitle className="text-lg">
                                            {siteConfig.competitorWebsiteUrl}
                                        </CardTitle>
                                        <CardDescription className="mt-1">
                                            {siteConfig.config
                                                ? `Last updated: ${new Date(siteConfig.config.updatedAt).toLocaleString()}`
                                                : "No configuration set"}
                                        </CardDescription>
                                    </div>
                                    <Button
                                        onClick={() => setSelectedSite(siteConfig.competitorWebsiteId)}
                                        size="sm"
                                    >
                                        <Settings className="h-4 w-4 mr-2" />
                                        Configure
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {siteConfig.config ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="space-y-1">
                                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                <Zap className="h-3 w-3" />
                                                Strategy
                                            </div>
                                            <div>{getStrategyBadge(siteConfig.config.preferredStrategy)}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                Rate Limits
                                            </div>
                                            <div className="text-sm font-medium">
                                                {siteConfig.config.baseDelayMs}ms - {siteConfig.config.maxDelayMs}ms
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                <Shield className="h-3 w-3" />
                                                Timeouts
                                            </div>
                                            <div className="text-sm font-medium">
                                                {siteConfig.config.timeoutMs}ms
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-sm text-muted-foreground">Selectors</div>
                                            <div className="text-sm font-medium">
                                                {siteConfig.config.priceSelectors.length} configured
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Click Configure to set up scraping parameters for this site
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
