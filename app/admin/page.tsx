"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Building2,
  BarChart3,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  MoreVertical,
  ExternalLink,
  ShieldAlert,
  Server
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
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
    { label: "Active Tenants", value: data?.stats?.tenants || "0", change: "+100%", icon: Building2 },
    { label: "Platform MRR", value: data?.stats?.mrr || "$0", change: "+8.5%", icon: BarChart3 },
    { label: "Daily Scrapes", value: data?.stats?.scrapes || "0", change: "+24%", icon: Zap },
    { label: "Global Health", value: data?.stats?.health || "100%", change: "Stable", icon: ShieldAlert },
  ];

  const recentTenants = data?.recentTenants || [];

  if (loading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
         <div className="flex flex-col items-center gap-2">
           <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent dark:border-zinc-100"></div>
           <p className="text-xs text-zinc-500 font-medium">Loading...</p>
         </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-10 font-sans">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">System Overview</h1>
        <div className="flex items-center gap-2">
           <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
           <span className="text-sm text-zinc-500 font-medium">All systems operational</span>
        </div>
      </div>

      {/* Stats Rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="p-5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{stat.value}</span>
              <span className={cn(
                "text-xs font-medium",
                stat.change.startsWith("+") ? "text-emerald-600 dark:text-emerald-500" :
                stat.change === "Stable" ? "text-blue-600 dark:text-blue-500" : "text-red-600 dark:text-red-500"
              )}>
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Onboarding Table */}
        <div className="lg:col-span-2 space-y-4">
           <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Recent Tenants</h3>
              <button className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 font-medium">View All</button>
           </div>

           <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
             <table className="w-full text-sm">
               <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                 <tr>
                    <th className="px-4 py-3 text-left font-medium text-zinc-500 w-[40%]">Organization</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-500">Plan</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-500">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-zinc-500">Action</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
                 {recentTenants.map((merchant: any, i: number) => (
                   <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                     <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                        <div className="font-medium">{merchant.name}</div>
                        <div className="text-xs text-zinc-500">{merchant.email}</div>
                     </td>
                     <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                          {merchant.plan}
                        </span>
                     </td>
                     <td className="px-4 py-3">
                        <span className={cn(
                          "flex items-center gap-1.5 text-xs font-medium",
                          merchant.status === "ACTIVE" ? "text-emerald-600 dark:text-emerald-500" : "text-amber-600 dark:text-amber-500"
                        )}>
                           <span className={cn("w-1.5 h-1.5 rounded-full", merchant.status === "ACTIVE" ? "bg-emerald-500" : "bg-amber-500")} />
                           {merchant.status}
                        </span>
                     </td>
                     <td className="px-4 py-3 text-right">
                        <button className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                           <ExternalLink className="w-4 h-4" />
                        </button>
                     </td>
                   </tr>
                 ))}
                 {recentTenants.length === 0 && (
                   <tr>
                     <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
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
           <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">System Events</h3>
           <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-6">
              {[
                { title: "Proxy Latency Spike (US-East)", type: "alert", time: "12m ago" },
                { title: "Tenant Upgrade: Acme Corp", type: "notice", time: "45m ago" },
                { title: "Automated Backup Success", type: "success", time: "2h ago" },
              ].map((event, i) => (
                <div key={i} className="flex gap-3">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full mt-2 shrink-0",
                    event.type === "alert" ? "bg-red-500" : event.type === "notice" ? "bg-blue-500" : "bg-emerald-500"
                  )} />
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{event.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{event.time}</p>
                  </div>
                </div>
              ))}

              <button className="w-full py-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                 View Event Logs
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
