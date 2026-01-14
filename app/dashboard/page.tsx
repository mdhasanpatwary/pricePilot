"use client";

import {
  TrendingDown,
  TrendingUp,
  Package,
  ShoppingBag,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Calendar,
  Zap,
  MoreVertical,
  Activity,
  History
} from "lucide-react";
import { cn } from "@/lib/utils";

const stats = [
  { label: "Total SKUs Live", value: "1,254", icon: Package, change: "+12%", trend: "up", suffix: "managed" },
  { icon: ShoppingBag, label: "Active Rivals", value: "08", change: "STABLE", trend: "neutral", suffix: "sites" },
  { label: "Critical Alerts", value: "482", icon: TrendingDown, change: "-14%", trend: "down", color: "text-danger", suffix: "skus" },
  { label: "Market Edge", value: "+$4.20", icon: Activity, change: "+2%", trend: "up", suffix: "avg" },
];

export default function DashboardOverview() {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-10">
      {/* Welcome Banner */}
      <div className="relative p-10 md:p-14 rounded-[3rem] bg-card border border-border shadow-2xl overflow-hidden group">
         <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/10 via-primary/5 to-transparent pointer-events-none" />
         <div className="absolute -top-16 -left-16 w-56 h-56 bg-primary/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/20 transition-colors duration-700" />
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.015] pointer-events-none" />

         <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
            <div className="space-y-4">
               <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-black uppercase text-primary tracking-[0.15em] shadow-sm">
                  <Zap className="w-3 h-3 fill-current" /> Auto-pilot Active
               </div>
               <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.1]">Strategy outperforming <span className="text-primary italic relative">82% rivals<div className="absolute bottom-1 left-0 w-full h-1.5 bg-primary/20 -rotate-1" /></span></h2>
               <p className="text-muted-foreground text-lg max-w-xl font-medium leading-relaxed opacity-70">Pricing engines are processing 1,250 items across 8 sites to secure your position.</p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
               <button className="bg-primary hover:bg-primary/90 text-white font-black px-10 py-5 rounded-[1.5rem] shadow-xl shadow-primary/25 transition-all hover:scale-105 active:scale-95 text-lg flex items-center gap-2.5">
                  <Zap className="w-5 h-5 fill-current" />
                  Run Sync
               </button>
               <button className="bg-muted/50 hover:bg-muted text-foreground font-black px-8 py-5 rounded-[1.5rem] transition-all border border-border flex items-center gap-2.5 hover:translate-x-1 active:scale-95 text-base">
                  <BarChart3 className="w-4.5 h-4.5" />
                  Analytics
               </button>
            </div>
         </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={stat.label} className="group bg-card border border-border rounded-[2.5rem] p-8 hover:border-primary/40 transition-all shadow-xl shadow-black/[0.01] hover:shadow-primary/5 relative overflow-hidden">
             <div className="absolute bottom-[-30px] right-[-30px] w-32 h-32 bg-primary/5 rounded-full blur-[50px] group-hover:bg-primary/10 transition-colors duration-700" />
             <div className="flex items-center justify-between mb-8">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center group-hover:bg-primary group-hover:text-white group-hover:glow transition-all duration-500 shadow-sm">
                    <stat.icon className="w-8 h-8" />
                </div>
                <div className={cn(
                  "flex items-center gap-1.5 text-[9px] font-black px-3 py-1.5 rounded-xl border transition-all duration-500",
                  stat.trend === "up" ? "bg-success/5 text-success border-success/10 group-hover:bg-success group-hover:text-white" :
                  stat.trend === "down" ? "bg-danger/5 text-danger border-danger/10 group-hover:bg-danger group-hover:text-white" :
                  "bg-muted text-muted-foreground border-border group-hover:bg-foreground group-hover:text-background"
                )}>
                  {stat.trend === "up" ? <ArrowUpRight className="w-3.5 h-3.5" /> :
                   stat.trend === "down" ? <ArrowDownRight className="w-3.5 h-3.5" /> : null}
                  {stat.change}
                </div>
             </div>

             <div className="space-y-1.5">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">{stat.label}</p>
                <div className="flex items-baseline gap-2.5">
                  <h3 className={cn("text-5xl font-black tracking-tighter", stat.trend === "down" ? "text-danger" : "text-foreground group-hover:text-primary transition-colors")}>
                    {stat.value}
                  </h3>
                  <span className="text-[9px] font-black text-muted-foreground uppercase opacity-30 tracking-widest">{stat.suffix}</span>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* Activity and Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 pt-4">
        {/* Market Analysis Visual (Placeholder) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-[3.5rem] p-10 md:p-14 min-h-[550px] flex flex-col shadow-xl shadow-black/[0.01] relative overflow-hidden group/viz">
           <div className="flex flex-col md:row items-center justify-between gap-6 mb-12">
              <div>
                 <h4 className="text-2xl font-black tracking-tight text-foreground leading-tight">Market Distribution</h4>
                 <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] mt-1.5 opacity-40">Segment Analysis Engine</p>
              </div>
              <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-2xl border border-border">
                  <button className="px-5 py-2 bg-background border border-border rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm hover:text-primary transition-all">Real-time</button>
                  <button className="px-5 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all">24H</button>
                  <button className="px-5 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all">Global</button>
              </div>
           </div>

           <div className="flex-1 flex flex-col justify-center items-center text-center space-y-8">
              <div className="w-40 h-40 rounded-[3rem] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center relative group-hover/viz:scale-105 transition-transform duration-700">
                 <div className="absolute inset-0 bg-primary/20 blur-[60px] animate-pulse-soft" />
                 <BarChart3 className="w-20 h-20 text-primary glow animate-float" />
              </div>
              <div className="space-y-2.5">
                 <h5 className="text-xl font-black tracking-tight">Synchronizing Compute Cores...</h5>
                 <p className="text-muted-foreground max-w-sm font-medium text-base leading-relaxed opacity-60">Engine is ready. Feed data via the Integration center to populate this visualization.</p>
              </div>
              <div className="flex items-center gap-12 pt-4">
                 <div className="space-y-1.5 text-center">
                    <p className="text-3xl font-black text-primary">1.2s</p>
                    <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] opacity-40">Latency</p>
                 </div>
                 <div className="h-10 w-px bg-border/50" />
                 <div className="space-y-1.5 text-center">
                    <p className="text-3xl font-black text-foreground">100%</p>
                    <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] opacity-40">Integrity</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Priority Execution Queue */}
        <div className="bg-card border border-border rounded-[3.5rem] p-10 space-y-10 shadow-xl shadow-black/[0.01] relative group/queue overflow-hidden">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center animate-pulse shadow-sm">
                    <AlertTriangle className="w-6 h-6 text-danger" />
                </div>
                <div>
                  <h4 className="text-xl font-black tracking-tight">Execution</h4>
                  <p className="text-[7px] font-black uppercase text-muted-foreground tracking-[0.2em] opacity-40">Live Queue (4)</p>
                </div>
             </div>
             <MoreVertical className="w-5 h-5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
          </div>

          <div className="space-y-4">
            {[
              { name: "Nike Air Max 270", sku: "NIKE-AM-270", action: "Price Drop", value: "-$12.50", time: "4m" },
              { name: "Adidas Ultraboost 22", sku: "AD-UB-22", action: "Undercut", value: "-$4.00", time: "18m" },
              { name: "Puma RS-X", sku: "PU-RSX-99", action: "Outbid", value: "-$1.20", time: "32m" },
              { name: "Jordan Retro Black", sku: "JD-RT-11", action: "Price Drop", value: "-$42.00", time: "1h" },
            ].map((item, i) => (
              <div key={i} className="group/item p-6 rounded-[2rem] bg-muted/10 border border-border hover:border-primary/40 hover:bg-primary/[0.01] transition-all cursor-pointer hover:translate-x-1 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-black text-sm group-hover/item:text-primary transition-colors tracking-tight">{item.name}</p>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-30">{item.sku}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs font-black text-danger bg-danger/5 px-2 py-0.5 rounded-lg">{item.value}</p>
                    <p className="text-[8px] font-black text-muted-foreground uppercase opacity-30 tracking-tighter">{item.time} ago</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <button className="w-full py-5 text-[9px] font-black uppercase text-muted-foreground hover:text-white hover:bg-primary transition-all tracking-[0.3em] bg-muted/30 rounded-[1.5rem] border border-transparent shadow-sm hover:shadow-primary/20">
              Global Reports
            </button>
          </div>

          <div className="absolute top-0 right-[-100px] w-72 h-72 bg-danger/5 rounded-full blur-[90px] pointer-events-none group-hover/queue:bg-danger/10 transition-colors duration-700" />
        </div>
      </div>
    </div>
  );
}
