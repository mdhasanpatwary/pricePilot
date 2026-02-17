"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Check,
  X,
  Target,
  Zap,
  Package,
  Users,
  Search,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { useDebounce } from "@/lib/hooks/useSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Match {
  id: string;
  confidence: number;
  matchType: string;
  product: {
    id: string;
    title: string;
    sku: string;
    price: number;
    url: string;
    image?: string;
    site: string;
  };
  competitor: {
    id: string;
    title: string;
    sku: string;
    price: number;
    url: string;
    image?: string;
    site: string;
    siteName: string;
  };
}

export default function MatchApprovalPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProcessingCount, setBulkProcessingCount] = useState(0);
  const [searchQuery, debouncedQuery, setSearchQuery] = useDebounce("", 300);
  const [selectedSite, setSelectedSite] = useState<string>("ALL");

  const fetchMatches = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.append("q", debouncedQuery);

      const res = await fetch(`/api/v1/matching?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMatches(data);
      }
    } catch (error) {
      toast.error("Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const handleAction = async (
    matchId: string,
    action: "APPROVE" | "REJECT",
  ) => {
    setProcessingId(matchId);
    try {
      const res = await fetch("/api/v1/matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, action }),
      });

      if (res.ok) {
        setMatches((prev) => prev.filter((m) => m.id !== matchId));
        toast.success(
          action === "APPROVE" ? "Match confirmed" : "Match rejected",
        );
      }
    } catch (error) {
      toast.error("Failed to process request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkAction = async (action: "APPROVE" | "REJECT") => {
    const matchIds = filteredMatches.map((m) => m.id);
    if (matchIds.length === 0) return;

    const label =
      selectedSite === "ALL"
        ? `${matchIds.length} matches`
        : `${matchIds.length} matches on ${selectedSite}`;

    if (
      !confirm(
        action === "APPROVE"
          ? `Approve ${label}?`
          : `Reject ${label}?`,
      )
    ) {
      return;
    }

    setBulkProcessing(true);
    setBulkProcessingCount(matchIds.length);

    try {
      const res = await fetch("/api/v1/matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchIds, action }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Bulk action failed");
        return;
      }

      const removed = new Set(matchIds);
      setMatches((prev) => prev.filter((m) => !removed.has(m.id)));
      toast.success(
        action === "APPROVE"
          ? `Approved ${matchIds.length} match(es)`
          : `Rejected ${matchIds.length} match(es)`,
      );
    } catch (error) {
      toast.error("Network error");
    } finally {
      setBulkProcessing(false);
      setBulkProcessingCount(0);
    }
  };

  // Get unique sites for filter tabs
  const sites = Array.from(new Set(matches.map(m => m.competitor.siteName))).sort();

  // Filter matches based on search query and selected site
  const filteredMatches = matches.filter(m => {
      const matchesSite = selectedSite === "ALL" || m.competitor.siteName === selectedSite;
      return matchesSite;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest animate-pulse">
          Scanning Matches...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Match Approval</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review and confirm products identified by the automated matching
            engine.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-full border border-primary/10">
          <Target className="w-3.5 h-3.5 text-primary" />
          <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
            {filteredMatches.length}{" "}
            {debouncedQuery ? "Found" : "Pending Review"}
          </Badge>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search products, SKUs, or competitors..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchQuery("")}
            className="absolute right-0 top-0 h-full w-10 hover:bg-transparent"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Competitor Filter Tabs */}
      {sites.length > 0 && (
          <div className="flex items-center gap-1.5 p-1 bg-muted/40 border border-border rounded-xl overflow-x-auto no-scrollbar">
              <button
                  onClick={() => setSelectedSite("ALL")}
                  className={cn(
                      "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                      selectedSite === "ALL"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                  )}
              >
                  All Targets
              </button>
              {sites.map(site => (
                  <button
                      key={site}
                      onClick={() => setSelectedSite(site)}
                      className={cn(
                          "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2",
                          selectedSite === site
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                      )}
                  >
                      {site}
                      <Badge variant="outline" className="px-1.5 py-0 h-4 min-w-[1.25rem] flex items-center justify-center text-[10px] bg-muted/50 border-transparent">
                          {matches.filter(m => m.competitor.siteName === site).length}
                      </Badge>
                  </button>
              ))}
          </div>
      )}

      {/* Bulk Actions */}
      {filteredMatches.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border border-border rounded-xl bg-muted/10">
          <div className="text-sm text-muted-foreground">
            Bulk actions apply to{" "}
            <span className="font-bold text-foreground">
              {selectedSite === "ALL" ? "all visible matches" : selectedSite}
            </span>
            .
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              onClick={() => handleBulkAction("APPROVE")}
              disabled={bulkProcessing || !!processingId}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {bulkProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {bulkProcessing ? `Approving ${bulkProcessingCount}...` : "Approve All"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleBulkAction("REJECT")}
              disabled={bulkProcessing || !!processingId}
              className="hover:bg-destructive hover:text-destructive-foreground border-border"
            >
              {bulkProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <X className="w-4 h-4 mr-2" />
              )}
              Reject All
            </Button>
          </div>
        </div>
      )}

      {filteredMatches.length === 0 && debouncedQuery && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">
            No matches found for &ldquo;{debouncedQuery}&rdquo;
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Try a different search term
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {filteredMatches.map((match) => (
          <Card
            key={match.id}
            className="group overflow-hidden hover:border-primary/40 transition-all flex flex-col lg:flex-row shadow-sm"
          >
            {/* User Product side */}
            <div className="flex-1 p-6 border-b lg:border-b-0 lg:border-r border-border bg-muted/5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-md">
                    <Package className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Your Product
                  </span>
                  {match.product.url && (
                    <a
                      href={match.product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted/30 flex-shrink-0 flex items-center justify-center relative">
                  {match.product.image ? (
                    <Image
                      src={`/api/v1/proxy-image?url=${encodeURIComponent(match.product.image)}`}
                      alt={match.product.title}
                      fill
                      className="object-contain mix-blend-multiply"
                      unoptimized
                    />
                  ) : (
                    <Package className="w-6 h-6 text-muted-foreground opacity-20" />
                  )}
                </div>
                <h3 className="font-bold text-sm leading-snug line-clamp-2 flex-1">
                  {match.product.title}
                </h3>
              </div>
              <div className="mt-4 flex items-center justify-end">
                <div className="text-right">
                  <p className="text-lg font-black text-primary">
                    {match.product.price > 0 ? (
                      formatCurrency(match.product.price, "USD")
                    ) : (
                      <span className="text-muted-foreground text-sm font-normal italic">
                        N/A
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Match Indicator */}
            <div className="flex flex-col items-center justify-center p-4 lg:p-0 lg:w-32 bg-muted/20 relative">
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border hidden lg:block -translate-x-1/2" />
              <div className="z-10 flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full border-4 border-card flex items-center justify-center font-black text-xs shadow-lg",
                    match.confidence > 80
                      ? "bg-emerald-500 text-white"
                      : "bg-orange-500 text-white",
                  )}
                >
                  {Math.round(match.confidence)}%
                </div>
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">
                  Confidence
                </span>
              </div>
            </div>

            {/* Competitor Product side */}
            <div className="flex-1 p-6 bg-muted/5 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-orange-100 dark:bg-orange-900/20 rounded-md">
                    <Zap className="w-3.5 h-3.5 text-orange-600" />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Matched on {match.competitor.siteName}
                  </span>
                </div>
                <a
                  href={match.competitor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted/30 flex-shrink-0 flex items-center justify-center relative">
                  {match.competitor.image ? (
                    <Image
                      src={`/api/v1/proxy-image?url=${encodeURIComponent(match.competitor.image)}`}
                      alt={match.competitor.title}
                      fill
                      className="object-contain mix-blend-multiply"
                      unoptimized
                    />
                  ) : (
                    <Users className="w-6 h-6 text-muted-foreground opacity-20" />
                  )}
                </div>
                <h3 className="font-bold text-sm leading-snug line-clamp-2 min-h-[40px] text-foreground/80 flex-1">
                  {match.competitor.title}
                </h3>
              </div>
              <div className="mt-4 flex items-center justify-end">
                <div className="text-right">
                  <p className="text-lg font-black text-foreground/80">
                    {match.competitor.price > 0 ? (
                      formatCurrency(match.competitor.price, "USD")
                    ) : (
                      <span className="text-muted-foreground text-sm font-normal italic">
                        N/A
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-card border-t lg:border-t-0 lg:border-l border-border p-6 flex lg:flex-col gap-3 justify-center">
              <Button
                onClick={() => handleAction(match.id, "APPROVE")}
                disabled={!!processingId}
                className="flex-1 lg:flex-initial bg-emerald-600 hover:bg-emerald-700"
              >
                {processingId === match.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAction(match.id, "REJECT")}
                disabled={!!processingId}
                className="flex-1 lg:flex-initial hover:bg-destructive hover:text-destructive-foreground border-border"
              >
                {processingId === match.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <X className="w-4 h-4 mr-2" />
                )}
                Reject
              </Button>
            </div>
          </Card>
        ))}

        {matches.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl bg-muted/10">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-success" />
              </div>
            <h3 className="text-xl font-bold">All caught up!</h3>
            <p className="text-muted-foreground text-sm max-w-xs text-center mt-2 font-medium">
              No pending matches require your review at this time. Our engine is
              working in the background.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
