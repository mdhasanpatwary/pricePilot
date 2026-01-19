import Callout from "@/components/docs/callout";
import { Puzzle, Globe, CheckCircle2, ArrowRight, Layers } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function InstallationPage() {
  const platforms = [
    {
      name: "Laravel",
      href: "/docs/laravel",
      icon: "/icons/platforms/laravel.png",
      status: "Official",
    },
    {
      name: "Shopify",
      href: "/docs/shopify",
      icon: "/icons/platforms/shopify.svg",
      status: "Beta",
    },
    {
      name: "WooCommerce",
      href: "/docs/woocommerce",
      icon: "/icons/platforms/woocommerce.svg",
      status: "Soon",
    },
    {
      name: "Magento",
      href: "/docs/magento",
      icon: "/icons/platforms/magento.png",
      status: "Soon",
    },
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      {/* Page Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5" /> Setup Guide
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Installation
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
          Connect PricePilot to your store using our official integrations or
          our flexible REST API.
        </p>
      </div>

      <div className="h-px bg-border/50" />

      {/* Integration Methods */}
      <section className="space-y-8">
        <h2 className="text-2xl font-bold tracking-tight">Methods</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 rounded-lg border border-border bg-card space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-muted text-muted-foreground rounded-md">
                <Puzzle className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold tracking-tight">
                Official Plugins
              </h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Recommended for standard e-commerce builds. Plug-and-play
              synchronization with zero configuration.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-success/70" />{" "}
                Auto-updates
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-success/70" /> High
                Perf
              </div>
            </div>
          </div>

          <div className="p-8 rounded-lg border border-border bg-card space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-muted text-muted-foreground rounded-md">
                <Globe className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold tracking-tight">
                Technical API
              </h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For custom frameworks and enterprise headless setups. Full control
              over data flows and event handling.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                Native REST
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                GraphQL Soon
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* platform grid */}
      <section className="space-y-8 pt-6">
        <h2 className="text-2xl font-bold tracking-tight">
          Supported Platforms
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {platforms.map((p) => (
            <Link
              key={p.name}
              href={p.href}
              className="p-6 rounded-lg border border-border bg-card hover:bg-muted/10 transition-all group text-center space-y-4"
            >
              <div className="relative w-10 h-10 mx-auto grayscale group-hover:grayscale-0 transition-all opacity-40 group-hover:opacity-100 flex items-center justify-center">
                <Image
                  src={p.icon}
                  alt={p.name}
                  fill
                  className="object-contain"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">{p.name}</p>
                <p
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-widest italic",
                    p.status === "Official"
                      ? "text-primary/60"
                      : p.status === "Beta"
                        ? "text-amber-600/60"
                        : "text-muted-foreground/40",
                  )}
                >
                  {p.status}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Callout type="info">
        Using a custom framework? Start with our{" "}
        <Link
          href="/docs/api/auth"
          className="font-bold underline decoration-primary/30"
        >
          API Authentication
        </Link>{" "}
        guide.
      </Callout>

      {/* footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-10 border-t border-border mt-20">
        <Link
          href="/docs/quickstart"
          className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Back to Quick Start
        </Link>
        <Link
          href="/docs/laravel"
          className="flex items-center gap-2 text-xs font-bold text-primary group"
        >
          Integration Details{" "}
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
