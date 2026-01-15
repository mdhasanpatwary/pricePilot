"use client";

import { useState } from "react";
import { Download, CheckCircle2, FileCode, Terminal, ExternalLink, BookOpen, Zap, Shield, Package } from "lucide-react";
import { toast } from "sonner";

export default function LaravelIntegrationPage() {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch("/api/downloads/laravel");

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pricepilot-laravel-v1.0.0.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Package downloaded successfully!");
    } catch (error) {
      toast.error("Failed to download package. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Laravel Integration</h1>
            <p className="text-muted-foreground">Connect your Laravel e-commerce store to PricePilot</p>
          </div>
        </div>
      </div>

      {/* Version Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-full">
        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
        <span className="text-xs font-bold text-primary uppercase tracking-widest">Latest Version: v1.0.0</span>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Download & Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Download Card */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Download Package</h2>
              <p className="text-sm text-muted-foreground">
                Get the official PricePilot Laravel integration package. No Composer required!
              </p>
            </div>

            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-md transition-all disabled:opacity-50 flex items-center justify-center gap-3 hover:opacity-90 active:scale-[0.98]"
            >
              {isDownloading ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download PricePilot Laravel Package
                </>
              )}
            </button>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>Package size: 26KB • Version 1.0.0 • MIT License</span>
            </div>
          </div>

          {/* Installation Steps */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Installation Steps</h2>
              <p className="text-sm text-muted-foreground">
                Follow these simple steps to integrate PricePilot with your Laravel store
              </p>
            </div>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  1
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="font-bold text-sm">Download & Extract</h3>
                  <p className="text-xs text-muted-foreground">
                    Download the package above and extract it to your Laravel project directory
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  2
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="font-bold text-sm">Run Installation Command</h3>
                  <div className="bg-muted/50 border border-border rounded-md p-3 font-mono text-xs flex items-center justify-between group">
                    <code>php artisan pricepilot:install</code>
                    <Terminal className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This command will automatically configure everything and generate a secure API token
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  3
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="font-bold text-sm">Copy Your API Token</h3>
                  <p className="text-xs text-muted-foreground">
                    The installation command will display your API token. Copy it for the next step.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  4
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="font-bold text-sm">Connect Your Store</h3>
                  <p className="text-xs text-muted-foreground">
                    Go to Integrations → Connect Store → Select Laravel → Enter your store URL and API token
                  </p>
                  <a
                    href="/dashboard/connections"
                    className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
                  >
                    Go to Integrations
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* System Requirements */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h3 className="font-bold">System Requirements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">PHP 8.0+</p>
                  <p className="text-xs text-muted-foreground">PHP 8.0, 8.1, 8.2, or 8.3</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Laravel 9+</p>
                  <p className="text-xs text-muted-foreground">Laravel 9, 10, or 11</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Database</p>
                  <p className="text-xs text-muted-foreground">MySQL, PostgreSQL, or SQLite</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">HTTPS</p>
                  <p className="text-xs text-muted-foreground">Required for production</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Features & Resources */}
        <div className="space-y-6">
          {/* Features */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Key Features
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>One-command installation</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>Automatic token generation</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>Flexible database schema support</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>Real-time price synchronization</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>Automated price updates</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>Laravel event support</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>Comprehensive logging</span>
              </div>
            </div>
          </div>

          {/* Documentation */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Documentation
            </h3>
            <div className="space-y-2">
              <a
                href="/integrations/laravel/QUICKSTART.md"
                target="_blank"
                className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <FileCode className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Quick Start Guide</span>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <a
                href="/integrations/laravel/README.md"
                target="_blank"
                className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <FileCode className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Full Documentation</span>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <a
                href="/integrations/laravel/INTEGRATION_FLOW.md"
                target="_blank"
                className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <FileCode className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Integration Flow</span>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>

          {/* Support */}
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-6 space-y-3">
            <h3 className="font-bold text-sm">Need Help?</h3>
            <p className="text-xs text-muted-foreground">
              Our support team is here to help you get started with the Laravel integration.
            </p>
            <a
              href="mailto:support@pricepilot.com"
              className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
            >
              Contact Support
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
