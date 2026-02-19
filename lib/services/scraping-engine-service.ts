import { logger } from "@/lib/logger";
import { getRedisConnection } from "@/lib/queue/connection";
import { ScraperService } from "@/lib/services/scraper";
import { ScraperAdapter } from "@/lib/services/bot-protection/scraper-adapter";
import { BotSearchDiscoveryService } from "@/lib/services/bot-protection/search-discovery";

type EngineName = "legacy" | "bot";
type ScrapeContext = "discovery" | "worker" | "retry";
type MetricOutcome = "success" | "failed";
type EngineOperation = "searchAndScrape" | "scrapeByUrl";

interface SearchAndScrapeOptions {
  siteId?: string;
  tenantId?: string;
  attempt?: number;
  visitedQueries?: Set<string>;
  context: ScrapeContext;
}

interface ScrapeByUrlOptions {
  context: ScrapeContext;
  isAdvancedProtected?: boolean;
  competitorProductId?: string;
  tenantId?: string;
  siteId?: string;
}

function getPrimaryEngine(): EngineName {
  const raw = (process.env.SCRAPING_ENGINE_PRIMARY || "bot").trim().toLowerCase();
  return raw === "legacy" ? "legacy" : "bot";
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const normalized = raw.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

const METRIC_KEY_PREFIX = "pp:scrape:engine:minute:";

export class ScrapingEngineService {
  private static legacyScraper: ScraperService | null = null;
  private static botAdapter: ScraperAdapter | null = null;

  private static getLegacyScraper(): ScraperService {
    if (!this.legacyScraper) {
      this.legacyScraper = new ScraperService();
    }
    return this.legacyScraper;
  }

  private static getBotAdapter(): ScraperAdapter {
    if (!this.botAdapter) {
      this.botAdapter = new ScraperAdapter();
    }
    return this.botAdapter;
  }

  private static canFallbackToLegacy(): boolean {
    return boolEnv("SCRAPING_ENGINE_ALLOW_LEGACY_FALLBACK", false);
  }

  private static async recordEngineMetric(
    operation: EngineOperation,
    selected: EngineName,
    outcome: MetricOutcome,
    context: ScrapeContext,
    fallbackReason?: string,
  ): Promise<void> {
    try {
      const redis = getRedisConnection();
      const minuteBucket = Math.floor(Date.now() / 60_000);
      const key = `${METRIC_KEY_PREFIX}${operation}:${minuteBucket}`;
      const expireSeconds = 7 * 24 * 3600;

      const fields: Array<[string, number]> = [
        ["total", 1],
        [`engine:${selected}:total`, 1],
        [`engine:${selected}:${outcome}`, 1],
        [`context:${context}:total`, 1],
        [`context:${context}:${outcome}`, 1],
      ];

      if (fallbackReason) {
        fields.push([`fallback:${fallbackReason}`, 1]);
      }

      const tx = redis.multi();
      for (const [field, value] of fields) {
        tx.hincrby(key, field, value);
      }
      tx.expire(key, expireSeconds);
      await tx.exec();
    } catch (error) {
      logger.debug("[ScrapingEngineService] Failed to write engine metric", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async searchAndScrape(
    baseUrl: string,
    query: string,
    options: SearchAndScrapeOptions,
  ) {
    const primary = getPrimaryEngine();
    let metricEngine: EngineName = primary;
    let metricFallbackReason: string | undefined;

    try {
      let result;
      if (primary === "legacy") {
        const legacy = this.getLegacyScraper();
        result = await legacy.searchAndScrape(baseUrl, query, options.siteId, options.attempt, options.visitedQueries);
      } else if (!options.siteId || !options.tenantId) {
        metricFallbackReason = "bot-search-missing-prerequisites";
        logger.warn("[ScrapingEngineService] Bot search skipped due to missing identifiers", {
          context: options.context,
          hasSiteId: Boolean(options.siteId),
          hasTenantId: Boolean(options.tenantId),
        });
        if (this.canFallbackToLegacy()) {
          metricEngine = "legacy";
          const legacy = this.getLegacyScraper();
          result = await legacy.searchAndScrape(baseUrl, query, options.siteId, options.attempt, options.visitedQueries);
        } else {
          result = null;
        }
      } else {
        const discovered = await BotSearchDiscoveryService.discoverProductUrl(baseUrl, query, options.siteId);
        if (!discovered?.url) {
          metricFallbackReason = "bot-search-discovery-miss";
          result = null;
        } else {
          const botResult = await this.getBotAdapter().scrapeUrlWithProbe(
            discovered.url,
            options.tenantId,
            options.siteId,
            query,
          );

          if (botResult && botResult.price > 0) {
            result = {
              title: botResult.title || query,
              price: botResult.price,
              currency: botResult.currency || "USD",
              sku: botResult.sku,
              brand: botResult.brand,
              model: botResult.model,
              url: discovered.url,
              inStock: botResult.inStock,
              imageUrl: botResult.imageUrl,
              specifications: botResult.specifications,
            };
          } else {
            metricFallbackReason = "bot-search-rescrape-failed";
            result = null;
          }
        }
      }

      await this.recordEngineMetric(
        "searchAndScrape",
        metricEngine,
        result ? "success" : "failed",
        options.context,
        metricFallbackReason,
      );
      return result;
    } catch (error) {
      await this.recordEngineMetric(
        "searchAndScrape",
        metricEngine,
        "failed",
        options.context,
        metricFallbackReason,
      );
      throw error;
    }
  }

  static async scrapeByUrl(url: string, options: ScrapeByUrlOptions) {
    const primary = getPrimaryEngine();
    const canUseBotDirect =
      Boolean(options.competitorProductId) &&
      Boolean(options.tenantId);
    const canUseBotProbe =
      Boolean(options.siteId) &&
      Boolean(options.tenantId);

    let selected: EngineName = primary;
    let fallbackReason: string | undefined;

    if (primary === "bot" && !canUseBotDirect) {
      fallbackReason = "bot-scrapeByUrl-missing-identifiers";
      logger.warn("[ScrapingEngineService] Bot scrapeByUrl missing required identifiers", {
        context: options.context,
        hasCompetitorProductId: Boolean(options.competitorProductId),
        hasTenantId: Boolean(options.tenantId),
        hasSiteId: Boolean(options.siteId),
      });
      if (this.canFallbackToLegacy()) {
        selected = "legacy";
      }
    }

    try {
      let result:
        | Awaited<ReturnType<ScraperService["scrapeProductPage"]>>
        | Awaited<ReturnType<ScraperAdapter["scrapeCompetitorProduct"]>>
        | Awaited<ReturnType<ScraperAdapter["scrapeUrlWithProbe"]>>;
      if (selected === "bot" && options.competitorProductId && options.tenantId) {
        result = await this.getBotAdapter().scrapeCompetitorProduct(
          options.competitorProductId,
          url,
          options.tenantId,
        );
      } else if (selected === "bot" && options.siteId && options.tenantId && canUseBotProbe) {
        result = await this.getBotAdapter().scrapeUrlWithProbe(
          url,
          options.tenantId,
          options.siteId,
        );
      } else if (selected === "legacy") {
        const scraper = this.getLegacyScraper();
        result = await scraper.scrapeProductPage(url, {
          isAdvancedProtected: options.isAdvancedProtected,
        });
      } else {
        result = null;
      }

      await this.recordEngineMetric(
        "scrapeByUrl",
        selected,
        result ? "success" : "failed",
        options.context,
        fallbackReason,
      );
      return result;
    } catch (error) {
      await this.recordEngineMetric(
        "scrapeByUrl",
        selected,
        "failed",
        options.context,
        fallbackReason,
      );
      throw error;
    }
  }

  static async scrapeCompetitorProduct(
    competitorProductId: string,
    url: string,
    tenantId: string,
  ) {
    const primary = getPrimaryEngine();

    if (primary === "bot") {
      return this.scrapeByUrl(url, {
        context: "worker",
        competitorProductId,
        tenantId,
      });
    }

    return this.scrapeByUrl(url, {
      context: "worker",
      competitorProductId,
      tenantId,
    });
  }
}
