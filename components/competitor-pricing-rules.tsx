"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Settings2,
  Trash2,
  Save,
  Zap,
  ShieldCheck,
  Target,
  Percent,
  Calculator,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ruleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Rule name is required"),
  description: z.string().optional(),
  strategy: z.enum([
    "UNDERCUT",
    "MATCH",
    "MARGIN_LOCK",
    "THRESHOLD",
    "PERCENTAGE",
  ]),
  parameter: z.number().min(0, "Value must be positive"),
  priority: z.number().int().min(1, "Priority must be at least 1"),
  isActive: z.boolean(),
});

type RuleFormValues = z.infer<typeof ruleSchema>;

interface Rule {
  id: string;
  siteId?: string | null;
  name: string;
  description: string | null;
  strategy: "UNDERCUT" | "MATCH" | "MARGIN_LOCK" | "THRESHOLD" | "PERCENTAGE";
  parameter: number;
  priority: number;
  isActive: boolean;
}

export function CompetitorPricingRules({ siteId }: { siteId: string }) {
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
      description: "",
    },
  });

  const strategyValue = watch("strategy");

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/rules?siteId=${siteId}`);
      if (res.ok) {
        const data = await res.json();
        // Separate local vs global rules to display correctly
        setRules(data);
      } else {
        toast.error("Failed to load pricing rules");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  const onSubmit = async (data: RuleFormValues) => {
    try {
      const method = editingId ? "PUT" : "POST";
      const payload = { ...data, id: editingId, siteId }; // Attach scoped siteId

      const res = await fetch("/api/v1/rules", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingId ? "Rule updated" : "Rule created successfully");
        closeForm();
        fetchRules();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to save rule");
      }
    } catch (error) {
      toast.error("Connection error while saving");
    }
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    reset({
      name: "",
      description: "",
      strategy: "UNDERCUT",
      parameter: 1,
      priority: rules.length + 1,
      isActive: true,
    });
  };

  const handleEdit = (rule: Rule) => {
    if (!rule.siteId) {
      toast.error("Cannot edit global rules from here. Go to Rules Engine.");
      return;
    }
    setEditingId(rule.id);
    reset({
      name: rule.name,
      description: rule.description || "",
      strategy: rule.strategy,
      parameter: Number(rule.parameter),
      priority: rule.priority,
      isActive: rule.isActive,
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string, ruleSiteId?: string | null) => {
    if (!ruleSiteId) {
      toast.error("Cannot delete global rules from here.");
      return;
    }
    if (!confirm("Remove this competitor-specific rule?")) return;

    try {
      const res = await fetch(`/api/v1/rules?id=${id}`, { method: "DELETE" });
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
    if (!rule.siteId) {
      toast.error("Global rules must be paused globally.");
      return;
    }
    try {
      const res = await fetch("/api/v1/rules", {
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

  const getParameterLabel = (strategy: string) => {
    switch (strategy) {
      case "PERCENTAGE":
      case "MARGIN_LOCK": return "Percentage (%)";
      case "UNDERCUT":
      case "THRESHOLD": return "Amount ($)";
      case "MATCH": return "Tolerance ($)";
      default: return "Value";
    }
  };

  const localRules = rules.filter(r => r.siteId === siteId);
  const globalRules = rules.filter(r => r.siteId !== siteId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Pricing Configuration
          </h3>
          <p className="text-sm text-muted-foreground">
            Rules configured here uniquely target this competitor and override global logic.
          </p>
        </div>
        {!isAdding && !editingId && (
          <Button onClick={() => setIsAdding(true)} size="sm" className="shadow-xs">
            <Plus className="w-4 h-4 mr-1" /> Add Rule
          </Button>
        )}
      </div>

      {(isAdding || editingId) && (
        <div className="bg-card border border-primary/20 rounded-xl p-6 shadow-md relative">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-4 right-4 h-6 w-6 rounded-full" 
            onClick={closeForm}
          >
            <X className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 mb-6 border-b border-border pb-3">
            <Settings2 className="w-5 h-5 text-primary" />
            <h4 className="font-bold text-foreground">
              {editingId ? "Edit Component Rule" : "New Competitor Override Rule"}
            </h4>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label>Rule Name</Label>
                  <Input {...register("name")} className="mt-1.5" placeholder="e.g. Aggressive Match" />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <Label>Strategy Type</Label>
                  <Select onValueChange={(val) => setValue("strategy", val as any)} defaultValue={strategyValue}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select Strategy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNDERCUT">Undercut (Fixed Amount)</SelectItem>
                      <SelectItem value="PERCENTAGE">Undercut (Percentage)</SelectItem>
                      <SelectItem value="MATCH">Match Competitor</SelectItem>
                      <SelectItem value="MARGIN_LOCK">Protect Minimum Margin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>{getParameterLabel(strategyValue)}</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    {...register("parameter", { valueAsNumber: true })} 
                    className="mt-1.5 font-mono" 
                  />
                  {errors.parameter && <p className="text-xs text-destructive mt-1">{errors.parameter.message}</p>}
                </div>

                <div>
                  <Label>Overriding Priority (1 is highest)</Label>
                  <Input 
                    type="number" 
                    {...register("priority", { valueAsNumber: true })} 
                    className="mt-1.5" 
                  />
                  <p className="text-xs text-muted-foreground mt-1">Rule evaluated first if multiple match.</p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" className="gap-2">
                <Save className="w-4 h-4" /> Save Configuration
              </Button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="h-32 flex items-center justify-center border border-dashed rounded-xl">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {localRules.map((rule) => {
              const Icon = getStrategyIcon(rule.strategy);
              return (
                <div key={rule.id} className="bg-card border-l-4 border-l-primary border-r border-t border-b border-border/60 rounded-r-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-start md:items-center gap-3">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-foreground">{rule.name}</h4>
                        {!rule.isActive && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-bold uppercase text-muted-foreground">Paused</span>
                        )}
                        <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded font-bold uppercase border border-warning/20">Competitor Specific</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {rule.strategy.replace("_", " ")}: {rule.strategy === 'PERCENTAGE' || rule.strategy === 'MARGIN_LOCK' ? '' : '$'}{rule.parameter}{rule.strategy === 'PERCENTAGE' || rule.strategy === 'MARGIN_LOCK' ? '%' : ''} • Priority {rule.priority}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 self-end md:self-auto">
                    <Button variant="ghost" size="sm" onClick={() => toggleStatus(rule)} className={cn("text-xs", rule.isActive ? "text-warning hover:text-warning" : "text-success hover:text-success")}>
                      {rule.isActive ? "Pause" : "Activate"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>Edit</Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id, rule.siteId)} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            
            {localRules.length === 0 && (
              <div className="bg-muted/30 border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground font-medium">
                No specific rules defined for this competitor.
              </div>
            )}
          </div>

          <div className="pt-4 mt-8 border-t border-border/50">
            <h4 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-widest">Global Fallback Rules</h4>
            {globalRules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                {globalRules.map(rule => {
                  const Icon = getStrategyIcon(rule.strategy);
                  return (
                    <div key={rule.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 text-xs">
                       <Icon className="w-4 h-4" />
                       <div className="flex-1">
                         <span className="font-bold truncate block">{rule.name}</span>
                         <span className="text-muted-foreground text-[10px] uppercase">Priority: {rule.priority}</span>
                       </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No global rules configured.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
