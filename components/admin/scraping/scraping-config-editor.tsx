"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, Loader2, Plus, X, History, TestTube } from "lucide-react";

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
}

interface ScrapingConfigEditorProps {
    competitorWebsiteId: string;
    competitorWebsiteUrl: string;
    initialConfig: ScrapingConfig | null;
    onSave: () => void;
    onViewHistory: () => void;
}

const DEFAULT_CONFIG: ScrapingConfig = {
    preferredStrategy: "http_client",
    requiresJavascript: false,
    proxyRequired: false,
    baseDelayMs: 2000,
    maxDelayMs: 300000,
    backoffMultiplier: 2.0,
    maxRetries: 3,
    timeoutMs: 30000,
    priceSelectors: [],
    currencySelector: null,
    fallbackRegex: null,
};

export function ScrapingConfigEditor({
    competitorWebsiteId,
    competitorWebsiteUrl,
    initialConfig,
    onSave,
    onViewHistory,
}: ScrapingConfigEditorProps) {
    const [config, setConfig] = useState<ScrapingConfig>(initialConfig || DEFAULT_CONFIG);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [testResult, setTestResult] = useState<any>(null);

    const validateConfig = (): boolean => {
        const errors: Record<string, string> = {};

        if (config.baseDelayMs < 0) {
            errors.baseDelayMs = "Base delay must be positive";
        }

        if (config.maxDelayMs < config.baseDelayMs) {
            errors.maxDelayMs = "Max delay must be greater than base delay";
        }

        if (config.backoffMultiplier < 1) {
            errors.backoffMultiplier = "Backoff multiplier must be at least 1";
        }

        if (config.maxRetries < 0) {
            errors.maxRetries = "Max retries must be positive";
        }

        if (config.timeoutMs < 1000) {
            errors.timeoutMs = "Timeout must be at least 1000ms";
        }

        if (config.priceSelectors.length === 0) {
            errors.priceSelectors = "At least one price selector is required";
        }

        // Validate CSS selectors
        config.priceSelectors.forEach((selector, index) => {
            if (!selector.trim()) {
                errors[`selector_${index}`] = "Selector cannot be empty";
            }
        });

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!validateConfig()) {
            setError("Please fix validation errors before saving");
            return;
        }

        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            const response = await fetch(`/api/v1/scraping/configs/${competitorWebsiteId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(config),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || "Failed to save configuration");
            }

            setSuccess("Configuration saved successfully");
            setTimeout(() => {
                onSave();
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!validateConfig()) {
            setError("Please fix validation errors before testing");
            return;
        }

        try {
            setTesting(true);
            setError(null);
            setTestResult(null);

            const response = await fetch(`/api/v1/scraping/configs/${competitorWebsiteId}/test`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(config),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || "Test failed");
            }

            setTestResult(data.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Test failed");
        } finally {
            setTesting(false);
        }
    };

    const addSelector = () => {
        setConfig({
            ...config,
            priceSelectors: [...config.priceSelectors, ""],
        });
    };

    const removeSelector = (index: number) => {
        setConfig({
            ...config,
            priceSelectors: config.priceSelectors.filter((_, i) => i !== index),
        });
    };

    const updateSelector = (index: number, value: string) => {
        const newSelectors = [...config.priceSelectors];
        newSelectors[index] = value;
        setConfig({
            ...config,
            priceSelectors: newSelectors,
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Configure Scraping</h2>
                    <p className="text-muted-foreground mt-1">{competitorWebsiteUrl}</p>
                </div>
                <Button variant="outline" onClick={onViewHistory}>
                    <History className="h-4 w-4 mr-2" />
                    View History
                </Button>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {success && (
                <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            {testResult && (
                <Alert variant={testResult.success ? "default" : "destructive"}>
                    <AlertDescription>
                        <div className="space-y-2">
                            <div className="font-semibold">
                                Test {testResult.success ? "Successful" : "Failed"}
                            </div>
                            {testResult.price && (
                                <div>Extracted Price: {testResult.price}</div>
                            )}
                            {testResult.responseTime && (
                                <div>Response Time: {testResult.responseTime}ms</div>
                            )}
                            {testResult.error && (
                                <div className="text-sm">{testResult.error}</div>
                            )}
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Strategy Configuration</CardTitle>
                    <CardDescription>
                        Choose the scraping method and behavior
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="strategy">Preferred Strategy</Label>
                        <Select
                            value={config.preferredStrategy}
                            onValueChange={(value) =>
                                setConfig({ ...config, preferredStrategy: value })
                            }
                        >
                            <SelectTrigger id="strategy">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="http_client">HTTP Client</SelectItem>
                                <SelectItem value="http_with_proxy">HTTP Client with Proxy</SelectItem>
                                <SelectItem value="headless_browser">Headless Browser</SelectItem>
                                <SelectItem value="headless_with_proxy">Headless Browser with Proxy</SelectItem>
                                <SelectItem value="stealth_browser">Stealth Browser</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Requires JavaScript</Label>
                            <p className="text-sm text-muted-foreground">
                                Enable if the site requires JavaScript execution
                            </p>
                        </div>
                        <Switch
                            checked={config.requiresJavascript}
                            onCheckedChange={(checked) =>
                                setConfig({ ...config, requiresJavascript: checked })
                            }
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Proxy Required</Label>
                            <p className="text-sm text-muted-foreground">
                                Always use proxy for this site
                            </p>
                        </div>
                        <Switch
                            checked={config.proxyRequired}
                            onCheckedChange={(checked) =>
                                setConfig({ ...config, proxyRequired: checked })
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Rate Limiting & Timeouts</CardTitle>
                    <CardDescription>
                        Configure delays and retry behavior
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="baseDelay">Base Delay (ms)</Label>
                            <Input
                                id="baseDelay"
                                type="number"
                                value={config.baseDelayMs}
                                onChange={(e) =>
                                    setConfig({ ...config, baseDelayMs: parseInt(e.target.value) || 0 })
                                }
                            />
                            {validationErrors.baseDelayMs && (
                                <p className="text-sm text-destructive">{validationErrors.baseDelayMs}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="maxDelay">Max Delay (ms)</Label>
                            <Input
                                id="maxDelay"
                                type="number"
                                value={config.maxDelayMs}
                                onChange={(e) =>
                                    setConfig({ ...config, maxDelayMs: parseInt(e.target.value) || 0 })
                                }
                            />
                            {validationErrors.maxDelayMs && (
                                <p className="text-sm text-destructive">{validationErrors.maxDelayMs}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="backoff">Backoff Multiplier</Label>
                            <Input
                                id="backoff"
                                type="number"
                                step="0.1"
                                value={config.backoffMultiplier}
                                onChange={(e) =>
                                    setConfig({ ...config, backoffMultiplier: parseFloat(e.target.value) || 1 })
                                }
                            />
                            {validationErrors.backoffMultiplier && (
                                <p className="text-sm text-destructive">{validationErrors.backoffMultiplier}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="maxRetries">Max Retries</Label>
                            <Input
                                id="maxRetries"
                                type="number"
                                value={config.maxRetries}
                                onChange={(e) =>
                                    setConfig({ ...config, maxRetries: parseInt(e.target.value) || 0 })
                                }
                            />
                            {validationErrors.maxRetries && (
                                <p className="text-sm text-destructive">{validationErrors.maxRetries}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="timeout">Timeout (ms)</Label>
                        <Input
                            id="timeout"
                            type="number"
                            value={config.timeoutMs}
                            onChange={(e) =>
                                setConfig({ ...config, timeoutMs: parseInt(e.target.value) || 0 })
                            }
                        />
                        {validationErrors.timeoutMs && (
                            <p className="text-sm text-destructive">{validationErrors.timeoutMs}</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Price Selectors</CardTitle>
                    <CardDescription>
                        CSS selectors for extracting price data (in priority order)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {config.priceSelectors.map((selector, index) => (
                        <div key={index} className="flex gap-2">
                            <div className="flex-1 space-y-2">
                                <Input
                                    placeholder="e.g., .price, #product-price, [data-price]"
                                    value={selector}
                                    onChange={(e) => updateSelector(index, e.target.value)}
                                />
                                {validationErrors[`selector_${index}`] && (
                                    <p className="text-sm text-destructive">
                                        {validationErrors[`selector_${index}`]}
                                    </p>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeSelector(index)}
                                disabled={config.priceSelectors.length === 1}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}

                    {validationErrors.priceSelectors && (
                        <p className="text-sm text-destructive">{validationErrors.priceSelectors}</p>
                    )}

                    <Button variant="outline" onClick={addSelector} className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Selector
                    </Button>

                    <div className="space-y-2">
                        <Label htmlFor="currencySelector">Currency Selector (Optional)</Label>
                        <Input
                            id="currencySelector"
                            placeholder="e.g., .currency, [data-currency]"
                            value={config.currencySelector || ""}
                            onChange={(e) =>
                                setConfig({ ...config, currencySelector: e.target.value || null })
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="fallbackRegex">Fallback Regex (Optional)</Label>
                        <Textarea
                            id="fallbackRegex"
                            placeholder="e.g., \$?(\d+\.?\d*)"
                            value={config.fallbackRegex || ""}
                            onChange={(e) =>
                                setConfig({ ...config, fallbackRegex: e.target.value || null })
                            }
                            rows={2}
                        />
                        <p className="text-sm text-muted-foreground">
                            Regex pattern to extract price if selectors fail
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="flex gap-4">
                <Button onClick={handleTest} disabled={testing || saving} variant="outline">
                    {testing ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Testing...
                        </>
                    ) : (
                        <>
                            <TestTube className="h-4 w-4 mr-2" />
                            Test Configuration
                        </>
                    )}
                </Button>
                <Button onClick={handleSave} disabled={saving || testing}>
                    {saving ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        "Save Configuration"
                    )}
                </Button>
            </div>
        </div>
    );
}
