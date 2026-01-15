import CodeBlock from "@/components/docs/code-block";
import Callout from "@/components/docs/callout";
import { Terminal, Download, Zap, Shield, Link2, BookOpen, Check, Puzzle, Activity } from "lucide-react";
import Link from "next/link";

export default function LaravelDocsPage() {
  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      {/* Page Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
          <Puzzle className="w-3.5 h-3.5" /> Integrations
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Laravel Integration
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
          Integrate your Laravel application with PricePilot for automated inventory syncing and dynamic pricing updates.
        </p>
      </div>

      <div className="h-px bg-border/50" />

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/integrations/laravel"
          className="flex items-center gap-4 p-5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors group"
        >
          <div className="p-2.5 bg-primary text-primary-foreground rounded-md shadow-sm">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground group-hover:underline">Download Package</p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight italic">v1.0.0 • ZIP Archive</p>
          </div>
        </Link>
        <div className="flex items-center gap-4 p-5 rounded-lg border border-border bg-card">
          <div className="p-2.5 bg-muted text-muted-foreground rounded-md">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">API Reference</p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Technical Spec</p>
          </div>
        </div>
      </div>

      {/* Prerequisites */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Prerequisites</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-3">
          {[
            "PHP 8.2 or higher",
            "Laravel 10.x or 11.x",
            "PricePilot Account & API Token",
            "Composer dependency manager"
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-1 h-1 rounded-full bg-border" />
              {item}
            </div>
          ))}
        </div>
      </section>

      {/* Installation Step 1 */}
      <section className="space-y-6 pt-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <span className="text-muted-foreground/20 font-black italic">01.</span>
            Installation
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Currently, the PricePilot client is distributed as a local package. Extract the contents into your project&apos;s <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-foreground font-bold">packages/pricepilot-laravel</code> directory.
          </p>
        </div>

        <Callout type="info">
          Packagist (Composer) support is coming soon for streamlined updates.
        </Callout>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">1. Define the local repository in <code className="font-mono text-xs opacity-70">composer.json</code>:</p>
          <CodeBlock
            filename="composer.json"
            language="json"
            code={`"repositories": [
    {
        "type": "path",
        "url": "./packages/pricepilot-laravel",
        "options": {
            "symlink": true
        }
    }
],`}
          />
        </div>

        <div className="space-y-3 pt-2">
          <p className="text-sm font-medium text-foreground">2. Install the package via Composer:</p>
          <CodeBlock
            language="bash"
            code="composer require pricepilot/laravel-client"
          />
        </div>
      </section>

      {/* Configuration Step 2 */}
      <section className="space-y-6 pt-10">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <span className="text-muted-foreground/20 font-black italic">02.</span>
            Initial Setup
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Register the service provider and publish the configuration files to your application.
          </p>
        </div>
        <CodeBlock
          language="bash"
          code="php artisan pricepilot:install"
        />

        <Callout type="warning" title="Security Requirement">
          Always store your API tokens in <code className="font-mono text-xs">.env</code>. Never commit raw tokens to your version control system.
        </Callout>
      </section>

      {/* API Token Step 3 */}
      <section className="space-y-6 pt-10">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <span className="text-muted-foreground/20 font-black italic">03.</span>
            Environment Config
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Configure your store credentials in the <code className="font-mono text-xs font-bold">.env</code> file.
          </p>
        </div>
        <CodeBlock
          filename=".env"
          language="env"
          code={`PRICEPILOT_API_TOKEN=your_secure_token_here
PRICEPILOT_ROUTE_PREFIX=pricepilot/v1`}
        />
      </section>

      {/* Final Step */}
      <section className="space-y-6 pt-10">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3 text-success">
            <Check className="w-5 h-5" />
            Verification
          </h2>
        </div>
        <div className="p-8 rounded-lg border border-border bg-card space-y-4 shadow-sm">
          <div className="flex items-center gap-3 text-foreground">
            <Activity className="w-4 h-4 text-success" />
            <h4 className="text-base font-bold tracking-tight">Verify Connectivity</h4>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Run a health check against your store API to ensure PricePilot can reach your integration.
          </p>
          <CodeBlock
            language="bash"
            code={`curl -H "X-PricePilot-Token: YOUR_TOKEN" https://yourstore.com/pricepilot/v1/health`}
          />
        </div>
      </section>

      {/* Success Footer */}
      <div className="p-10 rounded-lg bg-muted/20 border border-border flex flex-col md:flex-row items-center justify-between gap-8 mt-20">
        <div className="space-y-2 text-center md:text-left">
          <h4 className="text-xl font-bold tracking-tight">Next Steps</h4>
          <p className="text-sm text-muted-foreground font-medium">Head back to the dashboard to finalize your store connection.</p>
        </div>
        <Link
          href="/dashboard/connections"
          className="px-8 py-3 bg-foreground text-background font-bold text-xs uppercase tracking-widest rounded-md hover:opacity-90 transition-all shadow-md"
        >
          Finalize Connection
        </Link>
      </div>
    </div>
  );
}
