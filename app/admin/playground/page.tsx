"use client";

import { useState } from "react";
import { Search, Loader2, AlertCircle, CheckCircle } from "lucide-react";

export default function ScraperPlayground() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setResult(null);
    setError("");

    try {
      const res = await fetch("/api/v1/admin/scraper-playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to scrape");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Scraper Playground
        </h1>
        <p className="text-muted-foreground">
          Test and debug scraper capabilities on specific product URLs.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="p-6 bg-card border rounded-lg shadow-sm">
            <form onSubmit={handleScrape} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="url" className="text-sm font-medium">
                  Target URL
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    id="url"
                    type="url"
                    placeholder="https://example.com/product/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border rounded-md bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !url}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 px-4 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  "Scrape URL"
                )}
              </button>
            </form>
          </div>

          <div className="p-6 bg-card border rounded-lg shadow-sm">
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">
              Instructions
            </h3>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              <li>
                Enter a full product URL from a supported competitor site.
              </li>
              <li>
                The scraper will attempt to extract title, price, stock status,
                and currency.
              </li>
              <li>
                It uses multiple strategies including JSON-LD, OpenGraph, and
                CSS selectors.
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Scraping Failed</p>
                <p className="text-sm opacity-90">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="p-6 bg-card border rounded-lg shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Successfully Scraped</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 p-3 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Title
                  </p>
                  <p className="font-medium">{result.title}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Price
                  </p>
                  <p className="font-mono text-lg font-semibold">
                    {result.currency} {result.price}
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <p
                    className={`font-medium ${result.inStock ? "text-green-600" : "text-red-500"}`}
                  >
                    {result.inStock ? "In Stock" : "Out of Stock"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Raw Data
                </p>
                <pre className="p-4 bg-zinc-950 text-zinc-50 rounded-md overflow-x-auto text-xs font-mono">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {!result && !error && !loading && (
            <div className="h-full min-h-[300px] flex items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground">
              <div className="text-center">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Results will appear here</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
