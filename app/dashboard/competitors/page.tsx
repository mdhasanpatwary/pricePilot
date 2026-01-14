"use client";

import { useState } from "react";
import { Plus, Globe, Search, Trash2, ShieldAlert, Zap, ExternalLink, MoreVertical, Target, MousePointer2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CompetitorsPage() {
  const [isAdding, setIsAdding] = useState(false);
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const competitors = [
    { id: "1", name: "Competitor A", url: "https://competitor-a.com", products: 145, status: "ACTIVE", health: 98 },
    { id: "2", name: "Big Rival", url: "https://rival-shop.com", products: 890, status: "CRAWLING", health: 100 },
  ];

  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setIsAdding(false);
      setCompetitorUrl("");
    }, 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Competitors</h2>
          <p className="text-muted-foreground text-sm">Monitor and track rival pricing strategies.</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-md hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Site
          </button>
        )}
      </div>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="bg-card border border-border rounded-lg p-8 space-y-8">
             <div className="flex items-center justify-between">
                <div>
                   <h3 className="text-lg font-semibold">Deploy Crawler</h3>
                   <p className="text-xs text-muted-foreground">Setup monitoring for a new target website.</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-muted rounded-md text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
             </div>

             <form onSubmit={handleAddCompetitor} className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Website URL</label>
                   <div className="relative group">
                     <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors" />
                     <input
                       type="url"
                       value={competitorUrl}
                       onChange={(e) => setCompetitorUrl(e.target.value)}
                       placeholder="https://competitor.com"
                       className="w-full bg-background border border-border rounded-md py-2.5 pl-10 pr-4 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm font-medium"
                       required
                     />
                   </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-md border border-border space-y-2">
                   <div className="flex items-center gap-2 text-muted-foreground">
                      <ShieldAlert className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Compliance</span>
                   </div>
                   <p className="text-xs text-muted-foreground leading-relaxed">
                     PricePilot only accesses public data and respects robots.txt to ensure store stability.
                   </p>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-primary text-primary-foreground font-semibold py-2.5 rounded-md transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  >
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>
                      <Zap className="w-4 h-4 fill-current" />
                      Deploy Crawler
                    </>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 bg-secondary text-secondary-foreground font-semibold py-2.5 rounded-md border border-border transition-all text-sm"
                  >
                    Cancel
                  </button>
                </div>
             </form>
          </div>

          <div className="hidden lg:block space-y-6">
              {[
                { icon: Search, title: "Discovery", desc: "We map category structure to find matches." },
                { icon: Target, title: "Matching", desc: "AI-powered product recognition." },
                { icon: MousePointer2, title: "Live Updates", desc: "Checked every 15 minutes." },
              ].map((step, i) => (
                <div key={i} className="flex gap-4 items-start">
                   <div className="w-10 h-10 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                      <step.icon className="w-5 h-5 text-muted-foreground/60" />
                   </div>
                   <div>
                      <p className="font-semibold text-sm">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                   </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="py-4 px-6">Source</th>
                  <th className="py-4 px-6 text-center">Products</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 w-48">Health</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {competitors.map((comp) => (
                  <tr key={comp.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground/50">
                            <Globe className="w-5 h-5" />
                         </div>
                         <div>
                            <div className="text-foreground">{comp.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{new URL(comp.url).hostname}</div>
                         </div>
                      </div>
                    </td>
                    <td className="py-5 px-6 text-center">
                       <span className="font-semibold">{comp.products.toLocaleString()}</span>
                    </td>
                    <td className="py-5 px-6">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase",
                        comp.status === "ACTIVE" ? "bg-success/5 border-success/10 text-success" : "bg-muted border-border text-muted-foreground"
                      )}>
                        {comp.status}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                       <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 bg-muted rounded-full">
                             <div
                               className="h-full bg-success rounded-full"
                               style={{ width: `${comp.health}%` }}
                             />
                          </div>
                          <span className="text-xs text-muted-foreground">{comp.health}%</span>
                       </div>
                    </td>
                    <td className="py-5 px-6 text-right">
                       <div className="flex items-center justify-end gap-2 text-muted-foreground">
                         <button className="p-2 hover:bg-muted rounded-md transition-all">
                           <MoreVertical className="w-4 h-4" />
                         </button>
                         <button className="p-2 hover:bg-danger/10 rounded-md hover:text-danger transition-all">
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {competitors.length === 0 && (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                 <Globe className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <div>
                 <h4 className="font-semibold">No Sites Tracked</h4>
                 <p className="text-sm text-muted-foreground">Add a competitor website to start monitoring prices.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
