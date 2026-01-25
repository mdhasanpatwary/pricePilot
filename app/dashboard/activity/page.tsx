"use client";

import { useState, useEffect } from "react";
import {
  User,
  Search,
  Filter,
  FileText,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ActionStatus } from "@/components/ui/status-indicator";

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  entityId: string;
  details: string;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/v1/audit-logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Failed to load logs", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(
    (log) =>
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false),
  );

  const getActionBadge = (action: string) => {
    return <ActionStatus action={action} size="sm" />;
  };

  const renderDetails = (log: AuditLog) => {
    if (!log.details)
      return (
        <span className="text-muted-foreground italic text-[10px]">
          No details available
        </span>
      );

    try {
      const details = JSON.parse(log.details);
      const action = log.action;

      if (action.includes("MATCH")) {
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-foreground">
              {action === "APPROVE_MATCH"
                ? "Confirmed match for:"
                : "Rejected match for:"}
            </span>
            {details.productTitle ? (
              <div className="flex flex-col gap-0.5 max-w-50">
                <span className="text-[10px] text-primary font-medium line-clamp-1">
                  {details.productTitle}
                </span>
                {details.competitorTitle && (
                  <span className="text-[9px] text-muted-foreground line-clamp-1 border-l-2 border-border pl-1.5 ml-1">
                    matched with {details.competitorTitle}
                  </span>
                )}
              </div>
            ) : (
              <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono text-muted-foreground truncate w-fit max-w-45">
                {details.matchId || log.entityId}
              </code>
            )}
          </div>
        );
      }

      if (action.includes("PRICING_RULE")) {
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-foreground">
                {details.name || "Rule Update"}
              </span>
              {details.strategy && (
                <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md font-black uppercase">
                  {details.strategy}
                </span>
              )}
            </div>
            {details.parameter !== undefined && (
              <span className="text-[10px] text-muted-foreground">
                Value:{" "}
                <span className="font-mono font-bold text-foreground">
                  {details.parameter}
                </span>
              </span>
            )}
          </div>
        );
      }

      if (action === "BULK_PRICE_UPDATE") {
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-foreground">
              Updated {details.productCount} products
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-muted-foreground font-medium lowercase">
                logic: {details.logicType}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-muted-foreground font-medium">
                val: {details.value}
              </span>
            </div>
          </div>
        );
      }

      if (action.includes("INTEGRATION") || action.includes("COMPETITOR")) {
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-foreground truncate max-w-50">
              {details.url || details.baseUrl || "System Connection"}
            </span>
            {details.platform && (
              <span className="text-[9px] w-fit px-1.5 py-0.5 bg-primary/5 text-primary rounded-md font-black uppercase tracking-tighter">
                {details.platform}
              </span>
            )}
          </div>
        );
      }

      if (action.includes("EXPORT") || action.includes("IMPORT")) {
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-foreground">
              {action.includes("EXPORT")
                ? "Generated CSV"
                : "Processed CSV Upload"}
            </span>
            <span className="text-[10px] text-muted-foreground leading-none">
              {details.count !== undefined
                ? `${details.count} products exported`
                : ""}
              {details.created !== undefined
                ? `${details.created} created, ${details.updated} updated`
                : ""}
            </span>
          </div>
        );
      }

      // Fallback for known ID-based entities
      if (details.id || details.targetTenantId) {
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-foreground uppercase tracking-tighter">
              Reference ID
            </span>
            <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono text-muted-foreground truncate w-fit max-w-37.5">
              {details.targetTenantId || details.id || log.entityId}
            </code>
          </div>
        );
      }

      return (
        <pre className="text-[10px] text-muted-foreground truncate max-w-50">
          {log.details}
        </pre>
      );
    } catch (e) {
      return (
        <span className="text-[10px] text-muted-foreground truncate max-w-50">
          {log.details}
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>

        <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border">
          <Skeleton className="h-10 flex-1 max-w-sm" />
          <Skeleton className="h-10 w-24" />
        </div>

        <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
          <div className="p-0">
            <div className="bg-muted/50 border-b border-border px-6 py-4 grid grid-cols-4 gap-4">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-12 justify-self-end" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="px-6 py-6 border-b border-border/50 grid grid-cols-4 gap-4 items-center"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-2 w-32" />
                  </div>
                </div>
                <Skeleton className="h-5 w-24 rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2 w-16" />
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-2 w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Organization Activity Dashboard
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Monitor team actions, rule adjustments, and system events in
            real-time.
          </p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          className="p-2 hover:bg-muted border border-border rounded-lg transition-colors group"
          title="Refresh logs"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground group-active:rotate-180 transition-transform" />
        </button>
      </div>

      <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by user, action..."
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-bold bg-background hover:bg-muted transition-all">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-6 py-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  User
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Action
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Operation Details
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold lowercase">
                          {log.userEmail.split("@")[0]}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {log.userEmail}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getActionBadge(log.action)}</td>
                  <td className="px-6 py-4">{renderDetails(log)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-[11px] font-bold uppercase tracking-tight">
                        {format(new Date(log.createdAt), "MMM dd, yyyy")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(log.createdAt), "HH:mm:ss")}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center grayscale opacity-30">
                      <FileText className="w-12 h-12 mb-4" />
                      <p className="text-sm font-bold uppercase tracking-widest">
                        No history recorded yet
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
