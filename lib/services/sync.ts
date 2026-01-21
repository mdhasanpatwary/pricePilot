import { prisma } from "@/lib/prisma";
import { Product, Site } from "@prisma/client";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

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

    // 1. Fetch products from external platform
    if (!site.apiToken) {
      console.log(
        `[SyncService] No API token for ${site.baseUrl}, skipping fetch.`,
      );
      return { count: 0, siteName: site.baseUrl };
    }

    let externalProducts: ExternalProduct[] = [];
    if (site.platform === "OPENCART") {
      externalProducts = await this.fetchFromOpenCart(site);
    } else if (site.platform === "LARAVEL") {
      externalProducts = await this.fetchFromLaravel(site);
    }

    // 2. Process and Upsert products
    const results = [];
    for (const extProd of externalProducts) {
      // Find existing product by externalId within this site
      const existingProduct = await prisma.product.findFirst({
        where: {
          siteId: site.id,
          externalId: extProd.external_id,
        },
      });

      let product;
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
        product = await prisma.product.update({
          where: { id: existingProduct.id },
          data: productData,
        });
      } else {
        product = await prisma.product.create({
          data: {
            ...productData,
            siteId: site.id,
            tenantId: site.tenantId,
            externalId: extProd.external_id,
            currency: "USD",
          },
        });
      }

      // 3. Record price history
      await prisma.priceHistory.create({
        data: {
          productId: product.id,
          price: extProd.price,
        },
      });

      results.push(product);
    }

    // 4. Update last sync time
    await prisma.site.update({
      where: { id: siteId },
      data: { lastSyncAt: new Date() },
    });

    return {
      count: results.length,
      siteName: site.baseUrl,
    };
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
      quantity: number;
      stock_status: string;
    }

    try {
      const response = await this.axiosRequestWithRetry<{
        products: OpenCartProduct[];
      }>({
        method: "GET",
        url: `${site.baseUrl}/index.php?route=api/pricepilot&api_token=${site.apiToken}`,
        timeout: 30000,
      });

      // Expected OpenCart response format:
      // { products: [{ product_id, sku, name, price, manufacturer, model }] }
      const products: OpenCartProduct[] = response.data.products || [];

      return products.map((p) => ({
        external_id: p.product_id?.toString() || p.id?.toString() || "",
        sku: p.sku || null,
        title: p.name || p.title || "Unknown Product",
        category: p.category || null,
        price: parseFloat(p.price || p.special || "0"),
        brand: p.manufacturer || null,
        model: p.model || null,
        in_stock: p.quantity > 0 || p.stock_status === "In Stock",
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
      const products: LaravelProduct[] =
        response.data.data || response.data || [];

      return products.map((p) => ({
        external_id: p.id?.toString() || "",
        sku: p.sku || null,
        title: p.name || p.title || "Unknown Product",
        category: p.category || null,
        price: parseFloat(p.price || "0"),
        brand: p.brand || null,
        model: p.model || null,
        in_stock: p.in_stock ?? true,
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
}
