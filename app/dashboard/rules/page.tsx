"use client";

import { useState } from "react";
import {
  Plus,
  Zap,
  ShieldCheck,
  ArrowRight,
  Trash2,
  Settings2,
  GripVertical,
  ChevronRight,
  Target,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

const mockRules = [
  {
    id: "1",
    name: "Amazon Aggressive",
    logic: "Cheaper than",
    reference: "Cheapest Competitor",
    offset: "5%",
    scope: "Electronics",
    status: "ACTIVE",
    impact: 145
  },
  {
    id: "2",
    name: "Stable Margin",
    logic: "Equal to",
    reference: "Average price",
    offset: "$2.00",
    scope: "Footwear",
    status: "PAUSED",
    impact: 82
  },
];

export default function PricingRulesPage() {
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight">Dynamic Pricing Rules</h1>
          <p className="text-muted-foreground font-medium">Set your logic once. PricePilot executes it globally every 15 minutes.</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-2xl shadow-primary/20 glow transition-transform active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Create Smart Rule
          </button>
        )}
      </div>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="bg-card border border-border rounded-[2.5rem] p-10 space-y-8 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
             <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">New Rule Definition</h2>
                <p className="text-sm font-medium text-muted-foreground">Define the boundaries of your automated pricing logic.</p>
             </div>

             <div className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Rule Identity</label>
                   <input
                     placeholder="e.g. Amazon Dominance Rule"
                     className="w-full bg-muted/30 border border-border rounded-2xl py-4 px-6 outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-bold"
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Logic Pattern</label>
                      <select className="w-full bg-muted/30 border border-border rounded-2xl py-4 px-6 outline-none appearance-none font-bold">
                         <option>Cheaper Than</option>
                         <option>More Expensive Than</option>
                         <option>Equal To</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Target Reference</label>
                      <select className="w-full bg-muted/30 border border-border rounded-2xl py-4 px-6 outline-none appearance-none font-bold">
                         <option>Cheapest Rival</option>
                         <option>Average Rival</option>
                         <option>Highest Rival</option>
                      </select>
                   </div>
                </div>

                <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white border border-border flex items-center justify-center text-primary glow shadow-sm">
                         <Target className="w-6 h-6" />
                      </div>
                      <div className="space-y-0.5">
                         <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Price Offset</p>
                         <p className="text-lg font-black tracking-tight">Stay 5% Cheaper</p>
                      </div>
                   </div>
                   <button className="px-5 py-2.5 bg-background border border-border rounded-xl text-xs font-black uppercase tracking-widest shadow-sm hover:bg-muted transition-all">Adjust</button>
                </div>

                <div className="pt-6 flex items-center gap-4">
                   <button
                     className="flex-1 premium-gradient text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-primary/20 glow transition-transform active:scale-95 flex items-center justify-center gap-2"
                     onClick={() => setIsAdding(false)}
                   >
                     <Zap className="w-4 h-4 fill-current" />
                     Save Rule
                   </button>
                   <button
                     className="flex-1 bg-muted hover:bg-muted/80 text-foreground font-black py-5 rounded-2xl border border-border transition-all"
                     onClick={() => setIsAdding(false)}
                   >
                     Cancel
                   </button>
                </div>
             </div>
          </div>

          <div className="hidden lg:block space-y-10 pt-10">
             <div className="bg-success/5 border border-success/10 rounded-[2.5rem] p-10 space-y-6">
                <div className="flex items-center gap-4 text-success">
                   <ShieldCheck className="w-6 h-6" />
                   <h3 className="text-xl font-black">Safety Guard-rails</h3>
                </div>
                <p className="text-muted-foreground font-medium leading-relaxed">PricePilot will never lower your price below your specified `Minimum Profit Margin`. All rules respect your inventory cost basis automatically.</p>
                <div className="flex items-center gap-3">
                   <div className="px-4 py-2 bg-success/10 rounded-full text-[10px] font-black uppercase text-success tracking-widest border border-success/20">Active Protection</div>
                   <div className="px-4 py-2 bg-success/10 rounded-full text-[10px] font-black uppercase text-success tracking-widest border border-success/20">Net Margin Lock</div>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {mockRules.map((rule) => (
            <div key={rule.id} className="bg-card border border-border rounded-[2.5rem] p-8 hover:border-primary/30 transition-all shadow-xl shadow-black/[0.01] flex flex-col md:flex-row items-center justify-between gap-8 group">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-black tracking-tight">{rule.name}</h3>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border",
                      rule.status === "ACTIVE" ? "bg-success/5 border-success/20 text-success" : "bg-warning/5 border-warning/20 text-warning"
                    )}>
                      {rule.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Scope: {rule.scope}</span>
                    <div className="w-1 h-1 rounded-full bg-border" />
                    <span className="flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5" /> Logic: {rule.logic} {rule.reference}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-10">
                 <div className="flex flex-col items-center">
                    <span className="text-2xl font-black tracking-tighter text-primary">-{rule.offset}</span>
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-40">Offset</span>
                 </div>
                 <div className="h-12 w-px bg-border/50" />
                 <div className="flex flex-col items-center">
                    <span className="text-2xl font-black tracking-tighter">{rule.impact}</span>
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-40">SKUs Impacted</span>
                 </div>
                 <div className="flex items-center gap-2 pl-4">
                    <button className="p-4 bg-muted hover:bg-background border border-border rounded-2xl text-muted-foreground hover:text-foreground transition-all shadow-sm">
                       <ChevronRight className="w-5 h-5" />
                    </button>
                    <button className="p-4 bg-muted hover:bg-danger/10 border border-border hover:border-danger/20 rounded-2xl text-muted-foreground hover:text-danger transition-all shadow-sm">
                       <Trash2 className="w-5 h-5" />
                    </button>
                 </div>
              </div>
            </div>
          ))}

          {mockRules.length === 0 && (
            <div className="py-32 text-center space-y-6 bg-muted/10 rounded-[3rem] border-2 border-dashed border-border">
              <div className="w-24 h-24 rounded-[2rem] bg-card border border-border flex items-center justify-center mx-auto glow">
                 <Zap className="w-12 h-12 text-muted-foreground opacity-30" />
              </div>
              <div className="space-y-1">
                 <h4 className="text-xl font-black">No Dynamic Rules Defined</h4>
                 <p className="text-muted-foreground font-medium">Create your first rule to start automating your market position.</p>
              </div>
              <button
                onClick={() => setIsAdding(true)}
                className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-2xl font-black gap-2 transition-all shadow-xl shadow-primary/20 glow inline-flex items-center"
              >
                <Plus className="w-4 h-4" />
                Initialize First Rule
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
