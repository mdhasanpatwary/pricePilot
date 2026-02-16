"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Server, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ProxyProtocol = "http" | "https" | "socks5";
type ProxyStatus = "active" | "disabled";

interface ProxyItem {
  id: string;
  provider: string;
  host: string;
  port: number;
  protocol: ProxyProtocol;
  username?: string | null;
  region?: string | null;
  status: ProxyStatus;
  globalSuccessRate: number;
  globalSuccessCount: number;
  globalFailureCount: number;
  createdAt: string;
}

interface ProxyFormState {
  provider: string;
  host: string;
  port: string;
  protocol: ProxyProtocol;
  username: string;
  password: string;
  region: string;
}

const INITIAL_FORM: ProxyFormState = {
  provider: "",
  host: "",
  port: "",
  protocol: "http",
  username: "",
  password: "",
  region: "",
};

export default function ProxyPoolPage() {
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [form, setForm] = useState<ProxyFormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchProxies = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      if (!manual) setLoading(true);
      try {
        const res = await fetch("/api/v1/scraping/proxies");
        const json = await res.json();
        if (!res.ok || !json?.success) {
          throw new Error(json?.error?.message || "Failed to load proxies");
        }
        setProxies(json.data?.proxies || []);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load proxies");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchProxies();
  }, [fetchProxies]);

  const stats = useMemo(() => {
    const active = proxies.filter((p) => p.status === "active").length;
    const disabled = proxies.length - active;
    const residential = proxies.filter((p) =>
      ["residential", "resi", "mobile", "isp"].some((k) => p.provider.toLowerCase().includes(k))
    ).length;
    return { total: proxies.length, active, disabled, residential };
  }, [proxies]);

  const handleCreate = async () => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const port = Number.parseInt(form.port, 10);
      if (!form.provider || !form.host || !Number.isFinite(port)) {
        throw new Error("Provider, host, and valid port are required");
      }

      const payload = {
        provider: form.provider.trim(),
        host: form.host.trim(),
        port,
        protocol: form.protocol,
        username: form.username.trim() || undefined,
        password: form.password.trim() || undefined,
        region: form.region.trim() || undefined,
      };

      const res = await fetch("/api/v1/scraping/proxies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || "Failed to add proxy");
      }

      setForm(INITIAL_FORM);
      setMessage("Proxy added successfully.");
      await fetchProxies(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add proxy");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (proxyId: string, status: ProxyStatus) => {
    setBusyId(proxyId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/scraping/proxies/${proxyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || "Failed to update proxy status");
      }
      await fetchProxies(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update proxy");
    } finally {
      setBusyId(null);
    }
  };

  const deleteProxy = async (proxyId: string) => {
    if (!confirm("Delete this proxy from pool?")) return;
    setBusyId(proxyId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/scraping/proxies/${proxyId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || "Failed to delete proxy");
      }
      setMessage("Proxy deleted.");
      await fetchProxies(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete proxy");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proxy Pool</h1>
          <p className="text-muted-foreground">
            Add, disable, and remove proxies used by the scraping engine.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => fetchProxies(true)} disabled={refreshing}>
            <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </Card>
      )}
      {message && (
        <Card className="border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          {message}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total" value={stats.total} />
        <Stat label="Active" value={stats.active} />
        <Stat label="Disabled" value={stats.disabled} />
        <Stat label="Likely Residential" value={stats.residential} />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Add Proxy
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            placeholder="Provider (e.g. freeproxy)"
            value={form.provider}
            onChange={(e) => setForm((v) => ({ ...v, provider: e.target.value }))}
          />
          <Input
            placeholder="Host"
            value={form.host}
            onChange={(e) => setForm((v) => ({ ...v, host: e.target.value }))}
          />
          <Input
            placeholder="Port"
            type="number"
            value={form.port}
            onChange={(e) => setForm((v) => ({ ...v, port: e.target.value }))}
          />
          <Select value={form.protocol} onValueChange={(value) => setForm((v) => ({ ...v, protocol: value as ProxyProtocol }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="http">http</SelectItem>
              <SelectItem value="https">https</SelectItem>
              <SelectItem value="socks5">socks5</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Username (optional)"
            value={form.username}
            onChange={(e) => setForm((v) => ({ ...v, username: e.target.value }))}
          />
          <Input
            placeholder="Password (optional)"
            type="password"
            value={form.password}
            onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
          />
          <Input
            placeholder="Region (optional)"
            value={form.region}
            onChange={(e) => setForm((v) => ({ ...v, region: e.target.value }))}
          />
        </div>
        <div className="mt-3">
          <Button onClick={handleCreate} disabled={submitting}>
            <Plus className="mr-2 h-4 w-4" />
            {submitting ? "Adding..." : "Add Proxy"}
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Proxy List
        </h2>

        {loading ? (
          <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Loading proxies...
          </div>
        ) : proxies.length === 0 ? (
          <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
            <Server className="mr-2 h-4 w-4" />
            No proxies configured.
          </div>
        ) : (
          <div className="space-y-2">
            {proxies.map((proxy) => {
              const endpoint = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
              const isBusy = busyId === proxy.id;
              return (
                <div key={proxy.id} className="rounded-md border p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs">{endpoint}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {proxy.provider} {proxy.region ? `• ${proxy.region}` : ""} {proxy.username ? "• auth" : ""}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Success {proxy.globalSuccessRate.toFixed(1)}% • {proxy.globalSuccessCount} ok / {proxy.globalFailureCount} fail
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={proxy.status === "active" ? "default" : "secondary"}>
                        {proxy.status}
                      </Badge>
                      {proxy.status === "active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatus(proxy.id, "disabled")}
                          disabled={isBusy}
                        >
                          Disable
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatus(proxy.id, "active")}
                          disabled={isBusy}
                        >
                          Enable
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteProxy(proxy.id)}
                        disabled={isBusy}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </Card>
  );
}
