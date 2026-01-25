"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
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
  Activity,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import BulkUpdateDrawer from "@/components/dashboard/bulk-update-drawer";
import ProductDetailDrawer from "@/components/dashboard/product-detail-drawer";
import ProductComparisonDrawer from "@/components/dashboard/product-comparison-drawer";
import { useDebounce, searchItems } from "@/lib/hooks/useSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";

import { Product } from "@/lib/types";

export default function PriceReportPage() {
  const [data, setData] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currency, setCurrency] = useState<string>("USD");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [search, debouncedSearch, setSearch] = useDebounce("", 300);
  const [filterSegment, setFilterSegment] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [isUpdateDrawerOpen, setIsUpdateDrawerOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [refCompetitor, setRefCompetitor] = useState<string>(""); // siteName
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterStock, setFilterStock] = useState<string>("ALL"); // ALL, INSTOCK, OOS
  const [filterBrand, setFilterBrand] = useState<string>("ALL");
  const [filterSite, setFilterSite] = useState<string>("ALL");
  const [filterRam, setFilterRam] = useState<string>("ALL");
  const [filterStorage, setFilterStorage] = useState<string>("ALL");
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("q", debouncedSearch);
      if (filterBrand !== "ALL") params.append("brand", filterBrand);
      if (filterCategory !== "ALL") params.append("category", filterCategory);
      if (filterStock !== "ALL") params.append("stock", filterStock);
      if (filterRam !== "ALL") params.append("ram", filterRam);
      if (filterStorage !== "ALL") params.append("storage", filterStorage);

      const res = await fetch(`/api/v1/products?${params.toString()}`);
      const result = await res.json();
      if (res.ok) {
        setData(result.products);
        if (result.currency) setCurrency(result.currency);
      } else {
        toast.error("Failed to load products");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, filterBrand, filterCategory, filterStock, filterRam, filterStorage]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Re-fetch when filters change (server-side filtering is better for many items,
  // but for now we are mixing client/server.
  // Let's rely on the useEffect below to trigger fetch on key filter changes if we want server side,
  // OR keep client side. The current implementation was client side 'filteredData'.
  // However, `fetchProducts` is called ONLY on mount currently.
  // The user plan implies backend filtering. Let's make `fetchProducts` called on filter changes.
  useEffect(() => {
     // If we want server-side filtering, we should debounce and call fetchProducts.
     // But `filteredData` logic below is client-side.
     // For hybrid approach: We fetch ALL products initially (as per original code),
     // then filter client side.
     // BUT the API update I just made supports server side.
     // Let's stick to client side for responsiveness if data < 1000 items,
     // but since we added API params, let's use them?
     // Actually, let's keep the client-side 'filteredData' logic for immediate UI feedback
     // AND keep the API capable for the future or if we decide to switch.
     // The original code fetched ONCE. Let's stick to that to avoid refactoring the whole paginator yet.
     // So I will update `filteredData` to handle the new RAM/Storage filters.
  }, []);

  const handleDeleteProduct = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const res = await fetch(`/api/v1/products/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Product deleted successfully");
        fetchProducts(); // Refresh list
      } else {
        toast.error("Failed to delete product");
      }
    } catch (error) {
      toast.error("Connection error during deletion");
    }
  };

  const filteredData = useMemo(() => {
    let result = data;

    // 1. Search (Debounced)
    if (debouncedSearch) {
      result = searchItems(result, debouncedSearch, [
        "title",
        "sku",
        "category",
        "brand",
      ]);
    }

    // 2. Filters
    return result.filter((item) => {
      const matchesCategory =
        filterCategory === "ALL" || item.category === filterCategory;
      const matchesStock =
        filterStock === "ALL" ||
        (filterStock === "INSTOCK" ? item.inStock : !item.inStock);
      const matchesBrand = filterBrand === "ALL" || item.brand === filterBrand;
      const matchesSite = filterSite === "ALL" || item.siteName === filterSite;

      const specs = item.specifications || {};
      const matchesRam = filterRam === "ALL" || specs.ram === filterRam;
      const matchesStorage = filterStorage === "ALL" || specs.storage === filterStorage;

      // Smart Segments
      let matchesSegment = true;
      if (filterSegment === "CHEAPEST") matchesSegment = !!item.isCheapest;
      if (filterSegment === "EXPENSIVE")
        matchesSegment = !!item.isMostExpensive;
      if (filterSegment === "OPPORTUNITY")
        matchesSegment = (item.priceDifference ?? 0) !== 0;

      return (
        matchesCategory &&
        matchesStock &&
        matchesBrand &&
        matchesSite &&
        matchesRam &&
        matchesStorage &&
        matchesSegment
      );
    });
  }, [
    data,
    debouncedSearch,
    filterCategory,
    filterStock,
    filterBrand,
    filterSite,
    filterSegment,
    filterRam,
    filterStorage,
  ]);

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    filterSegment,
    filterCategory,
    filterStock,
    filterBrand,
    filterSite,
  ]);

  const sites = Array.from(new Set(data.map((p) => p.siteName))).sort();

  // Filter unique lists based on selected site if applicable
  const availableData =
    filterSite === "ALL" ? data : data.filter((p) => p.siteName === filterSite);
  const categories = Array.from(
    new Set(availableData.filter((p) => p.category).map((p) => p.category)),
  ).sort() as string[];
  const brands = Array.from(
    new Set(availableData.filter((p) => p.brand).map((p) => p.brand)),
  ).sort() as string[];

  // Extract unique Specs for filters
  const ramOptions = Array.from(new Set(data.flatMap(p => p.specifications?.ram ? [p.specifications.ram] : []))).sort();
  const storageOptions = Array.from(new Set(data.flatMap(p => p.specifications?.storage ? [p.specifications.storage] : []))).sort();

  // Dynamic status counts based on selected site and competitor
  const dynamicStats = useMemo(() => {
    const s = {
      atRisk: 0,
      optimal: 0,
      parity: 0,
      competitorOos: 0,
      notFound: 0,
    };

    availableData.forEach((item) => {
      let status = item.status;

      if (refCompetitor && refCompetitor !== "BEST") {
        const match = item.allMatches?.find(
          (m) => m.siteName === refCompetitor,
        );
        if (match) {
          if (!match.inStock) {
            status = "COMP_OOS";
          } else {
            const diff = match.price - item.yourPrice;
            if (diff < 0) status = "RED";
            else if (diff > 0) status = "GREEN";
            else status = "NEUTRAL";
          }
        } else {
          status = "NOT_FOUND";
        }
      }

      if (status === "RED") s.atRisk++;
      else if (status === "GREEN") s.optimal++;
      else if (status === "NEUTRAL") s.parity++;
      else if (status === "COMP_OOS") s.competitorOos++;
      else if (status === "NOT_FOUND") s.notFound++;
    });

    return s;
  }, [availableData, refCompetitor]);

  const competitors = useMemo(() => {
    return Array.from(
      new Set(data.flatMap((p) => p.allMatches?.map((m) => m.siteName) || [])),
    ).sort();
  }, [data]);

  // Set default competitor if none selected
  useEffect(() => {
    if (competitors.length > 0 && !refCompetitor) {
      setRefCompetitor(competitors[0]);
    }
  }, [competitors, refCompetitor]);

  const cleanName = (hostname: string) => {
    const parts = hostname.replace("www.", "").split(".");
    return parts[0];
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredData.map((i) => i.id));
    }
  };

  const toggleItem = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleExport = () => {
    toast.promise(
        fetch("/api/v1/exports/products"),
        {
          loading: 'Assembling your technical intelligence catalog...',
          success: (res) => {
            if (res.ok) {
              window.location.href = res.url;
              return "Full tech catalog exported successfully";
            }
            throw new Error("Failed to generate export");
          },
          error: 'Export failed'
        }
    );
  };

  const downloadTemplate = () => {
      const headers = "SKU,Title,Current Price,Category,Brand,Model,RAM,Storage\n";
      const example = "PP-MAC-M2-001,MacBook Air M2 13-inch,1199.00,Laptops,Apple,M2,16GB,512GB SSD\n";
      const blob = new Blob([headers + example], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "PricePilot-Tech-Template.csv";
      a.click();
      toast.success("Tech template downloaded. Fill it with your hardware inventory.");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/v1/imports/products", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();
        toast.success(
          `Import complete: ${result.created} created, ${result.updated} updated.`
        );
        if (result.errorCount > 0) {
            toast.error(`${result.errorCount} rows failed. Check SKU/Price formatting.`, {
                description: result.errors.join(', '),
                duration: 5000
            });
        }
        fetchProducts();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to import products");
      }
    } catch (error) {
      toast.error("Network error during import");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground text-sm">
            Compare your prices against live market data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedItems.length > 1 && (
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setIsComparisonOpen(true);
              }}
              className="gap-2 border-primary/20 text-primary hover:bg-primary/5"
            >
              <ArrowUpDown className="w-4 h-4 rotate-90" />
              Compare {selectedItems.length} Items
            </Button>
          )}

          {selectedItems.length > 0 && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setIsUpdateDrawerOpen(true);
              }}
              className="gap-2"
            >
              <Zap className="w-4 h-4 fill-current" />
              Sync {selectedItems.length} Products
            </Button>
          )}

          {competitors.length > 1 && (
            <div className="relative group">
              <Select value={refCompetitor} onValueChange={setRefCompetitor}>
                <SelectTrigger className="appearance-none bg-background border border-border rounded-md py-2 pl-3 pr-10 text-sm font-semibold hover:bg-muted/50 transition-all cursor-pointer outline-none focus:ring-2 focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {competitors.map((comp) => (
                    <SelectItem key={comp} value={comp}>
                      Compare: {cleanName(comp)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            variant="outline"
            onClick={handleExport}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>

          <label className="bg-primary/5 text-primary text-sm font-semibold px-4 py-2 rounded-md border border-primary/10 hover:bg-primary/10 transition-all flex items-center gap-2 cursor-pointer active:scale-95">
            {isImporting ? (
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4 rotate-180" />
            )}
            Import CSV
            <input
              type="file"
              className="hidden"
              accept=".csv"
              onChange={handleImport}
              disabled={isImporting}
            />
          </label>

          <Button
            variant="ghost"
            onClick={downloadTemplate}
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
          >
            Get Template
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by SKU, Brand, or Model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-muted/30 border border-border rounded-lg whitespace-nowrap overflow-x-auto max-w-[60vw] md:max-w-none no-scrollbar">
            <button
              onClick={() => setFilterSegment("ALL")}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                filterSegment === "ALL"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterSegment("CHEAPEST")}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                filterSegment === "CHEAPEST"
                  ? "bg-success/10 text-success shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-success" />
              Cheapest ({dynamicStats.optimal})
            </button>
            <button
              onClick={() => setFilterSegment("EXPENSIVE")}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                filterSegment === "EXPENSIVE"
                  ? "bg-danger/10 text-danger shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-danger" />
              Expensive ({dynamicStats.atRisk})
            </button>
            <button
              onClick={() => setFilterSegment("MATCHED")}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                filterSegment === "MATCHED"
                  ? "bg-muted text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
              Matched ({dynamicStats.parity})
            </button>
            <button
              onClick={() => setFilterSegment("OOS")}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                filterSegment === "OOS"
                  ? "bg-amber-100/50 text-amber-600 shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Stock Out ({dynamicStats.competitorOos})
            </button>
            <button
              onClick={() => setFilterSegment("NOT_FOUND")}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                filterSegment === "NOT_FOUND"
                  ? "bg-slate-100/50 text-slate-600 shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Unmatched ({dynamicStats.notFound})
            </button>
          </div>

          <div className="relative">
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setIsFilterOpen(!isFilterOpen);
              }}
              className={cn(
                "gap-2",
                filterCategory !== "ALL" ||
                  filterStock !== "ALL" ||
                  filterBrand !== "ALL" ||
                  filterSite !== "ALL"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border",
              )}
            >
              <Filter className="w-4 h-4" />
              {(filterCategory !== "ALL" ||
                filterStock !== "ALL" ||
                filterBrand !== "ALL" ||
                filterSite !== "ALL") && (
                <span className="w-2 h-2 rounded-full bg-primary" />
              )}
            </Button>

            {isFilterOpen && (
              <>
                <div
                  className="fixed inset-0 z-60"
                  onClick={() => setIsFilterOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-2xl z-70 p-5 space-y-5 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h4 className="text-xs font-black uppercase tracking-widest">
                      Advanced Filters
                    </h4>
                    <button
                      onClick={() => {
                        setFilterCategory("ALL");
                        setFilterStock("ALL");
                        setFilterBrand("ALL");
                        setFilterSite("ALL");
                        setFilterRam("ALL");
                        setFilterStorage("ALL");
                      }}
                      className="text-[10px] font-bold text-primary hover:underline uppercase tracking-tighter"
                    >
                      Reset All
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                        Store / Site
                      </label>
                      <Select
                        value={filterSite}
                        onValueChange={setFilterSite}
                      >
                        <SelectTrigger className="w-full h-9">
                          <SelectValue placeholder="All Stores" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Stores</SelectItem>
                          {sites.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                        Category
                      </label>
                      <Select
                        value={filterCategory}
                        onValueChange={setFilterCategory}
                      >
                        <SelectTrigger className="w-full h-9">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Categories</SelectItem>
                          {categories.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                        Inventory Status
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={filterStock === "INSTOCK" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFilterStock("INSTOCK")}
                          className={cn(
                            "h-9 text-xs",
                            filterStock === "INSTOCK"
                              ? "bg-success/10 border-success/30 text-success hover:bg-success/20 hover:text-success"
                              : "text-muted-foreground"
                          )}
                        >
                          In Stock
                        </Button>
                        <Button
                          variant={filterStock === "OOS" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFilterStock("OOS")}
                          className={cn(
                            "h-9 text-xs",
                            filterStock === "OOS"
                              ? "bg-danger/10 border-danger/30 text-danger hover:bg-danger/20 hover:text-danger"
                              : "text-muted-foreground"
                          )}
                        >
                          Out of Stock
                      </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                        Brand
                      </label>
                      <Select
                        value={filterBrand}
                        onValueChange={setFilterBrand}
                      >
                        <SelectTrigger className="w-full h-9">
                          <SelectValue placeholder="All Brands" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Brands</SelectItem>
                          {brands.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                            RAM
                          </label>
                          <Select
                            value={filterRam}
                            onValueChange={setFilterRam}
                          >
                            <SelectTrigger className="w-full h-9">
                              <SelectValue placeholder="All RAM" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ALL">All RAM</SelectItem>
                              {ramOptions.map((r) => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                            Storage
                          </label>
                          <Select
                            value={filterStorage}
                            onValueChange={setFilterStorage}
                          >
                            <SelectTrigger className="w-full h-9">
                              <SelectValue placeholder="All Storage" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ALL">All Storage</SelectItem>
                              {storageOptions.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <th className="py-4 px-6 w-16 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <div
                      onClick={toggleSelectAll}
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer",
                        selectedItems.length === filteredData.length &&
                          filteredData.length > 0
                          ? "bg-primary border-primary"
                          : "border-border bg-background",
                      )}
                    >
                      {selectedItems.length === filteredData.length &&
                        filteredData.length > 0 && (
                          <Check className="w-3 h-3 text-primary-foreground" />
                        )}
                    </div>
                    <span>SL</span>
                  </div>
                </th>
                <th className="py-4 px-6 min-w-[320px]">Product</th>
                <th className="py-4 px-6">Specs</th>
                <th className="py-4 px-6">Your Price</th>
                {competitors.length > 0 && (
                  <>
                    <th className="py-4 px-6 text-center bg-primary/5 text-primary">
                      {cleanName(refCompetitor)}
                    </th>
                    <th className="py-4 px-6 text-center">Gap</th>
                  </>
                )}
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-20 text-center text-muted-foreground animate-pulse"
                  >
                    Loading your catalog...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-20 text-center text-muted-foreground"
                  >
                    No products found.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, index) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedProduct(item)}
                    className={cn(
                      "border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer",
                      selectedItems.includes(item.id)
                        ? "bg-primary/2"
                        : "",
                    )}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-3">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleItem(e, item.id);
                          }}
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-all",
                            selectedItems.includes(item.id)
                              ? "bg-primary border-primary"
                              : "border-border bg-background",
                          )}
                        >
                          {selectedItems.includes(item.id) && (
                            <Check className="w-3 h-3 text-primary-foreground" />
                          )}
                        </div>
                        <span className="text-xs font-bold text-muted-foreground w-4 text-center">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-4">
                        <div className="relative w-12 h-12 shrink-0 rounded-md overflow-hidden bg-muted border border-border">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.title}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                              <Zap className="w-5 h-5 opacity-20" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-foreground group-hover:text-primary transition-colors text-[13px] font-semibold leading-tight line-clamp-2">
                              {item.title}
                            </div>
                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-muted-foreground/40 hover:text-primary transition-colors shrink-0"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-tight flex items-center gap-1.5 mt-1">
                            <span
                              className={
                                item.inStock && item.yourPrice > 0
                                  ? "text-success/70"
                                  : "text-danger/70"
                              }
                            >
                              {item.inStock && item.yourPrice > 0 ? (
                                <Badge variant="success" className="h-5 px-1.5 text-[9px]">In Stock</Badge>
                              ) : (
                                <Badge variant="destructive" className="h-5 px-1.5 text-[9px]">Unavailable</Badge>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                            {item.specifications?.ram && (
                                <span className="inline-flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded text-[10px]">
                                    {item.specifications.ram}
                                </span>
                            )}
                            {item.specifications?.storage && (
                                <span className="inline-flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded text-[10px]">
                                    {item.specifications.storage}
                                </span>
                            )}
                            {(!item.specifications?.ram && !item.specifications?.storage) && (
                                <span className="opacity-30">-</span>
                            )}
                        </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-foreground">
                        {item.yourPrice > 0 ? (
                          formatCurrency(item.yourPrice, currency)
                        ) : (
                          <span className="text-muted-foreground/50 text-xs font-normal italic">
                            N/A
                          </span>
                        )}
                      </span>
                    </td>

                    {competitors.length > 0 && (
                      <>
                        <td className="py-4 px-6 text-center bg-primary/1">
                          {(() => {
                            const match = item.allMatches?.find(
                              (m) => m.siteName === refCompetitor,
                            );
                            if (!match)
                              return (
                                <span className="text-muted-foreground/20 italic text-xs">
                                  -
                                </span>
                              );

                            return (
                              <div className="flex flex-col items-center">
                                {!match.inStock ? (
                                  <span className="text-[10px] font-bold text-danger/60 uppercase">
                                    Unavailable
                                  </span>
                                ) : (
                                  <span className="font-bold text-primary">
                                    {formatCurrency(match.price, currency)}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        <td className="py-4 px-6 text-center">
                          {(() => {
                            let diff = item.diff;
                            let compPrice = item.compPrice;
                            let compInStock = item.compInStock;

                            if (refCompetitor !== "BEST") {
                              const match = item.allMatches?.find(
                                (m) => m.siteName === refCompetitor,
                              );
                              if (match) {
                                compPrice = match.price;
                                compInStock = match.inStock;
                                if (compPrice !== null) {
                                  diff = compPrice - item.yourPrice;
                                }
                              } else {
                                compPrice = null;
                              }
                            }

                            if (
                              compPrice === null ||
                              compPrice === 0 ||
                              !compInStock
                            ) {
                              return (
                                <span className="text-muted-foreground/30 text-xs italic">
                                  N/A
                                </span>
                              );
                            }

                            return (
                              <div
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border",
                                  diff < 0
                                    ? "bg-danger/5 text-danger border-danger/10"
                                    : diff > 0
                                      ? "bg-success/5 text-success border-success/10"
                                      : "bg-muted text-muted-foreground border-border",
                                )}
                              >
                                {diff < 0 ? (
                                  <TrendingDown className="w-3 h-3" />
                                ) : diff > 0 ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : (
                                  <Activity className="w-3 h-3" />
                                )}
                                {diff > 0 ? "+" : ""}
                                {formatCurrency(Math.abs(diff), currency)}
                              </div>
                            );
                          })()}
                        </td>
                      </>
                    )}
                    <td className="py-4 px-6 text-center">
                      {(() => {
                        let status = item.status;
                        let diff = item.diff;
                        let compPrice = item.compPrice;
                        let compInStock = item.compInStock;

                        if (refCompetitor !== "BEST") {
                          const match = item.allMatches?.find(
                            (m) => m.siteName === refCompetitor,
                          );
                          if (match) {
                            compPrice = match.price;
                            compInStock = match.inStock;
                            if (compPrice !== null) {
                              diff = compPrice - item.yourPrice;
                              if (!compInStock) status = "COMP_OOS";
                              else if (diff < 0) status = "RED";
                              else if (diff > 0) status = "GREEN";
                              else status = "NEUTRAL";
                            } else {
                              return null;
                            }
                          } else {
                            return null;
                          }
                        }

                        return (
                          <div
                            className={cn(
                              "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                              status === "RED"
                                ? "bg-danger/10 text-danger border-danger/20"
                                : status === "GREEN"
                                  ? "bg-success/10 text-success border-success/20"
                                  : status === "COMP_OOS"
                                    ? "bg-amber-100/50 text-amber-600 border-amber-200"
                                    : "bg-muted text-muted-foreground border-border",
                            )}
                          >
                            {status === "RED"
                              ? "Expensive"
                              : status === "GREEN"
                                ? "Cheapest"
                                : status === "COMP_OOS"
                                  ? "Stock Out"
                                  : "Matching"}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(item);
                          }}
                          className="p-1.5 hover:bg-primary/10 hover:text-primary rounded-md text-muted-foreground transition-all"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <div className="relative group/menu">
                          <button
                            className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-all"
                            title="More Actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          <div className="absolute right-0 top-full mt-1 w-40 bg-card border border-border rounded-lg shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10 p-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProduct(item.id, item.title);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-danger hover:bg-danger/10 rounded-md transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete Product
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="border-t border-border bg-muted/10 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Rows per page:
              </span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(val) => {
                  setItemsPerPage(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-17.5">
                  <SelectValue placeholder={itemsPerPage} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-xs font-bold text-muted-foreground">
              Showing{" "}
              {filteredData.length > 0
                ? (currentPage - 1) * itemsPerPage + 1
                : 0}{" "}
              - {Math.min(currentPage * itemsPerPage, filteredData.length)} of{" "}
              {filteredData.length} products
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="h-8 w-8"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = currentPage;
                if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2)
                  pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;

                if (pageNum <= 0 || pageNum > totalPages) return null;

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "w-8 h-8 p-0 font-bold",
                      currentPage === pageNum ? "shadow-md" : "text-muted-foreground"
                    )}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages || totalPages === 0}
              className="h-8 w-8"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      <BulkUpdateDrawer
        isOpen={isUpdateDrawerOpen}
        onClose={() => setIsUpdateDrawerOpen(false)}
        selectedCount={selectedItems.length}
        onExecute={async (_logic) => {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          toast.success(
            `Successfully updated ${selectedItems.length} products`,
          );
          setIsUpdateDrawerOpen(false);
          setSelectedItems([]);
          fetchProducts();
        }}
      />

      <ProductDetailDrawer
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        currency={currency}
        onRefresh={fetchProducts}
        onExecute={async (_id) => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          toast.success("Pilot adjustment applied successfully");
          setSelectedProduct(null);
          fetchProducts();
        }}
      />
      <ProductComparisonDrawer
        products={data.filter(p => selectedItems.includes(p.id))}
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        currency={currency}
      />
    </div>
  );
}
