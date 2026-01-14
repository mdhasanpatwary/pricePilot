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
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-gray-400 mt-2">Track every price change and its execution status.</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold text-gray-500 uppercase tracking-widest bg-white/5 border border-white/10 rounded-xl px-4 py-2">
           <History className="w-3 h-3" />
           Last 30 Days
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search by SKU or Product name..."
            className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-2.5 pl-11 pr-4 outline-none focus:border-primary/50 transition-all text-sm"
          />
        </div>
        <button className="p-2.5 hover:bg-white/5 rounded-xl text-gray-400 transition-all border border-transparent hover:border-white/5">
          <Filter className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                <th className="py-5 px-8 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Product & SKU</th>
                <th className="py-5 px-8 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Pricing Logic</th>
                <th className="py-5 px-8 text-center text-xs font-bold text-gray-500 uppercase tracking-widest">Change</th>
                <th className="py-5 px-8 text-center text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                <th className="py-5 px-8 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Executed</th>
                <th className="py-5 px-8 text-right w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {mockLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="py-6 px-8">
                    <div className="space-y-1">
                      <div className="font-bold text-white transition-colors">{log.product}</div>
                      <div className="text-[10px] text-gray-500 font-mono tracking-tighter uppercase">{log.sku}</div>
                    </div>
                  </td>
                  <td className="py-6 px-8">
                    <span className="text-xs font-medium text-gray-400">{log.logic}</span>
                  </td>
                  <td className="py-6 px-8">
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-gray-500 line-through">${log.oldPrice.toFixed(2)}</span>
                      <ArrowRight className="w-3 h-3 text-gray-700" />
                      <span className="font-bold text-white">${log.newPrice.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="py-6 px-8 text-center">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider",
                      log.status === "SUCCESS" ? "bg-success/5 text-success border border-success/10" : "bg-danger/5 text-danger border border-danger/10"
                    )}>
                      {log.status === "SUCCESS" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {log.status}
                    </div>
                    {log.error && <p className="text-[10px] text-danger/60 mt-1">{log.error}</p>}
                  </td>
                  <td className="py-6 px-8 text-right text-gray-500 font-medium">
                    {log.date}
                  </td>
                  <td className="py-6 px-8 text-right">
                    <button className="p-2 hover:bg-white/5 rounded-lg text-gray-600 hover:text-white transition-all group/btn">
                      <RotateCcw className="w-4 h-4 group-hover/btn:rotate-[-45deg] transition-transform" />
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
