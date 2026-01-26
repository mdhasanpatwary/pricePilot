"use client";

import { useState, useEffect } from "react";
import {
    Settings,
    Save,
    RotateCcw,
    Keyboard,
    MousePointer,
    Clock,
    CheckCircle,
    AlertCircle,
    Info,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface HumanSimulationConfig {
    typing: {
        minDelay: number;
        maxDelay: number;
    };
    actionPause: {
        minDelay: number;
        maxDelay: number;
    };
    mouseMovement: {
        enabled: boolean;
        naturalCurves: boolean;
    };
    formInteraction: {
        pauseBetweenFields: number;
        simulateCorrections: boolean;
    };
}

const DEFAULT_CONFIG: HumanSimulationConfig = {
    typing: {
        minDelay: 50,
        maxDelay: 150,
    },
    actionPause: {
        minDelay: 100,
        maxDelay: 2000,
    },
    mouseMovement: {
        enabled: true,
        naturalCurves: true,
    },
    formInteraction: {
        pauseBetweenFields: 500,
        simulateCorrections: true,
    },
};

// Recommended ranges based on human behavior research
const RECOMMENDED_RANGES = {
    typing: {
        minDelay: { min: 10, max: 500, recommended: 50 },
        maxDelay: { min: 50, max: 1000, recommended: 150 },
    },
    actionPause: {
        minDelay: { min: 50, max: 5000, recommended: 100 },
        maxDelay: { min: 100, max: 10000, recommended: 2000 },
    },
    formInteraction: {
        pauseBetweenFields: { min: 100, max: 5000, recommended: 500 },
    },
};

export default function HumanSimulationSettings() {
    const [config, setConfig] = useState<HumanSimulationConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [successMessage, setSuccessMessage] = useState("");
    const [isDefault, setIsDefault] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    // Fetch current configuration
    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/v1/admin/human-simulation-config");
            if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) {
                    setConfig(json.data.config);
                    setIsDefault(json.data.isDefault || false);
                    setLastUpdated(json.data.lastUpdated || null);
                }
            } else {
                console.error("Failed to fetch configuration");
            }
        } catch (error) {
            console.error("Error fetching configuration:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    // Handle save
    const handleSave = async () => {
        setSaving(true);
        setErrors([]);
        setSuccessMessage("");

        try {
            const res = await fetch("/api/v1/admin/human-simulation-config", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ config }),
            });

            const json = await res.json();

            if (res.ok && json.success) {
                setSuccessMessage("Configuration updated successfully");
                setIsDefault(false);
                setLastUpdated(json.data.lastUpdated);
                // Clear success message after 3 seconds
                setTimeout(() => setSuccessMessage(""), 3000);
            } else {
                setErrors(json.errors || [json.error || "Failed to save configuration"]);
            }
        } catch (error) {
            setErrors(["Failed to save configuration. Please try again."]);
        } finally {
            setSaving(false);
        }
    };

    // Handle reset to defaults
    const handleReset = () => {
        setConfig(DEFAULT_CONFIG);
        setErrors([]);
        setSuccessMessage("");
    };

    // Update config helpers
    const updateTypingMinDelay = (value: number[]) => {
        setConfig((prev) => ({
            ...prev,
            typing: { ...prev.typing, minDelay: value[0] },
        }));
    };

    const updateTypingMaxDelay = (value: number[]) => {
        setConfig((prev) => ({
            ...prev,
            typing: { ...prev.typing, maxDelay: value[0] },
        }));
    };

    const updateActionPauseMin = (value: number[]) => {
        setConfig((prev) => ({
            ...prev,
            actionPause: { ...prev.actionPause, minDelay: value[0] },
        }));
    };

    const updateActionPauseMax = (value: number[]) => {
        setConfig((prev) => ({
            ...prev,
            actionPause: { ...prev.actionPause, maxDelay: value[0] },
        }));
    };

    const updatePauseBetweenFields = (value: number[]) => {
        setConfig((prev) => ({
            ...prev,
            formInteraction: { ...prev.formInteraction, pauseBetweenFields: value[0] },
        }));
    };

    const updateMouseMovementEnabled = (checked: boolean) => {
        setConfig((prev) => ({
            ...prev,
            mouseMovement: { ...prev.mouseMovement, enabled: checked },
        }));
    };

    const updateNaturalCurves = (checked: boolean) => {
        setConfig((prev) => ({
            ...prev,
            mouseMovement: { ...prev.mouseMovement, naturalCurves: checked },
        }));
    };

    const updateSimulateCorrections = (checked: boolean) => {
        setConfig((prev) => ({
            ...prev,
            formInteraction: { ...prev.formInteraction, simulateCorrections: checked },
        }));
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-muted-foreground font-medium">
                        Loading configuration...
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
                        Human Simulation Settings
                    </h1>
                    <p className="text-muted-foreground">
                        Configure typing speeds, delays, and interaction patterns to mimic human
                        behavior
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && !isDefault && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                                Updated: {new Date(lastUpdated).toLocaleString()}
                            </span>
                        </div>
                    )}
                    {isDefault && (
                        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-md">
                            <Info className="w-3.5 h-3.5" />
                            <span>Using default values</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className="flex items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                        {successMessage}
                    </p>
                </div>
            )}

            {/* Error Messages */}
            {errors.length > 0 && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500" />
                        <p className="text-sm font-medium text-red-900 dark:text-red-100">
                            Validation Errors:
                        </p>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-800 dark:text-red-200 ml-7">
                        {errors.map((error, index) => (
                            <li key={index}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Typing Simulation */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Keyboard className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">Typing Simulation</h3>
                        <p className="text-sm text-muted-foreground">
                            Configure delays between keystrokes to simulate human typing
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Min Delay */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="typing-min" className="text-sm font-medium">
                                Minimum Typing Delay
                            </Label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-mono font-semibold">
                                    {config.typing.minDelay}ms
                                </span>
                                {config.typing.minDelay ===
                                    RECOMMENDED_RANGES.typing.minDelay.recommended && (
                                        <span className="text-xs text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                                            Recommended
                                        </span>
                                    )}
                            </div>
                        </div>
                        <Slider
                            id="typing-min"
                            min={RECOMMENDED_RANGES.typing.minDelay.min}
                            max={RECOMMENDED_RANGES.typing.minDelay.max}
                            step={10}
                            value={[config.typing.minDelay]}
                            onValueChange={updateTypingMinDelay}
                            className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                            Range: {RECOMMENDED_RANGES.typing.minDelay.min}ms -{" "}
                            {RECOMMENDED_RANGES.typing.minDelay.max}ms (Recommended:{" "}
                            {RECOMMENDED_RANGES.typing.minDelay.recommended}ms)
                        </p>
                    </div>

                    {/* Max Delay */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="typing-max" className="text-sm font-medium">
                                Maximum Typing Delay
                            </Label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-mono font-semibold">
                                    {config.typing.maxDelay}ms
                                </span>
                                {config.typing.maxDelay ===
                                    RECOMMENDED_RANGES.typing.maxDelay.recommended && (
                                        <span className="text-xs text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                                            Recommended
                                        </span>
                                    )}
                            </div>
                        </div>
                        <Slider
                            id="typing-max"
                            min={RECOMMENDED_RANGES.typing.maxDelay.min}
                            max={RECOMMENDED_RANGES.typing.maxDelay.max}
                            step={10}
                            value={[config.typing.maxDelay]}
                            onValueChange={updateTypingMaxDelay}
                            className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                            Range: {RECOMMENDED_RANGES.typing.maxDelay.min}ms -{" "}
                            {RECOMMENDED_RANGES.typing.maxDelay.max}ms (Recommended:{" "}
                            {RECOMMENDED_RANGES.typing.maxDelay.recommended}ms)
                        </p>
                    </div>
                </div>
            </Card>

            {/* Action Pauses */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">Action Pauses</h3>
                        <p className="text-sm text-muted-foreground">
                            Configure delays between actions to simulate human thinking time
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Min Pause */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="action-min" className="text-sm font-medium">
                                Minimum Action Pause
                            </Label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-mono font-semibold">
                                    {config.actionPause.minDelay}ms
                                </span>
                                {config.actionPause.minDelay ===
                                    RECOMMENDED_RANGES.actionPause.minDelay.recommended && (
                                        <span className="text-xs text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                                            Recommended
                                        </span>
                                    )}
                            </div>
                        </div>
                        <Slider
                            id="action-min"
                            min={RECOMMENDED_RANGES.actionPause.minDelay.min}
                            max={RECOMMENDED_RANGES.actionPause.minDelay.max}
                            step={50}
                            value={[config.actionPause.minDelay]}
                            onValueChange={updateActionPauseMin}
                            className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                            Range: {RECOMMENDED_RANGES.actionPause.minDelay.min}ms -{" "}
                            {RECOMMENDED_RANGES.actionPause.minDelay.max}ms (Recommended:{" "}
                            {RECOMMENDED_RANGES.actionPause.minDelay.recommended}ms)
                        </p>
                    </div>

                    {/* Max Pause */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="action-max" className="text-sm font-medium">
                                Maximum Action Pause
                            </Label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-mono font-semibold">
                                    {config.actionPause.maxDelay}ms
                                </span>
                                {config.actionPause.maxDelay ===
                                    RECOMMENDED_RANGES.actionPause.maxDelay.recommended && (
                                        <span className="text-xs text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                                            Recommended
                                        </span>
                                    )}
                            </div>
                        </div>
                        <Slider
                            id="action-max"
                            min={RECOMMENDED_RANGES.actionPause.maxDelay.min}
                            max={RECOMMENDED_RANGES.actionPause.maxDelay.max}
                            step={100}
                            value={[config.actionPause.maxDelay]}
                            onValueChange={updateActionPauseMax}
                            className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                            Range: {RECOMMENDED_RANGES.actionPause.maxDelay.min}ms -{" "}
                            {RECOMMENDED_RANGES.actionPause.maxDelay.max}ms (Recommended:{" "}
                            {RECOMMENDED_RANGES.actionPause.maxDelay.recommended}ms)
                        </p>
                    </div>
                </div>
            </Card>

            {/* Mouse Movement */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <MousePointer className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">Mouse Movement</h3>
                        <p className="text-sm text-muted-foreground">
                            Configure mouse movement simulation settings
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Enable Mouse Movement */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                        <div className="space-y-0.5">
                            <Label htmlFor="mouse-enabled" className="text-sm font-medium">
                                Enable Mouse Movement
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Simulate natural mouse movements during interactions
                            </p>
                        </div>
                        <Switch
                            id="mouse-enabled"
                            checked={config.mouseMovement.enabled}
                            onCheckedChange={updateMouseMovementEnabled}
                        />
                    </div>

                    {/* Natural Curves */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                        <div className="space-y-0.5">
                            <Label htmlFor="natural-curves" className="text-sm font-medium">
                                Natural Curves
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Use bezier curves for more realistic mouse paths
                            </p>
                        </div>
                        <Switch
                            id="natural-curves"
                            checked={config.mouseMovement.naturalCurves}
                            onCheckedChange={updateNaturalCurves}
                            disabled={!config.mouseMovement.enabled}
                        />
                    </div>
                </div>
            </Card>

            {/* Form Interaction */}
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Settings className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">Form Interaction</h3>
                        <p className="text-sm text-muted-foreground">
                            Configure form filling behavior and corrections
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Pause Between Fields */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="pause-fields" className="text-sm font-medium">
                                Pause Between Fields
                            </Label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-mono font-semibold">
                                    {config.formInteraction.pauseBetweenFields}ms
                                </span>
                                {config.formInteraction.pauseBetweenFields ===
                                    RECOMMENDED_RANGES.formInteraction.pauseBetweenFields
                                        .recommended && (
                                        <span className="text-xs text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                                            Recommended
                                        </span>
                                    )}
                            </div>
                        </div>
                        <Slider
                            id="pause-fields"
                            min={RECOMMENDED_RANGES.formInteraction.pauseBetweenFields.min}
                            max={RECOMMENDED_RANGES.formInteraction.pauseBetweenFields.max}
                            step={50}
                            value={[config.formInteraction.pauseBetweenFields]}
                            onValueChange={updatePauseBetweenFields}
                            className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">
                            Range: {RECOMMENDED_RANGES.formInteraction.pauseBetweenFields.min}ms -{" "}
                            {RECOMMENDED_RANGES.formInteraction.pauseBetweenFields.max}ms
                            (Recommended:{" "}
                            {RECOMMENDED_RANGES.formInteraction.pauseBetweenFields.recommended}ms)
                        </p>
                    </div>

                    {/* Simulate Corrections */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                        <div className="space-y-0.5">
                            <Label htmlFor="simulate-corrections" className="text-sm font-medium">
                                Simulate Typing Corrections
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Occasionally make and correct typing mistakes
                            </p>
                        </div>
                        <Switch
                            id="simulate-corrections"
                            checked={config.formInteraction.simulateCorrections}
                            onCheckedChange={updateSimulateCorrections}
                        />
                    </div>
                </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4">
                <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={saving}
                    className="gap-2"
                >
                    <RotateCcw className="w-4 h-4" />
                    Reset to Defaults
                </Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            Save Configuration
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
