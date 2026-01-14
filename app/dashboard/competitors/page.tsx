"use client";

import { useState } from "react";
import { Plus, Globe, Search, Trash2, ShieldAlert, Zap, ExternalLink, MoreVertical, Target, MousePointer2 } from "lucide-react";
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
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight">Rival Intelligence</h1>
          <p className="text-muted-foreground font-medium">Deploy crawlers to observe competitor movements in real-time.</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-2xl shadow-primary/20 glow transition-transform active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Add Target Website
          </button>
        )}
      </div>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="bg-card border border-border rounded-[2.5rem] p-10 space-y-8 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

             <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary glow">
                   <Target className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                   <h2 className="text-2xl font-black tracking-tight tracking-tight">New Target</h2>
                   <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Setup crawler deployment</p>
                </div>
             </div>

             <form onSubmit={handleAddCompetitor} className="space-y-8">
               <div className="space-y-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Website URL</label>
                   <div className="relative group">
                     <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                     <input
                       type="url"
                       value={competitorUrl}
                       onChange={(e) => setCompetitorUrl(e.target.value)}
                       placeholder="https://competitor.com"
                       className="w-full bg-muted/30 border border-border rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-bold placeholder:text-muted-foreground/30"
                       required
                     />
                   </div>
                 </div>

                 <div className="p-6 bg-warning/5 border border-warning/10 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-warning">
                       <ShieldAlert className="w-4 h-4" />
                       <span className="text-xs font-black uppercase tracking-widest">Compliance Engine</span>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground leading-relaxed">
                      PricePilot will only access public product data. Our crawlers respect robots.txt and use optimized request rates to avoid store disruption.
                    </p>
                 </div>
               </div>

               <div className="flex items-center gap-4 pt-4">
                 <button
                   type="submit"
                   disabled={loading}
                   className="flex-1 premium-gradient text-white font-black py-5 rounded-2xl transition-all disabled:opacity-50 shadow-xl shadow-primary/20 glow transition-transform active:scale-95 flex items-center justify-center gap-2"
                 >
                   {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>
                     <Zap className="w-4 h-4 fill-current" />
                     Deploy Crawler
                   </>}
                 </button>
                 <button
                   type="button"
                   onClick={() => setIsAdding(false)}
                   className="flex-1 bg-muted hover:bg-muted/80 text-foreground font-black py-5 rounded-2xl border border-border transition-all"
                 >
                   Cancel
                 </button>
               </div>
             </form>
          </div>

          <div className="hidden lg:block space-y-10 pt-10">
              <div className="space-y-2">
                 <h3 className="text-xl font-black">How tracking works</h3>
                 <p className="text-muted-foreground font-medium">Understanding the PricePilot observation loop.</p>
              </div>

              {[
                { icon: Search, title: "Discovery Phase", desc: "Our engine maps the competitor's category structure to find product matches." },
                { icon: Target, title: "Target Selection", desc: "Items are matched via SKU or AI-powered model recognition." },
                { icon: MousePointer2, title: "Real-time Pulse", desc: "Prices are checked every 15 minutes to ensure instant response capability." },
              ].map((step, i) => (
                <div key={i} className="flex gap-6 items-start">
                   <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
                      <step.icon className="w-6 h-6 text-muted-foreground" />
                   </div>
                   <div className="space-y-1">
                      <p className="font-black text-lg">{step.title}</p>
                      <p className="text-sm text-muted-foreground font-medium leading-relaxed">{step.desc}</p>
                   </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-[3rem] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left py-6 px-10 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Deployment Target</th>
                  <th className="text-left py-6 px-10 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Active SKUs</th>
                  <th className="text-left py-6 px-10 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Engine Status</th>
                  <th className="text-left py-6 px-10 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Data Health</th>
                  <th className="text-right py-6 px-10 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Terminal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {competitors.map((comp) => (
                  <tr key={comp.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="py-8 px-10">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all duration-500">
                            <Globe className="w-6 h-6" />
                         </div>
                         <div className="space-y-1">
                           <div className="font-black text-lg flex items-center gap-2 group-hover:text-primary transition-colors">
                             {comp.name}
                             <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
                           </div>
                           <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{new URL(comp.url).hostname}</div>
                         </div>
                      </div>
                    </td>
                    <td className="py-8 px-10">
                      <div className="flex flex-col">
                        <span className="text-xl font-black">{comp.products.toLocaleString()}</span>
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Mapped Items</span>
                      </div>
                    </td>
                    <td className="py-8 px-10">
                      <span className={cn(
                        "text-[9px] font-black px-3 py-1.5 rounded-full border tracking-[0.1em] uppercase",
                        comp.status === "ACTIVE" ? "bg-success/5 border-success/20 text-success" : "bg-warning/5 border-warning/20 text-warning"
                      )}>
                        {comp.status}
                      </span>
                    </td>
                    <td className="py-8 px-10">
                       <div className="w-32 space-y-2">
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                             <span className="text-muted-foreground">Pulse</span>
                             <span className="text-success">{comp.health}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                             <div
                               className="h-full bg-success rounded-full"
                               style={{ width: `${comp.health}%` }}
                             />
                          </div>
                       </div>
                    </td>
                    <td className="py-8 px-10 text-right">
                       <div className="flex items-center justify-end gap-2">
                         <button className="p-3 bg-muted hover:bg-background border border-border rounded-xl text-muted-foreground hover:text-foreground transition-all shadow-sm">
                           <MoreVertical className="w-5 h-5" />
                         </button>
                         <button className="p-3 bg-muted hover:bg-danger/10 border border-border hover:border-danger/20 rounded-xl text-muted-foreground hover:text-danger transition-all shadow-sm">
                           <Trash2 className="w-5 h-5" />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {competitors.length === 0 && (
            <div className="py-32 text-center space-y-6">
              <div className="w-24 h-24 rounded-[2rem] bg-muted border border-border flex items-center justify-center mx-auto glow">
                 <Globe className="w-12 h-12 text-muted-foreground opacity-30" />
              </div>
              <div className="space-y-1">
                 <h4 className="text-xl font-black">No Active Deployment</h4>
                 <p className="text-muted-foreground font-medium">Station a crawler on a rival website to begin tracking.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
