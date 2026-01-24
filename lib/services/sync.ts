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

interface ExternalProduct {
  external_id: string;
  sku: string | null;
  title: string;
  category?: string | null;
  price: number;
  brand: string | null;
  model: string | null;
  in_stock: boolean;
  image?: string;
  id?: string;
  url: string | null;
}

const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000;

export class SyncService {
  /**
   * Triggers a sync for a specific site
   */
  static async syncSite(siteId: string) {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { tenant: true },
    });

    if (!site) throw new Error("Site not found");

    const startTime = new Date();
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
      let externalProducts: ExternalProduct[] = [];
      if (site.platform === "OPENCART") {
        externalProducts = await this.fetchFromOpenCart(site);
      } else if (site.platform === "LARAVEL") {
        externalProducts = await this.fetchFromLaravel(site);
      } else if (site.platform === "SHOPIFY") {
        externalProducts = await this.fetchFromShopify(site);
      } else if (site.platform === "WOOCOMMERCE") {
        externalProducts = await this.fetchFromWooCommerce(site);
      } else if (site.platform === "MAGENTO") {
        externalProducts = await this.fetchFromMagento(site);
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
      const results = [];
      let processed = 0;

      for (const extProd of externalProducts) {
        try {
          // Check if sync was manually stopped
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

          const product = await prisma.$transaction(async (tx) => {
            // Find existing product by externalId within this site
            const existingProduct = await tx.product.findFirst({
              where: {
                siteId: site.id,
                externalId: extProd.external_id,
              },
            });

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

      // Ensure we clear the sync lock on error
      await prisma.site.update({
        where: { id: siteId },
        data: { isSyncing: false },
      });
      throw error;
    }
  }

  /**
   * Helper to execute Axios requests with retry logic (Exponential Backoff)
   */
  private static async axiosRequestWithRetry<T = any>(
    config: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    let lastError: any;

    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        return await axios(config);
      } catch (error) {
        lastError = error;

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          // Don't retry client errors (4xx), except for Rate Limiting (429) and Request Timeout (408)
          if (
            status &&
            status >= 400 &&
            status < 500 &&
            status !== 429 &&
            status !== 408
          ) {
            throw error;
          }
        }

        // If it's the last attempt, don't wait, just throw
        if (i === MAX_RETRIES - 1) break;

        const delay = INITIAL_BACKOFF * Math.pow(2, i);
        console.warn(
          `[SyncService] Request to ${config.url} failed. Retrying in ${delay}ms... (Attempt ${i + 1}/${MAX_RETRIES})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Fetch products from OpenCart API
   */
  private static async fetchFromOpenCart(
    site: Site,
  ): Promise<ExternalProduct[]> {
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
      // Normalize URL (avoid double slashes)
      const cleanBaseUrl = site.baseUrl.replace(/\/$/, "");
      const apiUrl = `${cleanBaseUrl}/index.php?route=api/pricepilot&api_token=${site.apiToken}`;
      
      console.log(`[SyncService] Fetching from OpenCart: ${apiUrl}`);

      const response = await this.axiosRequestWithRetry<any>({
        method: "GET",
        url: apiUrl,
        timeout: 30000,
      });

      // Check for HTML response (happens on 404/500 if server returns error page)
      if (typeof response.data === "string" && response.data.includes("<html")) {
        console.error(`[SyncService] Received HTML instead of JSON from ${site.baseUrl}. Check if the PricePilot extension is correctly installed and accessible.`);
        throw new Error("Invalid API response: Received HTML instead of JSON");
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
        sku: p.sku || null,
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
      console.error(`OpenCart API error for ${site.baseUrl}:`, error);

      // Fallback to mock data for development
      console.log(`Using mock data for OpenCart: ${site.baseUrl}`);
      return [
        {
          external_id: "oc_1",
          sku: "NIKE-AM-270",
          title: "Nike Air Max 270",
          price: 150.0,
          brand: "Nike",
          model: "270",
          in_stock: true,
          url: "https://demo.opencart.com/index.php?route=product/product&product_id=1",
        },
        {
          external_id: "oc_2",
          sku: "ADIDAS-UB-22",
          title: "Adidas Ultraboost 22",
          price: 180.0,
          brand: "Adidas",
          model: "22",
          in_stock: false,
          url: "https://demo.opencart.com/index.php?route=product/product&product_id=2",
        },
      ];
    }
  }

  /**
   * Fetch products from Laravel API
   */
  private static async fetchFromLaravel(
    site: Site,
  ): Promise<ExternalProduct[]> {
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
      const response = await this.axiosRequestWithRetry<{
        data: LaravelProduct[];
      }>({
        method: "GET",
        url: `${site.baseUrl}/api/pricepilot/sync`,
        headers: {
          "X-PricePilot-Token": site.apiToken,
          Accept: "application/json",
        },
        timeout: 30000,
      });

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
        sku: p.sku || null,
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
      console.error(`Laravel API error for ${site.baseUrl}:`, error);

      // Fallback to mock data for development
      console.log(`Using mock data for Laravel: ${site.baseUrl}`);
      return [
        {
          external_id: "lv_1",
          sku: "PUMA-RS-X",
          title: "Puma RS-X",
          price: 110.0,
          brand: "Puma",
          model: "RS-X",
          in_stock: true,
          url: "https://demo.laravel.com/products/puma-rs-x",
        },
      ];
    }
  }

  /**
   * Pushes latest price updates for all products of a site back to the external platform
   */
  static async syncProductsToStore(siteId: string) {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { products: true },
    });

    if (!site) throw new Error("Site not found");

    if (!site.apiToken) {
      console.log(
        `[SyncService] No API token for ${site.baseUrl}, skipping push.`,
      );
      return { success: true, updated: 0 };
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
              return await this.updateOpenCartPrice(site, product);
            } else if (site.platform === "LARAVEL") {
              return await this.updateLaravelPrice(site, product);
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
  }

  /**
   * Update price in OpenCart
   */
  private static async updateOpenCartPrice(site: Site, product: Product) {
    // This is a placeholder for actual API call
    // In real OpenCart PicePilot extension, we would call a specific route
    const url = `${site.baseUrl}/index.php?route=api/pricepilot/update&api_token=${site.apiToken}`;

    try {
      await this.axiosRequestWithRetry({
        method: "POST",
        url,
        data: {
          product_id: product.externalId,
          price: product.currentPrice.toString(),
        },
        timeout: 10000,
      });
      return true;
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 508 || error.response?.status === 429)
      ) {
        console.warn(
          `[SyncService] OpenCart Rate Limit/Loop Warning (Status ${error.response.status}). Retrying skipped for ${product.id}`,
        );
      } else {
        console.error(
          `OpenCart Update Error for ${product.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
      return false;
    }
  }

  /**
   * Update price in Laravel
   */
  private static async updateLaravelPrice(site: Site, product: Product) {
    const url = `${site.baseUrl}/api/pricepilot/update`;

    try {
      await this.axiosRequestWithRetry({
        method: "POST",
        url,
        data: {
          product_id: product.externalId,
          price: product.currentPrice.toString(),
        },
        headers: {
          "X-PricePilot-Token": site.apiToken,
          Accept: "application/json",
        },
        timeout: 10000,
      });
      return true;
    } catch (error) {
      console.error(`Laravel Update Error for ${product.id}:`, error);
      return false;
    }
  }

  /**
   * Shopify Implementation
   */
  private static async fetchFromShopify(site: Site): Promise<ExternalProduct[]> {
    try {
      const response = await this.axiosRequestWithRetry({
         method: 'GET',
         url: `${site.baseUrl}/admin/api/2023-01/products.json`,
         headers: { "X-Shopify-Access-Token": site.apiToken || "" }
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
  private static async fetchFromWooCommerce(site: Site): Promise<ExternalProduct[]> {
    try {
      const consumerKey = site.apiToken?.split(':')[0];
      const consumerSecret = site.apiToken?.split(':')[1];
      
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
  private static async fetchFromMagento(site: Site): Promise<ExternalProduct[]> {
    try {
      const response = await this.axiosRequestWithRetry({
        method: 'GET',
        url: `${site.baseUrl}/rest/V1/products?searchCriteria[pageSize]=100`,
        headers: { "Authorization": `Bearer ${site.apiToken}` }
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
  private static extractTechSpecs(tags: string, body: string, variant: any): Record<string, string> {
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
