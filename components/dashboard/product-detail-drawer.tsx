"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  X,
  TrendingUp,
  TrendingDown,
  History,
  Globe,
  Target,
  Zap,
  ArrowUpRight,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Product } from "@/lib/types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface ProductDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onExecute?: (productId: string) => Promise<void>;
}

const historyData = [
  { date: "01/24", you: 155, amazon: 142, ebay: 148 },
  { date: "02/24", you: 150, amazon: 140, ebay: 145 },
  { date: "03/24", you: 145, amazon: 138, ebay: 142 },
  { date: "04/24", you: 145, amazon: 145, ebay: 145 },
  { date: "05/24", you: 140, amazon: 139, ebay: 140 },
  { date: "06/24", you: 138, amazon: 140, ebay: 138 },
  { date: "07/24", you: 150, amazon: 140, ebay: 142 },
];

export default function ProductDetailDrawer({ isOpen, onClose, product, onExecute }: ProductDetailDrawerProps) {
  const [matchUrl, setMatchUrl] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  const handleLinkCompetitor = async () => {
    if (!matchUrl || !product) return;
    setIsLinking(true);
    try {
      const res = await fetch(`/api/products/${product.id}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: matchUrl }),
      });
      if (res.ok) {
        toast.success("Competitor URL linked successfully! Run sync to fetch latest price.");
        setMatchUrl("");
      } else {
        toast.error("Failed to link competitor");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setIsLinking(false);
    }
  };

  if (!product) return null;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] transition-opacity duration-500",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-2xl bg-card border-l border-border z-[101] shadow-2xl transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-8 md:p-10 border-b border-border flex items-start justify-between bg-muted/20">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20">
                  {product.sku}
                </span>
                <span className={cn(
                  "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full",
                  product.status === "RED" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
                )}>
                  {product.status === "RED" ? "Action Required" : "Optimized"}
                </span>
              </div>
              <h2 className="text-3xl font-black tracking-tight">{product.title}</h2>
              <p className="text-muted-foreground font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" /> Global Tracking Active via 8 Crawlers
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-3 bg-background hover:bg-muted border border-border rounded-2xl transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 md:p-10 space-y-12">
            {/* Price Snapshot */}
            <div className="grid grid-cols-2 gap-6">
               <div className="bg-primary/5 border border-primary/10 rounded-[2.5rem] p-8 space-y-1 group hover:border-primary/30 transition-all">
                  <p className="text-[10px] font-black uppercase text-primary tracking-widest opacity-60">Your Current Price</p>
                  <p className="text-4xl font-black text-primary">${product.yourPrice.toFixed(2)}</p>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary/40 pt-2 uppercase tracking-tight">
                    <Zap className="w-3.5 h-3.5 fill-current" /> Manual Override Active
                  </div>
               </div>
               <div className="bg-muted/30 border border-border rounded-[2.5rem] p-8 space-y-1 group hover:border-primary/20 transition-all">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Lowest Rival Price</p>
                  <p className="text-4xl font-black">${product.compPrice.toFixed(2)}</p>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground/40 pt-2 uppercase tracking-tight">
                    <Target className="w-3.5 h-3.5" /> Source: {product.match}
                  </div>
               </div>
            </div>

            {/* Price History Chart */}
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground">
                       <History className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-black">Price Movement History</h3>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                       <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                       <span className="text-[9px] font-black uppercase text-muted-foreground opacity-60">You</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
                       <span className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Market avg</span>
                    </div>
                  </div>
               </div>

               <div className="h-[280px] w-full bg-muted/10 rounded-[2.5rem] border border-border p-6 overflow-hidden relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                       <XAxis
                         dataKey="date"
                         axisLine={false}
                         tickLine={false}
                         tick={{ fontSize: 9, fontWeight: 900, fill: "hsl(var(--muted-foreground))" }}
                         dy={10}
                       />
                       <YAxis
                         axisLine={false}
                         tickLine={false}
                         tick={{ fontSize: 9, fontWeight: 900, fill: "hsl(var(--muted-foreground))" }}
                       />
                       <Tooltip
                         contentStyle={{
                           backgroundColor: "hsl(var(--card))",
                           border: "1px solid hsl(var(--border))",
                           borderRadius: "1rem",
                           fontSize: "10px",
                           fontWeight: "900"
                         }}
                       />
                       <Line
                         type="stepAfter"
                         dataKey="you"
                         stroke="hsl(var(--primary))"
                         strokeWidth={4}
                         dot={false}
                         animationDuration={2000}
                       />
                       <Line
                         type="monotone"
                         dataKey="amazon"
                         stroke="hsl(var(--muted-foreground))"
                         strokeWidth={2}
                         strokeDasharray="5 5"
                         dot={false}
                         animationDuration={2500}
                       />
                    </LineChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Competitor Matching */}
            <div className="space-y-6">
               <h3 className="text-xl font-black flex items-center gap-3">
                  <Target className="w-5 h-5 text-primary" />
                  Manual Competitor Link
               </h3>
               <div className="p-6 bg-muted/20 border border-border rounded-2xl space-y-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest leading-relaxed">
                    Accurately track specific rivals by linking this product directly to their listing URL.
                  </p>
                  <div className="flex gap-2">
                     <input
                        type="url"
                        value={matchUrl}
                        onChange={(e) => setMatchUrl(e.target.value)}
                        placeholder="https://competitor.com/p/product-name"
                        className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary/20 transition-all shadow-sm"
                     />
                     <button
                        onClick={handleLinkCompetitor}
                        disabled={isLinking || !matchUrl}
                        className="bg-primary text-primary-foreground text-xs font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-primary/10"
                     >
                        {isLinking ? "Linking..." : "Link"}
                     </button>
                  </div>
               </div>
            </div>

            {/* Smart Suggestions */}
            <div className="space-y-6">
               <h3 className="text-xl font-black flex items-center gap-3">
                  <Zap className="w-5 h-5 text-primary" />
                  Pilot Recommendations
               </h3>

               <div className="grid grid-cols-1 gap-4">
                  <div className="p-6 bg-warning/5 border border-warning/10 rounded-2xl flex items-center justify-between group cursor-pointer hover:border-warning/30 transition-all">
                    <div className="space-y-1">
                       <p className="text-sm font-black tracking-tight">Match lowest competitor price</p>
                       <p className="text-xs text-muted-foreground font-medium italic">Adjust price to $140.00 to regain market leadership.</p>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-warning group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </div>

                  <div className="p-6 bg-success/5 border border-success/10 rounded-2xl flex items-center justify-between group cursor-pointer hover:border-success/30 transition-all">
                    <div className="space-y-1">
                       <p className="text-sm font-black tracking-tight">Apply Dynamic Rule: `Stable Margin`</p>
                       <p className="text-xs text-muted-foreground font-medium italic">Logic: Stay $1.00 below Amazon at all times.</p>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-success group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </div>
               </div>
            </div>

            {/* Terminal Actions */}
            <div className="pt-8 flex items-center gap-4">
               <button
                 onClick={() => onExecute?.(product.id)}
                 className="flex-1 premium-gradient text-primary-foreground font-black py-5 rounded-2xl shadow-xl shadow-primary/20 glow flex items-center justify-center gap-2 active:scale-95 transition-all"
               >
                  <Zap className="w-5 h-5 fill-current" />
                  Execute Auto-Adjustment
               </button>
               <button className="p-5 bg-muted hover:bg-muted/80 text-foreground font-black rounded-2xl border border-border transition-all">
                  <ChevronRight className="w-6 h-6" />
               </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
