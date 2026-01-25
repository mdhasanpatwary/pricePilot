import {
  ArrowRight,
  Key,
  List,
  AlertTriangle,
  Zap,
  Terminal,
  Shield,
} from "lucide-react";
import Link from "next/link";

export default function APIDocsIndex() {
  const sections = [
    {
      icon: Key,
      title: "Authentication",
      description: "Learn how to secure your API requests using bearer tokens.",
      link: "/docs/api/auth",
      label: "Secure your calls",
    },
    {
      icon: List,
      title: "Endpoints",
      description:
        "Full list of available API endpoints for products, rules, and sync.",
      link: "/docs/api/endpoints",
      label: "Full Reference",
    },
    {
      icon: AlertTriangle,
      title: "Errors",
      description:
        "Understand our error codes and how to handle them gracefully.",
      link: "/docs/api/errors",
      label: "Debug errors",
    },
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      {/* Page Header */}
      <div className="space-y-4 text-center max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-2 text-primary font-bold text-[11px] uppercase tracking-widest">
          <Zap className="w-3.5 h-3.5 fill-current" /> Public API
        </div>
        <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-6xl">
          Integrate PricePilot
        </h1>
        <p className="text-xl text-muted-foreground leading-relaxed">
          Automate your pricing workflows and sync market data directly into
          your existing infrastructure with our robust REST API.
        </p>
      </div>

      <div className="h-px bg-linear-to-r from-transparent via-border to-transparent" />

      {/* API Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sections.map((section) => (
          <Link
            key={section.title}
            href={section.link}
            className="group p-8 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center mb-6 group-hover:bg-primary/10 transition-colors">
              <section.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
              {section.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {section.description}
            </p>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-tighter text-primary group-hover:gap-3 transition-all">
              {section.label} <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Start Card */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-muted/30 p-8 md:p-12">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Terminal className="w-64 h-64" />
        </div>
        <div className="relative max-w-2xl">
          <h2 className="text-3xl font-black tracking-tight mb-4">
            Quick Start
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Every request requires an{" "}
            <code className="font-mono text-xs font-bold px-1.5 py-0.5 bg-background border border-border rounded">
              X-PricePilot-Token
            </code>{" "}
            header. You can generate one in your tenant dashboard.
          </p>
          <div className="bg-background/80 backdrop-blur-sm border border-border rounded-xl p-6 font-mono text-sm overflow-x-auto shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-muted-foreground">
              <div className="w-3 h-3 rounded-full bg-danger/20" />
              <div className="w-3 h-3 rounded-full bg-warning/20" />
              <div className="w-3 h-3 rounded-full bg-success/20" />
              <span className="ml-2 text-[10px] font-bold uppercase tracking-widest">
                Request Example
              </span>
            </div>
            <span className="text-primary">curl</span> -X GET{" "}
            <span className="text-secondary">
              &quot;https://api.pricepilot.com/v1/products&quot;
            </span>{" "}
            \<br />
            &nbsp;&nbsp;&nbsp;&nbsp; -H{" "}
            <span className="text-secondary">
              &quot;X-PricePilot-Token: sk_live_9a2f...&quot;
            </span>
          </div>
        </div>
      </div>

      {/* More Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 border-t border-border">
        <div className="space-y-4">
          <h4 className="text-lg font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-success" /> Security First
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Our API uses TLS 1.3 for all transmissions. Your data is encrypted
            at rest and in transit. We recommend using Environment Variables to
            store your keys.
          </p>
        </div>
        <div className="space-y-4 text-right">
          <p className="text-sm text-muted-foreground italic">
            Having trouble with your integration?
          </p>
          <Link
            href="/support"
            className="inline-flex items-center gap-2 text-primary font-bold hover:underline"
          >
            Contact Developer Support <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
