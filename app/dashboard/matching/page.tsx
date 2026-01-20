"use client";

import { useState, useEffect } from "react";
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
  Users
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

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

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const res = await fetch("/api/matching");
      if (res.ok) {
        const data = await res.json();
        setMatches(data);
      }
    } catch (error) {
      toast.error("Failed to load matches");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (matchId: string, action: 'APPROVE' | 'REJECT') => {
    setProcessingId(matchId);
    try {
      const res = await fetch("/api/matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, action })
      });

      if (res.ok) {
        setMatches(prev => prev.filter(m => m.id !== matchId));
        toast.success(action === 'APPROVE' ? "Match confirmed" : "Match rejected");
      }
    } catch (error) {
      toast.error("Failed to process request");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest animate-pulse">Scanning Matches...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Match Approval</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review and confirm products identified by the automated matching engine.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-full border border-primary/10">
          <Target className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-black text-primary uppercase tracking-widest">
            {matches.length} Pending Review
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {matches.map((match) => (
          <div
            key={match.id}
            className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all shadow-sm flex flex-col lg:flex-row"
          >
            {/* User Product side */}
            <div className="flex-1 p-6 border-b lg:border-b-0 lg:border-r border-border bg-muted/5">
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-primary/10 rounded-md">
                        <Package className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Your Product</span>
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
                      src={`/api/proxy-image?url=${encodeURIComponent(match.product.image)}`}
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
                    <p className="text-lg font-black text-primary">{formatCurrency(match.product.price, 'USD')}</p>
                 </div>
              </div>
            </div>

            {/* Match Indicator */}
            <div className="flex flex-col items-center justify-center p-4 lg:p-0 lg:w-32 bg-muted/20 relative">
               <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border hidden lg:block -translate-x-1/2" />
               <div className="z-10 flex flex-col items-center gap-2">
                  <div className={cn(
                    "w-12 h-12 rounded-full border-4 border-card flex items-center justify-center font-black text-xs shadow-lg",
                    match.confidence > 80 ? "bg-emerald-500 text-white" : "bg-orange-500 text-white"
                  )}>
                    {Math.round(match.confidence)}%
                  </div>
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Confidence</span>
               </div>
            </div>

            {/* Competitor Product side */}
            <div className="flex-1 p-6 bg-muted/5 overflow-hidden">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-orange-100 dark:bg-orange-900/20 rounded-md">
                        <Zap className="w-3.5 h-3.5 text-orange-600" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Matched on {match.competitor.siteName}</span>
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
                      src={`/api/proxy-image?url=${encodeURIComponent(match.competitor.image)}`}
                      alt={match.competitor.title}
                      fill
                      className="object-contain mix-blend-multiply"
                      unoptimized
                    />
                  ) : (
                    <Users className="w-6 h-6 text-muted-foreground opacity-20" />
                  )}
                </div>
                  <h3 className="font-bold text-sm leading-snug line-clamp-2 min-h-[40px] text-foreground/80 flex-1">{match.competitor.title}</h3>
               </div>
               <div className="mt-4 flex items-center justify-end">
                 <div className="text-right">
                    <p className="text-lg font-black text-foreground/80">{formatCurrency(match.competitor.price, 'USD')}</p>
                 </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-card border-t lg:border-t-0 lg:border-l border-border p-6 flex lg:flex-col gap-3 justify-center">
               <button
                 onClick={() => handleAction(match.id, 'APPROVE')}
                 disabled={!!processingId}
                 className="flex-1 lg:flex-initial flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-lg transition-all active:scale-95 disabled:opacity-50"
               >
                 {processingId === match.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                 <span className="text-xs uppercase tracking-widest font-black">Approve</span>
               </button>
               <button
                 onClick={() => handleAction(match.id, 'REJECT')}
                 disabled={!!processingId}
                 className="flex-1 lg:flex-initial flex items-center justify-center gap-2 bg-secondary hover:bg-destructive hover:text-destructive-foreground text-foreground font-bold py-2 px-6 rounded-lg transition-all active:scale-95 border border-border disabled:opacity-50"
               >
                 {processingId === match.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                 <span className="text-xs uppercase tracking-widest font-black">Reject</span>
               </button>
            </div>
          </div>
        ))}

        {matches.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl bg-muted/10">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <h3 className="text-xl font-bold">All caught up!</h3>
            <p className="text-muted-foreground text-sm max-w-xs text-center mt-2 font-medium">
              No pending matches require your review at this time. Our engine is working in the background.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
