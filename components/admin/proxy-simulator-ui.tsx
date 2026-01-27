"use client";

import { useState, useEffect } from "react";
import {
    Play,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    BarChart3,
    Download,
    Settings,
    TrendingUp,
    TrendingDown,
    Clock,
    Globe,
    RefreshCw,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    SimulationConfig,
    SimulationResultData,
    SimulationScenario,
    ProxyType,
    FailureType,
    ProxyConfig,
} from "@/lib/types/admin-dashboard";

interface ProxySimulatorUIProps {
    onSimulationComplete?: (result: SimulationResultData) => void;
}

// Scenario descriptions
const SCENARIO_INFO: Record<
    SimulationScenario,
    { label: string; description: string; icon: React.ComponentType<{ className?: string }> }
> = {
    rotation: {
        label: "Proxy Rotation",
        description: "Test round-robin proxy selection and rotation patterns",
        icon: RefreshCw,
    },
    failure: {
        label: "Failure Handling",
        description: "Simulate random proxy failures with configurable failure rate",
        icon: XCircle,
    },
    exclusion: {
        label: "Proxy Exclusion",
        description: "Test proxy exclusion mechanism when proxies are marked unhealthy",
        icon: Trash2,
    },
    prioritization: {
        label: "Prioritization",
        description: "Test proxy selection based on type and success rate",
        icon: TrendingUp,
    },
    recovery: {
        label: "Proxy Recovery",
        description: "Test how failed proxies are reintroduced after health checks",
        icon: CheckCircle2,
    },
    cascading_failure: {
        label: "Cascading Failures",
        description: "Simulate increasing failure probability with consecutive failures",
        icon: TrendingDown,
    },
    all_fail: {
        label: "All Proxies Fail",
        description: "Test behavior when all proxies in the pool are unhealthy",
        icon: AlertCircle,
    },
    single_success: {
        label: "Single Proxy Success",
        description: "Test finding the one working proxy through rotation",
        icon: CheckCircle2,
    },
    intermittent: {
        label: "Intermittent Failures",
        description: "Test handling of alternating success and failure patterns",
        icon: BarChart3,
    },
};

// Configuration Form Component
function ConfigurationForm({
    config,
    onChange,
    onSubmit,
    isRunning,
}: {
    config: Partial<SimulationConfig>;
    onChange: (config: Partial<SimulationConfig>) => void;
    onSubmit: () => void;
    isRunning: boolean;
}) {
    const [proxyInput, setProxyInput] = useState("");
    const [proxyType, setProxyType] = useState<ProxyType>("datacenter");

    const addProxy = () => {
        if (!proxyInput.trim()) return;

        const newProxy: ProxyConfig = {
            url: proxyInput.trim(),
            type: proxyType,
        };

        onChange({
            ...config,
            proxyPool: [...(config.proxyPool || []), newProxy],
        });

        setProxyInput("");
    };

    const removeProxy = (index: number) => {
        const newPool = [...(config.proxyPool || [])];
        newPool.splice(index, 1);
        onChange({ ...config, proxyPool: newPool });
    };

    const isValid =
        config.scenario &&
        config.targetSite &&
        config.proxyPool &&
        config.proxyPool.length > 0 &&
        config.requestCount &&
        config.requestCount > 0;

    return (
        <div className="space-y-6">
            {/* Scenario Selection */}
            <div className="space-y-2">
                <Label htmlFor="scenario">Scenario *</Label>
                <Select
                    value={config.scenario}
                    onValueChange={(value) =>
                        onChange({ ...config, scenario: value as SimulationScenario })
                    }
                >
                    <SelectTrigger id="scenario">
                        <SelectValue placeholder="Select a scenario" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(SCENARIO_INFO).map(([key, info]) => {
                            const Icon = info.icon;
                            return (
                                <SelectItem key={key} value={key}>
                                    <div className="flex items-center gap-2">
                                        <Icon className="w-4 h-4" />
                                        <span>{info.label}</span>
                                    </div>
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
                {config.scenario && (
                    <p className="text-xs text-muted-foreground">
                        {SCENARIO_INFO[config.scenario].description}
                    </p>
                )}
            </div>

            {/* Target Site */}
            <div className="space-y-2">
                <Label htmlFor="targetSite">Target Site *</Label>
                <Input
                    id="targetSite"
                    placeholder="https://example.com"
                    value={config.targetSite || ""}
                    onChange={(e) => onChange({ ...config, targetSite: e.target.value })}
                />
            </div>

            {/* Proxy Pool */}
            <div className="space-y-2">
                <Label>Proxy Pool * ({config.proxyPool?.length || 0} proxies)</Label>
                <div className="flex gap-2">
                    <Input
                        placeholder="http://proxy.example.com:8080"
                        value={proxyInput}
                        onChange={(e) => setProxyInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addProxy()}
                    />
                    <Select
                        value={proxyType}
                        onValueChange={(value) => setProxyType(value as ProxyType)}
                    >
                        <SelectTrigger className="w-[140px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="datacenter">Datacenter</SelectItem>
                            <SelectItem value="residential">Residential</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button type="button" onClick={addProxy} variant="outline">
                        Add
                    </Button>
                </div>

                {config.proxyPool && config.proxyPool.length > 0 && (
                    <ScrollArea className="h-32 border rounded-md p-2">
                        <div className="space-y-1">
                            {config.proxyPool.map((proxy, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between gap-2 p-2 bg-muted rounded text-sm"
                                >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                        <code className="text-xs truncate">{proxy.url}</code>
                                        <Badge variant="outline" className="text-xs">
                                            {proxy.type}
                                        </Badge>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeProxy(index)}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* Request Count */}
            <div className="space-y-2">
                <Label htmlFor="requestCount">Request Count *</Label>
                <Input
                    id="requestCount"
                    type="number"
                    min="1"
                    max="1000"
                    placeholder="100"
                    value={config.requestCount || ""}
                    onChange={(e) =>
                        onChange({ ...config, requestCount: parseInt(e.target.value) || 0 })
                    }
                />
            </div>

            {/* Optional: Failure Rate (for failure scenarios) */}
            {(config.scenario === "failure" || config.scenario === "intermittent") && (
                <div className="space-y-2">
                    <Label htmlFor="failureRate">
                        Failure Rate (0-1) {config.failureRate && `(${(config.failureRate * 100).toFixed(0)}%)`}
                    </Label>
                    <Input
                        id="failureRate"
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        placeholder="0.3"
                        value={config.failureRate || ""}
                        onChange={(e) =>
                            onChange({ ...config, failureRate: parseFloat(e.target.value) || 0 })
                        }
                    />
                </div>
            )}

            {/* Optional: Failure Type */}
            {config.scenario === "failure" && (
                <div className="space-y-2">
                    <Label htmlFor="failureType">Failure Type</Label>
                    <Select
                        value={config.failureType || "timeout"}
                        onValueChange={(value) =>
                            onChange({ ...config, failureType: value as FailureType })
                        }
                    >
                        <SelectTrigger id="failureType">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="timeout">Timeout</SelectItem>
                            <SelectItem value="connection_refused">Connection Refused</SelectItem>
                            <SelectItem value="http_error">HTTP Error</SelectItem>
                            <SelectItem value="challenge">Challenge</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Optional: Delay Between Requests */}
            <div className="space-y-2">
                <Label htmlFor="delay">Delay Between Requests (ms)</Label>
                <Input
                    id="delay"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={config.delayBetweenRequests || ""}
                    onChange={(e) =>
                        onChange({
                            ...config,
                            delayBetweenRequests: parseInt(e.target.value) || 0,
                        })
                    }
                />
            </div>

            {/* Submit Button */}
            <Button
                onClick={onSubmit}
                disabled={!isValid || isRunning}
                className="w-full"
                size="lg"
            >
                {isRunning ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Running Simulation...
                    </>
                ) : (
                    <>
                        <Play className="w-4 h-4 mr-2" />
                        Run Simulation
                    </>
                )}
            </Button>
        </div>
    );
}

// Results Visualization Component
function ResultsVisualization({ result }: { result: SimulationResultData }) {
    const successRate = (result.summary.successfulRequests / result.summary.totalRequests) * 100;
    const failureRate = (result.summary.failedRequests / result.summary.totalRequests) * 100;

    // Calculate proxy usage distribution
    const proxyUsage = result.requests.reduce((acc, req) => {
        acc[req.proxyUsed] = (acc[req.proxyUsed] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const proxyUsageArray = Object.entries(proxyUsage)
        .map(([proxy, count]) => ({
            proxy,
            count,
            percentage: (count / result.requests.length) * 100,
        }))
        .sort((a, b) => b.count - a.count);

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10">
                            <BarChart3 className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total Requests</p>
                            <p className="text-xl font-semibold">{result.summary.totalRequests}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Success Rate</p>
                            <p className="text-xl font-semibold">{successRate.toFixed(1)}%</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/10">
                            <XCircle className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Failure Rate</p>
                            <p className="text-xl font-semibold">{failureRate.toFixed(1)}%</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10">
                            <Clock className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Avg Response</p>
                            <p className="text-xl font-semibold">
                                {result.summary.averageResponseTime.toFixed(0)}ms
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Success/Failure Progress */}
            <Card className="p-6">
                <h4 className="text-sm font-semibold mb-4">Request Distribution</h4>
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-green-500 font-medium">
                            Successful: {result.summary.successfulRequests}
                        </span>
                        <span className="text-red-500 font-medium">
                            Failed: {result.summary.failedRequests}
                        </span>
                    </div>
                    <div className="flex h-4 rounded-full overflow-hidden bg-muted">
                        <div
                            className="bg-green-500"
                            style={{ width: `${successRate}%` }}
                        />
                        <div
                            className="bg-red-500"
                            style={{ width: `${failureRate}%` }}
                        />
                    </div>
                </div>
            </Card>

            {/* Proxy Usage Distribution */}
            <Card className="p-6">
                <h4 className="text-sm font-semibold mb-4">
                    Proxy Usage ({result.summary.proxiesUsed} proxies)
                </h4>
                <div className="space-y-3">
                    {proxyUsageArray.map((item, index) => (
                        <div key={index} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                                <code className="text-xs">{item.proxy}</code>
                                <span className="text-muted-foreground">
                                    {item.count} ({item.percentage.toFixed(1)}%)
                                </span>
                            </div>
                            <Progress value={item.percentage} className="h-2" />
                        </div>
                    ))}
                </div>
            </Card>

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
                <Card className="p-6">
                    <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Recommendations
                    </h4>
                    <ul className="space-y-2">
                        {result.recommendations.map((rec, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                                <span className="text-muted-foreground mt-0.5">•</span>
                                <span>{rec}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </div>
    );
}

// Request Timeline Component
function RequestTimeline({ result }: { result: SimulationResultData }) {
    return (
        <Card className="p-6">
            <h4 className="text-sm font-semibold mb-4">Request Timeline</h4>
            <ScrollArea className="h-96">
                <div className="space-y-2">
                    {result.requests.map((req, index) => (
                        <div
                            key={index}
                            className={cn(
                                "flex items-center justify-between p-3 rounded-lg border",
                                req.success
                                    ? "bg-green-500/5 border-green-500/20"
                                    : "bg-red-500/5 border-red-500/20"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                {req.success ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                <div>
                                    <p className="text-sm font-medium">
                                        Request #{req.requestNumber}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {req.proxyUsed}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                {req.success ? (
                                    <p className="text-sm font-medium text-green-500">
                                        {req.responseTime}ms
                                    </p>
                                ) : (
                                    <p className="text-xs text-red-500">{req.error}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </Card>
    );
}

// Comparison View Component
function ComparisonView({ results }: { results: SimulationResultData[] }) {
    if (results.length === 0) {
        return (
            <Card className="p-12 text-center">
                <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground mt-2">
                    Run multiple simulations to compare results
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="p-6">
                <h4 className="text-sm font-semibold mb-4">Comparison Table</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b">
                            <tr>
                                <th className="text-left p-2 font-medium">Scenario</th>
                                <th className="text-right p-2 font-medium">Requests</th>
                                <th className="text-right p-2 font-medium">Success Rate</th>
                                <th className="text-right p-2 font-medium">Avg Response</th>
                                <th className="text-right p-2 font-medium">Proxies Used</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {results.map((result) => {
                                const successRate =
                                    (result.summary.successfulRequests /
                                        result.summary.totalRequests) *
                                    100;
                                return (
                                    <tr key={result.id} className="hover:bg-muted/50">
                                        <td className="p-2">
                                            <Badge variant="outline">
                                                {SCENARIO_INFO[result.scenario].label}
                                            </Badge>
                                        </td>
                                        <td className="p-2 text-right">
                                            {result.summary.totalRequests}
                                        </td>
                                        <td className="p-2 text-right">
                                            <span
                                                className={cn(
                                                    "font-medium",
                                                    successRate >= 80
                                                        ? "text-green-500"
                                                        : successRate >= 50
                                                            ? "text-yellow-500"
                                                            : "text-red-500"
                                                )}
                                            >
                                                {successRate.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="p-2 text-right">
                                            {result.summary.averageResponseTime.toFixed(0)}ms
                                        </td>
                                        <td className="p-2 text-right">
                                            {result.summary.proxiesUsed}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

// Main ProxySimulatorUI Component
export default function ProxySimulatorUI({ onSimulationComplete }: ProxySimulatorUIProps) {
    const [config, setConfig] = useState<Partial<SimulationConfig>>({
        requestCount: 100,
        delayBetweenRequests: 0,
        failureRate: 0.3,
        failureType: "timeout",
        proxyPool: [],
    });
    const [isRunning, setIsRunning] = useState(false);
    const [currentResult, setCurrentResult] = useState<SimulationResultData | null>(null);
    const [savedResults, setSavedResults] = useState<SimulationResultData[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Load saved results on mount
    useEffect(() => {
        loadSavedResults();
    }, []);

    const loadSavedResults = async () => {
        try {
            const response = await fetch("/api/v1/admin/simulator/results?limit=10");
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setSavedResults(data.data || []);
                }
            }
        } catch (err) {
            console.error("Failed to load saved results:", err);
        }
    };

    const runSimulation = async () => {
        setIsRunning(true);
        setError(null);

        try {
            const response = await fetch("/api/v1/admin/simulator/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Simulation failed");
            }

            setCurrentResult(data.data);
            setSavedResults((prev) => [data.data, ...prev].slice(0, 10));

            if (onSimulationComplete) {
                onSimulationComplete(data.data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to run simulation");
        } finally {
            setIsRunning(false);
        }
    };

    const exportResults = (result: SimulationResultData) => {
        const dataStr = JSON.stringify(result, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `simulation-${result.id}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-foreground">Proxy Simulator</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Test proxy behaviors and edge-case scenarios in an isolated environment
                </p>
            </div>

            {/* Error Display */}
            {error && (
                <Card className="p-4 bg-red-500/10 border-red-500/20">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <p className="text-sm text-red-500">{error}</p>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="lg:col-span-1">
                    <Card className="p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Settings className="w-5 h-5" />
                            <h3 className="text-lg font-semibold">Configuration</h3>
                        </div>
                        <ConfigurationForm
                            config={config}
                            onChange={setConfig}
                            onSubmit={runSimulation}
                            isRunning={isRunning}
                        />
                    </Card>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-2">
                    <Tabs defaultValue="current" className="space-y-6">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="current">Current Result</TabsTrigger>
                            <TabsTrigger value="timeline">Timeline</TabsTrigger>
                            <TabsTrigger value="comparison">
                                Compare ({savedResults.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="current">
                            {currentResult ? (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold">
                                                {SCENARIO_INFO[currentResult.scenario].label}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                Completed at{" "}
                                                {new Date(currentResult.endTime).toLocaleTimeString()}
                                            </p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => exportResults(currentResult)}
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            Export
                                        </Button>
                                    </div>
                                    <ResultsVisualization result={currentResult} />
                                </div>
                            ) : (
                                <Card className="p-12 text-center">
                                    <Play className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Configure and run a simulation to see results
                                    </p>
                                </Card>
                            )}
                        </TabsContent>

                        <TabsContent value="timeline">
                            {currentResult ? (
                                <RequestTimeline result={currentResult} />
                            ) : (
                                <Card className="p-12 text-center">
                                    <Clock className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Run a simulation to view the request timeline
                                    </p>
                                </Card>
                            )}
                        </TabsContent>

                        <TabsContent value="comparison">
                            <ComparisonView results={savedResults} />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
