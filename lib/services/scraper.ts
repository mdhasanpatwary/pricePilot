import { Page } from "playwright";
import { logger } from "../logger";
import { BrowserPool } from "./browser-pool";

interface ScrapedProduct {
  title: string;
  price: number;
  currency: string;
  sku?: string;
  brand?: string;
  model?: string;
  url: string;
  inStock: boolean;
  imageUrl?: string;
}

// Domain-specific search URL builders
const SEARCH_STRATEGIES: Record<
  string,
  (baseUrl: string, query: string) => string
> = {
  // StarTech: /product/search?search=QUERY
  "startech.com.bd": (baseUrl, query) =>
    `${baseUrl.replace(/\/$/, "")}/product/search?search=${encodeURIComponent(query)}`,

  // Ryans: /search?q=QUERY (uses + for spaces)
  "ryans.com": (baseUrl, query) =>
    `${baseUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(query).replace(/%20/g, "+")}`,

  // Ryans Alias
  "ryanscomputers.com": (baseUrl, query) =>
    `${baseUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(query).replace(/%20/g, "+")}`,
};

// Default Fallback: /search?q=QUERY
const DEFAULT_STRATEGY = (baseUrl: string, query: string) =>
  `${baseUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}`;

export class ScraperService {
  private browserPool: BrowserPool;
  private proxies: string[] = [];
  private proxyIndex: number = 0;

  constructor() {
    this.browserPool = BrowserPool.getInstance();
    const proxyEnv = process.env.SCRAPER_PROXIES;
    if (proxyEnv) {
      this.proxies = proxyEnv
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      logger.info(
        `[ScraperService] Initialized with ${this.proxies.length} proxies.`,
      );
    }
  }

  /**
   * Get the next proxy in rotation
   */
  private getNextProxy(): string | null {
    if (this.proxies.length === 0) return null;
    const proxy = this.proxies[this.proxyIndex];
    this.proxyIndex = (this.proxyIndex + 1) % this.proxies.length;
    return proxy;
  }

  /**
   * Initialize the browser pool
   */
  async init() {
    const maxContexts = parseInt(process.env.SCRAPER_MAX_CONTEXTS || "10", 10);
    await this.browserPool.init(maxContexts);
  }

  /**
   * Close the browser pool (usually called on shutdown)
   */
  async close() {
    await this.browserPool.close();
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return this.browserPool.getStats();
  }

  /**
   * Scrape a competitor product page
   */
  async scrapeProductPage(url: string): Promise<ScrapedProduct | null> {
    await this.init();

    const proxyUrl = this.getNextProxy();
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
    const proxy = proxyUrl ? { server: proxyUrl } : undefined;

    if (proxyUrl) {
      logger.info(`[ScraperService] Using proxy for ${url}: ${proxyUrl}`);
    }

    // Acquire context from pool
    const context = await this.browserPool.acquireContext(userAgent, proxy);
    const page = await context.newPage();

    try {
      // Navigate with timeout
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      const status = response?.status ? response.status() : null;
      const title = await page.title();

      // Check for common blocking patterns
      if (
        status === 403 ||
        status === 429 ||
        title.includes("Cloudflare") ||
        title.includes("Just a moment")
      ) {
        let reason = "Security Block";
        if (status === 403) reason = "Access Forbidden (403)";
        if (status === 429) reason = "Rate Limited (429)";
        if (title.includes("Cloudflare") || title.includes("Just a moment"))
          reason = "Cloudflare Shield Active";

        logger.warn(`[ScraperService] Block detected at ${url}: ${reason}`);
        throw new Error(`BLOCKED: ${reason}`);
      }

      // Wait for common e-commerce elements
      await page.waitForTimeout(2000);

      // Strategy 1: Try to extract from JSON-LD structured data
      const jsonLdData = await this.extractFromJsonLd(page);
      if (jsonLdData) {
        return { ...jsonLdData, url };
      }

      // Strategy 2: Try OpenGraph meta tags
      const ogData = await this.extractFromOpenGraph(page);
      if (ogData) {
        return { ...ogData, url };
      }

      // Strategy 3: CSS selector fallback (generic patterns)
      const cssData = await this.extractFromSelectors(page);
      if (cssData) {
        return { ...cssData, url };
      }

      if (process.env.NODE_ENV !== "test") {
        logger.warn(`Failed to scrape product from ${url}`);
      }
      return null;
    } catch (error) {
      logger.error(`Error scraping ${url}:`, { error });
      return null;
    } finally {
      await page.close();
      // Release context back to pool instead of closing it
      await this.browserPool.releaseContext(context);
    }
  }

  /**
   * Extract product data from JSON-LD structured data
   */
  private async extractFromJsonLd(
    page: Page,
  ): Promise<Omit<ScrapedProduct, "url"> | null> {
    try {
      const jsonLd = await page.evaluate(() => {
        const scripts = Array.from(
          document.querySelectorAll('script[type="application/ld+json"]'),
        );
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent || "");
            if (
              data["@type"] === "Product" ||
              data["@type"]?.includes("Product")
            ) {
              return data;
            }
          } catch (e) {
            continue;
          }
        }
        return null;
      });

      if (!jsonLd) return null;

      const price = parseFloat(
        jsonLd.offers?.price || jsonLd.offers?.[0]?.price || "0",
      );

      return {
        title: jsonLd.name || "",
        price,
        currency:
          jsonLd.offers?.priceCurrency ||
          jsonLd.offers?.[0]?.priceCurrency ||
          "USD",
        sku: jsonLd.sku || jsonLd.gtin || undefined,
        brand: jsonLd.brand?.name || jsonLd.brand || undefined,
        model: jsonLd.model || undefined,
        inStock:
          jsonLd.offers?.availability?.includes("InStock") ||
          jsonLd.offers?.[0]?.availability?.includes("InStock") ||
          true,
        imageUrl: jsonLd.image?.[0] || jsonLd.image || undefined,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract product data from OpenGraph meta tags
   */
  private async extractFromOpenGraph(
    page: Page,
  ): Promise<Omit<ScrapedProduct, "url"> | null> {
    try {
      const ogData = await page.evaluate(() => {
        const getMeta = (property: string) => {
          const meta = document.querySelector(`meta[property="${property}"]`);
          return meta?.getAttribute("content") || "";
        };

        return {
          title: getMeta("og:title") || getMeta("product:title"),
          price: getMeta("product:price:amount") || getMeta("og:price:amount"),
          currency:
            getMeta("product:price:currency") || getMeta("og:price:currency"),
          brand: getMeta("product:brand"),
          availability:
            getMeta("og:availability") ||
            getMeta("product:availability") ||
            getMeta("product:availability:status"),
          image: getMeta("og:image") || getMeta("product:image"),
        };
      });

      if (!ogData.title || !ogData.price) return null;

      return {
        title: ogData.title,
        price: parseFloat(ogData.price),
        currency: ogData.currency || "USD",
        brand: ogData.brand || undefined,
        inStock:
          ogData.availability !== "oos" &&
          ogData.availability !== "out of stock" &&
          ogData.availability !== "instock"
            ? true
            : ogData.availability === "instock",
        imageUrl: ogData.image || undefined,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract product data using common CSS selectors
   */
  private async extractFromSelectors(
    page: Page,
  ): Promise<Omit<ScrapedProduct, "url"> | null> {
    try {
      const data = await page.evaluate(() => {
        // Common title selectors
        const titleSelectors = [
          'h1[itemprop="name"]',
          "h1.product-title",
          "h1.product-name",
          ".product-title h1",
          "h1",
        ];

        // Common price selectors
        const priceSelectors = [
          '[itemprop="price"]',
          ".price",
          ".product-price",
          ".current-price",
          "span.price",
          ".price-value",
          ".p-item-price", // Startech
          ".special-price", // Ryans sometimes
          ".regular-price",
          "#price-special",
        ];

        // Common stock selectors
        const oosSelectors = [
          ".out-of-stock",
          ".sold-out",
          ".unavailable",
          ".stock-out",
          ".stock-status",
          ".discontinued",
          ".upcoming",
          ".text-discontinued", // Startech specific
          ".p-item-stock", // Generic
        ];

        // Common image selectors
        const imageSelectors = [
          'img[itemprop="image"]',
          ".product-image img",
          ".product-gallery img",
          ".main-image img",
          "#main-image",
          ".main-product-image img",
          ".product-main-image img",
        ];

        const getTextContent = (selectors: string[]) => {
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el?.textContent?.trim()) {
              return el.textContent.trim();
            }
          }
          return "";
        };

        const stockText = getTextContent(oosSelectors).toLowerCase();
        const oosKeywords = [
          "out of stock",
          "sold out",
          "discontinued",
          "upcoming",
          "not available",
          "stock out",
        ];
        const isActuallyOos =
          oosKeywords.some((kw) => stockText.includes(kw)) ||
          oosSelectors.some((s) => {
            const el = document.querySelector(s);
            return (
              el &&
              (el.classList.contains("out-of-stock") ||
                el.classList.contains("discontinued"))
            );
          });

        const imageSrc = (() => {
          for (const selector of imageSelectors) {
            const el = document.querySelector(selector) as HTMLImageElement;
            if (el) {
              const src =
                el.getAttribute("data-src") ||
                el.getAttribute("data-lazy-src") ||
                el.src;
              if (
                src &&
                !src.includes("placeholder") &&
                !src.startsWith("data:")
              ) {
                return src;
              }
            }
          }
          // Fallback: search for any image in a product container that looks like a main image
          const possibleContainers = [
            ".product-image",
            ".product-gallery",
            ".main-image",
            "main",
            "article",
          ];
          for (const containerSelector of possibleContainers) {
            const container = document.querySelector(containerSelector);
            if (container) {
              const images = Array.from(container.querySelectorAll("img"));
              for (const img of images) {
                const src = img.getAttribute("data-src") || img.src;
                if (src && img.width > 200 && !src.includes("placeholder"))
                  return src;
              }
            }
          }
          return undefined;
        })();

        return {
          title: getTextContent(titleSelectors),
          priceText: getTextContent(priceSelectors),
          isOos: isActuallyOos,
          imageUrl: imageSrc,
        };
      });

      if (!data.title || !data.priceText) return null;

      // Extract numeric price from text
      const priceMatch = data.priceText.match(/[\d,]+\.?\d*/);
      let price = 0;
      if (priceMatch) {
        price = parseFloat(priceMatch[0].replace(/[^0-9.]/g, ""));
      }

      return {
        title: data.title,
        price: price > 0 ? price : 0, // Keep as 0, but route will handle null
        currency: "USD", // Default assumption
        inStock: !data.isOos && price > 0,
        imageUrl: data.imageUrl,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Batch scrape multiple URLs
   */
  async scrapeMultiple(urls: string[]): Promise<ScrapedProduct[]> {
    await this.init();

    const results: ScrapedProduct[] = [];

    for (const url of urls) {
      const product = await this.scrapeProductPage(url);
      if (product) {
        results.push(product);
      }

      // Rate limiting: wait between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * Attempt to find and scrape a product on a site using a search query
   */
  /**
   * Sanitize search query to improve match rates
   */
  private sanitizeQuery(query: string): string {
    if (!query) return "";

    // 1. Decode common HTML entities
    let cleaned = query
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'");

    // 2. Remove special characters that often confuse search engines
    // Keeping alphanumeric, spaces, dots, and hyphens
    // Removing quotes, parentheses, brackets, etc.
    cleaned = cleaned.replace(/["'(){}\[\]]/g, " ");

    // 3. Replace multiple spaces with single space and trim
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned;
  }

  /**
   * Attempt to find and scrape a product on a site using a search query
   */
  async searchAndScrape(
    baseUrl: string,
    query: string,
  ): Promise<ScrapedProduct | null> {
    await this.init();
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
    const context = await this.browserPool.acquireContext(userAgent);
    const page = await context.newPage();

    try {
      // 0. Clean retry flags from the search term
      const actualQuery = query.replace("__RETRY__", "").trim();

      // 1. Sanitize query
      const cleanQuery = this.sanitizeQuery(actualQuery);
      logger.info(
        `[ScraperService] Original query: "${query}" -> Sanitized: "${cleanQuery}"`,
      );

      // 2. Resolve Search Strategy
      const hostname = new URL(baseUrl).hostname.toLowerCase();

      // Find matching strategy by checking if hostname contains the key
      const strategyKey = Object.keys(SEARCH_STRATEGIES).find((domain) =>
        hostname.includes(domain),
      );
      const buildUrl = strategyKey
        ? SEARCH_STRATEGIES[strategyKey]
        : DEFAULT_STRATEGY;

      const searchUrl = buildUrl(baseUrl, cleanQuery);

      logger.info(
        `[ScraperService] Searching: ${searchUrl} (Strategy: ${strategyKey || "Default"})`,
      );

      // Ryans/Startech are heavy on JS, use networkidle if possible or longer wait
      const response = await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      const status = response?.status ? response.status() : null;
      const title = await page.title();

      if (
        status === 403 ||
        status === 429 ||
        title.includes("Cloudflare") ||
        title.includes("Just a moment")
      ) {
        logger.warn(
          `[ScraperService] Search block detected: ${status} - ${title}`,
        );
        throw new Error(`SEARCH_BLOCKED: ${status}`);
      }

      // Wait for results to render (critical for CSR sites)
      await page.waitForTimeout(5000);

      // 3. Look for links that might be products (heuristics)
      let productLink = await this.evaluateProductLink(page);

      // --- NEW: Google Search Fallback ---
      if (!productLink) {
        logger.info(
          `[ScraperService] No direct results. Attempting Deep Search via Google...`,
        );
        const googleQuery = `site:${hostname} ${cleanQuery}`;
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`;

        try {
          await page.goto(googleSearchUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          await page.waitForTimeout(3000); // Wait for Google results

          productLink = await page.evaluate((targetHost: string) => {
            const links = Array.from(document.querySelectorAll("a"));
            // Look for links that point to the competitor site and aren't search/cache links
            const matches = links.filter((a) => {
              const href = a.href.toLowerCase();
              return (
                href.includes(targetHost) &&
                !href.includes("google.com") &&
                !href.includes("webcache.googleusercontent.com") &&
                !href.includes("/search?")
              );
            });
            return matches[0]?.href || null;
          }, hostname);
        } catch (e) {
          logger.error(`[ScraperService] Google fallback failed:`, {
            error: e,
          });
        }
      }

      if (productLink) {
        logger.info(`[ScraperService] Found match: ${productLink}`);
        return await this.scrapeProductPage(productLink);
      }

      // Fallback Strategy: If no match found and query is long, try simplifying
      // If we are already in a retry loop (indicated by __RETRY__), don't recurse infinitely
      if (!query.includes("__RETRY__") && cleanQuery.split(" ").length > 3) {
        // Strategy A: Smart Simplification (Brand + Model + Key Spec)
        // Remove filler words to focus on the core product identity
        const stopWords = [
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
        ];
        const words = cleanQuery.split(" ");
        const coreWords = words.filter(
          (w) => !stopWords.includes(w.toLowerCase()) && w.length > 2,
        );

        // Take up to 5 core words
        const smartQuery = coreWords.slice(0, 5).join(" ");

        if (smartQuery !== cleanQuery && smartQuery.length > 5) {
          logger.info(
            `[ScraperService] No identification with full title. Retrying with smart simplified: "${smartQuery}"`,
          );
          return this.searchAndScrape(baseUrl, smartQuery + "__RETRY__");
        }

        // Strategy B: Brute Force Truncation (First 3-4 words)
        // Only if Strategy A didn't change much or failed (we could chain these but let's stick to one good retry for now)
        if (words.length > 4) {
          const simpleQuery = words.slice(0, 4).join(" ");
          logger.info(
            `[ScraperService] No identification with full title. Retrying with simple truncation: "${simpleQuery}"`,
          );
          return this.searchAndScrape(baseUrl, simpleQuery + "__RETRY__");
        }
      }

      return null;
    } catch (error) {
      logger.error(`[ScraperService] Search failed for ${query}:`, { error });
      return null;
    } finally {
      await page.close();
      await this.browserPool.releaseContext(context);
    }
  }

  /**
   * Helper to identify product links on a results page
   */
  private async evaluateProductLink(page: Page): Promise<string | null> {
    return await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      const potentialProducts = links.filter((a) => {
        const href = a.href.toLowerCase();
        const text = a.textContent?.toLowerCase() || "";

        if (
          href.includes("search?q=") ||
          href.includes("route=product/search") ||
          href.includes("search=") ||
          href.includes("sort=") ||
          href.includes("limit=") ||
          href.includes("page=") ||
          href.includes("javascript:")
        ) {
          return false;
        }

        const isStartechCard =
          a.closest(".product-thumb") ||
          a.closest(".p-item") ||
          a.closest(".product-item");
        const isRyansCard =
          a.closest(".product-box") || a.closest(".card-body");

        if (isStartechCard || isRyansCard) return true;

        return (
          (href.includes("/product/") ||
            href.includes("/p/") ||
            href.includes("/item/")) &&
          text.length > 10
        );
      });

      return potentialProducts[0]?.href || null;
    });
  }

  // Helper to handle the magic retry suffix transparently if needed,
  // currently we just strip it in sanitizeQuery or handle it in the recursive call logic.
  // Actually, sanitizeQuery will strip the underscores if we aren't careful,
  // but since we call sanitizeQuery INSIDE searchAndScrape, we need to pass the retry flag differently
  // OR just trust the length check logic if we don't pass a flag.
  // But to be safe, let's just use the words length check logic and valid recursion.
  // We'll strip the flag in sanitizeQuery if it exists to keep the search clean.
}
