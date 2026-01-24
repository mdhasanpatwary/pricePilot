import { Page } from "playwright";
import { logger } from "../logger";
import { BrowserPool } from "./browser-pool";
import { prisma } from "@/lib/prisma";

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

export class ScrapeBlockError extends Error {
  constructor(public provider: string, public url: string, public isAdvanced: boolean = false) {
    super(`BLOCKED: ${provider} at ${url}`);
    this.name = "ScrapeBlockError";
  }
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

  // TechLandBD: /search/advance/product/result/QUERY
  "techlandbd.com": (baseUrl, query) =>
    `${baseUrl.replace(/\/$/, "")}/search/advance/product/result/${encodeURIComponent(query).replace(/%20/g, "+")}`,

  "techland.com.bd": (baseUrl, query) =>
    `${baseUrl.replace(/\/$/, "")}/search/advance/product/result/${encodeURIComponent(query).replace(/%20/g, "+")}`,
};

// Default Fallback: /search?q=QUERY
const DEFAULT_STRATEGY = (baseUrl: string, query: string) =>
  `${baseUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}`;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
];

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
      // 1. Navigate with timeout
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // 2. Dynamic Security Analysis
      const securityInfo = await this.analyzeSecurity(page, response);
      if (securityInfo.isBlocked) {
        logger.warn(`[ScraperService] ${securityInfo.provider} Block Detected at ${url}`);

        // Dynamic Adjustment: If Cloudflare detected, try an extra long wait or specific stealth tactics
        if (securityInfo.provider === "CLOUDFLARE") {
           await page.waitForTimeout(5000); // Wait for challenge to potentially resolve
        }

        if (securityInfo.isBlocked && securityInfo.provider !== "NONE") {
          logger.error(`[ScraperService] 🛡️ BLOCKED by ${securityInfo.provider} at ${url}`);
          throw new ScrapeBlockError(securityInfo.provider, url, securityInfo.isAdvanced);
        } else if (securityInfo.provider !== "NONE") {
          logger.warn(`[ScraperService] ⚠️ ${securityInfo.provider} detected but not blocking`);
        }
      }

      // Wait for common e-commerce elements (slightly longer for dynamic sites)
      await page.waitForTimeout(3000);

      // Strategy 1: JSON-LD (Most Reliable)
      const jsonLdData = await this.extractFromJsonLd(page);
      if (jsonLdData && jsonLdData.price > 0) return { ...jsonLdData, url };

      // Strategy 2: OpenGraph
      const ogData = await this.extractFromOpenGraph(page);
      if (ogData && ogData.price > 0) return { ...ogData, url };

      // Strategy 3: CSS Selector Fallback
      const cssData = await this.extractFromSelectors(page);
      if (cssData && cssData.price > 0) return { ...cssData, url };

      // Strategy 4: Dynamic Heuristic Extraction (NEW)
      // This analyzes the page structure dynamically to find title/price even if selectors changed
      const heuristicData = await this.extractFromHeuristics(page);
      if (heuristicData && heuristicData.price > 0) {
        logger.info(`[ScraperService] Dynamic Heuristics saved the day for ${url}`);
        return { ...heuristicData, url };
      }

      if (process.env.NODE_ENV !== "test") {
        logger.warn(`Failed to scrape product from ${url} - No data found in any strategy.`);
      }
      return null;
    } catch (error) {
      if (error instanceof ScrapeBlockError) throw error;
      logger.error(`Error scraping ${url}:`, { error });
      return null;
    } finally {
      await page.close();
      await this.browserPool.releaseContext(context);
    }
  }

  /**
   * Identifies anti-bot protection and security providers
   */
  private async analyzeSecurity(page: Page, response: any) {
    const status = response?.status ? response.status() : null;
    const title = (await page.title()).toLowerCase();
    const content = (await page.content()).toLowerCase();

    // Safely extract headers - handle both real responses and mocks
    let headers: Record<string, string> = {};
    try {
      if (response?.headers && typeof response.headers === 'function') {
        headers = response.headers() || {};
      } else if (response?.headers && typeof response.headers === 'object') {
        headers = response.headers;
      }
    } catch {
      headers = {};
    }

    let provider = "NONE";
    let isBlocked = false;
    let isAdvanced = false;

    const captchaKeywords = ["captcha", "verify you are human", "robot check", "hcaptcha", "recaptcha"];
    const accessDeniedKeywords = ["access denied", "permission denied", "forbidden", "blocked"];

    const hasCaptcha = captchaKeywords.some(kw => content.includes(kw) || title.includes(kw));
    const hasAccessDenied = accessDeniedKeywords.some(kw => content.includes(kw) || title.includes(kw));

    if (title.includes("cloudflare") || content.includes("cf-browser-verification") || headers['server'] === 'cloudflare') {
      provider = "CLOUDFLARE";
      if (status === 403 || status === 503 || title.includes("just a moment")) isBlocked = true;
      isAdvanced = true; // Cloudflare is always treated as advanced
    } else if (content.includes("perimeterx") || content.includes("px-captcha")) {
      provider = "PERIMETERX";
      isBlocked = true;
      isAdvanced = true;
    } else if (content.includes("datadome") || headers['x-datadome-response']) {
      provider = "DATADOME";
      isBlocked = status === 403;
      isAdvanced = true;
    } else if (status === 403 || status === 429 || hasCaptcha || hasAccessDenied) {
      provider = hasCaptcha ? "CAPTCHA" : (hasAccessDenied ? "ACCESS_DENIED" : "GENERIC_WA_BLOCK");
      isBlocked = true;
      isAdvanced = true;
    } else if (status === 200 && (title.includes("trusted retail computer store") || title === "techland bd")) {
       // SILENT BLOCK: Redirected to Home page but status is 200
       const currentUrl = page.url();
       if (currentUrl.includes("search") || currentUrl.includes("route=")) {
          provider = "SILENT_HOME_REDIRECT";
          isBlocked = true;
          isAdvanced = true;
       }
    }

    return { provider, isBlocked, isAdvanced, status };
  }

  /**
   * Dynamic Heuristic Extraction: Analyzes the page to find product data without static selectors
   */
  private async extractFromHeuristics(page: Page): Promise<Omit<ScrapedProduct, "url"> | null> {
    try {
      return await page.evaluate(() => {
        // 1. Find Title: Usually the largest <h1> or <h2> tag in the top 50% of the page
        const headings = Array.from(document.querySelectorAll('h1, h2'));
        let bestTitle = "";
        let maxFontSize = 0;

        for (const h of headings) {
          const style = window.getComputedStyle(h);
          const size = parseFloat(style.fontSize);
          const text = h.textContent?.trim() || "";

          // Exclude nav symbols, menus, etc.
          if (text.length > 10 && text.length < 200 && size > maxFontSize) {
            const rect = h.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.8) { // Must be in visible-ish upper area
              bestTitle = text;
              maxFontSize = size;
            }
          }
        }

        // 2. Find Price: Look for text containing currency symbols or "৳", "TK", "$"
        // Score elements by their proximity to the title and visual prominence
        const allElements = Array.from(document.querySelectorAll('span, div, b, p, strong, td'));
        const pricePattern = /([৳\$]|TK|BDT)\s?([\d,]+\.?\d*)|([\d,]+\.?\d*)\s?([৳\$]|TK|BDT)/i;

        let bestPriceMatch: string | null = null;
        let highestPriceScore = 0;

        for (const el of allElements) {
          const text = el.textContent?.trim() || "";
          if (text.length < 30 && pricePattern.test(text)) {
            // Calculate a visibility/proximity score
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;

            let score = parseFloat(style.fontSize) || 12;

            // Bold price is better
            if (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600) score += 10;
            // Primary colored price (usually red or orange in BD) is better
            if (style.color.includes('rgb(2') || style.color.includes('rgb(1')) score += 5;

            if (score > highestPriceScore) {
              highestPriceScore = score;
              bestPriceMatch = text;
            }
          }
        }

        if (!bestTitle || !bestPriceMatch) return null;

        // Extract numbers only for price
        const numericPrice = parseFloat(bestPriceMatch.replace(/[^0-9.]/g, ''));

        return {
          title: bestTitle,
          price: numericPrice || 0,
          currency: "BDT",
          inStock: true, // Default to true if title/price found
          imageUrl: undefined
        };
      });
    } catch (e) {
      return null;
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
          ".special-price", // Ryans
          ".rp-product-price", // Ryans New
          ".actual-price",
          ".price-new",
          ".regular-price",
          "#price-special",
          ".main-price",
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
          "coming soon",
          "pre-order",
          "pre order",
          "call for price",
        ];
        const isActuallyOos =
          oosKeywords.some((kw) => stockText.includes(kw)) ||
          oosSelectors.some((s) => {
            const el = document.querySelector(s);
            return (
              el &&
              (el.classList.contains("out-of-stock") ||
                el.classList.contains("discontinued") ||
                el.classList.contains("upcoming"))
            );
          });

        // Check for "coming soon" or "pre-order" status
        const isComingSoon = stockText.includes("coming soon") || stockText.includes("upcoming");
        const isPreOrder = stockText.includes("pre-order") || stockText.includes("pre order");

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
          isComingSoon,
          isPreOrder,
          stockText, // Return raw stock text for debugging
          imageUrl: imageSrc,
        };
      });

      if (!data.title) return null;

      // Extract numeric price from text
      let price = 0;
      if (data.priceText) {
        const priceMatch = data.priceText.replace(/,/g, '').match(/\d+\.?\d*/);
        if (priceMatch) {
          price = parseFloat(priceMatch[0]);
        }
      }

      // If price is 0 but product exists, check stock status
      if (price === 0 && data.title) {
        logger.warn(`[ScraperService] Price = 0 detected. Stock status: "${data.stockText}"`);

        if (data.isComingSoon) {
          logger.info(`[ScraperService] Product is "Coming Soon" - marking as out of stock`);
        } else if (data.isPreOrder) {
          logger.info(`[ScraperService] Product is "Pre-Order" - marking as out of stock`);
        } else if (data.isOos) {
          logger.info(`[ScraperService] Product is "Out of Stock"`);
        } else {
          logger.error(`[ScraperService] Price extraction failed - no valid price found`);
        }
      }

      return {
        title: data.title,
        price: price > 0 ? price : 0,
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

    // 2. Remove specifications in parentheses e.g. "Product Name (8GB/256GB)" -> "Product Name"
    cleaned = cleaned.replace(/\(.*?\)/g, " ");

    // 3. Remove common suffix junk that breaks search engines
    cleaned = cleaned.replace(/["'(){}\[\]]/g, " ");
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned;
  }

  /**
   * Attempt to find and scrape a product on a site using a search query
   */
  async searchAndScrape(
    baseUrl: string,
    query: string,
    siteId?: string,
  ): Promise<ScrapedProduct | null> {
    await this.init();
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const context = await this.browserPool.acquireContext(userAgent);
    const page = await context.newPage();

    const log = async (message: string, level: "INFO" | "WARN" | "ERROR" | "SUCCESS" = "INFO") => {
      if (siteId) {
        await prisma.syncLog.create({
          data: { siteId, message, level }
        }).catch(() => {});
      }
    };

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
      let searchUrl: string | null = null;
      let usedCustomPattern = false;

      // Try to find a custom search pattern from the database if siteId is present
      if (siteId) {
        const site = await prisma.site.findUnique({
          where: { id: siteId },
          select: { searchQueryPattern: true },
        });

        if (site?.searchQueryPattern) {
          const pattern = site.searchQueryPattern;
          // Standard placeholder replacement: {query} or {q}
          if (pattern.includes("{query}")) {
            searchUrl = pattern.replace(
              "{query}",
              encodeURIComponent(cleanQuery).replace(/%20/g, "+"),
            );
          } else if (pattern.includes("{q}")) {
            searchUrl = pattern.replace(
              "{q}",
              encodeURIComponent(cleanQuery).replace(/%20/g, "+"),
            );
          } else {
             searchUrl = pattern;
          }
          usedCustomPattern = true;
        }
      }

      if (!searchUrl) {
        const buildUrl = strategyKey
          ? SEARCH_STRATEGIES[strategyKey]
          : DEFAULT_STRATEGY;
        searchUrl = buildUrl(baseUrl, cleanQuery);
      }

      logger.info(
        `[ScraperService] Searching: ${searchUrl} (Strategy: ${usedCustomPattern ? "Database Pattern" : (strategyKey || "Default")})`,
      );
      await log(`🔍 Searching: ${searchUrl}`, "INFO");

      // Ryans/Startech are heavy on JS, use networkidle if possible or longer wait
      const response = await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // --- NEW: Security Pre-check ---
      const securityInfo = await this.analyzeSecurity(page, response);
      if (securityInfo.isBlocked) {
        const msg = `🛡️ [Scraper] Blocked by ${securityInfo.provider} at ${hostname}`;
        logger.warn(`[ScraperService] ${msg}`);
        await log(msg, "WARN");

        if (securityInfo.isAdvanced) {
           throw new ScrapeBlockError(securityInfo.provider, searchUrl, true);
        }

        if (securityInfo.provider === "CLOUDFLARE") {
           await page.waitForTimeout(5000); // Wait for challenge
        }
      }

      // Wait for results to render (critical for CSR sites like Ryans/Startech)
      try {
        await page.waitForSelector('.product-thumb, .p-item, .product-box, .p-item-details, .card, .product-item, .search-result', { timeout: 8000 });
      } catch (e) {
        // Fallback to static wait if specific selectors don't show up
        await page.waitForTimeout(4000);
      }

      // 3. Look for links that might be products (heuristics)
      let productLink = await this.evaluateProductLink(page, cleanQuery);

      if (productLink) {
        logger.info(`[ScraperService] ✅ Direct search found product link: ${productLink}`);
      } else {
        logger.warn(`[ScraperService] ⚠️ Direct search returned no results for: "${cleanQuery}"`);
      }

      if (productLink) {
        logger.info(`[ScraperService] 🎯 Scraping product page: ${productLink}`);
        return await this.scrapeProductPage(productLink);
      }

      // Fallback Strategy: Query Simplification
      if (!query.includes("__RETRY__") && cleanQuery.split(" ").length > 3) {
        logger.info(`[ScraperService] 🔄 No results. Attempting query simplification...`);

        const stopWords = [
          "with", "graphics", "processor", "edition", "gaming", "desktop",
          "casing", "monitor", "series", "feature", "rgb", "tower", "color",
          "function", "multi", "inch", "usb", "wireless", "bluetooth"
        ];
        const words = cleanQuery.split(" ");
        const coreWords = words.filter(
          (w) => !stopWords.includes(w.toLowerCase()) && w.length > 2,
        );

        const smartQuery = coreWords.slice(0, 4).join(" ");

        if (smartQuery !== cleanQuery && smartQuery.length > 5) {
          logger.info(`[ScraperService] 📝 Simplified query: "${cleanQuery}" → "${smartQuery}"`);
          return this.searchAndScrape(baseUrl, smartQuery + "__RETRY__");
        }
      }

      logger.error(`[ScraperService] ❌ All strategies exhausted for: "${cleanQuery}"`);
      return null;
    } catch (error) {
      if (error instanceof ScrapeBlockError) throw error;
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
  private async evaluateProductLink(page: Page, query?: string): Promise<string | null> {
    return await page.evaluate((q) => {
      const links = Array.from(document.querySelectorAll("a"));
      const potentialProducts = links.filter((a) => {
        const href = a.href.toLowerCase();
        const text = a.textContent?.trim().toLowerCase() || "";

        // Skip links with very short text unless it's an image link (hard to detect here)
        if (text.length < 4 && !href.includes("product_id=")) return false;

        const isSearchLink =
          (href.includes("route=product/search") || href.includes("/search/advance/product/result")) &&
          !href.includes("product_id=");

        const isNavigation =
          href.includes("sort=") ||
          href.includes("limit=") ||
          href.includes("page=") ||
          href.includes("javascript:") ||
          href.includes("order=") ||
          href.includes("compare");

        if (isSearchLink || isNavigation) {
          return false;
        }

        // Broaden container detection
        const productContainer =
          a.closest(".product-thumb") ||
          a.closest(".product-layout") ||
          a.closest(".product-box") ||
          a.closest(".card") ||
          a.closest(".p-item") ||
          a.closest(".product-item") ||
          a.closest(".main-products") ||
          a.closest(".product-list");

        // Relevance Check: If query is provided, at least some words should match
        if (q) {
            const queryWords = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            if (queryWords.length > 0) {
                const matchCount = queryWords.filter(w => text.includes(w) || href.includes(w)).length;
                const matchRatio = matchCount / queryWords.length;

                // If it's a known container, we are more lenient (30% match)
                // If it's a generic link, we are stricter (60% match)
                const threshold = productContainer ? 0.3 : 0.6;
                if (matchRatio < threshold) return false;
            }
        }

        if (productContainer) return true;

        // Generic heuristic: Link contains /product/ or /p/ and has significant text
        const isProductUrl =
          href.includes("/product/") ||
          href.includes("/p/") ||
          href.includes("/item/") ||
          (href.includes("/details/") && !href.includes("search")) ||
          (href.split('/').length > 3 && text.length > 20); // Deep link with long text

        return isProductUrl && text.length > 15;
      });

      // Filter and rank by distance from search query if possible,
      // but for now, just return the first one that isn't a "compare" link
      const filtered = potentialProducts.filter(a => !a.href.includes("compare"));
      return filtered[0]?.href || null;
    }, query);
  }

  // Helper to handle the magic retry suffix transparently if needed,
  // currently we just strip it in sanitizeQuery or handle it in the recursive call logic.
  // Actually, sanitizeQuery will strip the underscores if we aren't careful,
  // but since we call sanitizeQuery INSIDE searchAndScrape, we need to pass the retry flag differently
  // OR just trust the length check logic if we don't pass a flag.
  // But to be safe, let's just use the words length check logic and valid recursion.
  // We'll strip the flag in sanitizeQuery if it exists to keep the search clean.

}
