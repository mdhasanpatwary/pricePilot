"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  BarChart3,
  Zap,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/v1/admin/stats");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Dashboard load failed");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const stats = [
    {
      label: "Active Tenants",
      value: data?.stats?.tenants || "0",
      change: "+100%",
      icon: Building2,
    },
    {
      label: "Platform MRR",
      value: data?.stats?.mrr || "$0",
      change: "+8.5%",
      icon: BarChart3,
    },
    {
      label: "Daily Scrapes",
      value: data?.stats?.scrapes || "0",
      change: "+24%",
      icon: Zap,
    },
    {
      label: "Global Health",
      value: data?.stats?.health || "100%",
      change: "Stable",
      icon: ShieldAlert,
    },
  ];

  const recentTenants = data?.recentTenants || [];

  if (loading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <p className="text-xs text-muted-foreground font-medium">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-10 font-sans">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          System Overview
        </h1>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
          <span className="text-sm text-muted-foreground font-medium">
            All systems operational
          </span>
        </div>
      </div>

      {/* Stats Rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {stat.label}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-foreground">
                {stat.value}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  stat.change.startsWith("+")
                    ? "text-emerald-600 dark:text-emerald-500"
                    : stat.change === "Stable"
                      ? "text-blue-600 dark:text-blue-500"
                      : "text-red-600 dark:text-red-500",
                )}
              >
                {stat.change}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Onboarding Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              Recent Tenants
            </h3>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/tenants">View All</a>
            </Button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-[40%]">
                    Organization
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {recentTenants.map((merchant: any, i: number) => (
                  <tr key={i} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-foreground">
                      <div className="font-medium">{merchant.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {merchant.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground border border-border">
                        {merchant.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-medium",
                          merchant.status === "ACTIVE"
                            ? "text-emerald-600 dark:text-emerald-500"
                            : "text-amber-600 dark:text-amber-500",
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            merchant.status === "ACTIVE"
                              ? "bg-emerald-500"
                              : "bg-amber-500",
                          )}
                        />
                        {merchant.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-muted-foreground hover:text-foreground">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {recentTenants.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No recent activity
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Events */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-foreground">
            System Events
          </h3>
          <Card className="p-4 space-y-6">
            {[
              {
                title: "Proxy Latency Spike (US-East)",
                type: "alert",
                time: "12m ago",
              },
              {
                title: "Tenant Upgrade: Acme Corp",
                type: "notice",
                time: "45m ago",
              },
              {
                title: "Automated Backup Success",
                type: "success",
                time: "2h ago",
              },
            ].map((event, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full mt-2 shrink-0",
                    event.type === "alert"
                      ? "bg-red-500"
                      : event.type === "notice"
                        ? "bg-blue-500"
                        : "bg-emerald-500",
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {event.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {event.time}
                  </p>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href="/admin/monitor">View Event Logs</a>
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
