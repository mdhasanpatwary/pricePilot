"use client";

import { useState, useEffect } from "react";
import {
  Settings2,
  Save,
  RefreshCw,
  Brain,
  Cpu,
  Zap,
  AlertTriangle,
  Info,
  ShieldCheck,
  Database,
  Mail,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfigItem {
  id: string;
  key: string;
  value: string;
  description: string;
  type: string;
}

export default function BusinessSetupPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  async function fetchConfigs() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/system-config");
      if (res.ok) {
        const data = (await res.ok) ? await res.json() : [];
        setConfigs(data);
      }
    } catch (err) {
      setError("Failed to load business configurations");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(key: string, value: string) {
    setSaving(key);
    try {
      const res = await fetch("/api/v1/admin/system-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error("Failed to update");

      setConfigs(configs.map((c) => (c.key === key ? { ...c, value } : c)));
    } catch (err) {
      alert(`Error updating ${key}`);
    } finally {
      setSaving(null);
    }
  }

  const sections = [
    {
      id: "matching",
      title: "Matching Intelligence",
      description:
        "Configure how products are automatically compared and matched across stores.",
      icon: Brain,
      items: configs.filter((c) => c.key.startsWith("MATCHING")),
    },
    {
      id: "scraper",
      title: "Scraper Core Engine",
      description:
        "Fine-tune the behavior of the high-speed price scanning engine.",
      icon: Cpu,
      items: configs.filter((c) => c.key.startsWith("SCRAPER")),
    },
    {
      id: "pricing",
      title: "Global Pricing Logic",
      description:
        "Define global constraints and formatting for price updates.",
      icon: Zap,
      items: configs.filter((c) => c.key.startsWith("PRICE")),
    },
    {
      id: "orchestrator",
      title: "Sync Orchestration",
      description:
        "Master controls for automated synchronization and platform reliability.",
      icon: ShieldCheck,
      items: configs.filter((c) => c.key.startsWith("SYNC")),
    },
    {
      id: "data",
      title: "Data & Redundancy",
      description:
        "Manage global backup destinations and data sovereignty parameters.",
      icon: Database,
      items: configs.filter((c) => c.key.startsWith("BACKUP")),
    },
    {
      id: "retention",
      title: "Data Retention & Compliance",
      description:
        "Define GDPR-compliant data purge policies for history and logs.",
      icon: ShieldCheck,
      items: configs.filter((c) => c.key.startsWith("RETENTION")),
    },
    {
      id: "email",
      title: "Email Communications",
      description:
        "Global SMTP settings for system alerts and merchant notifications.",
      icon: Mail,
      items: configs.filter(
        (c) => c.key.startsWith("SMTP") || c.key.includes("EMAIL"),
      ),
    },
    {
      id: "slack",
      title: "Slack Integration",
      description:
        "Global Slack webhook configuration for real-time operations monitoring.",
      icon: MessageSquare,
      items: configs.filter(
        (c) => c.key.startsWith("SLACK") || c.key.includes("SLACK"),
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Synchronizing Brain State...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-primary" />
            Business Setup & Logic
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centrally manage the core algorithms and operational parameters of
            PricePilot.
          </p>
        </div>
        <button
          onClick={fetchConfigs}
          className="p-2 hover:bg-muted rounded-full transition-colors"
          title="Refresh Config"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="space-y-12">
        {sections.map((section) => (
          <section key={section.id} className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-primary/10 rounded-xl">
                <section.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {section.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {section.description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-0 lg:ml-14">
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all duration-300 shadow-sm group"
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        {item.key.replace(/_/g, " ")}
                      </label>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Info className="w-3.5 h-3.5 text-muted-foreground/50" />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mb-4 leading-relaxed line-clamp-2">
                      {item.description}
                    </p>

                    <div className="mt-auto space-y-3">
                      {item.type === "boolean" ? (
                        <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg border border-border/50">
                          <span className="text-sm font-medium">
                            Status:{" "}
                            {item.value === "true" ? "Active" : "Disabled"}
                          </span>
                          <button
                            onClick={() =>
                              handleUpdate(
                                item.key,
                                item.value === "true" ? "false" : "true",
                              )
                            }
                            disabled={saving === item.key}
                            className={cn(
                              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                              item.value === "true" ? "bg-primary" : "bg-muted",
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                item.value === "true"
                                  ? "translate-x-4"
                                  : "translate-x-0",
                              )}
                            />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type={item.type === "number" ? "number" : "text"}
                            defaultValue={item.value}
                            onBlur={(e) => {
                              if (e.target.value !== item.value) {
                                handleUpdate(item.key, e.target.value);
                              }
                            }}
                            className="w-full bg-muted/50 border border-border rounded-lg py-2 px-3 text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary transition-all pr-10"
                            placeholder="Enter value..."
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {saving === item.key ? (
                              <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5 text-muted-foreground/30" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {section.id === "retention" && (
                <div className="col-span-full border border-primary/20 bg-primary/5 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      Perform Manual Maintenance
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Instantly enforce the retention policies defined above and
                      purge old records.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/v1/admin/maintenance", {
                          method: "POST",
                        });
                        if (res.ok) alert("Cleanup completed successfully!");
                        else alert("Failed to run cleanup.");
                      } catch (err) {
                        alert("Connection error.");
                      }
                    }}
                    className="shrink-0 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-sm shadow-primary/20 active:scale-[0.98]"
                  >
                    Run Cleanup Now
                  </button>
                </div>
              )}
              {section.items.length === 0 && section.id !== "retention" && (
                <div className="col-span-full py-10 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-muted-foreground">
                  <p className="text-sm font-medium italic">
                    No logic controllers found in this sector
                  </p>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-16 p-6 bg-zinc-900 text-white rounded-2xl shadow-xl overflow-hidden relative">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h4 className="text-lg font-bold">System Integrity Check</h4>
            <p className="text-sm text-zinc-400 mt-1 max-w-xl">
              Updating these parameters affects the global behavior of the
              platform. Changes are applied in real-time but only affect new
              operations.
            </p>
          </div>
          <button className="bg-white text-zinc-900 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-colors shrink-0">
            Audit Logic Logs
          </button>
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/20 rounded-full blur-[80px]" />
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px]" />
      </div>
    </div>
  );
}
