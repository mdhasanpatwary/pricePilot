/**
 * Domain Health Dashboard
 *
 * Admin panel page for domain-level scraping health.
 * Tracks:
 * - Success rate %
 * - Failure breakdown %
 * - Block rate
 * - Avg scrape time
 * - Last structure change
 *
 * @page /admin/analytics?tab=domains
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Globe, Clock, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TimeRange = "24h" | "7d" | "30d";

type FailureBreakdownRow = {
  failureType: string;
  count: number;
  pctOfFailures: number;
};

type DomainHealthRow = {
  domain: string;
  totalAttempts: number;
  successRatePct: number;
  blockRatePct: number;
  avgResponseTimeMs: number | null;
  lastStructureChangeAt: string | null;
  failureBreakdown: FailureBreakdownRow[];
};

type ApiResponse = {
  success: boolean;
  data: {
    domains: DomainHealthRow[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    timeRange: TimeRange;
  };
};

function formatMs(ms: number | null): string {
  if (ms === null) return "n/a";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "n/a";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "n/a";
  return d.toLocaleString();
}

export default function DomainHealthDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<DomainHealthRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const limit = 50;
  const offset = 0;

  const fetchData = useCallback(async (mode: "initial" | "refresh") => {
    setError(null);
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(
        `/api/v1/admin/analytics/domain-health?timeRange=${timeRange}&limit=${limit}&offset=${offset}`,
      );
      const json = (await res.json()) as ApiResponse;

      if (!res.ok || !json.success) {
        setError("Failed to load domain health metrics");
        setRows([]);
        return;
      }

      setRows(json.data.domains || []);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange]);

  useEffect(() => {
    void fetchData("initial");
  }, [fetchData]);

  const topSummary = useMemo(() => {
    if (rows.length === 0) return null;
    const totalAttempts = rows.reduce((sum, r) => sum + r.totalAttempts, 0);
    const weightedSuccess = rows.reduce(
      (sum, r) => sum + r.totalAttempts * (r.successRatePct / 100),
      0,
    );
    const weightedBlock = rows.reduce(
      (sum, r) => sum + r.totalAttempts * (r.blockRatePct / 100),
      0,
    );
    return {
      totalAttempts,
      avgSuccessRatePct:
        totalAttempts > 0 ? Math.round((weightedSuccess / totalAttempts) * 1000) / 10 : 0,
      avgBlockRatePct:
        totalAttempts > 0 ? Math.round((weightedBlock / totalAttempts) * 1000) / 10 : 0,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Domain Health</h1>
          <p className="text-muted-foreground">
            Success rate, failures, blocks, and structure changes by domain
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
              <Clock className="w-3.5 h-3.5" />
              <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          )}
          <Button
            onClick={() => void fetchData("refresh")}
            disabled={refreshing}
            variant="outline"
            size="sm"
            aria-label="Refresh domain health"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Time Range:</label>
              <Select
                value={timeRange}
                onValueChange={(v) => setTimeRange(v as TimeRange)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7d</SelectItem>
                  <SelectItem value="30d">Last 30d</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {topSummary && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">
                  Total Attempts: {topSummary.totalAttempts.toLocaleString()}
                </Badge>
                <Badge variant="secondary">
                  Avg Success: {topSummary.avgSuccessRatePct}%
                </Badge>
                <Badge variant="secondary">
                  Avg Block: {topSummary.avgBlockRatePct}%
                </Badge>
              </div>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-4 border-destructive/40">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <ShieldAlert className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead className="w-[220px]">Success</TableHead>
              <TableHead className="w-[140px]">Block</TableHead>
              <TableHead className="w-[140px]">Avg Time</TableHead>
              <TableHead className="w-[220px]">Last Structure Change</TableHead>
              <TableHead>Top Failures</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[110px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[260px]" /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No scrape attempts found in this time range.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const top3 = (r.failureBreakdown || []).slice(0, 3);
                return (
                  <TableRow key={r.domain}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span>{r.domain}</span>
                        <Badge variant="outline" className="ml-1">
                          {r.totalAttempts}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{r.successRatePct}%</span>
                          <span>{Math.round(100 - r.successRatePct)}% fail</span>
                        </div>
                        <Progress value={Math.max(0, Math.min(100, r.successRatePct))} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={r.blockRatePct >= 10 ? "destructive" : "secondary"}
                      >
                        {r.blockRatePct}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{formatMs(r.avgResponseTimeMs)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{formatDate(r.lastStructureChangeAt)}</span>
                    </TableCell>
                    <TableCell>
                      {top3.length === 0 ? (
                        <span className="text-sm text-muted-foreground">n/a</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {top3.map((f) => (
                            <Badge key={f.failureType} variant="secondary">
                              {f.failureType} {f.pctOfFailures}%
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

