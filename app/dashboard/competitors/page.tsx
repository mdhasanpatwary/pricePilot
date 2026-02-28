"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus,
  Globe,
  Search,
  Trash2,
  ShieldAlert,
  Zap,
  ExternalLink,
  Target,
  MousePointer2,
  X,
  Download,
  Filter,
  ShieldCheck,
  Settings,
  Loader2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const competitorSchema = z.object({
  searchUrl: z.string().url("Please enter a valid search URL"),
});

type CompetitorFormValues = z.infer<typeof competitorSchema>;

/**
 * Extracts base URL, name, and search pattern from a full search URL
 *
 * @example
 * Input: "https://www.ryans.com/search?q=Apple+MacBook+Air"
 * Output: {
 *   baseUrl: "https://www.ryans.com",
 *   name: "ryans.com",
 *   searchPattern: "https://www.ryans.com/search?q={query}"
 * }
 */
function extractCompetitorInfo(fullUrl: string): {
  baseUrl: string;
  name: string;
  searchPattern: string | null;
} | null {
  try {
    const url = new URL(fullUrl);
    const baseUrl = url.origin;
    const hostname = url.hostname.replace('www.', '');

    // Common search parameter names
    const searchParams = ['q', 'query', 'search', 'keyword', 'keywords', 's', 'term'];

    // Check if any search parameter exists
    for (const param of searchParams) {
      if (url.searchParams.has(param)) {
        // Replace the value with {query} placeholder
        url.searchParams.set(param, '{query}');
        return {
          baseUrl,
          name: hostname,
          searchPattern: decodeURIComponent(url.toString())
        };
      }
    }

    // Check for path-based search patterns like /search/term or /search/term/
    const pathMatch = url.pathname.match(/^(\/search\/|\/products\/|\/s\/)(.+?)(\/?$)/i);
    if (pathMatch) {
      const basePath = pathMatch[1];
      return {
        baseUrl,
        name: hostname,
        searchPattern: `${url.origin}${basePath}{query}`
      };
    }

    // If no search pattern detected, just return base info
    return {
      baseUrl,
      name: hostname,
      searchPattern: null
    };
  } catch (e) {
    return null;
  }
}

// Hardcoded Default Patterns for known sites
const KNOWN_SEARCH_PATTERNS: Record<string, string> = {
  "startech.com.bd": "/product/search?search={query}",
  "ryans.com": "/search?q={query}",
  "ryanscomputers.com": "/search?q={query}",
  "techlandbd.com": "/search/advance/product/result/{query}",
  "techland.com.bd": "/search/advance/product/result/{query}",
  "skyland.com.bd": "/search?q={query}",
  "ultratech.com.bd": "/products?search={query}",
};

import { Competitor } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface CompetitorProgressSnapshot {
  id: string;
  isSyncing: boolean;
  syncTotal: number;
  syncProcessed: number;
  syncLastAction?: string | null;
  syncStartedAt?: string | Date | null;
  latestLogAt?: string | Date | null;
  logs?: Array<{
    id: string;
    siteId: string;
    message: string;
    level: string;
    createdAt: string | Date;
  }>;
}

interface AdvancedAccessFormState {
  proxyEnabled: boolean;
  proxyProtocol: "http" | "https" | "socks5";
  proxyHost: string;
  proxyPort: string;
  proxyUsername: string;
  proxyPassword: string;
  captchaEnabled: boolean;
  captchaProvider: string;
  captchaApiKey: string;
}

type SyncUiState = "IDLE" | "STARTING" | "RUNNING" | "STOPPING" | "STOPPED";
type SyncActionIntent = "START" | "STOP";
type SyncUiEvent =
  | { type: "START_REQUEST" }
  | { type: "START_FAILED" }
  | { type: "STOP_REQUEST" }
  | { type: "STOP_FAILED" }
  | { type: "BACKEND_SNAPSHOT"; backendSyncing: boolean; backendSyncState?: string };

function transitionSyncUiState(current: SyncUiState, event: SyncUiEvent): SyncUiState {
  switch (event.type) {
    case "START_REQUEST":
      return current === "STOPPING" ? "STOPPING" : "STARTING";
    case "START_FAILED":
      return current === "STARTING" ? "IDLE" : current;
    case "STOP_REQUEST":
      return current === "IDLE" || current === "STOPPED" ? "STOPPED" : "STOPPING";
    case "STOP_FAILED":
      return current === "STOPPING" ? "RUNNING" : current;
    case "BACKEND_SNAPSHOT":
      if (event.backendSyncState === "STOPPING") return "STOPPING";
      if (event.backendSyncState === "STOPPED") return "STOPPED";

      if (event.backendSyncing) {
        return current === "STOPPING" ? "STOPPING" : "RUNNING";
      }

      if (current === "STOPPING") return "STOPPED";
      if (current === "STOPPED") return "IDLE";
      if (current === "RUNNING" || current === "STARTING") return "IDLE";
      return "IDLE";
    default:
      return current;
  }
}

function isActiveSyncUiState(state: SyncUiState): boolean {
  return state === "STARTING" || state === "RUNNING" || state === "STOPPING";
}

function getSyncStatusLabel(state: SyncUiState, fallbackStatus: string): string {
  switch (state) {
    case "STARTING":
      return "STARTING";
    case "RUNNING":
      return "SYNCING";
    case "STOPPING":
      return "STOPPING";
    case "STOPPED":
      return "STOPPED";
    default:
      return fallbackStatus;
  }
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncUiStateBySite, setSyncUiStateBySite] = useState<Record<string, SyncUiState>>({});
  const [syncActionBySite, setSyncActionBySite] = useState<Record<string, SyncActionIntent | undefined>>({});
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const syncPollingStartedAtRef = useRef<number | null>(null);
  const lastProgressSignatureRef = useRef<string>("");
  const unchangedProgressPollsRef = useRef<number>(0);
  const progressFetchInFlightRef = useRef<boolean>(false);
  const syncUiStateBySiteRef = useRef<Record<string, SyncUiState>>({});
  const syncActionBySiteRef = useRef<Record<string, SyncActionIntent | undefined>>({});
  const syncActionVersionRef = useRef<Record<string, number>>({});

  // Settings Modal State
  const [editingSite, setEditingSite] = useState<Competitor | null>(null);
  const [searchPatternInput, setSearchPatternInput] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [advancedPromptSite, setAdvancedPromptSite] = useState<Competitor | null>(null);
  const [advancedMissingRequirements, setAdvancedMissingRequirements] = useState<Array<"proxy" | "captcha">>([]);
  const [isAdvancedConfigLoading, setIsAdvancedConfigLoading] = useState(false);
  const [isAdvancedConfigSaving, setIsAdvancedConfigSaving] = useState(false);
  const [advancedForm, setAdvancedForm] = useState<AdvancedAccessFormState>({
    proxyEnabled: true,
    proxyProtocol: "http",
    proxyHost: "",
    proxyPort: "",
    proxyUsername: "",
    proxyPassword: "",
    captchaEnabled: true,
    captchaProvider: "2captcha",
    captchaApiKey: "",
  });

  useEffect(() => {
    syncUiStateBySiteRef.current = syncUiStateBySite;
  }, [syncUiStateBySite]);

  useEffect(() => {
    syncActionBySiteRef.current = syncActionBySite;
  }, [syncActionBySite]);

  const getSyncUiState = useCallback(
    (siteId: string, backendIsSyncing?: boolean): SyncUiState =>
      syncUiStateBySite[siteId] ?? (backendIsSyncing ? "RUNNING" : "IDLE"),
    [syncUiStateBySite],
  );

  const applySyncUiEvent = useCallback((siteId: string, event: SyncUiEvent) => {
    setSyncUiStateBySite((prev) => {
      const current = prev[siteId] ?? "IDLE";
      const next = transitionSyncUiState(current, event);
      if (next === current) return prev;
      return { ...prev, [siteId]: next };
    });
  }, []);

  const reconcileSyncUiState = useCallback((sites: Array<{ id: string; isSyncing?: boolean; syncState?: string }>) => {
    const siteIds = new Set(sites.map((site) => site.id));

    setSyncUiStateBySite((prev) => {
      const next: Record<string, SyncUiState> = {};
      let changed = Object.keys(prev).length !== siteIds.size;

      for (const site of sites) {
        const current = prev[site.id] ?? "IDLE";
        const derived = transitionSyncUiState(current, {
          type: "BACKEND_SNAPSHOT",
          backendSyncing: Boolean(site.isSyncing),
          backendSyncState: site.syncState,
        });
        next[site.id] = derived;
        if (!changed && prev[site.id] !== derived) {
          changed = true;
        }
      }

      return changed ? next : prev;
    });

    setSyncActionBySite((prev) => {
      let changed = false;
      const next: Record<string, SyncActionIntent | undefined> = {};

      for (const [siteId, action] of Object.entries(prev)) {
        if (siteIds.has(siteId)) {
          next[siteId] = action;
        } else {
          delete syncActionVersionRef.current[siteId];
          changed = true;
        }
      }

      syncActionBySiteRef.current = next;
      return changed ? next : prev;
    });
  }, []);

  const beginSyncAction = useCallback((siteId: string, intent: SyncActionIntent): number => {
    syncActionBySiteRef.current[siteId] = intent;
    const nextVersion = (syncActionVersionRef.current[siteId] || 0) + 1;
    syncActionVersionRef.current[siteId] = nextVersion;

    setSyncActionBySite((prev) => ({ ...prev, [siteId]: intent }));

    return nextVersion;
  }, []);

  const isLatestSyncAction = useCallback(
    (siteId: string, version: number) => syncActionVersionRef.current[siteId] === version,
    [],
  );

  const clearSyncAction = useCallback((siteId: string, version: number) => {
    if (syncActionVersionRef.current[siteId] !== version) return;
    delete syncActionBySiteRef.current[siteId];

    setSyncActionBySite((prev) => {
      if (!(siteId in prev)) return prev;
      const next = { ...prev };
      delete next[siteId];
      return next;
    });
  }, []);

  // Smart auto-scroll: Only scroll if user hasn't manually scrolled up
  useEffect(() => {
    if (
      isAutoScroll &&
      Array.isArray(competitors) &&
      competitors.some((c) => isActiveSyncUiState(getSyncUiState(c.id, c.isSyncing))) &&
      scrollContainerRef.current
    ) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [competitors, isAutoScroll, getSyncUiState]);

  const form = useForm<CompetitorFormValues>({
    resolver: zodResolver(competitorSchema),
    defaultValues: {
      searchUrl: "",
    },
  });

  const fetchCompetitors = useCallback(async (silent = false) => {
    if (!silent) setIsDataLoading(true);
    try {
      const res = await fetch("/api/v1/competitors");
      if (res.ok) {
        const data = await res.json();
        const incomingCompetitors: Competitor[] = Array.isArray(data.competitors)
          ? data.competitors
          : [];

        setCompetitors((prev) => {
          const existingById = new Map(prev.map((competitor) => [competitor.id, competitor]));
          return incomingCompetitors.map((competitor) => ({
            ...competitor,
            logs: existingById.get(competitor.id)?.logs || competitor.logs || [],
          }));
        });
        reconcileSyncUiState(incomingCompetitors.map((site: any) => ({
          id: site.id,
          isSyncing: site.isSyncing,
          syncState: site.syncState
        })));
      } else {
        toast.error("Failed to load competitors");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      if (!silent) setIsDataLoading(false);
    }
  }, [reconcileSyncUiState]);

  const fetchCompetitorProgress = useCallback(async (): Promise<{
    changed: boolean;
    activeSyncCount: number;
    ok: boolean;
  }> => {
    if (progressFetchInFlightRef.current) {
      return { changed: false, activeSyncCount: 0, ok: true };
    }

    progressFetchInFlightRef.current = true;
    try {
      const res = await fetch("/api/v1/competitors/progress", { cache: "no-store" });
      if (!res.ok) {
        return { changed: false, activeSyncCount: 0, ok: false };
      }

      const data = await res.json();
      const snapshots: CompetitorProgressSnapshot[] = Array.isArray(data.sites) ? data.sites : [];
      const progressMap = new Map(snapshots.map((site) => [site.id, site]));

      const signature = snapshots
        .map(
          (site) =>
            `${site.id}:${site.isSyncing ? 1 : 0}:${site.syncProcessed || 0}:${site.syncTotal || 0}:${site.syncLastAction || ""}:${site.latestLogAt || ""}`
        )
        .join("|");
      const changed = signature !== lastProgressSignatureRef.current;
      lastProgressSignatureRef.current = signature;

      setCompetitors((prev) =>
        prev.map((competitor) => {
          const snapshot = progressMap.get(competitor.id);
          if (!snapshot) return competitor;

          const nextStatus = snapshot.isSyncing
            ? "SYNCING"
            : competitor.status === "SYNCING"
              ? competitor.products > 0
                ? "ACTIVE"
                : "PENDING"
              : competitor.status;

          return {
            ...competitor,
            isSyncing: snapshot.isSyncing,
            syncTotal: snapshot.syncTotal,
            syncProcessed: snapshot.syncProcessed,
            syncLastAction: snapshot.syncLastAction,
            syncStartedAt: snapshot.syncStartedAt,
            logs: snapshot.logs || [],
            status: nextStatus,
          };
        })
      );
      reconcileSyncUiState(snapshots.map((site: any) => ({
        id: site.id,
        isSyncing: site.isSyncing,
        syncState: site.syncState
      })));

      return {
        changed,
        activeSyncCount: Number(data.activeSyncCount || 0),
        ok: true,
      };
    } catch {
      return { changed: false, activeSyncCount: 0, ok: false };
    } finally {
      progressFetchInFlightRef.current = false;
    }
  }, [reconcileSyncUiState]);

  // Polling for active syncs
  const hasActiveSync = useMemo(() => {
    return (
      Array.isArray(competitors) &&
      competitors.some((c) => isActiveSyncUiState(getSyncUiState(c.id, c.isSyncing)))
    );
  }, [competitors, getSyncUiState]);

  const activeSyncSites = useMemo(() => {
    if (!Array.isArray(competitors)) return [];
    return competitors.filter((c) => isActiveSyncUiState(getSyncUiState(c.id, c.isSyncing)));
  }, [competitors, getSyncUiState]);

  const primaryActiveSite = useMemo(
    () => (activeSyncSites.length > 0 ? activeSyncSites[0] : null),
    [activeSyncSites],
  );

  const terminalTrafficPattern = useMemo(
    () => [true, false, true, true, false, true, false, true, true, false, true, false],
    [],
  );

  useEffect(() => {
    if (!hasActiveSync) {
      syncPollingStartedAtRef.current = null;
      unchangedProgressPollsRef.current = 0;
      lastProgressSignatureRef.current = "";
      return;
    }

    if (syncPollingStartedAtRef.current === null) {
      syncPollingStartedAtRef.current = Date.now();
    }

    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = (delayMs: number) => {
      if (isCancelled) return;
      timeoutId = setTimeout(poll, delayMs);
    };

    const poll = async () => {
      if (isCancelled) return;

      // Pause polling while tab is hidden to reduce unnecessary load.
      if (document.visibilityState === "hidden") {
        scheduleNext(10000);
        return;
      }

      const progressResult = await fetchCompetitorProgress();

      if (!progressResult.ok) {
        // On transient errors, back off polling to reduce pressure.
        scheduleNext(20000);
        return;
      }

      if (progressResult.activeSyncCount === 0) {
        await fetchCompetitors(true);
        const hasTransientState = Object.values(syncUiStateBySiteRef.current).some(
          (state) => state === "STARTING" || state === "STOPPING",
        );

        if (hasTransientState) {
          scheduleNext(3000);
          return;
        }

        syncPollingStartedAtRef.current = null;
        unchangedProgressPollsRef.current = 0;
        lastProgressSignatureRef.current = "";
        return;
      }

      if (progressResult.changed) {
        unchangedProgressPollsRef.current = 0;
      } else {
        unchangedProgressPollsRef.current += 1;
      }

      const startedAt = syncPollingStartedAtRef.current ?? Date.now();
      const elapsedMs = Date.now() - startedAt;
      let nextDelayMs = elapsedMs < 60000 ? 5000 : 15000;

      if (unchangedProgressPollsRef.current >= 3) {
        nextDelayMs = Math.max(nextDelayMs, 15000);
      }
      if (unchangedProgressPollsRef.current >= 10) {
        nextDelayMs = Math.max(nextDelayMs, 30000);
      }

      scheduleNext(nextDelayMs);
    };

    poll();

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [hasActiveSync, fetchCompetitors, fetchCompetitorProgress]);

  const onSubmit = async (data: CompetitorFormValues) => {
    setLoading(true);
    try {
      // Extract competitor info from the search URL
      const info = extractCompetitorInfo(data.searchUrl);

      if (!info) {
        toast.error("Invalid URL format");
        setLoading(false);
        return;
      }

      const payload = {
        name: info.name,
        baseUrl: info.baseUrl,
        searchQueryPattern: info.searchPattern || undefined,
      };

      const res = await fetch("/api/v1/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(`Crawler deployed for ${info.name}`);
        if (info.searchPattern) {
          toast.success(`Search pattern detected: ${info.searchPattern}`);
        }
        setIsAdding(false);
        form.reset();
        fetchCompetitors();
      } else {
        const result = await res.json();
        toast.error(result.error || "Failed to deploy crawler");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncSite = async (id: string) => {
    if (syncActionBySiteRef.current[id]) {
      return;
    }

    let force = false;
    const competitor = Array.isArray(competitors) ? competitors.find((c) => c.id === id) : undefined;
    const uiState = getSyncUiState(id, competitor?.isSyncing);

    if (uiState === "STARTING" || uiState === "STOPPING") {
      return;
    }

    if (uiState === "RUNNING") {
      const shouldForce = confirm(
        "A sync is already marked as in progress. If it's stuck, you can force a restart. Do you want to restart the sync?",
      );
      if (!shouldForce) return;
      force = true;
    }

    const actionVersion = beginSyncAction(id, "START");
    applySyncUiEvent(id, { type: "START_REQUEST" });

    setCompetitors((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
            ...c,
            isSyncing: true,
            status: "SYNCING",
            syncProcessed: 0,
            syncTotal: c.syncTotal ?? 0,
            syncLastAction: "Queuing sync job...",
          }
          : c,
      ),
    );

    try {
      const res = await fetch("/api/v1/competitors/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: id, force }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (errorData?.code === "ADVANCED_PROTECTION_REQUIRES_SERVICES") {
          const targetSite = competitors.find((c) => c.id === id) || null;
          setAdvancedPromptSite(targetSite);
          setAdvancedMissingRequirements(
            Array.isArray(errorData?.missingRequirements)
              ? errorData.missingRequirements
              : ["proxy", "captcha"],
          );
          if (targetSite) {
            await loadAdvancedAccessConfig(targetSite.id);
          }
          applySyncUiEvent(id, { type: "START_FAILED" });
          await fetchCompetitors(true);
          return;
        }
        throw new Error(errorData.error || "Failed to start sync");
      }

      const result = await res.json();

      if (result.success) {
        if (!isLatestSyncAction(id, actionVersion)) return;
        toast.success("Sync started successfully. Monitoring progress...");
        applySyncUiEvent(id, { type: "BACKEND_SNAPSHOT", backendSyncing: true });
        await fetchCompetitorProgress();
      } else {
        throw new Error(result.error || "Sync failed to start");
      }

    } catch (error) {
      if (!isLatestSyncAction(id, actionVersion)) return;
      // Revert state if request failed
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start sync";
      toast.error(errorMessage);
      applySyncUiEvent(id, { type: "START_FAILED" });

      // Fetch fresh data to revert optimistic update
      await fetchCompetitors(true);
    } finally {
      clearSyncAction(id, actionVersion);
    }
  };

  const handleStopSync = async (id: string) => {
    if (syncActionBySiteRef.current[id]) {
      return;
    }

    const competitor = Array.isArray(competitors) ? competitors.find((c) => c.id === id) : undefined;
    const uiState = getSyncUiState(id, competitor?.isSyncing);
    if (uiState === "IDLE" || uiState === "STOPPED" || uiState === "STARTING") {
      return;
    }

    const actionVersion = beginSyncAction(id, "STOP");
    applySyncUiEvent(id, { type: "STOP_REQUEST" });

    try {
      const res = await fetch("/api/v1/competitors/sync/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: id }),
      });

      if (res.ok) {
        toast.info("Crawler shutdown signal sent");
        // Keep visual state stable; progress endpoint is source of truth for stop completion.
        setCompetitors((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                ...c,
                isSyncing: true,
                status: "SYNCING",
                syncLastAction: "Stopping crawler...",
              }
              : c,
          ),
        );
        await fetchCompetitorProgress();
        window.setTimeout(() => {
          if (!isLatestSyncAction(id, actionVersion)) return;
          fetchCompetitorProgress();
        }, 1200);
      } else {
        const errorData = await res.json().catch(() => ({}));
        applySyncUiEvent(id, { type: "STOP_FAILED" });
        toast.error(errorData.error || "Failed to stop crawler");
      }
    } catch (error) {
      applySyncUiEvent(id, { type: "STOP_FAILED" });
      const errorMessage =
        error instanceof Error ? error.message : "Failed to stop crawler";
      toast.error(errorMessage);
    } finally {
      clearSyncAction(id, actionVersion);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to remove this competitor site? All tracking data for this site will be lost.",
      )
    )
      return;

    try {
      const res = await fetch(`/api/v1/competitors?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Competitor removed");
        fetchCompetitors();
      } else {
        toast.error("Failed to remove competitor");
      }
    } catch (error) {
      toast.error("Connection error");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/v1/imports/competitors", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();
        toast.success(
          `Import complete: Added ${result.added} sites. Skipped ${result.skipped}.`,
        );
        fetchCompetitors();
      } else {
        const result = await res.json();
        toast.error(result.error || "Failed to import sites");
      }
    } catch (error) {
      toast.error("Network error during import");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const [limits, setLimits] = useState({ storeLimit: 1, competitorLimit: 3 });

  const fetchLimits = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/tenant/limits");
      if (res.ok) {
        const data = await res.json();
        setLimits(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Open Settings Modal
  const openSettings = (site: Competitor) => {
    setEditingSite(site);

    // If DB has a pattern, use it.
    if (site.searchQueryPattern) {
      setSearchPatternInput(site.searchQueryPattern);
    } else {
      // Otherwise, check if we have a known default for this domain
      try {
        const hostname = new URL(site.url).hostname.replace("www.", "");
        const defaultPattern = KNOWN_SEARCH_PATTERNS[hostname] || "";
        setSearchPatternInput(defaultPattern);
      } catch (e) {
        setSearchPatternInput("");
      }
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    if (!editingSite) return;
    setIsSavingSettings(true);

    try {
      const res = await fetch(`/api/v1/competitors/${editingSite.id}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchQueryPattern: searchPatternInput }),
      });

      if (res.ok) {
        toast.success("Search pattern updated successfully");
        setEditingSite(null);
        fetchCompetitors(true); // Refresh list
      } else {
        toast.error("Failed to update settings");
      }
    } catch (error) {
      toast.error("Connection error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const loadAdvancedAccessConfig = async (siteId: string) => {
    setIsAdvancedConfigLoading(true);
    try {
      const res = await fetch(`/api/v1/competitors/${siteId}/advanced-access`);
      if (!res.ok) return;
      const json = await res.json();
      const proxy = json?.data?.proxy || {};
      const captcha = json?.data?.captcha || {};
      setAdvancedForm((prev) => ({
        ...prev,
        proxyEnabled: Boolean(proxy.enabled ?? true),
        proxyProtocol: (proxy.protocol || "http") as "http" | "https" | "socks5",
        proxyHost: proxy.host || "",
        proxyPort: proxy.port ? String(proxy.port) : "",
        proxyUsername: proxy.username || "",
        proxyPassword: "",
        captchaEnabled: Boolean(captcha.enabled ?? true),
        captchaProvider: captcha.provider || "2captcha",
        captchaApiKey: "",
      }));
    } catch {
      // best effort only
    } finally {
      setIsAdvancedConfigLoading(false);
    }
  };

  const saveAdvancedAccessConfig = async (): Promise<boolean> => {
    if (!advancedPromptSite) return false;
    setIsAdvancedConfigSaving(true);
    try {
      const payload = {
        proxyEnabled: advancedForm.proxyEnabled,
        proxyProtocol: advancedForm.proxyProtocol,
        proxyHost: advancedForm.proxyHost.trim() || undefined,
        proxyPort: advancedForm.proxyPort ? Number(advancedForm.proxyPort) : undefined,
        proxyUsername: advancedForm.proxyUsername.trim() || undefined,
        proxyPassword: advancedForm.proxyPassword.trim() || undefined,
        captchaEnabled: advancedForm.captchaEnabled,
        captchaProvider: advancedForm.captchaProvider.trim() || undefined,
        captchaApiKey: advancedForm.captchaApiKey.trim() || undefined,
      };

      const res = await fetch(`/api/v1/competitors/${advancedPromptSite.id}/advanced-access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        toast.error(result?.error || "Failed to save advanced access settings");
        return false;
      }

      const result = await res.json();
      if (result?.data?.status !== "READY") {
        toast.error("Proxy and captcha solver must both be configured to continue.");
        return false;
      }

      toast.success("Advanced access configured. You can continue sync now.");
      return true;
    } catch {
      toast.error("Connection error while saving advanced access");
      return false;
    } finally {
      setIsAdvancedConfigSaving(false);
    }
  };

  const handleSaveAndContinueAdvancedSync = async () => {
    if (!advancedPromptSite) return;
    const saved = await saveAdvancedAccessConfig();
    if (!saved) return;

    const target = advancedPromptSite;
    setAdvancedPromptSite(null);
    setAdvancedMissingRequirements([]);
    await fetchCompetitors(true);
    await handleSyncSite(target.id);
  };

  useEffect(() => {
    fetchCompetitors();
    fetchLimits();
  }, [fetchCompetitors, fetchLimits]);

  // fetchLimits is memoized above



  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Competitors</h2>
          <p className="text-muted-foreground text-sm">
            Monitor and track rival pricing strategies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              window.location.href = "/api/v1/exports/competitors";
              toast.success("Downloading competitor list...");
            }}
            className="bg-secondary text-secondary-foreground text-sm font-semibold px-4 py-2 rounded-md hover:bg-secondary/80 transition-all border border-border flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          <label className="bg-primary/5 text-primary text-sm font-semibold px-4 py-2 rounded-md border border-primary/10 hover:bg-primary/10 transition-all flex items-center gap-2 cursor-pointer active:scale-95">
            {isImporting ? (
              <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <Filter className="w-4 h-4 rotate-180" />
            )}
            Import
            <input
              type="file"
              className="hidden"
              accept=".csv"
              onChange={handleImport}
              disabled={isImporting}
            />
          </label>

          {!isAdding && competitors.length < limits.competitorLimit && (
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="w-4 h-4" />
              Add Site
            </Button>
          )}
          {competitors.length >= limits.competitorLimit && !isAdding && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-lg">
              <ShieldAlert className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                Tracker Limit Reached ({competitors.length}/
                {limits.competitorLimit})
              </span>
            </div>
          )}
        </div>
      </div>

      {isAdding ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="bg-card border border-border rounded-lg p-8 space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Deploy Crawler</h3>
                <p className="text-xs text-muted-foreground">
                  Setup monitoring for a new target website.
                </p>
              </div>
              <button
                onClick={() => setIsAdding(false)}
                className="p-2 hover:bg-muted rounded-md text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="searchUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Competitor Search URL
                      </FormLabel>
                      <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors" />
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            placeholder="https://competitor.com/search?q=laptop"
                            className="pl-10"
                          />
                        </FormControl>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        <strong>Just paste a search URL!</strong> Go to the competitor site, search for any product, copy the URL from your browser, and paste it here. We&apos;ll automatically extract everything we need.
                      </p>
                      <div className="mt-3 p-3 bg-primary/5 border border-primary/10 rounded-md">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">Example:</p>
                        <code className="text-[10px] text-muted-foreground break-all block">
                          https://www.ryans.com/search?q=laptop
                        </code>
                      </div>
                      <FormMessage className="text-xs font-bold" />
                    </FormItem>
                  )}
                />

                <div className="p-4 bg-muted/30 rounded-md border border-border space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ShieldAlert className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      Compliance
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    PricePilot only accesses public data and respects robots.txt
                    to ensure store stability.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-primary text-primary-foreground font-semibold py-2.5 rounded-md transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-current" />
                        Deploy Crawler
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 bg-secondary text-secondary-foreground font-semibold py-2.5 rounded-md border border-border transition-all text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </Form>
          </div>

          <div className="hidden lg:block space-y-6">
            {[
              {
                icon: Search,
                title: "Discovery",
                desc: "We map category structure to find matches.",
              },
              {
                icon: Target,
                title: "Matching",
                desc: "AI-powered product recognition.",
              },
              {
                icon: MousePointer2,
                title: "Live Updates",
                desc: "Prices monitored daily at midnight UTC.",
              },
            ].map((step, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                  <step.icon className="w-5 h-5 text-muted-foreground/60" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="py-4 px-6">Source</th>
                  <th className="py-4 px-6 text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="cursor-help flex items-center justify-center gap-1 mx-auto uppercase">
                          Products
                          <Info className="w-3 h-3 text-muted-foreground/50" />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs font-semibold">(Your Products with matches / Your Total Products)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </th>
                  <th className="py-4 px-6">Protection</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 w-48">Health</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {isDataLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-20 text-center text-muted-foreground animate-pulse"
                    >
                      Scanning market signals...
                    </td>
                  </tr>
                ) : competitors.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-20 text-center text-muted-foreground"
                    >
                      <div className="space-y-4">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                          <Globe className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                        <div>
                          <h4 className="font-semibold">No Sites Tracked</h4>
                          <p className="text-sm text-muted-foreground">
                            Add a competitor website to start monitoring prices.
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  Array.isArray(competitors) && competitors.map((comp) => {
                    const uiSyncState = getSyncUiState(comp.id, comp.isSyncing);
                    const isSyncActive = isActiveSyncUiState(uiSyncState);
                    const isActionBusy =
                      Boolean(syncActionBySite[comp.id]) ||
                      uiSyncState === "STARTING";
                    const displayStatus = getSyncStatusLabel(uiSyncState, comp.status);
                    const showStopAction = uiSyncState === "RUNNING" || uiSyncState === "STOPPING";

                    return (
                      <tr
                        key={comp.id}
                        className={cn(
                          "border-b border-border/50 hover:bg-muted/30 transition-colors",
                          isSyncActive && "bg-primary/2",
                        )}
                      >
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-10 h-10 rounded-md flex items-center justify-center transition-all",
                                isSyncActive
                                  ? "bg-primary/20 text-primary animate-pulse"
                                  : "bg-muted text-muted-foreground/50",
                              )}
                            >
                              <Globe
                                className={cn(
                                  "w-5 h-5",
                                  isSyncActive && "animate-spin-slow",
                                )}
                              />
                            </div>
                            <div>
                              <div className="text-foreground font-semibold">
                                {comp.name}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {new URL(comp.url).hostname}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6 text-center">
                          {isSyncActive ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-1" />
                              <span className="font-mono text-xs font-bold text-primary animate-pulse">
                                {comp.syncTotal && comp.syncTotal > 0
                                  ? `${comp.syncProcessed} / ${comp.syncTotal}`
                                  : uiSyncState === "STOPPING"
                                    ? "Stopping..."
                                    : "Starting..."}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center">
                              <span className="font-bold text-foreground text-xs">
                                ({comp.products.toLocaleString()} / {comp.totalUserProducts?.toLocaleString() || "0"})
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-5 px-6">
                          {comp.isAdvancedProtected ? (
                            <div className="flex items-center gap-2 group cursor-help">
                              <div className="flex -space-x-1">
                                <ShieldAlert className="w-5 h-5 text-warning fill-warning/20 drop-shadow-[0_0_8px_rgba(var(--warning-rgb),0.4)]" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-warning leading-tight">Advanced</span>
                                <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">Golden Rule</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                              <ShieldCheck className="w-5 h-5 text-success/70" />
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Standard</span>
                            </div>
                          )}
                        </td>
                        <td className="py-5 px-6">
                          <span
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase flex items-center gap-1.5 w-fit",
                              displayStatus === "ACTIVE"
                                ? "bg-success/5 border-success/10 text-success"
                                : isSyncActive
                                  ? "bg-primary/10 border-primary/20 text-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary-rgb),0.1)]"
                                  : displayStatus === "STOPPED"
                                    ? "bg-danger/10 border-danger/20 text-danger"
                                    : displayStatus === "NO MATCHES"
                                      ? "bg-warning/10 border-warning/20 text-warning"
                                      : "bg-muted border-border text-muted-foreground",
                            )}
                          >
                            {isSyncActive && (
                              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                            )}
                            {displayStatus}
                          </span>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                                {isSyncActive ? "Sync Progress" : "Site Health"}
                              </span>
                              <span className="text-[9px] font-black text-muted-foreground">
                                {isSyncActive
                                  ? comp.syncTotal && comp.syncTotal > 0
                                    ? `${Math.round((comp.syncProcessed! / comp.syncTotal) * 100)}%`
                                    : "0%"
                                  : `${comp.health}%`}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden relative">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-700 ease-out",
                                  isSyncActive
                                    ? "bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]"
                                    : "bg-success",
                                )}
                                style={{
                                  width: isSyncActive
                                    ? comp.syncTotal && comp.syncTotal > 0
                                      ? `${(comp.syncProcessed! / comp.syncTotal) * 100}%`
                                      : "5%"
                                    : `${comp.health}%`,
                                }}
                              />
                              {isSyncActive && (
                                <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                              )}
                            </div>
                            {isSyncActive &&
                              comp.syncStartedAt &&
                              comp.syncProcessed! > 0 && (
                                <p className="text-[8px] font-medium text-muted-foreground/60 italic">
                                  Est:{" "}
                                  {(() => {
                                    const start = new Date(
                                      comp.syncStartedAt,
                                    ).getTime();
                                    const elapsed = Date.now() - start;
                                    const perItem = elapsed / comp.syncProcessed!;
                                    const remaining =
                                      (comp.syncTotal! - comp.syncProcessed!) *
                                      perItem;
                                    const seconds = Math.round(remaining / 1000);
                                    return seconds > 60
                                      ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
                                      : `${seconds}s`;
                                  })()}{" "}
                                  remaining
                                </p>
                              )}
                          </div>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <div className="flex items-center justify-end gap-2 text-muted-foreground">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openSettings(comp)}
                              className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                              title="Configure Search Pattern"
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                            <button
                              onClick={() =>
                                showStopAction
                                  ? handleStopSync(comp.id)
                                  : handleSyncSite(comp.id)
                              }
                              disabled={isActionBusy}
                              className={cn(
                                "p-2 rounded-md transition-all group",
                                showStopAction
                                  ? "bg-danger/10 text-danger hover:bg-danger/20"
                                  : "hover:bg-primary/10 hover:text-primary",
                                isActionBusy && "opacity-50 cursor-not-allowed",
                              )}
                              title={
                                showStopAction ? "Stop Crawler" : "Force Sync"
                              }
                            >
                              {showStopAction ? (
                                <X className="w-4 h-4 animate-pulse" />
                              ) : (
                                <Zap className="w-4 h-4 transition-transform group-active:scale-95" />
                              )}
                            </button>
                            <a
                              href={comp.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-muted rounded-md transition-all"
                              title="View Website"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleDelete(comp.id)}
                              className="p-2 hover:bg-danger/10 rounded-md hover:text-danger transition-all"
                              title="Remove Tracker"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Global Terminal Feed - Bottom of Table */}
          <div className="mt-6">
            <div className="mt-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-950 rounded-xl border border-white/10 shadow-2xl overflow-hidden">
                {/* Terminal Header */}
                <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/40" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/40" />
                    </div>
                    {primaryActiveSite ? (
                      <div className="text-[10px] font-mono uppercase tracking-widest ml-2 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-bold">
                            [SYSTEM]
                          </span>
                          <span className="text-white/40">
                            INITIATING DATA STREAM FOR:
                          </span>
                          <span className="text-white font-bold">
                            {primaryActiveSite.name.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    {primaryActiveSite ? (
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary animate-ping" />
                        <span className="text-[9px] font-mono text-white/40 uppercase font-bold">
                          PROGRESS:{" "}
                          <span className="text-primary">
                            {primaryActiveSite.syncProcessed}
                          </span>
                          /
                          <span className="text-white/60">
                            {primaryActiveSite.syncTotal}
                          </span>
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Terminal Body - Vercel Build Log Style */}
                <div className="p-0 font-mono text-[11px] h-75 flex flex-col bg-[#0a0a0a]">
                  <div
                    ref={scrollContainerRef}
                    onScroll={(e) => {
                      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                      // Detect if user scrolled up (threshold 50px)
                      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
                      setIsAutoScroll(isAtBottom);
                    }}
                    className="flex-1 overflow-y-auto p-4 space-y-0.5 scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-white/10"
                  >
                    {activeSyncSites.length > 0 ? (
                      activeSyncSites.map((site) => (
                        <div key={site.id} className="space-y-0.5">
                          {/* Real Database Logs */}
                          {(site.logs || [])
                            .slice()
                            .reverse()
                            .map((log: any, _idx: number) => (
                              <div
                                key={log.id}
                                className="group flex gap-3 px-2 py-0.5 hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-primary/40"
                              >
                                <span className="text-white/20 shrink-0 select-none w-16">
                                  {new Date(log.createdAt).toLocaleTimeString(
                                    [],
                                    { hour12: false },
                                  )}
                                </span>
                                <span
                                  className={cn(
                                    "font-black shrink-0 w-12",
                                    log.level === "SUCCESS"
                                      ? "text-green-500"
                                      : log.level === "ERROR"
                                        ? "text-red-500"
                                        : log.level === "WARN"
                                          ? "text-amber-500"
                                          : "text-blue-500",
                                  )}
                                >
                                  {log.level}
                                </span>
                                <span className="text-white/80 break-all">
                                  {log.message}
                                </span>
                              </div>
                            ))}

                          {/* Fallback if no logs yet */}
                          {(!site.logs || site.logs.length === 0) && (
                            <div className="flex gap-3 px-2 py-0.5 text-white/40 italic">
                              <span className="animate-pulse">_</span>
                              <span>
                                Establishing secure tunnel to {site.name}...
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex items-center justify-center text-white/20 uppercase tracking-widest text-[10px]">
                        System Standby - No Active Crawlers
                      </div>
                    )}

                    {/* Final system signal */}
                    {activeSyncSites.length > 0 && (
                      <div className="flex gap-3 px-2 py-2 text-primary/80 font-bold">
                        <span className="animate-pulse">&gt;</span>
                        <span className="animate-pulse">
                          Awaiting next telemetry packet...
                        </span>
                      </div>
                    )}

                    {/* Auto-scroll anchor removed in favor of scrollTop */}
                  </div>

                  {/* Traffic Footer Strip */}
                  <div className="bg-white/2 border-t border-white/5 px-4 py-2 flex items-center justify-between">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] text-white/30 uppercase">
                          CPU
                        </span>
                        <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500/50 w-[40%]" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] text-white/30 uppercase">
                          MEM
                        </span>
                        <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500/50 w-[65%]" />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {terminalTrafficPattern.map((isActive, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-1.5 h-1.5 rounded-sm transition-all duration-300",
                            isActive ? "bg-primary/40" : "bg-white/5",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Settings Modal */}
      <Dialog open={!!editingSite} onOpenChange={(open) => !open && setEditingSite(null)}>
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle>Configure Search Pattern</DialogTitle>
            <DialogDescription>
              Define how PricePilot searches for products on <strong>{editingSite?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pattern" className="text-sm font-semibold">
                  Search URL Pattern
                </Label>
                <Input
                  id="pattern"
                  placeholder="Paste full URL or pattern: /search?q={query}"
                  value={searchPatternInput || ""}
                  onChange={(e) => setSearchPatternInput(e.target.value)}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (!value) return;

                    // If user pasted a full URL (doesn't contain {query}), extract pattern
                    if (value.includes('http') && !value.includes('{query}')) {
                      const info = extractCompetitorInfo(value);
                      if (info && info.searchPattern) {
                        setSearchPatternInput(info.searchPattern);
                        toast.success(`Pattern extracted: ${info.searchPattern}`);
                      } else {
                        toast.info("Couldn't auto-detect pattern. Please add {query} manually.");
                      }
                    }
                  }}
                  className="font-mono text-xs"
                />
              </div>

              <div className="bg-muted/40 p-4 rounded-lg border border-border text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold text-primary">
                  <div className="p-1 bg-primary/10 rounded">
                    <Zap className="w-3 h-3" />
                  </div>
                  <span>How it works</span>
                </div>
                <ul className="space-y-2 text-muted-foreground list-disc pl-4">
                  <li>
                    Replace the search term in the URL with <code className="bg-muted px-1 py-0.5 rounded font-mono text-foreground">{`{query}`}</code>.
                  </li>
                  <li>
                    <strong>Example:</strong> For a site <em>{editingSite?.url ? new URL(editingSite.url).hostname : "example.com"}</em> that searches like <code>/search?keyword=iphone</code>, enter:
                    <br />
                    <code className="block mt-1 bg-background border px-2 py-1 rounded">/search?keyword={"{query}"}</code>
                  </li>
                  {editingSite && KNOWN_SEARCH_PATTERNS[new URL(editingSite.url).hostname.replace("www.", "")] && (
                    <li className="text-success font-medium">
                      We detected a known site! A recommended pattern has been auto-filled.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSite(null)} disabled={isSavingSettings}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
              {isSavingSettings ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!advancedPromptSite}
        onOpenChange={(open) => {
          if (!open) {
            setAdvancedPromptSite(null);
            setAdvancedMissingRequirements([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Advanced Anti-Bot Protection Detected</DialogTitle>
            <DialogDescription>
              This competitor site requires both proxy and captcha solver service before sync can continue.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
            Missing requirements:{" "}
            {advancedMissingRequirements.length > 0
              ? advancedMissingRequirements.join(" + ").toUpperCase()
              : "PROXY + CAPTCHA"}
          </div>

          {isAdvancedConfigLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading existing advanced access settings...
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Proxy Service</Label>
                  <input
                    type="checkbox"
                    checked={advancedForm.proxyEnabled}
                    onChange={(e) =>
                      setAdvancedForm((prev) => ({
                        ...prev,
                        proxyEnabled: e.target.checked,
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Protocol</Label>
                    <select
                      className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
                      value={advancedForm.proxyProtocol}
                      onChange={(e) =>
                        setAdvancedForm((prev) => ({
                          ...prev,
                          proxyProtocol: e.target.value as "http" | "https" | "socks5",
                        }))
                      }
                    >
                      <option value="http">http</option>
                      <option value="https">https</option>
                      <option value="socks5">socks5</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Host</Label>
                    <Input
                      value={advancedForm.proxyHost}
                      onChange={(e) =>
                        setAdvancedForm((prev) => ({ ...prev, proxyHost: e.target.value }))
                      }
                      placeholder="proxy.example.com"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Port</Label>
                    <Input
                      value={advancedForm.proxyPort}
                      onChange={(e) =>
                        setAdvancedForm((prev) => ({ ...prev, proxyPort: e.target.value }))
                      }
                      placeholder="8080"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Username (optional)</Label>
                    <Input
                      value={advancedForm.proxyUsername}
                      onChange={(e) =>
                        setAdvancedForm((prev) => ({ ...prev, proxyUsername: e.target.value }))
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Password (optional; leave empty to keep existing)</Label>
                    <Input
                      type="password"
                      value={advancedForm.proxyPassword}
                      onChange={(e) =>
                        setAdvancedForm((prev) => ({ ...prev, proxyPassword: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Captcha Solver Service</Label>
                  <input
                    type="checkbox"
                    checked={advancedForm.captchaEnabled}
                    onChange={(e) =>
                      setAdvancedForm((prev) => ({
                        ...prev,
                        captchaEnabled: e.target.checked,
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Provider</Label>
                    <Input
                      value={advancedForm.captchaProvider}
                      onChange={(e) =>
                        setAdvancedForm((prev) => ({ ...prev, captchaProvider: e.target.value }))
                      }
                      placeholder="2captcha"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">API Key (leave empty to keep existing)</Label>
                    <Input
                      type="password"
                      value={advancedForm.captchaApiKey}
                      onChange={(e) =>
                        setAdvancedForm((prev) => ({ ...prev, captchaApiKey: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAdvancedPromptSite(null);
                setAdvancedMissingRequirements([]);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              disabled={isAdvancedConfigSaving}
              onClick={async () => {
                await saveAdvancedAccessConfig();
              }}
            >
              {isAdvancedConfigSaving ? "Saving..." : "Save"}
            </Button>
            <Button
              disabled={isAdvancedConfigSaving}
              onClick={handleSaveAndContinueAdvancedSync}
            >
              {isAdvancedConfigSaving ? "Please wait..." : "Save & Continue Sync"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
