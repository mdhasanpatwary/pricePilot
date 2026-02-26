import { prisma } from "@/lib/prisma";
import { Product, Site } from "@prisma/client";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import {
  openCartProductSchema,
  laravelProductSchema,
} from "@/lib/validation/schemas";
import { NotificationService } from "./notification";
import { WebsiteService } from "./website-service";
import {
  ValidationError,
  NotFoundError,
  ExternalServiceError,
} from "@/lib/utils/error-handler";
import { CacheInvalidationService } from "./cache-invalidation";
import { withRetry, isRetryableHttpError } from "@/lib/utils/retry";
import { logger } from "@/lib/logger";

/**
 * Represents a product from an external e-commerce platform
 * Used as an intermediate format during product synchronization
 */
interface ExternalProduct {
  /** Unique identifier from the external platform */
  external_id: string;
  /** Stock Keeping Unit (SKU) identifier */
  sku: string | null;
  /** Product title/name */
  title: string;
  /** Product category */
  category?: string | null;
  /** Current price of the product */
  price: number;
  /** Brand/manufacturer name */
  brand: string | null;
  /** Model number or identifier */
  model: string | null;
  /** Stock availability status */
  in_stock: boolean;
  image: string | null;
  url: string | null;
}

// Retry configuration from environment or defaults
const MAX_RETRIES = parseInt(process.env.SYNC_MAX_RETRIES || '3', 10);
const INITIAL_BACKOFF = parseInt(process.env.SYNC_INITIAL_BACKOFF_MS || '1000', 10);
const MAX_BACKOFF = parseInt(process.env.SYNC_MAX_BACKOFF_MS || '30000', 10);

/**
 * Check if mock mode is enabled (for development/testing only)
 *
 * @returns {boolean} True if USE_MOCK_DATA environment variable is set to "true"
 * @private
 */
function isUseMockDataEnabled(): boolean {
  return process.env.USE_MOCK_DATA === "true";
}

/**
 * SyncService - Product Synchronization Service
 *
 * Handles bidirectional synchronization of products between PricePilot and external e-commerce platforms.
 */
export class SyncService {
  /**
   * Synchronizes products from an external site to the internal database
   *
   * @param {string} siteId - Unique identifier of the site to synchronize
   * @returns {Promise<{count: number, siteName: string}>} Sync results
   */
  static async syncSite(siteId: string): Promise<{ count: number; siteName: string }> {
    try {
      if (!siteId || typeof siteId !== 'string' || siteId.trim() === '') {
        throw new ValidationError(
          'Invalid sync request',
          { siteId: ['Site ID is required and must be a valid string'] },
          { context: { operation: 'syncSite' } }
        );
      }

      const site = await WebsiteService.getWebsiteWithToken(siteId, '', 'sync');
      if (!site) {
        throw new NotFoundError('Site', siteId, { context: { operation: 'syncSite' } });
      }

      // 1. Initial State Update
      await prisma.site.update({
        where: { id: siteId },
        data: {
          isSyncing: true,
          syncStartedAt: new Date(),
          syncLastAction: 'Initializing product synchronization...',
          syncProcessed: 0,
        },
      });

      await prisma.syncLog.create({
        data: {
          siteId,
          level: "INFO",
          message: `🔄 Starting sync for ${site.baseUrl} (${site.platform})`
        }
      });

      const startTime = new Date();
      let totalProcessed = 0;
      const priceHistoriesToBatch: { productId: string; price: number }[] = [];

      // Load existing products for efficient lookup/matching
      const existingProducts = await prisma.product.findMany({
        where: { siteId },
        select: { id: true, externalId: true, sku: true, currentPrice: true }
      });

      const existingProductMap = new Map<string, any>();
      existingProducts.forEach(p => {
        if (p.externalId) existingProductMap.set(p.externalId, p);
      });

      // 2. Define Batch Processor
      const processBatch = async (products: ExternalProduct[]) => {
        // Check if sync was terminated
        const currentSite = await prisma.site.findUnique({
          where: { id: siteId },
          select: { isSyncing: true }
        });

        if (!currentSite?.isSyncing) {
          throw new Error('SYNC_TERMINATED');
        }

        await prisma.$transaction(async (tx) => {
          for (const p of products) {
            if (!p.external_id) continue;

            const existing = existingProductMap.get(p.external_id);
            let updatedProduct;

            if (existing) {
              updatedProduct = await tx.product.update({
                where: { id: existing.id },
                data: {
                  sku: p.sku || existing.sku,
                  title: p.title,
                  category: p.category,
                  currentPrice: p.price,
                  brand: p.brand,
                  model: p.model,
                  inStock: p.in_stock,
                  imageUrl: p.image || null,
                  url: p.url,
                  updatedAt: new Date(),
                },
              });
            } else {
              updatedProduct = await tx.product.create({
                data: {
                  siteId,
                  tenantId: site.tenantId,
                  externalId: p.external_id,
                  sku: p.sku,
                  title: p.title,
                  category: p.category,
                  currentPrice: p.price,
                  brand: p.brand,
                  model: p.model,
                  inStock: p.in_stock,
                  imageUrl: p.image || null,
                  url: p.url,
                },
              });
              // Update local map for current batch lookup
              existingProductMap.set(p.external_id, updatedProduct);
            }

            // Track price changes for history
            if (!existing || parseFloat(existing.currentPrice.toString()) !== p.price) {
              priceHistoriesToBatch.push({
                productId: updatedProduct.id,
                price: p.price,
              });
            }
          }
        }, { timeout: 30000 });

        totalProcessed += products.length;

        await prisma.site.update({
          where: { id: siteId },
          data: {
            syncProcessed: totalProcessed,
            syncLastAction: `Processed ${totalProcessed} products...`,
          },
        });
      };

      // 3. Platform-Specific Streaming Fetch
      try {
        if (site.platform === "OPENCART") {
          await this.fetchFromOpenCart(site, processBatch);
        } else if (site.platform === "LARAVEL") {
          await this.fetchFromLaravel(site, processBatch);
        } else {
          throw new ExternalServiceError(
            site.platform,
            `Platform '${site.platform}' is not supported for automatic synchronization`,
            { context: { operation: 'syncSite', metadata: { siteId } } }
          );
        }

        // 4. Batch create all price histories at once
        if (priceHistoriesToBatch.length > 0) {
          const chunkSize = 100;
          for (let i = 0; i < priceHistoriesToBatch.length; i += chunkSize) {
            const chunk = priceHistoriesToBatch.slice(i, i + chunkSize);
            await prisma.priceHistory.createMany({
              data: chunk.map(h => ({
                productId: h.productId,
                price: h.price,
                recordedAt: new Date()
              }))
            });
          }
        }

        const endTime = new Date();
        const duration = (endTime.getTime() - startTime.getTime()) / 1000;

        await prisma.site.update({
          where: { id: siteId },
          data: {
            isSyncing: false,
            lastSyncAt: endTime,
            syncProcessed: totalProcessed,
            syncLastAction: `Sync completed in ${duration.toFixed(1)}s. Total: ${totalProcessed}`,
          },
        });

        await prisma.syncLog.create({
          data: {
            siteId,
            level: "INFO",
            message: `✅ Sync completed: ${totalProcessed} products processed in ${duration.toFixed(1)}s.`
          }
        });

        try {
          const cacheInvalidation = new CacheInvalidationService();
          await cacheInvalidation.onProductSync(site.tenantId);
        } catch (cacheError) {
          console.error('[SyncService] Cache invalidation failed:', cacheError);
        }

        return { count: totalProcessed, siteName: site.baseUrl };
      } catch (error) {
        const err = error as Error;

        if (err.message === 'SYNC_TERMINATED') {
          console.log(`[SyncService] Sync for site ${siteId} was terminated by user.`);
          return { count: totalProcessed, siteName: site.baseUrl };
        }

        await prisma.syncLog.create({
          data: {
            siteId,
            level: "ERROR",
            message: `❌ Sync failed: ${err.message}`,
          },
        });

        await NotificationService.sendSyncError(
          site.tenantId,
          `Failed to sync products from ${site.baseUrl}: ${err.message}`
        );

        await prisma.site.update({
          where: { id: siteId },
          data: { isSyncing: false },
        });
        throw error;
      }
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        'SyncService',
        'An unexpected error occurred during product synchronization',
        {
          cause: error as Error,
          context: {
            operation: 'syncSite',
            metadata: { siteId }
          },
          userMessage: 'An unexpected error occurred while syncing products. Please try again.'
        }
      );
    }
  }

  private static async axiosRequestWithRetry<T = any>(
    config: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return withRetry(
      async () => axios<T>(config),
      {
        maxRetries: MAX_RETRIES,
        initialBackoff: INITIAL_BACKOFF,
        maxBackoff: MAX_BACKOFF,
        shouldRetry: isRetryableHttpError,
        operationName: 'HTTP Request',
        context: {
          method: config.method,
          url: config.url,
        },
        onRetry: async (error, attempt, delay) => {
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;
          logger.warn(`Request to ${config.url} failed, retrying`, {
            attempt,
            maxRetries: MAX_RETRIES,
            delay: `${delay}ms`,
            status,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        },
      }
    );
  }

  private static generateSmartSKU(product: any): string | null {
    if (product.sku && product.sku.trim()) {
      return product.sku.trim();
    }

    if (product.model && product.model.trim()) {
      return product.model.trim();
    }

    const brand = product.manufacturer || product.brand;
    const model = product.model;
    if (brand && model) {
      return `${this.sanitizeSKU(brand)}-${this.sanitizeSKU(model)}`;
    }

    const productId = product.product_id || product.id;
    if (productId) {
      return `PROD-${productId}`;
    }

    const title = product.name || product.title;
    if (title) {
      const words = title.split(/\s+/).slice(0, 3);
      const sanitized = words.map((w: string) => this.sanitizeSKU(w)).join('-');
      const hash = this.simpleHash(title).toString(36).substring(0, 6);
      return `${sanitized}-${hash}`.toUpperCase();
    }

    return null;
  }

  private static sanitizeSKU(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9-]/g, '')
      .replace(/^-+|-+$/g, '')
      .substring(0, 20)
      .toUpperCase();
  }

  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private static async fetchFromOpenCart(
    site: Site & { decryptedToken: string | null },
    onBatch: (products: ExternalProduct[]) => Promise<void>,
  ): Promise<void> {
    if (isUseMockDataEnabled()) {
      console.warn(`[SyncService] Using mock data for OpenCart: ${site.baseUrl}`);
      const { MOCK_OPENCART_PRODUCTS } = await import("@/lib/fixtures/mock-products");
      const mockProducts = MOCK_OPENCART_PRODUCTS.map((p) => ({
        external_id: p.product_id,
        sku: p.sku ?? null,
        title: p.name,
        category: null,
        price: parseFloat(p.price),
        brand: p.brand ?? null,
        model: p.model ?? null,
        in_stock: true,
        image: p.image,
        id: p.product_id,
        url: null,
      }));
      await onBatch(mockProducts);
      return;
    }

    try {
      const apiToken = site.decryptedToken || site.apiToken;
      if (!apiToken) {
        throw new ValidationError('API token is required', { apiToken: ['Missing'] });
      }

      const limit = 100;
      let start = 0;
      let total = 0;

      do {
        const response = await this.axiosRequestWithRetry<any>({
          method: "GET",
          url: `${site.baseUrl}/index.php?route=extension/module/pricepilot/products`,
          params: { api_token: apiToken, start, limit },
          timeout: 30000,
        });

        if (typeof response.data === "string" && response.data.trim().startsWith("<!DOCTYPE")) {
          throw new ExternalServiceError('OpenCart', 'Received HTML instead of JSON');
        }

        let responseData = response.data;
        if (typeof responseData === "string") {
          const jsonStart = responseData.indexOf('{"');
          if (jsonStart !== -1) {
            try {
              const lastBracket = responseData.lastIndexOf('}');
              responseData = JSON.parse(responseData.substring(jsonStart, lastBracket + 1));
            } catch (e) {}
          }
        }

        if (!responseData) break;

        const products = responseData.products || [];
        total = responseData.total || 0;

        if (products.length > 0) {
          const transformedProducts: ExternalProduct[] = products.map((item: any) => {
            const result = openCartProductSchema.safeParse(item);
            if (!result.success) return null;

            const p = result.data;
            return {
              external_id: p.product_id?.toString() || p.id?.toString() || "",
              sku: this.generateSmartSKU(p),
              title: p.name || p.title || "Unknown",
              category: p.category || null,
              price: parseFloat((p.price || p.special || "0").toString()),
              brand: p.manufacturer || null,
              model: p.model || null,
              in_stock: (p.quantity ?? 0) > 0 || p.stock_status === "In Stock" || p.stock_status === "1",
              image: p.image || null,
              url: `${site.baseUrl.replace(/\/$/, "")}/index.php?route=product/product&product_id=${p.product_id || p.id}`,
            };
          }).filter((p: any): p is ExternalProduct => p !== null);

          if (transformedProducts.length > 0) {
            await onBatch(transformedProducts);
          }
        }

        start += limit;
      } while (start < total);

    } catch (error) {
      if (error instanceof ValidationError || error instanceof ExternalServiceError) throw error;
      throw new ExternalServiceError('OpenCart', `OpenCart fetch error: ${(error as Error).message}`, { cause: error as Error });
    }
  }

  private static async fetchFromLaravel(
    site: Site & { decryptedToken: string | null },
    onBatch: (products: ExternalProduct[]) => Promise<void>,
  ): Promise<void> {
    if (isUseMockDataEnabled()) {
      console.warn(`[SyncService] Using mock data for Laravel: ${site.baseUrl}`);
      const { MOCK_LARAVEL_PRODUCTS } = await import("@/lib/fixtures/mock-products");
      const mockProducts = MOCK_LARAVEL_PRODUCTS.map((p) => ({
        external_id: p.id,
        sku: p.sku ?? null,
        title: p.name,
        category: null,
        price: p.price,
        brand: p.brand ?? null,
        model: p.model ?? null,
        in_stock: true,
        image: p.image_url,
        id: p.id,
        url: null,
      }));
      await onBatch(mockProducts);
      return;
    }

    try {
      const apiToken = site.decryptedToken || site.apiToken;
      if (!apiToken) {
        throw new ValidationError('API token is required', { apiToken: ['Missing'] });
      }

      const response = await this.axiosRequestWithRetry<{
        data: any[];
      }>({
        method: "GET",
        url: `${site.baseUrl}/api/pricepilot/sync`,
        headers: { "X-PricePilot-Token": apiToken, Accept: "application/json" },
        timeout: 30000,
      });

      const rawProducts = response.data.data || response.data || [];
      const transformedProducts: ExternalProduct[] = [];

      for (const item of rawProducts) {
        const result = laravelProductSchema.safeParse(item);
        if (result.success) {
          const p = result.data;
          transformedProducts.push({
            external_id: p.id?.toString() || "",
            sku: this.generateSmartSKU(p),
            title: p.name || p.title || "Unknown",
            category: p.category || null,
            price: parseFloat((p.price || "0").toString()),
            brand: p.brand || null,
            model: p.model || null,
            in_stock: p.in_stock ?? (p.quantity !== undefined ? p.quantity > 0 : true),
            image: p.image || null,
            url: (p as any).url || null,
          });
        }
      }

      if (transformedProducts.length > 0) {
        await onBatch(transformedProducts);
      }
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ExternalServiceError) throw error;
      throw new ExternalServiceError('Laravel', `Laravel fetch error: ${(error as Error).message}`, { cause: error as Error });
    }
  }

  static async syncProductsToStore(siteId: string) {
    try {
      const site = await prisma.site.findUnique({ where: { id: siteId } });
      if (!site) throw new NotFoundError('Site', siteId);
      if (!site.apiToken) return { success: true, updated: 0 };

      const siteWithToken = await WebsiteService.getWebsiteWithToken(siteId, site.tenantId, 'price_update');

      const BATCH_SIZE = 10;
      let lastId: string | undefined = undefined;
      let totalUpdated = 0;
      let hasMore = true;

      while (hasMore) {
        const batch: any[] = await prisma.product.findMany({
          where: { siteId, externalId: { not: null } },
          take: BATCH_SIZE,
          skip: lastId ? 1 : 0,
          ...(lastId ? { cursor: { id: lastId } } : {}),
          orderBy: { id: 'asc' }
        });

        if (batch.length === 0) break;
        lastId = batch[batch.length - 1].id;
        hasMore = batch.length === BATCH_SIZE;

        const results = await Promise.all(batch.map(async (product: any) => {
          try {
            if (site.platform === "OPENCART") return await this.updateOpenCartPrice(siteWithToken, product);
            if (site.platform === "LARAVEL") return await this.updateLaravelPrice(siteWithToken, product);
            return null;
          } catch (e) { return null; }
        }));

        totalUpdated += results.filter(r => r !== null).length;
        if (hasMore) await new Promise(r => setTimeout(r, 300));
      }

      return { success: true, updated: totalUpdated };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ExternalServiceError || error instanceof NotFoundError) throw error;
      throw new ExternalServiceError('SyncService', 'Unexpected push error', { cause: error as Error });
    }
  }

  private static async updateOpenCartPrice(site: Site & { decryptedToken: string | null }, product: Product): Promise<boolean> {
    const startTime = Date.now();
    try {
      const apiToken = site.decryptedToken || site.apiToken;
      if (!apiToken) throw new ValidationError('API token is required', { apiToken: ['Missing'] });

      const response = await this.axiosRequestWithRetry<any>({
        method: "POST",
        url: `${site.baseUrl}/api/pricepilot.php?api_token=${apiToken}&action=update`,
        data: { product_id: product.externalId, price: product.currentPrice.toString(), sku: product.sku, verify: true },
        timeout: 10000,
      });

      if (response.data.success !== true) return false;

      await prisma.priceUpdateLog.create({
        data: {
          productId: product.id,
          oldPrice: response.data.old_price ? parseFloat(response.data.old_price.toString()) : product.currentPrice,
          newPrice: product.currentPrice,
          logicType: "FIXED",
          status: "SUCCESS",
          executedAt: new Date()
        }
      });

      const { priceUpdateMonitor } = await import('./price-update-monitor');
      await priceUpdateMonitor.recordUpdate(site.tenantId, {
        productId: product.id,
        externalId: product.externalId || '',
        success: true,
        duration: Date.now() - startTime,
      });

      return true;
    } catch (error) {
      const { priceUpdateMonitor } = await import('./price-update-monitor');
      await priceUpdateMonitor.recordUpdate(site.tenantId, {
        productId: product.id,
        externalId: product.externalId || '',
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });
      return false;
    }
  }

  private static async updateLaravelPrice(site: Site & { decryptedToken: string | null }, product: Product): Promise<boolean> {
    const startTime = Date.now();
    try {
      const apiToken = site.decryptedToken || site.apiToken;
      if (!apiToken) throw new ValidationError('API token is required', { apiToken: ['Missing'] });

      const response = await this.axiosRequestWithRetry<any>({
        method: "POST",
        url: `${site.baseUrl}/api/pricepilot/update`,
        data: { product_id: product.externalId, price: product.currentPrice.toString(), sku: product.sku, verify: true },
        headers: { "X-PricePilot-Token": apiToken, Accept: "application/json" },
        timeout: 10000,
      });

      if (response.data.success !== true) return false;

      await prisma.priceUpdateLog.create({
        data: {
          productId: product.id,
          oldPrice: response.data.old_price ? parseFloat(response.data.old_price.toString()) : product.currentPrice,
          newPrice: product.currentPrice,
          logicType: "FIXED",
          status: "SUCCESS",
          executedAt: new Date()
        }
      });

      const { priceUpdateMonitor } = await import('./price-update-monitor');
      await priceUpdateMonitor.recordUpdate(site.tenantId, {
        productId: product.id,
        externalId: product.externalId || '',
        success: true,
        duration: Date.now() - startTime,
      });

      return true;
    } catch (error) {
      const { priceUpdateMonitor } = await import('./price-update-monitor');
      await priceUpdateMonitor.recordUpdate(site.tenantId, {
        productId: product.id,
        externalId: product.externalId || '',
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      });
      return false;
    }
  }
}
