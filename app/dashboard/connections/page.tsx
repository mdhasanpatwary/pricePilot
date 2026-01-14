"use client";

import { useState, useEffect } from "react";
import { Plus, Link2, ExternalLink, Trash2, CheckCircle2, AlertCircle, Zap, Shield, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const platforms = [
  { id: "OPENCART", name: "OpenCart", icon: "https://www.opencart.com/application/view/image/home/opencart-logo.png" },
  { id: "LARAVEL", name: "Laravel", icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Laravel.svg/1200px-Laravel.svg.png" },
];

export default function ConnectionsPage() {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    setIsLoadingConnections(true);
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      } else {
        toast.error("Failed to load connections");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setIsLoadingConnections(false);
    }
  };

  const handleAddConnection = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlatform || !baseUrl || !apiToken) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: selectedPlatform,
          baseUrl,
          apiToken,
          type: "USER",
        }),
      });

      if (res.ok) {
        toast.success("Store connected successfully!");
        setIsAdding(false);
        setSelectedPlatform("");
        setBaseUrl("");
        setApiToken("");
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
      const res = await fetch(`/api/integrations?id=${id}`, {
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
          <p className="text-muted-foreground text-sm">Manage your e-commerce store connections.</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-md hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Connect Store
          </button>
        )}
      </div>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
           <div className="lg:col-span-2 bg-card border border-border rounded-lg p-6 md:p-8 space-y-6">
              <div className="space-y-1">
                 <h3 className="text-xl font-bold">Configure Connection</h3>
                 <p className="text-sm text-muted-foreground">Select your platform and provide your access credentials.</p>
              </div>

              <form onSubmit={handleAddConnection} className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {platforms.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlatform(p.id)}
                      className={cn(
                        "p-4 border rounded-md flex flex-col items-center gap-3 transition-all group relative",
                        selectedPlatform === p.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      {selectedPlatform === p.id && (
                        <div className="absolute top-2 right-2">
                           <CheckCircle2 className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div className="w-12 h-12 flex items-center justify-center grayscale group-hover:grayscale-0 transition-all p-1">
                        <img src={p.icon} alt={p.name} className="max-w-full max-h-full object-contain" />
                      </div>
                      <span className="font-bold text-[10px] uppercase tracking-wider">{p.name}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">Store Base URL</label>
                    <div className="relative group">
                       <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                          type="url"
                          value={baseUrl}
                          onChange={(e) => setBaseUrl(e.target.value)}
                          placeholder="https://yourstore.com"
                          className="w-full bg-background border border-border rounded-md py-2.5 pl-10 pr-4 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm font-medium"
                          required
                        />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-0.5">Secure API Token</label>
                    <div className="relative group">
                       <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                          type="password"
                          value={apiToken}
                          onChange={(e) => setApiToken(e.target.value)}
                          placeholder="Your PricePilot secret key"
                          className="w-full bg-background border border-border rounded-md py-2.5 pl-10 pr-4 outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm font-medium"
                          required
                        />
                    </div>
                    <div className="p-3 bg-primary/5 rounded-md border border-primary/10 flex items-start gap-2.5 mt-2">
                       <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                       <p className="text-[10px] font-semibold text-primary/80 leading-normal uppercase tracking-tight">
                         You can find this in your store&apos;s admin panel after installing the PricePilot extension.
                       </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading || !selectedPlatform}
                    className="flex-1 bg-primary text-primary-foreground font-bold py-2.5 rounded-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98]"
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <>
                       <Zap className="w-4 h-4 fill-current" />
                       Verify & Connect
                    </>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 bg-secondary text-secondary-foreground font-bold py-2.5 rounded-md border border-border transition-all hover:bg-secondary/80"
                  >
                    Cancel
                  </button>
                </div>
              </form>
           </div>

           <div className="space-y-6 pt-2">
              <div className="flex items-start gap-3">
                 <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Shield className="w-4 h-4" />
                 </div>
                 <div className="space-y-1">
                    <p className="text-sm font-bold">Secure Authentication</p>
                    <p className="text-[12px] text-muted-foreground leading-snug">All connection tokens are encrypted with industry standard AES-256 protocols.</p>
                 </div>
              </div>
              <div className="flex items-start gap-3">
                 <div className="w-8 h-8 rounded-md bg-success/10 flex items-center justify-center text-success shrink-0">
                    <Zap className="w-4 h-4" />
                 </div>
                 <div className="space-y-1">
                    <p className="text-sm font-bold">Live Data Streaming</p>
                    <p className="text-[12px] text-muted-foreground leading-snug">Once connected, your product catalog synchronizes automatically in the background.</p>
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {connections.map((conn: any) => (
            <div key={conn.id} className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all flex flex-col justify-between h-full">
              <div>
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 rounded-md bg-muted border border-border flex items-center justify-center p-2">
                    <img
                      src={platforms.find(p => p.id === conn.platform)?.icon}
                      alt={conn.platform}
                      className="max-w-full max-h-full object-contain grayscale"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-success/10 border border-success/20 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-success" />
                    <span className="text-[9px] font-bold text-success tracking-widest uppercase">{conn.status}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-lg">{conn.name}</h3>
                  <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer truncate">
                    {conn.url}
                    <ExternalLink className="w-3 h-3" />
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-border flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">Last Activity</span>
                  <span className="text-[11px] font-semibold text-foreground">{conn.lastSync}</span>
                </div>
                <div className="flex items-center gap-2">
                   <button className="p-2 hover:bg-muted border border-transparent hover:border-border rounded-md text-muted-foreground transition-all">
                      <Link2 className="w-4 h-4" />
                   </button>
                   <button
                     onClick={() => handleDeleteConnection(conn.id)}
                     className="p-2 hover:bg-danger/10 border border-transparent hover:border-danger/20 rounded-md text-muted-foreground hover:text-danger transition-all"
                   >
                      <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              </div>
            </div>
          ))}

          <button
             onClick={() => setIsAdding(true)}
             className="bg-muted/10 border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-3 hover:border-primary/50 hover:bg-primary/5 transition-all group min-h-[220px]"
          >
             <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
                <Plus className="w-5 h-5" />
             </div>
             <div className="space-y-0.5">
                <p className="text-base font-bold">Add New Store</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Integrate platform</p>
             </div>
          </button>
        </div>
      )}
    </div>
  );
}
