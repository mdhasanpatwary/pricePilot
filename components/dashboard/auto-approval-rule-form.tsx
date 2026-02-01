"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    CreateAutoApprovalRuleSchema,
    type CreateAutoApprovalRuleInput,
} from "@/lib/validation/auto-approval-rules";

interface AutoApprovalRuleFormProps {
    ruleId?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

const PRICING_STRATEGIES = [
    { value: "UNDERCUT", label: "Undercut" },
    { value: "MATCH", label: "Match" },
    { value: "MARGIN_LOCK", label: "Margin Lock" },
    { value: "THRESHOLD", label: "Threshold" },
    { value: "PERCENTAGE", label: "Percentage" },
    { value: "INVENTORY_HIKE", label: "Inventory Hike" },
];

export default function AutoApprovalRuleForm({
    ruleId,
    onSuccess,
    onCancel,
}: AutoApprovalRuleFormProps) {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [categoryInput, setCategoryInput] = useState("");
    const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    const isEditMode = !!ruleId;

    type FormValues = CreateAutoApprovalRuleInput;

    const form = useForm<FormValues>({
        resolver: zodResolver(CreateAutoApprovalRuleSchema),
        mode: "onSubmit", // Only validate on submit, not on mount
        defaultValues: {
            name: "",
            description: "",
            enabled: true,
            priority: 1,
            conditions: {},
        },
    });

    // Load existing rule data in edit mode
    useEffect(() => {
        if (isEditMode && ruleId) {
            const loadRule = async () => {
                try {
                    setLoading(true);
                    const res = await fetch(`/api/v1/auto-approval-rules/${ruleId}`);
                    if (!res.ok) {
                        throw new Error("Failed to load rule");
                    }
                    const data = await res.json();
                    const rule = data.data.rule;

                    // Set form values
                    form.reset({
                        name: rule.name,
                        description: rule.description || "",
                        enabled: rule.enabled,
                        priority: rule.priority,
                        conditions: rule.conditions,
                    });

                    // Set multi-select values
                    if (rule.conditions.allowedStrategies) {
                        setSelectedStrategies(rule.conditions.allowedStrategies);
                    }
                    if (rule.conditions.productCategories) {
                        setSelectedCategories(rule.conditions.productCategories);
                    }
                } catch (error) {
                    console.error("Error loading rule:", error);
                    toast.error("Failed to load rule data");
                } finally {
                    setLoading(false);
                }
            };
            loadRule();
        }
    }, [isEditMode, ruleId, form]);

    const handleAddStrategy = (strategy: string) => {
        if (!selectedStrategies.includes(strategy)) {
            const newStrategies = [...selectedStrategies, strategy] as Array<
                "UNDERCUT" | "MATCH" | "MARGIN_LOCK" | "THRESHOLD" | "PERCENTAGE" | "INVENTORY_HIKE"
            >;
            setSelectedStrategies(newStrategies);
            form.setValue("conditions.allowedStrategies", newStrategies, {
                shouldValidate: true,
            });
        }
    };

    const handleRemoveStrategy = (strategy: string) => {
        const newStrategies = selectedStrategies.filter((s) => s !== strategy) as Array<
            "UNDERCUT" | "MATCH" | "MARGIN_LOCK" | "THRESHOLD" | "PERCENTAGE" | "INVENTORY_HIKE"
        >;
        setSelectedStrategies(newStrategies);
        if (newStrategies.length === 0) {
            form.setValue("conditions.allowedStrategies", undefined, {
                shouldValidate: true,
            });
        } else {
            form.setValue("conditions.allowedStrategies", newStrategies, {
                shouldValidate: true,
            });
        }
    };

    const handleAddCategory = () => {
        const trimmed = categoryInput.trim();
        if (trimmed && !selectedCategories.includes(trimmed)) {
            const newCategories = [...selectedCategories, trimmed];
            setSelectedCategories(newCategories);
            form.setValue("conditions.productCategories", newCategories, {
                shouldValidate: true,
            });
            setCategoryInput("");
        }
    };

    const handleRemoveCategory = (category: string) => {
        const newCategories = selectedCategories.filter((c) => c !== category);
        setSelectedCategories(newCategories);
        if (newCategories.length === 0) {
            form.setValue("conditions.productCategories", undefined, {
                shouldValidate: true,
            });
        } else {
            form.setValue("conditions.productCategories", newCategories, {
                shouldValidate: true,
            });
        }
    };

    const onSubmit = async (data: FormValues) => {
        try {
            setSubmitting(true);

            const url = isEditMode
                ? `/api/v1/auto-approval-rules/${ruleId}`
                : "/api/v1/auto-approval-rules";
            const method = isEditMode ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const errorData = await res.json();
                if (errorData.error?.details?.fields) {
                    // Handle field-level validation errors
                    Object.entries(errorData.error.details.fields).forEach(
                        ([field, messages]) => {
                            form.setError(field as any, {
                                type: "manual",
                                message: (messages as string[])[0],
                            });
                        }
                    );
                    toast.error("Please fix the validation errors");
                } else {
                    throw new Error(errorData.error?.message || "Failed to save rule");
                }
                return;
            }

            toast.success(
                isEditMode
                    ? "Rule updated successfully"
                    : "Rule created successfully"
            );
            onSuccess?.();
        } catch (error) {
            console.error("Error saving rule:", error);
            toast.error(
                error instanceof Error ? error.message : "Failed to save rule"
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Basic Information</h3>

                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Rule Name</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="e.g., Small Price Changes"
                                        {...field}
                                    />
                                </FormControl>
                                <FormDescription>
                                    A descriptive name for this auto-approval rule
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Describe when this rule should apply..."
                                        {...field}
                                    />
                                </FormControl>
                                <FormDescription>
                                    Optional description to explain the rule&apos;s purpose
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="enabled"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Enabled</FormLabel>
                                        <FormDescription>
                                            Activate this rule immediately
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="priority"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Priority</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={1000}
                                            {...field}
                                            onChange={(e) =>
                                                field.onChange(parseInt(e.target.value, 10))
                                            }
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Lower numbers = higher priority
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                {/* Conditions */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Conditions</h3>
                    <p className="text-sm text-muted-foreground">
                        All specified conditions must be met for auto-approval. At least
                        one condition is required.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="conditions.maxPriceChange"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Max Price Change</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min={0}
                                            placeholder="e.g., 50.00"
                                            {...field}
                                            value={field.value ?? ""}
                                            onChange={(e) =>
                                                field.onChange(
                                                    e.target.value
                                                        ? parseFloat(e.target.value)
                                                        : undefined
                                                )
                                            }
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Maximum absolute price change
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="conditions.maxPercentageChange"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Max Percentage Change</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            min={0}
                                            max={100}
                                            placeholder="e.g., 5.0"
                                            {...field}
                                            value={field.value ?? ""}
                                            onChange={(e) =>
                                                field.onChange(
                                                    e.target.value
                                                        ? parseFloat(e.target.value)
                                                        : undefined
                                                )
                                            }
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Maximum percentage change (0-100%)
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="conditions.minConfidenceScore"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Min Confidence Score</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="1"
                                        min={0}
                                        max={100}
                                        placeholder="e.g., 80"
                                        {...field}
                                        value={field.value ?? ""}
                                        onChange={(e) =>
                                            field.onChange(
                                                e.target.value
                                                    ? parseFloat(e.target.value)
                                                    : undefined
                                            )
                                        }
                                    />
                                </FormControl>
                                <FormDescription>
                                    Minimum product match confidence (0-100)
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Allowed Strategies Multi-Select */}
                    <FormField
                        control={form.control}
                        name="conditions.allowedStrategies"
                        render={() => (
                            <FormItem>
                                <FormLabel>Allowed Pricing Strategies</FormLabel>
                                <div className="space-y-2">
                                    <Select onValueChange={handleAddStrategy}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select strategies to allow..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PRICING_STRATEGIES.filter(
                                                (s) => !selectedStrategies.includes(s.value)
                                            ).map((strategy) => (
                                                <SelectItem
                                                    key={strategy.value}
                                                    value={strategy.value}
                                                >
                                                    {strategy.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedStrategies.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {selectedStrategies.map((strategy) => (
                                                <Badge
                                                    key={strategy}
                                                    variant="secondary"
                                                    className="gap-1"
                                                >
                                                    {PRICING_STRATEGIES.find(
                                                        (s) => s.value === strategy
                                                    )?.label || strategy}
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleRemoveStrategy(strategy)
                                                        }
                                                        className="ml-1 hover:text-destructive"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <FormDescription>
                                    Only approve changes using these strategies
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Product Categories Multi-Select */}
                    <FormField
                        control={form.control}
                        name="conditions.productCategories"
                        render={() => (
                            <FormItem>
                                <FormLabel>Product Categories</FormLabel>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Enter category name..."
                                            value={categoryInput}
                                            onChange={(e) => setCategoryInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleAddCategory();
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleAddCategory}
                                            className="gap-1"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add
                                        </Button>
                                    </div>
                                    {selectedCategories.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {selectedCategories.map((category) => (
                                                <Badge
                                                    key={category}
                                                    variant="secondary"
                                                    className="gap-1"
                                                >
                                                    {category}
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleRemoveCategory(category)
                                                        }
                                                        className="ml-1 hover:text-destructive"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <FormDescription>
                                    Only approve changes for these categories
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Price Range */}
                    <div className="space-y-2">
                        <FormLabel>Price Range</FormLabel>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="conditions.priceRange.min"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min={0}
                                                placeholder="Min price"
                                                {...field}
                                                value={field.value ?? ""}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        e.target.value
                                                            ? parseFloat(e.target.value)
                                                            : undefined
                                                    )
                                                }
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="conditions.priceRange.max"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min={0}
                                                placeholder="Max price"
                                                {...field}
                                                value={field.value ?? ""}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        e.target.value
                                                            ? parseFloat(e.target.value)
                                                            : undefined
                                                    )
                                                }
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormDescription>
                            Only approve changes for products in this price range
                        </FormDescription>
                    </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {isEditMode ? "Update Rule" : "Create Rule"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
