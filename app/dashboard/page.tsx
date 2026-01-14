"use client";

import { useState, useEffect } from "react";
import {
  TrendingDown,
  Package,
  ShoppingBag,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import { toast } from "sonner";

export default function DashboardOverview() {
  const [stats, setStats] = useState({
    totalSKUs: "0",
    activeRivals: "0",
    criticalAlerts: "0",
    marketEdge: "$0.00",
  });
  const [positionSummary, setPositionSummary] = useState({
    cheapest: 0,
    nearCheapest: 0,
    neutral: 0,
    expensive: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/analytics/summary");
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalSKUs: data.stats.totalSKUs.toString(),
          activeRivals: data.stats.activeRivals.toString(),
          criticalAlerts: data.stats.criticalAlerts.toString(),
          marketEdge: data.stats.marketEdge,
        });
        setPositionSummary(data.positionSummary);
      } else {
        toast.error("Failed to load analytics");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setIsLoading(false);
    }
  };

  const statsConfig = [
    { label: "Total SKUs Live", value: stats.totalSKUs, icon: Package, change: "+12%", trend: "up" },
    { label: "Active Rivals", value: stats.activeRivals, icon: ShoppingBag, change: "Stable", trend: "neutral" },
    { label: "Critical Alerts", value: stats.criticalAlerts, icon: TrendingDown, change: "-14%", trend: "down" },
    { label: "Market Edge", value: stats.marketEdge, icon: Activity, change: "+2%", trend: "up" },
  ];

  const positionData = [
    { label: "Cheapest", value: positionSummary.cheapest, color: "bg-success" },
    { label: "Near Cheapest", value: positionSummary.nearCheapest, color: "bg-primary" },
    { label: "Neutral", value: positionSummary.neutral, color: "bg-muted-foreground/30" },
    { label: "Expensive", value: positionSummary.expensive, color: "bg-danger" },
  ];

  const total = positionSummary.cheapest + positionSummary.nearCheapest + positionSummary.neutral + positionSummary.expensive || 1;

  const chartData = [
    { name: "01 Jan", index: 102, rivals: 105 },
    { name: "04 Jan", index: 98, rivals: 103 },
    { name: "08 Jan", index: 95, rivals: 101 },
    { name: "12 Jan", index: 99, rivals: 98 },
    { name: "16 Jan", index: 104, rivals: 97 },
    { name: "20 Jan", index: 101, rivals: 100 },
    { name: "24 Jan", index: 93, rivals: 99 },
  ];
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
          <p className="text-muted-foreground text-sm">Monitor your market position and pricing performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-md hover:opacity-90 transition-all">
            Run Sync
          </button>
          <button className="bg-secondary text-secondary-foreground text-sm font-semibold px-4 py-2 rounded-md hover:bg-secondary/80 transition-all border border-border">
            Export Report
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsConfig.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-muted/50 rounded-md">
                <stat.icon className="w-4 h-4 text-foreground/70" />
              </div>
              <div className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                stat.trend === "up" ? "bg-success/5 text-success border-success/10" :
                stat.trend === "down" ? "bg-danger/5 text-danger border-danger/10" :
                "bg-muted text-muted-foreground border-border"
              )}>
                {stat.change}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <h3 className="text-2xl font-bold">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Position Summary */}
        <div className="lg:col-span-1 bg-card border border-border rounded-lg p-6">
          <div className="mb-6">
            <h4 className="text-sm font-semibold">Position Summary</h4>
            <p className="text-xs text-muted-foreground">Your market stance vs. competition</p>
          </div>
          <div className="space-y-5">
            {[
              { label: "Cheapest", value: 42, color: "bg-success" },
              { label: "Near Cheapest", value: 28, color: "bg-primary" },
              { label: "Neutral", value: 15, color: "bg-muted-foreground/30" },
              { label: "Expensive", value: 15, color: "bg-danger" },
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span>{item.value}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full">
                  <div
                    className={cn("h-full rounded-full", item.color)}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t border-border flex justify-between">
            <div>
              <p className="text-lg font-bold text-primary">100%</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Coverage</p>
            </div>
            <div>
              <p className="text-lg font-bold">8.4k</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Calculations</p>
            </div>
          </div>
        </div>

        {/* Price Trend Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-sm font-semibold">Price Index Trend</h4>
              <p className="text-xs text-muted-foreground">30-day market movement</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[10px] font-medium text-muted-foreground">You</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                <span className="text-[10px] font-medium text-muted-foreground">Rivals</span>
              </div>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  dy={10}
                />
                <YAxis hide={true} domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="index"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="hsl(var(--primary)/0.05)"
                />
                <Area
                  type="monotone"
                  dataKey="rivals"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Execution Queue */}
        <div className="lg:col-span-3 bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-semibold">Recent Activity</h4>
            <button className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="pb-3 pr-4">Product</th>
                  <th className="pb-3 px-4">Action</th>
                  <th className="pb-3 px-4">Value</th>
                  <th className="pb-3 pl-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {[
                  { name: "Nike Air Max 270", sku: "NIKE-AM-270", action: "Price Drop", value: "-$12.50", time: "4m" },
                  { name: "Adidas Ultraboost 22", sku: "AD-UB-22", action: "Undercut", value: "-$4.00", time: "18m" },
                  { name: "Puma RS-X", sku: "PU-RSX-99", action: "Outbid", value: "-$1.20", time: "32m" },
                  { name: "Jordan Retro Black", sku: "JD-RT-11", action: "Price Drop", value: "-$42.00", time: "1h" },
                ].map((item, i) => (
                  <tr key={i} className="border-b border-border/50 group hover:bg-muted/30 transition-colors">
                    <td className="py-4 pr-4">
                      <div>
                        <div className="text-foreground">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{item.sku}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-muted-foreground text-xs">{item.action}</td>
                    <td className="py-4 px-4">
                      <span className="text-danger bg-danger/5 px-2 py-0.5 rounded-md text-xs">{item.value}</span>
                    </td>
                    <td className="py-4 pl-4 text-right text-muted-foreground text-xs">{item.time} ago</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
