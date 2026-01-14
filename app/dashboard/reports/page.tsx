"use client";

import { useState } from "react";
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
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const toggleSelectAll = () => {
    if (selectedItems.length === mockData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(mockData.map(i => i.id));
    }
  };

  const toggleItem = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
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
          <button className="bg-secondary text-secondary-foreground text-sm font-semibold px-4 py-2 rounded-md hover:bg-secondary/80 transition-all border border-border flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
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

        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 border border-border rounded-md whitespace-nowrap">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-danger" />
                 <span className="text-[10px] font-bold uppercase text-danger">At Risk: {mockData.filter(d => d.status === "RED").length}</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-success" />
                 <span className="text-[10px] font-bold uppercase text-success">Optimal: {mockData.filter(d => d.status === "GREEN").length}</span>
              </div>
           </div>

           <button className="p-2 bg-background border border-border rounded-md text-muted-foreground hover:text-foreground transition-all">
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
                      selectedItems.length === mockData.length
                        ? "bg-primary border-primary"
                        : "border-border bg-background"
                    )}
                  >
                    {selectedItems.length === mockData.length && <Check className="w-3 h-3 text-white" />}
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
              {mockData.map((item) => (
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
                      {selectedItems.includes(item.id) && <Check className="w-3 h-3 text-white" />}
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
          // Logic implementation...
          setIsUpdateDrawerOpen(false);
          setSelectedItems([]);
        }}
      />

      <ProductDetailDrawer
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
      />
    </div>
  );
}
