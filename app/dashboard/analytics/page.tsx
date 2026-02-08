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
  TrendingDown,
  TrendingUp as ProfitIcon,
  Globe,
  ShieldCheck,
  Activity,
  Zap,
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
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("tenantId");

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [techStats, setTechStats] = useState<any>(null);
  const [competitorStats, setCompetitorStats] = useState<any>(null);
  const [elasticityData, setElasticityData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [currency, setCurrency] = useState("USD");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = impersonateId ? `?tenantId=${impersonateId}` : "";
      const [summaryRes, historyRes, techRes, compRes, elasticRes] = await Promise.all([
        fetch(`/api/v1/analytics/summary${query}`),
        fetch(
          `/api/v1/analytics/history${query ? query + "&days=30" : "?days=30"}`,
        ),
        fetch(`/api/v1/analytics/tech-intelligence${query}`),
        fetch(`/api/v1/analytics/competitor-analysis${query}`),
        fetch(`/api/v1/analytics/price-elasticity${query}`),
      ]);

      if (summaryRes.ok && historyRes.ok && techRes.ok && compRes.ok && elasticRes.ok) {
        const summaryData = await summaryRes.json();
        const historyData = await historyRes.json();
        const techData = await techRes.json();
        const compData = await compRes.json();
        const elasticData = await elasticRes.json();

        setStats(summaryData);
        if (Array.isArray(historyData)) {
          setHistory(historyData);
        } else {
          setHistory(historyData.chartData || []);
        }
        setTechStats(techData);
        setCompetitorStats(compData);
        setElasticityData(elasticData);
        if (summaryData.stats.currency) setCurrency(summaryData.stats.currency);
      } else {
        toast.error("Failed to load analytics data");
      }
    } catch (error) {
      toast.error("Connection error");
      setHistory([]); // Ensure it's always an array on error
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
          <Skeleton className="h-75 rounded-xl" />
          <Skeleton className="h-75 rounded-xl" />
          <Skeleton className="h-75 rounded-xl" />
        </div>
        <Skeleton className="h-100 w-full rounded-xl" />
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
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Market Stance</h3>
          </div>
          <div className="h-62.5 w-full">
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
        </Card>

        {/* Global Market Edge History */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success" />
              <h3 className="font-bold">Price Index History</h3>
            </div>
            <div className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
              Last 30 Days
            </div>
          </div>
          <div className="h-75 w-full">
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
        </Card>
      </div>

      {/* Category Intelligence Table */}
      <Card className="p-8">
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
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-left">
                <TableHead className="pb-4">Category Name</TableHead>
                <TableHead className="pb-4">Products</TableHead>
                <TableHead className="pb-4">Cheapest (%)</TableHead>
                <TableHead className="pb-4">Expensive (%)</TableHead>
                <TableHead className="pb-4 w-50">Market Stance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-sm">
              {categoryBreakdown?.map((cat: any) => {
                const cheapPct = Math.round((cat.cheapest / cat.total) * 100);
                const expPct = Math.round((cat.expensive / cat.total) * 100);
                const neutralPct = 100 - cheapPct - expPct;

                return (
                  <TableRow
                    key={cat.name}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="py-4 font-bold">{cat.name}</TableCell>
                    <TableCell className="py-4">{cat.total}</TableCell>
                    <TableCell className="py-4">
                      <span className="text-success font-bold">
                        {cheapPct}%
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-danger font-bold">{expPct}%</span>
                    </TableCell>
                    <TableCell className="py-4">
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
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!categoryBreakdown || categoryBreakdown.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground italic"
                  >
                    No categorical data available yet. Run a sync to see
                    updates.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

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

      {/* Tech Intelligence Section (NEW) */}
      {techStats && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Brand Performance Analysis */}
            <div className="flex-1 bg-card border border-border rounded-xl p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Target className="w-5 h-5 text-primary" />
                <h3 className="text-xl font-bold">Brand Performance Matrix</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-left">
                      <TableHead className="pb-4">Brand</TableHead>
                      <TableHead className="pb-4">Risk (%)</TableHead>
                      <TableHead className="pb-4">Avg Price</TableHead>
                      <TableHead className="pb-4">Mkt Index</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-sm">
                    {techStats.brandPerformance?.map((b: any) => (
                      <TableRow key={b.brand} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <TableCell className="py-4 font-bold">{b.brand}</TableCell>
                        <TableCell className="py-4">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", b.riskPercentage > 30 ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>
                            {b.riskPercentage}%
                          </span>
                        </TableCell>
                        <TableCell className="py-4 font-mono">{formatCurrency(b.avgPrice, currency)}</TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-1.5 font-bold">
                            {b.marketIndex > 0 ? (
                              <TrendingUp className="w-3 h-3 text-success" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-danger" />
                            )}
                            <span className={b.marketIndex > 0 ? "text-success" : "text-danger"}>
                              {Math.abs(b.marketIndex)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Spec-Based Pricing Trends */}
            <div className="w-full md:w-1/3 bg-card border border-border rounded-xl p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <ProfitIcon className="w-5 h-5 text-primary" />
                <h3 className="text-xl font-bold">Spec Pricing Hub</h3>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground mb-3 tracking-widest opacity-60">RAM Variation Premium</p>
                  <div className="space-y-3">
                    {techStats.specInsights?.ram?.map((r: any) => (
                      <div key={r.value} className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span>{r.value}</span>
                          <span className={r.gap < 0 ? "text-danger" : "text-success"}>
                            {r.gap > 0 ? "+" : ""}{r.gap}% gap
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.min(100, (r.avgPrice / techStats.specInsights.ram[0].avgPrice) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <p className="text-[10px] font-black uppercase text-muted-foreground mb-3 tracking-widest opacity-60">Storage Tier Efficiency</p>
                  <div className="space-y-3">
                    {techStats.specInsights?.storage?.map((s: any) => (
                      <div key={s.value} className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span>{s.value}</span>
                          <span className="text-muted-foreground">{formatCurrency(s.avgPrice, currency)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500"
                            style={{ width: `${Math.min(100, (s.avgPrice / techStats.specInsights.storage[0].avgPrice) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Competitor Landscape Section (NEW) */}
      {competitorStats && competitorStats.data?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-8 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Market Landscape: Competitor Pricing
              </h3>
              <p className="text-sm text-muted-foreground">
                Benchmark average price points across different store categories.
              </p>
            </div>
          </div>

          <div className="h-100 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={competitorStats.data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.5)" />
                <XAxis
                  dataKey="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 'bold' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                {competitorStats.competitors.slice(0, 5).map((comp: any, idx: number) => {
                  const colors = ["hsl(var(--primary))", "hsl(var(--indigo-500))", "hsl(var(--blue-500))", "hsl(var(--slate-500))", "hsl(var(--zinc-500))"];
                  return (
                    <Bar
                      key={comp.id}
                      dataKey={comp.name}
                      fill={colors[idx] || colors[0]}
                      radius={[4, 4, 0, 0]}
                      barSize={20}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-8 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4 opacity-70">Catalog Density by Rival</h4>
              <div className="space-y-4">
                {competitorStats.competitors.map((comp: any) => {
                  const totalItems = competitorStats.data.reduce((sum: number, row: any) => sum + (row[`${comp.name}_count`] || 0), 0);
                  return (
                    <div key={comp.id} className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span>{comp.name}</span>
                        <Badge variant="secondary" className="text-[9px] font-black">{totalItems} Products Tracked</Badge>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/40"
                          style={{ width: `${Math.min(100, (totalItems / 100) * 100)}%` }} // Scaling helper
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-primary/3 border border-primary/10 rounded-2xl p-6 flex flex-col justify-center">
              <ShieldCheck className="w-10 h-10 text-primary mb-4 opacity-40" />
              <h5 className="font-extrabold text-sm mb-2">Market Intelligence Note</h5>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This data is aggregated from your active crawlers. Categories are mapped automatically based on competitor site structures.
                <b> Average Price</b> is calculated based on current listing data and does not reflect promotional flash sales unless detected during the last sync.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Price Elasticity & Sensitivity Section (NEW) */}
      {elasticityData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Market Reactivity Meter */}
          <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Market Reactivity Index
                </h3>
                <p className="text-sm text-muted-foreground">
                  Measures how responsive your prices are to competitor moves.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-3 py-1">
                Sensitivity: {elasticityData.reactivityIndex > 70 ? 'High' : elasticityData.reactivityIndex > 30 ? 'Moderate' : 'Low'}
              </Badge>
            </div>

            <div className="flex flex-col items-center justify-center space-y-4 py-6">
              <div className="relative w-48 h-24 overflow-hidden">
                <div className="absolute inset-0 border-16 border-muted rounded-t-full" />
                <div
                  className="absolute inset-0 border-16 border-primary rounded-t-full origin-bottom transition-all duration-1000"
                  style={{ transform: `rotate(${(elasticityData.reactivityIndex / 100) * 180 - 180}deg)` }}
                />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-3xl font-black text-foreground">
                  {elasticityData.reactivityIndex}%
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground max-w-70">
                Your catalog has a <b>{elasticityData.sensitivityOverview.marketCorrelation}</b> correlation with market leaders.
                A higher index suggests proactive pricing strategies.
              </p>
            </div>
          </div>

          {/* Spec Premium Elasticity */}
          <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="w-5 h-5 text-primary" />
              <h3 className="text-xl font-bold">Base vs. Spec Elasticity</h3>
            </div>
            <div className="space-y-6">
              {elasticityData.specElasticity?.length > 0 ? (
                elasticityData.specElasticity.slice(0, 3).map((item: any) => (
                  <div key={item.model} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-muted-foreground">{item.model}</span>
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                        Premium Gap: {formatCurrency(item.variants[item.variants.length - 1].price - item.variants[0].price, currency)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {item.variants.map((v: any) => (
                        <div key={v.ram} className="flex-1 bg-muted/30 p-3 rounded-lg border border-border/50 text-center">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">{v.ram}</p>
                          <p className="text-sm font-black">{formatCurrency(v.price, currency)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-muted-foreground italic text-sm">
                  Insufficient variant data found for elasticity mapping.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
