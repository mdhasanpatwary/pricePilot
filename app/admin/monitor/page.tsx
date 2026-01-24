"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle,
  Clock,
  Loader2,
  Server,
  Terminal,
  RefreshCw,
  BadgeCent,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SyncLog {
  id: string;
  message: string;
  level: "INFO" | "WARN" | "ERROR" | "SUCCESS";
  createdAt: string;
}

interface SyncSession {
  id: string;
  baseUrl: string;
  type: string;
  platform: string;
  isSyncing: boolean;
  syncTotal: number;
  syncProcessed: number;
  syncLastAction: string | null;
  syncStartedAt: string | null;
  lastSyncAt: string | null;
  tenant: {
    companyName: string;
  };
  syncLogs: SyncLog[];
}

interface QueueJob {
  id: string;
  name: string;
  data: any;
  progress: number;
  timestamp: number;
  failedReason?: string;
}

interface QueueStats {
  name: string;
  counts: {
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    waiting: number;
  };
  activeJobs: QueueJob[];
  recentFailures?: QueueJob[];
}

interface AllQueueStats {
  sync: QueueStats;
  notifications: QueueStats;
}

export default function LiveSyncMonitor() {
  const [sessions, setSessions] = useState<SyncSession[]>([]);
  const [queueStats, setQueueStats] = useState<AllQueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchSyncData = async () => {
    try {
      const res = await fetch("/api/v1/admin/sync-monitor");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        setLastUpdated(new Date());
      }

      const queueRes = await fetch("/api/v1/admin/queue-status");
      if (queueRes.ok) {
        const queueData = await queueRes.json();
        setQueueStats(queueData);
      }
    } catch (error) {
      console.error("Failed to fetch sync data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncData();

    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchSyncData, 3000); // 3 seconds poll
    }

    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Live Sync Monitor
          </h1>
          <p className="text-muted-foreground">
            Real-time tracking of active scraper sessions and synchronization
            logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
            <span>
              Updated:{" "}
              {lastUpdated ? lastUpdated.toLocaleTimeString() : "Never"}
            </span>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              autoRefresh
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${autoRefresh ? "animate-spin" : ""}`}
            />
            {autoRefresh ? "Live Updates On" : "Live Updates Off"}
          </button>
        </div>
      </div>

      {/* Queue Health Section */}
      {queueStats && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <QueueCard stats={queueStats.sync} icon={RefreshCw} color="blue" />
            <QueueCard
              stats={queueStats.notifications}
              icon={Activity}
              color="indigo"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Active Jobs List */}
            <div className="border rounded-lg bg-card overflow-hidden h-fit">
              <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                   <Terminal className="w-4 h-4" />
                   Active Worker Processes
                </h3>
                <Badge variant="outline" className="text-[10px]">{queueStats.sync.activeJobs.length + queueStats.notifications.activeJobs.length} Running</Badge>
              </div>
              <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                {[...queueStats.sync.activeJobs, ...queueStats.notifications.activeJobs].length === 0 ? (
                  <p className="p-10 text-center text-sm text-muted-foreground italic">No active jobs in flight</p>
                ) : (
                  [...queueStats.sync.activeJobs, ...queueStats.notifications.activeJobs].map(job => (
                    <div key={job.id} className="p-3 hover:bg-muted/30 transition-colors flex items-center justify-between group">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded font-mono text-muted-foreground">#{job.id.substring(0,8)}</code>
                          <span className="text-xs font-bold">{job.data.type || job.name}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                          {job.data.siteId || job.data.tenantId || "System Core"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="flex flex-col items-end">
                            <span className="text-[10px] text-muted-foreground">{new Date(job.timestamp).toLocaleTimeString()}</span>
                            {job.progress > 0 && <span className="text-[10px] font-bold text-primary">{job.progress}%</span>}
                         </div>
                         <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Failures List */}
            <div className="border rounded-lg bg-card overflow-hidden h-fit">
              <div className="bg-red-50 dark:bg-red-950/20 px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-bold text-sm uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-2">
                   <Activity className="w-4 h-4" />
                   Recent Failure Logs
                </h3>
              </div>
              <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                {!queueStats.sync.recentFailures || queueStats.sync.recentFailures.length === 0 ? (
                  <p className="p-10 text-center text-sm text-muted-foreground italic">No recent failures detected</p>
                ) : (
                  queueStats.sync.recentFailures.map(job => (
                    <div key={job.id} className="p-3 bg-red-50/30 dark:bg-red-950/5 hover:bg-red-50/50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-red-700 dark:text-red-400">{job.data.type || job.name}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(job.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[10px] text-red-600 dark:text-red-400 font-mono line-clamp-2 bg-red-100/50 dark:bg-red-900/20 p-2 rounded border border-red-200/50 dark:border-red-900/50">
                        {job.failedReason}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
          <p>Connecting to Sync Orchestrator...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground">
          <Activity className="w-10 h-10 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium text-foreground">
            No sync activity found
          </p>
          <p className="text-sm">
            There are no active sync sessions and no recent history.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {sessions.map((session) => (
            <SyncCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function SyncCard({ session }: { session: SyncSession }) {
  const isRunning = session.isSyncing;
  const progress =
    session.syncTotal > 0
      ? Math.round((session.syncProcessed / session.syncTotal) * 100)
      : 0;

  return (
    <div
      className={`border rounded-lg overflow-hidden bg-card transition-all ${
        isRunning
          ? "shadow-md ring-1 ring-primary/20 border-primary/30"
          : "shadow-sm opacity-90 hover:opacity-100"
      }`}
    >
      {/* Header */}
      <div className="bg-muted/30 px-6 py-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isRunning
                ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {isRunning ? (
              <Activity className="w-5 h-5 animate-pulse" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">
                {session.tenant.companyName}
              </h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                  session.type === "COMPETITOR"
                    ? "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900"
                    : "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900"
                }`}
              >
                {session.type}
              </span>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 font-mono mt-0.5">
              <Server className="w-3 h-3" />
              {session.baseUrl}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {isRunning ? (
            <div className="text-right">
              <p className="text-sm font-medium text-primary flex items-center gap-1.5 justify-end">
                <Loader2 className="w-3 h-3 animate-spin" />
                Syncing Now
              </p>
              <p className="text-xs text-muted-foreground">
                Started: {new Date(session.syncStartedAt!).toLocaleTimeString()}
              </p>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">Completed</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3" />
                {session.lastSyncAt
                  ? new Date(session.lastSyncAt).toLocaleString()
                  : "N/A"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <div className="px-6 py-4 border-b">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium font-mono">
            {session.syncProcessed} / {session.syncTotal} ({progress}%)
          </span>
        </div>
        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out rounded-full ${
              isRunning ? "bg-primary" : "bg-green-500"
            }`}
            style={{ width: `${session.syncTotal === 0 ? 0 : progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 truncate font-mono">
          Last Action: {session.syncLastAction || "Idle"}
        </p>
      </div>

      {/* Logs Console */}
      <div className="bg-zinc-950 text-zinc-300 p-0 text-xs font-mono h-[200px] overflow-y-auto flex flex-col-reverse relative group">
        <div className="absolute top-2 right-2 px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pointer-events-none">
          <Terminal className="w-3 h-3" />
          Console Output
        </div>

        <div className="flex flex-col gap-0.5 p-4 min-h-full justify-end">
          {session.syncLogs.length > 0 ? (
            session.syncLogs.map((log) => (
              <div key={log.id} className="flex gap-2">
                <span className="text-zinc-500 shrink-0 select-none">
                  [{new Date(log.createdAt).toLocaleTimeString().split(" ")[0]}]
                </span>
                <span
                  className={
                    log.level === "ERROR"
                      ? "text-red-400 font-bold"
                      : log.level === "WARN"
                        ? "text-yellow-400"
                        : log.level === "SUCCESS"
                          ? "text-green-400"
                          : "text-zinc-300"
                  }
                >
                  {log.message}
                </span>
              </div>
            ))
          ) : (
            <div className="text-zinc-600 italic text-center py-10">
              No logs available for this session.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QueueCard({
  stats,
  icon: Icon,
  color,
}: {
  stats: QueueStats;
  icon: any;
  color: "blue" | "indigo";
}) {
  const total = stats.counts.active + stats.counts.waiting + stats.counts.delayed;
  
  return (
    <div className="border rounded-lg p-4 bg-card shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
          <Icon className={`w-4 h-4 text-${color}-500`} />
          {stats.name}
        </h3>
        {stats.counts.failed > 0 && (
          <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">
            {stats.counts.failed} Fails
          </span>
        )}
      </div>
      <div className="flex items-end gap-2 mb-1">
        <span className="text-2xl font-bold">{stats.counts.active}</span>
        <span className="text-sm text-muted-foreground mb-1">Active</span>
      </div>
      <div className="flex gap-2 text-xs text-muted-foreground mt-3 pt-3 border-t">
        <div className="flex flex-col">
          <span className="font-medium">{stats.counts.waiting}</span>
          <span className="text-[10px]">Waiting</span>
        </div>
        <div className="flex flex-col border-l pl-2">
          <span className="font-medium">{stats.counts.delayed}</span>
          <span className="text-[10px]">Delayed</span>
        </div>
        <div className="flex flex-col border-l pl-2">
          <span className="font-medium text-green-600">{stats.counts.completed}</span>
          <span className="text-[10px]">Done</span>
        </div>
      </div>
    </div>
  );
}
