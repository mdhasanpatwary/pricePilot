"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Download,
  MoreVertical,
  ArrowUpDown,
  Zap,
  Check,
  TrendingDown,
  TrendingUp,
  History,
  Activity,
  ArrowRight,
  Globe,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import BulkUpdateDrawer from "@/components/dashboard/bulk-update-drawer";
import ProductDetailDrawer from "@/components/dashboard/product-detail-drawer";



import { Product, Stats } from "@/lib/types";


export default function PriceReportPage() {
  const [data, setData] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats>({ atRisk: 0, optimal: 0, parity: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filterSegment, setFilterSegment] = useState<string>("ALL");
  const [isUpdateDrawerOpen, setIsUpdateDrawerOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/products");
      const result = await res.json();
      if (res.ok) {
        setData(result.products);
        setStats(result.stats);
      } else {
        toast.error("Failed to load products");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredData = data.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
                         item.sku.toLowerCase().includes(search.toLowerCase());

    if (filterSegment === "ALL") return matchesSearch;

    const segmentMap: Record<string, string> = {
      "CHEAPEST": "GREEN",
      "EXPENSIVE": "RED",
      "MATCHED": "NEUTRAL"
    };

    return matchesSearch && item.status === segmentMap[filterSegment];
  });

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredData.map(i => i.id));
    }
  };

  const toggleItem = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleExport = () => {
    window.location.href = "/api/exports/products";
    toast.success("Preparing your CSV export...");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/imports/products", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();
        toast.success(`Import complete: ${result.created} created, ${result.updated} updated.`);
        fetchProducts();
      } else {
        toast.error("Failed to import products");
      }
    } catch (error) {
      toast.error("Network error during import");
    } finally {
      setIsImporting(false);
      // Reset input
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground text-sm">Compare your prices against live market data.</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedItems.length > 0 && (
            <button
              onClick={() => setIsUpdateDrawerOpen(true)}
              className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-md hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Zap className="w-4 h-4 fill-current" />
              Sync {selectedItems.length} Products
            </button>
          )}
           <button
             onClick={handleExport}
             className="bg-secondary text-secondary-foreground text-sm font-semibold px-4 py-2 rounded-md hover:bg-secondary/80 transition-all border border-border flex items-center gap-2"
           >
            <Download className="w-4 h-4" />
            Export
          </button>

          <label className="bg-primary/5 text-primary text-sm font-semibold px-4 py-2 rounded-md border border-primary/10 hover:bg-primary/10 transition-all flex items-center gap-2 cursor-pointer transition-all active:scale-95">
            {isImporting ? (
               <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
               <Filter className="w-4 h-4 rotate-180" />
            )}
            Import
            <input type="file" className="hidden" accept=".csv" onChange={handleImport} disabled={isImporting} />
          </label>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by SKU, Brand, or Model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background border border-border rounded-md py-2 pl-10 pr-4 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm font-medium"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
           <div className="flex items-center gap-1.5 p-1 bg-muted/30 border border-border rounded-lg whitespace-nowrap">
             <button
               onClick={() => setFilterSegment("ALL")}
               className={cn(
                 "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                 filterSegment === "ALL" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
               )}
             >
               All
             </button>
             <button
               onClick={() => setFilterSegment("CHEAPEST")}
               className={cn(
                 "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                 filterSegment === "CHEAPEST" ? "bg-success/10 text-success shadow-sm" : "text-muted-foreground hover:text-foreground"
               )}
             >
               <div className="w-1.5 h-1.5 rounded-full bg-success" />
               Cheapest ({stats.optimal})
             </button>
             <button
               onClick={() => setFilterSegment("MATCHED")}
               className={cn(
                 "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                 filterSegment === "MATCHED" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
               )}
             >
               <div className="w-1.5 h-1.5 rounded-full bg-border" />
               Matched ({stats.parity})
             </button>
             <button
               onClick={() => setFilterSegment("EXPENSIVE")}
               className={cn(
                 "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                 filterSegment === "EXPENSIVE" ? "bg-danger/10 text-danger shadow-sm" : "text-muted-foreground hover:text-foreground"
               )}
             >
               <div className="w-1.5 h-1.5 rounded-full bg-danger" />
               Expensive ({stats.atRisk})
             </button>
           </div>

           <button className="p-2 bg-background border border-border rounded-md text-muted-foreground hover:text-foreground transition-all shrink-0">
              <Filter className="w-4 h-4" />
           </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <th className="py-4 px-6 w-12 text-center">
                   <div
                    onClick={toggleSelectAll}
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer mx-auto",
                      selectedItems.length === filteredData.length
                        ? "bg-primary border-primary"
                        : "border-border bg-background"
                    )}
                  >
                    {selectedItems.length === filteredData.length && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                </th>
                <th className="py-4 px-6 min-w-[280px]">Product / SKU</th>
                <th className="py-4 px-6">Your Price</th>
                <th className="py-4 px-6">Market</th>
                <th className="py-4 px-6 text-center">Gap</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-muted-foreground animate-pulse">
                    Loading your catalog...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-muted-foreground">
                    No products found.
                  </td>
                </tr>
              ) : filteredData.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedProduct(item)}
                  className={cn(
                    "border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer",
                    selectedItems.includes(item.id) ? "bg-primary/[0.02]" : ""
                  )}
                >
                  <td className="py-4 px-6 text-center">
                    <div
                      onClick={(e) => toggleItem(e, item.id)}
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer mx-auto",
                        selectedItems.includes(item.id)
                          ? "bg-primary border-primary"
                          : "border-border bg-background"
                      )}
                    >
                      {selectedItems.includes(item.id) && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                       <div className={cn(
                         "w-10 h-10 rounded-md flex items-center justify-center text-[10px] font-bold",
                         item.stock === 0 ? "bg-danger/10 text-danger border border-danger/20" :
                         item.stock < 10 ? "bg-warning/10 text-warning border border-warning/20" :
                         "bg-muted border border-border text-muted-foreground"
                       )}>
                          {item.stock}
                       </div>
                       <div>
                          <div className="text-foreground group-hover:text-primary transition-colors">{item.title}</div>
                          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-tight flex items-center gap-1.5 mt-0.5">
                             {item.sku}
                             <div className="w-1 h-1 rounded-full bg-border" />
                             <span className={item.stock > 0 ? "text-success/70" : "text-danger/70"}>
                               {item.stock > 0 ? "In Stock" : "Out of Stock"}
                             </span>
                          </div>
                       </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-semibold">${item.yourPrice.toFixed(2)}</span>
                  </td>
                  <td className="py-4 px-6 text-muted-foreground">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                       ${item.compPrice.toFixed(2)}
                       <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>
                    <div className="text-[10px] font-medium flex items-center gap-1 mt-0.5 tracking-tight">
                       via {item.match}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border",
                      item.diff < 0 ? "bg-danger/5 text-danger border-danger/10" :
                      item.diff > 0 ? "bg-success/5 text-success border-success/10" : "bg-muted text-muted-foreground border-border"
                    )}>
                      {item.diff < 0 ? <TrendingDown className="w-3 h-3" /> : item.diff > 0 ? <TrendingUp className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                      {item.diff > 0 ? "+" : ""}{item.diff.toFixed(2)}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                     <div className={cn(
                       "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                       item.status === "RED" ? "bg-danger/10 text-danger border-danger/20" :
                       item.status === "GREEN" ? "bg-success/10 text-success border-success/20" :
                       "bg-muted text-muted-foreground border-border"
                     )}>
                       {item.status === "RED" ? "Underbid" : item.status === "GREEN" ? "Optimal" : "Parity"}
                     </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                     <button className="p-2 hover:bg-muted rounded-md text-muted-foreground transition-all">
                        <MoreVertical className="w-4 h-4" />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-4">
        <div>Ref: 1254-PP</div>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:text-foreground transition-colors disabled:opacity-30" disabled>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1">
             {[1, 2, 3].map(p => (
                <button key={p} className={cn(
                   "w-8 h-8 rounded-md flex items-center justify-center transition-all text-sm",
                   p === 1 ? "bg-primary text-primary-foreground font-bold shadow-sm" : "bg-background border border-border hover:bg-muted text-foreground"
                )}>{p}</button>
             ))}
          </div>
          <button className="p-2 hover:text-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <BulkUpdateDrawer
        isOpen={isUpdateDrawerOpen}
        onClose={() => setIsUpdateDrawerOpen(false)}
        selectedCount={selectedItems.length}
        onExecute={async (logic) => {
          // Simulated API call
          await new Promise(resolve => setTimeout(resolve, 2000));
          toast.success(`Successfully updated ${selectedItems.length} products`);
          setIsUpdateDrawerOpen(false);
          setSelectedItems([]);
          fetchProducts();
        }}
      />

      <ProductDetailDrawer
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        onExecute={async (id) => {
          await new Promise(resolve => setTimeout(resolve, 1500));
          toast.success("Pilot adjustment applied successfully");
          setSelectedProduct(null);
          fetchProducts();
        }}
      />
    </div>
  );
}
