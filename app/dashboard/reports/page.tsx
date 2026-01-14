"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  Download,
  ChevronDown,
  MoreVertical,
  ArrowUpDown,
  Zap,
  Check,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  History,
  Activity,
  ArrowRight,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";
import BulkUpdateDrawer from "@/components/dashboard/bulk-update-drawer";

const mockData = [
  { id: "1", sku: "NIKE-AM-270", title: "Nike Air Max 270", yourPrice: 150.00, compPrice: 140.00, diff: -10.00, status: "RED", match: "Amazon", stock: 12 },
  { id: "2", sku: "ADIDAS-UB-22", title: "Adidas Ultraboost 22", yourPrice: 180.00, compPrice: 195.00, diff: 15.00, status: "GREEN", match: "eBay", stock: 45 },
  { id: "3", sku: "PUMA-RS-X", title: "Puma RS-X", yourPrice: 110.00, compPrice: 110.00, diff: 0.00, status: "NEUTRAL", match: "StockX", stock: 8 },
  { id: "4", sku: "JD-RT-11", title: "Jordan Retro Black", yourPrice: 220.00, compPrice: 178.00, diff: -42.00, status: "RED", match: "GOAT", stock: 3 },
  { id: "5", sku: "NB-550-GR", title: "New Balance 550 Grey", yourPrice: 130.00, compPrice: 145.00, diff: 15.00, status: "GREEN", match: "Stadium Goods", stock: 22 },
];

export default function PriceReportPage() {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [isUpdateDrawerOpen, setIsUpdateDrawerOpen] = useState(false);

  const toggleSelectAll = () => {
    if (selectedItems.length === mockData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(mockData.map(i => i.id));
    }
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-10 max-w-full animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight tracking-tight">Market Intelligence</h1>
          <p className="text-muted-foreground font-medium">Global price comparison vs. your active inventory.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-card hover:bg-muted text-foreground px-6 py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 border border-border transition-all shadow-sm">
            <Download className="w-4 h-4" />
            Export Data
          </button>

          <div className={cn(
             "transition-all duration-500 overflow-hidden flex items-center",
             selectedItems.length > 0 ? "max-w-[400px] opacity-100" : "max-w-0 opacity-0"
          )}>
            <button
              onClick={() => setIsUpdateDrawerOpen(true)}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-2xl text-sm font-black flex items-center gap-2 transition-all shadow-xl shadow-primary/20 glow whitespace-nowrap active:scale-95"
            >
              <Zap className="w-4 h-4 fill-current" />
              Sync {selectedItems.length} Selections
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-card border border-border rounded-[2.5rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="relative flex-1 w-full max-w-xl group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search by SKU, Brand, or Model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-muted/30 border border-border rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm placeholder:text-muted-foreground/40"
          />
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
           <div className="flex items-center gap-8 px-6 py-3 bg-muted/50 rounded-2xl border border-border whitespace-nowrap">
              <div className="flex items-center gap-2.5">
                 <div className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse" />
                 <span className="text-[10px] font-black uppercase text-danger tracking-widest">At Risk: {mockData.filter(d => d.status === "RED").length}</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2.5">
                 <div className="w-2.5 h-2.5 rounded-full bg-success" />
                 <span className="text-[10px] font-black uppercase text-success tracking-widest">Optimized: {mockData.filter(d => d.status === "GREEN").length}</span>
              </div>
           </div>

           <button className="p-4 bg-muted hover:bg-background rounded-2xl text-muted-foreground hover:text-foreground transition-all border border-transparent hover:border-border shrink-0">
              <Filter className="w-5 h-5" />
           </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-card border border-border rounded-[3rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="py-6 px-8 text-left w-12">
                   <div
                    onClick={toggleSelectAll}
                    className={cn(
                      "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer",
                      selectedItems.length === mockData.length
                        ? "bg-primary border-primary shadow-lg shadow-primary/20"
                        : "border-border hover:border-primary/40 bg-background"
                    )}
                  >
                    {selectedItems.length === mockData.length && <Check className="w-4 h-4 text-white" />}
                  </div>
                </th>
                <th className="py-6 px-8 text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] min-w-[300px]">
                  <div className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors group">
                    Catalog Reference
                    <ArrowUpDown className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                  </div>
                </th>
                <th className="py-6 px-8 text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Live Valuation</th>
                <th className="py-6 px-8 text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Market Pulse</th>
                <th className="py-6 px-8 text-center text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Price Gap</th>
                <th className="py-6 px-8 text-center text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Signal</th>
                <th className="py-6 px-8 text-right w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockData.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "hover:bg-muted/30 transition-all group/row",
                    selectedItems.includes(item.id) ? "bg-primary/[0.03]" : ""
                  )}
                >
                  <td className="py-8 px-8">
                    <div
                      onClick={() => toggleItem(item.id)}
                      className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer",
                        selectedItems.includes(item.id)
                          ? "bg-primary border-primary shadow-lg shadow-primary/20"
                          : "border-border hover:border-primary/40 bg-background group-hover/row:border-primary/20"
                      )}
                    >
                      {selectedItems.includes(item.id) && <Check className="w-4 h-4 text-white" />}
                    </div>
                  </td>
                  <td className="py-8 px-8">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-xl bg-muted border border-border flex flex-col items-center justify-center text-muted-foreground group-hover/row:scale-110 transition-transform duration-500">
                          <span className="text-[10px] font-black leading-none">{item.stock}</span>
                          <span className="text-[8px] font-bold uppercase tracking-tighter opacity-50">PCS</span>
                       </div>
                       <div className="space-y-1">
                          <div className="font-black text-lg text-foreground group-hover/row:text-primary transition-colors cursor-pointer">{item.title}</div>
                          <div className="text-[10px] text-muted-foreground font-black tracking-widest uppercase flex items-center gap-2">
                             <History className="w-3 h-3" />
                             {item.sku}
                          </div>
                       </div>
                    </div>
                  </td>
                  <td className="py-8 px-8">
                    <div className="flex flex-col">
                       <span className="text-xl font-black">${item.yourPrice.toFixed(2)}</span>
                       <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Current Floor</span>
                    </div>
                  </td>
                  <td className="py-8 px-8">
                    <div className="space-y-1.5">
                      <div className="font-black text-lg flex items-center gap-2">
                         ${item.compPrice.toFixed(2)}
                         <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-soft" />
                      </div>
                      <div className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1.5 tracking-wider">
                         <Globe className="w-3 h-3 text-primary" />
                         Captured via {item.match}
                      </div>
                    </div>
                  </td>
                  <td className="py-8 px-8 text-center uppercase">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black ring-1 ring-inset",
                      item.diff < 0 ? "bg-danger/5 text-danger ring-danger/10" :
                      item.diff > 0 ? "bg-success/5 text-success ring-success/10" : "bg-muted text-muted-foreground ring-border"
                    )}>
                      {item.diff < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : item.diff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                      {item.diff > 0 ? "+" : ""}{item.diff.toFixed(2)}
                    </div>
                  </td>
                  <td className="py-8 px-8 text-center">
                     <div className={cn(
                       "inline-block px-3 py-1.5 rounded-full text-[9px] font-black tracking-[0.1em] shadow-sm",
                       item.status === "RED" ? "bg-danger text-white shadow-danger/20" :
                       item.status === "GREEN" ? "bg-success text-white shadow-success/20" :
                       "bg-muted text-muted-foreground border border-border"
                     )}>
                       {item.status === "RED" ? "UNDER BID" : item.status === "GREEN" ? "OPTIMAL" : "PARITY"}
                     </div>
                  </td>
                  <td className="py-8 px-8 text-right">
                     <button className="p-3 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all shadow-sm border border-transparent hover:border-border">
                        <MoreVertical className="w-5 h-5" />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] px-10 gap-6">
        <div>Synchronized moments ago • Ref 1254-PP</div>
        <div className="flex items-center gap-6">
          <button className="hover:text-primary transition-colors disabled:opacity-30" disabled>Previous Page</button>
          <div className="flex items-center gap-3">
             {[1, 2, 3].map(p => (
                <span key={p} className={cn(
                   "w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer font-black text-sm",
                   p === 1 ? "bg-primary text-white shadow-xl shadow-primary/20" : "bg-card border border-border hover:bg-muted text-foreground"
                )}>{p}</span>
             ))}
          </div>
          <button className="hover:text-primary transition-colors">Next Analytics</button>
        </div>
      </div>

      <BulkUpdateDrawer
        isOpen={isUpdateDrawerOpen}
        onClose={() => setIsUpdateDrawerOpen(false)}
        selectedCount={selectedItems.length}
        onExecute={async (logic) => {
          await fetch("/api/price-update/bulk", {
            method: "POST",
            body: JSON.stringify({
              product_ids: selectedItems,
              logic_type: logic.logicType,
              value: logic.value,
              min_price: logic.minPrice
            })
          });
          setIsUpdateDrawerOpen(false);
          setSelectedItems([]);
        }}
      />
    </div>
  );
}
