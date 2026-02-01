"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
    Settings2,
    Plus,
    Edit,
    Trash2,
    CheckCircle2,
    XCircle,
    AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
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

interface RuleConditions {
    maxPriceChange?: number;
    maxPercentageChange?: number;
    minConfidenceScore?: number;
    allowedStrategies?: string[];
    productCategories?: string[];
    priceRange?: {
        min: number;
        max: number;
    };
}

interface AutoApprovalRule {
    id: string;
    name: string;
    description: string | null;
    enabled: boolean;
    priority: number;
    conditions: RuleConditions;
    createdAt: string;
    updatedAt: string;
}

interface AutoApprovalRulesListProps {
    onCreateNew?: () => void;
    onEdit?: (ruleId: string) => void;
}

export default function AutoApprovalRulesList({
    onCreateNew,
    onEdit,
}: AutoApprovalRulesListProps) {
    const [rules, setRules] = useState<AutoApprovalRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [ruleToDelete, setRuleToDelete] = useState<AutoApprovalRule | null>(
        null
    );

    const fetchRules = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/v1/auto-approval-rules");
            if (!res.ok) {
                throw new Error("Failed to fetch rules");
            }
            const data = await res.json();
            setRules(data.data.rules || []);
        } catch (error) {
            console.error("Error fetching rules:", error);
            toast.error("Failed to load auto-approval rules");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    const handleToggle = async (rule: AutoApprovalRule) => {
        try {
            setTogglingId(rule.id);
            const res = await fetch(`/api/v1/auto-approval-rules/${rule.id}/toggle`, {
                method: "PATCH",
            });

            if (!res.ok) {
                throw new Error("Failed to toggle rule");
            }

            const data = await res.json();

            // Optimistic update
            setRules((prev) =>
                prev.map((r) =>
                    r.id === rule.id ? { ...r, enabled: data.data.rule.enabled } : r
                )
            );

            toast.success(
                `Rule "${rule.name}" ${data.data.rule.enabled ? "enabled" : "disabled"}`
            );
        } catch (error) {
            console.error("Error toggling rule:", error);
            toast.error("Failed to toggle rule");
        } finally {
            setTogglingId(null);
        }
    };

    const handleDeleteClick = (rule: AutoApprovalRule) => {
        setRuleToDelete(rule);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!ruleToDelete) return;

        try {
            setDeletingId(ruleToDelete.id);
            const res = await fetch(`/api/v1/auto-approval-rules/${ruleToDelete.id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                throw new Error("Failed to delete rule");
            }

            setRules((prev) => prev.filter((r) => r.id !== ruleToDelete.id));
            toast.success(`Rule "${ruleToDelete.name}" deleted successfully`);
        } catch (error) {
            console.error("Error deleting rule:", error);
            toast.error("Failed to delete rule");
        } finally {
            setDeletingId(null);
            setDeleteDialogOpen(false);
            setRuleToDelete(null);
        }
    };

    const formatConditionsSummary = (conditions: RuleConditions): string => {
        const parts: string[] = [];

        if (conditions.maxPriceChange !== undefined) {
            parts.push(`Max change: $${conditions.maxPriceChange}`);
        }
        if (conditions.maxPercentageChange !== undefined) {
            parts.push(`Max %: ${conditions.maxPercentageChange}%`);
        }
        if (conditions.minConfidenceScore !== undefined) {
            parts.push(`Min confidence: ${conditions.minConfidenceScore}%`);
        }
        if (conditions.allowedStrategies && conditions.allowedStrategies.length > 0) {
            parts.push(`Strategies: ${conditions.allowedStrategies.join(", ")}`);
        }
        if (conditions.productCategories && conditions.productCategories.length > 0) {
            parts.push(`Categories: ${conditions.productCategories.join(", ")}`);
        }
        if (conditions.priceRange) {
            parts.push(
                `Price range: $${conditions.priceRange.min}-$${conditions.priceRange.max}`
            );
        }

        return parts.length > 0 ? parts.join(" • ") : "No conditions";
    };

    if (loading) {
        return (
            <div className="container mx-auto p-6">
                <LoadingSpinner message="Loading auto-approval rules..." />
            </div>
        );
    }

    if (rules.length === 0) {
        return (
            <div className="container mx-auto p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Auto-Approval Rules</h1>
                        <p className="text-muted-foreground mt-2">
                            Configure rules to automatically approve price changes
                        </p>
                    </div>
                    <Button onClick={onCreateNew} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Create New Rule
                    </Button>
                </div>
                <EmptyState
                    icon={Settings2}
                    title="No Auto-Approval Rules"
                    description="Create your first rule to start automating price approvals based on your criteria."
                    action={{
                        label: "Create First Rule",
                        onClick: () => onCreateNew?.(),
                    }}
                />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Auto-Approval Rules</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage {rules.length} auto-approval {rules.length === 1 ? "rule" : "rules"}
                    </p>
                </div>
                <Button onClick={onCreateNew} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Create New Rule
                </Button>
            </div>

            <div className="rounded-lg border border-border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">Status</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-24 text-center">Priority</TableHead>
                            <TableHead>Conditions</TableHead>
                            <TableHead className="w-32 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rules.map((rule) => (
                            <TableRow key={rule.id}>
                                <TableCell>
                                    <Switch
                                        checked={rule.enabled}
                                        onCheckedChange={() => handleToggle(rule)}
                                        disabled={togglingId === rule.id}
                                        aria-label={`Toggle ${rule.name}`}
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{rule.name}</span>
                                            {rule.enabled ? (
                                                <Badge
                                                    variant="default"
                                                    className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                                >
                                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">
                                                    <XCircle className="w-3 h-3 mr-1" />
                                                    Disabled
                                                </Badge>
                                            )}
                                        </div>
                                        {rule.description && (
                                            <p className="text-sm text-muted-foreground">
                                                {rule.description}
                                            </p>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="outline" className="font-mono">
                                        {rule.priority}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="text-sm text-muted-foreground">
                                        {formatConditionsSummary(rule.conditions)}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => onEdit?.(rule.id)}
                                            className="gap-1"
                                        >
                                            <Edit className="w-4 h-4" />
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDeleteClick(rule)}
                                            disabled={deletingId === rule.id}
                                            className="gap-1 text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-destructive" />
                            Delete Auto-Approval Rule
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the rule &quot;{ruleToDelete?.name}&quot;?
                            This action cannot be undone. Future price changes will no longer be
                            evaluated against this rule.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDeleteConfirm}
                            variant="destructive"
                        >
                            Delete Rule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
