"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Search,
  LayoutGrid,
  List,
  AlertCircle,
  Database,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CompetitorPricingRules } from "@/components/competitor-pricing-rules";

// Fast loading techniques being used:
// 1. Image lazy loading
// 2. CSS visibility properties prior to paint
// 3. Request AbortControllers for cleanup
// 4. Client-side caching & Skeletons

interface Product {
  id: string;
  sku: string;
  title: string;
  image: string | null;
  price: number;
  inStock: boolean;
  brand: string;
  category: string;
  url: string | null;
  lastScrapedAt: string;
  matchCount: number;
}

interface Competitor {
  id: string;
  name: string;
  url: string;
  isAdvancedProtected: boolean;
  totalScrapedProductsCount: number;
  currency?: string;
}

export default function CompetitorDetailClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 0 });
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [error, setError] = useState<string | null>(null);
  const [showRulesTab, setShowRulesTab] = useState(false);

  // Technique: Optimized Data Fetching with AbortController
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/v1/competitors/${id}/products?page=${pagination.page}&limit=${pagination.limit}`,
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error("Failed to load competitor data.");

        const data = await res.json();

        if (!isMounted) return;

        setCompetitor(data.competitor);
        setProducts(data.products || []);

        if (data.pagination) {
          setPagination(prev => ({
            ...prev,
            page: Number(data.pagination.page) || prev.page,
            limit: Number(data.pagination.limit) || prev.limit,
            total: Number(data.pagination.total) || 0,
            totalPages: Number(data.pagination.totalPages) || 0,
          }));
        }
      } catch (err: any) {
        if (!isMounted) return;
        if (err.name !== "AbortError") {
          console.error("Fetch Error:", err);
          setError(err.message || "Something went wrong fetching the data.");
          toast.error("Error loading products");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [id, pagination.page, pagination.limit]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination(p => ({ ...p, page: newPage }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 sticky top-0 bg-background/80 backdrop-blur-md z-10 py-4 border-b border-border/50">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/competitors">
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            {loading && !competitor ? (
              <Skeleton className="h-8 w-64 mb-1" />
            ) : (
              <h2 className="text-2xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {competitor?.name}
              </h2>
            )}
            {loading && !competitor ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <a
                href={competitor?.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 w-fit"
              >
                <ExternalLink className="h-3 w-3" />
                {competitor?.url}
              </a>
            )}
          </div>

          {!loading && competitor && (
            <div className="flex items-center gap-2">
              {competitor.isAdvancedProtected ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20">
                  <ShieldAlert className="w-4 h-4 text-warning" />
                  <span className="text-xs font-bold text-warning uppercase tracking-wide">
                    Advanced Protection
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
                  <ShieldCheck className="w-4 h-4 text-success" />
                  <span className="text-xs font-bold text-success uppercase tracking-wide">
                    Standard Access
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-xs flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-lg text-primary">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1 mt-0">Total Products</p>
            {loading && !competitor ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-3xl font-bold tracking-tight">
                {competitor?.totalScrapedProductsCount.toLocaleString() || 0}
              </p>
            )}
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-xs flex items-center gap-4">
          <div className="bg-blue-500/10 p-3 rounded-lg text-blue-500">
            <LinkIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1 mt-0">Linked Inventory</p>
            {loading && !competitor ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-3xl font-bold tracking-tight">
                {products.reduce((acc, p) => acc + (p.matchCount > 0 ? 1 : 0), 0) > 0 ? "~" : "0"}
                <span className="text-sm font-normal text-muted-foreground ml-2">est. visible</span>
              </p>
            )}
          </div>
        </div>

        {/* Placeholder for future scope requested by user (Pricing Rules) */}
        {!showRulesTab ? (
          <div className="bg-card border border-border/50 rounded-xl p-6 shadow-xs flex items-center justify-between group hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setShowRulesTab(true)}>
            <div>
              <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                Pricing Rules <Badge variant="secondary" className="text-[9px]">Beta</Badge>
              </p>
              <p className="text-xs text-muted-foreground">Configure manual matching overrides & pricing strategies for this specific competitor.</p>
            </div>
            <Button variant="secondary" size="sm" className="shrink-0" onClick={(e) => { e.stopPropagation(); setShowRulesTab(true); }}>
              Configure
            </Button>
          </div>
        ) : (
          <div className="bg-card border border-border/50 rounded-xl p-6 shadow-xs flex items-center justify-between group hover:bg-muted/50 transition-colors cursor-pointer border-primary/40" onClick={() => setShowRulesTab(false)}>
            <div>
              <p className="text-sm font-bold text-primary mb-1">Pricing Rules Panel Active</p>
              <p className="text-xs text-muted-foreground">Click to close configuration panel and return to stats view.</p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 text-muted-foreground hover:bg-muted">
              Close Panel
            </Button>
          </div>
        )}
      </div>

      {showRulesTab && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <CompetitorPricingRules siteId={id} />
        </div>
      )}

      {/* PRODUCTS VIEW */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            Scraped Inventory
            {!loading && <Badge variant="secondary" className="ml-2 font-mono">{pagination.total.toLocaleString()}</Badge>}
          </h3>
          <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border border-border/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("list")}
              className={cn("h-8 px-2 text-xs", viewMode === "list" && "bg-background shadow-xs")}
            >
              <List className="w-4 h-4 mr-1" /> List
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("grid")}
              className={cn("h-8 px-2 text-xs", viewMode === "grid" && "bg-background shadow-xs")}
            >
              <LayoutGrid className="w-4 h-4 mr-1" /> Grid
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 flex flex-col items-center justify-center text-center gap-2 py-10">
            <AlertCircle className="w-8 h-8 text-danger" />
            <p className="font-semibold text-danger">Failed to load data</p>
            <p className="text-sm text-danger/80">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setPagination(p => ({ ...p }))} className="mt-4">
              Try Again
            </Button>
          </div>
        )}

        {loading && products.length === 0 ? (
          /* SKELETON LOADER */
          <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-3"}>
            {Array.from({ length: viewMode === "grid" ? 12 : 6 }).map((_, i) => (
              viewMode === "grid" ? (
                <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-4">
                  <Skeleton className="w-full aspect-square rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-10" />
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-center gap-4 bg-card border border-border rounded-xl p-4">
                  <Skeleton className="w-16 h-16 rounded-md shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <div className="space-y-2 items-end flex flex-col">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
              )
            ))}
          </div>
        ) : !loading && products.length === 0 && !error ? (
          /* EMPTY STATE */
          <div className="border border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center bg-muted/10">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold">No products found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mt-1">
              {competitor?.totalScrapedProductsCount === 0
                ? "The crawler hasn't found any products yet, or the sync hasn't completed."
                : "No products matched the current filters."}
            </p>
          </div>
        ) : (
          /* DATA VIEW */
          <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-2"}>
            {products.map((product) => (
              viewMode === "grid" ? (
                <div key={product.id} className="group bg-card hover:bg-muted/30 border border-border/80 hover:border-primary/30 rounded-xl overflow-hidden transition-all duration-300 flex flex-col shadow-xs hover:shadow-md relative">
                  {/* Technique: Native browser lazy loading + structural fast-paint */}
                  <div className="aspect-square bg-muted/20 relative p-4 flex items-center justify-center overflow-hidden border-b border-border/50">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.title}
                        loading="lazy"
                        className="object-contain w-full h-full mix-blend-multiply dark:mix-blend-normal transform group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground opacity-30">
                        <List className="w-10 h-10 mb-2" />
                        <span className="text-xs font-bold uppercase tracking-wider">No Image</span>
                      </div>
                    )}
                    {product.matchCount > 0 && (
                      <div className="absolute top-2 right-2 bg-success text-success-foreground text-[10px] uppercase font-black px-2 py-1 rounded shadow-sm flex items-center gap-1">
                        <LinkIcon className="w-3 h-3" /> Linked ({product.matchCount})
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    <div className="mb-auto">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
                        <span>{product.brand}</span>
                        {product.sku && <span className="font-mono text-[9px] opacity-70">SKU: {product.sku}</span>}
                      </div>
                      <h4 className="font-semibold text-sm leading-tight line-clamp-2 text-foreground/90 group-hover:text-foreground transition-colors" title={product.title}>
                        {product.title}
                      </h4>
                    </div>

                    <div className="mt-4 flex items-end justify-between pt-4 border-t border-border/40">
                      <div>
                        {product.inStock ? (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-success uppercase">
                            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                            In Stock
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-danger uppercase opacity-80">
                            <div className="w-1.5 h-1.5 rounded-full bg-danger" />
                            Out of Stock
                          </div>
                        )}
                        <div className="text-lg font-bold font-mono tracking-tight text-foreground mt-0.5">
                          {competitor?.currency || "$"}{product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>

                      {product.url && (
                        <Button variant="secondary" size="icon" className="h-7 w-7 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                          <a href={product.url} target="_blank" rel="noreferrer" title="View Source">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div key={product.id} className="group bg-card hover:bg-muted/50 border border-border/80 hover:border-primary/30 rounded-lg p-3 transition-all duration-200 flex items-center gap-4 shadow-xs">
                  <div className="w-14 h-14 bg-white dark:bg-black/50 rounded-md border border-border/50 p-1 shrink-0 flex items-center justify-center overflow-hidden">
                    {product.image ? (
                      <img src={product.image} alt="" loading="lazy" className="w-full h-full object-contain" />
                    ) : (
                      <Search className="w-4 h-4 text-muted-foreground/30" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{product.brand}</span>
                      {product.matchCount > 0 && (
                        <span className="bg-success/15 text-success text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase flex items-center gap-1">
                          <LinkIcon className="w-2.5 h-2.5" /> Linked
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-sm text-foreground truncate" title={product.title}>
                      {product.title}
                    </h4>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5 opacity-70">
                      {product.sku && `SKU: ${product.sku} • `}{product.category}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-foreground">
                      {competitor?.currency || "$"}{product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    {product.inStock ? (
                      <span className="text-[10px] font-bold text-success uppercase tracking-wider">In Stock</span>
                    ) : (
                      <span className="text-[10px] font-bold text-danger uppercase tracking-wider">Out of Stock</span>
                    )}
                  </div>

                  {product.url && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 ml-2 shrink-0 opacity-40 group-hover:opacity-100" asChild>
                      <a href={product.url} target="_blank" rel="noreferrer" title="View Source">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </div>
              )
            ))}
          </div>
        )}

        {/* PAGINATION */}
        {!error && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/50 pt-4 mt-6">
            <div className="text-xs text-muted-foreground font-medium">
              Showing <span className="text-foreground font-bold">{Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}</span> to <span className="text-foreground font-bold">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="text-foreground font-bold">{pagination.total.toLocaleString()}</span> products
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="h-8 text-xs font-semibold"
              >
                Previous
              </Button>

              <div className="flex items-center gap-1 mx-2">
                <span className="text-xs font-bold px-2.5 py-1 bg-muted rounded-md">{pagination.page}</span>
                <span className="text-xs text-muted-foreground font-medium">/ {pagination.totalPages}</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="h-8 text-xs font-semibold"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
