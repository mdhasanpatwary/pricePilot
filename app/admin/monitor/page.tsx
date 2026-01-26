"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  RefreshCw,
  Clock,
  Filter,
  Eye,
  Server,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ActiveSession {
  id: string;
  site: string;
  tenant: string;
  startTime: Date;
  requestsCompleted: number;
  requestsTotal: number;
  status: "running" | "waiting_challenge" | "completed" | "failed";
  currentProxy: string | null;
  challengeType: string | null;
  challengeStatus: "waiting" | "solved" | "failed" | null;
}

interface MonitorStats {
  activeSessions: number;
  requestsPerMinute: number;
  avgSessionDuration: number;
}

interface MonitorResponse {
  success: boolean;
  data: {
    stats: MonitorStats;
    sessions: ActiveSession[];
  };
}

export default function ScrapingMonitorDashboard() {
  const [data, setData] = useState<MonitorResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(
    null
  );
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [filterSite, setFilterSite] = useState<string>("all");

  const fetchMonitorData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/v1/admin/active-sessions");
      if (res.ok) {
        const json: MonitorResponse = await res.json();
        setData(json.data);
        setLastUpdated(new Date());
      } else {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        const errorMessage = res.status === 401 
          ? "Unauthorized: Admin access required"
          : res.status === 500
          ? `Server error: ${errorData.error || "Internal server error"}`
          : `Failed to fetch data: ${errorData.error || res.statusText}`;
        
        setError(errorMessage);
        console.error("Failed to fetch monitor data:", {
          status: res.status,
          statusText: res.statusText,
          error: errorData
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Network error";
      setError(`Connection error: ${errorMessage}`);
      console.error("Error fetching monitor data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitorData();
  }, [fetchMonitorData]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchMonitorData();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchMonitorData]);

  const handleRefresh = () => {
    fetchMonitorData();
  };

  const handleSessionClick = (session: ActiveSession) => {
    setSelectedSession(session);
  };

  if (loading && !data) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground font-medium">
            Loading real-time monitor...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Real-Time Scraping Monitor
          </h1>
          <p className="text-muted-foreground">
            Monitor active scraping sessions and real-time activity
          </p>
        </div>
        <Card className="p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Failed to Load Monitor Data</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchMonitorData} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const stats = data?.stats;
  const sessions = data?.sessions || [];

  // Get unique tenants and sites for filters
  const uniqueTenants = Array.from(new Set(sessions.map((s) => s.tenant)));
  const uniqueSites = Array.from(new Set(sessions.map((s) => s.site)));

  // Apply filters
  const filteredSessions = sessions.filter((session) => {
    if (filterTenant !== "all" && session.tenant !== filterTenant) {
      return false;
    }
    if (filterSite !== "all" && session.site !== filterSite) {
      return false;
    }
    return true;
  });

  const getStatusBadge = (status: ActiveSession["status"]) => {
    switch (status) {
      case "running":
        return (
          <Badge variant="success" className="flex items-center gap-1 w-fit">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Running
          </Badge>
        );
      case "waiting_challenge":
        return (
          <Badge variant="warning" className="flex items-center gap-1 w-fit">
            <Loader2 className="w-3 h-3 animate-spin" />
            Challenge
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="flex items-center gap-1 w-fit">
            <CheckCircle className="w-3 h-3" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
            <XCircle className="w-3 h-3" />
            Failed
          </Badge>
        );
    }
  };

  const getChallengeStatusBadge = (
    challengeStatus: ActiveSession["challengeStatus"]
  ) => {
    if (!challengeStatus) return null;

    switch (challengeStatus) {
      case "waiting":
        return (
          <Badge variant="warning" className="text-xs">
            Waiting
          </Badge>
        );
      case "solved":
        return (
          <Badge variant="success" className="text-xs">
            Solved
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="text-xs">
            Failed
          </Badge>
        );
    }
  };

  const formatDuration = (startTime: Date) => {
    const now = new Date();
    const start = new Date(startTime);
    const durationMs = now.getTime() - start.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Real-Time Scraping Monitor
          </h1>
          <p className="text-muted-foreground">
            Monitor active scraping sessions and real-time activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
              <Clock className="w-3.5 h-3.5" />
              <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-md">
            <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
              Auto-refresh
            </Label>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={autoRefresh}
            aria-label="Manually refresh session data"
          >
            <RefreshCw
              className={cn("w-4 h-4", autoRefresh && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards - Responsive: 1 col mobile, 3 col tablet+ */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Active Sessions
              </p>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {stats.activeSessions}
              </span>
              {stats.activeSessions > 0 && (
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Requests/Minute
              </p>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {stats.requestsPerMinute}
              </span>
              <span className="text-xs text-muted-foreground">req/min</span>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Avg Session Duration
              </p>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {Math.floor(stats.avgSessionDuration / 60)}
              </span>
              <span className="text-xs text-muted-foreground">
                min {stats.avgSessionDuration % 60}s
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      {sessions.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={filterTenant} onValueChange={setFilterTenant}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tenants</SelectItem>
                {uniqueTenants.map((tenant) => (
                  <SelectItem key={tenant} value={tenant}>
                    {tenant}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSite} onValueChange={setFilterSite}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {uniqueSites.map((site) => (
                  <SelectItem key={site} value={site}>
                    {site}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filterTenant !== "all" || filterSite !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterTenant("all");
                  setFilterSite("all");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Active Sessions Table */}
      <Card>
        <div className="border-b bg-muted/50 px-6 py-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Active Scraping Sessions
            {autoRefresh && (
              <span className="text-xs text-muted-foreground font-normal normal-case">
                (Auto-refreshing every 5 seconds)
              </span>
            )}
          </h3>
        </div>

        <div className="overflow-x-auto -mx-6 sm:mx-0">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                  Site
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                  Duration
                </th>
                <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                  Progress
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                  Proxy
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                  Challenge
                </th>
                <th className="px-6 py-3 text-center font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Activity className="w-10 h-10 opacity-50" />
                      <p className="font-medium">
                        No active scraping sessions
                      </p>
                      <p className="text-xs">
                        Sessions will appear here when scraping is in progress
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr
                    key={session.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      {getStatusBadge(session.status)}
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        {session.site}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm">{session.tenant}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-mono">
                          {formatDuration(session.startTime)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-mono">
                          {session.requestsCompleted} /{" "}
                          {session.requestsTotal}
                        </span>
                        {session.requestsTotal > 0 && (
                          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{
                                width: `${(session.requestsCompleted /
                                  session.requestsTotal) *
                                  100
                                  }%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {session.currentProxy ? (
                        <div className="flex items-center gap-2">
                          <Server className="w-3.5 h-3.5 text-muted-foreground" />
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                            {session.currentProxy.substring(0, 30)}
                            {session.currentProxy.length > 30 && "..."}
                          </code>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No proxy
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {session.challengeType ? (
                        <div className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                          <div className="flex flex-col gap-1">
                            <span className="text-xs">
                              {session.challengeType}
                            </span>
                            {getChallengeStatusBadge(
                              session.challengeStatus
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          None
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSessionClick(session)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Session Detail Modal */}
      <Dialog
        open={selectedSession !== null}
        onOpenChange={(open) => !open && setSelectedSession(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
            <DialogDescription>
              Detailed information about the scraping session
            </DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Status
                  </p>
                  {getStatusBadge(selectedSession.status)}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Session ID
                  </p>
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    {selectedSession.id}
                  </code>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Site
                </p>
                <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                  {selectedSession.site}
                </code>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Tenant
                </p>
                <p className="text-sm">{selectedSession.tenant}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Start Time
                  </p>
                  <p className="text-sm">
                    {new Date(selectedSession.startTime).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Duration
                  </p>
                  <p className="text-sm">
                    {formatDuration(selectedSession.startTime)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Progress
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Requests Completed</span>
                    <span className="font-mono">
                      {selectedSession.requestsCompleted} /{" "}
                      {selectedSession.requestsTotal}
                    </span>
                  </div>
                  {selectedSession.requestsTotal > 0 && (
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{
                          width: `${(selectedSession.requestsCompleted /
                            selectedSession.requestsTotal) *
                            100
                            }%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {selectedSession.currentProxy && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Current Proxy
                  </p>
                  <code className="text-sm bg-muted px-2 py-1 rounded font-mono break-all">
                    {selectedSession.currentProxy}
                  </code>
                </div>
              )}

              {selectedSession.challengeType && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Challenge Information
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Challenge Type</span>
                      <Badge variant="outline">
                        {selectedSession.challengeType}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Challenge Status</span>
                      {getChallengeStatusBadge(
                        selectedSession.challengeStatus
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
