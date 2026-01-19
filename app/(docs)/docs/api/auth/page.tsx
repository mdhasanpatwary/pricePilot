import CodeBlock from "@/components/docs/code-block";
import Callout from "@/components/docs/callout";
import { Shield, Lock, ArrowRight, Code } from "lucide-react";
import Link from "next/link";

export default function APIAuthPage() {
  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      {/* Page Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
          <Code className="w-3.5 h-3.5" /> API Reference
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Authentication
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
          Secure your requests to the PricePilot API using Bearer Token
          authentication.
        </p>
      </div>

      <div className="h-px bg-border/50" />

      {/* Introduction */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">API Keys</h2>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-4 max-w-2xl">
          <p>
            All PricePilot API requests must be authenticated using an API Key.
            You can generate and manage your keys in the{" "}
            <Link
              href="/dashboard/settings"
              className="text-primary font-bold hover:underline"
            >
              API Settings
            </Link>{" "}
            section of your dashboard.
          </p>
          <p>
            Your API Key is a sensitive credential. Never share it, commit it to
            version control, or use it in client-side code where it could be
            intercepted.
          </p>
        </div>
      </section>

      {/* Header Usage */}
      <section className="space-y-6 pt-6">
        <h2 className="text-2xl font-bold tracking-tight">Using the API Key</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Authentication is handled via the{" "}
          <code className="font-mono text-xs font-bold px-1 py-0.5 bg-muted rounded">
            X-PricePilot-Token
          </code>{" "}
          HTTP header.
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X GET "https://api.pricepilot.com/v1/products" \\
     -H "X-PricePilot-Token: your_api_key_here" \\
     -H "Content-Type: application/json"`}
        />

        <Callout type="info">
          The API also supports standard{" "}
          <code className="font-mono text-xs">Authorization: Bearer</code>{" "}
          headers as an alternative.
        </Callout>
      </section>

      {/* Security Best Practices */}
      <section className="space-y-6 pt-10">
        <h2 className="text-2xl font-bold tracking-tight">
          Security Standards
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-bold">HTTPS Only</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We require HTTPS for all API requests to protect your data during
              transmission. Non-SSL requests will be rejected.
            </p>
          </div>
          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-bold">Token Rotation</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We recommend rotating your API tokens every 90 days. You can
              invalidate old tokens instantly in the dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* Error States */}
      <section className="space-y-8 pt-10">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Auth Error Codes
          </h2>
          <p className="text-sm text-muted-foreground">
            Standardized responses for failed authentication requests.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-6 py-4 font-bold text-foreground">Code</th>
                <th className="px-6 py-4 font-bold text-foreground">Status</th>
                <th className="px-6 py-4 font-bold text-foreground">
                  Resolution
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {[
                {
                  code: "401",
                  status: "Unauthorized",
                  res: "Missing or invalid API token.",
                },
                {
                  code: "403",
                  status: "Forbidden",
                  res: "Token lacks required permissions.",
                },
                {
                  code: "429",
                  status: "Rate Limited",
                  res: "Too many requests. Back off for 60s.",
                },
              ].map((row) => (
                <tr
                  key={row.code}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-xs font-bold text-primary">
                    {row.code}
                  </td>
                  <td className="px-6 py-4 text-foreground font-medium">
                    {row.status}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground italic">
                    {row.res}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="pt-10 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-border mt-20">
        <p className="text-sm text-muted-foreground italic">
          Ready to make your first request?
        </p>
        <Link
          href="/docs/api/endpoints"
          className="flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all"
        >
          Explore Endpoints <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
