"use client";

import { useState } from "react";
import { Plus, Link2, ExternalLink, Trash2, CheckCircle2, AlertCircle, Zap, Shield, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const existingConnections = [
    { id: "1", platform: "OPENCART", name: "Main Store", url: "https://mystore.com", status: "CONNECTED", lastSync: "2 hours ago" },
  ];

  const handleAddConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsAdding(false);
      setSelectedPlatform("");
      setBaseUrl("");
      setApiToken("");
      alert("Store connected and initial sync started!");
    } catch (error) {
      alert("Failed to connect store. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight">Integration Center</h1>
          <p className="text-muted-foreground font-medium">Link your e-commerce ecosystem to the PricePilot engine.</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-2xl shadow-primary/20 glow transition-transform active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Connect New Store
          </button>
        )}
      </div>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
           <div className="bg-card border border-border rounded-[2.5rem] p-10 space-y-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
              <div className="space-y-2">
                 <h2 className="text-2xl font-black tracking-tight">Configure Endpoint</h2>
                 <p className="text-sm font-medium text-muted-foreground">Select your platform and provide your access credentials.</p>
              </div>

              <form onSubmit={handleAddConnection} className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  {platforms.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlatform(p.id)}
                      className={cn(
                        "p-6 border rounded-3xl flex flex-col items-center gap-4 transition-all group relative overflow-hidden",
                        selectedPlatform === p.id
                          ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      )}
                    >
                      {selectedPlatform === p.id && (
                        <div className="absolute top-3 right-3">
                           <CheckCircle2 className="w-4 h-4 text-primary fill-primary/10" />
                        </div>
                      )}
                      <div className="w-14 h-14 flex items-center justify-center grayscale brightness-150 group-hover:grayscale-0 group-hover:brightness-100 transition-all">
                        <img src={p.icon} alt={p.name} className="max-w-full max-h-full object-contain" />
                      </div>
                      <span className="font-black text-xs uppercase tracking-widest">{p.name}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Store Base URL</label>
                    <div className="relative group">
                       <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                          type="url"
                          value={baseUrl}
                          onChange={(e) => setBaseUrl(e.target.value)}
                          placeholder="https://yourstore.com"
                          className="w-full bg-muted/30 border border-border rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-bold placeholder:text-muted-foreground/30"
                          required
                        />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Secure API Token</label>
                    <div className="relative group">
                       <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                          type="password"
                          value={apiToken}
                          onChange={(e) => setApiToken(e.target.value)}
                          placeholder="Paste your PricePilot secret here"
                          className="w-full bg-muted/30 border border-border rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-bold placeholder:text-muted-foreground/30"
                          required
                        />
                    </div>
                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3 mt-4">
                       <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                       <p className="text-[11px] font-bold text-primary/80 leading-relaxed uppercase tracking-wider">
                         You can find this in your store&apos;s admin panel after installing the official PricePilot module.
                       </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={loading || !selectedPlatform}
                    className="flex-1 premium-gradient text-white font-black py-5 rounded-2xl transition-all disabled:opacity-50 shadow-xl shadow-primary/20 glow transition-transform active:scale-95 flex items-center justify-center gap-2"
                  >
                    {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>
                       <Zap className="w-4 h-4 fill-current" />
                       Verify & Connect
                    </>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 bg-muted hover:bg-muted/80 text-foreground font-black py-5 rounded-2xl border border-border transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
           </div>

           <div className="hidden lg:block space-y-6 pt-10">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Shield className="w-6 h-6" />
                 </div>
                 <div className="space-y-0.5">
                    <p className="text-lg font-black tracking-tight">Military Grade Auth</p>
                    <p className="text-sm text-muted-foreground font-medium">All connection tokens are encrypted with AES-256 for your protection.</p>
                 </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center text-success">
                    <Zap className="w-6 h-6" />
                 </div>
                 <div className="space-y-0.5">
                    <p className="text-lg font-black tracking-tight">Real-time Data Streaming</p>
                    <p className="text-sm text-muted-foreground font-medium">Once connected, products sync instantly with zero backend latency.</p>
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {existingConnections.map((conn) => (
            <div key={conn.id} className="bg-card border border-border rounded-[2.5rem] p-8 group hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/10 transition-colors" />

              <div className="flex items-start justify-between mb-10">
                <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center p-3 group-hover:bg-background transition-colors duration-500">
                  <img
                    src={platforms.find(p => p.id === conn.platform)?.icon}
                    alt={conn.platform}
                    className="max-w-full max-h-full object-contain grayscale group-hover:grayscale-0 transition-all duration-500"
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/20 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span className="text-[10px] font-black text-success tracking-widest uppercase">{conn.status}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-black text-2xl tracking-tight">{conn.name}</h3>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 group/link cursor-pointer hover:text-primary transition-colors">
                  {conn.url}
                  <ExternalLink className="w-3.5 h-3.5 opacity-50 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                </p>
              </div>

              <div className="mt-10 pt-8 border-t border-border flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Last Activity</span>
                  <span className="text-xs font-bold text-foreground">{conn.lastSync}</span>
                </div>
                <div className="flex items-center gap-2">
                   <button className="p-3 bg-muted hover:bg-background border border-border rounded-xl text-muted-foreground hover:text-primary transition-all shadow-sm">
                      <Link2 className="w-5 h-5" />
                   </button>
                   <button className="p-3 bg-muted hover:bg-danger/10 border border-border hover:border-danger/20 rounded-xl text-muted-foreground hover:text-danger transition-all shadow-sm">
                      <Trash2 className="w-5 h-5" />
                   </button>
                </div>
              </div>
            </div>
          ))}

          {/* New Connection Card */}
          <button
             onClick={() => setIsAdding(true)}
             className="bg-muted/10 border-2 border-dashed border-border rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center space-y-4 hover:border-primary/40 hover:bg-primary/5 transition-all group"
          >
             <div className="w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground group-hover:scale-110 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all duration-500">
                <Plus className="w-8 h-8" />
             </div>
             <div className="space-y-1">
                <p className="text-xl font-black">Add Integration</p>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Scale your reach</p>
             </div>
          </button>
        </div>
      )}
    </div>
  );
}
