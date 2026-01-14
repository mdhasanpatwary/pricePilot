"use client";

import { useState } from "react";
import {
  Plus,
  Zap,
  ShieldCheck,
  Trash2,
  Settings2,
  GripVertical,
  ChevronRight,
  Target,
  X
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pricing Rules</h2>
          <p className="text-muted-foreground text-sm">Define automated logic for your market positioning.</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-md hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Rule
          </button>
        )}
      </div>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="bg-card border border-border rounded-lg p-8 space-y-8">
             <div className="flex items-center justify-between">
                <div>
                   <h3 className="text-lg font-semibold">New Rule Definition</h3>
                   <p className="text-xs text-muted-foreground">Set up your automated pricing logic.</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-muted rounded-md text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
             </div>

             <div className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Rule Name</label>
                   <input
                     placeholder="e.g. Amazon Dominance"
                     className="w-full bg-background border border-border rounded-md py-2.5 px-4 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm font-medium"
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pricing Logic</label>
                      <select className="w-full bg-background border border-border rounded-md py-2.5 px-4 outline-none text-sm font-medium">
                         <option>Cheaper Than</option>
                         <option>More Expensive Than</option>
                         <option>Equal To</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Reference</label>
                      <select className="w-full bg-background border border-border rounded-md py-2.5 px-4 outline-none text-sm font-medium">
                         <option>Cheapest Rival</option>
                         <option>Average Rival</option>
                         <option>Highest Rival</option>
                      </select>
                   </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-md border border-border flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md bg-background border border-border flex items-center justify-center text-primary">
                         <Target className="w-5 h-5" />
                      </div>
                      <div>
                         <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Price Offset</p>
                         <p className="text-sm font-semibold">Stay 5% Cheaper</p>
                      </div>
                   </div>
                   <button className="text-xs font-bold text-primary hover:underline">Adjust</button>
                </div>

                <div className="pt-4 flex items-center gap-3">
                   <button
                     className="flex-1 bg-primary text-primary-foreground font-semibold py-2.5 rounded-md transition-all text-sm"
                     onClick={() => setIsAdding(false)}
                   >
                     Save Rule
                   </button>
                   <button
                     className="flex-1 bg-secondary text-secondary-foreground font-semibold py-2.5 rounded-md border border-border transition-all text-sm"
                     onClick={() => setIsAdding(false)}
                   >
                     Cancel
                   </button>
                </div>
             </div>
          </div>

          <div className="hidden lg:block space-y-6">
             <div className="bg-success/5 border border-success/10 rounded-lg p-8">
                <div className="flex items-center gap-3 text-success mb-3">
                   <ShieldCheck className="w-5 h-5" />
                   <h4 className="font-semibold">Safety Guard-rails</h4>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  PricePilot ensures your prices never drop below your minimum profit margin.
                  All rules automatically respect your inventory cost basis.
                </p>
             </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {mockRules.map((rule) => (
            <div key={rule.id} className="bg-card border border-border rounded-lg p-5 flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-primary/20 transition-all">
              <div className="flex items-center gap-4 w-full">
                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground/50 cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold">{rule.name}</h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border",
                      rule.status === "ACTIVE" ? "bg-success/5 border-success/10 text-success" : "bg-muted border-border text-muted-foreground"
                    )}>
                      {rule.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium">Scope: {rule.scope}</span>
                    <div className="w-1 h-1 rounded-full bg-border" />
                    <span className="flex items-center gap-1.5 font-medium">Logic: {rule.logic} {rule.reference}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8 md:gap-12 w-full md:w-auto justify-between md:justify-end px-14 md:px-0">
                 <div className="text-center">
                    <p className="text-xl font-bold text-primary">-{rule.offset}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Offset</p>
                 </div>
                 <div className="text-center">
                    <p className="text-xl font-bold">{rule.impact}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">SKUs</p>
                 </div>
                 <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-muted rounded-md text-muted-foreground transition-all">
                       <ChevronRight className="w-5 h-5" />
                    </button>
                    <button className="p-2 hover:bg-danger/10 rounded-md text-muted-foreground hover:text-danger transition-all">
                       <Trash2 className="w-5 h-5" />
                    </button>
                 </div>
              </div>
            </div>
          ))}

          {mockRules.length === 0 && (
            <div className="py-20 text-center space-y-4 bg-muted/10 rounded-lg border-2 border-dashed border-border">
              <div className="w-16 h-16 rounded-full bg-background border border-border flex items-center justify-center mx-auto">
                 <Zap className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <div>
                 <h4 className="font-semibold">No Rules Defined</h4>
                 <p className="text-sm text-muted-foreground">Create your first rule to start automating your market position.</p>
              </div>
              <button
                onClick={() => setIsAdding(true)}
                className="bg-primary text-primary-foreground text-sm font-semibold px-6 py-2.5 rounded-md hover:opacity-90 transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create First Rule
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
