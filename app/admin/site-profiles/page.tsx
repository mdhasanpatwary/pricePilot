"use client";

import { useState, useEffect } from "react";
import {
    Settings,
    Plus,
    Edit,
    Trash2,
    Save,
    X,
    Globe,
    Clock,
    Zap,
    CheckCircle,
    AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SiteProfile {
    id: string;
    domain: string;
    rateLimit: {
        requestsPerMinute: number;
        concurrentRequests: number;
    };
    adaptiveDelay: {
        min: number;
        max: number;
        multiplier: number;
    };
    sessionWarmup: {
        enabled: boolean;
        paths: string[];
    };
    referrerChain: boolean;
    createdAt: string;
    updatedAt: string;
}

interface ProfileTemplate {
    name: string;
    description: string;
    profile: Partial<SiteProfile>;
}

interface SiteProfilesResponse {
    profiles: SiteProfile[];
    templates: ProfileTemplate[];
}

const EMPTY_PROFILE: Omit<SiteProfile, "id" | "createdAt" | "updatedAt"> = {
    domain: "",
    rateLimit: {
        requestsPerMinute: 10,
        concurrentRequests: 2,
    },
    adaptiveDelay: {
        min: 1000,
        max: 3000,
        multiplier: 1.0,
    },
    sessionWarmup: {
        enabled: false,
        paths: [],
    },
    referrerChain: true,
};

export default function SiteProfilesPage() {
    const [profiles, setProfiles] = useState<SiteProfile[]>([]);
    const [templates, setTemplates] = useState<ProfileTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<SiteProfile | null>(null);
    const [formData, setFormData] = useState<Omit<SiteProfile, "id" | "createdAt" | "updatedAt">>(
        EMPTY_PROFILE
    );
    const [warmupPathInput, setWarmupPathInput] = useState("");
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [successMessage, setSuccessMessage] = useState("");
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Fetch profiles and templates
    const fetchProfiles = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/v1/admin/site-profiles");
            if (res.ok) {
                const json: SiteProfilesResponse = await res.json();
                setProfiles(json.profiles);
                setTemplates(json.templates);
            } else {
                console.error("Failed to fetch site profiles");
            }
        } catch (error) {
            console.error("Error fetching site profiles:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    // Open drawer for new profile
    const handleNewProfile = () => {
        setEditingProfile(null);
        setFormData(EMPTY_PROFILE);
        setWarmupPathInput("");
        setErrors([]);
        setSuccessMessage("");
        setIsDrawerOpen(true);
    };

    // Open drawer for editing profile
    const handleEditProfile = (profile: SiteProfile) => {
        setEditingProfile(profile);
        setFormData({
            domain: profile.domain,
            rateLimit: { ...profile.rateLimit },
            adaptiveDelay: { ...profile.adaptiveDelay },
            sessionWarmup: {
                enabled: profile.sessionWarmup.enabled,
                paths: [...profile.sessionWarmup.paths],
            },
            referrerChain: profile.referrerChain,
        });
        setWarmupPathInput("");
        setErrors([]);
        setSuccessMessage("");
        setIsDrawerOpen(true);
    };

    // Apply template
    const handleApplyTemplate = (templateName: string) => {
        const template = templates.find((t) => t.name === templateName);
        if (!template) return;

        setFormData((prev) => ({
            ...prev,
            rateLimit: template.profile.rateLimit || prev.rateLimit,
            adaptiveDelay: template.profile.adaptiveDelay || prev.adaptiveDelay,
            sessionWarmup: template.profile.sessionWarmup || prev.sessionWarmup,
            referrerChain: template.profile.referrerChain ?? prev.referrerChain,
        }));
    };

    // Add warmup path
    const handleAddWarmupPath = () => {
        if (!warmupPathInput.trim()) return;
        setFormData((prev) => ({
            ...prev,
            sessionWarmup: {
                ...prev.sessionWarmup,
                paths: [...prev.sessionWarmup.paths, warmupPathInput.trim()],
            },
        }));
        setWarmupPathInput("");
    };

    // Remove warmup path
    const handleRemoveWarmupPath = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            sessionWarmup: {
                ...prev.sessionWarmup,
                paths: prev.sessionWarmup.paths.filter((_, i) => i !== index),
            },
        }));
    };

    // Save profile
    const handleSave = async () => {
        setSaving(true);
        setErrors([]);
        setSuccessMessage("");

        try {
            const payload = editingProfile
                ? { id: editingProfile.id, ...formData }
                : formData;

            const res = await fetch("/api/v1/admin/site-profiles", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const json = await res.json();

            if (res.ok && json.success) {
                setSuccessMessage(
                    editingProfile
                        ? "Profile updated successfully"
                        : "Profile created successfully"
                );
                await fetchProfiles();
                setTimeout(() => {
                    setIsDrawerOpen(false);
                    setSuccessMessage("");
                }, 1500);
            } else {
                setErrors(json.errors || [json.error || "Failed to save profile"]);
            }
        } catch (error) {
            setErrors(["Failed to save profile. Please try again."]);
        } finally {
            setSaving(false);
        }
    };

    // Delete profile
    const handleDelete = async (id: string) => {
        if (deleteConfirm !== id) {
            setDeleteConfirm(id);
            setTimeout(() => setDeleteConfirm(null), 3000);
            return;
        }

        try {
            const res = await fetch(`/api/v1/admin/site-profiles/${id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                await fetchProfiles();
            } else {
                console.error("Failed to delete profile");
            }
        } catch (error) {
            console.error("Error deleting profile:", error);
        } finally {
            setDeleteConfirm(null);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-sm text-muted-foreground font-medium">
                        Loading site profiles...
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
                    <h1 className="text-2xl font-bold tracking-tight">Site Profile Management</h1>
                    <p className="text-muted-foreground">
                        Configure site-specific scraping profiles for optimal stealth and performance
                    </p>
                </div>
                <Button onClick={handleNewProfile} className="gap-2">
                    <Plus className="w-4 h-4" />
                    New Profile
                </Button>
            </div>

            {/* Profiles List */}
            {profiles.length === 0 ? (
                <Card className="p-12">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="p-4 bg-muted rounded-full">
                            <Settings className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg mb-1">No Site Profiles</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Create your first site profile to customize scraping behavior
                            </p>
                            <Button onClick={handleNewProfile} className="gap-2">
                                <Plus className="w-4 h-4" />
                                Create Profile
                            </Button>
                        </div>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {profiles.map((profile) => (
                        <Card key={profile.id} className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <Globe className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg">{profile.domain}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            Updated: {new Date(profile.updatedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditProfile(profile)}
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(profile.id)}
                                        className={cn(
                                            deleteConfirm === profile.id &&
                                            "text-red-600 dark:text-red-500"
                                        )}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {/* Rate Limit */}
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Rate Limit:</span>
                                    <span className="font-mono">
                                        {profile.rateLimit.requestsPerMinute} req/min,{" "}
                                        {profile.rateLimit.concurrentRequests} concurrent
                                    </span>
                                </div>

                                {/* Adaptive Delay */}
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Delay Range:</span>
                                    <span className="font-mono">
                                        {profile.adaptiveDelay.min}ms - {profile.adaptiveDelay.max}ms
                                    </span>
                                </div>

                                {/* Multiplier */}
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Multiplier:</span>
                                    <span className="font-mono">{profile.adaptiveDelay.multiplier}x</span>
                                </div>

                                {/* Session Warmup */}
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Session Warmup:</span>
                                    <Badge variant={profile.sessionWarmup.enabled ? "success" : "secondary"}>
                                        {profile.sessionWarmup.enabled ? "Enabled" : "Disabled"}
                                    </Badge>
                                </div>

                                {/* Referrer Chain */}
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Referrer Chain:</span>
                                    <Badge variant={profile.referrerChain ? "success" : "secondary"}>
                                        {profile.referrerChain ? "Enabled" : "Disabled"}
                                    </Badge>
                                </div>
                            </div>

                            {deleteConfirm === profile.id && (
                                <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="text-xs text-red-900 dark:text-red-100 font-medium">
                                        Click delete again to confirm
                                    </p>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            {/* Profile Editor Drawer */}
            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>
                            {editingProfile ? "Edit Site Profile" : "New Site Profile"}
                        </SheetTitle>
                        <SheetDescription>
                            Configure scraping behavior for a specific site
                        </SheetDescription>
                    </SheetHeader>

                    <div className="mt-6 space-y-6">
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

                        {/* Template Selector */}
                        {!editingProfile && templates.length > 0 && (
                            <div className="space-y-3">
                                <Label>Start from Template (Optional)</Label>
                                <Select onValueChange={handleApplyTemplate}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a template..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map((template) => (
                                            <SelectItem key={template.name} value={template.name}>
                                                <div>
                                                    <div className="font-medium">{template.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {template.description}
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Domain */}
                        <div className="space-y-3">
                            <Label htmlFor="domain">
                                Domain <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="domain"
                                placeholder="example.com"
                                value={formData.domain}
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, domain: e.target.value }))
                                }
                                disabled={!!editingProfile}
                            />
                            <p className="text-xs text-muted-foreground">
                                The domain this profile applies to
                            </p>
                        </div>

                        {/* Rate Limit Section */}
                        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-primary" />
                                <h4 className="font-semibold">Rate Limiting</h4>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="rpm">Requests Per Minute</Label>
                                <div className="flex items-center gap-4">
                                    <Slider
                                        id="rpm"
                                        min={1}
                                        max={100}
                                        step={1}
                                        value={[formData.rateLimit.requestsPerMinute]}
                                        onValueChange={(value) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                rateLimit: {
                                                    ...prev.rateLimit,
                                                    requestsPerMinute: value[0],
                                                },
                                            }))
                                        }
                                        className="flex-1"
                                    />
                                    <span className="font-mono text-sm w-12 text-right">
                                        {formData.rateLimit.requestsPerMinute}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="concurrent">Concurrent Requests</Label>
                                <div className="flex items-center gap-4">
                                    <Slider
                                        id="concurrent"
                                        min={1}
                                        max={20}
                                        step={1}
                                        value={[formData.rateLimit.concurrentRequests]}
                                        onValueChange={(value) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                rateLimit: {
                                                    ...prev.rateLimit,
                                                    concurrentRequests: value[0],
                                                },
                                            }))
                                        }
                                        className="flex-1"
                                    />
                                    <span className="font-mono text-sm w-12 text-right">
                                        {formData.rateLimit.concurrentRequests}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Adaptive Delay Section */}
                        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                <h4 className="font-semibold">Adaptive Delays</h4>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="min-delay">Minimum Delay (ms)</Label>
                                <div className="flex items-center gap-4">
                                    <Slider
                                        id="min-delay"
                                        min={0}
                                        max={10000}
                                        step={100}
                                        value={[formData.adaptiveDelay.min]}
                                        onValueChange={(value) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                adaptiveDelay: {
                                                    ...prev.adaptiveDelay,
                                                    min: value[0],
                                                },
                                            }))
                                        }
                                        className="flex-1"
                                    />
                                    <span className="font-mono text-sm w-16 text-right">
                                        {formData.adaptiveDelay.min}ms
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="max-delay">Maximum Delay (ms)</Label>
                                <div className="flex items-center gap-4">
                                    <Slider
                                        id="max-delay"
                                        min={0}
                                        max={60000}
                                        step={1000}
                                        value={[formData.adaptiveDelay.max]}
                                        onValueChange={(value) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                adaptiveDelay: {
                                                    ...prev.adaptiveDelay,
                                                    max: value[0],
                                                },
                                            }))
                                        }
                                        className="flex-1"
                                    />
                                    <span className="font-mono text-sm w-16 text-right">
                                        {formData.adaptiveDelay.max}ms
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="multiplier">Delay Multiplier</Label>
                                <div className="flex items-center gap-4">
                                    <Slider
                                        id="multiplier"
                                        min={0.5}
                                        max={5}
                                        step={0.1}
                                        value={[formData.adaptiveDelay.multiplier]}
                                        onValueChange={(value) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                adaptiveDelay: {
                                                    ...prev.adaptiveDelay,
                                                    multiplier: value[0],
                                                },
                                            }))
                                        }
                                        className="flex-1"
                                    />
                                    <span className="font-mono text-sm w-12 text-right">
                                        {formData.adaptiveDelay.multiplier.toFixed(1)}x
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Session Warmup Section */}
                        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-primary" />
                                    <h4 className="font-semibold">Session Warmup</h4>
                                </div>
                                <Switch
                                    checked={formData.sessionWarmup.enabled}
                                    onCheckedChange={(checked) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            sessionWarmup: {
                                                ...prev.sessionWarmup,
                                                enabled: checked,
                                            },
                                        }))
                                    }
                                />
                            </div>

                            {formData.sessionWarmup.enabled && (
                                <div className="space-y-3">
                                    <Label>Warmup Paths</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="/about"
                                            value={warmupPathInput}
                                            onChange={(e) => setWarmupPathInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleAddWarmupPath();
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleAddWarmupPath}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    {formData.sessionWarmup.paths.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {formData.sessionWarmup.paths.map((path, index) => (
                                                <Badge
                                                    key={index}
                                                    variant="secondary"
                                                    className="gap-2"
                                                >
                                                    {path}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveWarmupPath(index)}
                                                        className="hover:text-red-600"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Pages to visit before starting actual scraping
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Referrer Chain */}
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                            <div className="space-y-0.5">
                                <Label htmlFor="referrer-chain">Referrer Chain</Label>
                                <p className="text-xs text-muted-foreground">
                                    Build natural referrer chain during navigation
                                </p>
                            </div>
                            <Switch
                                id="referrer-chain"
                                checked={formData.referrerChain}
                                onCheckedChange={(checked) =>
                                    setFormData((prev) => ({ ...prev, referrerChain: checked }))
                                }
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t">
                            <Button
                                variant="outline"
                                onClick={() => setIsDrawerOpen(false)}
                                disabled={saving}
                            >
                                Cancel
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
                                        Save Profile
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
