"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Plus,
  Trash2,
  Save,
  Settings2,
  AlertTriangle,
  History,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Package,
  Layers,
  Search,
  Clock,
  ExternalLink,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const alertRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Alert name is required"),
  description: z.string().optional(),
  type: z.enum(["PRICE_CHANGE", "STOCK_STATUS"]),
  target: z.enum(["ALL_PRODUCTS", "SINGLE_PRODUCT", "CATEGORY"]),
  condition: z.enum([
    "GREATER_THAN",
    "LESS_THAN",
    "DECREASED_BY",
    "INCREASED_BY",
    "OUT_OF_STOCK",
    "BACK_IN_STOCK",
  ]),
  value: z.number().min(0, "Value must be positive").optional(),
  isActive: z.boolean(),
  targetId: z.string().optional().nullable(),
});

type AlertRuleFormValues = z.infer<typeof alertRuleSchema>;

interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  type: "PRICE_CHANGE" | "STOCK_STATUS";
  target: "ALL_PRODUCTS" | "SINGLE_PRODUCT" | "CATEGORY";
  targetId: string | null;
  condition:
    | "GREATER_THAN"
    | "LESS_THAN"
    | "DECREASED_BY"
    | "INCREASED_BY"
    | "OUT_OF_STOCK"
    | "BACK_IN_STOCK";
  value: any;
  isActive: boolean;
  createdAt: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function AlertCenterPage() {
  const [activeTab, setActiveTab] = useState<"rules" | "history">("rules");
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [productQuery, setProductQuery] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AlertRuleFormValues>({
    resolver: zodResolver(alertRuleSchema) as any,
    defaultValues: {
      name: "",
      description: "",
      type: "PRICE_CHANGE",
      target: "ALL_PRODUCTS",
      condition: "LESS_THAN",
      value: 0,
      isActive: true,
    },
  });

  const selectedType = watch("type");
  const selectedTarget = watch("target");
  const selectedTargetId = watch("targetId");

  useEffect(() => {
    fetchRules();
    fetchHistory();
  }, []);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/tenant/alert-rules");
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch (error) {
      toast.error("Failed to load alert rules");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/v1/notifications?limit=20");
      if (res.ok) {
        const data = await res.json();
        setHistory(
          data.notifications.filter(
            (n: any) => n.type === "PRICE_ALERT" || n.type === "MATCH_ALERT",
          ),
        );
      }
    } catch (error) {
      // Silent fail for history
    }
  };

  const searchProducts = async (query: string) => {
    if (query.length < 2) return;
    setIsSearchingProduct(true);
    try {
      const res = await fetch(
        `/api/v1/products?q=${encodeURIComponent(query)}&limit=5`,
      );
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearchingProduct(false);
    }
  };

  const onSubmit = async (data: AlertRuleFormValues) => {
    try {
      const method = editingId ? "PATCH" : "POST";
      const payload = editingId ? { ...data, id: editingId } : data;

      const res = await fetch("/api/v1/tenant/alert-rules", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingId ? "Alert rule updated" : "Alert rule created");
        setIsAdding(false);
        setEditingId(null);
        reset();
        fetchRules();
      } else {
        toast.error("Failed to save alert rule");
      }
    } catch (error) {
      toast.error("Connection error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this alert rule?")) return;
    try {
      const res = await fetch(`/api/v1/tenant/alert-rules?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Alert rule deleted");
        fetchRules();
      }
    } catch (error) {
      toast.error("Failed to delete rule");
    }
  };

  const getConditionIcon = (condition: string) => {
    switch (condition) {
      case "DECREASED_BY":
        return TrendingDown;
      case "INCREASED_BY":
        return TrendingUp;
      case "LESS_THAN":
        return TrendingDown;
      case "GREATER_THAN":
        return TrendingUp;
      case "OUT_OF_STOCK":
        return AlertTriangle;
      case "BACK_IN_STOCK":
        return CheckCircle2;
      default:
        return Bell;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Alert Center
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Monitor market shifts with precision-targeted notifications.
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-all font-semibold shadow-lg shadow-primary/10"
          >
            <Plus className="w-5 h-5" />
            Create Alert
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 p-1 bg-muted/40 backdrop-blur-md border border-border rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("rules")}
          className={cn(
            "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === "rules"
              ? "bg-card text-primary shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Settings2 className="w-4 h-4" />
          Alert Rules
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === "history"
              ? "bg-card text-primary shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <History className="w-4 h-4" />
          Triggered History
        </button>
      </div>

      {activeTab === "rules" ? (
        <>
          {(isAdding || editingId) && (
            <div className="bg-card border border-primary/20 rounded-2xl p-8 shadow-2xl animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3 mb-8 border-b border-border pb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Bell className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">
                  {editingId
                    ? "Adjust Monitoring Rule"
                    : "Configure New Sentinel"}
                </h2>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                        Sentinel Name
                      </label>
                      <input
                        {...register("name")}
                        className={cn(
                          "w-full bg-muted/30 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium",
                          errors.name &&
                            "border-destructive focus:ring-destructive/40",
                        )}
                        placeholder="e.g. Price Drop Detector"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                          Data Stream
                        </label>
                        <select
                          {...register("type")}
                          className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium appearance-none"
                        >
                          <option value="PRICE_CHANGE">Price Changes</option>
                          <option value="STOCK_STATUS">Stock Status</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                          Target Scope
                        </label>
                        <select
                          {...register("target")}
                          className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium appearance-none"
                        >
                          <option value="ALL_PRODUCTS">
                            Across All Products
                          </option>
                          <option value="SINGLE_PRODUCT">
                            Specific Product
                          </option>
                          <option value="CATEGORY">Target Category</option>
                        </select>
                      </div>
                    </div>

                    {selectedTarget === "CATEGORY" && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                          Category Name
                        </label>
                        <input
                          {...register("targetId")}
                          className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                          placeholder="e.g. Electronics"
                        />
                      </div>
                    )}

                    {selectedTarget === "SINGLE_PRODUCT" && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                          Search Product
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="text"
                            value={productQuery}
                            onChange={(e) => {
                              setProductQuery(e.target.value);
                              searchProducts(e.target.value);
                            }}
                            className="w-full bg-muted/30 border border-border rounded-xl px-10 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                            placeholder="Type SKU or Title..."
                          />
                          {isSearchingProduct && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>

                        {products.length > 0 && productQuery.length > 1 && (
                          <div className="mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden divide-y divide-border">
                            {products.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setValue("targetId", p.id);
                                  setProductQuery(p.title);
                                  setProducts([]);
                                }}
                                className={cn(
                                  "w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center justify-between",
                                  selectedTargetId === p.id &&
                                    "bg-primary/5 text-primary",
                                )}
                              >
                                <div>
                                  <p className="text-sm font-bold">{p.title}</p>
                                  <p className="text-[10px] font-mono text-muted-foreground">
                                    {p.sku}
                                  </p>
                                </div>
                                {selectedTargetId === p.id && (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                        <input type="hidden" {...register("targetId")} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="p-6 bg-primary/[0.03] border border-primary/20 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2 text-primary">
                        <Zap className="w-5 h-5 fill-current" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                          Trigger Logic
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                            Condition
                          </label>
                          <select
                            {...register("condition")}
                            className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium appearance-none"
                          >
                            {selectedType === "PRICE_CHANGE" ? (
                              <>
                                <option value="DECREASED_BY">
                                  Decreased By (%)
                                </option>
                                <option value="INCREASED_BY">
                                  Increased By (%)
                                </option>
                                <option value="LESS_THAN">
                                  Drops Below Value ($)
                                </option>
                                <option value="GREATER_THAN">
                                  Rises Above Value ($)
                                </option>
                              </>
                            ) : (
                              <>
                                <option value="OUT_OF_STOCK">
                                  Goes Out of Stock
                                </option>
                                <option value="BACK_IN_STOCK">
                                  Returns to Stock
                                </option>
                              </>
                            )}
                          </select>
                        </div>

                        {!["OUT_OF_STOCK", "BACK_IN_STOCK"].includes(
                          watch("condition"),
                        ) && (
                          <div className="space-y-2 animate-in zoom-in-95 duration-200">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                              Value Threshold
                            </label>
                            <div className="relative">
                              <input
                                {...register("value", { valueAsNumber: true })}
                                type="number"
                                step="any"
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-black text-2xl"
                              />
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground opacity-40 font-bold">
                                {watch("condition").includes("BY") ? "%" : "$"}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-4 bg-muted/30 border border-border rounded-xl">
                      <input
                        type="checkbox"
                        {...register("isActive")}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                      />
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Active Monitoring Enabled
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-8 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingId(null);
                      reset();
                    }}
                    className="px-6 py-2.5 rounded-xl border border-border hover:bg-muted font-bold transition-all"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="submit"
                    className="group flex items-center gap-2 bg-primary text-primary-foreground px-8 py-2.5 rounded-xl hover:bg-primary/90 transition-all font-black shadow-xl shadow-primary/20 active:scale-95"
                  >
                    <Save className="w-5 h-5 transition-transform group-hover:scale-110" />
                    Deploy Sentinel
                  </button>
                </div>
              </form>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-32 bg-muted/20 animate-pulse rounded-2xl border border-border/50"
                />
              ))}
            </div>
          ) : rules.length === 0 && !isAdding ? (
            <div className="bg-card border-2 border-dashed border-border rounded-[2.5rem] p-24 flex flex-col items-center text-center">
              <div className="relative mb-10">
                <div className="w-24 h-24 rounded-[2rem] bg-primary/10 flex items-center justify-center animate-pulse">
                  <Bell className="w-12 h-12 text-primary" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary border-4 border-card flex items-center justify-center">
                  <Plus className="w-4 h-4 text-primary-foreground" />
                </div>
              </div>
              <h3 className="text-2xl font-black tracking-tight">
                Zero Detectors Active
              </h3>
              <p className="text-muted-foreground max-w-sm mt-4 text-lg leading-relaxed">
                Configure your first alert rule to stay ahead of market shifts.
                Get notified when competitors cut prices or run out of stock.
              </p>
              <button
                onClick={() => setIsAdding(true)}
                className="mt-10 flex items-center gap-3 bg-primary text-primary-foreground px-12 py-4 rounded-2xl hover:bg-primary/90 transition-all font-black shadow-2xl shadow-primary/30 hover:-translate-y-1"
              >
                Launch Monitoring
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {rules.map((rule) => {
                const Icon = getConditionIcon(rule.condition);
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      "group relative bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-all shadow-sm hover:shadow-xl hover:-translate-y-1",
                      !rule.isActive && "opacity-60 grayscale",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center border shrink-0",
                            rule.isActive
                              ? "bg-primary/10 border-primary/20 text-primary"
                              : "bg-muted border-border text-muted-foreground",
                          )}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold group-hover:text-primary transition-colors">
                            {rule.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-muted rounded flex items-center gap-1">
                              {rule.target === "ALL_PRODUCTS" && (
                                <>
                                  <Layers className="w-2.5 h-2.5" /> All
                                  Products
                                </>
                              )}
                              {rule.target === "SINGLE_PRODUCT" && (
                                <>
                                  <Package className="w-2.5 h-2.5" /> Single
                                  Product
                                </>
                              )}
                              {rule.target === "CATEGORY" && (
                                <>
                                  <Layers className="w-2.5 h-2.5" /> Category
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingId(rule.id);
                            reset({
                              ...rule,
                              description: rule.description || "",
                              value: Number(rule.value),
                              targetId: rule.targetId || undefined,
                            });
                            setProductQuery(
                              rule.target === "SINGLE_PRODUCT"
                                ? "Selected Product"
                                : "",
                            );
                            setIsAdding(true);
                          }}
                          className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all"
                        >
                          <Settings2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="p-2 hover:bg-danger/10 rounded-lg text-muted-foreground hover:text-danger transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-muted-foreground uppercase opacity-40">
                          Condition
                        </span>
                        <p className="text-sm font-bold text-foreground">
                          {rule.condition.replace(/_/g, " ")}{" "}
                          {rule.condition.includes("STOCK")
                            ? ""
                            : rule.value.toString() +
                              (rule.condition.includes("BY") ? "%" : "$")}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "text-[9px] font-black uppercase tracking-tighter px-2 py-1 rounded-md",
                          rule.isActive
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {rule.isActive ? "LIVE" : "STOPPED"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-20 flex flex-col items-center text-center opacity-60">
              <History className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="font-bold">No history available</p>
              <p className="text-xs text-muted-foreground">
                Alert logs will appear here when triggered.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-6 hover:bg-muted/30 transition-colors flex items-center justify-between gap-6"
                >
                  <div className="flex gap-4 items-start">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border",
                        item.type === "PRICE_ALERT"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                          : "bg-primary/10 border-primary/20 text-primary",
                      )}
                    >
                      <TrendingDown className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-muted-foreground opacity-60 uppercase tracking-widest flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {format(new Date(item.createdAt), "MMM dd, HH:mm")}
                        </span>
                        {!item.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        )}
                      </div>
                      <h4 className="font-bold text-foreground">
                        {item.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {item.message}
                      </p>
                    </div>
                  </div>
                  {item.link && (
                    <a
                      href={item.link}
                      className="flex items-center gap-2 text-xs font-bold text-primary hover:underline px-4 py-2 bg-primary/5 rounded-lg transition-all"
                    >
                      View Details
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
