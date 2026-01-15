import Callout from "@/components/docs/callout";
import { UserPlus, Link2, Puzzle, Zap, ArrowRight, Rocket } from "lucide-react";
import Link from "next/link";

export default function QuickstartPage() {
  const steps = [
    {
      title: "Create your account",
      description: "Sign up for a PricePilot account to get your unique API credentials and access the dashboard.",
      icon: UserPlus,
      href: "/register",
      action: "Sign Up Free",
    },
    {
      title: "Connect your store",
      description: "Add your store URL and select your platform (Shopify, Laravel, etc.) in the connections panel.",
      icon: Link2,
      href: "/dashboard/connections",
      action: "Add Store",
    },
    {
      title: "Install the integration",
      description: "Follow the platform-specific guide to install the PricePilot client on your store server.",
      icon: Puzzle,
      href: "/docs/installation",
      action: "View Guides",
    },
    {
      title: "Start optimizing",
      description: "Import your products and set up your first pricing rule to start reacting to market changes.",
      icon: Zap,
      href: "/dashboard/intelligence",
      action: "Set Rules",
    },
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      {/* Page Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
          <Rocket className="w-3.5 h-3.5" /> Getting Started
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Quick Start
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
          Get up and running with PricePilot in less than 10 minutes. Follow these four essential steps to start optimizing your store.
        </p>
      </div>

      <div className="h-px bg-border/50" />

      {/* Steps List */}
      <div className="space-y-10">
        {steps.map((step, index) => (
          <div key={step.title} className="group relative flex gap-8">
            {/* Step Indicator */}
            <div className="hidden sm:flex flex-col items-center">
              <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-border bg-background text-[11px] font-bold text-muted-foreground group-hover:border-primary/30 group-hover:text-primary transition-colors">
                {index + 1}
              </div>
              {index !== steps.length - 1 && (
                <div className="w-px flex-1 bg-border my-2" />
              )}
            </div>

            {/* Step Content */}
            <div className="flex-1 space-y-4 pb-8">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <step.icon className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-lg font-bold tracking-tight">{step.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                  {step.description}
                </p>
              </div>

              <Link
                href={step.href}
                className="inline-flex items-center gap-2 text-xs font-bold text-primary px-4 py-2 rounded-md bg-primary/5 hover:bg-primary/10 transition-all border border-primary/10"
              >
                {step.action} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <Callout type="success" title="Ready for production?">
        Once you&apos;ve completed the quick start, check our <Link href="/docs/api/auth" className="font-bold underline decoration-primary/30">Security Standards</Link> to ensure your production environment is fully optimized.
      </Callout>

      <div className="p-8 rounded-lg border border-border bg-muted/20 flex flex-col md:flex-row items-center justify-between gap-6 mt-16 text-center md:text-left">
        <div className="space-y-1">
          <h4 className="text-base font-bold">Need a deeper dive?</h4>
          <p className="text-xs text-muted-foreground">Read our full installation manual for enterprise configurations.</p>
        </div>
        <Link
          href="/docs/installation"
          className="px-6 py-2.5 bg-foreground text-background text-xs font-bold rounded-md hover:opacity-90 transition-opacity"
        >
          View Full Installation Guide
        </Link>
      </div>
    </div>
  );
}
