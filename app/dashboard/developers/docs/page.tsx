"use client";

import { useState } from "react";
import {
  BookOpen,
  Code2,
  Terminal,
  ShieldCheck,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export default function ApiDocsPage() {
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);

  const endpoints = [
    {
      method: "GET",
      path: "/analytics/summary",
      desc: "Retrieve real-time market intelligence summarized for your dashboard.",
      headers: ["x-api-key: pp_..."],
      response: `{
  "stats": {
    "totalSKUs": 450,
    "activeRivals": 5,
    "marketEdge": 12.50
  }
}`,
    },
    {
      method: "GET",
      path: "/products",
      desc: "Fetch your entire product catalog with current prices and stock status.",
      headers: ["x-api-key: pp_..."],
      response: `[
  {
    "id": "uuid-...",
    "sku": "IPHONE-13",
    "title": "iPhone 13 128GB",
    "currentPrice": 799.00
  }
]`,
    },
    {
      method: "POST",
      path: "/webhooks",
      desc: "Register a new outgoing webhook endpoint for real-time notifications.",
      body: `{
  "url": "https://api.myapp.com/webhooks/pricepilot",
  "secret": "optional_signing_secret"
}`,
      response: `{
  "id": "webhook_uuid",
  "url": "...",
  "isActive": true
}`,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto py-12 px-6 animate-in fade-in duration-700">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-[0.2em] text-xs">
            <Terminal className="w-4 h-4" />
            Developer Tools
          </div>
          <h1 className="text-4xl font-black tracking-tighter">
            Interactive API Reference
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Integrate PricePilot directly into your own systems using our
            high-performance REST API.
          </p>
        </div>
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-2 text-sm font-bold bg-muted hover:bg-muted/80 px-4 py-2 rounded-lg transition-all border border-border"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 space-y-8">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 border-b border-border pb-2">
              Authentication
            </h3>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <ShieldCheck className="w-4 h-4" />
                API Key Required
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                All requests must include the{" "}
                <code className="bg-primary/10 px-1 rounded">x-api-key</code>{" "}
                header. Generate keys in your developer settings.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 border-b border-border pb-2">
              Core Endpoints
            </h3>
            <nav className="flex flex-col gap-1">
              {endpoints.map((ep) => (
                <button
                  key={ep.path}
                  onClick={() => setActiveEndpoint(ep.path)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-all text-left ${
                    activeEndpoint === ep.path
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded ${
                      ep.method === "GET"
                        ? "bg-success/20 text-success"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {ep.method}
                  </span>
                  {ep.path}
                </button>
              ))}
            </nav>
          </div>

          <div className="pt-4">
            <a
              href="/openapi.json"
              target="_blank"
              className="flex items-center justify-between gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors bg-muted/30 p-3 rounded-lg border border-dashed border-border group"
            >
              Download OpenAPI Spec
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </aside>

        {/* Documentation Content */}
        <main className="lg:col-span-9 space-y-12">
          {endpoints.map((ep) => (
            <section
              key={ep.path}
              id={ep.path}
              className={`scroll-mt-24 p-8 rounded-2xl border transition-all duration-500 ${
                activeEndpoint === ep.path
                  ? "border-primary/50 bg-primary/[0.02] shadow-2xl shadow-primary/5"
                  : "border-border bg-card shadow-sm"
              }`}
            >
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-black px-3 py-1 rounded-full ${
                        ep.method === "GET"
                          ? "bg-success/10 text-success border border-success/20"
                          : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      }`}
                    >
                      {ep.method}
                    </span>
                    <h2 className="text-xl font-bold tracking-tight">
                      {ep.path}
                    </h2>
                  </div>

                  <p className="text-muted-foreground leading-relaxed">
                    {ep.desc}
                  </p>

                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-foreground/50">
                      Headers
                    </h4>
                    <div className="bg-background border border-border p-3 rounded-lg font-mono text-[13px]">
                      {ep.headers?.map((h) => <div key={h}>{h}</div>) ||
                        "No custom headers"}
                    </div>
                  </div>

                  {ep.body && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-foreground/50">
                        Request Body
                      </h4>
                      <pre className="bg-zinc-900 text-zinc-300 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-white/5 shadow-inner">
                        {ep.body}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-foreground/50 flex items-center gap-2">
                    <Code2 className="w-3.5 h-3.5" />
                    Response Body (200 OK)
                  </h4>
                  <pre className="bg-zinc-950 text-emerald-400 p-6 rounded-2xl font-mono text-xs overflow-x-auto border border-white/10 shadow-2xl">
                    {ep.response}
                  </pre>
                </div>
              </div>
            </section>
          ))}

          <div className="bg-zinc-900 rounded-2xl p-8 text-white relative overflow-hidden group">
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
              <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xl shrink-0 group-hover:scale-110 transition-transform duration-500">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-xl font-bold">Standard Documentation</h3>
                <p className="text-zinc-400 text-sm">
                  Looking for general usage guides and platform integration
                  steps?
                </p>
              </div>
              <button
                onClick={() => window.open("/docs", "_blank")}
                className="bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-zinc-200 transition-all shrink-0 active:scale-95"
              >
                Read Guides
              </button>
            </div>

            {/* Decorative circles */}
            <div className="absolute -right-12 -top-12 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -left-12 -bottom-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
          </div>
        </main>
      </div>
    </div>
  );
}
