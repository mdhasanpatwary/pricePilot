"use client";

import { useState, useEffect } from "react";
import {
  Save,
  Plus,
  Trash2,
  Shield,
  Ghost,
  Clock,
  Network,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface ScraperConfig {
  proxies: string[];
  userAgents: string[];
  delay: {
    min: number;
    max: number;
  };
  bypasses: {
    headless: boolean;
    useStealthPlugin: boolean;
  };
}

export default function ScraperProfilesPage() {
  const [config, setConfig] = useState<ScraperConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newProxy, setNewProxy] = useState("");
  const [newUA, setNewUA] = useState("");

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/scraper-profiles");
      if (res.ok) setConfig(await res.json());
    } catch (error) {
      console.error("Failed to load config", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await fetch("/api/v1/admin/scraper-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    } catch (error) {
      console.error("Failed to save", error);
    } finally {
      setSaving(false);
    }
  };

  const addProxy = () => {
    if (newProxy && config) {
      setConfig({ ...config, proxies: [...config.proxies, newProxy] });
      setNewProxy("");
    }
  };

  const addUA = () => {
    if (newUA && config) {
      setConfig({ ...config, userAgents: [...config.userAgents, newUA] });
      setNewUA("");
    }
  };

  const removeProxy = (index: number) => {
    if (!config) return;
    const newProxies = [...config.proxies];
    newProxies.splice(index, 1);
    setConfig({ ...config, proxies: newProxies });
  };

  const removeUA = (index: number) => {
    if (!config) return;
    const newUAs = [...config.userAgents];
    newUAs.splice(index, 1);
    setConfig({ ...config, userAgents: newUAs });
  };

  if (loading || !config) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Scraper Profiles
          </h1>
          <p className="text-muted-foreground">
            Manage anti-bot evasion strategies, proxies, and request behaviors.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Network & Proxies */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b pb-4">
            <div className="p-2 bg-blue-50 text-blue-600 dark:bg-blue-900/20 rounded-lg">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Proxy Rotation</h2>
              <p className="text-sm text-muted-foreground">
                Manage IP pool for scraping
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                value={newProxy}
                onChange={(e) => setNewProxy(e.target.value)}
                placeholder="http://user:pass@ip:port"
                className="flex-1 px-3 py-2 border rounded-md text-sm font-mono"
                onKeyDown={(e) => e.key === "Enter" && addProxy()}
              />
              <button
                onClick={addProxy}
                className="p-2 bg-secondary hover:bg-secondary/80 rounded-md"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="h-[200px] overflow-y-auto border rounded-md divide-y">
              {config.proxies.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground italic">
                  No proxies configured (Direct Mode)
                </div>
              ) : (
                config.proxies.map((proxy, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-2 text-xs font-mono group hover:bg-muted/50"
                  >
                    <span className="truncate max-w-[80%]">{proxy}</span>
                    <button
                      onClick={() => removeProxy(idx)}
                      className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 inline mr-1 text-green-500" />
              {config.proxies.length} proxies active
            </p>
          </div>
        </div>

        {/* User Agents */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b pb-4">
            <div className="p-2 bg-purple-50 text-purple-600 dark:bg-purple-900/20 rounded-lg">
              <Ghost className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">User Agents</h2>
              <p className="text-sm text-muted-foreground">
                Browser fingerprints to rotate
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                value={newUA}
                onChange={(e) => setNewUA(e.target.value)}
                placeholder="Mozilla/5.0..."
                className="flex-1 px-3 py-2 border rounded-md text-sm font-mono"
                onKeyDown={(e) => e.key === "Enter" && addUA()}
              />
              <button
                onClick={addUA}
                className="p-2 bg-secondary hover:bg-secondary/80 rounded-md"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="h-[200px] overflow-y-auto border rounded-md divide-y">
              {config.userAgents.map((ua, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-2 text-xs font-mono group hover:bg-muted/50"
                >
                  <span className="truncate max-w-[85%]">{ua}</span>
                  <button
                    onClick={() => removeUA(idx)}
                    className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 inline mr-1 text-green-500" />
              System randomly selects from these {config.userAgents.length}{" "}
              agents
            </p>
          </div>
        </div>

        {/* Behavior & Delays */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b pb-4">
            <div className="p-2 bg-orange-50 text-orange-600 dark:bg-orange-900/20 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Timing & Delays</h2>
              <p className="text-sm text-muted-foreground">
                Randomized delays between actions
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Min Delay (ms)</label>
              <input
                type="number"
                value={config.delay.min}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    delay: { ...config.delay, min: parseInt(e.target.value) },
                  })
                }
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Delay (ms)</label>
              <input
                type="number"
                value={config.delay.max}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    delay: { ...config.delay, max: parseInt(e.target.value) },
                  })
                }
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
            ⚠️ Increasing delays helps avoid blocks but slows down sync speed
            considerably.
          </p>
        </div>

        {/* Advanced Bypasses */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b pb-4">
            <div className="p-2 bg-red-50 text-red-600 dark:bg-red-900/20 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Stealth Mode</h2>
              <p className="text-sm text-muted-foreground">
                Browser automation settings
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium text-sm">Headless Mode</p>
                <p className="text-xs text-muted-foreground">
                  Run browser without UI (Faster)
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.bypasses.headless}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    bypasses: {
                      ...config.bypasses,
                      headless: e.target.checked,
                    },
                  })
                }
                className="h-5 w-5"
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium text-sm">Puppeteer Stealth Plugin</p>
                <p className="text-xs text-muted-foreground">
                  Masks automation signals
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.bypasses.useStealthPlugin}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    bypasses: {
                      ...config.bypasses,
                      useStealthPlugin: e.target.checked,
                    },
                  })
                }
                className="h-5 w-5"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
