/**
 * Scrape Cost Metrics Dashboard
 *
 * Admin panel page for operational scrape cost.
 * Tracks:
 * - Avg time per scrape
 * - Context creation count/rate
 * - Proxy usage rate
 * - Retry frequency
 *
 * @page /admin/analytics?tab=cost
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, DollarSign, Clock, Server, Repeat2 } from "lucide-react";
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

type CostRow = {
  domain: string;
  totalAttempts: number;
  successCount: number;
  successRatePct: number;
  avgTimeMs: number | null;
  proxyUsageRatePct: number;
  retryRatePct: number;
  contextCreationRatePct: number;
  costPerSuccessfulScrape: {
    timeMs: number | null;
    attempts: number | null;
    retries: number | null;
    proxyAttempts: number | null;
    contextCreations: number | null;
  };
};

type ApiResponse = {
  success: boolean;
  data: {
    domains: CostRow[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    timeRange: TimeRange;
  };
};

function formatMs(ms: number | null): string {
  if (ms === null) return "n/a";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function ScrapeCostDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<CostRow[]>([]);
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
        `/api/v1/admin/analytics/scrape-cost?timeRange=${timeRange}&limit=${limit}&offset=${offset}`,
      );
      const json = (await res.json()) as ApiResponse;

      if (!res.ok || !json.success) {
        setError("Failed to load scrape cost metrics");
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

  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const totalAttempts = rows.reduce((sum, r) => sum + r.totalAttempts, 0);
    const totalSuccess = rows.reduce((sum, r) => sum + r.successCount, 0);
    const weightedProxy = rows.reduce(
      (sum, r) => sum + r.totalAttempts * (r.proxyUsageRatePct / 100),
      0,
    );
    const weightedRetry = rows.reduce(
      (sum, r) => sum + r.totalAttempts * (r.retryRatePct / 100),
      0,
    );
    const weightedContext = rows.reduce(
      (sum, r) => sum + r.totalAttempts * (r.contextCreationRatePct / 100),
      0,
    );

    return {
      totalAttempts,
      totalSuccess,
      proxyUsageRatePct:
        totalAttempts > 0 ? Math.round((weightedProxy / totalAttempts) * 1000) / 10 : 0,
      retryRatePct:
        totalAttempts > 0 ? Math.round((weightedRetry / totalAttempts) * 1000) / 10 : 0,
      contextCreationRatePct:
        totalAttempts > 0 ? Math.round((weightedContext / totalAttempts) * 1000) / 10 : 0,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scrape Cost</h1>
          <p className="text-muted-foreground">
            Time, proxies, retries, and context creation per successful scrape
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
            aria-label="Refresh scrape cost"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Time Range:</label>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
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
            {summary && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">Attempts: {summary.totalAttempts.toLocaleString()}</Badge>
                <Badge variant="secondary">Success: {summary.totalSuccess.toLocaleString()}</Badge>
                <Badge variant="secondary">Proxy: {summary.proxyUsageRatePct}%</Badge>
                <Badge variant="secondary">Retry: {summary.retryRatePct}%</Badge>
                <Badge variant="secondary">Context: {summary.contextCreationRatePct}%</Badge>
              </div>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-4 border-destructive/40">
          <div className="text-sm text-destructive">{error}</div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead className="w-[220px]">Success</TableHead>
              <TableHead className="w-[140px]">Avg Time</TableHead>
              <TableHead className="w-[140px]">Proxy Rate</TableHead>
              <TableHead className="w-[140px]">Retry Rate</TableHead>
              <TableHead className="w-[160px]">Context Rate</TableHead>
              <TableHead>Cost / Success</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[110px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[110px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[260px]" /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No scrape attempts found in this time range.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.domain}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{r.domain}</span>
                      <Badge variant="outline">{r.totalAttempts}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{r.successRatePct}%</span>
                        <span>{r.successCount}/{r.totalAttempts}</span>
                      </div>
                      <Progress value={Math.max(0, Math.min(100, r.successRatePct))} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{formatMs(r.avgTimeMs)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-muted-foreground" />
                      <Badge variant={r.proxyUsageRatePct >= 50 ? "secondary" : "outline"}>
                        {r.proxyUsageRatePct}%
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Repeat2 className="w-4 h-4 text-muted-foreground" />
                      <Badge variant={r.retryRatePct >= 20 ? "secondary" : "outline"}>
                        {r.retryRatePct}%
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.contextCreationRatePct >= 20 ? "secondary" : "outline"}>
                      {r.contextCreationRatePct}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        time {formatMs(r.costPerSuccessfulScrape.timeMs)}
                      </Badge>
                      <Badge variant="secondary">
                        attempts {r.costPerSuccessfulScrape.attempts ?? "n/a"}
                      </Badge>
                      <Badge variant="secondary">
                        retries {r.costPerSuccessfulScrape.retries ?? "n/a"}
                      </Badge>
                      <Badge variant="secondary">
                        proxy {r.costPerSuccessfulScrape.proxyAttempts ?? "n/a"}
                      </Badge>
                      <Badge variant="secondary">
                        ctx {r.costPerSuccessfulScrape.contextCreations ?? "n/a"}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

