import { chromium, Browser, Page } from 'playwright';

interface ScrapedProduct {
  title: string;
  price: number;
  currency: string;
  sku?: string;
  brand?: string;
  model?: string;
  url: string;
  inStock: boolean;
}

export class ScraperService {
  private browser: Browser | null = null;
  private proxies: string[] = [];
  private proxyIndex: number = 0;

  constructor() {
    const proxyEnv = process.env.SCRAPER_PROXIES;
    if (proxyEnv) {
      this.proxies = proxyEnv.split(',').map(p => p.trim()).filter(Boolean);
      console.log(`[ScraperService] Initialized with ${this.proxies.length} proxies.`);
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
   * Initialize the browser instance
   */
  async init() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
  }

  /**
   * Close the browser instance
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Scrape a competitor product page
   */
  async scrapeProductPage(url: string): Promise<ScrapedProduct | null> {
    await this.init();

    const proxyUrl = this.getNextProxy();
    const contextOptions: Parameters<Browser['newContext']>[0] = {};

    if (proxyUrl) {
      contextOptions.proxy = { server: proxyUrl };
      console.log(`[ScraperService] Using proxy for ${url}: ${proxyUrl}`);
    }

    const context = await this.browser!.newContext(contextOptions);
    const page = await context.newPage();

    try {
      // Navigate with timeout
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

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

      if (process.env.NODE_ENV !== 'test') {
        console.warn(`Failed to scrape product from ${url}`);
      }
      return null;

    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      return null;
    } finally {
      await page.close();
      await context.close();
    }
  }

  /**
   * Extract product data from JSON-LD structured data
   */
  private async extractFromJsonLd(page: Page): Promise<Omit<ScrapedProduct, 'url'> | null> {
    try {
      const jsonLd = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent || '');
            if (data['@type'] === 'Product' || data['@type']?.includes('Product')) {
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
        jsonLd.offers?.price ||
        jsonLd.offers?.[0]?.price ||
        '0'
      );

      return {
        title: jsonLd.name || '',
        price,
        currency: jsonLd.offers?.priceCurrency || jsonLd.offers?.[0]?.priceCurrency || 'USD',
        sku: jsonLd.sku || jsonLd.gtin || undefined,
        brand: jsonLd.brand?.name || jsonLd.brand || undefined,
        model: jsonLd.model || undefined,
        inStock: jsonLd.offers?.availability?.includes('InStock') ||
                jsonLd.offers?.[0]?.availability?.includes('InStock') ||
                true,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract product data from OpenGraph meta tags
   */
  private async extractFromOpenGraph(page: Page): Promise<Omit<ScrapedProduct, 'url'> | null> {
    try {
      const ogData = await page.evaluate(() => {
        const getMeta = (property: string) => {
          const meta = document.querySelector(`meta[property="${property}"]`);
          return meta?.getAttribute('content') || '';
        };

        return {
          title: getMeta('og:title') || getMeta('product:title'),
          price: getMeta('product:price:amount') || getMeta('og:price:amount'),
          currency: getMeta('product:price:currency') || getMeta('og:price:currency'),
          brand: getMeta('product:brand'),
          availability: getMeta('og:availability') || getMeta('product:availability') || getMeta('product:availability:status'),
        };
      });

      if (!ogData.title || !ogData.price) return null;

      return {
        title: ogData.title,
        price: parseFloat(ogData.price),
        currency: ogData.currency || 'USD',
        brand: ogData.brand || undefined,
        inStock: ogData.availability !== 'oos' && ogData.availability !== 'out of stock' && ogData.availability !== 'instock' ? true : ogData.availability === 'instock',
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract product data using common CSS selectors
   */
  private async extractFromSelectors(page: Page): Promise<Omit<ScrapedProduct, 'url'> | null> {
    try {
      const data = await page.evaluate(() => {
        // Common title selectors
        const titleSelectors = [
          'h1[itemprop="name"]',
          'h1.product-title',
          'h1.product-name',
          '.product-title h1',
          'h1',
        ];

        // Common price selectors
        const priceSelectors = [
          '[itemprop="price"]',
          '.price',
          '.product-price',
          '.current-price',
          'span.price',
          '.price-value',
        ];

        // Common stock selectors
        const oosSelectors = [
          '.out-of-stock',
          '.sold-out',
          '.unavailable',
          '.stock-out',
        ];

        const getTextContent = (selectors: string[]) => {
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el?.textContent?.trim()) {
              return el.textContent.trim();
            }
          }
          return '';
        };

        return {
          title: getTextContent(titleSelectors),
          priceText: getTextContent(priceSelectors),
          isOos: oosSelectors.some(s => document.querySelector(s) !== null),
        };
      });

      if (!data.title || !data.priceText) return null;

      // Extract numeric price from text
      const priceMatch = data.priceText.match(/[\d,]+\.?\d*/);
      if (!priceMatch) return null;

      const price = parseFloat(priceMatch[0].replace(/,/g, ''));

      return {
        title: data.title,
        price,
        currency: 'USD', // Default assumption
        inStock: !data.isOos,
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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }
}
