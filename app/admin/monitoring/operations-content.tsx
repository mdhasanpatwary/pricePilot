"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Server,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface QueueJob {
  id: string;
  name: string;
  progress?: number | null;
  timestamp?: number | null;
  failedReason?: string | null;
}

interface QueueData {
  sync?: {
    counts?: Record<string, number>;
    activeJobs?: QueueJob[];
    recentFailures?: QueueJob[];
  };
  notifications?: {
    counts?: Record<string, number>;
    activeJobs?: QueueJob[];
  };
}

interface SyncSite {
  id: string;
  baseUrl: string;
  isSyncing: boolean;
  syncTotal?: number | null;
  syncProcessed?: number | null;
  syncLastAction?: string | null;
  lastSyncAt?: string | null;
  Tenant?: { companyName?: string | null };
}

interface ScraperHealthSite {
  id: string;
  baseUrl: string;
  status: "critical" | "degraded" | "stale" | "syncing" | "healthy" | "unknown";
  successRate: number;
  failed: number;
  total: number;
  lastSync?: string | null;
}

function fmtTime(iso?: string | null) {
  if (!iso) return "Never";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "Unknown";
  return dt.toLocaleString();
}

function fmtJobTime(ts?: number | null) {
  if (!ts) return "Unknown";
  return new Date(ts).toLocaleTimeString();
}

function queueCount(queue: Record<string, number> | undefined, key: string) {
  return queue?.[key] ?? 0;
}

function statusTone(status: ScraperHealthSite["status"]) {
  if (status === "healthy") return "default" as const;
  if (status === "syncing") return "secondary" as const;
  return "destructive" as const;
}

export function OperationsContent() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [syncSites, setSyncSites] = useState<SyncSite[]>([]);
  const [scraperHealth, setScraperHealth] = useState<ScraperHealthSite[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAll = useCallback(
    async (manualRefresh = false) => {
      if (manualRefresh) setRefreshing(true);
      if (!manualRefresh) setLoading(true);
      try {
        const [queueRes, syncRes, healthRes] = await Promise.all([
          fetch("/api/v1/admin/queue-status"),
          fetch("/api/v1/admin/sync-monitor"),
          fetch("/api/v1/admin/scraper-health"),
        ]);

        if (!queueRes.ok || !syncRes.ok || !healthRes.ok) {
          throw new Error("Failed to load monitoring operations data");
        }

        const [queueJson, syncJson, healthJson] = await Promise.all([
          queueRes.json(),
          syncRes.json(),
          healthRes.json(),
        ]);

        setQueueData(queueJson);
        setSyncSites(Array.isArray(syncJson) ? syncJson : []);
        setScraperHealth(Array.isArray(healthJson) ? healthJson : []);
        setError(null);
        setLastRefresh(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown operations error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchAll();
    const id = setInterval(() => fetchAll(true), 30000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const summary = useMemo(() => {
    const syncCounts = queueData?.sync?.counts;
    const notifCounts = queueData?.notifications?.counts;
    const activeSyncSites = syncSites.filter((s) => s.isSyncing).length;
    const unhealthyScrapers = scraperHealth.filter(
      (s) => s.status === "critical" || s.status === "degraded" || s.status === "stale"
    ).length;

    return {
      waiting: queueCount(syncCounts, "waiting"),
      active: queueCount(syncCounts, "active"),
      failed: queueCount(syncCounts, "failed"),
      notifActive: queueCount(notifCounts, "active"),
      activeSyncSites,
      unhealthyScrapers,
    };
  }, [queueData, syncSites, scraperHealth]);

  if (loading) {
    return (
      <div className="flex h-[30vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading operations...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Operations Monitor</h2>
          <p className="text-sm text-muted-foreground">
            Queue throughput, live sync sessions, and scraper health in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={() => fetchAll(true)} disabled={refreshing}>
            <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Queue Waiting" value={summary.waiting} icon={Clock} />
        <StatCard label="Queue Active" value={summary.active} icon={Activity} />
        <StatCard label="Queue Failed" value={summary.failed} icon={AlertTriangle} alert={summary.failed > 0} />
        <StatCard label="Notif Active" value={summary.notifActive} icon={Server} />
        <StatCard label="Sites Syncing" value={summary.activeSyncSites} icon={Timer} />
        <StatCard
          label="Unhealthy Scrapers"
          value={summary.unhealthyScrapers}
          icon={AlertTriangle}
          alert={summary.unhealthyScrapers > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Queue Status
          </h3>
          <div className="space-y-2 text-sm">
            <p>
              Sync queue:
              {" "}
              <Badge variant="outline" className="ml-2">
                active {queueCount(queueData?.sync?.counts, "active")}
              </Badge>
              <Badge variant="outline" className="ml-2">
                waiting {queueCount(queueData?.sync?.counts, "waiting")}
              </Badge>
              <Badge variant="destructive" className="ml-2">
                failed {queueCount(queueData?.sync?.counts, "failed")}
              </Badge>
            </p>
            <div className="rounded-md border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Recent Queue Failures</p>
              {queueData?.sync?.recentFailures?.length ? (
                <ul className="space-y-2">
                  {queueData.sync.recentFailures.slice(0, 4).map((job) => (
                    <li key={String(job.id)} className="text-xs">
                      <p className="font-medium">{job.name}</p>
                      <p className="text-muted-foreground">{job.failedReason || "Unknown error"}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No recent failures.</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Live Sync Sessions
          </h3>
          <div className="space-y-3">
            {syncSites.length === 0 && (
              <p className="text-xs text-muted-foreground">No active or recent sync sessions.</p>
            )}
            {syncSites.slice(0, 6).map((site) => {
              const total = site.syncTotal || 0;
              const done = site.syncProcessed || 0;
              const pct = total > 0 ? (done / total) * 100 : 0;
              return (
                <div key={site.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium">{site.baseUrl}</p>
                    <Badge variant={site.isSyncing ? "secondary" : "outline"}>
                      {site.isSyncing ? "syncing" : "recent"}
                    </Badge>
                  </div>
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    {site.Tenant?.companyName || "Unknown tenant"} • {site.syncLastAction || "Idle"}
                  </p>
                  {total > 0 && (
                    <div className="space-y-1">
                      <Progress value={pct} className="h-2" />
                      <p className="text-[11px] text-muted-foreground">
                        {done}/{total} processed
                      </p>
                    </div>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Last sync: {fmtTime(site.lastSyncAt)}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Scraper Health
          </h3>
          <div className="space-y-2">
            {scraperHealth.length === 0 && (
              <p className="text-xs text-muted-foreground">No scraper health data available.</p>
            )}
            {scraperHealth.slice(0, 8).map((site) => (
              <div key={site.id} className="rounded-md border p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium">{site.baseUrl}</p>
                  <Badge variant={statusTone(site.status)}>{site.status}</Badge>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Success {site.successRate}%</span>
                  <span>
                    {site.failed}/{site.total} failed
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Last sync: {fmtTime(site.lastSync)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active Queue Jobs
        </h3>
        {queueData?.sync?.activeJobs?.length ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {queueData.sync.activeJobs.slice(0, 8).map((job) => (
              <div key={String(job.id)} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <p className="truncate text-xs font-medium">{job.name}</p>
                  <Badge variant="outline">#{job.id}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Started: {fmtJobTime(job.timestamp)}
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Progress</span>
                  <span>{job.progress ?? 0}%</span>
                </div>
                <Progress value={Number(job.progress ?? 0)} className="mt-1 h-2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            No active jobs right now.
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  alert = false,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  alert?: boolean;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <Icon className={cn("h-4 w-4", alert ? "text-amber-500" : "text-muted-foreground")} />
      </div>
      <p className={cn("mt-1 text-xl font-semibold", alert && "text-amber-600")}>{value}</p>
    </Card>
  );
}
