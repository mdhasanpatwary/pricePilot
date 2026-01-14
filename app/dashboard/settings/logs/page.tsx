"use client";

import { useState } from "react";
import {
  History,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";

const mockLogs = [
  { id: "1", product: "Nike Air Max 270", sku: "NIKE-AM-270", oldPrice: 150.00, newPrice: 139.50, logic: "Fixed Undercut", status: "SUCCESS", date: "Jan 14, 10:20 AM" },
  { id: "2", product: "Adidas Ultraboost 22", sku: "ADIDAS-UB-22", oldPrice: 180.00, newPrice: 175.00, logic: "Percentage (2%)", status: "SUCCESS", date: "Jan 14, 09:45 AM" },
  { id: "3", product: "Puma RS-X", sku: "PUMA-RS-X", oldPrice: 110.00, newPrice: 105.00, logic: "Fixed Undercut", status: "FAILED", error: "API Timeout", date: "Jan 14, 08:30 AM" },
];

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Logs</h2>
          <p className="text-muted-foreground text-sm">Track every price change and its execution status.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border border-border rounded-md text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
           <History className="w-3.5 h-3.5" />
           Last 30 Days
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by SKU or Product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background border border-border rounded-md py-2 pl-10 pr-4 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm font-medium"
          />
        </div>
        <button className="p-2.5 bg-background border border-border rounded-md text-muted-foreground hover:text-foreground transition-all">
          <Filter className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <th className="py-4 px-6">Product / SKU</th>
                <th className="py-4 px-6">Pricing Logic</th>
                <th className="py-4 px-6 text-center">Change</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6 text-right">Executed</th>
                <th className="py-4 px-6 text-right w-12" />
              </tr>
            </thead>
            <tbody className="text-sm font-medium divide-y divide-border/50">
              {mockLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="py-5 px-6">
                    <div>
                      <div className="text-foreground font-semibold">{log.product}</div>
                      <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-tight mt-0.5">{log.sku}</div>
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <span className="text-xs text-muted-foreground">{log.logic}</span>
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex items-center justify-center gap-2 font-semibold">
                      <span className="text-muted-foreground line-through opacity-50">${log.oldPrice.toFixed(2)}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground/30" />
                      <span className="text-foreground">${log.newPrice.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="py-5 px-6 text-center">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                      log.status === "SUCCESS" ? "bg-success/5 text-success border-success/10" : "bg-danger/5 text-danger border-danger/10"
                    )}>
                      {log.status === "SUCCESS" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {log.status === "SUCCESS" ? "Success" : "Failed"}
                    </div>
                    {log.error && <p className="text-[10px] text-danger/70 mt-1 font-bold">{log.error}</p>}
                  </td>
                  <td className="py-5 px-6 text-right text-muted-foreground text-[11px] font-semibold">
                    {log.date}
                  </td>
                  <td className="py-5 px-6 text-right">
                    <button className="p-2 hover:bg-muted rounded-md text-muted-foreground transition-all">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
