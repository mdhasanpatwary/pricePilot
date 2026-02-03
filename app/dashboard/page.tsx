"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  TrendingDown,
  Package,
  ShoppingBag,
  Activity,
  ChevronRight,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import AnnouncementBanner from "@/components/announcement-banner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
// shadcn/ui components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function DashboardContent() {
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("tenantId");

  const [stats, setStats] = useState({
    totalSKUs: "0",
    activeRivals: "0",
    criticalAlerts: "0",
    marketEdge: 0 as number,
  });
  const [currency, setCurrency] = useState<string>("USD");
  const [positionSummary, setPositionSummary] = useState({
    cheapest: 0,
    nearCheapest: 0,
    neutral: 0,
    expensive: 0,
  });
  const [_isLoading, setIsLoading] = useState(true);

  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = `/api/v1/analytics/summary${impersonateId ? `?tenantId=${impersonateId}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalSKUs: data.stats.totalSKUs.toString(),
          activeRivals: data.stats.activeRivals.toString(),
          criticalAlerts: data.stats.criticalAlerts.toString(),
          marketEdge: Number(data.stats.marketEdge || 0),
        });
        if (data.stats.currency) setCurrency(data.stats.currency);
        setPositionSummary(data.positionSummary);
      } else {
        toast.error("Failed to load analytics");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setIsLoading(false);
    }
  }, [impersonateId]);

  const fetchRecentLogs = useCallback(async () => {
    try {
      const url = `/api/v1/analytics/logs${impersonateId ? `?tenantId=${impersonateId}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRecentLogs(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [impersonateId]);

  const fetchHistory = useCallback(async () => {
    try {
      const base = "/api/v1/analytics/history?days=30";
      const url = impersonateId ? `${base}&tenantId=${impersonateId}` : base;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setChartData(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [impersonateId]);

  useEffect(() => {
    fetchAnalytics();
    fetchRecentLogs();
    fetchHistory();
  }, [fetchAnalytics, fetchRecentLogs, fetchHistory]);

  const handleRunSync = async () => {
    setIsSyncing(true);
    const id = toast.loading("Syncing market data...");
    try {
      const res = await fetch("/api/v1/sync/full", { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        toast.success(
          `Sync complete! Scrapped ${result.scrapped} products, updated ${result.updated}.`,
          { id },
        );
        fetchAnalytics();
      } else if (res.status === 409) {
        const data = await res.json();
        toast.error(data.message || "Sync already in progress", { id });
      } else {
        toast.error("Sync failed", { id });
      }
    } catch (error) {
      toast.error("Sync connection error", { id });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportReport = () => {
    window.location.href = "/api/v1/analytics/reports/download";
  };

  const statsConfig = [
    {
      label: "Total SKUs Live",
      value: stats.totalSKUs,
      icon: Package,
      change: "+12%",
      trend: "up",
    },
    {
      label: "Active Rivals",
      value: stats.activeRivals,
      icon: ShoppingBag,
      change: "Stable",
      trend: "neutral",
    },
    {
      label: "Critical Alerts",
      value: stats.criticalAlerts,
      icon: TrendingDown,
      change: "-14%",
      trend: "down",
    },
    {
      label: "Market Edge",
      value: formatCurrency(Number(stats.marketEdge || 0), currency),
      icon: Activity,
      change: "+2%",
      trend: "up",
    },
  ];

  const positionData = [
    { label: "Cheapest", value: positionSummary.cheapest, color: "bg-success" },
    {
      label: "Near Cheapest",
      value: positionSummary.nearCheapest,
      color: "bg-primary",
    },
    {
      label: "Neutral",
      value: positionSummary.neutral,
      color: "bg-muted-foreground/30",
    },
    {
      label: "Expensive",
      value: positionSummary.expensive,
      color: "bg-danger",
    },
  ];

  const total =
    (positionSummary.cheapest || 0) +
    (positionSummary.nearCheapest || 0) +
    (positionSummary.neutral || 0) +
    (positionSummary.expensive || 0) || 1;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Announcement Banner */}
      <AnnouncementBanner
        id="laravel-integration-launch"
        message="🎉 Laravel Integration Now Available! Download the package and connect your Laravel store to PricePilot."
        ctaText="Get Started"
        ctaLink="/dashboard/integrations/laravel"
        variant="success"
      />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Command Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Monitor your market position and pricing performance. Competitor prices are automatically monitored daily at midnight UTC.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            disabled={isSyncing}
            onClick={handleRunSync}
            className="px-6 py-2.5"
          >
            {isSyncing ? "Syncing..." : "Run Global Sync"}
          </Button>
          <Button
            onClick={handleExportReport}
            variant="outline"
            className="px-6 py-2.5"
          >
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsConfig.map((stat) => (
          <Card key={stat.label} className="p-6 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="p-0 mb-4">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-muted/50 rounded-lg">
                  <stat.icon className="w-5 h-5 text-foreground/70" />
                </div>
                <div
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    stat.trend === "up"
                      ? "bg-success/10 text-success border-success/20"
                      : stat.trend === "down"
                        ? "bg-danger/10 text-danger border-danger/20"
                        : "bg-muted text-muted-foreground border-border",
                  )}
                >
                  {stat.change}
                </div>
              </div>
            </CardHeader>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
              <h3 className="text-3xl font-bold">{stat.value}</h3>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Position Summary */}
        <Card className="p-8 shadow-sm">
          <CardHeader className="p-0 mb-8">
            <CardTitle className="text-lg font-bold">Position Summary</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Your market stance vs. competition
            </p>
          </CardHeader>
          <div className="space-y-6">
            {positionData.map((item, i) => {
              const percentage = Math.round((item.value / total) * 100);
              return (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span>{percentage}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        item.color,
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-10 pt-8 border-t border-border flex justify-between">
            <div>
              <p className="text-2xl font-bold text-primary">100%</p>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">
                Coverage
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold">8.4k</p>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">
                Calculations
              </p>
            </div>
          </div>
        </Card>

        {/* Price Trend Chart */}
        <Card className="p-8 shadow-sm">
          <CardHeader className="p-0 mb-8">
            <div>
              <CardTitle className="text-lg font-bold">Price Index Trend</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                30-day market movement
              </p>
            </div>
          </CardHeader>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="text-xs font-bold text-muted-foreground">
                  YOU
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
                <span className="text-xs font-bold text-muted-foreground">
                  RIVALS
                </span>
              </div>
            </div>
          </div>
          <div className="h-70 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorIndex" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.1}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border) / 0.5)"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 11,
                    fontWeight: 600,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                  dy={10}
                />
                <YAxis hide={true} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    color: "hsl(var(--foreground))",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                    fontWeight: 600,
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="index"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorIndex)"
                />
                <Area
                  type="monotone"
                  dataKey="rivals"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Execution Queue */}
        <Card className="p-8 shadow-sm">
          <CardHeader className="p-0 mb-8">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-foreground">
                Live Execution Queue
              </CardTitle>
              <Link
                href="/dashboard/activity"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-full transition-all"
              >
                Full Log <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  <TableHead className="pb-4 pr-4">Product / SKU</TableHead>
                  <TableHead className="pb-4 px-4">Action Type</TableHead>
                  <TableHead className="pb-4 px-4">Adjustment</TableHead>
                  <TableHead className="pb-4 pl-4 text-right">Time Ago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-sm font-medium">
                {recentLogs.map((item, i) => (
                  <TableRow
                    key={i}
                    className="border-b border-border/50 group hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="py-5 pr-4">
                      <div>
                        <div className="text-foreground font-bold">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono tracking-tighter">
                          {item.sku}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-5 px-4">
                      <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                        {item.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-5 px-4">
                      <Badge variant="destructive" className="text-xs font-bold">
                        {item.value}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-5 pl-4 text-right text-muted-foreground text-xs font-bold">
                      {item.time}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardOverview() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-1 h-100 rounded-xl" />
            <Skeleton className="lg:col-span-2 h-100 rounded-xl" />
            <Skeleton className="lg:col-span-3 h-75 rounded-xl" />
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
