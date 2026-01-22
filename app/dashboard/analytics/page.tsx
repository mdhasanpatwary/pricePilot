"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  TrendingUp,
  BarChart3,
  Download,
  RefreshCw,
  Target,
  AlertCircle,
  TrendingUp as ProfitIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("tenantId");

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [currency, setCurrency] = useState("USD");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = impersonateId ? `?tenantId=${impersonateId}` : "";
      const [summaryRes, historyRes] = await Promise.all([
        fetch(`/api/v1/analytics/summary${query}`),
        fetch(
          `/api/v1/analytics/history${query ? query + "&days=30" : "?days=30"}`,
        ),
      ]);

      if (summaryRes.ok && historyRes.ok) {
        const summaryData = await summaryRes.json();
        const historyData = await historyRes.json();
        setStats(summaryData);
        setHistory(historyData);
        if (summaryData.stats.currency) setCurrency(summaryData.stats.currency);
      } else {
        toast.error("Failed to load analytics data");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setIsLoading(false);
    }
  }, [impersonateId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownloadReport = async () => {
    const id = toast.loading("Generating your intelligence report...");
    try {
      const query = impersonateId ? `?tenantId=${impersonateId}` : "";
      const res = await fetch(`/api/v1/analytics/reports/download${query}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const date = new Date().toISOString().split("T")[0];
        a.download = `PricePilot-Market-Report-${date}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("Report downloaded successfully", { id });
      } else {
        toast.error("Failed to generate report", { id });
      }
    } catch (e) {
      toast.error("Download error", { id });
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  const { positionSummary, categoryBreakdown } = stats;
  const totalMatches = Object.values(positionSummary).reduce(
    (a: any, b: any) => a + b,
    0,
  ) as number;

  const pieData = [
    {
      name: "Cheapest",
      value: positionSummary.cheapest,
      color: "hsl(var(--success))",
    },
    {
      name: "Near Cheapest",
      value: positionSummary.nearCheapest,
      color: "hsl(var(--primary))",
    },
    {
      name: "Neutral",
      value: positionSummary.neutral,
      color: "hsl(var(--muted-foreground) / 0.5)",
    },
    {
      name: "Expensive",
      value: positionSummary.expensive,
      color: "hsl(var(--danger))",
    },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Market Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            Deep dive into your competitive positioning and market trends.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 hover:bg-muted rounded-lg border border-border transition-all"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownloadReport}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <Download className="w-4 h-4" />
            Download CSV Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Position Distribution */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Market Stance</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    {d.name}
                  </span>
                  <span className="text-sm font-bold">
                    {Math.round((d.value / totalMatches) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Market Edge History */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success" />
              <h3 className="font-bold">Price Index History</h3>
            </div>
            <div className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
              Last 30 Days
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={history}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorIdx" x1="0" y1="0" x2="0" y2="1">
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
                  stroke="hsl(var(--border)/0.5)"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="index"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#colorIdx)"
                />
                <Area
                  type="monotone"
                  dataKey="rivals"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="none"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Intelligence Table */}
      <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Category Performance
            </h3>
            <p className="text-sm text-muted-foreground">
              Market standing broken down by product category.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-left">
                <th className="pb-4">Category Name</th>
                <th className="pb-4">Products</th>
                <th className="pb-4">Cheapest (%)</th>
                <th className="pb-4">Expensive (%)</th>
                <th className="pb-4 w-[200px]">Market Stance</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {categoryBreakdown?.map((cat: any) => {
                const cheapPct = Math.round((cat.cheapest / cat.total) * 100);
                const expPct = Math.round((cat.expensive / cat.total) * 100);
                const neutralPct = 100 - cheapPct - expPct;

                return (
                  <tr
                    key={cat.name}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-4 font-bold">{cat.name}</td>
                    <td className="py-4">{cat.total}</td>
                    <td className="py-4">
                      <span className="text-success font-bold">
                        {cheapPct}%
                      </span>
                    </td>
                    <td className="py-4">
                      <span className="text-danger font-bold">{expPct}%</span>
                    </td>
                    <td className="py-4">
                      <div className="flex h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="bg-success"
                          style={{ width: `${cheapPct}%` }}
                        />
                        <div
                          className="bg-muted-foreground/30"
                          style={{ width: `${neutralPct}%` }}
                        />
                        <div
                          className="bg-danger"
                          style={{ width: `${expPct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(!categoryBreakdown || categoryBreakdown.length === 0) && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground italic"
                  >
                    No categorical data available yet. Run a sync to see
                    updates.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-600 text-white rounded-2xl p-8 relative overflow-hidden group shadow-xl">
          <div className="relative z-10">
            <h4 className="text-lg font-bold mb-2">Automated Optimization</h4>
            <p className="text-blue-100 text-sm mb-6 leading-relaxed">
              Based on your market position, we suggest adjusting prices for{" "}
              <b>{stats.stats.criticalAlerts}</b> items where you are currently
              being undercut.
            </p>
            <button
              onClick={() => (window.location.href = "/dashboard/rules")}
              className="bg-white text-blue-600 px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors shadow-lg"
            >
              Review Pricing Rules
            </button>
          </div>
          <AlertCircle className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 group-hover:scale-110 transition-transform duration-500" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="p-3 bg-primary/10 rounded-full mb-4">
            <ProfitIcon className="w-6 h-6 text-primary" />
          </div>
          <h4 className="text-lg font-bold">Estimated Market Edge</h4>
          <div className="text-3xl font-black mt-2">
            {formatCurrency(stats.stats.marketEdge, currency)}
          </div>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-bold">
            Average Advantage per Product
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center text-muted-foreground">
          Loading Market Intelligence...
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}
