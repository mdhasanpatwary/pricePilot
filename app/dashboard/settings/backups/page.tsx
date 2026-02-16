"use client";

import { useState, useEffect } from "react";
import {
  Download,
  Cloud,
  Save,
  ShieldCheck,
  Database,
  Link as LinkIcon,
  RefreshCw,
  ExternalLink,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface BackupConfig {
  googleDriveLink?: string;
  lastUpdated?: string;
}

export default function TenantBackupPage() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<BackupConfig>({});
  const [googleDriveLink, setGoogleDriveLink] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/v1/tenant/settings");
      if (res.ok) {
        const data = await res.json();
        const backupConfig = data.tenant.backupConfig || {};
        setConfig(backupConfig);
        setGoogleDriveLink(backupConfig.googleDriveLink || "");
      }
    } catch (err) {
      console.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/tenant/backup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleDriveLink }),
      });

      if (res.ok) {
        toast.success("Backup settings saved");
        fetchSettings();
      } else {
        toast.error("Failed to save settings");
      }
    } catch (err) {
      toast.error("Connection error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleManualExport() {
    setIsExporting(true);
    toast.info("Generating your data export... This might take a few seconds.");
    try {
      // Direct window location change for file download
      window.location.href = "/api/v1/tenant/backup";
      toast.success("Export started");
    } catch (err) {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary/30" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data & Backups</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Control your pricing data, export snapshots, and manage cloud storage
          links.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Export Data Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm flex flex-col">
          <div className="p-3 bg-primary/10 w-fit rounded-xl mb-6">
            <Database className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Manual Data Export</h2>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            Download a complete snapshot of your catalog, sites, and pricing
            rules in JSON format. This allows you to keep an offline record of
            your market intelligence.
          </p>
          <div className="mt-auto">
            <button
              onClick={handleManualExport}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/10 active:scale-[0.98]"
            >
              {isExporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Generate Export (.json)
            </button>
          </div>
        </div>

        {/* Cloud Sync Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm flex flex-col">
          <div className="p-3 bg-blue-500/10 w-fit rounded-xl mb-6">
            <Cloud className="w-6 h-6 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Cloud Storage</h2>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            Specify a Google Drive folder where you store your exported backups.
            This helps your administration track your off-site redundancy.
          </p>

          <div className="space-y-4 mt-auto">
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <input
                type="url"
                placeholder="https://drive.google.com/..."
                value={googleDriveLink}
                onChange={(e) => setGoogleDriveLink(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-xl py-3 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all active:scale-[0.98]"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Configuration
            </button>
          </div>
        </div>
      </div>

      {/* Security Info */}
      <div className="bg-zinc-900 rounded-3xl p-10 text-white relative overflow-hidden shadow-2xl mt-8">
        <div className="relative z-10 flex flex-col md:flex-row gap-10 items-center">
          <div className="shrink-0">
            <div className="p-5 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/10">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
          </div>
          <div className="space-y-4 text-center md:text-left">
            <h3 className="text-2xl font-bold">Data Sovereignty</h3>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
              Your data is exported with full integrity. The JSON snapshot
              includes all product details, competitor matches, and historical
              snapshots. We use AES-256 for system backups, but your manual
              exports are provided unencrypted for direct accessibility.
            </p>
            <div className="flex flex-wrap gap-4 pt-4 justify-center md:justify-start">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-white/5 py-1 px-3 rounded-full border border-white/5">
                <Info className="w-3 h-3" />
                JSON Format
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-white/5 py-1 px-3 rounded-full border border-white/5">
                <ShieldCheck className="w-3 h-3" />
                GDPR Compliant
              </div>
            </div>
          </div>
          {config.googleDriveLink && (
            <a
              href={config.googleDriveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="md:ml-auto group flex items-center gap-3 bg-white/10 hover:bg-white/20 transition-all p-4 rounded-2xl border border-white/10"
            >
              <div className="text-right">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">
                  My Cloud Storage
                </p>
                <p className="text-xs font-bold">Open Google Drive</p>
              </div>
              <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          )}
        </div>

        {/* Glow effects */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px]" />
      </div>
    </div>
  );
}
