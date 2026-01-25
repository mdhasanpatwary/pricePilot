"use client";

import { useState } from "react";
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Database,
  Globe,
  Server,
  Network,
  ShieldAlert,
  Play,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type DiagnosisStatus = "healthy" | "warning" | "failed" | "pending";

interface DiagnosticResult {
  status: DiagnosisStatus;
  message: string;
}

interface DiagnosticsData {
  results: {
    database: DiagnosticResult;
    redis: DiagnosticResult;
    internet: DiagnosticResult;
    proxies: DiagnosticResult;
    integrations: DiagnosticResult;
  };
  duration: number;
  timestamp: string;
}

export default function DiagnosticsPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [error, setError] = useState("");

  const runDiagnostics = async () => {
    setLoading(true);
    setError("");
    setData(null);

    try {
      const res = await fetch("/api/v1/admin/diagnostics", {
        method: "POST",
      });

      if (!res.ok) throw new Error("Request failed");

      const result = await res.json();
      setData(result);
    } catch (err) {
      setError("Failed to run diagnostics. Please check server logs.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: DiagnosisStatus) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return (
          <div className="w-5 h-5 rounded-full border-2 border-muted border-t-transparent animate-spin" />
        );
    }
  };

  const getStatusColor = (status: DiagnosisStatus) => {
    switch (status) {
      case "healthy":
        return "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400";
      case "warning":
        return "bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400";
      case "failed":
        return "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400";
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            System Diagnostics
          </h1>
          <p className="text-muted-foreground">
            Run a comprehensive health check on system components and
            connectivity.
          </p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {loading ? (
            <Skeleton className="w-4 h-4 rounded-full" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {loading ? "Running Tests..." : "Run Diagnostics"}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5" />
          {error}
        </div>
      )}

      {!data && !loading && !error && (
        <div className="border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium text-foreground">Ready to Test</p>
          <p>Click the button above to start the system check.</p>
        </div>
      )}

      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Database */}
          <StatusCard
            title="Database"
            icon={Database}
            result={data.results.database}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
          />

          {/* Redis */}
          <StatusCard
            title="Cache Layer (Redis)"
            icon={Server}
            result={data.results.redis}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
          />

          {/* Internet */}
          <StatusCard
            title="Internet Connectivity"
            icon={Globe}
            result={data.results.internet}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
          />

          {/* Proxies */}
          <StatusCard
            title="Scraper Proxies"
            icon={Network}
            result={data.results.proxies}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
          />

          {/* Integrations */}
          <StatusCard
            title="Store Integrations"
            icon={Activity}
            result={data.results.integrations}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
            fullWidth
          />

          <div className="md:col-span-2 text-center text-xs text-muted-foreground mt-4">
            Last check performed at {new Date(data.timestamp).toLocaleString()}{" "}
            • Duration: {data.duration}ms
          </div>
        </div>
      )}
    </div>
  );
}

function StatusCard({
  title,
  icon: Icon,
  result,
  getStatusIcon,
  getStatusColor,
  fullWidth = false,
}: {
  title: string;
  icon: any;
  result: DiagnosticResult;
  getStatusIcon: (s: DiagnosisStatus) => React.ReactNode;
  getStatusColor: (s: DiagnosisStatus) => string;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`p-6 rounded-lg border bg-card ${fullWidth ? "md:col-span-2" : ""
        }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted/50 rounded-md">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">{title}</h3>
        </div>
        {getStatusIcon(result.status)}
      </div>
      <div
        className={`px-3 py-2 rounded-md text-sm font-medium border ${getStatusColor(
          result.status,
        )}`}
      >
        {result.message}
      </div>
    </div>
  );
}
