"use client";

import { X, Check, Minus, Zap, Download } from "lucide-react";
import Image from "next/image";
import { Product } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ProductComparisonDrawerProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  currency: string;
}

export default function ProductComparisonDrawer({
  products,
  isOpen,
  onClose,
  currency,
}: ProductComparisonDrawerProps) {
  if (products.length === 0) return null;

  // Extract all unique specification keys
  const allSpecKeys = Array.from(
    new Set(
      products.flatMap((p) => Object.keys(p.specifications || {}))
    )
  ).sort();

  // Helper to format spec value
  const formatSpec = (val: string | undefined) => {
    if (!val) return <Minus className="w-4 h-4 text-muted-foreground opacity-30" />;
    const lowerVal = String(val).toLowerCase();
    if (lowerVal === "yes" || lowerVal === "true") return <Check className="w-4 h-4 text-green-500" />;
    if (lowerVal === "no" || lowerVal === "false") return <X className="w-4 h-4 text-red-500" />;
    return <span className="text-[11px] font-medium">{val}</span>;
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] transition-opacity duration-500",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-5xl bg-card border-l border-border z-[101] shadow-2xl transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="p-8 md:p-10 border-b border-border flex items-start justify-between bg-muted/20">
          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Zap className="w-8 h-8 text-primary" />
              Product Comparison
            </h2>
            <p className="text-muted-foreground font-medium">
              Comparing {products.length} tech products across {allSpecKeys.length + 2} attributes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-background hover:bg-muted border border-border rounded-2xl transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-card border-b">
              <tr>
                <th className="p-6 w-56 min-w-[220px] text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground border-r">
                  Feature / Specs
                </th>
                {products.map((p) => (
                  <th key={p.id} className="p-6 min-w-[240px] border-r align-top text-left">
                    <div className="space-y-4">
                      <div className="relative aspect-square w-24 rounded-2xl overflow-hidden border-2 border-border bg-muted shadow-sm">
                        {p.image ? (
                          <Image
                            src={p.image}
                            alt={p.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full"> 
                            <Zap className="opacity-20 w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-[14px] font-black line-clamp-2 h-10 leading-[1.2]">
                          {p.title}
                        </h4>
                        <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[9px] font-bold uppercase rounded-md border border-border">
                          {p.sku || "NO-SKU"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 pt-2 border-t">
                        <span className="text-2xl font-black text-primary">
                          {formatCurrency(p.yourPrice, currency)}
                        </span>
                        <Badge variant={p.inStock ? "default" : "destructive"} className="text-[10px] w-fit">
                          {p.inStock ? "In Stock" : "Out of Stock"}
                        </Badge>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {/* Product Info Segment */}
              <tr className="bg-muted/10">
                <td className="p-4 pl-6 text-[10px] font-black uppercase tracking-widest text-primary border-r">Market Intelligence</td>
                {products.map(p => <td key={p.id} className="border-r"></td>)}
              </tr>
              <tr>
                <td className="p-4 pl-6 text-xs font-black text-muted-foreground border-r bg-muted/5">Brand</td>
                {products.map((p) => (
                  <td key={p.id} className="p-4 border-r">
                    <div className="flex justify-center">
                      <Badge variant="outline" className="text-[10px] font-black uppercase px-3">{p.brand || "Generic"}</Badge>
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 pl-6 text-xs font-black text-muted-foreground border-r bg-muted/5">Category</td>
                {products.map((p) => (
                  <td key={p.id} className="p-4 border-r text-center text-xs font-bold italic">
                    {p.category}
                  </td>
                ))}
              </tr>

              {/* Dynamic Tech Specs Segment */}
              <tr className="bg-muted/10">
                <td className="p-4 pl-6 text-[10px] font-black uppercase tracking-widest text-primary border-r">Field Data Specs</td>
                {products.map(p => <td key={p.id} className="border-r"></td>)}
              </tr>
              {allSpecKeys.map((key) => (
                <tr key={key} className="hover:bg-muted/20 transition-all duration-300">
                  <td className="p-4 pl-6 text-xs font-black text-muted-foreground border-r bg-muted/5 capitalize tracking-tight">
                    {key.replace(/_/g, ' ')}
                  </td>
                  {products.map((p) => (
                    <td key={p.id} className="p-4 border-r">
                      <div className="flex justify-center">
                        {formatSpec((p.specifications as any)?.[key])}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-8 border-t border-border bg-muted/10 flex justify-end gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <button 
            onClick={onClose}
            className="px-8 py-4 bg-muted hover:bg-muted/80 text-foreground font-black rounded-2xl border border-border transition-all uppercase tracking-widest text-[10px]"
          >
            Collapse Comparison
          </button>
          <button 
            onClick={() => window.print()} 
            className="px-8 py-4 premium-gradient text-primary-foreground font-black rounded-2xl shadow-xl shadow-primary/20 flex items-center gap-3 uppercase tracking-widest text-[10px] transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            Generate PDF
          </button>
        </div>
      </div>
    </>
  );
}
