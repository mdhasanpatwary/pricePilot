import * as cheerio from "cheerio";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { TECH_BRANDS } from "@/lib/data/brands";
import { getAllUserAgents } from "@/lib/config/user-agents";
import { SearchPatternLearningService } from "@/lib/services/search-pattern-learning-service";

const BUILTIN_PATTERNS: Record<string, string> = {
  "startech.com.bd": "/product/search?search={query}",
  "ryans.com": "/search?q={query}",
  "ryanscomputers.com": "/search?q={query}",
  "techlandbd.com": "/search/advance/product/result/{query}",
  "techland.com.bd": "/search/advance/product/result/{query}",
};

const COMMON_FALLBACK_PATTERNS = [
  "/search?q={query}",
  "/search?search={query}",
  "/search?keyword={query}",
  "/search?query={query}",
  "/search?term={query}",
  "/product/search?search={query}",
  "/index.php?route=product/search&search={query}",
];

const BLOCKED_PATH_HINTS = [
  "/cart",
  "/checkout",
  "/account",
  "/login",
  "/register",
  "/returns",
  "/refund",
  "/privacy",
  "/terms",
  "/search",
];

interface DiscoveryResult {
  url: string;
  pattern: string;
  source: string;
}

interface QueryPlan {
  queries: string[];
  modelToken?: string;
  brandToken?: string;
  sizeToken?: string;
}

interface QuerySignals {
  originalQuery: string;
  queryTokens: string[];
  modelToken?: string;
  brandToken?: string;
  sizeToken?: string;
}

export class BotSearchDiscoveryService {
  static async discoverProductUrl(baseUrl: string, query: string, siteId?: string): Promise<DiscoveryResult | null> {
    const cleanQuery = this.sanitizeQuery(query);
    if (!cleanQuery) return null;

    const normalizedHost = new URL(baseUrl).hostname.toLowerCase();
    const normalizedDomain = SearchPatternLearningService.normalizeDomain(normalizedHost);
    const queryPlan = this.buildIntelligentFallbackQueries(cleanQuery);

    const candidates = await this.buildSearchCandidates(baseUrl, cleanQuery, siteId, normalizedHost, normalizedDomain);
    const userAgent = this.getRandomUserAgent();
    const searchQueries = [cleanQuery, ...queryPlan.queries.filter((q) => q !== cleanQuery)].slice(0, 3);

    for (const searchQuery of searchQueries) {
      const signals: QuerySignals = {
        originalQuery: searchQuery,
        queryTokens: this.tokenize(searchQuery),
        modelToken: queryPlan.modelToken,
        brandToken: queryPlan.brandToken,
        sizeToken: queryPlan.sizeToken,
      };

      for (const candidate of candidates) {
        const searchUrl = this.buildSearchUrl(baseUrl, searchQuery, candidate.pattern);

        try {
          const response = await fetch(searchUrl, {
            method: "GET",
            headers: {
              "user-agent": userAgent,
              "accept-language": "en-US,en;q=0.9",
              accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            signal: AbortSignal.timeout(20_000),
          });

          if (!response.ok) {
            await this.recordPatternAttempt(normalizedDomain, candidate.pattern, false);
            continue;
          }

          const html = await response.text();
          if (this.looksBlocked(html)) {
            await this.recordPatternAttempt(normalizedDomain, candidate.pattern, false);
            continue;
          }

          if (this.looksLikeNoResultPage(html)) {
            await this.recordPatternAttempt(normalizedDomain, candidate.pattern, false);
            continue;
          }

          const productUrl = this.pickBestProductUrl(html, searchUrl, signals);
          const success = Boolean(productUrl);
          await this.recordPatternAttempt(normalizedDomain, candidate.pattern, success);

          if (productUrl) {
            return {
              url: productUrl,
              pattern: candidate.pattern,
              source: candidate.label,
            };
          }
        } catch (error) {
          await this.recordPatternAttempt(normalizedDomain, candidate.pattern, false);
          logger.debug("[BotSearchDiscovery] Candidate search failed", {
            searchUrl,
            pattern: candidate.pattern,
            query: searchQuery,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return null;
  }

  private static async buildSearchCandidates(
    baseUrl: string,
    query: string,
    siteId: string | undefined,
    normalizedHost: string,
    normalizedDomain: string,
  ): Promise<Array<{ searchUrl: string; pattern: string; label: string }>> {
    const used = new Set<string>();
    const out: Array<{ searchUrl: string; pattern: string; label: string }> = [];

    const push = (pattern: string | null | undefined, label: string) => {
      const p = (pattern || "").trim();
      if (!p || used.has(p)) return;
      used.add(p);
      out.push({
        searchUrl: this.buildSearchUrl(baseUrl, query, p),
        pattern: p,
        label,
      });
    };

    let explicitPattern: string | null = null;
    if (siteId) {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        select: { searchQueryPattern: true },
      });
      explicitPattern = site?.searchQueryPattern || null;
    }

    if (explicitPattern) {
      push(explicitPattern, "database");
    } else {
      const learned = await SearchPatternLearningService.getBestPatternForDomain(normalizedDomain).catch(() => null);
      push(learned, "learned");

      const builtin = Object.entries(BUILTIN_PATTERNS).find(([domain]) => normalizedHost.includes(domain));
      if (builtin) {
        push(builtin[1], "builtin");
      }

      for (const fallbackPattern of COMMON_FALLBACK_PATTERNS) {
        if (out.length >= 6) break;
        push(fallbackPattern, "fallback");
      }
    }

    return out;
  }

  private static sanitizeQuery(query: string): string {
    if (!query) return "";

    let cleaned = query
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'");

    cleaned = cleaned.replace(/\(.*?\)/g, " ");
    cleaned = cleaned.replace(/["'(){}\[\]]/g, " ");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    return cleaned;
  }

  private static extractModelToken(query: string): string | null {
    const tokens = query
      .split(/\s+/)
      .map((token) => token.replace(/[^\w.-]/g, ""))
      .filter(Boolean);

    const candidates = tokens.filter((token) => {
      const hasLetter = /[a-z]/i.test(token);
      const hasDigit = /\d/.test(token);
      return hasLetter && hasDigit && token.length >= 4 && token.length <= 24;
    });

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0];
  }

  private static extractBrandToken(query: string): string | null {
    const normalized = query.toLowerCase();
    for (const [, brand] of Object.entries(TECH_BRANDS)) {
      const alias = brand.aliases.find((value) => normalized.includes(value.toLowerCase()));
      if (alias) return alias;
    }

    const firstWord = query.split(/\s+/).find(Boolean) || "";
    return firstWord.length >= 2 ? firstWord : null;
  }

  private static extractSizeToken(query: string): string | null {
    const match = query.match(/\b(\d{2,3})(?:\s?(?:\"|inch|in|cm))?\b/i);
    if (!match) return null;
    const value = Number.parseInt(match[1], 10);
    if (!Number.isFinite(value) || value < 10 || value > 120) return null;
    return match[1];
  }

  private static buildIntelligentFallbackQueries(cleanQuery: string): QueryPlan {
    const modelToken = this.extractModelToken(cleanQuery) || undefined;
    const brandToken = this.extractBrandToken(cleanQuery) || undefined;
    const sizeToken = this.extractSizeToken(cleanQuery) || undefined;

    if (modelToken) {
      const queries = Array.from(new Set([modelToken, brandToken ? `${brandToken} ${modelToken}` : ""])).filter(Boolean);
      return { queries: queries.slice(0, 2), modelToken, brandToken, sizeToken };
    }

    const stopWords = new Set([
      "with",
      "graphics",
      "processor",
      "edition",
      "gaming",
      "desktop",
      "casing",
      "monitor",
      "series",
      "feature",
      "rgb",
      "tower",
      "color",
      "function",
      "multi",
      "inch",
      "usb",
      "wireless",
      "bluetooth",
    ]);
    const words = cleanQuery.split(/\s+/).filter(Boolean);
    const core = words.filter((word) => !stopWords.has(word.toLowerCase()) && word.length > 2);
    const generic = core.slice(0, 4).join(" ").trim();
    const queries = generic && generic !== cleanQuery ? [generic] : [];
    return { queries, modelToken: undefined, brandToken, sizeToken };
  }

  private static buildSearchUrl(baseUrl: string, query: string, pattern: string): string {
    const encoded = encodeURIComponent(query).replace(/%20/g, "+");

    if (pattern.startsWith("http://") || pattern.startsWith("https://")) {
      return pattern.replace("{query}", encoded).replace("{q}", encoded);
    }

    const root = baseUrl.replace(/\/$/, "");
    const path = pattern.startsWith("/") ? pattern : `/${pattern}`;
    return `${root}${path}`.replace("{query}", encoded).replace("{q}", encoded);
  }

  private static pickBestProductUrl(html: string, searchUrl: string, signals: QuerySignals): string | null {
    const $ = cheerio.load(html);

    const scored = $("a[href]")
      .toArray()
      .map((el) => {
        const href = ($(el).attr("href") || "").trim();
        const text = $(el).text().trim();
        const absolute = this.toAbsoluteUrl(href, searchUrl);
        if (!absolute) return null;

        const score = this.scoreCandidate(absolute, text, signals);
        if (score < 20) return null;

        return { absolute, score };
      })
      .filter((item): item is { absolute: string; score: number } => Boolean(item))
      .sort((a, b) => b.score - a.score);

    return scored[0]?.absolute || null;
  }

  private static scoreCandidate(url: string, text: string, signals: QuerySignals): number {
    const lowerUrl = url.toLowerCase();
    const lowerText = text.toLowerCase();

    if (BLOCKED_PATH_HINTS.some((hint) => lowerUrl.includes(hint))) {
      return 0;
    }

    let score = 0;

    if (lowerUrl.includes("/product/")) score += 35;
    if (lowerUrl.includes("/item/")) score += 18;
    if (lowerUrl.includes("-p-") || /\/p\//.test(lowerUrl)) score += 10;

    const urlTokens = this.tokenize(lowerUrl.replace(/https?:\/\//g, " "));
    const textTokens = this.tokenize(lowerText);

    const overlap = this.overlapCount(signals.queryTokens, [...urlTokens, ...textTokens]);
    score += Math.min(overlap * 8, 40);

    if (signals.modelToken && (lowerUrl.includes(signals.modelToken.toLowerCase()) || lowerText.includes(signals.modelToken.toLowerCase()))) {
      score += 25;
    }

    if (signals.brandToken && (lowerUrl.includes(signals.brandToken.toLowerCase()) || lowerText.includes(signals.brandToken.toLowerCase()))) {
      score += 12;
    }

    if (signals.sizeToken && (lowerUrl.includes(signals.sizeToken) || lowerText.includes(signals.sizeToken))) {
      score += 8;
    }

    if (text.length > 8) score += 5;

    return score;
  }

  private static looksLikeNoResultPage(html: string): boolean {
    const lower = html.toLowerCase();
    return (
      lower.includes("no results") ||
      lower.includes("no product found") ||
      lower.includes("not found") ||
      lower.includes("0 results")
    );
  }

  private static looksBlocked(html: string): boolean {
    const lower = html.toLowerCase();
    return (
      lower.includes("cloudflare") ||
      lower.includes("attention required") ||
      lower.includes("cf-browser-verification") ||
      lower.includes("captcha")
    );
  }

  private static tokenize(value: string): string[] {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
  }

  private static overlapCount(a: string[], b: string[]): number {
    const bSet = new Set(b);
    return a.reduce((count, token) => (bSet.has(token) ? count + 1 : count), 0);
  }

  private static toAbsoluteUrl(href: string, base: string): string | null {
    try {
      return new URL(href, base).toString();
    } catch {
      return null;
    }
  }

  private static getRandomUserAgent(): string {
    const list = getAllUserAgents();
    if (!list.length) {
      return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    }
    return list[Math.floor(Math.random() * list.length)] || list[0];
  }

  private static async recordPatternAttempt(domain: string, pattern: string, success: boolean): Promise<void> {
    try {
      await SearchPatternLearningService.recordAttempt({ domain, pattern, success });
    } catch {
      // best-effort
    }
  }
}
