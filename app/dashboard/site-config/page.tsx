"use client";

import { useState, useEffect } from "react";
import {
    Settings,
    RefreshCw,
    Clock,
    Save,
    Zap,
    Shield,
    AlertCircle,
    Info,
    CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface TenantSiteConfig {
    siteId: string;
    domain: string;
    sessionWarmup: boolean;
    delays: {
        min: number;
        max: number;
    };
    allowedRanges: {
        minDelay: number;
        maxDelay: number;
    };
}

interface SiteConfigResponse {
    success: boolean;
    data: {
        sites: TenantSiteConfig[];
        planType: string;
    };
}

interface SiteConfigState extends TenantSiteConfig {
    isDirty: boolean;
    isSaving: boolean;
    errors: string[];
}

export default function TenantSiteConfigPage() {
    const [configs, setConfigs] = useState<SiteConfigState[]>([]);
    const [loading, setLoading] = useState(true);
    const [planType, setPlanType] = useState<string>("");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchSiteConfigs = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/v1/tenant/site-config");
            if (res.ok) {
                const json: SiteConfigResponse = await res.json();
                setConfigs(
                    json.data.sites.map((site) => ({
                        ...site,
                        isDirty: false,
                        isSaving: false,
                        errors: [],
                    }))
                );
                setPlanType(json.data.planType);
                setLastUpdated(new Date());
            } else {
                console.error("Failed to fetch site configurations");
            }
        } catch (error) {
            console.error("Error fetching site configurations:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSiteConfigs();
    }, []);

    const updateConfig = (
        siteId: string,
        updates: Partial<Omit<SiteConfigState, "siteId" | "domain" | "allowedRanges">>
    ) => {
        setConfigs((prev) =>
            prev.map((config) =>
                config.siteId === siteId
                    ? { ...config, ...updates, isDirty: true, errors: [] }
                    : config
            )
        );
    };

    const validateConfig = (config: SiteConfigState): string[] => {
        const errors: string[] = [];

        if (config.delays.min < config.allowedRanges.minDelay) {
            errors.push(
                `Minimum delay must be at least ${config.allowedRanges.minDelay}ms for your plan`
            );
        }

        if (config.delays.max > config.allowedRanges.maxDelay) {
            errors.push(
                `Maximum delay cannot exceed ${config.allowedRanges.maxDelay}ms for your plan`
            );
        }

        if (config.delays.min > config.delays.max) {
            errors.push("Minimum delay cannot be greater than maximum delay");
        }

        if (config.delays.min < 0 || config.delays.max < 0) {
            errors.push("Delay values must be non-negative");
        }

        return errors;
    };

    const saveConfig = async (siteId: string) => {
        const config = configs.find((c) => c.siteId === siteId);
        if (!config) return;

        // Validate
        const errors = validateConfig(config);
        if (errors.length > 0) {
            setConfigs((prev) =>
                prev.map((c) => (c.siteId === siteId ? { ...c, errors } : c))
            );
            return;
        }

        // Save
        setConfigs((prev) =>
            prev.map((c) =>
                c.siteId === siteId ? { ...c, isSaving: true, errors: [] } : c
            )
        );

        try {
            const res = await fetch(`/api/v1/tenant/site-config/${siteId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sessionWarmup: config.sessionWarmup,
                    delays: config.delays,
                }),
            });

            const json = await res.json();

            if (res.ok && json.success) {
                setConfigs((prev) =>
                    prev.map((c) =>
                        c.siteId === siteId
                            ? { ...c, isDirty: false, isSaving: false, errors: [] }
                            : c
                    )
                );
            } else {
                setConfigs((prev) =>
                    prev.map((c) =>
                        c.siteId === siteId
                            ? {
                                ...c,
                                isSaving: false,
                                errors: json.errors || [json.error || "Failed to save configuration"],
                            }
                            : c
                    )
                );
            }
        } catch (error) {
            console.error("Error saving configuration:", error);
            setConfigs((prev) =>
                prev.map((c) =>
                    c.siteId === siteId
                        ? {
                            ...c,
                            isSaving: false,
                            errors: ["Network error: Failed to save configuration"],
                        }
                        : c
                )
            );
        }
    };

    // Calculate impact preview
    const calculateImpact = (config: SiteConfigState) => {
        const avgDelay = (config.delays.min + config.delays.max) / 2;
        const requestsPerMinute = Math.floor(60000 / avgDelay);

        // Stealth score based on delays (higher delays = more stealthy)
        const stealthScore = Math.min(
            100,
            Math.floor(
                ((avgDelay - config.allowedRanges.minDelay) /
                    (config.allowedRanges.maxDelay - config.allowedRanges.minDelay)) *
                100
            )
        );

        return {
            requestsPerMinute,
            stealthScore,
            avgDelay,
        };
    };

    if (loading && configs.length === 0) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-muted-foreground font-medium">
                        Loading site configurations...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Site Configuration
                    </h1>
                    <p className="text-muted-foreground">
                        Configure scraping settings for your competitor sites
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
                        </div>
                    )}
                    <Button
                        onClick={fetchSiteConfigs}
                        disabled={loading}
                        variant="outline"
                        size="sm"
                    >
                        <RefreshCw
                            className={cn("w-4 h-4", loading && "animate-spin")}
                        />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Plan Info */}
            {planType && (
                <Card className="p-4 bg-muted/50">
                    <div className="flex items-center gap-3">
                        <Info className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <div className="text-sm font-medium flex items-center gap-2">
                                <span>Current Plan:</span>
                                <Badge variant="outline">{planType}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Your plan determines the allowed delay ranges for scraping configuration
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Site Configuration Cards */}
            {configs.length > 0 ? (
                <div className="space-y-6">
                    {configs.map((config) => {
                        const impact = calculateImpact(config);

                        return (
                            <Card key={config.siteId} className="overflow-hidden">
                                <div className="border-b bg-muted/50 px-6 py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Settings className="w-5 h-5 text-muted-foreground" />
                                            <div>
                                                <code className="text-sm font-mono font-medium">
                                                    {config.domain}
                                                </code>
                                                {config.isDirty && (
                                                    <Badge
                                                        variant="outline"
                                                        className="ml-2 text-xs"
                                                    >
                                                        Unsaved changes
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            onClick={() => saveConfig(config.siteId)}
                                            disabled={!config.isDirty || config.isSaving}
                                            size="sm"
                                            aria-label={`Save configuration for ${config.domain}`}
                                        >
                                            {config.isSaving ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                                                    Save Configuration
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Errors */}
                                    {config.errors.length > 0 && (
                                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-4">
                                            <div className="flex gap-3">
                                                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">
                                                        Configuration Errors
                                                    </p>
                                                    <ul className="text-sm text-red-800 dark:text-red-300 space-y-1">
                                                        {config.errors.map((error, idx) => (
                                                            <li key={idx}>• {error}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Session Warmup Toggle */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label
                                                    htmlFor={`warmup-${config.siteId}`}
                                                    className="text-sm font-medium"
                                                >
                                                    Session Warmup
                                                </Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Visit initial pages before scraping to establish a natural browsing pattern
                                                </p>
                                            </div>
                                            <Switch
                                                id={`warmup-${config.siteId}`}
                                                checked={config.sessionWarmup}
                                                onCheckedChange={(checked) =>
                                                    updateConfig(config.siteId, {
                                                        sessionWarmup: checked,
                                                    })
                                                }
                                                aria-label="Toggle session warmup"
                                            />
                                        </div>
                                    </div>

                                    {/* Delay Range Sliders */}
                                    <div className="space-y-4">
                                        <div>
                                            <Label className="text-sm font-medium mb-3 block">
                                                Request Delays
                                            </Label>
                                            <p className="text-xs text-muted-foreground mb-4">
                                                Configure the delay range between requests. Higher delays improve stealth but reduce speed.
                                            </p>

                                            {/* Minimum Delay */}
                                            <div className="space-y-3 mb-6">
                                                <div className="flex items-center justify-between">
                                                    <Label
                                                        htmlFor={`min-delay-${config.siteId}`}
                                                        className="text-sm"
                                                    >
                                                        Minimum Delay
                                                    </Label>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-mono font-medium">
                                                            {config.delays.min}ms
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            (Range: {config.allowedRanges.minDelay}-
                                                            {config.allowedRanges.maxDelay}ms)
                                                        </span>
                                                    </div>
                                                </div>
                                                <Slider
                                                    id={`min-delay-${config.siteId}`}
                                                    min={config.allowedRanges.minDelay}
                                                    max={config.allowedRanges.maxDelay}
                                                    step={100}
                                                    value={[config.delays.min]}
                                                    onValueChange={([value]) =>
                                                        updateConfig(config.siteId, {
                                                            delays: {
                                                                ...config.delays,
                                                                min: value,
                                                            },
                                                        })
                                                    }
                                                    aria-label={`Minimum delay: ${config.delays.min} milliseconds`}
                                                    aria-valuemin={config.allowedRanges.minDelay}
                                                    aria-valuemax={config.allowedRanges.maxDelay}
                                                    aria-valuenow={config.delays.min}
                                                />
                                            </div>

                                            {/* Maximum Delay */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label
                                                        htmlFor={`max-delay-${config.siteId}`}
                                                        className="text-sm"
                                                    >
                                                        Maximum Delay
                                                    </Label>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-mono font-medium">
                                                            {config.delays.max}ms
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            (Range: {config.allowedRanges.minDelay}-
                                                            {config.allowedRanges.maxDelay}ms)
                                                        </span>
                                                    </div>
                                                </div>
                                                <Slider
                                                    id={`max-delay-${config.siteId}`}
                                                    min={config.allowedRanges.minDelay}
                                                    max={config.allowedRanges.maxDelay}
                                                    step={100}
                                                    value={[config.delays.max]}
                                                    onValueChange={([value]) =>
                                                        updateConfig(config.siteId, {
                                                            delays: {
                                                                ...config.delays,
                                                                max: value,
                                                            },
                                                        })
                                                    }
                                                    aria-label={`Maximum delay: ${config.delays.max} milliseconds`}
                                                    aria-valuemin={config.allowedRanges.minDelay}
                                                    aria-valuemax={config.allowedRanges.maxDelay}
                                                    aria-valuenow={config.delays.max}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Impact Preview */}
                                    <div className="border-t pt-6">
                                        <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                                            <Zap className="w-4 h-4" />
                                            Configuration Impact Preview
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="bg-muted/50 rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                        Avg Delay
                                                    </p>
                                                </div>
                                                <p className="text-xl font-bold">
                                                    {impact.avgDelay}ms
                                                </p>
                                            </div>

                                            <div className="bg-muted/50 rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Zap className="w-4 h-4 text-muted-foreground" />
                                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                        Speed
                                                    </p>
                                                </div>
                                                <p className="text-xl font-bold">
                                                    ~{impact.requestsPerMinute} req/min
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Estimated throughput
                                                </p>
                                            </div>

                                            <div className="bg-muted/50 rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Shield className="w-4 h-4 text-muted-foreground" />
                                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                        Stealth Score
                                                    </p>
                                                </div>
                                                <div className="flex items-baseline gap-2">
                                                    <p
                                                        className={cn(
                                                            "text-xl font-bold",
                                                            impact.stealthScore >= 70
                                                                ? "text-emerald-600 dark:text-emerald-500"
                                                                : impact.stealthScore >= 40
                                                                    ? "text-amber-600 dark:text-amber-500"
                                                                    : "text-red-600 dark:text-red-500"
                                                        )}
                                                    >
                                                        {impact.stealthScore}
                                                    </p>
                                                    <span className="text-sm text-muted-foreground">
                                                        / 100
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {impact.stealthScore >= 70
                                                        ? "High stealth"
                                                        : impact.stealthScore >= 40
                                                            ? "Moderate stealth"
                                                            : "Low stealth"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
                                            <div className="flex gap-3">
                                                <Info className="w-5 h-5 text-blue-600 dark:text-blue-500 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <p className="text-sm text-blue-900 dark:text-blue-200">
                                                        <strong>Recommendation:</strong>{" "}
                                                        {impact.stealthScore >= 70
                                                            ? "Your current settings provide excellent stealth. This configuration minimizes detection risk."
                                                            : impact.stealthScore >= 40
                                                                ? "Your settings balance speed and stealth. Consider increasing delays if you experience blocks."
                                                                : "Your settings prioritize speed over stealth. Increase delays if you encounter blocking or detection."}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Success Message */}
                                    {!config.isDirty && !config.isSaving && config.errors.length === 0 && (
                                        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg p-4">
                                            <div className="flex gap-3">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-500 flex-shrink-0" />
                                                <p className="text-sm text-emerald-900 dark:text-emerald-200">
                                                    Configuration saved successfully. Changes will apply to future scraping sessions.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <Card className="p-12">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <Settings className="w-12 h-12 text-muted-foreground opacity-50" />
                        <div>
                            <h3 className="font-semibold text-lg mb-1">
                                No Sites Configured
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Add competitor sites to configure their scraping settings
                            </p>
                        </div>
                        <Button className="mt-2" asChild>
                            <Link href="/dashboard/competitors">Add Competitors</Link>
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
}
