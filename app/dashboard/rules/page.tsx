"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Settings2,
  Trash2,
  Save,
  GripVertical,
  ChevronRight,
  Info,
  Zap,
  ShieldCheck,
  Target,
  Percent,
  Calculator
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const ruleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Rule name is required"),
  description: z.string(),
  strategy: z.enum(["UNDERCUT", "MATCH", "MARGIN_LOCK", "THRESHOLD", "PERCENTAGE"]),
  parameter: z.number().min(0, "Value must be positive"),
  priority: z.number().int().min(1, "Priority must be at least 1"),
  isActive: z.boolean(),
});

type RuleFormValues = z.infer<typeof ruleSchema>;

interface Rule {
  id: string;
  name: string;
  description: string;
  strategy: "UNDERCUT" | "MATCH" | "MARGIN_LOCK" | "THRESHOLD" | "PERCENTAGE";
  parameter: number;
  priority: number;
  isActive: boolean;
}

export default function PricingRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      strategy: "UNDERCUT",
      parameter: 1,
      priority: 1,
      isActive: true,
    },
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/rules");
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      } else {
        toast.error("Failed to load rules");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: RuleFormValues) => {
    try {
      const method = editingId ? "PUT" : "POST";
      const payload = editingId ? { ...data, id: editingId } : data;

      const res = await fetch("/api/rules", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingId ? "Rule updated" : "Rule created");
        setIsAdding(false);
        setEditingId(null);
        reset({
          name: "",
          description: "",
          strategy: "UNDERCUT",
          parameter: 1,
          priority: rules.length + 1,
          isActive: true
        });
        fetchRules();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to save rule");
      }
    } catch (error) {
      toast.error("Connection error");
    }
  };

  const handleEdit = (rule: Rule) => {
    setEditingId(rule.id);
    reset(rule);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;

    try {
      const res = await fetch(`/api/rules?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Rule deleted");
        fetchRules();
      } else {
        toast.error("Failed to delete rule");
      }
    } catch (error) {
      toast.error("Connection error");
    }
  };

  const toggleStatus = async (rule: Rule) => {
    try {
      const res = await fetch("/api/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rule, isActive: !rule.isActive }),
      });
      if (res.ok) {
        toast.success(rule.isActive ? "Rule paused" : "Rule activated");
        fetchRules();
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case "UNDERCUT": return Zap;
      case "MATCH": return Target;
      case "MARGIN_LOCK": return ShieldCheck;
      case "THRESHOLD": return Calculator;
      case "PERCENTAGE": return Percent;
      default: return Settings2;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Pricing Engine</h1>
          <p className="text-muted-foreground mt-1 text-lg">Define how your prices adjust relative to competitors.</p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-all font-semibold shadow-lg shadow-primary/10"
          >
            <Plus className="w-5 h-5" />
            Create Rule
          </button>
        )}
      </div>

      {(isAdding || editingId) && (
        <div className="bg-card border border-primary/20 rounded-xl p-8 shadow-xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mb-8 border-b border-border pb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings2 className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold">{editingId ? "Edit Rule" : "New Pricing Rule"}</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Rule Name</label>
                  <input
                    {...register("name")}
                    type="text"
                    className={cn(
                      "w-full bg-muted/50 border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all",
                      errors.name && "border-destructive focus:ring-destructive/50"
                    )}
                    placeholder="e.g. Aggressive Undercut"
                  />
                  {errors.name && <p className="text-xs text-destructive font-bold">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Description</label>
                  <textarea
                    {...register("description")}
                    className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all h-24 resize-none"
                    placeholder="Describe when this rule should apply..."
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Strategy Type</label>
                  <select
                    {...register("strategy")}
                    className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  >
                    <option value="UNDERCUT">Undercut ($ Amount)</option>
                    <option value="MATCH">Exact Price Match</option>
                    <option value="PERCENTAGE">Cheaper By %</option>
                    <option value="MARGIN_LOCK">Margin Protection</option>
                    <option value="THRESHOLD">Difference Threshold</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Value</label>
                    <input
                      {...register("parameter", { valueAsNumber: true })}
                      type="number"
                      step="any"
                      className={cn(
                        "w-full bg-muted/50 border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all",
                        errors.parameter && "border-destructive focus:ring-destructive/50"
                      )}
                    />
                    {errors.parameter && <p className="text-xs text-destructive font-bold">{errors.parameter.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Priority</label>
                    <input
                      {...register("priority", { valueAsNumber: true })}
                      type="number"
                      className={cn(
                        "w-full bg-muted/50 border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all",
                        errors.priority && "border-destructive focus:ring-destructive/50"
                      )}
                    />
                    {errors.priority && <p className="text-xs text-destructive font-bold">{errors.priority.message}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-10 pt-6 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  reset();
                }}
                className="px-6 py-2.5 rounded-lg border border-border hover:bg-muted font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-2.5 rounded-lg hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/10"
              >
                <Save className="w-5 h-5" />
                Save Strategy
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-24 bg-muted/20 animate-pulse rounded-xl border border-border/50" />
          ))}
        </div>
      ) : rules.length === 0 && !isAdding ? (
        <div className="bg-card border-2 border-dashed border-border rounded-2xl p-16 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
            <Settings2 className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold">No pricing rules defined</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            Create your first strategy to start automating your competitive pricing edge.
          </p>
          <button
            onClick={() => setIsAdding(true)}
            className="mt-8 flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-xl hover:bg-primary/90 transition-all font-bold shadow-xl shadow-primary/20"
          >
            <Plus className="w-5 h-5" />
            Get Started
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule, index) => {
            const Icon = getStrategyIcon(rule.strategy);
            return (
              <div
                key={rule.id}
                className={cn(
                  "group relative bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all flex items-center justify-between shadow-sm hover:shadow-md",
                  !rule.isActive && "opacity-60 grayscale"
                )}
              >
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="cursor-grab text-muted-foreground/30 hover:text-muted-foreground transition-all">
                      <GripVertical className="w-5 h-5" />
                    </div>
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center border transition-all",
                      rule.isActive ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted border-border text-muted-foreground"
                    )}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold">{rule.name}</h3>
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-bold uppercase tracking-widest text-muted-foreground">
                        P{rule.priority}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm line-clamp-1 max-w-md">{rule.description || "Active automation strategy"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-10">
                  <div className="hidden lg:flex flex-col items-end">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">Impact</span>
                    <span className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                      {rule.strategy === "UNDERCUT" && `- $${rule.parameter}`}
                      {rule.strategy === "PERCENTAGE" && `- ${rule.parameter}%`}
                      {rule.strategy === "MATCH" && `0.00 Difference`}
                      {rule.strategy === "MARGIN_LOCK" && `Min ${rule.parameter}% Buffer`}
                      {rule.strategy === "THRESHOLD" && `>${rule.parameter} Trigger`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleStatus(rule)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border",
                        rule.isActive
                          ? "bg-success/10 text-success border-success/20 hover:bg-success/20"
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      )}
                    >
                      {rule.isActive ? "Active" : "Paused"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(rule)}
                      className="p-2.5 hover:bg-muted border border-transparent hover:border-border rounded-xl text-muted-foreground hover:text-foreground transition-all"
                    >
                      <Settings2 className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rule.id)}
                      className="p-2.5 hover:bg-danger/10 border border-transparent hover:border-danger/20 rounded-xl text-muted-foreground hover:text-danger transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="p-4 bg-muted/30 border border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-muted-foreground">
            <Info className="w-4 h-4" />
            <p className="text-xs font-medium">Rules are executed sequentially by priority. Lower number = Higher priority.</p>
          </div>
        </div>
      )}
    </div>
  );
}
