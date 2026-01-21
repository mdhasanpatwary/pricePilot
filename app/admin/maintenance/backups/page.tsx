"use client";

import { useState, useEffect } from "react";
import {
  Database,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  AlertTriangle,
  FileArchive,
  Clock,
  HardDrive,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetchBackups();
  }, []);

  async function fetchBackups() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/backups");
      if (res.ok) {
        const data = await res.json();
        setBackups(data);
      } else {
        toast.error("Failed to load backups");
      }
    } catch (err) {
      toast.error("Connection error while fetching backups");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBackup() {
    setRunning(true);
    const toastId = toast.loading("Creating database snapshot...");
    try {
      const res = await fetch("/api/v1/admin/backups", { method: "POST" });
      if (res.ok) {
        toast.success("Backup created successfully!", { id: toastId });
        fetchBackups();
      } else {
        toast.error("Failed to create backup", { id: toastId });
      }
    } catch (err) {
      toast.error("Connection error", { id: toastId });
    } finally {
      setRunning(false);
    }
  }

  async function handleDeleteBackup(filename: string) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

    try {
      const res = await fetch(`/api/v1/admin/backups/${filename}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Backup deleted");
        setBackups(backups.filter((b) => b.filename !== filename));
      } else {
        toast.error("Failed to delete backup");
      }
    } catch (err) {
      toast.error("Connection error");
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Database Backups
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your SQL snapshots and ensure data recoverability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchBackups}
            className="p-2.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors border border-border"
            title="Refresh list"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
          <button
            onClick={handleCreateBackup}
            disabled={running}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/10 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Create Manual Backup
          </button>
        </div>
      </div>

      {/* Warning Card */}
      <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold text-amber-500">Data Safety Advice</p>
          <p className="text-amber-500/80 mt-1 leading-relaxed">
            Local backups are saved on the server disk. For maximum security, we
            recommend periodically downloading these files to an external
            location or configuring an off-site cloud sync. Standard retention
            is set to 7 days.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Backup List */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-muted/30 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Recent Snapshots
              </h2>
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                {backups.length} Files Found
              </span>
            </div>

            <div className="divide-y divide-border">
              {loading && backups.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                  <RefreshCw className="w-8 h-8 animate-spin mb-4 text-primary/30" />
                  <p className="text-sm font-medium">
                    Scanning backup directory...
                  </p>
                </div>
              ) : backups.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                  <Database className="w-12 h-12 mb-4 text-muted-foreground/20" />
                  <p className="text-sm font-medium">No backups found.</p>
                  <p className="text-xs mt-1">
                    Click &ldquo;Create Manual Backup&rdquo; to start.
                  </p>
                </div>
              ) : (
                backups.map((backup) => (
                  <div
                    key={backup.filename}
                    className="group px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/5 rounded-lg text-primary">
                        <FileArchive className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {backup.filename}
                        </p>
                        <div className="flex items-center gap-3 mt-1 underline-offset-4">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {format(
                              new Date(backup.createdAt),
                              "MMM d, yyyy HH:mm",
                            )}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                            <HardDrive className="w-3 h-3" />
                            {formatBytes(backup.size)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() =>
                          window.open(
                            `/api/v1/admin/backups/${backup.filename}`,
                          )
                        }
                        className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground border border-transparent hover:border-border"
                        title="Download Backup"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(backup.filename)}
                        className="p-2 hover:bg-danger/10 hover:text-danger rounded-lg transition-colors text-muted-foreground border border-transparent hover:border-danger/20"
                        title="Delete Permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Stats and Info Area */}
        <div className="space-y-6">
          <div className="bg-zinc-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold">System Integrity</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                PricePilot performs a deep SQL dump. This captures all tenants,
                items, matching rules, and market histories.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-medium">
                    Backup Script
                  </span>
                  <span className="text-success font-bold font-mono">
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-medium">
                    Storage Engine
                  </span>
                  <span className="text-white font-bold font-mono">
                    PostgreSQL
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-medium">
                    Auto-Retention
                  </span>
                  <span className="text-white font-bold font-mono">7 Days</span>
                </div>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-primary/20 rounded-full blur-[60px]" />
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Restoration Guide
            </h4>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                To restore a database from one of these files:
              </p>
              <div className="bg-muted px-3 py-2.5 rounded-lg border border-border">
                <code className="text-[10px] font-mono whitespace-nowrap overflow-x-auto block">
                  gunzip &lt; backup.sql.gz | psql $DB_URL
                </code>
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                Note: Restoration is a critical action and must be performed via
                terminal by a system administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
