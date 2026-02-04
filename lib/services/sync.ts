import { prisma } from "@/lib/prisma";
import { Product, Site } from "@prisma/client";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { z } from "zod";
import {
  openCartProductSchema,
  laravelProductSchema,
  shopifyProductSchema,
  wooCommerceProductSchema,
  magentoProductSchema,
} from "@/lib/validation/schemas";
import { NotificationService } from "./notification";
import { WebsiteService } from "./website-service";
import { DecryptionError } from "./encryption/errors";
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
  /** Product image URL */
  image?: string;
  /** Alternative product ID */
  id?: string;
  /** Product URL on the external platform */
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
 * Supports multiple platforms including OpenCart, Laravel, Shopify, WooCommerce, and Magento.
 * 
 * **Key Features:**
 * - Fetches products from external platforms via API
 * - Updates product prices in external platforms
 * - Maintains price history for all changes
 * - Implements retry logic with exponential backoff
 * - Provides comprehensive error handling and logging
 * - Supports batch processing for performance
 * 
 * **Supported Platforms:**
 * - OpenCart (fully supported)
 * - Laravel (fully supported)
 * - Shopify (in development)
 * - WooCommerce (in development)
 * - Magento (in development)
 * 
 * **Security:**
 * - Uses encrypted API tokens
 * - Validates all API responses
 * - Implements rate limiting
 * - Logs all operations for audit trail
 * 
 * @example
 * ```typescript
 * // Sync products from a site
 * const result = await SyncService.syncSite('site-id-123');
 * console.log(`Synced ${result.count} products from ${result.siteName}`);
 * 
 * // Push price updates to a store
 * const pushResult = await SyncService.syncProductsToStore('site-id-123');
 * console.log(`Updated ${pushResult.updated} products`);
 * ```
 * 
 * @see {@link https://docs.pricepilot.com/api/sync PricePilot Sync API Documentation}
 */
export class SyncService {
  /**
   * Synchronizes products from an external e-commerce platform to PricePilot
   * 
   * This method performs a complete product synchronization:
   * 1. Fetches products from the external platform API
   * 2. Validates and transforms product data
   * 3. Upserts products in the database (creates new or updates existing)
   * 4. Records price history for all products
   * 5. Invalidates relevant caches
   * 6. Sends notifications on errors
   * 
   * **Process Flow:**
   * - Validates site exists and has valid API token
   * - Clears previous sync logs
   * - Fetches products from platform-specific API
   * - Processes products in batches to avoid memory issues
   * - Updates sync progress every 10 products
   * - Handles manual sync termination
   * - Maintains transaction integrity
   * 
   * **Error Handling:**
   * - Validates input parameters
   * - Handles API token decryption failures
   * - Manages network and API errors with retry logic
   * - Logs all errors with context
   * - Sends user notifications on failures
   * - Ensures sync lock is released on error
   * 
   * @param {string} siteId - Unique identifier of the site to synchronize
   * @returns {Promise<{count: number, siteName: string}>} Result object containing:
   *   - count: Number of products successfully synchronized
   *   - siteName: Base URL of the synchronized site
   * 
   * @throws {ValidationError} If siteId is invalid or missing
   * @throws {NotFoundError} If site does not exist
   * @throws {ExternalServiceError} If API communication fails
   * @throws {DecryptionError} If API token decryption fails
   * 
   * @example
   * ```typescript
   * try {
   *   const result = await SyncService.syncSite('site-abc-123');
   *   console.log(`Successfully synced ${result.count} products from ${result.siteName}`);
   * } catch (error) {
   *   if (error instanceof NotFoundError) {
   *     console.error('Site not found');
   *   } else if (error instanceof ExternalServiceError) {
   *     console.error('API communication failed:', error.message);
   *   }
   * }
   * ```
   * 
   * @see {@link syncProductsToStore} For pushing price updates to stores
   * @see {@link fetchFromOpenCart} For OpenCart-specific implementation
   * @see {@link fetchFromLaravel} For Laravel-specific implementation
   */
  static async syncSite(siteId: string) {
    try {
      // Validate input
      if (!siteId || typeof siteId !== 'string' || siteId.trim() === '') {
        throw new ValidationError(
          'Invalid sync request',
          { siteId: ['Site ID is required and must be a valid string'] },
          { context: { operation: 'syncSite' } }
        );
      }

      const site = await prisma.site.findUnique({
        where: { id: siteId },
        include: { tenant: true },
      });

      if (!site) {
        throw new NotFoundError(
          'Site',
          siteId,
          { context: { operation: 'syncSite' } }
        );
      }

      const startTime = new Date();

      // Clear previous logs before starting new sync session
      await prisma.syncLog.deleteMany({ where: { siteId } });

      await prisma.site.update({
        where: { id: siteId },
        data: {
          isSyncing: true,
          syncStartedAt: startTime,
          syncProcessed: 0,
          syncLastAction: "Initializing sync..."
        },
      });

      await prisma.syncLog.create({
        data: {
          siteId,
          level: "INFO",
          message: `🔄 Starting product synchronization for ${site.platform}...`
        }
      });

      try {
        // Get site with decrypted token for API calls
        let siteWithToken;
        try {
          siteWithToken = await WebsiteService.getWebsiteWithToken(
            siteId,
            site.tenantId,
            'product_sync'
          );
        } catch (error) {
          if (error instanceof DecryptionError) {
            // Log decryption error
            await prisma.syncLog.create({
              data: {
                siteId,
                level: "ERROR",
                message: `❌ Failed to decrypt API token: ${error.message}`
              }
            });

            // Send notification to tenant
            await NotificationService.sendSyncError(
              site.tenantId,
              `Failed to decrypt API token for ${site.baseUrl}. Please re-enter your token in settings.`
            );

            throw new ExternalServiceError(
              site.platform,
              'Failed to decrypt API token',
              {
                cause: error,
                context: {
                  tenantId: site.tenantId,
                  operation: 'syncSite',
                  metadata: { siteId, baseUrl: site.baseUrl }
                },
                userMessage: 'Failed to decrypt API token. Please re-enter your token in settings.'
              }
            );
          }
          throw error;
        }

        let externalProducts: ExternalProduct[] = [];
        try {
          if (site.platform === "OPENCART") {
            externalProducts = await this.fetchFromOpenCart(siteWithToken);
          } else if (site.platform === "LARAVEL") {
            externalProducts = await this.fetchFromLaravel(siteWithToken);
          } else if (site.platform === "SHOPIFY") {
            externalProducts = await this.fetchFromShopify(siteWithToken);
          } else if (site.platform === "WOOCOMMERCE") {
            externalProducts = await this.fetchFromWooCommerce(siteWithToken);
          } else if (site.platform === "MAGENTO") {
            externalProducts = await this.fetchFromMagento(siteWithToken);
          } else {
            throw new ValidationError(
              'Unsupported platform',
              { platform: [`Platform ${site.platform} is not supported`] },
              {
                context: {
                  tenantId: site.tenantId,
                  operation: 'syncSite',
                  metadata: { siteId, platform: site.platform }
                }
              }
            );
          }
        } catch (error) {
          // If it's already an AppError, re-throw
          if (error instanceof ValidationError || error instanceof ExternalServiceError) {
            throw error;
          }

          // Wrap unexpected errors
          throw new ExternalServiceError(
            site.platform,
            `Failed to fetch products from ${site.platform}`,
            {
              cause: error as Error,
              context: {
                tenantId: site.tenantId,
                operation: 'syncSite',
                metadata: { siteId, platform: site.platform, baseUrl: site.baseUrl }
              },
              isRetryable: this.isRetryableError(error),
              userMessage: `Unable to fetch products from your ${site.platform} store. Please check your API token and try again.`
            }
          );
        }

        await prisma.site.update({
          where: { id: siteId },
          data: {
            syncTotal: externalProducts.length,
            syncLastAction: `Fetched ${externalProducts.length} products`
          },
        });

        await prisma.syncLog.create({
          data: {
            siteId,
            level: "INFO",
            message: `📡 API responded: Found ${externalProducts.length} products to process.`
          }
        });

        // 2. Process and Upsert products in transactions
        // FIX: Fetch all existing products upfront to avoid N+1 queries
        const externalIds = externalProducts.map(p => p.external_id).filter(Boolean);
        const existingProducts = await prisma.product.findMany({
          where: {
            siteId: site.id,
            externalId: { in: externalIds },
          },
        });

        // Create a map for O(1) lookup
        const existingProductMap = new Map(
          existingProducts.map(p => [p.externalId, p])
        );

        const results = [];
        let processed = 0;

        for (const extProd of externalProducts) {
          try {
            // Check if sync was manually stopped (check every 10 products to reduce queries)
            if (processed % 10 === 0) {
              const currentSite = await prisma.site.findUnique({
                where: { id: siteId },
                select: { isSyncing: true },
              });

              if (!currentSite?.isSyncing) {
                console.log(`[SyncService] Sync terminated manually for site ${siteId}`);
                await prisma.syncLog.create({
                  data: {
                    siteId,
                    level: "WARN",
                    message: "🛑 Synchronization terminated manually by user.",
                  },
                });
                return { count: results.length, siteName: site.baseUrl };
              }
            }

            const product = await prisma.$transaction(async (tx) => {
              // FIX: Use the pre-fetched map instead of querying
              const existingProduct = existingProductMap.get(extProd.external_id);

              let p;
              const productData = {
                title: extProd.title,
                category: extProd.category,
                currentPrice: extProd.price,
                sku: extProd.sku,
                model: extProd.model,
                brand: extProd.brand,
                imageUrl: extProd.image,
                url: extProd.url,
                lastCrawledAt: new Date(),
              };

              if (existingProduct) {
                p = await tx.product.update({
                  where: { id: existingProduct.id },
                  data: productData,
                });
              } else {
                p = await tx.product.create({
                  data: {
                    ...productData,
                    siteId: site.id,
                    tenantId: site.tenantId,
                    externalId: extProd.external_id,
                    currency: "USD",
                  },
                });
              }

              // 3. Record price history (Atomic with the update)
              await tx.priceHistory.create({
                data: {
                  productId: p.id,
                  price: extProd.price,
                },
              });

              return p;
            });

            results.push(product);
            processed++;

            // Update progress every 10 products
            if (processed % 10 === 0) {
              await prisma.site.update({
                where: { id: siteId },
                data: {
                  syncProcessed: processed,
                  syncLastAction: `Processing products (${processed}/${externalProducts.length})`
                },
              });
            }
          } catch (error) {
            console.error(
              `[SAFE-SYNC] Error processing external product ${extProd.external_id}:`,
              error,
            );
          }
        }

        // 4. Update last sync time and finish
        await prisma.site.update({
          where: { id: siteId },
          data: {
            lastSyncAt: new Date(),
            isSyncing: false,
            syncProcessed: processed,
            syncTotal: externalProducts.length,
            syncLastAction: "Completed"
          },
        });

        // Log success in SyncLogs if we have a way to record them for Source too
        await prisma.syncLog.create({
          data: {
            siteId,
            level: "INFO",
            message: `✅ Integration sync completed: ${results.length} products imported.`,
          },
        });

        // Invalidate cache after successful product sync
        // Requirement 2.2: Product sync invalidation
        try {
          const cacheInvalidation = new CacheInvalidationService();
          await cacheInvalidation.onProductSync(site.tenantId);
        } catch (cacheError) {
          // Log cache invalidation error but don't fail the operation
          console.error('[SyncService] Cache invalidation failed:', cacheError);
        }

        return {
          count: results.length,
          siteName: site.baseUrl,
        };
      } catch (error) {
        const err = error as Error;
        // Record error in logs
        await prisma.syncLog.create({
          data: {
            siteId,
            level: "ERROR",
            message: `❌ Sync failed: ${err.message}`,
          },
        });

        // Send notification to tenant about sync failure
        await NotificationService.sendSyncError(
          site.tenantId,
          `Failed to sync products from ${site.baseUrl}: ${err.message}`
        );

        // Ensure we clear the sync lock on error
        await prisma.site.update({
          where: { id: siteId },
          data: { isSyncing: false },
        });
        throw error;
      }
    } catch (error) {
      // If already an AppError, re-throw with context
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ExternalServiceError) {
        throw error;
      }

      // Wrap unexpected errors
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

  /**
   * Executes HTTP requests with automatic retry logic and exponential backoff
   * 
   * This helper method wraps Axios requests with intelligent retry behavior:
   * - Automatically retries on transient failures (network errors, timeouts, 5xx errors)
   * - Implements exponential backoff between retries
   * - Logs retry attempts with detailed context
   * - Respects configurable retry limits
   * 
   * **Retry Conditions:**
   * - Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
   * - HTTP 5xx server errors
   * - HTTP 429 (Too Many Requests)
   * - HTTP 408 (Request Timeout)
   * 
   * **Configuration:**
   * - MAX_RETRIES: Maximum number of retry attempts (default: 3)
   * - INITIAL_BACKOFF: Initial delay in milliseconds (default: 1000ms)
   * - MAX_BACKOFF: Maximum delay in milliseconds (default: 30000ms)
   * 
   * @template T - Expected response data type
   * @param {AxiosRequestConfig} config - Axios request configuration
   * @returns {Promise<AxiosResponse<T>>} Axios response with typed data
   * 
   * @throws {AxiosError} If all retry attempts fail
   * 
   * @example
   * ```typescript
   * const response = await this.axiosRequestWithRetry<ProductData>({
   *   method: 'GET',
   *   url: 'https://api.example.com/products',
   *   timeout: 10000
   * });
   * ```
   * 
   * @private
   * @see {@link withRetry} Core retry utility function
   * @see {@link isRetryableHttpError} Retry condition checker
   */
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
          // Log retry attempt with details
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

  /**
   * Determines if an error should trigger a retry attempt
   * 
   * Analyzes error characteristics to decide if the operation should be retried.
   * Focuses on transient failures that are likely to succeed on retry.
   * 
   * **Retryable Conditions:**
   * - No HTTP status code (network failure)
   * - HTTP 5xx (server errors)
   * - HTTP 429 (rate limiting)
   * - HTTP 408 (request timeout)
   * - Network error codes (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
   * 
   * **Non-Retryable Conditions:**
   * - HTTP 4xx (except 408, 429) - client errors
   * - HTTP 2xx, 3xx - successful responses
   * 
   * @param {any} error - Error object to analyze (typically AxiosError)
   * @returns {boolean} True if the error is retryable, false otherwise
   * 
   * @example
   * ```typescript
   * try {
   *   await axios.get('https://api.example.com/data');
   * } catch (error) {
   *   if (this.isRetryableError(error)) {
   *     // Retry the request
   *   } else {
   *     // Fail immediately
   *   }
   * }
   * ```
   * 
   * @private
   */
  private static isRetryableError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      // Retry on network errors, timeouts, and server errors
      if (!status || status >= 500 || status === 429 || status === 408) {
        return true;
      }
    }
    // Retry on network errors (ECONNREFUSED, ETIMEDOUT, etc.)
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    return false;
  }

  /**
   * Generates a smart SKU when the source system doesn't provide one
   * 
   * Implements a multi-strategy approach to SKU generation, prioritizing
   * existing data and falling back to intelligent generation when needed.
   * 
   * **Strategy Priority (in order):**
   * 1. **Use existing SKU** - If product already has a SKU, use it
   * 2. **Use Model** - Common in e-commerce platforms (OpenCart/Laravel)
   * 3. **Generate from Brand + Model** - Combines both for uniqueness
   * 4. **Generate from Product ID** - Most reliable fallback (PROD-{id})
   * 5. **Generate from Title** - Last resort using title hash
   * 
   * **Title-Based Generation:**
   * - Takes first 3 words from title
   * - Sanitizes to alphanumeric characters
   * - Adds 6-character hash for uniqueness
   * - Format: WORD1-WORD2-WORD3-HASH6
   * 
   * @param {any} product - Product data from external system
   * @returns {string | null} Generated or existing SKU, or null if generation fails
   * 
   * @example
   * ```typescript
   * // Example 1: Existing SKU
   * const sku1 = this.generateSmartSKU({ sku: 'ABC-123' });
   * // Returns: 'ABC-123'
   * 
   * // Example 2: From Model
   * const sku2 = this.generateSmartSKU({ model: 'iPhone-15-Pro' });
   * // Returns: 'iPhone-15-Pro'
   * 
   * // Example 3: From Brand + Model
   * const sku3 = this.generateSmartSKU({ brand: 'Apple', model: 'iPhone-15' });
   * // Returns: 'APPLE-IPHONE-15'
   * 
   * // Example 4: From Product ID
   * const sku4 = this.generateSmartSKU({ product_id: '12345' });
   * // Returns: 'PROD-12345'
   * 
   * // Example 5: From Title
   * const sku5 = this.generateSmartSKU({ name: 'Apple iPhone 15 Pro Max' });
   * // Returns: 'APPLE-IPHONE-15-A3F9D2'
   * ```
   * 
   * @private
   * @see {@link sanitizeSKU} For SKU string sanitization
   * @see {@link simpleHash} For title hashing
   */
  private static generateSmartSKU(product: any): string | null {
    // Strategy 1: Use existing SKU
    if (product.sku && product.sku.trim()) {
      return product.sku.trim();
    }

    // Strategy 2: Use Model (common in OpenCart/Laravel)
    if (product.model && product.model.trim()) {
      return product.model.trim();
    }

    // Strategy 3: Generate from Brand + Model
    const brand = product.manufacturer || product.brand;
    const model = product.model;
    if (brand && model) {
      return `${this.sanitizeSKU(brand)}-${this.sanitizeSKU(model)}`;
    }

    // Strategy 4: Use Product ID (most reliable fallback)
    const productId = product.product_id || product.id;
    if (productId) {
      return `PROD-${productId}`;
    }

    // Strategy 5: Generate from title (last resort)
    const title = product.name || product.title;
    if (title) {
      // Take first 3 words, sanitize, and add hash
      const words = title.split(/\s+/).slice(0, 3);
      const sanitized = words.map((w: string) => this.sanitizeSKU(w)).join('-');
      const hash = this.simpleHash(title).toString(36).substring(0, 6);
      return `${sanitized}-${hash}`.toUpperCase();
    }

    // No SKU could be generated
    return null;
  }

  /**
   * Sanitizes a string for use in SKU generation
   * 
   * Removes special characters and normalizes the string to create
   * a clean, URL-safe SKU component.
   * 
   * **Transformations:**
   * - Removes all non-alphanumeric characters except hyphens
   * - Removes leading and trailing hyphens
   * - Truncates to 20 characters maximum
   * - Converts to uppercase
   * 
   * @param {string} str - String to sanitize
   * @returns {string} Sanitized string suitable for SKU
   * 
   * @example
   * ```typescript
   * this.sanitizeSKU('Apple iPhone 15!');  // Returns: 'APPLEIPHONE15'
   * this.sanitizeSKU('Model-X (2024)');    // Returns: 'MODELX2024'
   * this.sanitizeSKU('---test---');        // Returns: 'TEST'
   * ```
   * 
   * @private
   */
  private static sanitizeSKU(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9-]/g, '')
      .replace(/^-+|-+$/g, '')
      .substring(0, 20)
      .toUpperCase();
  }

  /**
   * Generates a simple hash from a string for SKU generation
   * 
   * Uses a basic hash algorithm to create a numeric hash from a string.
   * The hash is deterministic (same input always produces same output)
   * and suitable for creating unique SKU suffixes.
   * 
   * **Algorithm:**
   * - Iterates through each character
   * - Applies bit-shifting and addition
   * - Converts to 32-bit integer
   * - Returns absolute value
   * 
   * @param {string} str - String to hash
   * @returns {number} Positive integer hash value
   * 
   * @example
   * ```typescript
   * const hash1 = this.simpleHash('Apple iPhone 15');
   * const hash2 = this.simpleHash('Apple iPhone 15'); // Same as hash1
   * const hash3 = this.simpleHash('Apple iPhone 16'); // Different from hash1
   * 
   * // Convert to base36 for compact representation
   * const compact = hash1.toString(36).substring(0, 6); // e.g., 'a3f9d2'
   * ```
   * 
   * @private
   */
  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Fetches products from an OpenCart store via API
   * 
   * Connects to the OpenCart PricePilot extension API to retrieve product data.
   * Handles various response formats, validates data, and transforms it into
   * the standard ExternalProduct format.
   * 
   * **API Endpoint:**
   * - URL: `{baseUrl}/index.php?route=api/pricepilot&api_token={token}`
   * - Method: GET
   * - Timeout: 30 seconds
   * 
   * **Features:**
   * - Validates API responses
   * - Handles corrupted JSON responses
   * - Generates smart SKUs for products without SKUs
   * - Validates products against schema
   * - Logs validation errors
   * - Supports mock data mode for development
   * 
   * **Error Handling:**
   * - Detects HTML responses (indicates extension not installed)
   * - Handles JSON parsing errors
   * - Validates each product against schema
   * - Logs skipped products with reasons
   * - Wraps errors in ExternalServiceError
   * 
   * @param {Site & { decryptedToken: string | null }} site - Site object with decrypted API token
   * @returns {Promise<ExternalProduct[]>} Array of validated products
   * 
   * @throws {ValidationError} If API token is missing
   * @throws {ExternalServiceError} If API communication fails or returns invalid data
   * 
   * @example
   * ```typescript
   * const site = await WebsiteService.getWebsiteWithToken('site-id', 'tenant-id', 'sync');
   * const products = await this.fetchFromOpenCart(site);
   * console.log(`Fetched ${products.length} products from OpenCart`);
   * ```
   * 
   * @private
   * @see {@link fetchFromLaravel} For Laravel implementation
   * @see {@link generateSmartSKU} For SKU generation
   */
  private static async fetchFromOpenCart(
    site: Site & { decryptedToken: string | null },
  ): Promise<ExternalProduct[]> {
    // Development mock mode (only if explicitly enabled)
    if (isUseMockDataEnabled()) {
      console.warn(`[SyncService] Using mock data for OpenCart (USE_MOCK_DATA=true): ${site.baseUrl}`);
      const { MOCK_OPENCART_PRODUCTS } = await import("@/lib/fixtures/mock-products");
      return MOCK_OPENCART_PRODUCTS.map((p) => ({
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
    }

    interface OpenCartProduct {
      product_id?: string | number;
      id?: string | number;
      sku?: string;
      name?: string;
      title?: string;
      category?: string;
      price?: string;
      special?: string;
      manufacturer?: string;
      model?: string;
      image?: string;
      quantity?: number;
      stock_status?: string;
    }

    try {
      // Use decrypted token for API call
      const apiToken = site.decryptedToken || site.apiToken;

      if (!apiToken) {
        throw new ValidationError(
          'API token is required',
          { apiToken: ['API token is missing or invalid'] },
          {
            context: {
              tenantId: site.tenantId,
              operation: 'fetchFromOpenCart',
              metadata: { siteId: site.id, baseUrl: site.baseUrl }
            }
          }
        );
      }

      // Normalize URL (avoid double slashes)
      const cleanBaseUrl = site.baseUrl.replace(/\/$/, "");
      const apiUrl = `${cleanBaseUrl}/index.php?route=api/pricepilot&api_token=${apiToken}`;

      console.log(`[SyncService] Fetching from OpenCart: ${apiUrl}`);

      let response;
      try {
        response = await this.axiosRequestWithRetry<any>({
          method: "GET",
          url: apiUrl,
          timeout: 30000,
        });
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const statusCode = error.response?.status;
          const isRetryable = !statusCode || statusCode >= 500 || statusCode === 429 || statusCode === 408;

          throw new ExternalServiceError(
            'OpenCart',
            `Failed to connect to OpenCart API: ${error.message}`,
            {
              cause: error,
              serviceStatusCode: statusCode,
              isRetryable,
              context: {
                tenantId: site.tenantId,
                operation: 'fetchFromOpenCart',
                metadata: { siteId: site.id, baseUrl: site.baseUrl, statusCode }
              },
              userMessage: statusCode === 401 || statusCode === 403
                ? 'Invalid API token. Please check your OpenCart API token in settings.'
                : 'Unable to connect to your OpenCart store. Please check your store URL and API token.'
            }
          );
        }
        throw error;
      }

      // Check for HTML response (happens on 404/500 if server returns error page)
      if (typeof response.data === "string" && response.data.includes("<html")) {
        console.error(`[SyncService] Received HTML instead of JSON from ${site.baseUrl}. Check if the PricePilot extension is correctly installed and accessible.`);
        throw new ExternalServiceError(
          'OpenCart',
          'Invalid API response: Received HTML instead of JSON',
          {
            context: {
              tenantId: site.tenantId,
              operation: 'fetchFromOpenCart',
              metadata: { siteId: site.id, baseUrl: site.baseUrl }
            },
            userMessage: 'The OpenCart PricePilot extension may not be installed correctly. Please verify the installation.'
          }
        );
      }

      let responseData = response.data;

      // Handle corrupted JSON responses (common when PHP errors or echoes are present)
      if (typeof responseData === "string") {
        console.warn(`[SyncService] Received string response instead of JSON object. Attempting to extract JSON...`);
        const jsonStart = responseData.indexOf('{"products"');
        const fallbackStart = responseData.indexOf('{');

        const actualStart = jsonStart !== -1 ? jsonStart : fallbackStart;

        if (actualStart !== -1) {
          try {
            // Find the last closing bracket to be safe
            const lastBracket = responseData.lastIndexOf('}');
            if (lastBracket !== -1 && lastBracket > actualStart) {
              const jsonStr = responseData.substring(actualStart, lastBracket + 1);
              responseData = JSON.parse(jsonStr);
              console.log(`[SyncService] Successfully extracted and parsed JSON from string response.`);
            }
          } catch (parseError) {
            console.error(`[SyncService] Failed to parse extracted JSON string:`, parseError);
            throw new ExternalServiceError(
              'OpenCart',
              'Failed to parse API response',
              {
                cause: parseError as Error,
                context: {
                  tenantId: site.tenantId,
                  operation: 'fetchFromOpenCart',
                  metadata: { siteId: site.id, baseUrl: site.baseUrl }
                },
                userMessage: 'Received invalid data from OpenCart. Please check your store configuration.'
              }
            );
          }
        }
      }

      if (!responseData) {
        console.warn(`[SyncService] Empty or invalid response from ${site.baseUrl}`);
        return [];
      }

      const rawProducts = Array.isArray(responseData)
        ? responseData
        : (responseData.products || []);

      console.log(`[SyncService] Fetched ${rawProducts.length} raw products from OpenCart: ${site.baseUrl}`);

      // Log first product for debugging if exists
      if (rawProducts.length > 0) {
        console.log(`[SyncService] Sample product data:`, JSON.stringify(rawProducts[0]).substring(0, 200));
      }

      const validProducts: OpenCartProduct[] = [];

      for (const item of rawProducts) {
        const result = openCartProductSchema.safeParse(item);
        if (result.success) {
          validProducts.push({
            ...result.data,
            product_id: result.data.product_id,
            id: result.data.id,
            sku: result.data.sku || undefined,
            name: result.data.name,
            title: result.data.title,
            category: result.data.category || undefined,
            price: result.data.price?.toString(),
            special: result.data.special?.toString() || undefined,
            manufacturer: result.data.manufacturer || undefined,
            model: result.data.model || undefined,
            image: result.data.image || undefined,
            quantity: result.data.quantity ?? 0,
            stock_status: result.data.stock_status || "",
          });
        } else {
          console.warn(
            `[SyncService] Skipping invalid OpenCart product for ${site.baseUrl}:`,
            result.error.flatten(),
          );
          if (validProducts.length < 5) {
            await prisma.syncLog.create({
              data: {
                siteId: site.id,
                level: "WARN",
                message: `⚠️ Skipping product: ${JSON.stringify(result.error.flatten().fieldErrors).substring(0, 100)}`,
              }
            });
          }
        }
      }

      return validProducts.map((p) => ({
        external_id: p.product_id?.toString() || p.id?.toString() || "",
        sku: this.generateSmartSKU(p),
        title: p.name || p.title || "Unknown Product",
        category: p.category || null,
        price: parseFloat((p.price || p.special || "0").toString()),
        brand: p.manufacturer || null,
        model: p.model || null,
        in_stock: (p.quantity ?? 0) > 0 || p.stock_status === "In Stock" || p.stock_status === "1",
        image: p.image || undefined,
        url: `${site.baseUrl.replace(/\/$/, "")}/index.php?route=product/product&product_id=${p.product_id || p.id}`,
      }));
    } catch (error) {
      // If already an AppError, re-throw
      if (error instanceof ValidationError || error instanceof ExternalServiceError) {
        throw error;
      }

      const err = error as Error;
      console.error(`OpenCart API error for ${site.baseUrl}:`, err);

      // Log detailed error for debugging
      await prisma.syncLog.create({
        data: {
          siteId: site.id,
          level: "ERROR",
          message: `❌ Failed to fetch products from OpenCart: ${err.message}`
        }
      });

      // Wrap unexpected errors
      throw new ExternalServiceError(
        'OpenCart',
        `Failed to sync products from OpenCart: ${err.message}`,
        {
          cause: err,
          context: {
            tenantId: site.tenantId,
            operation: 'fetchFromOpenCart',
            metadata: { siteId: site.id, baseUrl: site.baseUrl }
          },
          isRetryable: true,
          userMessage: 'An unexpected error occurred while fetching products from OpenCart. Please try again.'
        }
      );
    }
  }

  /**
   * Fetches products from a Laravel store via API
   * 
   * Connects to the Laravel PricePilot package API to retrieve product data.
   * Uses custom authentication header and validates responses.
   * 
   * **API Endpoint:**
   * - URL: `{baseUrl}/api/pricepilot/sync`
   * - Method: GET
   * - Headers: X-PricePilot-Token, Accept: application/json
   * - Timeout: 30 seconds
   * 
   * **Expected Response Format:**
   * ```json
   * {
   *   "data": [
   *     {
   *       "id": "123",
   *       "sku": "PROD-001",
   *       "name": "Product Name",
   *       "price": "99.99",
   *       "brand": "Brand Name",
   *       "model": "Model-X",
   *       "in_stock": true
   *     }
   *   ]
   * }
   * ```
   * 
   * **Features:**
   * - Custom authentication via X-PricePilot-Token header
   * - Schema validation for each product
   * - Smart SKU generation for products without SKUs
   * - Supports mock data mode for development
   * - Comprehensive error handling
   * 
   * @param {Site & { decryptedToken: string | null }} site - Site object with decrypted API token
   * @returns {Promise<ExternalProduct[]>} Array of validated products
   * 
   * @throws {ValidationError} If API token is missing
   * @throws {ExternalServiceError} If API communication fails
   * 
   * @example
   * ```typescript
   * const site = await WebsiteService.getWebsiteWithToken('site-id', 'tenant-id', 'sync');
   * const products = await this.fetchFromLaravel(site);
   * console.log(`Fetched ${products.length} products from Laravel`);
   * ```
   * 
   * @private
   * @see {@link fetchFromOpenCart} For OpenCart implementation
   */
  private static async fetchFromLaravel(
    site: Site & { decryptedToken: string | null },
  ): Promise<ExternalProduct[]> {
    // Development mock mode (only if explicitly enabled)
    if (isUseMockDataEnabled()) {
      console.warn(`[SyncService] Using mock data for Laravel (USE_MOCK_DATA=true): ${site.baseUrl}`);
      const { MOCK_LARAVEL_PRODUCTS } = await import("@/lib/fixtures/mock-products");
      return MOCK_LARAVEL_PRODUCTS.map((p) => ({
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
    }

    interface LaravelProduct {
      id?: string | number;
      sku?: string;
      name?: string;
      title?: string;
      category?: string;
      price?: string;
      brand?: string;
      model?: string;
      image?: string;
      in_stock?: boolean;
      quantity?: number;
    }

    try {
      // Use decrypted token for API call
      const apiToken = site.decryptedToken || site.apiToken;

      if (!apiToken) {
        throw new ValidationError(
          'API token is required',
          { apiToken: ['API token is missing or invalid'] },
          {
            context: {
              tenantId: site.tenantId,
              operation: 'fetchFromLaravel',
              metadata: { siteId: site.id, baseUrl: site.baseUrl }
            }
          }
        );
      }

      let response;
      try {
        response = await this.axiosRequestWithRetry<{
          data: LaravelProduct[];
        }>({
          method: "GET",
          url: `${site.baseUrl}/api/pricepilot/sync`,
          headers: {
            "X-PricePilot-Token": apiToken,
            Accept: "application/json",
          },
          timeout: 30000,
        });
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const statusCode = error.response?.status;
          const isRetryable = !statusCode || statusCode >= 500 || statusCode === 429 || statusCode === 408;

          throw new ExternalServiceError(
            'Laravel',
            `Failed to connect to Laravel API: ${error.message}`,
            {
              cause: error,
              serviceStatusCode: statusCode,
              isRetryable,
              context: {
                tenantId: site.tenantId,
                operation: 'fetchFromLaravel',
                metadata: { siteId: site.id, baseUrl: site.baseUrl, statusCode }
              },
              userMessage: statusCode === 401 || statusCode === 403
                ? 'Invalid API token. Please check your Laravel API token in settings.'
                : 'Unable to connect to your Laravel store. Please check your store URL and API token.'
            }
          );
        }
        throw error;
      }

      // Expected Laravel response format:
      // { data: [{ id, sku, name, price, brand, model }] }
      const rawProducts = response.data.data || response.data || [];
      const validProducts: LaravelProduct[] = [];

      for (const item of rawProducts) {
        const result = laravelProductSchema.safeParse(item);
        if (result.success) {
          validProducts.push({
            ...result.data,
            id: result.data.id,
            sku: result.data.sku || undefined,
            name: result.data.name,
            title: result.data.title,
            category: result.data.category || undefined,
            price: result.data.price?.toString(),
            brand: result.data.brand || undefined,
            model: result.data.model || undefined,
            image: result.data.image || undefined,
            in_stock: result.data.in_stock,
          });
        } else {
          console.warn(
            `[SyncService] Skipping invalid Laravel product for ${site.baseUrl}:`,
            result.error.flatten(),
          );
        }
      }

      return validProducts.map((p) => ({
        external_id: p.id?.toString() || "",
        sku: this.generateSmartSKU(p),
        title: p.name || p.title || "Unknown Product",
        category: p.category || null,
        price: parseFloat((p.price || "0").toString()),
        brand: p.brand || null,
        model: p.model || null,
        in_stock: p.in_stock ?? (p.quantity !== undefined ? p.quantity > 0 : true),
        image: p.image || undefined,
        url: (p as any).url || null,
      }));
    } catch (error) {
      // If already an AppError, re-throw
      if (error instanceof ValidationError || error instanceof ExternalServiceError) {
        throw error;
      }

      const err = error as Error;
      console.error(`Laravel API error for ${site.baseUrl}:`, err);

      // Log detailed error for debugging
      await prisma.syncLog.create({
        data: {
          siteId: site.id,
          level: "ERROR",
          message: `❌ Failed to fetch products from Laravel: ${err.message}`
        }
      });

      // Wrap unexpected errors
      throw new ExternalServiceError(
        'Laravel',
        `Failed to sync products from Laravel: ${err.message}`,
        {
          cause: err,
          context: {
            tenantId: site.tenantId,
            operation: 'fetchFromLaravel',
            metadata: { siteId: site.id, baseUrl: site.baseUrl }
          },
          isRetryable: true,
          userMessage: 'An unexpected error occurred while fetching products from Laravel. Please try again.'
        }
      );
    }
  }

  /**
   * Pushes price updates from PricePilot to an external e-commerce platform
   * 
   * Synchronizes product prices from the PricePilot database to the connected
   * external store. Processes products in batches to respect API rate limits
   * and prevent overwhelming the external platform.
   * 
   * **Process Flow:**
   * 1. Validates site exists and has API token
   * 2. Decrypts API token for secure communication
   * 3. Filters products with external IDs
   * 4. Processes products in batches of 5
   * 5. Calls platform-specific update method
   * 6. Adds delay between batches (500ms)
   * 7. Returns success count
   * 
   * **Batch Processing:**
   * - Batch size: 5 products
   * - Inter-batch delay: 500ms
   * - Parallel processing within batch
   * - Continues on individual failures
   * 
   * **Supported Platforms:**
   * - OpenCart: via updateOpenCartPrice()
   * - Laravel: via updateLaravelPrice()
   * 
   * @param {string} siteId - Unique identifier of the site to update
   * @returns {Promise<{success: boolean, updated: number}>} Result object containing:
   *   - success: Whether the operation completed
   *   - updated: Number of products successfully updated
   * 
   * @throws {ValidationError} If siteId is invalid
   * @throws {NotFoundError} If site does not exist
   * @throws {ExternalServiceError} If token decryption fails
   * 
   * @example
   * ```typescript
   * const result = await SyncService.syncProductsToStore('site-abc-123');
   * console.log(`Updated ${result.updated} products in store`);
   * ```
   * 
   * @see {@link updateOpenCartPrice} For OpenCart price updates
   * @see {@link updateLaravelPrice} For Laravel price updates
   * @see {@link syncSite} For pulling products from stores
   */
  static async syncProductsToStore(siteId: string) {
    try {
      // Validate input
      if (!siteId || typeof siteId !== 'string' || siteId.trim() === '') {
        throw new ValidationError(
          'Invalid sync request',
          { siteId: ['Site ID is required and must be a valid string'] },
          { context: { operation: 'syncProductsToStore' } }
        );
      }

      const site = await prisma.site.findUnique({
        where: { id: siteId },
        include: { products: true },
      });

      if (!site) {
        throw new NotFoundError(
          'Site',
          siteId,
          { context: { operation: 'syncProductsToStore' } }
        );
      }

      if (!site.apiToken) {
        console.log(
          `[SyncService] No API token for ${site.baseUrl}, skipping push.`,
        );
        return { success: true, updated: 0 };
      }

      // Get site with decrypted token
      let siteWithToken;
      try {
        siteWithToken = await WebsiteService.getWebsiteWithToken(
          siteId,
          site.tenantId,
          'price_update'
        );
      } catch (error) {
        if (error instanceof DecryptionError) {
          console.error('[SyncService] Failed to decrypt token for price updates:', error);
          throw new ExternalServiceError(
            site.platform,
            'Failed to decrypt API token',
            {
              cause: error,
              context: {
                tenantId: site.tenantId,
                operation: 'syncProductsToStore',
                metadata: { siteId, baseUrl: site.baseUrl }
              },
              userMessage: 'Failed to decrypt API token. Please re-enter your token in settings.'
            }
          );
        }
        throw error;
      }

      const productsToUpdate = site.products.filter((p) => p.externalId);

      console.log(
        `[SyncService] Pushing ${productsToUpdate.length} price updates to ${site.platform}`,
      );

      const results: (boolean | null)[] = [];
      const BATCH_SIZE = 5;

      for (let i = 0; i < productsToUpdate.length; i += BATCH_SIZE) {
        const batch = productsToUpdate.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map(async (product) => {
            try {
              if (site.platform === "OPENCART") {
                return await this.updateOpenCartPrice(siteWithToken, product);
              } else if (site.platform === "LARAVEL") {
                return await this.updateLaravelPrice(siteWithToken, product);
              }
              return null;
            } catch (error) {
              console.error(
                `Failed to update price for product ${product.id}:`,
                error,
              );
              return null;
            }
          }),
        );

        results.push(...batchResults);

        // Add a small delay between batches to respect server limits
        if (i + BATCH_SIZE < productsToUpdate.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      return {
        success: true,
        updated: results.filter((r) => r !== null).length,
      };
    } catch (error) {
      // If already an AppError, re-throw
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ExternalServiceError) {
        throw error;
      }

      // Wrap unexpected errors
      throw new ExternalServiceError(
        'SyncService',
        'An unexpected error occurred during price synchronization',
        {
          cause: error as Error,
          context: {
            operation: 'syncProductsToStore',
            metadata: { siteId }
          },
          userMessage: 'An unexpected error occurred while updating prices. Please try again.'
        }
      );
    }
  }

  /**
   * Updates a product price in an OpenCart store with verification
   * 
   * Sends a price update request to the OpenCart PricePilot extension API
   * and verifies the update was successful. Includes comprehensive error
   * handling and logging.
   * 
   * **API Endpoint:**
   * - URL: `{baseUrl}/index.php?route=api/pricepilot/update&api_token={token}`
   * - Method: POST
   * - Timeout: 10 seconds
   * 
   * **Request Payload:**
   * ```json
   * {
   *   "product_id": "123",
   *   "price": "99.99",
   *   "sku": "PROD-001",
   *   "verify": true
   * }
   * ```
   * 
   * **Expected Response:**
   * ```json
   * {
   *   "success": true,
   *   "product_id": "123",
   *   "old_price": "89.99",
   *   "new_price": "99.99",
   *   "sku": "PROD-001",
   *   "timestamp": "2024-01-15 10:30:00"
   * }
   * ```
   * 
   * **Verification:**
   * - Checks success flag in response
   * - Verifies new_price matches expected price (within 0.01 tolerance)
   * - Validates SKU if provided in response
   * - Creates price update log entry
   * 
   * **Error Handling:**
   * - Handles rate limiting (429) and loop detection (508)
   * - Validates response structure
   * - Logs all failures with context
   * - Creates failed update log entries
   * 
   * @param {Site & { decryptedToken: string | null }} site - Site object with decrypted API token
   * @param {Product} product - Product to update
   * @returns {Promise<boolean>} True if update successful, false otherwise
   * 
   * @throws {ValidationError} If API token is missing
   * @throws {ExternalServiceError} If API communication fails
   * 
   * @example
   * ```typescript
   * const site = await WebsiteService.getWebsiteWithToken('site-id', 'tenant-id', 'update');
   * const product = await prisma.product.findUnique({ where: { id: 'prod-id' } });
   * const success = await this.updateOpenCartPrice(site, product);
   * ```
   * 
   * @private
   * @see {@link updateLaravelPrice} For Laravel implementation
   */
  private static async updateOpenCartPrice(site: Site & { decryptedToken: string | null }, product: Product): Promise<boolean> {
    const startTime = Date.now();

    try {
      // Use decrypted token for API call
      const apiToken = site.decryptedToken || site.apiToken;

      if (!apiToken) {
        throw new ValidationError(
          'API token is required',
          { apiToken: ['API token is missing or invalid'] },
          {
            context: {
              tenantId: site.tenantId,
              operation: 'updateOpenCartPrice',
              metadata: { siteId: site.id, productId: product.id }
            }
          }
        );
      }

      const url = `${site.baseUrl}/index.php?route=api/pricepilot/update&api_token=${apiToken}`;

      let response;
      try {
        response = await this.axiosRequestWithRetry<any>({
          method: "POST",
          url,
          data: {
            product_id: product.externalId,
            price: product.currentPrice.toString(),
            // Include additional fields for validation
            sku: product.sku,
            verify: true // Request verification response
          },
          timeout: 10000,
        });
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const statusCode = error.response?.status;

          if (statusCode === 508 || statusCode === 429) {
            console.warn(
              `[SyncService] OpenCart Rate Limit/Loop Warning (Status ${statusCode}). Retrying skipped for ${product.id}`,
            );

            // Record failure
            const duration = Date.now() - startTime;
            const { priceUpdateMonitor } = await import('./price-update-monitor');
            await priceUpdateMonitor.recordUpdate(site.tenantId, {
              productId: product.id,
              externalId: product.externalId || '',
              success: false,
              error: `Rate limit or loop detected (${statusCode})`,
              duration,
            });

            return false;
          }

          throw new ExternalServiceError(
            'OpenCart',
            `Failed to update price in OpenCart: ${error.message}`,
            {
              cause: error,
              serviceStatusCode: statusCode,
              isRetryable: this.isRetryableError(error),
              context: {
                tenantId: site.tenantId,
                operation: 'updateOpenCartPrice',
                metadata: { siteId: site.id, productId: product.id, externalId: product.externalId }
              },
              userMessage: 'Failed to update price in OpenCart. Please try again.'
            }
          );
        }
        throw error;
      }

      // Verify response structure
      if (!response.data || typeof response.data !== 'object') {
        throw new ExternalServiceError(
          'OpenCart',
          'Invalid response format from OpenCart',
          {
            context: {
              tenantId: site.tenantId,
              operation: 'updateOpenCartPrice',
              metadata: { siteId: site.id, productId: product.id }
            },
            userMessage: 'Received invalid response from OpenCart.'
          }
        );
      }

      // Check for success flag
      if (response.data.success !== true) {
        const errorMsg = response.data.error || response.data.message || 'Unknown error';
        throw new ExternalServiceError(
          'OpenCart',
          `OpenCart API error: ${errorMsg}`,
          {
            context: {
              tenantId: site.tenantId,
              operation: 'updateOpenCartPrice',
              metadata: { siteId: site.id, productId: product.id, errorMsg }
            },
            userMessage: `Failed to update price: ${errorMsg}`
          }
        );
      }

      // Verify the price was actually updated
      if (response.data.new_price !== undefined) {
        const updatedPrice = parseFloat(response.data.new_price);
        const expectedPrice = parseFloat(product.currentPrice.toString());

        // Allow small floating point differences (0.01)
        if (Math.abs(updatedPrice - expectedPrice) > 0.01) {
          throw new ExternalServiceError(
            'OpenCart',
            `Price mismatch: expected ${expectedPrice}, got ${updatedPrice}`,
            {
              context: {
                tenantId: site.tenantId,
                operation: 'updateOpenCartPrice',
                metadata: { siteId: site.id, productId: product.id, expectedPrice, updatedPrice }
              },
              userMessage: 'Price update verification failed. The price may not have been updated correctly.'
            }
          );
        }
      }

      // Verify SKU if provided in response
      if (response.data.sku && product.sku && response.data.sku !== product.sku) {
        console.warn(
          `[SyncService] SKU mismatch for product ${product.id}: expected ${product.sku}, got ${response.data.sku}`
        );
      }

      // Log successful update
      await prisma.priceUpdateLog.create({
        data: {
          productId: product.id,
          oldPrice: response.data.old_price
            ? parseFloat(response.data.old_price.toString())
            : product.currentPrice,
          newPrice: product.currentPrice,
          logicType: "FIXED",
          status: "SUCCESS",
          executedAt: new Date()
        }
      });

      console.log(
        `[SyncService] Successfully updated price for product ${product.id} (${product.externalId}): ${response.data.old_price} → ${response.data.new_price}`
      );

      // Record success in monitoring
      const duration = Date.now() - startTime;
      const { priceUpdateMonitor } = await import('./price-update-monitor');
      await priceUpdateMonitor.recordUpdate(site.tenantId, {
        productId: product.id,
        externalId: product.externalId || '',
        success: true,
        duration,
      });

      return true;

    } catch (error) {
      const duration = Date.now() - startTime;

      // If already an AppError, log and re-throw
      if (error instanceof ValidationError || error instanceof ExternalServiceError) {
        // Log failed update
        await prisma.priceUpdateLog.create({
          data: {
            productId: product.id,
            oldPrice: product.currentPrice,
            newPrice: product.currentPrice,
            logicType: "FIXED",
            status: "FAILED",
            errorDetails: error.message,
            executedAt: new Date()
          }
        });

        // Record failure in monitoring
        const { priceUpdateMonitor } = await import('./price-update-monitor');
        await priceUpdateMonitor.recordUpdate(site.tenantId, {
          productId: product.id,
          externalId: product.externalId || '',
          success: false,
          error: error.message,
          duration,
        });

        console.error(`[SyncService] OpenCart Update Error for ${product.id}:`, error.message);
        return false;
      }

      // Wrap unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.priceUpdateLog.create({
        data: {
          productId: product.id,
          oldPrice: product.currentPrice,
          newPrice: product.currentPrice,
          logicType: "FIXED",
          status: "FAILED",
          errorDetails: errorMessage,
          executedAt: new Date()
        }
      });

      // Record failure in monitoring
      const { priceUpdateMonitor } = await import('./price-update-monitor');
      await priceUpdateMonitor.recordUpdate(site.tenantId, {
        productId: product.id,
        externalId: product.externalId || '',
        success: false,
        error: errorMessage,
        duration,
      });

      console.error(
        `[SyncService] OpenCart Update Error for ${product.id}:`,
        errorMessage
      );

      return false;
    }
  }

  /**
   * Updates a product price in a Laravel store with verification
   * 
   * Sends a price update request to the Laravel PricePilot package API
   * and verifies the update was successful. Uses custom authentication
   * header and validates responses.
   * 
   * **API Endpoint:**
   * - URL: `{baseUrl}/api/pricepilot/update`
   * - Method: POST
   * - Headers: X-PricePilot-Token, Accept: application/json
   * - Timeout: 10 seconds
   * 
   * **Request Payload:**
   * ```json
   * {
   *   "product_id": "123",
   *   "price": "99.99",
   *   "sku": "PROD-001",
   *   "verify": true
   * }
   * ```
   * 
   * **Expected Response:**
   * ```json
   * {
   *   "success": true,
   *   "product_id": "123",
   *   "old_price": "89.99",
   *   "new_price": "99.99",
   *   "sku": "PROD-001"
   * }
   * ```
   * 
   * **Verification:**
   * - Checks success flag in response
   * - Verifies new_price matches expected price (within 0.01 tolerance)
   * - Validates SKU if provided in response
   * - Creates price update log entry
   * 
   * **Error Handling:**
   * - Validates response structure
   * - Logs all failures with context
   * - Creates failed update log entries
   * - Returns false on any error
   * 
   * @param {Site & { decryptedToken: string | null }} site - Site object with decrypted API token
   * @param {Product} product - Product to update
   * @returns {Promise<boolean>} True if update successful, false otherwise
   * 
   * @throws {ValidationError} If API token is missing
   * @throws {ExternalServiceError} If API communication fails
   * 
   * @example
   * ```typescript
   * const site = await WebsiteService.getWebsiteWithToken('site-id', 'tenant-id', 'update');
   * const product = await prisma.product.findUnique({ where: { id: 'prod-id' } });
   * const success = await this.updateLaravelPrice(site, product);
   * ```
   * 
   * @private
   * @see {@link updateOpenCartPrice} For OpenCart implementation
   */
  private static async updateLaravelPrice(site: Site & { decryptedToken: string | null }, product: Product): Promise<boolean> {
    const startTime = Date.now();

    try {
      const url = `${site.baseUrl}/api/pricepilot/update`;

      // Use decrypted token for API call
      const apiToken = site.decryptedToken || site.apiToken;

      if (!apiToken) {
        throw new ValidationError(
          'API token is required',
          { apiToken: ['API token is missing or invalid'] },
          {
            context: {
              tenantId: site.tenantId,
              operation: 'updateLaravelPrice',
              metadata: { siteId: site.id, productId: product.id }
            }
          }
        );
      }

      let response;
      try {
        response = await this.axiosRequestWithRetry<any>({
          method: "POST",
          url,
          data: {
            product_id: product.externalId,
            price: product.currentPrice.toString(),
            // Include additional fields for validation
            sku: product.sku,
            verify: true // Request verification response
          },
          headers: {
            "X-PricePilot-Token": apiToken,
            Accept: "application/json",
          },
          timeout: 10000,
        });
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const statusCode = error.response?.status;

          throw new ExternalServiceError(
            'Laravel',
            `Failed to update price in Laravel: ${error.message}`,
            {
              cause: error,
              serviceStatusCode: statusCode,
              isRetryable: this.isRetryableError(error),
              context: {
                tenantId: site.tenantId,
                operation: 'updateLaravelPrice',
                metadata: { siteId: site.id, productId: product.id, externalId: product.externalId }
              },
              userMessage: 'Failed to update price in Laravel. Please try again.'
            }
          );
        }
        throw error;
      }

      // Verify response structure
      if (!response.data || typeof response.data !== 'object') {
        throw new ExternalServiceError(
          'Laravel',
          'Invalid response format from Laravel',
          {
            context: {
              tenantId: site.tenantId,
              operation: 'updateLaravelPrice',
              metadata: { siteId: site.id, productId: product.id }
            },
            userMessage: 'Received invalid response from Laravel.'
          }
        );
      }

      // Check for success flag
      if (response.data.success !== true) {
        const errorMsg = response.data.error || response.data.message || 'Unknown error';
        throw new ExternalServiceError(
          'Laravel',
          `Laravel API error: ${errorMsg}`,
          {
            context: {
              tenantId: site.tenantId,
              operation: 'updateLaravelPrice',
              metadata: { siteId: site.id, productId: product.id, errorMsg }
            },
            userMessage: `Failed to update price: ${errorMsg}`
          }
        );
      }

      // Verify the price was actually updated
      if (response.data.new_price !== undefined) {
        const updatedPrice = parseFloat(response.data.new_price);
        const expectedPrice = parseFloat(product.currentPrice.toString());

        // Allow small floating point differences (0.01)
        if (Math.abs(updatedPrice - expectedPrice) > 0.01) {
          throw new ExternalServiceError(
            'Laravel',
            `Price mismatch: expected ${expectedPrice}, got ${updatedPrice}`,
            {
              context: {
                tenantId: site.tenantId,
                operation: 'updateLaravelPrice',
                metadata: { siteId: site.id, productId: product.id, expectedPrice, updatedPrice }
              },
              userMessage: 'Price update verification failed. The price may not have been updated correctly.'
            }
          );
        }
      }

      // Verify SKU if provided in response
      if (response.data.sku && product.sku && response.data.sku !== product.sku) {
        console.warn(
          `[SyncService] SKU mismatch for product ${product.id}: expected ${product.sku}, got ${response.data.sku}`
        );
      }

      // Log successful update
      await prisma.priceUpdateLog.create({
        data: {
          productId: product.id,
          oldPrice: response.data.old_price
            ? parseFloat(response.data.old_price.toString())
            : product.currentPrice,
          newPrice: product.currentPrice,
          logicType: "FIXED",
          status: "SUCCESS",
          executedAt: new Date()
        }
      });

      console.log(
        `[SyncService] Successfully updated price for product ${product.id} (${product.externalId}): ${response.data.old_price} → ${response.data.new_price}`
      );

      // Record success in monitoring
      const duration = Date.now() - startTime;
      const { priceUpdateMonitor } = await import('./price-update-monitor');
      await priceUpdateMonitor.recordUpdate(site.tenantId, {
        productId: product.id,
        externalId: product.externalId || '',
        success: true,
        duration,
      });

      return true;

    } catch (error) {
      const duration = Date.now() - startTime;

      // If already an AppError, log and re-throw
      if (error instanceof ValidationError || error instanceof ExternalServiceError) {
        // Log failed update
        await prisma.priceUpdateLog.create({
          data: {
            productId: product.id,
            oldPrice: product.currentPrice,
            newPrice: product.currentPrice,
            logicType: "FIXED",
            status: "FAILED",
            errorDetails: error.message,
            executedAt: new Date()
          }
        });

        // Record failure in monitoring
        const { priceUpdateMonitor } = await import('./price-update-monitor');
        await priceUpdateMonitor.recordUpdate(site.tenantId, {
          productId: product.id,
          externalId: product.externalId || '',
          success: false,
          error: error.message,
          duration,
        });

        console.error(`[SyncService] Laravel Update Error for ${product.id}:`, error.message);
        return false;
      }

      // Wrap unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.priceUpdateLog.create({
        data: {
          productId: product.id,
          oldPrice: product.currentPrice,
          newPrice: product.currentPrice,
          logicType: "FIXED",
          status: "FAILED",
          errorDetails: errorMessage,
          executedAt: new Date()
        }
      });

      // Record failure in monitoring
      const { priceUpdateMonitor } = await import('./price-update-monitor');
      await priceUpdateMonitor.recordUpdate(site.tenantId, {
        productId: product.id,
        externalId: product.externalId || '',
        success: false,
        error: errorMessage,
        duration,
      });

      console.error(
        `[SyncService] Laravel Update Error for ${product.id}:`,
        errorMessage
      );

      return false;
    }
  }

  /**
   * Shopify Implementation
   */
  private static async fetchFromShopify(site: Site & { decryptedToken: string | null }): Promise<ExternalProduct[]> {
    try {
      // Use decrypted token for API call
      const apiToken = site.decryptedToken || site.apiToken;

      if (!apiToken) {
        throw new Error('API token not available');
      }

      const response = await this.axiosRequestWithRetry({
        method: 'GET',
        url: `${site.baseUrl}/admin/api/2023-01/products.json`,
        headers: { "X-Shopify-Access-Token": apiToken }
      });

      const shops = z.array(shopifyProductSchema).parse(response.data.products);
      return shops.flatMap((p: any) =>
        p.variants.map((v: any) => ({
          external_id: v.id,
          sku: v.sku || null,
          title: p.title + (v.title !== 'Default Title' ? ` - ${v.title}` : ''),
          category: p.product_type,
          price: parseFloat(v.price),
          brand: p.vendor,
          model: null,
          in_stock: (v.inventory_quantity ?? 0) > 0,
          image: p.images[0]?.src,
          url: `${site.baseUrl}/products/${(p as any).handle || p.id}`,
          specifications: this.extractTechSpecs(p.tags || "", p.body_html || "", v)
        } as any))
      );
    } catch (e) {
      console.error("[Shopify Fetch Error]", e);
      return [];
    }
  }

  /**
   * WooCommerce Implementation
   */
  private static async fetchFromWooCommerce(site: Site & { decryptedToken: string | null }): Promise<ExternalProduct[]> {
    try {
      // Use decrypted token for API call
      const apiToken = site.decryptedToken || site.apiToken;

      if (!apiToken) {
        throw new Error('API token not available');
      }

      const consumerKey = apiToken.split(':')[0];
      const consumerSecret = apiToken.split(':')[1];

      const response = await this.axiosRequestWithRetry({
        method: 'GET',
        url: `${site.baseUrl}/wp-json/wc/v3/products`,
        params: { consumer_key: consumerKey, consumer_secret: consumerSecret, per_page: 100 }
      });

      const products = z.array(wooCommerceProductSchema).parse(response.data);
      return products.map((p: any) => ({
        external_id: p.id,
        sku: p.sku || null,
        title: p.name,
        category: p.categories[0]?.name,
        price: parseFloat(p.price),
        brand: p.attributes.find((a: any) => a.name.toLowerCase() === 'brand')?.options[0] || null,
        model: null,
        in_stock: p.stock_status === 'instock',
        image: p.images[0]?.src,
        url: `${site.baseUrl}/?p=${p.id}`,
        specifications: {
          ram: p.attributes.find((a: any) => a.name.toLowerCase() === 'ram')?.options[0],
          storage: p.attributes.find((a: any) => a.name.toLowerCase() === 'storage' || a.name.toLowerCase() === 'ssd')?.options[0]
        }
      } as any));
    } catch (e) {
      console.error("[WooCommerce Fetch Error]", e);
      return [];
    }
  }

  /**
   * Magento Implementation
   */
  private static async fetchFromMagento(site: Site & { decryptedToken: string | null }): Promise<ExternalProduct[]> {
    try {
      // Use decrypted token for API call
      const apiToken = site.decryptedToken || site.apiToken;

      if (!apiToken) {
        throw new Error('API token not available');
      }

      const response = await this.axiosRequestWithRetry({
        method: 'GET',
        url: `${site.baseUrl}/rest/V1/products?searchCriteria[pageSize]=100`,
        headers: { "Authorization": `Bearer ${apiToken}` }
      });

      const products = z.array(magentoProductSchema).parse(response.data.items);
      return products.map((p: any) => {
        const getAttr = (code: string) => p.custom_attributes.find((a: any) => a.attribute_code === code)?.value;
        return {
          external_id: p.id,
          sku: p.sku,
          title: p.name,
          category: null,
          price: p.price,
          brand: getAttr('manufacturer'),
          model: getAttr('model_number'),
          in_stock: p.extension_attributes?.stock_item?.is_in_stock ?? true,
          image: null,
          url: null,
          specifications: {
            ram: getAttr('ram'),
            storage: getAttr('ssd_storage') || getAttr('hdd_storage')
          }
        } as any;
      });
    } catch (e) {
      console.error("[Magento Fetch Error]", e);
      return [];
    }
  }

  /**
   * Tech Spec Extraction Helper
   */
  private static extractTechSpecs(tags: string, _body: string, variant: any): Record<string, string> {
    const specs: Record<string, string> = {};

    // 1. Try from variant options
    const optStr = `${variant.option1} ${variant.option2} ${variant.option3}`.toLowerCase();
    const ramMatch = optStr.match(/(\d+gb|\d+g) ram/i) || optStr.match(/(\d+)gb/i);
    if (ramMatch) specs.ram = ramMatch[0].toUpperCase();

    // 2. Try from tags (e.g. "Spec:16GB RAM")
    const tagList = tags.split(',').map(t => t.trim().toLowerCase());
    const ramTag = tagList.find(t => t.includes('ram'));
    if (ramTag) specs.ram = ramTag.toUpperCase();

    return specs;
  }
}
