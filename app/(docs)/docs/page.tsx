import Link from "next/link";
import {
  Rocket,
  Puzzle,
  Code,
  ArrowRight,
  Zap,
  Shield,
  Activity,
} from "lucide-react";

export default function DocsLandingPage() {
  const categories = [
    {
      title: "Getting Started",
      description:
        "Learn how to set up PricePilot and connect your first store in minutes.",
      icon: Rocket,
      href: "/docs/quickstart",
      borderColor: "border-primary/20",
      iconColor: "text-primary",
    },
    {
      title: "Integrations",
      description:
        "Step-by-step guides for Laravel, Shopify, WooCommerce, and more.",
      icon: Puzzle,
      href: "/docs/laravel",
      borderColor: "border-border",
      iconColor: "text-muted-foreground",
    },
    {
      title: "API Reference",
      description:
        "Complete documentation for our REST API endpoints and webhooks.",
      icon: Code,
      href: "/docs/api/endpoints",
      borderColor: "border-border",
      iconColor: "text-muted-foreground",
    },
  ];

  const features = [
    {
      title: "Product Sync",
      description:
        "Sync your catalog across multiple platforms with automated reconciliation.",
      icon: Activity,
    },
    {
      title: "Dynamic Pricing",
      description:
        "React to competitor changes instantly with customizable pricing rules.",
      icon: Zap,
    },
    {
      title: "Secure Bridge",
      description:
        "Protect your store data with encrypted tokens and secure webhooks.",
      icon: Shield,
    },
  ];

  return (
    <div className="space-y-16 animate-in fade-in duration-500">
      {/* Hero */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Documentation
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
          Complete guides and technical references for the PricePilot e-commerce
          optimization engine.
        </p>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {categories.map((cat) => (
          <Link
            key={cat.title}
            href={cat.href}
            className={`group block p-6 border ${cat.borderColor} rounded-lg bg-card hover:bg-muted/30 transition-all`}
          >
            <div className={`mb-4 ${cat.iconColor}`}>
              <cat.icon className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold mb-2 flex items-center justify-between">
              {cat.title}
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {cat.description}
            </p>
          </Link>
        ))}
      </div>

      <div className="h-px bg-border/50" />

      {/* Core Concepts */}
      <div className="space-y-10">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Platform Overview
          </h2>
          <p className="text-sm text-muted-foreground">
            The core pillars of the PricePilot engine.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {features.map((feature) => (
            <div key={feature.title} className="space-y-3">
              <div className="flex items-center gap-2.5 text-foreground">
                <feature.icon className="w-4 h-4" />
                <h4 className="text-sm font-bold tracking-tight">
                  {feature.title}
                </h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed italic">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Help Section */}
      <div className="p-8 rounded-lg border border-border bg-muted/20 space-y-6">
        <div className="space-y-2">
          <h4 className="text-base font-bold text-foreground">
            Missing something?
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
            Our technical support team is available to help with custom
            integrations and platform-specific deployments.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/support"
            className="px-4 py-2 bg-foreground text-background text-xs font-bold rounded-md hover:opacity-90 transition-opacity"
          >
            Contact Support
          </Link>
          <Link
            href="/community"
            className="px-4 py-2 border border-border text-foreground text-xs font-bold rounded-md hover:bg-muted/50 transition-colors"
          >
            Developer Community
          </Link>
        </div>
      </div>
    </div>
  );
}
