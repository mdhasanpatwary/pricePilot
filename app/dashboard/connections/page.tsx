"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Plus,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Zap,
  Shield,
  Globe,
  Download,
  ArrowUpRight,
  Eye,
  EyeOff,
  Terminal,
  Activity,
  Loader2,
  X,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const platforms = [
  {
    id: "OPENCART",
    name: "OpenCart",
    icon: "/icons/platforms/opencart.svg",
    downloadUrl: "/dashboard/integrations/opencart",
    status: "supported",
    badge: "✅ Supported"
  },
  {
    id: "LARAVEL",
    name: "Laravel",
    icon: "/icons/platforms/laravel.png",
    downloadUrl: "/dashboard/integrations/laravel",
    status: "supported",
    badge: "✅ Supported"
  },
  {
    id: "SHOPIFY",
    name: "Shopify",
    icon: "/icons/platforms/shopify.svg",
    status: "in-development",
    badge: "🚧 Coming Soon",
    disabled: true
  },
  {
    id: "WOOCOMMERCE",
    name: "WooCommerce",
    icon: "/icons/platforms/woocommerce.svg",
    status: "in-development",
    badge: "🚧 Coming Soon",
    disabled: true
  },
  {
    id: "MAGENTO",
    name: "Magento",
    icon: "/icons/platforms/magento.png",
    status: "in-development",
    badge: "🚧 Coming Soon",
    disabled: true
  },
  {
    id: "PRESTASHOP",
    name: "PrestaShop",
    icon: "/icons/platforms/prestashop.svg",
    status: "planned",
    badge: "⏳ Planned",
    disabled: true
  },
  {
    id: "BIGCOMMERCE",
    name: "BigCommerce",
    icon: "/icons/platforms/bigcommerce.svg",
    status: "planned",
    badge: "⏳ Planned",
    disabled: true
  },
];

const connectionSchema = z.object({
  platform: z.string().min(1, "Please select a platform"),
  baseUrl: z.string().min(3, "Please enter a valid store address"),
  apiToken: z.string().optional(),
  searchQueryPattern: z.string().optional(),
});

type ConnectionFormValues = z.infer<typeof connectionSchema>;

export default function ConnectionsPage() {
  const [isAdding, setIsAdding] = useState(false);
  const [showApiToken, setShowApiToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [_isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [successData, setSuccessData] = useState<{
    name: string;
    platform: string;
    count: number;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progressCount, setProgressCount] = useState(0);

  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      platform: "",
      baseUrl: "",
      apiToken: "",
    },
  });

  const selectedPlatform = form.watch("platform");
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console to bottom
  useEffect(() => {
    if (connections.some((c) => c.isSyncing)) {
      consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [connections]);

  const fetchConnections = useCallback(async (silent = false) => {
    if (!silent) setIsLoadingConnections(true);
    try {
      const res = await fetch("/api/v1/integrations");
      if (res.ok) {
        const data = await res.json();
        console.log('[Connections] Fetched connections:', data.map((c: any) => ({ id: c.id, name: c.name })));
        setConnections(data);
      }
    } catch (error) {
      if (!silent) toast.error("Connection error");
    } finally {
      if (!silent) setIsLoadingConnections(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    const hasActiveSync = connections.some((c) => c.isSyncing);
    if (!hasActiveSync) return;

    const interval = setInterval(() => {
      fetchConnections(true);
    }, 2000);

    return () => clearInterval(interval);
  }, [connections, fetchConnections]);

  const onSubmit = async (data: ConnectionFormValues) => {
    console.log("Submitting connection...", data);
    setLoading(true);
    try {
      // Auto-prepend https:// if missing
      let baseUrl = data.baseUrl.trim();
      if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
        baseUrl = `https://${baseUrl}`;
      }

      const payload = {
        ...data,
        baseUrl,
        type: "USER",
        searchQueryPattern: data.searchQueryPattern,
      };

      console.log("Sending payload:", payload);
      const res = await fetch("/api/v1/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        console.log("Integration created successfully!");
        const site = await res.json();
        const siteId = site.id;

        setIsSyncing(true);
        setProgressCount(0);
        setSuccessData({
          name: new URL(data.baseUrl).hostname,
          platform: data.platform,
          count: 0,
        });

        // Start polling for progress
        const pollInterval = setInterval(async () => {
          try {
            const pollRes = await fetch("/api/v1/integrations");
            if (pollRes.ok) {
              const currentSites = await pollRes.json();
              const currentSite = currentSites.find(
                (s: any) => s.id === siteId,
              );
              if (currentSite) {
                setProgressCount(currentSite.products);

                // If sync finished, stop polling and show final state
                if (!currentSite.isSyncing && currentSite.lastSync) {
                  clearInterval(pollInterval);
                  setIsSyncing(false);
                  setSuccessData({
                    name: new URL(data.baseUrl).hostname,
                    platform: data.platform,
                    count: currentSite.products,
                  });
                  toast.success("Store connected & synced!");
                  fetchConnections(); // Refresh the background list
                }
              }
            }
          } catch (e) {
            console.error("Polling error", e);
          }
        }, 1500);

        // Trigger the actual sync (now returns immediately)
        try {
          await fetch("/api/v1/integrations/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ siteId }),
          });
          // We don't wait for syncRes.ok here because we rely on the poller
        } catch (syncErr) {
          console.error("Failed to trigger sync", syncErr);
        }

        form.reset();
        fetchConnections();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to connect store");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm("Are you sure you want to remove this connection?")) return;

    try {
      const res = await fetch(`/api/v1/integrations?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Connection removed");
        fetchConnections();
      } else {
        toast.error("Failed to remove connection");
      }
    } catch (error) {
      toast.error("Connection error");
    }
  };

  const [limits, setLimits] = useState({ storeLimit: 1, competitorLimit: 3 });

  useEffect(() => {
    fetchConnections();
    fetchLimits();
  }, [fetchConnections]);

  const handleSyncConnection = async (siteId: string) => {
    try {
      console.log('[Sync] Attempting to sync site:', siteId, 'Type:', typeof siteId);

      // Optimistically update UI
      setConnections(prev => prev.map(c => c.id === siteId ? { ...c, isSyncing: true, status: 'SYNCING' } : c));

      const payload = { siteId };
      console.log('[Sync] Sending payload:', payload);

      const res = await fetch("/api/v1/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Sync started in background");
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('[Sync] Error response:', errorData);
        const errorMsg = errorData.details
          ? `${errorData.error}: ${errorData.details.map((d: any) => `${d.field}: ${d.message}`).join(', ')}`
          : errorData.error || "Failed to start sync";
        toast.error(errorMsg);
        fetchConnections(true);
      }
    } catch (error) {
      toast.error("Network error during sync");
      fetchConnections(true);
    }
  };

  const handleStopSyncConnection = async (siteId: string) => {
    try {
      const res = await fetch("/api/v1/integrations/sync/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });

      if (res.ok) {
        toast.info("Termination signal sent");
        setConnections(prev => prev.map(c => c.id === siteId ? { ...c, isSyncing: false } : c));
        fetchConnections(true);
      } else {
        toast.error("Failed to stop sync");
      }
    } catch (error) {
      toast.error("Error stopping sync");
    }
  };

  const fetchLimits = async () => {
    try {
      const res = await fetch("/api/v1/tenant/limits");
      if (res.ok) {
        const data = await res.json();
        setLimits(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
          <p className="text-muted-foreground text-sm">
            Manage your e-commerce store connections. Products sync automatically daily at midnight UTC.
          </p>
        </div>
        {!isAdding && connections.length < limits.storeLimit && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-md hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Connect Store
          </button>
        )}
        {connections.length >= limits.storeLimit && !isAdding && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-lg">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">
              Store Limit Reached ({connections.length}/{limits.storeLimit}) —
              Upgrade for More
            </span>
          </div>
        )}
      </div>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4 md:p-6 space-y-6">
            <div className="space-y-1">
              <h3 className="text-xl font-bold">Configure Connection</h3>
              <p className="text-sm text-muted-foreground">
                Select your platform and provide your access credentials.
              </p>
            </div>

            {successData || isSyncing ? (
              <div className="py-10 flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-2xl font-bold text-foreground">
                    Connection Successful!
                  </h4>
                  <p className="text-muted-foreground">
                    Your {successData?.platform} store <b>{successData?.name}</b>{" "}
                    has been linked.
                  </p>
                </div>

                <div className="bg-primary/5 rounded-xl p-6 w-full max-w-sm border border-primary/10">
                  <div className="text-3xl font-black text-primary mb-1 animate-pulse">
                    {isSyncing ? progressCount : successData?.count}
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {isSyncing
                      ? "Scanning & Importing..."
                      : "Products Imported"}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsAdding(false);
                    setSuccessData(null);
                    setIsSyncing(false);
                    fetchConnections();
                  }}
                  disabled={isSyncing}
                  className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-full hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isSyncing ? "Please wait..." : "Continue to Dashboard"}
                </button>
              </div>
            ) : (
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {platforms.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        !p.disabled && form.setValue("platform", p.id, { shouldValidate: true })
                      }
                      disabled={p.disabled}
                      className={cn(
                        "p-4 border rounded-md flex flex-col items-center gap-3 transition-all group relative",
                        p.disabled && "opacity-50 cursor-not-allowed",
                        selectedPlatform === p.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted/50",
                        p.disabled && "hover:border-border hover:bg-transparent"
                      )}
                    >
                      {selectedPlatform === p.id && !p.disabled && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      {p.badge && (
                        <div className="absolute top-2 left-2">
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-muted border border-border">
                            {p.badge}
                          </span>
                        </div>
                      )}
                      <div className={cn(
                        "w-12 h-12 flex items-center justify-center transition-all p-1 relative",
                        p.disabled ? "grayscale" : "grayscale group-hover:grayscale-0"
                      )}>
                        <Image
                          src={p.icon}
                          alt={p.name}
                          fill
                          className="object-contain p-1"
                          sizes="48px"
                        />
                      </div>
                      <span className="font-bold text-[10px] uppercase tracking-wider">
                        {p.name}
                      </span>
                    </button>
                  ))}
                </div>
                {form.formState.errors.platform && (
                  <p className="text-xs text-destructive font-bold">
                    {form.formState.errors.platform.message}
                  </p>
                )}
                {selectedPlatform && platforms.find((p) => p.id === selectedPlatform)?.disabled && (
                  <div className="p-4 bg-amber-500/5 rounded-lg border border-amber-500/20 flex items-start gap-3">
                    <div className="text-2xl">🚧</div>
                    <div>
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                        Coming Soon!
                      </p>
                      <p className="text-xs text-amber-600/70 dark:text-amber-400/70 leading-relaxed mt-1">
                        {platforms.find((p) => p.id === selectedPlatform)?.name} integration is currently {platforms.find((p) => p.id === selectedPlatform)?.status === 'in-development' ? 'in development' : 'planned for a future release'}. We&apos;re working hard to bring you this integration soon! In the meantime, you can use OpenCart or Laravel.
                      </p>
                    </div>
                  </div>
                )}
                {platforms.find((p) => p.id === selectedPlatform)
                  ?.downloadUrl && (
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <Download className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-primary">
                            Integration Package Required
                          </p>
                          <p className="text-xs font-semibold text-primary/70 leading-relaxed uppercase tracking-tight">
                            To connect {platforms.find((p) => p.id === selectedPlatform)?.name}, you first need to download and
                            install our integration package on your store.
                          </p>
                        </div>
                      </div>
                      <Link
                        href={
                          platforms.find((p) => p.id === selectedPlatform)!
                            .downloadUrl!
                        }
                        className="text-[10px] font-black uppercase tracking-tighter bg-primary text-primary-foreground px-4 py-2 rounded flex items-center justify-center gap-2 hover:opacity-90 transition-all self-start"
                      >
                        Go to Download & Instructions{" "}
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )}

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                      Store Base URL
                    </Label>
                    <div className="relative group">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        {...form.register("baseUrl")}
                        type="url"
                        placeholder="https://yourstore.com"
                        className={cn(
                          "w-full bg-background border border-border rounded-md py-2.5 pl-10 pr-4 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm font-medium",
                          form.formState.errors.baseUrl &&
                          "border-destructive focus:ring-destructive/20",
                        )}
                      />
                    </div>
                    {form.formState.errors.baseUrl && (
                      <p className="text-xs text-destructive font-bold">
                        {form.formState.errors.baseUrl.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">
                      Secure API Token (Optional)
                    </Label>
                    <div className="relative group">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        {...form.register("apiToken")}
                        type={showApiToken ? "text" : "password"}
                        placeholder="Your PricePilot secret key"
                        className={cn(
                          "w-full bg-background border border-border rounded-md py-2.5 pl-10 pr-10 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm font-medium",
                          form.formState.errors.apiToken &&
                          "border-destructive focus:ring-destructive/20",
                        )}
                      />
                      <Button
                        type="button"
                        onClick={() => setShowApiToken(!showApiToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors h-6 w-6 p-0"
                      >
                        {showApiToken ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    {form.formState.errors.apiToken && (
                      <p className="text-xs text-destructive font-bold">
                        {form.formState.errors.apiToken.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between px-0.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                        Search Pattern (Optional)
                      </label>
                      <div className="group relative">
                        <span className="text-[10px] text-primary hover:underline cursor-help font-extrabold uppercase tracking-tighter">Guide</span>
                        <div className="absolute bottom-full right-0 mb-2 w-72 p-3 bg-card border border-border rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] opacity-0 group-hover:opacity-100 transition-all z-50 pointer-events-none scale-95 group-hover:scale-100 origin-bottom-right">
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-foreground">SITE-SPECIFIC SEARCH LOGIC</p>
                            <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                              Specify how your store handles search queries. Use <code className="text-primary font-bold px-1 bg-primary/10 rounded">{`{query}`}</code> as a placeholder for the search term.
                            </p>
                            <div className="p-2 bg-muted rounded-lg space-y-1 border border-border">
                              <p className="text-[9px] font-black text-muted-foreground uppercase">Example</p>
                              <code className="text-[10px] break-all text-primary font-mono block leading-tight">
                                /search/advance/product/result/{"{query}"}
                              </code>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        {...form.register("searchQueryPattern")}
                        type="text"
                        placeholder="https://mystore.com/search?q={query}"
                        className="w-full bg-background border border-border rounded-md py-2.5 pl-10 pr-4 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={loading || Boolean(selectedPlatform && platforms.find((p) => p.id === selectedPlatform)?.disabled)}
                    className="flex-1 font-bold py-2.5 rounded-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98]"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-current" />
                        Verify & Connect
                      </>
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      form.reset();
                    }}
                    className="flex-1 bg-secondary text-secondary-foreground font-bold py-2.5 rounded-md border border-border transition-all hover:bg-secondary/80"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="space-y-6 pt-2">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold">Secure Authentication</p>
                <p className="text-[12px] text-muted-foreground leading-snug">
                  All connection tokens are encrypted with industry standard
                  AES-256 protocols.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-success/10 flex items-center justify-center text-success shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold">Live Data Streaming</p>
                <p className="text-[12px] text-muted-foreground leading-snug">
                  Once connected, your product catalog synchronizes
                  automatically in the background.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {connections.map((conn: any) => (
            <div
              key={conn.id}
              className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all flex flex-col justify-between h-full"
            >
              <div>
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 rounded-md bg-muted border border-border flex items-center justify-center p-2 relative">
                    {(() => {
                      const platform = platforms.find(
                        (p) => p.id === conn.platform,
                      );
                      return platform ? (
                        <Image
                          src={platform.icon}
                          alt={conn.platform}
                          fill
                          className="object-contain p-2 grayscale"
                          sizes="48px"
                        />
                      ) : (
                        <Globe className="w-6 h-6 text-muted-foreground/20" />
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-success/10 border border-success/20 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-success" />
                    <span className="text-[9px] font-bold text-success tracking-widest uppercase">
                      {conn.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-lg">{conn.name}</h3>
                  <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer truncate">
                    {conn.url}
                    <ExternalLink className="w-3 h-3" />
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                      Products:
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {conn.isSyncing ? (
                        <span className="flex items-center gap-1.5 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {conn.syncProcessed || 0} / {conn.syncTotal || "?"}
                        </span>
                      ) : (
                        conn.products || 0
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-border flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">
                    Last Activity
                  </span>
                  <span className="text-[11px] font-semibold text-foreground">
                    {conn.isSyncing ? (
                      <span className="text-primary animate-pulse flex items-center gap-1">
                        <Activity className="w-2.5 h-2.5" />
                        Syncing...
                      </span>
                    ) : (
                      conn.lastSync || "Never"
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => conn.isSyncing ? handleStopSyncConnection(conn.id) : handleSyncConnection(conn.id)}
                    className={cn(
                      "p-2 rounded-md transition-all",
                      conn.isSyncing
                        ? "bg-danger/10 text-danger hover:bg-danger/20"
                        : "hover:bg-primary/10 hover:text-primary"
                    )}
                    title={conn.isSyncing ? "Stop Sync" : "Sync Products"}
                  >
                    {conn.isSyncing ? (
                      <X className="w-4 h-4 animate-pulse" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteConnection(conn.id)}
                    disabled={conn.isSyncing}
                    className={cn(
                      "p-2 hover:bg-danger/10 border border-transparent hover:border-danger/20 rounded-md text-muted-foreground hover:text-danger transition-all",
                      conn.isSyncing && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Global Terminal Feed - Store Sync Monitor */}
          {connections.some((c) => c.isSyncing) && (
            <div className="col-span-full mt-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-950 rounded-xl border border-primary/20 shadow-2xl overflow-hidden ring-1 ring-primary/10">
                {/* Terminal Header */}
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3 border-b border-primary/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500/50 shadow-sm" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/30 border border-amber-500/50 shadow-sm" />
                      <div className="w-3 h-3 rounded-full bg-green-500 border border-green-500 shadow-sm shadow-green-500/50 animate-pulse" />
                    </div>
                    {(() => {
                      const activeSite = connections.find((c) => c.isSyncing);
                      return activeSite ? (
                        <div className="text-[11px] font-mono uppercase tracking-widest ml-2">
                          <div className="flex items-center gap-2">
                            <Terminal className="w-4 h-4 text-primary animate-pulse" />
                            <span className="text-primary font-black">[STORE SYNC]</span>
                            <span className="text-white/50">→</span>
                            <span className="text-white font-bold">{activeSite.name.toUpperCase()}</span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-4">
                    {(() => {
                      const activeSite = connections.find((c) => c.isSyncing);
                      return activeSite ? (
                        <>
                          <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-md border border-white/10">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                            <span className="text-[10px] font-mono text-white/60 uppercase font-bold">
                              PROGRESS: <span className="text-primary font-black">{activeSite.syncProcessed || 0}</span> / <span className="text-white/80">{activeSite.syncTotal || "?"}</span>
                            </span>
                          </div>
                          <button
                            onClick={() => handleStopSyncConnection(activeSite.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-md text-red-400 hover:text-red-300 transition-all text-[10px] font-bold uppercase"
                          >
                            <X className="w-3 h-3" />
                            Stop
                          </button>
                        </>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* Terminal Body */}
                <div className="p-0 font-mono text-[11px] h-80 flex flex-col bg-[#0a0a0a]">
                  <div className="flex-1 overflow-y-auto p-4 space-y-0.5 scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-white/10">
                    {connections
                      .filter((c) => c.isSyncing)
                      .map((site) => (
                        <div key={site.id} className="space-y-0.5">
                          {/* Show logs if available */}
                          {(site.logs || []).length > 0 ? (
                            (site.logs || [])
                              .slice()
                              .reverse()
                              .map((log: any) => (
                                <div
                                  key={log.id}
                                  className="group flex gap-3 px-2 py-1 hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-primary/40 rounded-r"
                                >
                                  <span className="text-white/30 shrink-0 select-none w-20 text-[10px]">
                                    {new Date(log.createdAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </span>
                                  <span
                                    className={cn(
                                      "font-black shrink-0 w-16 text-[10px]",
                                      log.level === "SUCCESS"
                                        ? "text-green-400"
                                        : log.level === "ERROR"
                                          ? "text-red-400"
                                          : log.level === "WARN"
                                            ? "text-amber-400"
                                            : "text-blue-400"
                                    )}
                                  >
                                    [{log.level}]
                                  </span>
                                  <span className="text-white/90 break-all leading-relaxed">{log.message}</span>
                                </div>
                              ))
                          ) : (
                            <div className="space-y-2 p-4">
                              <div className="flex gap-3 px-2 py-1 text-white/50 items-center">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="animate-pulse">Initializing sync process for {site.name}...</span>
                              </div>
                              <div className="flex gap-3 px-2 py-1 text-white/40 text-[10px]">
                                <span className="animate-pulse">▸</span>
                                <span>Connecting to store API...</span>
                              </div>
                              <div className="flex gap-3 px-2 py-1 text-white/40 text-[10px]">
                                <span className="animate-pulse delay-100">▸</span>
                                <span>Authenticating credentials...</span>
                              </div>
                              <div className="flex gap-3 px-2 py-1 text-white/40 text-[10px]">
                                <span className="animate-pulse delay-200">▸</span>
                                <span>Preparing product catalog scan...</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    <div ref={consoleEndRef} />
                  </div>

                  {/* Traffic Footer Strip */}
                  <div className="bg-gradient-to-r from-primary/5 to-transparent border-t border-primary/20 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex gap-6 font-mono text-[10px] text-white/50 uppercase font-bold">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-sm shadow-green-500/50" />
                        Status: <span className="text-green-400">Active</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Activity className="w-3 h-3" />
                        Action: <span className="text-primary">{connections.find(c => c.isSyncing)?.syncLastAction || "Processing Products"}</span>
                      </span>
                    </div>
                    <div className="text-[9px] text-white/30 font-mono">
                      Live sync monitor • Auto-refresh enabled
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {connections.length < limits.storeLimit && (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-muted/10 border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-3 hover:border-primary/50 hover:bg-primary/5 transition-all group min-h-55"
            >
              <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
                <Plus className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-base font-bold">Add New Store</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Integrate platform
                </p>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
