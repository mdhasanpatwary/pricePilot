import Callout from "@/components/docs/callout";
import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
// Link removed

export default function ErrorsPage() {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-[0.2em]">
          <AlertCircle className="w-4 h-4" /> API Reference
        </div>
        <h1 className="font-outfit text-4xl font-black tracking-tighter md:text-5xl text-foreground">
          Error Codes
        </h1>
        <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
          A comprehensive guide to understanding and resolving PricePilot API
          errors.
        </p>
      </div>

      <hr className="border-border" />

      <section className="space-y-8">
        <p className="text-sm text-muted-foreground leading-relaxed">
          PricePilot uses standard HTTP response codes to indicate the success
          or failure of an API request. In general: codes in the{" "}
          <code>2xx</code> range indicate success. Codes in the <code>4xx</code>{" "}
          range indicate an error that failed given the information provided
          (e.g., a required parameter was omitted, a charge failed, etc.). Codes
          in the <code>5xx</code> range indicate an error with PricePilot&apos;s
          servers.
        </p>

        <Card className="overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-6 py-4 font-bold text-foreground">Status</th>
                <th className="px-6 py-4 font-bold text-foreground">Meaning</th>
                <th className="px-6 py-4 font-bold text-foreground">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {[
                {
                  code: "200",
                  meaning: "OK",
                  desc: "Everything worked as expected.",
                },
                {
                  code: "400",
                  meaning: "Bad Request",
                  desc: "The request was unacceptable, often due to missing a required parameter.",
                },
                {
                  code: "401",
                  meaning: "Unauthorized",
                  desc: "No valid API key provided.",
                },
                {
                  code: "402",
                  meaning: "Request Failed",
                  desc: "The parameters were valid but the request failed.",
                },
                {
                  code: "403",
                  meaning: "Forbidden",
                  desc: "The API key doesn't have permissions to perform the request.",
                },
                {
                  code: "404",
                  meaning: "Not Found",
                  desc: "The requested resource doesn't exist.",
                },
                {
                  code: "409",
                  meaning: "Conflict",
                  desc: "The request conflicts with another request (perhaps due to using the same idempotent key).",
                },
                {
                  code: "429",
                  meaning: "Too Many Requests",
                  desc: "Too many requests hit the API too quickly.",
                },
                {
                  code: "500, 502, 503, 504",
                  meaning: "Server Errors",
                  desc: "Something went wrong on PricePilot's end.",
                },
              ].map((row) => (
                <tr
                  key={row.code}
                  className="hover:bg-muted/10 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-xs font-bold text-primary">
                    {row.code}
                  </td>
                  <td className="px-6 py-4 text-foreground font-semibold">
                    {row.meaning}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground italic leading-relaxed">
                    {row.desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="space-y-6 pt-6">
        <h3 className="text-2xl font-bold tracking-tight">
          Error Response Format
        </h3>
        <p className="text-sm text-muted-foreground">
          When an error occurs, the response body will contain a structured JSON
          object explaining the failure.
        </p>
        <div className="bg-muted/30 rounded-xl p-6 font-mono text-xs border border-border">
          <pre className="text-foreground">
            {`{
  "status": "error",
  "error": {
    "code": "invalid_parameters",
    "message": "The 'sku' field is required for price updates.",
    "doc_url": "https://docs.pricepilot.com/api/errors#invalid_parameters"
  }
}`}
          </pre>
        </div>
      </section>

      <Callout type="info">
        In the meantime, if you encounter an unexpected error, please check the{" "}
        <code className="font-mono text-xs">status</code> code of the response
        and contact support if it persists.
      </Callout>
    </div>
  );
}
