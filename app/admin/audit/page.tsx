"use client";

import { useState } from "react";
import {
  Search,
  ArrowRight,
  GitMerge,
  Server,
  Loader2,
  TrendingUp,
  Link as LinkIcon,
  Activity,
} from "lucide-react";

export default function AuditSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(
        `/api/v1/admin/audit-search?query=${encodeURIComponent(query)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-2">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Entity Audit</h1>
        <p className="text-muted-foreground">
          Detailed product lifecycle tracking across price updates, syncs, and
          matches.
        </p>
      </div>

      {/* Modern Search Bar */}
      <div className="w-full">
        <form onSubmit={handleSearch} className="relative group">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search by SKU, ID, or Product Title..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-muted/40 border-0 ring-1 ring-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all outline-none"
          />
          <div className="absolute right-2 top-2">
            <button
              type="submit"
              disabled={loading || !query}
              className="px-4 py-1.5 bg-background border shadow-sm rounded-lg text-sm font-medium hover:bg-muted/50 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Search"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results Area */}
      <div className="space-y-8">
        {!loading && hasSearched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground border border-dashed rounded-xl bg-muted/20">
            <Search className="w-10 h-10 mb-4 opacity-20" />
            <p className="font-medium">No records found</p>
            <p className="text-sm opacity-60">
              Try checking the SKU or Product ID
            </p>
          </div>
        )}

        {results.map((item) => (
          <div
            key={item.product.id}
            className="border rounded-xl bg-card shadow-sm overflow-hidden"
          >
            {/* Header Section */}
            <div className="px-6 py-5 border-b bg-muted/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-foreground">
                    {item.product.title}
                  </h2>
                  {item.product.sku && (
                    <span className="text-[11px] font-mono px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md border">
                      {item.product.sku}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5" />
                    <span>{item.product.site}</span>
                  </div>
                  <span className="opacity-20">|</span>
                  <span>{item.product.tenant}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">
                    Current Price
                  </p>
                  <p className="text-2xl font-mono font-bold tracking-tight">
                    ৳{item.product.price}
                  </p>
                </div>
              </div>
            </div>

            {/* 3-Column Content Grid */}
            <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x">
              {/* Column 1: Price History */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-sm">Price History</h3>
                </div>

                <div className="relative border-l border-border/50 ml-2 space-y-6">
                  {item.logs.priceUpdates.length > 0 ? (
                    item.logs.priceUpdates.map((log: any) => (
                      <div key={log.id} className="relative pl-6">
                        <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background bg-zinc-300 dark:bg-zinc-700" />
                        <div className="flex items-center gap-2 text-sm font-mono mb-1">
                          <span className="text-muted-foreground line-through">
                            ৳{log.oldPrice}
                          </span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
                          <span className="font-semibold text-foreground">
                            ৳{log.newPrice}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>via {log.logicType} rule</span>
                          <span>
                            {new Date(log.executedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="pl-6 text-sm text-muted-foreground italic opacity-60">
                      No recent price changes.
                    </div>
                  )}
                </div>
              </div>

              {/* Column 2: Sync Activity */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-1.5 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-sm">Sync Activity</h3>
                  <span className="ml-auto text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Recent Logs
                  </span>
                </div>

                <div className="space-y-3">
                  {item.logs.syncLogs.length > 0 ? (
                    item.logs.syncLogs.map((log: any) => (
                      <div key={log.id} className="group">
                        <div className="flex items-start gap-2.5 text-sm">
                          <div
                            className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                              log.level === "ERROR"
                                ? "bg-red-500"
                                : log.level === "WARN"
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                            }`}
                          />
                          <div>
                            <p
                              className={`leading-snug ${
                                log.level === "ERROR"
                                  ? "text-red-600 dark:text-red-400 font-medium"
                                  : "text-zinc-600 dark:text-zinc-400"
                              }`}
                            >
                              {log.message}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 opacity-60">
                              {new Date(log.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground italic opacity-60">
                      No recent sync logs.
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Competitors */}
              <div className="p-6 bg-muted/5">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-1.5 rounded-md bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                    <GitMerge className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-sm">Connected Rivals</h3>
                </div>

                <div className="space-y-3">
                  {item.logs.matches.length > 0 ? (
                    item.logs.matches.map((match: any) => (
                      <a
                        key={match.id}
                        href={match.competitorProduct.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start justify-between p-3 rounded-lg border bg-background hover:border-primary/30 hover:shadow-sm transition-all group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <LinkIcon className="w-3 h-3 text-muted-foreground" />
                            <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                              {match.competitorProduct.title}
                            </p>
                          </div>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            {match.matchType}
                          </span>
                        </div>
                        <div className="text-right pl-3">
                          <span className="block font-mono font-bold text-sm">
                            ৳{match.competitorProduct.currentPrice}
                          </span>
                        </div>
                      </a>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground italic opacity-60">
                      No competitors matches found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
