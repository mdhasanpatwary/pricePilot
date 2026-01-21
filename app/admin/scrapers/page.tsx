"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  Zap,
  CheckCircle2,
  Globe,
  Clock,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScraperStat {
  domain: string;
  type: string;
  tenant: string;
  lastRun: string | null;
  status: "RUNNING" | "IDLE";
}

interface ScraperData {
  stats: {
    totalSites: number;
    activeSessions: number;
    totalRequests24h: number;
    successRate: string;
    avgLatency: string;
    engineStatus: string;
  };
  scrapers: ScraperStat[];
}

export default function ScraperStatusPage() {
  const [data, setData] = useState<ScraperData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/v1/admin/scrapers");
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error("Failed to load status", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Initializing scraping engine...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scraper Status</h1>
          <p className="text-muted-foreground mt-1">
            Global monitoring of scraping engine, request volume, and site
            reachability.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-bold text-emerald-600 uppercase tracking-widest">
            {data.stats.engineStatus}
          </span>
          <button
            onClick={fetchStatus}
            disabled={refreshing}
            className="p-2 hover:bg-muted rounded-full transition-all text-muted-foreground"
            title="Refresh Status"
          >
            <RefreshCw
              className={cn("w-4 h-4", refreshing && "animate-spin")}
            />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-50 text-blue-600 dark:bg-blue-900/20 rounded-lg">
              <Zap className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              Last 24h
            </span>
          </div>
          <div>
            <p className="text-3xl font-black">{data.stats.totalRequests24h}</p>
            <p className="text-xs text-muted-foreground font-medium">
              Requests Handled
            </p>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 uppercase">
              Health
            </span>
          </div>
          <div>
            <p className="text-3xl font-black">{data.stats.successRate}</p>
            <p className="text-xs text-muted-foreground font-medium">
              Success Rate
            </p>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-purple-50 text-purple-600 dark:bg-purple-900/20 rounded-lg">
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              Real-time
            </span>
          </div>
          <div>
            <p className="text-3xl font-black font-mono">
              {data.stats.activeSessions}
            </p>
            <p className="text-xs text-muted-foreground font-medium">
              Active Threads
            </p>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-orange-50 text-orange-600 dark:bg-orange-900/20 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              Latency
            </span>
          </div>
          <div>
            <p className="text-3xl font-black font-mono">
              {data.stats.avgLatency}
            </p>
            <p className="text-xs text-muted-foreground font-medium">
              Avg. Response Time
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Scrapers List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <Globe className="w-4 h-4" /> Configured Endpoints
            </h3>
            <span className="px-2 py-0.5 bg-muted rounded text-[10px] font-bold text-muted-foreground">
              {data.stats.totalSites} TOTAL
            </span>
          </div>

          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="px-6 py-4 text-left">Target Domain</th>
                  <th className="px-6 py-4 text-left">Tenant Info</th>
                  <th className="px-6 py-4 text-left">Last Sync</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.scrapers.map((s, i) => (
                  <tr
                    key={i}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">
                          {s.domain}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded font-black border",
                            s.type === "USER"
                              ? "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20"
                              : "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/20",
                          )}
                        >
                          {s.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-muted-foreground font-medium">
                        {s.tenant}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-muted-foreground font-mono">
                        {s.lastRun
                          ? new Date(s.lastRun).toLocaleString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "2-digit",
                              month: "short",
                            })
                          : "Never"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                          s.status === "RUNNING"
                            ? "bg-blue-50 text-blue-600 border-blue-100 animate-pulse dark:bg-blue-900/20"
                            : "bg-muted text-muted-foreground border-border",
                        )}
                      >
                        <span
                          className={cn(
                            "w-1 h-1 rounded-full",
                            s.status === "RUNNING"
                              ? "bg-blue-500"
                              : "bg-muted-foreground",
                          )}
                        />
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.scrapers.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-muted-foreground italic"
                    >
                      No scraping endpoints configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Engine Intelligence */}
        <div className="space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <Cpu className="w-4 h-4" /> Engine Health
          </h3>
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Proxy Latency
                </span>
                <span className="text-sm font-bold text-emerald-500">GOOD</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full">
                <div className="h-full w-[85%] bg-emerald-500 rounded-full" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Memory Usage
                </span>
                <span className="text-sm font-bold text-emerald-500">
                  2.4 GB
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full">
                <div className="h-full w-[45%] bg-blue-500 rounded-full" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Bot Detection Rate
                </span>
                <span className="text-sm font-bold text-emerald-500">
                  ~2.1%
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full">
                <div className="h-full w-[12%] bg-orange-500 rounded-full" />
              </div>
            </div>

            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                <span>Stealth Plugin Active</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Globe className="w-4 h-4 text-emerald-500" />
                <span>Proxy Rotation Active</span>
              </div>
            </div>

            <button className="w-full py-2.5 bg-secondary hover:bg-secondary/80 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2">
              Run System Diagnostics <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
