"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus,
  Globe,
  Search,
  Trash2,
  ShieldAlert,
  Zap,
  ExternalLink,
  Target,
  MousePointer2,
  X,
  Download,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const competitorSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

type CompetitorFormValues = z.infer<typeof competitorSchema>;

import { Competitor } from "@/lib/types";

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncingSiteId, setSyncingSiteId] = useState<string | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console to bottom when logs update
  useEffect(() => {
    if (competitors.some((c) => c.isSyncing)) {
      consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [competitors]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CompetitorFormValues>({
    resolver: zodResolver(competitorSchema),
  });

  const fetchCompetitors = useCallback(async (silent = false) => {
    if (!silent) setIsDataLoading(true);
    try {
      const res = await fetch("/api/v1/competitors");
      if (res.ok) {
        const data = await res.json();
        setCompetitors(data);
      } else {
        toast.error("Failed to load competitors");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      if (!silent) setIsDataLoading(false);
    }
  }, []);

  // Polling for active syncs
  const hasActiveSync = useMemo(
    () => competitors.some((c) => c.isSyncing),
    [competitors],
  );

  useEffect(() => {
    if (!hasActiveSync) {
      // Clear syncing state when all syncs are complete
      setSyncingSiteId(null);
      return;
    }
    const interval = setInterval(() => {
      fetchCompetitors(true);
    }, 2000);
    return () => clearInterval(interval);
  }, [hasActiveSync, fetchCompetitors]);

  const onSubmit = async (data: CompetitorFormValues) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast.success("Crawler deployed successfully");
        setIsAdding(false);
        reset();
        fetchCompetitors();
      } else {
        const result = await res.json();
        toast.error(result.error || "Failed to deploy crawler");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncSite = async (id: string) => {
    // Prevent duplicate sync attempts
    if (syncingSiteId === id) {
      return;
    }

    // Check if already syncing
    const competitor = competitors.find((c) => c.id === id);
    if (competitor?.isSyncing) {
      toast.info("Sync is already in progress for this site");
      return;
    }

    // Set syncing state to prevent double clicks
    setSyncingSiteId(id);

    // 1. Optimistically update UI to start polling immediately
    setCompetitors((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, isSyncing: true, status: "SYNCING" } : c,
      ),
    );

    try {
      // 2. Trigger the sync (runs in background on server)
      const res = await fetch("/api/v1/competitors/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: id }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to start sync");
      }

      const result = await res.json();

      if (result.success) {
        toast.success("Sync started successfully. Monitoring progress...");
      } else {
        throw new Error(result.error || "Sync failed to start");
      }

      // Polling will handle the rest of the updates
    } catch (error) {
      // Revert state if request failed
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start sync";
      toast.error(errorMessage);

      // Fetch fresh data to revert optimistic update
      await fetchCompetitors(true);
    } finally {
      setSyncingSiteId(null);
    }
  };

  const handleStopSync = async (id: string) => {
    setSyncingSiteId(id);
    try {
      const res = await fetch("/api/v1/competitors/sync/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: id }),
      });

      if (res.ok) {
        toast.info("Crawler shutdown signal sent");
        // Immediately update UI optimistically
        setCompetitors((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  isSyncing: false,
                  status: c.status === "SYNCING" ? "ACTIVE" : c.status,
                }
              : c,
          ),
        );
        // Then fetch fresh data
        await fetchCompetitors(true);
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to stop crawler");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to stop crawler";
      toast.error(errorMessage);
    } finally {
      setSyncingSiteId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to remove this competitor site? All tracking data for this site will be lost.",
      )
    )
      return;

    try {
      const res = await fetch(`/api/v1/competitors?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Competitor removed");
        fetchCompetitors();
      } else {
        toast.error("Failed to remove competitor");
      }
    } catch (error) {
      toast.error("Connection error");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/v1/imports/competitors", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();
        toast.success(
          `Import complete: Added ${result.added} sites. Skipped ${result.skipped}.`,
        );
        fetchCompetitors();
      } else {
        const result = await res.json();
        toast.error(result.error || "Failed to import sites");
      }
    } catch (error) {
      toast.error("Network error during import");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const [limits, setLimits] = useState({ storeLimit: 1, competitorLimit: 3 });

  const fetchLimits = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/tenant/limits");
      if (res.ok) {
        const data = await res.json();
        setLimits(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchCompetitors();
    fetchLimits();
  }, [fetchCompetitors, fetchLimits]);

  // fetchLimits is memoized above

  // ... fetchCompetitors ...

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Competitors</h2>
          <p className="text-muted-foreground text-sm">
            Monitor and track rival pricing strategies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              window.location.href = "/api/v1/exports/competitors";
              toast.success("Downloading competitor list...");
            }}
            className="bg-secondary text-secondary-foreground text-sm font-semibold px-4 py-2 rounded-md hover:bg-secondary/80 transition-all border border-border flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          <label className="bg-primary/5 text-primary text-sm font-semibold px-4 py-2 rounded-md border border-primary/10 hover:bg-primary/10 transition-all flex items-center gap-2 cursor-pointer active:scale-95">
            {isImporting ? (
              <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <Filter className="w-4 h-4 rotate-180" />
            )}
            Import
            <input
              type="file"
              className="hidden"
              accept=".csv"
              onChange={handleImport}
              disabled={isImporting}
            />
          </label>

          {!isAdding && competitors.length < limits.competitorLimit && (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-md hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Site
            </button>
          )}
          {competitors.length >= limits.competitorLimit && !isAdding && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-lg">
              <ShieldAlert className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                Tracker Limit Reached ({competitors.length}/
                {limits.competitorLimit})
              </span>
            </div>
          )}
        </div>
      </div>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="bg-card border border-border rounded-lg p-8 space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Deploy Crawler</h3>
                <p className="text-xs text-muted-foreground">
                  Setup monitoring for a new target website.
                </p>
              </div>
              <button
                onClick={() => setIsAdding(false)}
                className="p-2 hover:bg-muted rounded-md text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Website URL
                </label>
                <div className="relative group">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors" />
                  <input
                    {...register("url")}
                    type="text"
                    placeholder="https://competitor.com"
                    className={cn(
                      "w-full bg-background border border-border rounded-md py-2.5 pl-10 pr-4 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm font-medium",
                      errors.url &&
                        "border-destructive focus:ring-destructive/20",
                    )}
                  />
                </div>
                {errors.url && (
                  <p className="text-xs text-destructive font-bold">
                    {errors.url.message}
                  </p>
                )}
              </div>

              <div className="p-4 bg-muted/30 rounded-md border border-border space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldAlert className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Compliance
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  PricePilot only accesses public data and respects robots.txt
                  to ensure store stability.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-primary text-primary-foreground font-semibold py-2.5 rounded-md transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      Deploy Crawler
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 bg-secondary text-secondary-foreground font-semibold py-2.5 rounded-md border border-border transition-all text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>

          <div className="hidden lg:block space-y-6">
            {[
              {
                icon: Search,
                title: "Discovery",
                desc: "We map category structure to find matches.",
              },
              {
                icon: Target,
                title: "Matching",
                desc: "AI-powered product recognition.",
              },
              {
                icon: MousePointer2,
                title: "Live Updates",
                desc: "Checked every 15 minutes.",
              },
            ].map((step, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                  <step.icon className="w-5 h-5 text-muted-foreground/60" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="py-4 px-6">Source</th>
                  <th className="py-4 px-6 text-center">Products</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 w-48">Health</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {isDataLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-20 text-center text-muted-foreground animate-pulse"
                    >
                      Scanning market signals...
                    </td>
                  </tr>
                ) : competitors.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-20 text-center text-muted-foreground"
                    >
                      <div className="space-y-4">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                          <Globe className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                        <div>
                          <h4 className="font-semibold">No Sites Tracked</h4>
                          <p className="text-sm text-muted-foreground">
                            Add a competitor website to start monitoring prices.
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  competitors.map((comp) => (
                    <tr
                      key={comp.id}
                      className={cn(
                        "border-b border-border/50 hover:bg-muted/30 transition-colors",
                        comp.isSyncing && "bg-primary/[0.02]",
                      )}
                    >
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-md flex items-center justify-center transition-all",
                              comp.isSyncing
                                ? "bg-primary/20 text-primary animate-pulse"
                                : "bg-muted text-muted-foreground/50",
                            )}
                          >
                            <Globe
                              className={cn(
                                "w-5 h-5",
                                comp.isSyncing && "animate-spin-slow",
                              )}
                            />
                          </div>
                          <div>
                            <div className="text-foreground font-semibold">
                              {comp.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {new URL(comp.url).hostname}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6 text-center">
                        {comp.isSyncing ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-1" />
                            <span className="font-mono text-xs font-bold text-primary animate-pulse">
                              {comp.syncTotal && comp.syncTotal > 0
                                ? `${comp.syncProcessed} / ${comp.syncTotal}`
                                : "&gt; _"}
                            </span>
                          </div>
                        ) : (
                          <span className="font-semibold">
                            {comp.products.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-5 px-6">
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase flex items-center gap-1.5 w-fit",
                            comp.status === "ACTIVE"
                              ? "bg-success/5 border-success/10 text-success"
                              : comp.status === "SYNCING"
                                ? "bg-primary/10 border-primary/20 text-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary-rgb),0.1)]"
                                : comp.status === "NO MATCHES"
                                  ? "bg-warning/10 border-warning/20 text-warning"
                                  : "bg-muted border-border text-muted-foreground",
                          )}
                        >
                          {comp.isSyncing && (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                          )}
                          {comp.status}
                        </span>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                              {comp.isSyncing ? "Sync Progress" : "Site Health"}
                            </span>
                            <span className="text-[9px] font-black text-muted-foreground">
                              {comp.isSyncing
                                ? comp.syncTotal && comp.syncTotal > 0
                                  ? `${Math.round((comp.syncProcessed! / comp.syncTotal) * 100)}%`
                                  : "0%"
                                : `${comp.health}%`}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden relative">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-700 ease-out",
                                comp.isSyncing
                                  ? "bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]"
                                  : "bg-success",
                              )}
                              style={{
                                width: comp.isSyncing
                                  ? comp.syncTotal && comp.syncTotal > 0
                                    ? `${(comp.syncProcessed! / comp.syncTotal) * 100}%`
                                    : "5%"
                                  : `${comp.health}%`,
                              }}
                            />
                            {comp.isSyncing && (
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                            )}
                          </div>
                          {comp.isSyncing &&
                            comp.syncStartedAt &&
                            comp.syncProcessed! > 0 && (
                              <p className="text-[8px] font-medium text-muted-foreground/60 italic">
                                Est:{" "}
                                {(() => {
                                  const start = new Date(
                                    comp.syncStartedAt,
                                  ).getTime();
                                  const elapsed = Date.now() - start;
                                  const perItem = elapsed / comp.syncProcessed!;
                                  const remaining =
                                    (comp.syncTotal! - comp.syncProcessed!) *
                                    perItem;
                                  const seconds = Math.round(remaining / 1000);
                                  return seconds > 60
                                    ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
                                    : `${seconds}s`;
                                })()}{" "}
                                remaining
                              </p>
                            )}
                        </div>
                      </td>
                      <td className="py-5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2 text-muted-foreground">
                          <button
                            onClick={() =>
                              comp.isSyncing
                                ? handleStopSync(comp.id)
                                : handleSyncSite(comp.id)
                            }
                            disabled={
                              syncingSiteId === comp.id ||
                              (comp.isSyncing && syncingSiteId !== null)
                            }
                            className={cn(
                              "p-2 rounded-md transition-all group",
                              comp.isSyncing
                                ? "bg-danger/10 text-danger hover:bg-danger/20"
                                : "hover:bg-primary/10 hover:text-primary",
                              (syncingSiteId === comp.id ||
                                (comp.isSyncing && syncingSiteId !== null)) &&
                                "opacity-50 cursor-not-allowed",
                            )}
                            title={
                              comp.isSyncing ? "Stop Crawler" : "Force Sync"
                            }
                          >
                            {comp.isSyncing ? (
                              <X className="w-4 h-4 animate-pulse" />
                            ) : (
                              <Zap className="w-4 h-4 transition-transform group-active:scale-95" />
                            )}
                          </button>
                          <a
                            href={comp.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-muted rounded-md transition-all"
                            title="View Website"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleDelete(comp.id)}
                            className="p-2 hover:bg-danger/10 rounded-md hover:text-danger transition-all"
                            title="Remove Tracker"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Global Terminal Feed - Bottom of Table */}
          {competitors.some((c) => c.isSyncing) && (
            <div className="mt-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-950 rounded-xl border border-white/10 shadow-2xl overflow-hidden">
                {/* Terminal Header */}
                <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/40" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/40" />
                    </div>
                    {(() => {
                      const activeSite = competitors.find((c) => c.isSyncing);
                      return activeSite ? (
                        <div className="text-[10px] font-mono uppercase tracking-widest ml-2 flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-primary font-bold">
                              [SYSTEM]
                            </span>
                            <span className="text-white/40">
                              INITIATING DATA STREAM FOR:
                            </span>
                            <span className="text-white font-bold">
                              {activeSite.name.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const activeSite = competitors.find((c) => c.isSyncing);
                      return activeSite ? (
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-primary animate-ping" />
                          <span className="text-[9px] font-mono text-white/40 uppercase font-bold">
                            PROGRESS:{" "}
                            <span className="text-primary">
                              {activeSite.syncProcessed}
                            </span>
                            /
                            <span className="text-white/60">
                              {activeSite.syncTotal}
                            </span>
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* Terminal Body - Vercel Build Log Style */}
                <div className="p-0 font-mono text-[11px] h-[300px] flex flex-col bg-[#0a0a0a]">
                  <div className="flex-1 overflow-y-auto p-4 space-y-0.5 scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-white/10">
                    {competitors.some((c) => c.isSyncing) ? (
                      competitors
                        .filter((c) => c.isSyncing)
                        .map((site) => (
                          <div key={site.id} className="space-y-0.5">
                            {/* Real Database Logs */}
                            {(site.logs || [])
                              .slice()
                              .reverse()
                              .map((log: any, _idx: number) => (
                                <div
                                  key={log.id}
                                  className="group flex gap-3 px-2 py-0.5 hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-primary/40"
                                >
                                  <span className="text-white/20 shrink-0 select-none w-16">
                                    {new Date(log.createdAt).toLocaleTimeString(
                                      [],
                                      { hour12: false },
                                    )}
                                  </span>
                                  <span
                                    className={cn(
                                      "font-black shrink-0 w-12",
                                      log.level === "SUCCESS"
                                        ? "text-green-500"
                                        : log.level === "ERROR"
                                          ? "text-red-500"
                                          : log.level === "WARN"
                                            ? "text-amber-500"
                                            : "text-blue-500",
                                    )}
                                  >
                                    {log.level}
                                  </span>
                                  <span className="text-white/80 break-all">
                                    {log.message}
                                  </span>
                                </div>
                              ))}

                            {/* Fallback if no logs yet */}
                            {(!site.logs || site.logs.length === 0) && (
                              <div className="flex gap-3 px-2 py-0.5 text-white/40 italic">
                                <span className="animate-pulse">_</span>
                                <span>
                                  Establishing secure tunnel to {site.name}...
                                </span>
                              </div>
                            )}
                          </div>
                        ))
                    ) : (
                      <div className="h-full flex items-center justify-center text-white/20 uppercase tracking-widest text-[10px]">
                        System Standby - No Active Crawlers
                      </div>
                    )}

                    {/* Final system signal */}
                    {competitors.some((c) => c.isSyncing) && (
                      <div className="flex gap-3 px-2 py-2 text-primary/40">
                        <span className="animate-pulse">&gt;</span>
                        <span className="animate-pulse">
                          Awaiting next telemetry packet...
                        </span>
                      </div>
                    )}

                    {/* Auto-scroll anchor */}
                    <div ref={consoleEndRef} />
                  </div>

                  {/* Traffic Footer Strip */}
                  <div className="bg-white/[0.02] border-t border-white/5 px-4 py-2 flex items-center justify-between">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] text-white/30 uppercase">
                          CPU
                        </span>
                        <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500/50 w-[40%]" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] text-white/30 uppercase">
                          MEM
                        </span>
                        <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500/50 w-[65%]" />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-1.5 h-1.5 rounded-sm transition-all duration-300",
                            Math.random() > 0.4
                              ? "bg-primary/40"
                              : "bg-white/5",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
