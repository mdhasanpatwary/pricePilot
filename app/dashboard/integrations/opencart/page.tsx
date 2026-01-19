"use client";

import { useState } from "react";
import {
  Download,
  CheckCircle2,
  ExternalLink,
  Zap,
  Shield,
  Layout,
} from "lucide-react";
import { toast } from "sonner";

export default function OpenCartIntegrationPage() {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch("/api/downloads/opencart");

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pricepilot-opencart-v1.0.0.ocmod.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("OpenCart extension downloaded successfully!");
    } catch (error) {
      toast.error("Failed to download extension. Please try again.");
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
            <Layout className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <a
                href="/dashboard/connections"
                className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
              >
                &larr; Back to Connections
              </a>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              OpenCart Integration
            </h1>
            <p className="text-muted-foreground">
              Connect your OpenCart store to PricePilot
            </p>
          </div>
        </div>
      </div>

      {/* Version Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-full">
        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
        <span className="text-xs font-bold text-primary uppercase tracking-widest">
          Latest Version: v1.0.0
        </span>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Download & Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Download Card */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Download Extension</h2>
              <p className="text-sm text-muted-foreground">
                Get the official PricePilot OpenCart extension. Standard
                .ocmod.zip format for easy installation.
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
                  Download PricePilot OpenCart Extension
                </>
              )}
            </button>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>Version 1.0.0 • Supports OpenCart 3.x • MIT License</span>
            </div>
          </div>

          {/* Installation Steps */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Installation Steps</h2>
              <p className="text-sm text-muted-foreground">
                Follow these simple steps to integrate PricePilot with your
                OpenCart store
              </p>
            </div>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  1
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="font-bold text-sm">Download OCMOD Package</h3>
                  <p className="text-xs text-muted-foreground">
                    Download the{" "}
                    <code className="bg-muted px-1 rounded">.ocmod.zip</code>{" "}
                    extension above. Do not extract it.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  2
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="font-bold text-sm">
                    Upload via Extension Installer
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    In your OpenCart Admin, go to{" "}
                    <b>Extensions &rarr; Installer</b> and upload the downloaded
                    zip file.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  3
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="font-bold text-sm">Refresh Modifications</h3>
                  <p className="text-xs text-muted-foreground">
                    Go to <b>Extensions &rarr; Modifications</b> and click the{" "}
                    <b>Refresh</b> button (top right) to apply changes.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  4
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="font-bold text-sm">Configure Module</h3>
                  <p className="text-xs text-muted-foreground">
                    Go to <b>PricePilot</b> in your sidebar (or Extensions
                    &rarr; Modules &rarr; PricePilot). Enable the status and
                    copy your <b>API Token</b>.
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-success font-bold text-sm">
                  5
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="font-bold text-sm text-success">
                    Connect Your Store
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Now go back to the PricePilot Dashboard and use your store
                    URL and the API token to finalize the connection.
                  </p>
                  <a
                    href="/dashboard/connections"
                    className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
                  >
                    Go back and Connect Store
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Details */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h3 className="font-bold">Technical Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">OpenCart Support</p>
                  <p className="text-xs text-muted-foreground">
                    Version 3.0.x.x and 4.x
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">API Endpoints</p>
                  <p className="text-xs text-muted-foreground">index, update</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Security</p>
                  <p className="text-xs text-muted-foreground">
                    Token-based authentication
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Format</p>
                  <p className="text-xs text-muted-foreground">JSON Response</p>
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
                <span>Zero Core File Overwrites</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>Automatic Product Sync</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>Instant Price Updates</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>Stock Status Monitoring</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <span>Secure Token Auth</span>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-6 space-y-3">
            <h3 className="font-bold text-sm">Need Help?</h3>
            <p className="text-xs text-muted-foreground">
              Our support team is here to help you get started with the OpenCart
              integration.
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

      {/* Final Action */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Ready to Connect?</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Once you have installed the extension and have your API token, you
            are ready to link your store.
          </p>
        </div>
        <a
          href="/dashboard/connections"
          className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-bold hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20"
        >
          Go Back & Connect Store Now
        </a>
      </div>
    </div>
  );
}
