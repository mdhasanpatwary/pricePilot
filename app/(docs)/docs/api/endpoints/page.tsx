import CodeBlock from "@/components/docs/code-block";
import Callout from "@/components/docs/callout";
import { ArrowRight, Code } from "lucide-react";
import Link from "next/link";

export default function APIEndpointsPage() {
  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      {/* Page Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
          <Code className="w-3.5 h-3.5" /> API Reference
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Endpoints
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
          Comprehensive reference for PricePilot core API endpoints. Base URL:{" "}
          <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-foreground font-bold">
            https://api.pricepilot.com/v1
          </code>
        </p>
      </div>

      <div className="h-px bg-border/50" />

      {/* Sync Endpoint */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">
            GET
          </span>
          <h2 className="text-2xl font-bold tracking-tight inline-flex items-center gap-2">
            /products/sync
          </h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Retrieve a synchronized list of products between PricePilot and your
          connected store. This is the primary endpoint for reconciliation.
        </p>

        <div className="space-y-4 pt-2">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-foreground/70">
            Sample Response
          </p>
          <CodeBlock
            language="json"
            code={`{
  "status": "success",
  "data": {
    "synced_count": 124,
    "last_sync": "2024-03-15T12:00:00Z",
    "items": [
      { "id": "prod_1", "sku": "ABC-123", "price": 29.99 }
    ]
  }
}`}
          />
        </div>
      </section>

      {/* Competitors Endpoint */}
      <section className="space-y-6 pt-10 border-t border-border/30">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">
            GET
          </span>
          <h2 className="text-2xl font-bold tracking-tight inline-flex items-center gap-2">
            /competitors
          </h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Retrieve a list of all competitor sites and their health status
          currently being monitored.
        </p>

        <div className="space-y-4 pt-2">
          <CodeBlock
            language="json"
            code={`{
  "status": "success",
  "competitors": [
    {
      "id": "comp_1",
      "baseUrl": "https://rival-shop.com",
      "status": "HEALTHY",
      "lastSync": "2024-03-15T15:20:00Z"
    }
  ]
}`}
          />
        </div>
      </section>

      {/* Rules Endpoint */}
      <section className="space-y-6 pt-10 border-t border-border/30">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase tracking-wider border border-amber-500/20">
            GET
          </span>
          <h2 className="text-2xl font-bold tracking-tight inline-flex items-center gap-2">
            /rules
          </h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          List all active pricing strategies and their current parameters.
        </p>

        <div className="space-y-4 pt-2">
          <CodeBlock
            language="json"
            code={`{
  "status": "success",
  "rules": [
    {
      "id": "rule_1",
      "name": "Market Undercutter",
      "strategy": "UNDERCUT",
      "parameter": 0.50,
      "isActive": true
    }
  ]
}`}
          />
        </div>
      </section>

      {/* Update Endpoint */}
      <section className="space-y-6 pt-10 border-t border-border/30">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
            POST
          </span>
          <h2 className="text-2xl font-bold tracking-tight inline-flex items-center gap-2">
            /products/price-update
          </h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Update the price and inventory status for a specific product SKU.
        </p>

        <div className="space-y-4 pt-2">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-foreground/70">
            Request Body
          </p>
          <CodeBlock
            language="json"
            code={`{
  "sku": "ABC-123",
  "new_price": 24.99,
  "currency": "USD",
  "reason": "Competitor matched"
}`}
          />
        </div>
      </section>

      <Callout type="warning">
        Rate limiting is enforced at 100 requests per minute per API key.
        Exceeding this will result in{" "}
        <code className="font-mono text-xs">429 Too Many Requests</code>.
      </Callout>

      <div className="pt-10 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-border mt-20">
        <p className="text-sm text-muted-foreground italic">
          Need help with complex queries?
        </p>
        <Link
          href="/docs/faq"
          className="flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all"
        >
          Visit FAQ <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
