"use client";

import { useState, useEffect } from "react";
import {
  Search,
  MoreVertical,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function TenantsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const res = await fetch("/api/admin/tenants");
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      }
    } catch (err) {
      console.error("Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  const updateLimit = async (id: string, field: string, value: string) => {
    setUpdatingId(`${id}-${field}`);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: value }),
      });
      if (res.ok) {
        setTenants(prev => prev.map(t => t.id === id ? { ...t, [field]: parseInt(value) } : t));
      }
    } catch (err) {
      console.error("Failed to update limit");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredTenants = tenants.filter(t => {
    if (activeTab === "all") return true;
    return t.plan.toLowerCase() === activeTab;
  });

  if (loading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
         <div className="flex flex-col items-center gap-2">
           <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
           <p className="text-xs text-muted-foreground font-medium">Loading...</p>
         </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-20 font-sans">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Tenants</h1>
        <p className="text-sm text-muted-foreground">Manage organizations and resource allocation.</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Simple Tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-md">
          {["all", "pro", "basic"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-medium capitalize transition-all",
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
           <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
           <input
             type="text"
             placeholder="Search tenants..."
             className="w-full bg-background border border-input rounded-md py-1.5 pl-9 pr-3 text-sm focus:border-ring focus:ring-0 outline-none transition-all placeholder:text-muted-foreground"
           />
        </div>
      </div>

      {/* Clean Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground w-[250px]">Organization</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Resource Limits</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Usage</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Plan</th>
                <th className="px-6 py-3 text-right font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="group hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{tenant.name}</span>
                      <span className="text-xs text-muted-foreground">{tenant.email}</span>
                    </div>
                  </td>

                  {/* Limits */}
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase text-muted-foreground font-medium">Stores</label>
                          <div className="relative">
                            <input
                              type="number"
                              defaultValue={tenant.storeLimit}
                              onBlur={(e) => updateLimit(tenant.id, "storeLimit", e.target.value)}
                              className="w-16 bg-muted border border-input rounded px-2 py-1 text-xs text-center focus:border-ring outline-none transition-all"
                            />
                            {updatingId === `${tenant.id}-storeLimit` && <div className="absolute right-1 top-1.5 w-2 h-2 rounded-full border border-primary border-t-transparent animate-spin"/>}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase text-muted-foreground font-medium">Comp</label>
                          <div className="relative">
                            <input
                              type="number"
                              defaultValue={tenant.competitorLimit}
                              onBlur={(e) => updateLimit(tenant.id, "competitorLimit", e.target.value)}
                              className="w-16 bg-muted border border-input rounded px-2 py-1 text-xs text-center focus:border-ring outline-none transition-all"
                            />
                            {updatingId === `${tenant.id}-competitorLimit` && <div className="absolute right-1 top-1.5 w-2 h-2 rounded-full border border-primary border-t-transparent animate-spin"/>}
                          </div>
                        </div>
                     </div>
                  </td>

                  <td className="px-6 py-4">
                     <div className="flex flex-col gap-2 w-32">
                        <div className="flex items-center justify-between text-xs">
                           <span className="text-muted-foreground">Stores</span>
                           <span className="text-foreground">{tenant.activeStores}/{tenant.storeLimit}</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                           <div className="h-full bg-primary/70 rounded-full" style={{ width: `${(tenant.activeStores / tenant.storeLimit) * 100}%` }} />
                        </div>
                     </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground border border-border uppercase tracking-wide">
                      {tenant.plan}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 text-muted-foreground">
                       <button className="p-1 hover:text-foreground transition-colors">
                          <ExternalLink className="w-4 h-4" />
                       </button>
                       <button className="p-1 hover:text-foreground transition-colors">
                          <MoreVertical className="w-4 h-4" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTenants.length === 0 && (
                <tr>
                   <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-sm">No tenants found under this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/30">
           <span className="text-xs text-muted-foreground">
             Showing {filteredTenants.length} results
           </span>
           <div className="flex items-center gap-2">
              <button disabled className="p-1 border border-input rounded bg-background text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed">
                 <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled className="p-1 border border-input rounded bg-background text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed">
                 <ChevronRight className="w-4 h-4" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
