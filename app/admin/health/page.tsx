"use client";

import { useState, useEffect } from "react";
import {
  HeartPulse,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";

interface HealthIssue {
  issue: string;
  count: number;
}

interface SiteHealth {
  id: string;
  baseUrl: string;
  tenant: string;
  status: "healthy" | "degraded" | "critical" | "stale" | "syncing" | "unknown";
  successRate: number;
  total: number;
  failed: number;
  lastSync: string | null;
  isSyncing: boolean;
  issues: HealthIssue[];
}

export default function ScraperHealthPage() {
  const [data, setData] = useState<SiteHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/scraper-health");
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch health data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredData = data.filter(
    (item) =>
      item.baseUrl.toLowerCase().includes(filter.toLowerCase()) ||
      item.tenant.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Competitor Health Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor scraping success rates and detect bot-blocking or layout
            changes.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-md text-sm font-medium transition-colors w-fit"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Filter by URL or Tenant..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border rounded-md bg-background focus:ring-2 focus:ring-primary/20 outline-none"
        />
      </div>

      {loading && data.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <HeartPulse className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>No competitor sites found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredData.map((site) => (
            <HealthCard key={site.id} site={site} />
          ))}
        </div>
      )}
    </div>
  );
}

function HealthCard({ site }: { site: SiteHealth }) {
  const getStatusColor = (status: SiteHealth["status"]) => {
    switch (status) {
      case "healthy":
        return "text-green-600 bg-green-50 dark:bg-green-900/20";
      case "degraded":
        return "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20";
      case "critical":
        return "text-red-600 bg-red-50 dark:bg-red-900/20";
      case "stale":
        return "text-zinc-500 bg-zinc-100 dark:bg-zinc-800";
      case "syncing":
        return "text-blue-600 bg-blue-50 dark:bg-blue-900/20";
      default:
        return "text-zinc-500 bg-muted";
    }
  };

  const getStatusIcon = (status: SiteHealth["status"]) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="w-5 h-5" />;
      case "degraded":
        return <AlertTriangle className="w-5 h-5" />;
      case "critical":
        return <AlertOctagon className="w-5 h-5" />;
      case "stale":
        return <Clock className="w-5 h-5" />;
      case "syncing":
        return <Loader2 className="w-5 h-5 animate-spin" />;
      default:
        return <HelpCircle className="w-5 h-5" />;
    }
  };

  return (
    <div
      className={`border rounded-lg p-5 bg-card flex flex-col justify-between h-full ${
        site.status === "critical"
          ? "border-red-200 dark:border-red-900/50 shadow-sm"
          : ""
      }`}
    >
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2 rounded-full ${getStatusColor(site.status)}`}>
            {getStatusIcon(site.status)}
          </div>
          <div
            className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${getStatusColor(site.status)}`}
          >
            {site.status}
          </div>
        </div>

        <h3
          className="font-semibold text-foreground truncate"
          title={site.baseUrl}
        >
          {site.baseUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 truncate">
          {site.tenant}
        </p>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Success Rate</span>
              <span className="font-medium">{site.successRate}%</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  site.successRate > 90
                    ? "bg-green-500"
                    : site.successRate > 50
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${site.successRate}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Attempts: {site.total}</span>
            <span>Failed: {site.failed}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t space-y-2">
        {site.issues.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              Top Issues
            </p>
            {site.issues.slice(0, 2).map((issue, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs text-red-600/90 dark:text-red-400"
              >
                <ShieldAlert className="w-3 h-3" />
                <span className="truncate">
                  {issue.issue} ({issue.count})
                </span>
              </div>
            ))}
            {site.issues.length > 2 && (
              <p className="text-xs text-muted-foreground italic">
                + {site.issues.length - 2} more issues
              </p>
            )}
          </div>
        ) : site.status === "stale" || site.status === "unknown" ? (
          <p className="text-xs text-muted-foreground italic">
            No recent health data available.
          </p>
        ) : (
          <p className="text-xs text-green-600 dark:text-green-500 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> No detected issues
          </p>
        )}

        <p className="text-[10px] text-right text-muted-foreground pt-2">
          Last Checked:{" "}
          {site.lastSync ? new Date(site.lastSync).toLocaleString() : "Never"}
        </p>
      </div>
    </div>
  );
}
